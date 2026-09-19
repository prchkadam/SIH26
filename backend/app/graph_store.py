import json
import os
import threading
import uuid
from datetime import datetime, timezone

import networkx as nx

from .config import GRAPH_PATH

_lock = threading.RLock()


def _now():
    return datetime.now(timezone.utc).isoformat()


class GraphStore:
    def __init__(self, path: str = GRAPH_PATH):
        self.path = path
        self.g = nx.MultiDiGraph()
        self.load()

    def load(self):
        with _lock:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.g = nx.node_link_graph(data, directed=True, multigraph=True)
            else:
                self.g = nx.MultiDiGraph()

    def save(self):
        with _lock:
            data = nx.node_link_data(self.g)
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, default=str)
            os.replace(tmp, self.path)

    def reset(self):
        with _lock:
            self.g = nx.MultiDiGraph()
            self.save()

    def add_entity(self, entity_type: str, name: str, attributes: dict = None,
                   entity_id: str = None, confidence: float = 1.0, source: str = "manual") -> str:
        with _lock:
            entity_id = entity_id or f"{entity_type.lower()}-{uuid.uuid4().hex[:10]}"
            attributes = attributes or {}
            if self.g.has_node(entity_id):
                node = self.g.nodes[entity_id]
                node["attributes"].update(attributes)
                node["sources"] = list(set(node.get("sources", []) + [source]))
                node["updated_at"] = _now()
            else:
                self.g.add_node(
                    entity_id,
                    id=entity_id,
                    type=entity_type,
                    name=name,
                    attributes=attributes,
                    confidence=confidence,
                    sources=[source],
                    created_at=_now(),
                    updated_at=_now(),
                )
            return entity_id

    def get_entity(self, entity_id: str):
        if not self.g.has_node(entity_id):
            return None
        d = dict(self.g.nodes[entity_id])
        d["id"] = entity_id
        d["degree"] = self.g.degree(entity_id)
        return d

    def all_entities(self, entity_type: str = None):
        out = []
        for n, d in self.g.nodes(data=True):
            if entity_type and d.get("type") != entity_type:
                continue
            item = dict(d)
            item["id"] = n
            item["degree"] = self.g.degree(n)
            out.append(item)
        return out

    def delete_entity(self, entity_id: str):
        with _lock:
            if self.g.has_node(entity_id):
                self.g.remove_node(entity_id)

    def add_relationship(self, source_id: str, target_id: str, rel_type: str,
                          attributes: dict = None, confidence: float = 1.0,
                          weight: float = 1.0, evidence: list = None,
                          edge_id: str = None, directed: bool = True) -> str:
        with _lock:
            attributes = attributes or {}
            evidence = evidence or []
            edge_id = edge_id or f"rel-{uuid.uuid4().hex[:10]}"
            if not self.g.has_node(source_id) or not self.g.has_node(target_id):
                raise ValueError("Both source and target entities must exist before linking them")
            self.g.add_edge(
                source_id, target_id, key=edge_id,
                id=edge_id, type=rel_type, attributes=attributes,
                confidence=confidence, weight=weight, evidence=evidence,
                directed=directed, created_at=_now(),
            )
            return edge_id

    def get_relationships(self, entity_id: str):
        rels = []
        for u, v, k, d in self.g.out_edges(entity_id, keys=True, data=True):
            rels.append({**d, "source": u, "target": v})
        for u, v, k, d in self.g.in_edges(entity_id, keys=True, data=True):
            rels.append({**d, "source": u, "target": v})
        seen = {}
        for r in rels:
            seen[r["id"]] = r
        return list(seen.values())

    def search(self, query: str, limit: int = 25):
        q = query.strip().lower()
        if not q:
            return []
        results = []
        for n, d in self.g.nodes(data=True):
            haystack = [str(d.get("name", "")).lower(), str(n).lower()]
            for v in (d.get("attributes") or {}).values():
                haystack.append(str(v).lower())
            score = 0
            for h in haystack:
                if q == h:
                    score = max(score, 100)
                elif q in h:
                    score = max(score, 70)
            if score:
                item = dict(d)
                item["id"] = n
                item["degree"] = self.g.degree(n)
                item["match_score"] = score
                results.append(item)
        results.sort(key=lambda x: (-x["match_score"], -x["degree"]))
        return results[:limit]

    def neighborhood(self, entity_id: str, depth: int = 1, limit_nodes: int = 300):
        if not self.g.has_node(entity_id):
            return {"nodes": [], "edges": []}
        visited = {entity_id}
        frontier = {entity_id}
        for _ in range(depth):
            nxt = set()
            for n in frontier:
                nxt.update(self.g.successors(n))
                nxt.update(self.g.predecessors(n))
            nxt -= visited
            visited |= nxt
            frontier = nxt
            if len(visited) >= limit_nodes:
                break
        visited = set(list(visited)[:limit_nodes])
        return self._subgraph_payload(visited)

    def _subgraph_payload(self, node_ids: set):
        nodes = []
        for n in node_ids:
            if self.g.has_node(n):
                d = dict(self.g.nodes[n])
                d["id"] = n
                d["degree"] = self.g.degree(n)
                nodes.append(d)
        edges = []
        seen = set()
        for n in node_ids:
            for u, v, k, d in self.g.out_edges(n, keys=True, data=True):
                if u in node_ids and v in node_ids and k not in seen:
                    seen.add(k)
                    edges.append({**d, "source": u, "target": v})
        return {"nodes": nodes, "edges": edges}

    def full_graph(self, limit_nodes: int = 2000):
        ids = list(self.g.nodes)[:limit_nodes]
        return self._subgraph_payload(set(ids))

    def shortest_path(self, source_id: str, target_id: str):
        ug = self.g.to_undirected()
        try:
            path = nx.shortest_path(ug, source_id, target_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None
        return self._subgraph_payload(set(path)) | {"path_order": path}

    def stats(self):
        return {
            "total_entities": self.g.number_of_nodes(),
            "total_relationships": self.g.number_of_edges(),
            "entity_type_counts": self._count_by(lambda d: d.get("type")),
            "relationship_type_counts": self._edge_count_by(lambda d: d.get("type")),
        }

    def _count_by(self, keyfn):
        out = {}
        for _, d in self.g.nodes(data=True):
            k = keyfn(d)
            out[k] = out.get(k, 0) + 1
        return out

    def _edge_count_by(self, keyfn):
        out = {}
        for _, _, d in self.g.edges(data=True):
            k = keyfn(d)
            out[k] = out.get(k, 0) + 1
        return out


store = GraphStore()
