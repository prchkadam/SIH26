import random

from ..graph_store import store

FIRST_NAMES = [
    "Raj", "Arjun", "Vikram", "Sanjay", "Ravi", "Amit", "Suresh", "Anil", "Deepak", "Manoj",
    "Rahul", "Rohit", "Ajay", "Vijay", "Sunil", "Ashok", "Prakash", "Naveen", "Ramesh", "Dinesh",
    "Kiran", "Arun", "Mohan", "Gopal", "Sameer", "Farhan", "Imran", "Zubair", "Aslam", "Kabir",
    "Karan", "Nikhil", "Aditya", "Siddharth", "Varun", "Yash", "Priya", "Anita", "Sunita", "Kavita",
    "Pooja", "Neha", "Sneha", "Divya", "Meena", "Rekha", "Shalini", "Asha", "Geeta", "Nisha", "Ritu",
]
LAST_NAMES = [
    "Kumar", "Sharma", "Verma", "Singh", "Gupta", "Yadav", "Mehta", "Patel", "Reddy", "Nair",
    "Iyer", "Rao", "Chauhan", "Malhotra", "Kapoor", "Joshi", "Desai", "Pillai", "Khan", "Ansari",
    "Shaikh", "Bhatt", "Trivedi", "Agarwal", "Bose", "Chatterjee", "Mukherjee", "Banerjee",
]
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad",
          "Jaipur", "Lucknow", "Nagpur", "Surat", "Kochi", "Chandigarh", "Goa"]
SPECIFIC_PLACES = ["Andheri Warehouse", "JNPT Port Yard", "Sahar Airport Cargo Bay", "Bhiwandi Godown",
                    "Dharavi Transit Point", "Nhava Sheva Container Depot", "Old City Safehouse",
                    "Ring Road Truck Terminal", "Riverside Farmhouse", "Border Checkpost 14"]
ORG_BASES = ["Shanti", "Om", "National", "United", "Global", "Ganga", "Everest", "Star", "Silver",
             "Metro", "Prime", "Coastal", "Continental", "Blue Ocean", "Sunrise"]
ORG_SUFFIXES = ["Traders", "Logistics Pvt Ltd", "Enterprises", "Exports", "Imports & Exports",
                "Shipping Co.", "Holdings", "Freight Services", "Trading Co."]
VEHICLE_STATES = ["MH", "DL", "KA", "TN", "GJ", "UP", "RJ", "WB"]

random.seed(42)


def _name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def _phone():
    return f"{random.choice('6789')}{''.join(random.choice('0123456789') for _ in range(9))}"


def _account():
    return "".join(random.choice("0123456789") for _ in range(12))


def _vehicle():
    st = random.choice(VEHICLE_STATES)
    return f"{st}{random.randint(1,60):02d}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{random.randint(1000,9999)}"


def _org_name():
    return f"{random.choice(ORG_BASES)} {random.choice(ORG_SUFFIXES)}"


def _add_person(name=None, attrs=None):
    name = name or _name()
    attrs = attrs or {}
    attrs.setdefault("phone", _phone())
    attrs.setdefault("address", random.choice(CITIES))
    attrs.setdefault("national_id", f"IND{random.randint(10**8, 10**9-1)}")
    return store.add_entity("Person", name, attrs, source="synthetic-demo"), name


def generate_all():
    store.reset()
    summary = {}

    location_ids = {}
    for city in CITIES:
        location_ids[city] = store.add_entity("Location", city, {"kind": "city"}, source="synthetic-demo")
    place_ids = {}
    for place in SPECIFIC_PLACES:
        place_ids[place] = store.add_entity("Location", place, {"kind": "facility"}, source="synthetic-demo")
    all_location_ids = list(location_ids.values()) + list(place_ids.values())

    org_ids = []
    for _ in range(16):
        oid = store.add_entity("Organization", _org_name(), {"sector": random.choice(
            ["Logistics", "Trading", "Import/Export", "Real Estate", "Finance", "Shipping"]
        )}, source="synthetic-demo")
        org_ids.append(oid)

    persons = []
    for _ in range(140):
        pid, name = _add_person()
        persons.append((pid, name))

    for pid, name in persons:
        if random.random() < 0.5:
            other_id, _ = random.choice(persons)
            if other_id != pid:
                freq = random.randint(1, 12)
                store.add_relationship(pid, other_id, "called",
                                        attributes={"frequency": freq}, weight=freq,
                                        evidence=[f"Call log: {freq} contacts recorded"])
        if random.random() < 0.35:
            loc = random.choice(all_location_ids)
            store.add_relationship(pid, loc, "visited", attributes={"date": "2026-06-15"},
                                    evidence=["Location check-in record"])
        if random.random() < 0.3:
            org = random.choice(org_ids)
            store.add_relationship(pid, org, "associated_with", attributes={"role": "affiliate"},
                                    evidence=["Organization membership record"])
        if random.random() < 0.25:
            vid = store.add_entity("Vehicle", _vehicle(), {"vehicle_type": random.choice(
                ["Sedan", "SUV", "Motorcycle", "Truck", "Van"])}, source="synthetic-demo")
            store.add_relationship(pid, vid, "owns", evidence=["Vehicle registration record"])

    hub_ids = []
    for _ in range(5):
        pid, name = _add_person()
        hub_ids.append(pid)
        persons.append((pid, name))
        connections = random.sample(persons, k=min(22, len(persons)))
        for other_id, _ in connections:
            if other_id == pid:
                continue
            freq = random.randint(5, 20)
            store.add_relationship(pid, other_id, "called", attributes={"frequency": freq}, weight=freq,
                                    evidence=[f"Call log: {freq} contacts recorded"])
        for org in random.sample(org_ids, k=4):
            store.add_relationship(pid, org, "associated_with", attributes={"role": "coordinator"},
                                    evidence=["Organization membership record, coordinating role"])

    cluster_member_ids = []
    for c in range(3):
        cluster = []
        for _ in range(15):
            pid, name = _add_person()
            cluster.append(pid)
            persons.append((pid, name))
        for i, a in enumerate(cluster):
            for b in cluster[i + 1:]:
                if random.random() < 0.45:
                    freq = random.randint(8, 40)
                    store.add_relationship(a, b, "called", attributes={"frequency": freq}, weight=freq,
                                            evidence=[f"Call log: {freq} contacts within suspected group"])
        shared_place = random.choice(list(place_ids.values()))
        shared_org = org_ids[c]
        for m in cluster:
            store.add_relationship(m, shared_place, "visited", attributes={"date": "2026-07-01"},
                                    evidence=["Multiple group members visited the same facility"])
            store.add_relationship(m, shared_org, "associated_with", attributes={"role": "member"},
                                    evidence=["Shared organization membership within group"])
        liaison = cluster[0]
        bridge_hub = hub_ids[c % len(hub_ids)]
        store.add_relationship(liaison, bridge_hub, "called", attributes={"frequency": 3}, weight=3,
                                evidence=["Single low-frequency contact bridging two otherwise separate groups"])
        cluster_member_ids.append(cluster)

    resolution_pairs = []
    for _ in range(14):
        base_first = random.choice(FIRST_NAMES)
        base_last = random.choice(LAST_NAMES)
        shared_phone = _phone()
        canonical_id, canonical_name = _add_person(f"{base_first} {base_last}", {"phone": shared_phone})
        persons.append((canonical_id, canonical_name))
        variant_name = random.choice([
            f"{base_first[0]}. {base_last}",
            f"{base_first} {base_last[0]}.",
            f"{base_first} {base_last}",
        ])
        variant_id, _ = _add_person(variant_name, {"phone": shared_phone,
                                                     "address": store.get_entity(canonical_id)["attributes"]["address"]})
        persons.append((variant_id, variant_name))
        resolution_pairs.append((canonical_id, variant_id))

    shared_attr_flags = []
    for _ in range(3):
        p1, n1 = _add_person()
        p2, n2 = _add_person()
        persons.append((p1, n1))
        persons.append((p2, n2))
        shared_phone = _phone()
        store.add_entity("Person", n1, {"phone": shared_phone}, entity_id=p1, source="synthetic-demo")
        store.add_entity("Person", n2, {"phone": shared_phone}, entity_id=p2, source="synthetic-demo")
        shared_attr_flags.append((p1, p2))

    account_of = {}
    for pid, name in persons:
        if random.random() < 0.55:
            acc_id = store.add_entity("Account", f"{name} - Savings", {"bank": random.choice(
                ["State Bank", "Union National Bank", "City Cooperative Bank", "Metro Bank"])},
                source="synthetic-demo")
            store.add_relationship(pid, acc_id, "owns", evidence=["Bank account ownership record"])
            account_of[pid] = acc_id

    account_holders = list(account_of.items())
    for _ in range(220):
        sender_id, _ = random.choice(persons)
        receiver_pid, receiver_acc = random.choice(account_holders)
        if receiver_acc == account_of.get(sender_id):
            continue
        amount = random.choice([5000, 8000, 12000, 15000, 25000, 40000, 60000, 90000])
        store.add_relationship(sender_id, receiver_acc, "transferred_money_to",
                                attributes={"amount": amount, "date": "2026-05-10"},
                                evidence=[f"Bank transaction record: Rs {amount}"])

    structuring_ids = []
    for _ in range(6):
        pid, name = _add_person()
        persons.append((pid, name))
        structuring_ids.append(pid)
        target_acc = random.choice(list(account_of.values())) if account_of else None
        if not target_acc:
            continue
        for i in range(6):
            amount = random.randint(452000, 497000)
            store.add_relationship(pid, target_acc, "transferred_money_to",
                                    attributes={"amount": amount, "date": f"2026-06-{10+i:02d}"},
                                    evidence=[f"Repeated transfer just under reporting threshold: Rs {amount}"])

    sudden_transfer_ids = []
    for _ in range(8):
        pid, name = _add_person()
        persons.append((pid, name))
        sudden_transfer_ids.append(pid)
        target_pid, target_acc = random.choice(account_holders) if account_holders else (None, None)
        if not target_acc:
            continue
        for i in range(3):
            amount = random.randint(4000, 30000)
            store.add_relationship(pid, target_acc, "transferred_money_to",
                                    attributes={"amount": amount, "date": f"2026-04-{5+i:02d}"},
                                    evidence=[f"Routine transaction: Rs {amount}"])
        huge_amount = random.randint(800000, 2500000)
        store.add_relationship(pid, target_acc, "transferred_money_to",
                                attributes={"amount": huge_amount, "date": "2026-08-20"},
                                evidence=[f"Sudden high-value transfer: Rs {huge_amount}, sharply above this "
                                          f"entity's historical transaction pattern"])

    loop_people = []
    for _ in range(4):
        pid, name = _add_person()
        persons.append((pid, name))
        loop_people.append((pid, name))
    for i in range(4):
        src_id = loop_people[i][0]
        dst_pid, dst_name = loop_people[(i + 1) % 4]
        dst_acc = account_of.get(dst_pid)
        if not dst_acc:
            dst_acc = store.add_entity("Account", f"{dst_name} - Savings", {"bank": "City Cooperative Bank"},
                                        source="synthetic-demo")
            store.add_relationship(dst_pid, dst_acc, "owns", evidence=["Bank account ownership record"])
            account_of[dst_pid] = dst_acc
        amount = random.randint(120000, 280000)
        store.add_relationship(src_id, dst_acc, "transferred_money_to",
                                attributes={"amount": amount, "date": "2026-07-15"},
                                evidence=[f"Part of a closed transaction loop: Rs {amount} "
                                          f"(funds ultimately cycle back to the originating entity)"])

    store.save()

    summary["hub_ids"] = hub_ids
    summary["cluster_member_ids"] = cluster_member_ids
    summary["resolution_pairs"] = resolution_pairs
    summary["shared_attr_flags"] = shared_attr_flags
    summary["structuring_ids"] = structuring_ids
    summary["sudden_transfer_ids"] = sudden_transfer_ids
    summary["loop_people"] = [p[0] for p in loop_people]
    summary["all_person_ids"] = [p[0] for p in persons]
    summary["stats"] = store.stats()
    return summary
