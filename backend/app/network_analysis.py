import networkx as nx

from .graph_store import store


def _named(node_id, d):
    return {"id": node_id, "name": d.get("name"), "type": d.get("type")}


def top_connected(limit: int = 15):
    g = store.g
    if g.number_of_nodes() == 0:
        return []
    deg = nx.degree_centrality(g)
    ranked = sorted(deg.items(), key=lambda x: -x[1])[:limit]
    out = []
    for node_id, score in ranked:
        d = g.nodes[node_id]
        out.append({**_named(node_id, d), "degree": g.degree(node_id),
                    "centrality_score": round(score, 4)})
    return out


def important_intermediaries(limit: int = 15):
    g = store.g
    if g.number_of_nodes() < 3:
        return []
    ug = g.to_undirected()
    bet = nx.betweenness_centrality(ug, normalized=True)
    ranked = sorted(bet.items(), key=lambda x: -x[1])[:limit]
    out = []
    for node_id, score in ranked:
        if score <= 0:
            continue
        d = g.nodes[node_id]
        out.append({**_named(node_id, d), "betweenness_score": round(score, 4),
                    "explanation": "Frequently lies on the shortest path between other entity pairs, "
                                   "making it a likely broker/intermediary"})
    return out


def communities(min_size: int = 3, limit: int = 20):
    g = store.g
    if g.number_of_nodes() < 3:
        return []
    ug = g.to_undirected()
    try:
        comms = list(nx.algorithms.community.greedy_modularity_communities(ug))
    except Exception:
        comms = [set(c) for c in nx.connected_components(ug)]
    comms = [c for c in comms if len(c) >= min_size]
    comms.sort(key=lambda c: -len(c))
    out = []
    for i, c in enumerate(comms[:limit]):
        sub = ug.subgraph(c)
        density = nx.density(sub)
        members = [_named(n, g.nodes[n]) for n in list(c)[:50]]
        out.append({
            "community_id": f"cluster-{i+1}",
            "size": len(c),
            "density": round(density, 3),
            "members": members,
            "explanation": f"{len(c)} entities forming a densely interconnected group "
                            f"(density {density:.2f}), a possible operational cell",
        })
    return out


def frequent_interactions(limit: int = 15):
    g = store.g
    ranked = []
    for u, v, d in g.edges(data=True):
        weight = d.get("weight", 1) or d.get("attributes", {}).get("frequency", 1)
        try:
            weight = float(weight)
        except (TypeError, ValueError):
            weight = 1.0
        ranked.append({
            "source": _named(u, g.nodes[u]), "target": _named(v, g.nodes[v]),
            "type": d.get("type"), "weight": weight, "relationship_id": d.get("id"),
        })
    ranked.sort(key=lambda x: -x["weight"])
    return ranked[:limit]


def shortest_path(source_id: str, target_id: str):
    return store.shortest_path(source_id, target_id)


def unusual_structures(limit: int = 15):
    g = store.g
    if g.number_of_nodes() < 3:
        return []
    degrees = dict(g.degree())
    if not degrees:
        return []
    values = list(degrees.values())
    mean = sum(values) / len(values)
    std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5 or 1.0
    out = []
    for node_id, deg in degrees.items():
        z = (deg - mean) / std
        if z >= 2.0:
            d = g.nodes[node_id]
            out.append({
                **_named(node_id, d), "degree": deg, "z_score": round(z, 2),
                "explanation": f"Degree ({deg}) is {z:.1f} standard deviations above the network "
                                f"average ({mean:.1f}), an unusually high number of direct connections",
            })
    out.sort(key=lambda x: -x["z_score"])
    return out[:limit]


def overview_stats():
    return store.stats()
