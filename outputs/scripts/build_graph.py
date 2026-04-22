"""
build_graph.py — Transform LingCarbon DocumentRecord outputs into a graph JSON
suitable for the v0 force-graph frontend.

Reads:
  - <ROOT>/json/*.record.json   (current layout — frontend repo)
  - <ROOT>/outputs/*.record.json (legacy upstream layout — back-compat)
  - <ROOT>/config/companies/*.yaml (optional)

Writes:
  - graph.json  (single-file, ready to drop into frontend public/mock-data/)

Decisions locked in:
  1. emission_source key = (facility_id, source_code, material_code)
  2. activity_data granularity = 1:1 per DocumentRecord OR per (record, year)
     when a single record's emission[] array spans multiple calendar years.
  3. transactions/employees/equipment_items stay inside record for inspector drill-down
  4. emission_type surfaced as a filter dimension (node attribute)
  5. emissions computed bottom-up (activity → source → facility → company)
  6. monthly_emissions[12] (Jan..Dec) computed bottom-up for primary_year only
  7. PII masked by default (vehicle_plate, driver_*, employee_name); --include-pii to keep
"""

from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    import yaml  # type: ignore
except ImportError:
    yaml = None


# ─── Path resolution ─────────────────────────────────────────────────

ROOT = Path(os.environ.get("LINGCARBON_ROOT", Path(__file__).resolve().parent.parent))


def resolve_outputs_dir(root: Path) -> Path:
    """Look for record JSONs in either <root>/json or <root>/outputs."""
    for candidate in (root / "json", root / "outputs", root):
        if any(candidate.glob("*.record.json")):
            return candidate
    raise FileNotFoundError(
        f"No *.record.json files found under {root} (checked json/, outputs/, .)"
    )


# ─── Company config (YAML if present, else hardcoded fallback) ──────

DEFAULT_COMPANY = {
    "company_id": "ho_hsin",
    "company_name": "和欣汽車客運股份有限公司",
}


def load_company_config() -> dict[str, str]:
    cfg_path = ROOT / "config" / "companies" / "hohsin.yaml"
    if cfg_path.exists() and yaml is not None:
        with open(cfg_path, encoding="utf-8") as f:
            return yaml.safe_load(f)
    return DEFAULT_COMPANY


# ─── Helpers ──────────────────────────────────────────────────────────

def _round(x: float, n: int = 4) -> float:
    return round(float(x), n)


def _zeros12() -> list[float]:
    return [0.0] * 12


def _period_label(period_start: str, period_end: str) -> str:
    """Format a readable period label: '2025-01' or '2025-01~12'."""
    ys, ms = period_start[:4], period_start[5:7]
    ye, me = period_end[:4], period_end[5:7]
    if ys == ye and ms == me:
        return f"{ys}-{ms}"
    if ys == ye:
        return f"{ys}-{ms}~{me}"
    return f"{ys}-{ms}~{ye}-{me}"


# ─── PII masking ──────────────────────────────────────────────────────

def mask_plate(plate: str | None) -> str | None:
    """Mask vehicle plate to first 3 chars + '-***'.
    'VFH-1234' → 'VFH-***'; '256-S1' → '256-***'.
    """
    if not plate:
        return plate
    s = str(plate)
    if len(s) <= 3:
        return s + "-***"
    return s[:3] + "-***"


def mask_extraction(ext: dict | None, source_type: str, include_pii: bool) -> dict | None:
    """Strip/mask PII fields from extraction payload unless include_pii."""
    if include_pii or ext is None:
        return ext
    # Shallow copy then rewrite sensitive arrays
    out = dict(ext)
    if source_type == "fuel" and isinstance(out.get("transactions"), list):
        out["transactions"] = [
            {
                **tx,
                "vehicle_plate": mask_plate(tx.get("vehicle_plate")),
                "driver_name": None,
                "driver_id": None,
            }
            for tx in out["transactions"]
        ]
    elif source_type == "work_hours" and isinstance(out.get("employees"), list):
        out["employees"] = [
            {**emp, "employee_name": None}
            for emp in out["employees"]
        ]
    return out


# ─── Load inputs ──────────────────────────────────────────────────────

def load_records(outputs_dir: Path) -> list[dict]:
    records = []
    for path in sorted(outputs_dir.glob("*.record.json")):
        with open(path, encoding="utf-8") as f:
            records.append(json.load(f))
    return records


# ─── Extraction summarizer ───────────────────────────────────────────

def _summarize_extraction(ext: dict | None, source_type: str) -> dict:
    """Compact summary for inspector display; full payload retained separately."""
    if not ext:
        return {}
    if source_type == "fuel":
        return {
            "fuel_type": ext.get("fuel_type"),
            "supply_type": ext.get("supply_type"),
            "total_liters": ext.get("total_liters"),
            "total_records": ext.get("total_records"),
            "equipment_count": ext.get("equipment_count"),
        }
    if source_type == "electricity":
        return {
            "customer_number": ext.get("customer_number"),
            "service_address": ext.get("service_address"),
            "pricing_type": ext.get("pricing_type"),
            "tou_type": ext.get("tou_type"),
            "total_consumption_kwh": ext.get("total_consumption_kwh"),
            "total_amount_twd": ext.get("total_amount_twd"),
            "segments": ext.get("segments"),
            "extraction_confidence": ext.get("extraction_confidence"),
        }
    if source_type == "refrigerant":
        return {
            "supply_type": ext.get("supply_type"),
            "total_equipment_count": ext.get("total_equipment_count"),
            "total_charge_kg": ext.get("total_charge_kg"),
            "equipment_items": ext.get("equipment_items"),
        }
    if source_type == "work_hours":
        return {
            "doc_type_code": ext.get("doc_type_code"),
            "employee_count": ext.get("employee_count"),
            "total_hours": ext.get("total_hours"),
        }
    return {}


# ─── Emission entry helpers (handles new array shape) ────────────────

def _normalize_emission(emission: Any) -> list[dict]:
    """Backend may return emission as list[EmissionEntry] (current) or
    a single object (legacy v0 mock). Normalize to list."""
    if emission is None:
        return []
    if isinstance(emission, list):
        return [e for e in emission if e]
    if isinstance(emission, dict):
        # Legacy single-object form — wrap with a synthetic year
        wrapped = dict(emission)
        wrapped.setdefault("year", None)
        wrapped.setdefault("monthly_breakdown", None)
        return [wrapped]
    return []


def _entry_year(entry: dict, fallback_period_start: str) -> int:
    y = entry.get("year")
    if y is not None:
        return int(y)
    ps = entry.get("period_start") or fallback_period_start
    return int(ps[:4])


def _accumulate_monthly(
    bucket: list[float],
    entry: dict,
    primary_year: int,
) -> None:
    """Add this entry's tCO₂e contributions into a 12-element [Jan..Dec] bucket
    for primary_year only. Cross-year edges in other years are ignored."""
    entry_year = _entry_year(entry, entry.get("period_start", "1970-01-01"))
    if entry_year != primary_year:
        return
    mb = entry.get("monthly_breakdown")
    if isinstance(mb, list) and mb:
        for m in mb:
            month = int(m.get("month", 0))
            if 1 <= month <= 12:
                bucket[month - 1] += float(m.get("emissions_tco2e") or 0.0)
        return
    # No breakdown — attribute to entry's period_start month
    ps = entry.get("period_start") or ""
    if len(ps) >= 7:
        try:
            month = int(ps[5:7])
            if 1 <= month <= 12:
                bucket[month - 1] += float(entry.get("emissions_tco2e") or 0.0)
        except ValueError:
            pass


# ─── Graph build ──────────────────────────────────────────────────────

def build(records: list[dict], company_cfg: dict, include_pii: bool) -> dict:
    nodes: list[dict] = []
    links: list[dict] = []

    facilities_seen: dict[str, str] = {}
    emission_sources_seen: dict[tuple, dict] = {}
    documents_seen: dict[str, dict] = {}

    facility_emissions: dict[str, float] = defaultdict(float)
    source_emissions: dict[str, float] = defaultdict(float)

    # Filter to records with both taxonomy and at least one emission entry
    valid_records: list[tuple[dict, list[dict]]] = []
    for r in records:
        if not r.get("taxonomy"):
            continue
        entries = _normalize_emission(r.get("emission"))
        if not entries:
            continue
        valid_records.append((r, entries))

    # ── Determine years and primary_year ──
    years: set[int] = set()
    for rec, entries in valid_records:
        for e in entries:
            years.add(_entry_year(e, rec["period_start"]))
    years_sorted = sorted(years)
    # Pick the year with the most emission entries as primary, ties → most recent.
    year_counts: dict[int, int] = defaultdict(int)
    for _, entries in valid_records:
        for e in entries:
            year_counts[_entry_year(e, "1970-01-01")] += 1
    if year_counts:
        max_count = max(year_counts.values())
        primary_year = max(y for y, c in year_counts.items() if c == max_count)
    else:
        primary_year = max(years_sorted) if years_sorted else None

    # ── Initialize monthly buckets (primary year only) ──
    company_monthly = _zeros12()
    company_monthly_scope1 = _zeros12()
    company_monthly_scope2 = _zeros12()
    facility_monthly: dict[str, list[float]] = defaultdict(_zeros12)
    source_monthly: dict[str, list[float]] = defaultdict(_zeros12)
    source_record_count: dict[str, int] = defaultdict(int)

    # ── Pre-pass: discover entities + accumulate totals ──
    scope_1_total = 0.0
    scope_2_total = 0.0
    source_type_counts: dict[str, int] = defaultdict(int)

    for rec, entries in valid_records:
        tax = rec["taxonomy"]
        fid = tax["facility_id"]
        src_code = tax["source_code"]
        mat_code = tax["material_code"]
        es_key_str = _es_id(fid, src_code, mat_code)
        es_key = (fid, src_code, mat_code)

        facilities_seen[fid] = tax["facility_name"]
        if es_key not in emission_sources_seen:
            # scope from first entry (consistent across entries for same source)
            first = entries[0]
            emission_sources_seen[es_key] = {
                "facility_id": fid,
                "facility_name": tax["facility_name"],
                "source_code": src_code,
                "source_name": tax["source_name"],
                "material_code": mat_code,
                "material_name": tax["material_name"],
                "scope": int(first.get("scope") or 1),
                "scope_category": tax["scope_category"],
                "emission_type": tax["emission_type"],
                "is_biofuel": tax.get("is_biofuel", False),
            }

        source_record_count[es_key_str] += 1
        source_type_counts[rec["source_type"]] += 1

        for entry in entries:
            tco2e = float(entry.get("emissions_tco2e") or 0.0)
            scope = int(entry.get("scope") or 1)
            facility_emissions[fid] += tco2e
            source_emissions[es_key_str] += tco2e
            if scope == 1:
                scope_1_total += tco2e
            elif scope == 2:
                scope_2_total += tco2e

            # Monthly rollup (primary_year only)
            if primary_year is not None:
                _accumulate_monthly(facility_monthly[fid], entry, primary_year)
                _accumulate_monthly(source_monthly[es_key_str], entry, primary_year)
                _accumulate_monthly(company_monthly, entry, primary_year)
                if scope == 1:
                    _accumulate_monthly(company_monthly_scope1, entry, primary_year)
                elif scope == 2:
                    _accumulate_monthly(company_monthly_scope2, entry, primary_year)

        # Source document
        sf = rec["source_file"]
        if sf not in documents_seen:
            documents_seen[sf] = {
                "source_file": sf,
                "source_type": rec["source_type"],
                "file_hash": rec.get("file_hash"),
                "record_count": 0,
                "any_partial": False,
                "any_failed": False,
            }
        documents_seen[sf]["record_count"] += 1
        if rec.get("status") == "partial":
            documents_seen[sf]["any_partial"] = True
        if rec.get("status") == "failed":
            documents_seen[sf]["any_failed"] = True

    total_tco2e = _round(facility_emissions and sum(facility_emissions.values()) or 0.0)

    # ── Emit: Company node ──
    company_id = f"company-{company_cfg['company_id']}"
    nodes.append({
        "id": company_id,
        "type": "company",
        "name": company_cfg["company_name"],
        "scope": None,
        "emissions_tco2e": total_tco2e,
        "scope_1_tco2e": _round(scope_1_total),
        "scope_2_tco2e": _round(scope_2_total),
        "year": primary_year,
        "record_count": len(valid_records),
        "monthly_emissions": [_round(v, 4) for v in company_monthly],
        "monthly_emissions_by_scope": {
            "1": [_round(v, 4) for v in company_monthly_scope1],
            "2": [_round(v, 4) for v in company_monthly_scope2],
        },
    })

    # ── Emit: Facility nodes ──
    for fid, fname in sorted(facilities_seen.items()):
        node_id = f"facility-{fid}"
        nodes.append({
            "id": node_id,
            "type": "facility",
            "name": fname,
            "scope": None,
            "emissions_tco2e": _round(facility_emissions[fid]),
            "facility_id": fid,
            "year": primary_year,
            "monthly_emissions": [_round(v, 4) for v in facility_monthly[fid]],
        })
        links.append({"source": company_id, "target": node_id})

    # ── Emit: Emission Source nodes ──
    for (fid, src_code, mat_code), meta in sorted(emission_sources_seen.items()):
        es_id_str = _es_id(fid, src_code, mat_code)
        nodes.append({
            "id": es_id_str,
            "type": "emission_source",
            "name": f"{meta['source_name']} · {meta['material_name']}",
            "short_name": meta["source_name"],
            "material_name": meta["material_name"],
            "source_code": src_code,
            "material_code": mat_code,
            "scope": meta["scope"],
            "scope_category": meta["scope_category"],
            "emission_type": meta["emission_type"],
            "is_biofuel": meta["is_biofuel"],
            "facility_id": fid,
            "emissions_tco2e": _round(source_emissions[es_id_str]),
            "year": primary_year,
            "monthly_emissions": [_round(v, 4) for v in source_monthly[es_id_str]],
            "record_count": source_record_count[es_id_str],
        })
        links.append({"source": f"facility-{fid}", "target": es_id_str})

    # ── Emit: Activity Data nodes (one per (record, entry-year)) ──
    for rec, entries in valid_records:
        tax = rec["taxonomy"]
        fid = tax["facility_id"]
        src_code = tax["source_code"]
        mat_code = tax["material_code"]
        es_id_str = _es_id(fid, src_code, mat_code)
        ext_summary = _summarize_extraction(rec.get("extraction"), rec["source_type"])
        masked_extraction = mask_extraction(rec.get("extraction"), rec["source_type"], include_pii)

        multi_year = len(entries) > 1
        for entry in entries:
            entry_year = _entry_year(entry, rec["period_start"])
            activity_id = (
                f"activity-{rec['document_id']}-y{entry_year}"
                if multi_year
                else f"activity-{rec['document_id']}"
            )
            ep_start = entry.get("period_start") or rec["period_start"]
            ep_end = entry.get("period_end") or rec["period_end"]
            period_label = _period_label(ep_start, ep_end)

            nodes.append({
                "id": activity_id,
                "type": "activity_data",
                "name": f"{period_label} · {tax['material_name']}",
                "scope": int(entry.get("scope") or 1),
                "document_id": rec["document_id"],
                "facility_id": fid,
                "source_code": src_code,
                "material_code": mat_code,
                "period_start": ep_start,
                "period_end": ep_end,
                "period_label": period_label,
                "year": entry_year,
                "activity_value": entry.get("activity_value"),
                "activity_unit": entry.get("activity_unit"),
                "emission_factor": {
                    "value": entry.get("factor_value"),
                    "unit": entry.get("factor_unit"),
                    "source": entry.get("factor_source"),
                    "year": entry.get("factor_year"),
                },
                "gas_breakdown": entry.get("gas_breakdown") or [],
                "monthly_breakdown": entry.get("monthly_breakdown"),
                "emissions_kgco2e": entry.get("emissions_kgco2e"),
                "emissions_tco2e": entry.get("emissions_tco2e"),
                "extraction_summary": ext_summary,
                "extraction": masked_extraction,
                "source_type": rec["source_type"],
                "source_file": rec["source_file"],
                "file_hash": rec.get("file_hash"),
                "file_processing_time_ms": rec.get("file_processing_time_ms"),
                "evidence_url": None,
                "status": rec.get("status", "success"),
                "warnings": rec.get("warnings", []),
            })
            links.append({"source": es_id_str, "target": activity_id})
            doc_id = f"doc-{rec['source_file']}"
            links.append({"source": activity_id, "target": doc_id})

    # ── Emit: Source Document nodes ──
    for sf, meta in sorted(documents_seen.items()):
        status = "failed" if meta["any_failed"] else ("partial" if meta["any_partial"] else "success")
        nodes.append({
            "id": f"doc-{sf}",
            "type": "source_document",
            "name": sf,
            "scope": None,
            "source_file": sf,
            "source_type": meta["source_type"],
            "record_count": meta["record_count"],
            "status": status,
            "year": primary_year,
            "file_hash": meta.get("file_hash"),
        })

    return {
        "meta": {
            "company_id": company_cfg["company_id"],
            "company_name": company_cfg["company_name"],
            "primary_year": primary_year,
            "years_covered": years_sorted,
            "total_tco2e": total_tco2e,
            "scope_1_tco2e": _round(scope_1_total),
            "scope_2_tco2e": _round(scope_2_total),
            "record_count": len(valid_records),
            "facility_count": len(facilities_seen),
            "emission_source_count": len(emission_sources_seen),
            "source_document_count": len(documents_seen),
            "source_type_counts": dict(source_type_counts),
            "pii_included": include_pii,
        },
        "nodes": nodes,
        "links": links,
    }


def _es_id(facility_id: str, source_code: str, material_code: str) -> str:
    return f"es-{facility_id}-{source_code}-{material_code}"


# ─── Entry point ──────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Build LingCarbon graph JSON")
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help="Output path (default: <script_dir>/graph.json)",
    )
    parser.add_argument(
        "--include-pii",
        action="store_true",
        help="Include vehicle plates / driver / employee names in extraction payload "
             "(default: masked). Use only for internal forensic builds.",
    )
    args = parser.parse_args()

    outputs_dir = resolve_outputs_dir(ROOT)
    records = load_records(outputs_dir)
    company_cfg = load_company_config()
    graph = build(records, company_cfg, include_pii=args.include_pii)

    out = (
        Path(args.output).expanduser().resolve()
        if args.output
        else Path(__file__).resolve().parent / "graph.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)

    meta = graph["meta"]
    print(f"Wrote {out}")
    print(f"  records processed: {meta['record_count']}")
    print(f"  source types:      {meta['source_type_counts']}")
    print(f"  facilities:        {meta['facility_count']}")
    print(f"  emission sources:  {meta['emission_source_count']}")
    print(f"  source documents:  {meta['source_document_count']}")
    print(f"  primary year:      {meta['primary_year']}  (covered: {meta['years_covered']})")
    print(f"  nodes:             {len(graph['nodes'])}")
    print(f"  links:             {len(graph['links'])}")
    print(
        f"  total:             {meta['total_tco2e']} tCO2e "
        f"(scope1={meta['scope_1_tco2e']}, scope2={meta['scope_2_tco2e']})"
    )
    print(f"  PII included:      {meta['pii_included']}")


if __name__ == "__main__":
    main()
