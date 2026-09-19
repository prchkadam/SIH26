import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import init_db, SessionLocal, Investigator, Alert, Case, CaseEntityLink, CaseNote
from app.auth import hash_password
from app.data.synthetic_generator import generate_all
from app.anomaly_detection import run_all_detectors
from app.graph_store import store


def seed_investigators(db):
    accounts = [
        ("admin", "System Administrator", "ADM-001", "Administrator", "admin123"),
        ("investigator1", "Ananya Rao", "INV-104", "Senior Investigator", "password123"),
        ("investigator2", "Vikram Shah", "INV-217", "Intelligence Analyst", "password123"),
    ]
    for username, full_name, badge, role, pwd in accounts:
        if db.query(Investigator).filter(Investigator.username == username).first():
            continue
        db.add(Investigator(username=username, full_name=full_name, badge_id=badge, role=role,
                             hashed_password=hash_password(pwd)))
    db.commit()
    print("Seeded investigator accounts: admin/admin123, investigator1/password123, investigator2/password123")


def seed_alerts(db):
    db.query(Alert).delete()
    db.commit()
    alerts = run_all_detectors()
    for a in alerts:
        db.add(Alert(
            id=a["id"], entity_id=a["entity_id"], entity_name=a["entity_name"],
            alert_type=a["alert_type"], score=a["score"],
            reasons_json=json.dumps(a["reasons"]),
            related_entities_json=json.dumps(a["related_entities"]),
        ))
    db.commit()
    print(f"Generated {len(alerts)} alerts from anomaly detection")
    return alerts


def seed_cases(db, summary, alerts):
    db.query(CaseNote).delete()
    db.query(CaseEntityLink).delete()
    db.query(Case).delete()
    db.commit()

    def name_of(eid):
        e = store.get_entity(eid)
        return e["name"] if e else eid

    cluster0 = summary["cluster_member_ids"][0]
    case1 = Case(id="CASE-A1B2C3", title="Operation Riverbed",
                 description="Investigating a densely interconnected group operating around a shared "
                              "logistics facility, suspected of coordinating undeclared movement of goods.",
                 status="open", priority="high", created_by="investigator1")
    db.add(case1)
    for eid in cluster0[:8]:
        db.add(CaseEntityLink(case_id=case1.id, entity_id=eid, entity_type="Person",
                               linked_kind="entity", added_by="investigator1"))
    for a in [x for x in alerts if x["entity_id"] in cluster0][:3]:
        db.add(CaseEntityLink(case_id=case1.id, ref_id=a["id"], linked_kind="alert", added_by="investigator1"))
    db.add(CaseNote(case_id=case1.id, author="investigator1",
                     text="Initial network mapping shows a tightly-knit cluster with high internal call "
                          "frequency and shared facility visits. Recommend cross-referencing with financial "
                          "records for the top-degree members."))

    struct_ids = summary["structuring_ids"]
    case2 = Case(id="CASE-D4E5F6", title="Financial Structuring Probe",
                 description="Multiple entities exhibiting repeated transfers just below the regulatory "
                              "reporting threshold to a common set of accounts, a potential structuring activity.",
                 status="open", priority="high", created_by="investigator2")
    db.add(case2)
    for eid in struct_ids:
        db.add(CaseEntityLink(case_id=case2.id, entity_id=eid, entity_type="Person",
                               linked_kind="entity", added_by="investigator2"))
    for a in [x for x in alerts if x["entity_id"] in struct_ids][:5]:
        db.add(CaseEntityLink(case_id=case2.id, ref_id=a["id"], linked_kind="alert", added_by="investigator2"))
    db.add(CaseNote(case_id=case2.id, author="investigator2",
                     text="Flagged six entities with repeated transfers in the 4.5-4.97 lakh range. "
                          "Pattern is consistent with structuring to avoid reporting thresholds. "
                          "Needs financial intelligence unit review."))

    hub_ids = summary["hub_ids"]
    case3 = Case(id="CASE-G7H8I9", title="Cross-Border Logistics Ring",
                 description="Tracking high-degree intermediary entities that bridge multiple otherwise "
                              "separate groups, along with associated vehicles and transport hubs.",
                 status="open", priority="medium", created_by="admin")
    db.add(case3)
    for eid in hub_ids:
        db.add(CaseEntityLink(case_id=case3.id, entity_id=eid, entity_type="Person",
                               linked_kind="entity", added_by="admin"))
    db.add(CaseNote(case_id=case3.id, author="admin",
                     text="These entities show unusually high connectivity and act as intermediaries "
                          "between multiple clusters. Investigate their vehicle and travel records."))

    db.commit()
    print("Seeded 3 demo cases: CASE-A1B2C3, CASE-D4E5F6, CASE-G7H8I9")


def main():
    init_db()
    db = SessionLocal()
    try:
        seed_investigators(db)
        print("Generating synthetic network...")
        summary = generate_all()
        print(f"Graph stats: {summary['stats']}")
        alerts = seed_alerts(db)
        seed_cases(db, summary, alerts)
    finally:
        db.close()
    print("\nSeed complete. Start the API with: uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
