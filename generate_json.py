"""
UCW TAT Dashboard — JSON Generator
Netscribes × TataCliq

Reads the monthly Jira Excel export and produces three JSON files
for the Lovable frontend. No database required.

Output files (copy all three into Lovable's /public folder):
    wow.json           — Tab 1: week-on-week table
    summary.json       — Tab 2: monthly summary + KPI cards
    bifurcation.json   — Tab 3: TAT bifurcation table

Usage:
    python generate_json.py

Each time you load a new month's Excel, re-run this script and
replace the three files in /public. No other changes needed.
"""

import json
import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

# ------------------------------------------------------------------
# CONFIG — driven by environment variables in CI, with local defaults.
#   EXCEL_PATH : path to the uploaded Jira Excel  (default: data/incoming/latest.xlsx)
#   OUTPUT_DIR : where the JSON is written        (default: public/data)
# This is the ONLY change from the desktop version — the analytics logic
# below is unchanged, so the numbers match exactly.
# ------------------------------------------------------------------
import os

EXCEL_PATH = os.environ.get("EXCEL_PATH", "data/incoming/latest.xlsx")
SHEET_NAME = "Your Jira Issues"
ESCALATIONS_SHEET = "Esclations"

# Output directory — json files will save here
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "public/data"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------
# STATUS CLASSIFICATION
# ------------------------------------------------------------------
CLOSED_STATUSES = {
    "CLOSED",
    "CLOSED Due to Inactive/Insufficient Information",
}
TERMINAL_NON_OPEN = {"FAILED"}


# ------------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------------

def safe_round(val, decimals=2):
    """Round a value, return None if it's NaN/None/inf."""
    if val is None:
        return None
    try:
        if math.isnan(val) or math.isinf(val):
            return None
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return None


def business_days_between(start: datetime, end: datetime,
                           close_on_saturday: bool = False) -> float:
    if pd.isna(start) or pd.isna(end) or start >= end:
        return 0.0
    start_date = start.date() if hasattr(start, "date") else start
    end_date   = end.date()   if hasattr(end,   "date") else end
    if close_on_saturday and end_date.weekday() == 5:
        end_date = end_date + timedelta(days=1)
    count = 0
    current = start_date
    while current < end_date:
        if current.weekday() < 5:
            count += 1
        current += timedelta(days=1)
    return float(count)


def weighted_avg_tat(df: pd.DataFrame) -> float | None:
    """
    Weighted average TAT — weight = GREATEST(total_sku_count, 1).
    This is the correct formula used throughout the dashboard.
    """
    weights = df["total_sku_count"].apply(
        lambda x: max(int(x), 1) if pd.notna(x) and x > 0 else 1
    )
    numerator   = (df["tat_adjusted"] * weights).sum()
    denominator = weights.sum()
    if denominator == 0:
        return None
    return safe_round(numerator / denominator)


def iso_week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def iso_week_end(d: date) -> date:
    return iso_week_start(d) + timedelta(days=6)


# ------------------------------------------------------------------
# LOAD & CLEAN
# ------------------------------------------------------------------

def load_and_clean() -> pd.DataFrame:
    print(f"Reading: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    print(f"Raw shape: {df.shape[0]} rows × {df.shape[1]} cols")

    col_map = {
        "Key":                   "ticket_key",
        "Summary":               "summary",
        "Status":                "status",
        "Priority":              "priority",
        "Assignee":              "assignee",
        "Reporter":              "reporter",
        "Created":               "created_at",
        "Updated":               "updated_at",
        "Total SKU Count":       "total_sku_count",
        "Closed SKU Count":      "closed_sku_count",
        "Listed Option Count":   "listed_option_count",
        "Total Option Count":    "total_option_count",
        "Listing Type - Sorted": "listing_type_group",
        "Listing Type":          "listing_type_detail",
        "L1 for UCW":            "l1_category",
        "Brand Name":            "brand_name",
        "Platform.":             "platform_raw",
        "TAT (Days)":            "tat_raw",
        "Brand To resolve":      "brand_to_resolve",
        "Comment2":              "comment_adhoc",
    }

    for src in col_map:
        if src not in df.columns:
            print(f"  WARNING: expected column missing: '{src}'")

    df = df.rename(columns=col_map)
    keep = [v for v in col_map.values() if v in df.columns]
    df = df[keep].copy()

    # Timestamps — make timezone-aware
    for col in ("created_at", "updated_at"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    # Numeric
    for col in ("total_sku_count", "closed_sku_count",
                "listed_option_count", "total_option_count"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").apply(
                lambda x: int(x) if pd.notna(x) else None
            )
    df["tat_raw"] = pd.to_numeric(df["tat_raw"], errors="coerce")

    # Text
    text_cols = ["ticket_key", "status", "priority", "assignee", "reporter",
                 "listing_type_group", "listing_type_detail", "l1_category",
                 "brand_name", "platform_raw", "brand_to_resolve", "comment_adhoc"]
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace({"nan": None, "None": None, "": None})

    # Normalize brand_name to Title Case so PUMA/Puma/puma all merge
    if "brand_name" in df.columns:
        df["brand_name"] = df["brand_name"].apply(
            lambda x: x.title() if isinstance(x, str) else None
        )

    # Flags
    df["is_closed"] = df["status"].isin(CLOSED_STATUSES)
    df["is_open"]   = (~df["is_closed"]) & (~df["status"].isin(TERMINAL_NON_OPEN))
    df["is_e2e"]    = df["listing_type_group"].isin({"E2E", "E2E GC"})
    df["is_adhoc"]  = df["listing_type_group"] == "Ad-hoc"

    # Volume columns
    df["adhoc_sku_count"] = df.apply(
        lambda r: (r["total_sku_count"] or 0) if r["is_adhoc"] else 0, axis=1
    )
    df["e2e_option_count"] = df.apply(
        lambda r: (r["total_option_count"] or 0) if r["is_e2e"] else 0, axis=1
    )

    # Week fields
    def get_week_fields(ts):
        if pd.isna(ts):
            return None, None, None
        d = ts.date()
        return d.isocalendar()[1], iso_week_start(d), iso_week_end(d)

    df[["week_number", "week_start", "week_end"]] = df["created_at"].apply(
        lambda ts: pd.Series(get_week_fields(ts))
    )
    df["week_number"] = df["week_number"].apply(
        lambda x: int(x) if pd.notna(x) else None
    )

    # data_month — auto-derived from earliest created_at
    earliest = df["created_at"].dropna().min()
    df["data_month"] = date(earliest.year, earliest.month, 1).isoformat()

    # TAT adjusted
    now = datetime.now(timezone.utc)

    def compute_tat(row):
        created  = row["created_at"]
        updated  = row["updated_at"]
        is_closed = row["is_closed"]
        if pd.isna(created):
            return 0.0
        if is_closed and pd.notna(updated):
            close_on_sat = updated.weekday() == 5
            return business_days_between(created, updated, close_on_saturday=close_on_sat)
        return business_days_between(created, now)

    df["tat_adjusted"] = df.apply(compute_tat, axis=1).round(2)

    print(f"Cleaned: {len(df)} rows | data_month: {df['data_month'].iloc[0]}")
    return df


# ------------------------------------------------------------------
# WOW.JSON — Tab 1
# ------------------------------------------------------------------

def build_wow(df: pd.DataFrame) -> dict:
    data_month = df["data_month"].iloc[0]

    weeks = []
    prev_tickets = None

    for week_num in sorted(df["week_number"].dropna().unique()):
        wdf = df[df["week_number"] == week_num]

        ticket_count = len(wdf)
        wow_pct = None
        if prev_tickets is not None and prev_tickets > 0:
            wow_pct = safe_round((ticket_count - prev_tickets) / prev_tickets * 100)

        weeks.append({
            "week_number":    int(week_num),
            "week_start":     wdf["week_start"].iloc[0].isoformat(),
            "week_end":       wdf["week_end"].iloc[0].isoformat(),
            "tickets":        ticket_count,
            "adhoc_skus":     int(wdf["adhoc_sku_count"].sum()),
            "e2e_options":    int(wdf["e2e_option_count"].sum()),
            "avg_tat":        weighted_avg_tat(wdf),
            "e2e_tickets":    int(wdf["is_e2e"].sum()),
            "adhoc_tickets":  int(wdf["is_adhoc"].sum()),
            "closed_tickets": int(wdf["is_closed"].sum()),
            "open_tickets":   int(wdf["is_open"].sum()),
            "wow_pct":        wow_pct,
        })
        prev_tickets = ticket_count

    # Running cumulative
    running = 0
    for w in weeks:
        running += w["tickets"]
        w["cumulative_tickets"] = running

    # Per-week brand breakdown — powers the Top Brands filter in WoW tab
    brands_by_week: dict = {}
    for week_num in sorted(df["week_number"].dropna().unique()):
        wdf = df[df["week_number"] == week_num]
        brand_rows = []
        for brand, gdf in wdf.groupby("brand_name", dropna=False):
            if not brand or str(brand).lower() in ("nan", "none", ""):
                continue
            brand_rows.append({
                "brand_name":   brand,
                "tickets":      len(gdf),
                "adhoc_skus":   int(gdf["adhoc_sku_count"].sum()),
                "e2e_options":  int(gdf["e2e_option_count"].sum()),
                "avg_tat":      weighted_avg_tat(gdf),
                "closure_rate": safe_round(
                    gdf["is_closed"].sum() / len(gdf) * 100
                ) if len(gdf) else None,
            })
        brand_rows.sort(key=lambda r: r["tickets"], reverse=True)
        brands_by_week[str(int(week_num))] = brand_rows

    # Top-level KPIs
    kpis = {
        "total_tickets":   len(df),
        "adhoc_skus":      int(df["adhoc_sku_count"].sum()),
        "e2e_options":     int(df["e2e_option_count"].sum()),
        "avg_tat":         weighted_avg_tat(df),
        "e2e_tickets":     int(df["is_e2e"].sum()),
        "adhoc_tickets":   int(df["is_adhoc"].sum()),
        "closed_tickets":  int(df["is_closed"].sum()),
        "open_tickets":    int(df["is_open"].sum()),
        "closure_rate":    safe_round(df["is_closed"].sum() / len(df) * 100),
    }

    return {
        "data_month": data_month,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kpis": kpis,
        "weeks": weeks,
        "brands_by_week": brands_by_week,
    }


# ------------------------------------------------------------------
# SUMMARY.JSON — Tab 2
# ------------------------------------------------------------------

def build_summary(df: pd.DataFrame) -> dict:
    data_month = df["data_month"].iloc[0]

    # -- Priority breakdown --
    priority_rows = []
    for pri, gdf in df.groupby("priority", dropna=False):
        priority_rows.append({
            "priority":     pri or "Unknown",
            "count":        len(gdf),
            "pct_of_total": safe_round(len(gdf) / len(df) * 100),
            "avg_tat":      weighted_avg_tat(gdf),
            "closure_rate": safe_round(gdf["is_closed"].sum() / len(gdf) * 100),
        })

    # -- Status breakdown --
    status_rows = []
    for status, gdf in df.groupby("status", dropna=False):
        # avg SKUs/options: use total_sku_count for ad-hoc, total_option_count for E2E
        avg_volume = safe_round(
            gdf["total_sku_count"].fillna(gdf["total_option_count"]).mean()
        )
        status_rows.append({
            "status":        status or "Unknown",
            "count":         len(gdf),
            "pct_of_total":  safe_round(len(gdf) / len(df) * 100),
            "avg_tat":       weighted_avg_tat(gdf),
            "avg_volume":    avg_volume,
        })

    # -- Listing type analysis --
    listing_rows = []
    for lt, gdf in df.groupby("listing_type_group", dropna=False):
        listing_rows.append({
            "listing_type_group": lt or "Unknown",
            "tickets":            len(gdf),
            "adhoc_skus":         int(gdf["adhoc_sku_count"].sum()),
            "e2e_options":        int(gdf["e2e_option_count"].sum()),
            "avg_tat":            weighted_avg_tat(gdf),
            "total_options":      int(gdf["total_option_count"].fillna(0).sum()),
        })

    # -- Category L1 distribution --
    category_rows = []
    for cat, gdf in df.groupby("l1_category", dropna=False):
        if not cat or str(cat).lower() in ("nan", "none", ""):
            continue
        category_rows.append({
            "l1_category":  cat or "Unknown",
            "tickets":      len(gdf),
            "adhoc_skus":   int(gdf["adhoc_sku_count"].sum()),
            "e2e_options":  int(gdf["e2e_option_count"].sum()),
            "avg_tat":      weighted_avg_tat(gdf),
            "closure_rate": safe_round(gdf["is_closed"].sum() / len(gdf) * 100),
        })
    category_rows.sort(key=lambda r: r["tickets"], reverse=True)

    # -- Platform distribution --
    # -- Platform distribution --
    platform_rows = []
    for plat, gdf in df.groupby("platform_raw", dropna=False):
        if not plat or str(plat).lower() in ("nan", "none", ""):
            continue
        platform_rows.append({
            "platform":    str(plat).strip(),
            "tickets":     len(gdf),
            "adhoc_skus":  int(gdf["adhoc_sku_count"].sum()),
            "e2e_options": int(gdf["e2e_option_count"].sum()),
            "avg_tat":     weighted_avg_tat(gdf),
        })
    platform_rows.sort(key=lambda r: r["tickets"], reverse=True)

    # -- TAT insights --
    tat_insights = {
        "overall_avg":  weighted_avg_tat(df),
        "min_tat":      safe_round(df["tat_adjusted"].min()),
        "max_tat":      safe_round(df["tat_adjusted"].max()),
        "median_tat":   safe_round(df["tat_adjusted"].median()),
        "pct_0_5":      safe_round(
            (df["tat_adjusted"] < 5).sum() / len(df) * 100
        ),
        "pct_5_15":     safe_round(
            ((df["tat_adjusted"] >= 5) & (df["tat_adjusted"] < 15)).sum() / len(df) * 100
        ),
        "pct_15_plus":  safe_round(
            (df["tat_adjusted"] >= 15).sum() / len(df) * 100
        ),
        "green_count":  int((df["tat_adjusted"] < 5).sum()),
        "amber_count":  int(((df["tat_adjusted"] >= 5) & (df["tat_adjusted"] < 15)).sum()),
        "red_count":    int((df["tat_adjusted"] >= 15).sum()),
    }

    # -- Top brands --
    brand_rows = []
    for brand, gdf in df.groupby("brand_name", dropna=False):
        if not brand or str(brand).lower() in ("nan", "none", ""):
            continue
        brand_rows.append({
            "brand_name":   brand,
            "tickets":      len(gdf),
            "adhoc_skus":   int(gdf["adhoc_sku_count"].sum()),
            "e2e_options":  int(gdf["e2e_option_count"].sum()),
            "avg_tat":      weighted_avg_tat(gdf),
            "closure_rate": safe_round(gdf["is_closed"].sum() / len(gdf) * 100),
        })
    brand_rows.sort(key=lambda r: r["tickets"], reverse=True)
    brand_rows = brand_rows[:20]  # top 20

    # -- Assignee breakdown --
    assignee_rows = []
    for assignee, gdf in df.groupby("assignee", dropna=False):
        if not assignee or assignee == "None":
            continue
        assignee_rows.append({
            "assignee":     assignee,
            "tickets":      len(gdf),
            "adhoc_skus":   int(gdf["adhoc_sku_count"].sum()),
            "e2e_options":  int(gdf["e2e_option_count"].sum()),
            "avg_tat":      weighted_avg_tat(gdf),
            "closure_rate": safe_round(gdf["is_closed"].sum() / len(gdf) * 100),
        })
    assignee_rows.sort(key=lambda r: r["tickets"], reverse=True)

    # -- Key insight banner values --
    peak_week = max(
        df.groupby("week_number").size().items(),
        key=lambda x: x[1]
    )

    top_category = category_rows[0]["l1_category"] if category_rows else None
    top_assignee = assignee_rows[0]["assignee"] if assignee_rows else None

    banner = {
        "peak_week":        int(peak_week[0]),
        "peak_week_tickets": int(peak_week[1]),
        "closure_rate":     safe_round(df["is_closed"].sum() / len(df) * 100),
        "total_tickets":    len(df),
        "total_skus":       int(df["total_sku_count"].fillna(0).sum()),
        "e2e_vs_adhoc":     f"{int(df['is_e2e'].sum())} E2E / {int(df['is_adhoc'].sum())} Ad-hoc",
        "top_category":     top_category,
        "top_assignee":     top_assignee,
        "avg_tat":          weighted_avg_tat(df),
    }

    return {
        "data_month":      data_month,
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "banner":          banner,
        "priority":        priority_rows,
        "status":          status_rows,
        "listing_type":    listing_rows,
        "category":        category_rows,
        "platform":        platform_rows,
        "tat_insights":    tat_insights,
        "top_brands":      brand_rows,
        "assignees":       assignee_rows,
    }


# ------------------------------------------------------------------
# BIFURCATION.JSON — Tab 3
# ------------------------------------------------------------------

def build_bifurcation(df: pd.DataFrame) -> dict:
    data_month = df["data_month"].iloc[0]

    BUCKETS = [
        ("0-3 Days",  0,  4,  1),
        ("4-7 Days",  4,  8,  2),
        ("8-11 Days", 8,  12, 3),
        ("12-16 Days",12, 16, 4),
        ("16+ Days",  16, 999,5),
    ]

    def assign_bucket(tat):
        for label, lo, hi, order in BUCKETS:
            if lo <= tat < hi:
                return label, order
        return "16+ Days", 5

    df = df.copy()
    df[["tat_bucket", "bucket_order"]] = df["tat_adjusted"].apply(
        lambda t: pd.Series(assign_bucket(t))
    )

    # -- Overall (all categories) --
    overall_rows = []
    total_tickets = len(df)
    for label, lo, hi, order in BUCKETS:
        bdf = df[df["tat_bucket"] == label]
        overall_rows.append({
            "tat_bucket":   label,
            "bucket_order": order,
            "tickets":      len(bdf),
            "e2e_options":  int(bdf["e2e_option_count"].sum()),
            "avg_tat":      weighted_avg_tat(bdf) if len(bdf) else None,
            "pct":          safe_round(len(bdf) / total_tickets * 100) if total_tickets else 0,
        })

    # -- By category --
    by_category = {}
    for cat, cdf in df.groupby("l1_category", dropna=False):
        if not cat or str(cat).lower() in ("nan", "none", ""):
            continue
        cat_key = str(cat)
        cat_total = len(cdf)
        cat_rows = []
        for label, lo, hi, order in BUCKETS:
            bdf = cdf[cdf["tat_bucket"] == label]
            cat_rows.append({
                "tat_bucket":   label,
                "bucket_order": order,
                "tickets":      len(bdf),
                "e2e_options":  int(bdf["e2e_option_count"].sum()),
                "avg_tat":      weighted_avg_tat(bdf) if len(bdf) else None,
                "pct":          safe_round(len(bdf) / cat_total * 100) if cat_total else 0,
            })
        by_category[cat_key] = cat_rows

    # -- Available filter values --
    categories = sorted([c for c in df["l1_category"].dropna().unique()])

    return {
        "data_month":    data_month,
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "categories":    categories,
        "overall":       overall_rows,
        "by_category":   by_category,
    }




# ------------------------------------------------------------------
# EOD.JSON — Tab 4: Day-wise view
# ------------------------------------------------------------------

def build_eod(df: pd.DataFrame) -> dict:
    data_month = df["data_month"].iloc[0]

    # derive created_date column
    df = df.copy()
    df["created_date"] = df["created_at"].dt.date.apply(lambda d: d.isoformat() if d else None)

    days = []
    for day_str in sorted(df["created_date"].dropna().unique()):
        ddf = df[df["created_date"] == day_str]

        # Status breakdown for the day
        status_rows = []
        for status, gdf in ddf.groupby("status", dropna=False):
            if not status:
                continue
            status_rows.append({
                "status": status,
                "count":  len(gdf),
            })

        # Category breakdown
        cat_rows = []
        for cat, gdf in ddf.groupby("l1_category", dropna=False):
            if not cat or str(cat).lower() in ("nan", "none", ""):
                continue
            cat_rows.append({
                "category":    cat,
                "tickets":     len(gdf),
                "adhoc_skus":  int(gdf["adhoc_sku_count"].sum()),
                "e2e_options": int(gdf["e2e_option_count"].sum()),
                "avg_tat":     weighted_avg_tat(gdf),
            })
        cat_rows.sort(key=lambda r: r["tickets"], reverse=True)

        # Platform breakdown
        plat_rows = []
        for plat, gdf in ddf.groupby("platform_raw", dropna=False):
            if not plat or str(plat).lower() in ("nan", "none", ""):
                continue
            plat_rows.append({
                "platform":    str(plat).strip(),
                "tickets":     len(gdf),
                "adhoc_skus":  int(gdf["adhoc_sku_count"].sum()),
                "e2e_options": int(gdf["e2e_option_count"].sum()),
                "avg_tat":     weighted_avg_tat(gdf),
            })
        plat_rows.sort(key=lambda r: r["tickets"], reverse=True)

        # Listing type breakdown
        listing_rows = []
        for lt, gdf in ddf.groupby("listing_type_group", dropna=False):
            if not lt:
                continue
            listing_rows.append({
                "listing_type": lt,
                "tickets":      len(gdf),
                "adhoc_skus":   int(gdf["adhoc_sku_count"].sum()),
                "e2e_options":  int(gdf["e2e_option_count"].sum()),
                "avg_tat":      weighted_avg_tat(gdf),
            })

        # Brand breakdown
        brand_rows = []
        for brand, gdf in ddf.groupby("brand_name", dropna=False):
            if not brand or str(brand).lower() in ("nan", "none", ""):
                continue
            brand_rows.append({
                "brand_name":  brand,
                "tickets":     len(gdf),
                "adhoc_skus":  int(gdf["adhoc_sku_count"].sum()),
                "e2e_options": int(gdf["e2e_option_count"].sum()),
                "avg_tat":     weighted_avg_tat(gdf),
                "status":      ddf[ddf["brand_name"] == brand]["status"].iloc[0] if len(ddf[ddf["brand_name"] == brand]) else None,
            })
        brand_rows.sort(key=lambda r: r["tickets"], reverse=True)

        # Ticket-level detail (for the detail table)
        ticket_rows = []
        for _, row in ddf.iterrows():
            ticket_rows.append({
                "key":          row.get("ticket_key"),
                "status":       row.get("status"),
                "assignee":     row.get("assignee"),
                "category":     row.get("l1_category"),
                "platform":     str(row.get("platform_raw") or "").replace(";", " & "),
                "listing_type": row.get("listing_type_group"),
                "brand":        row.get("brand_name"),
                "adhoc_skus":   int(row["adhoc_sku_count"]) if pd.notna(row["adhoc_sku_count"]) and row["adhoc_sku_count"] else 0,
                "e2e_options":  int(row["e2e_option_count"]) if pd.notna(row["e2e_option_count"]) and row["e2e_option_count"] else 0,
                "tat":          safe_round(row["tat_adjusted"]),
            })

        # Open tickets (non-closed, non-failed)
        open_count  = int(ddf["is_open"].sum())
        closed_count = int(ddf["is_closed"].sum())

        days.append({
            "date":          day_str,
            "total_tickets": len(ddf),
            "adhoc_skus":    int(ddf["adhoc_sku_count"].sum()),
            "e2e_options":   int(ddf["e2e_option_count"].sum()),
            "avg_tat":       weighted_avg_tat(ddf),
            "open_tickets":  open_count,
            "closed_tickets":closed_count,
            "closure_rate":  safe_round(closed_count / len(ddf) * 100) if len(ddf) else 0,
            "e2e_tickets":   int(ddf["is_e2e"].sum()),
            "adhoc_tickets": int(ddf["is_adhoc"].sum()),
            "status":        status_rows,
            "category":      cat_rows,
            "platform":      plat_rows,
            "listing_type":  listing_rows,
            "brands":        brand_rows,
            "tickets":       ticket_rows,
        })

    return {
        "data_month":  data_month,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dates":        [d["date"] for d in days],
        "days":         days,
    }

# ------------------------------------------------------------------
# ESCALATIONS.JSON — Escalations tab
# ------------------------------------------------------------------

def build_escalations() -> dict:
    """
    Reads the 'Esclations' sheet independently of the main Jira sheet.
    Produces resolution-time analytics over the escalation records.

    Columns in sheet:
        Ticket ID | Assigned on | Subject Line | Processed On |
        Error by  | Actions Taken | Closed On | Affected Options | Error Type
    """
    print(f"Reading escalations from sheet: '{ESCALATIONS_SHEET}'")
    raw = pd.read_excel(EXCEL_PATH, sheet_name=ESCALATIONS_SHEET)
    raw.columns = raw.columns.str.strip()

    col_map = {
        "Ticket ID":        "ticket_id",
        "Assigned on":      "assigned_on",
        "Subject Line":     "subject",
        "Processed On":     "processed_on",
        "Error by":         "error_by",
        "Actions Taken":    "actions_taken",
        "Closed On":        "closed_on",
        "Affected Options": "affected_options",
        "Error Type":       "error_type",
    }
    for src in col_map:
        if src not in raw.columns:
            print(f"  WARNING: escalations sheet missing column: '{src}'")
    raw = raw.rename(columns=col_map)
    keep = [v for v in col_map.values() if v in raw.columns]
    df = raw[keep].copy()

    for col in ("assigned_on", "processed_on", "closed_on"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    if "affected_options" in df.columns:
        df["affected_options"] = pd.to_numeric(df["affected_options"], errors="coerce").apply(
            lambda x: int(x) if pd.notna(x) else 0
        )

    for col in ("ticket_id", "subject", "error_by", "actions_taken", "error_type"):
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
            df[col] = df[col].replace({"nan": None, "None": None, "": None})

    def resolution_days(row):
        if pd.isna(row["assigned_on"]) or pd.isna(row["closed_on"]):
            return None
        return max((row["closed_on"] - row["assigned_on"]).days, 0)

    def process_days(row):
        p = row.get("processed_on")
        if pd.isna(row["assigned_on"]) or pd.isna(p):
            return None
        return max((p - row["assigned_on"]).days, 0)

    df["resolution_days"] = df.apply(resolution_days, axis=1)
    df["process_days"]    = df.apply(process_days, axis=1)
    df["month"] = df["assigned_on"].apply(
        lambda d: d.strftime("%Y-%m") if pd.notna(d) else None
    )

    total = len(df)
    critical_count    = int((df["error_type"] == "Critical").sum())
    noncritical_count = int((df["error_type"] == "Non - critical").sum())
    total_affected    = int(df["affected_options"].sum())
    resolved = df[df["resolution_days"].notna()]
    kpis = {
        "total_escalations":      total,
        "critical_count":         critical_count,
        "noncritical_count":      noncritical_count,
        "total_affected_options": total_affected,
        "avg_resolution_days":    safe_round(resolved["resolution_days"].mean()) if len(resolved) else None,
        "max_resolution_days":    safe_round(resolved["resolution_days"].max()) if len(resolved) else None,
        "min_resolution_days":    safe_round(resolved["resolution_days"].min()) if len(resolved) else None,
        "pct_critical":           safe_round(critical_count / total * 100) if total else None,
    }

    records = []
    for _, row in df.iterrows():
        records.append({
            "ticket_id":        row.get("ticket_id"),
            "assigned_on":      row["assigned_on"].date().isoformat() if pd.notna(row["assigned_on"]) else None,
            "processed_on":     row["processed_on"].date().isoformat() if pd.notna(row.get("processed_on")) else None,
            "closed_on":        row["closed_on"].date().isoformat() if pd.notna(row["closed_on"]) else None,
            "subject":          row.get("subject"),
            "error_by":         row.get("error_by"),
            "actions_taken":    row.get("actions_taken"),
            "affected_options": row.get("affected_options", 0),
            "error_type":       row.get("error_type"),
            "resolution_days":  row.get("resolution_days"),
            "process_days":     row.get("process_days"),
            "month":            row.get("month"),
        })

    by_type = []
    for etype, gdf in df.groupby("error_type", dropna=False):
        if not etype or str(etype).lower() in ("nan", "none"):
            continue
        resolved_g = gdf[gdf["resolution_days"].notna()]
        by_type.append({
            "error_type":          str(etype),
            "count":               len(gdf),
            "pct":                 safe_round(len(gdf) / total * 100) if total else None,
            "avg_resolution_days": safe_round(resolved_g["resolution_days"].mean()) if len(resolved_g) else None,
            "total_affected":      int(gdf["affected_options"].sum()),
        })

    by_month = []
    for month, gdf in df.groupby("month", dropna=False):
        if not month:
            continue
        resolved_g = gdf[gdf["resolution_days"].notna()]
        by_month.append({
            "month":               str(month),
            "count":               len(gdf),
            "critical_count":      int((gdf["error_type"] == "Critical").sum()),
            "noncritical_count":   int((gdf["error_type"] == "Non - critical").sum()),
            "total_affected":      int(gdf["affected_options"].sum()),
            "avg_resolution_days": safe_round(resolved_g["resolution_days"].mean()) if len(resolved_g) else None,
        })
    by_month.sort(key=lambda r: r["month"])

    BUCKETS = [
        ("Same day",  0,  1),
        ("1-3 days",  1,  4),
        ("4-7 days",  4,  8),
        ("8-14 days", 8, 15),
        ("15+ days", 15, 9999),
    ]
    resolution_buckets = []
    for label, lo, hi in BUCKETS:
        bdf = df[df["resolution_days"].apply(
            lambda d: d is not None and lo <= d < hi
        )]
        resolution_buckets.append({
            "bucket":   label,
            "count":    len(bdf),
            "pct":      safe_round(len(bdf) / total * 100) if total else None,
            "critical": int((bdf["error_type"] == "Critical").sum()),
        })

    return {
        "generated_at":       datetime.now(timezone.utc).isoformat(),
        "kpis":               kpis,
        "records":            records,
        "by_error_type":      by_type,
        "by_month":           by_month,
        "resolution_buckets": resolution_buckets,
    }


# ------------------------------------------------------------------
# WRITE JSON
# ------------------------------------------------------------------

class _NanSafeEncoder(json.JSONEncoder):
    """
    Converts float NaN / Infinity to JSON null instead of the bare
    literals NaN / Infinity, which are invalid JSON and cause TypeScript
    build errors (TS1328).
    """
    def iterencode(self, o, _one_shot=False):
        return super().iterencode(self._clean(o), _one_shot)

    def _clean(self, obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        if isinstance(obj, dict):
            return {k: self._clean(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [self._clean(v) for v in obj]
        return obj


def write_json(data: dict, filename: str) -> None:
    path = OUTPUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, cls=_NanSafeEncoder,
                  default=str, ensure_ascii=False)
    size_kb = path.stat().st_size / 1024
    # Verify no bare NaN/Infinity leaked through
    raw = path.read_text(encoding="utf-8")
    bad = [tok for tok in ("NaN", "Infinity", "-Infinity") if tok in raw]
    if bad:
        print(f"  WARNING: {filename} still contains {bad} — check source data")
    print(f"  Written: {filename} ({size_kb:.1f} KB)")


# ------------------------------------------------------------------
# MAIN
# ------------------------------------------------------------------

def main():
    df = load_and_clean()

    print("\nBuilding wow.json ...")
    wow = build_wow(df)
    write_json(wow, "wow.json")

    print("Building summary.json ...")
    summary = build_summary(df)
    write_json(summary, "summary.json")

    print("Building bifurcation.json ...")
    bifurcation = build_bifurcation(df)
    write_json(bifurcation, "bifurcation.json")

    print("Building eod.json ...")
    eod = build_eod(df)
    write_json(eod, "eod.json")

    print("Building escalations.json ...")
    escalations = build_escalations()
    write_json(escalations, "escalations.json")

    print(f"\nDone. Copy wow.json, summary.json, bifurcation.json, eod.json, escalations.json → Lovable /public folder.")


if __name__ == "__main__":
    main()