from datetime import datetime

import pandas as pd

from .graph_store import store


def _utc_timestamp(value: datetime):
    timestamp = pd.Timestamp(value)
    return timestamp.tz_localize("UTC") if timestamp.tzinfo is None else timestamp.tz_convert("UTC")


def relationship_frame(start: datetime | None = None, end: datetime | None = None) -> pd.DataFrame:
    rows = []
    for source, target, data in store.g.edges(data=True):
        attrs = data.get("attributes", {}) or {}
        value = attrs.get("date") or data.get("created_at")
        parsed = pd.to_datetime(value, errors="coerce", utc=True)
        if pd.isna(parsed):
            continue
        rows.append({
            "source": source,
            "target": target,
            "type": data.get("type", "unknown"),
            "date": parsed,
            "amount": pd.to_numeric(attrs.get("amount", 0), errors="coerce"),
            "frequency": pd.to_numeric(attrs.get("frequency", data.get("weight", 1)), errors="coerce"),
        })
    frame = pd.DataFrame(rows, columns=["source", "target", "type", "date", "amount", "frequency"])
    if frame.empty:
        return frame
    if start:
        frame = frame[frame["date"] >= _utc_timestamp(start)]
    if end:
        frame = frame[frame["date"] <= _utc_timestamp(end)]
    return frame


def summarize_window(start: datetime | None = None, end: datetime | None = None) -> dict:
    frame = relationship_frame(start, end)
    if frame.empty:
        return {"start": start.isoformat() if start else None, "end": end.isoformat() if end else None,
                "relationship_count": 0, "transaction_total": 0.0, "by_type": [], "by_day": []}
    by_type = frame.groupby("type", dropna=False).agg(
        relationship_count=("type", "size"),
        transaction_total=("amount", "sum"),
        frequency_total=("frequency", "sum"),
    ).reset_index()
    by_day = frame.assign(day=frame["date"].dt.strftime("%Y-%m-%d")).groupby("day").agg(
        relationship_count=("type", "size"), transaction_total=("amount", "sum")
    ).reset_index()
    return {
        "start": start.isoformat() if start else None,
        "end": end.isoformat() if end else None,
        "relationship_count": int(len(frame)),
        "transaction_total": float(frame["amount"].fillna(0).sum()),
        "by_type": by_type.to_dict(orient="records"),
        "by_day": by_day.to_dict(orient="records"),
    }