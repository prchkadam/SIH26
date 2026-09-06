import statistics
import uuid
from collections import defaultdict

import numpy as np
from sklearn.ensemble import IsolationForest

from .graph_store import store

CALL_TYPES = {"called", "communicated_with"}
MONEY_TYPES = {"transferred_money_to", "paid", "sent_money_to"}


def _edge_amount(d):
    attrs = d.get("attributes", {}) or {}
    for k in ("amount", "amount_inr"):
        if k in attrs:
            try:
                return float(attrs[k])
            except (TypeError, ValueError):
                pass
    return None


def _edge_freq(d):
    attrs = d.get("attributes", {}) or {}
    for k in ("frequency", "call_count"):
        if k in attrs:
            try:
                return float(attrs[k])
            except (TypeError, ValueError):
                pass
    return d.get("weight", 1)


REPORTING_THRESHOLDS = [500000, 1000000, 200000]


def detect_unusual_financial_activity(z_threshold: float = 2.0):
    g = store.g
    alerts = []
    per_entity_amounts = defaultdict(list)
    per_entity_edges = defaultdict(list)
    for u, v, d in g.edges(data=True):
        if d.get("type") in MONEY_TYPES:
            amt = _edge_amount(d)
            if amt is None:
                continue
            per_entity_amounts[u].append(amt)
            per_entity_edges[u].append((v, amt, d))

    all_amounts = [a for lst in per_entity_amounts.values() for a in lst]
    if not all_amounts:
        return alerts
    global_mean = statistics.mean(all_amounts)
    global_std = statistics.pstdev(all_amounts) or 1.0

    for entity_id, amounts in per_entity_amounts.items():
        reasons = []
        score = 0
        max_amt = max(amounts)

        baseline = [a for a in amounts if a != max_amt] or amounts
        baseline_mean = statistics.mean(baseline)
        baseline_std = statistics.pstdev(baseline) if len(baseline) > 1 else max(baseline_mean * 0.25, 1.0)
        personal_z = (max_amt - baseline_mean) / (baseline_std or 1.0)
        ratio = max_amt / baseline_mean if baseline_mean > 0 else 99
        if len(amounts) >= 2 and (ratio >= 3 or personal_z >= 2.5):
            reasons.append(f"Largest transaction (Rs {max_amt:,.0f}) is {ratio:.1f}x this entity's own "
                            f"historical average transfer (Rs {baseline_mean:,.0f}), a sharp deviation from "
                            f"the established pattern")
            score += min(55, 25 + personal_z * 8)

        if len(amounts) >= 4:
            amt_mean = statistics.mean(amounts)
            amt_std = statistics.pstdev(amounts)
            cv = amt_std / amt_mean if amt_mean else 0
            for threshold in REPORTING_THRESHOLDS:
                near = [a for a in amounts if threshold * 0.90 <= a < threshold]
                if len(near) >= 4 and cv < 0.25:
                    reasons.append(f"{len(near)} separate transactions clustered just under the "
                                    f"Rs {threshold:,.0f} reporting threshold (avg Rs {statistics.mean(near):,.0f}, "
                                    f"low variance), a pattern consistent with structuring")
                    score += 45
                    break

        z = (max_amt - global_mean) / global_std
        if z >= z_threshold:
            reasons.append(f"Largest transaction (Rs {max_amt:,.0f}) is {z:.1f} std. deviations above "
                            f"the network-wide average (Rs {global_mean:,.0f})")
            score += min(25, 10 + z * 5)

        recipients = list(dict.fromkeys(v for v, _, _ in per_entity_edges[entity_id]))
        multi_linked = [r for r in recipients if g.degree(r) >= 6]
        if multi_linked and reasons:
            names = [g.nodes[r].get("name", r) for r in multi_linked[:3]]
            reasons.append(f"Recipient(s) {', '.join(names)} are connected to multiple other "
                            f"high-activity entities in the network")
            score += 10

        if reasons:
            name = g.nodes[entity_id].get("name", entity_id)
            alerts.append(_alert(entity_id, name, "Unusual Financial Activity",
                                  min(round(score), 98), reasons, related=recipients[:5]))
    return alerts


def detect_unusual_communication(z_threshold: float = 2.2):
    g = store.g
    alerts = []
    per_entity_freq = defaultdict(list)
    per_entity_targets = defaultdict(list)
    for u, v, d in g.edges(data=True):
        if d.get("type") in CALL_TYPES:
            freq = _edge_freq(d)
            per_entity_freq[u].append(freq)
            per_entity_targets[u].append(v)

    all_freqs = [f for lst in per_entity_freq.values() for f in lst]
    if not all_freqs:
        return alerts
    mean = statistics.mean(all_freqs)
    std = statistics.pstdev(all_freqs) or 1.0

    for entity_id, freqs in per_entity_freq.items():
        max_f = max(freqs)
        z = (max_f - mean) / std
        if z >= z_threshold:
            name = g.nodes[entity_id].get("name", entity_id)
            idx = freqs.index(max_f)
            target = per_entity_targets[entity_id][idx]
            target_name = g.nodes[target].get("name", target)
            reasons = [f"Communication frequency with '{target_name}' ({int(max_f)} contacts) is "
                       f"{z:.1f} std. deviations above the network average ({mean:.1f})"]
            score = min(95, round(30 + z * 15))
            alerts.append(_alert(entity_id, name, "Unusual Communication Pattern", score, reasons,
                                  related=[target]))
    return alerts


def detect_shared_attributes():
    g = store.g
    alerts = []
    by_attr = defaultdict(lambda: defaultdict(list))
    for n, d in g.nodes(data=True):
        if d.get("type") != "Person":
            continue
        for key in ("phone", "phone_number", "vehicle_id", "national_id"):
            val = (d.get("attributes") or {}).get(key)
            if val:
                by_attr[key][str(val).lower()].append(n)

    for key, groups in by_attr.items():
        for val, node_ids in groups.items():
            if len(set(node_ids)) >= 2:
                names = [g.nodes[n].get("name", n) for n in node_ids]
                reasons = [f"{len(node_ids)} distinct persons share the same {key.replace('_', ' ')} "
                           f"('{val}'), a possible shared identity, front, or undisclosed association"]
                score = min(90, 40 + 15 * len(node_ids))
                for n, nm in zip(node_ids, names):
                    alerts.append(_alert(n, nm, "Shared Identifying Attribute", score, reasons,
                                          related=[x for x in node_ids if x != n]))
    return alerts


def detect_unexpected_connections(percentile: float = 0.85, max_alerts: int = 20):
    g = store.g
    if g.number_of_nodes() < 5:
        return []
    degrees = sorted(d for _, d in g.degree())
    if not degrees:
        return []
    idx = min(len(degrees) - 1, int(len(degrees) * percentile))
    degree_threshold = max(degrees[idx], 6)

    candidates = []
    for u, v, d in g.edges(data=True):
        if d.get("type") not in CALL_TYPES:
            continue
        freq = _edge_freq(d) or 0
        du, dv = g.degree(u), g.degree(v)
        if du >= degree_threshold and dv >= degree_threshold and freq <= 5:
            common = set(g.neighbors(u)) & set(g.neighbors(v))
            if len(common) == 0:
                candidates.append((u, v, du, dv, freq))

    candidates.sort(key=lambda c: -(c[2] + c[3]))
    alerts = []
    for u, v, du, dv, freq in candidates[:max_alerts]:
        name_u = g.nodes[u].get("name", u)
        name_v = g.nodes[v].get("name", v)
        reasons = [f"'{name_u}' (degree {du}) and '{name_v}' (degree {dv}) are both highly connected "
                   f"hub entities linked by only {int(freq)} low-frequency contact(s) and share no other "
                   f"common connections, so this single link may bridge two otherwise separate networks"]
        score = min(85, 45 + 2 * min(du, dv))
        alerts.append(_alert(u, name_u, "Unexpected Cross-Network Connection", score, reasons, related=[v]))
    return alerts


def _alert(entity_id, name, alert_type, score, reasons, related=None, detector="rule", evidence=None):
    return {
        "id": f"alert-{uuid.uuid4().hex[:10]}",
        "entity_id": entity_id,
        "entity_name": name,
        "alert_type": alert_type,
        "score": float(score),
        "reasons": reasons,
        "related_entities": related or [],
        "detector": detector,
        "evidence": evidence or {},
    }


def detect_isolation_forest_anomalies(contamination: float = 0.15):
    g = store.g
    if g.number_of_nodes() < 5:
        return []
    rows = []
    ids = []
    for entity_id in g.nodes:
        amounts = []
        frequencies = []
        for _, _, data in g.out_edges(entity_id, data=True):
            amount = _edge_amount(data)
            if amount is not None:
                amounts.append(amount)
            frequencies.append(_edge_freq(data))
        ids.append(entity_id)
        rows.append([
            g.degree(entity_id),
            len(amounts),
            sum(amounts),
            max(amounts, default=0),
            sum(frequencies),
        ])
    features = np.asarray(rows, dtype=float)
    if not np.isfinite(features).all() or np.all(features == features[0]):
        return []
    model = IsolationForest(
        contamination=min(max(contamination, 0.01), 0.49),
        random_state=42,
        n_estimators=100,
    )
    labels = model.fit_predict(features)
    scores = -model.score_samples(features)
    alerts = []
    for entity_id, label, score, feature_row in zip(ids, labels, scores, features):
        if label != -1:
            continue
        name = g.nodes[entity_id].get("name", entity_id)
        normalized_score = min(95, round(55 + float(score) * 35))
        alerts.append(_alert(
            entity_id, name, "Statistical Network Anomaly", normalized_score,
            ["IsolationForest identified an unusual combination of degree, transaction amount, "
             "and interaction frequency; this is a secondary signal requiring rule-based review"],
            detector="isolation_forest",
            evidence={"features": feature_row.tolist(), "score": round(float(score), 4), "model": "IsolationForest"},
        ))
    return alerts


def run_all_detectors():
    alerts = []
    alerts += detect_unusual_financial_activity()
    alerts += detect_unusual_communication()
    alerts += detect_shared_attributes()
    alerts += detect_unexpected_connections()
    alerts += detect_isolation_forest_anomalies()
    alerts.sort(key=lambda a: -a["score"])
    return alerts
