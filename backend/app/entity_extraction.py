import re


# ============================================================
# BASIC GAZETTEERS / PATTERNS
# ============================================================

INDIAN_CITIES = {
    "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata",
    "pune", "ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur", "indore",
    "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "ghaziabad", "ludhiana",
    "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi", "srinagar",
    "amritsar", "chandigarh", "gurgaon", "gurugram", "noida", "goa", "kochi",
}

ORG_SUFFIXES = [
    "pvt ltd", "pvt. ltd.", "ltd", "limited", "llp", "inc", "corp",
    "corporation", "enterprises", "traders", "bank", "exports", "imports",
    "logistics", "industries", "group", "holdings", "associates", "co.",
]

ORG_SUFFIX_WORDS = [
    "Bank", "Ltd", "Corp", "Corporation", "Enterprises", "Traders",
    "Logistics", "Industries", "Group", "Exports", "Imports", "Holdings",
    "Limited", "Co", "LLP", "Inc",
]

ORG_PATTERN = re.compile(
    r"\b((?:[A-Z][a-zA-Z]*\s){1,4}(?:"
    + "|".join(ORG_SUFFIX_WORDS)
    + r"))\b\.?",
)


PLACE_WORDS = [
    "warehouse", "port", "airport", "hotel", "restaurant", "godown",
    "office", "factory", "depot", "border", "checkpost", "market",
    "station", "terminal", "farmhouse", "safehouse", "apartment",
]


PERSON_TRIGGER = re.compile(
    r"\b(?:met|with|and|along with|accompanied by|introduced|contacted|"
    r"called|visited by)\s+"
    r"([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})",
    re.IGNORECASE,
)


CAP_NAME = re.compile(
    r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b"
)


PHONE_RE = re.compile(
    r"\b(?:\+?91[-\s]?)?[6-9]\d{9}\b"
)


ACCOUNT_RE = re.compile(
    r"\b(?:A/?C|Account)\s*(?:No\.?|#)?\s*[:\-]?\s*(\d{9,18})\b",
    re.IGNORECASE,
)


BARE_LONG_NUMBER_RE = re.compile(
    r"\b\d{9,18}\b"
)


VEHICLE_RE = re.compile(
    r"\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}\b"
)


MONEY_RE = re.compile(
    r"(?:₹|Rs\.?|INR)\s?([\d,]+(?:\.\d+)?)\s?"
    r"(lakh|lakhs|crore|crores)?",
    re.IGNORECASE,
)


# ============================================================
# IMPORTANT:
# Correct date regex.
# ============================================================

DATE_RE = re.compile(
    r"\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*"
    r"\s+\d{1,2},?\s+\d{4})\b",
    re.IGNORECASE,
)


LOCATION_TRIGGER = re.compile(
    r"\b(?:in|at|near|from|to)\s+([A-Z][a-zA-Z]+)\b"
)


COMMON_WORDS = {
    "The", "This", "That", "It", "He", "She", "They", "We", "I",
    "Call", "Transaction", "Person", "Location", "Vehicle", "Account",
    "Alert", "Frequency", "Amount", "Entity", "Type", "Score", "Reason",
    "Rs", "No", "Date", "Bank", "Reference", "Ref", "Id", "Total",
    "Balance", "And", "With", "From", "To", "In", "At", "Near",
}


# Words which are very unlikely to be the actual relationship.
RELATION_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "then", "that", "this",
    "was", "were", "is", "are", "has", "have", "had", "by", "to",
    "from", "in", "on", "at", "with", "for", "of",
}


RELATION_NOISE = {
    "and", "with", "was", "were", "is", "are", "has", "have",
    "had", "by", "to", "from", "in", "on", "at", "for", "of",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _has_stopword_token(candidate: str) -> bool:
    return any(
        tok in COMMON_WORDS
        for tok in candidate.split()
    )


def _clean_names(
    candidates,
    exclude_org_suffixes=True,
):
    out = []

    for c in candidates:
        c = c.strip()

        if not c:
            continue

        if _has_stopword_token(c):
            continue

        if c.lower() in INDIAN_CITIES:
            continue

        if (
            exclude_org_suffixes
            and any(
                c.lower().endswith(s)
                for s in ORG_SUFFIXES
            )
        ):
            continue

        out.append(c)

    return out


def _clean_org_names(candidates):
    cleaned = [
        c.strip()
        for c in candidates
        if c.strip()
        and not _has_stopword_token(c.strip())
    ]

    out = []

    for c in cleaned:
        if any(
            other != c
            and other.startswith(c)
            for other in cleaned
        ):
            continue

        out.append(c)

    return out


# ============================================================
# ENTITY EXTRACTION
# ============================================================

def extract_entities(text: str) -> dict:

    result = {
        "people": [],
        "organizations": [],
        "phone_numbers": [],
        "bank_accounts": [],
        "vehicles": [],
        "locations": [],
        "places": [],
        "dates": [],
        "transactions": [],
        "explanations": [],
    }

    # --------------------------------------------------------
    # MONEY
    # --------------------------------------------------------

    for m in MONEY_RE.finditer(text):

        amt = m.group(1)
        unit = m.group(2)

        result["transactions"].append({
            "raw": m.group(0),
            "amount": amt,
            "unit": unit,
        })

        result["explanations"].append(
            f"Matched currency pattern '{m.group(0)}' "
            f"→ financial transaction"
        )

    # --------------------------------------------------------
    # PHONE NUMBERS
    # --------------------------------------------------------

    for m in PHONE_RE.finditer(text):

        result["phone_numbers"].append(
            m.group(0)
        )

        result["explanations"].append(
            f"Matched 10-digit mobile pattern "
            f"'{m.group(0)}' → phone number"
        )

    # --------------------------------------------------------
    # BANK ACCOUNTS
    # --------------------------------------------------------

    labelled_accounts = set()

    for m in ACCOUNT_RE.finditer(text):

        result["bank_accounts"].append(
            m.group(1)
        )

        labelled_accounts.add(
            m.group(1)
        )

        result["explanations"].append(
            f"Matched 'Account No.' label near "
            f"'{m.group(1)}' → bank account"
        )

    for m in BARE_LONG_NUMBER_RE.finditer(text):

        num = m.group(0)

        if num in labelled_accounts:
            continue

        if num in result["phone_numbers"]:
            continue

        if len(num) >= 11:

            result["bank_accounts"].append(
                num
            )

            result["explanations"].append(
                f"Matched long numeric string "
                f"'{num}' → probable bank account"
            )

    # --------------------------------------------------------
    # VEHICLES
    # --------------------------------------------------------

    for m in VEHICLE_RE.finditer(text):

        vehicle = (
            m.group(0)
            .replace(" ", "")
            .replace("-", "")
        )

        result["vehicles"].append(
            vehicle
        )

        result["explanations"].append(
            f"Matched vehicle registration pattern "
            f"'{m.group(0)}' → vehicle"
        )

    # --------------------------------------------------------
    # DATES
    # --------------------------------------------------------

    for m in DATE_RE.finditer(text):

        result["dates"].append(
            m.group(0)
        )

        result["explanations"].append(
            f"Matched date pattern "
            f"'{m.group(0)}' → date"
        )

    # --------------------------------------------------------
    # ORGANIZATIONS
    # --------------------------------------------------------

    org_matches = {
        m.group(1).strip()
        for m in ORG_PATTERN.finditer(text)
    }

    result["organizations"] = _clean_org_names(
        list(org_matches)
    )

    for org in result["organizations"]:

        result["explanations"].append(
            f"Matched organization-suffix gazetteer "
            f"for '{org}' → organization"
        )

    # --------------------------------------------------------
    # LOCATIONS
    # --------------------------------------------------------

    loc_matches = set()

    for m in LOCATION_TRIGGER.finditer(text):

        cand = m.group(1)

        if cand.lower() in INDIAN_CITIES:

            loc_matches.add(cand)

            result["explanations"].append(
                f"Matched location-trigger "
                f"'{m.group(0)}' → location "
                f"(city gazetteer)"
            )

        elif (
            cand not in COMMON_WORDS
            and cand.lower() not in PLACE_WORDS
        ):

            loc_matches.add(cand)

            result["explanations"].append(
                f"Matched location-trigger "
                f"'{m.group(0)}' → probable location"
            )

    result["locations"] = [
        c
        for c in loc_matches
        if c.strip()
        and not _has_stopword_token(c)
    ]

    # --------------------------------------------------------
    # PLACES
    # --------------------------------------------------------

    for word in PLACE_WORDS:

        if re.search(
            rf"\b{re.escape(word)}\b",
            text,
            re.IGNORECASE,
        ):

            result["places"].append(
                word
            )

            result["explanations"].append(
                f"Matched facility keyword "
                f"'{word}' → place"
            )

    # --------------------------------------------------------
    # PEOPLE
    # --------------------------------------------------------

    org_and_loc = (
        set(result["organizations"])
        |
        set(result["locations"])
    )

    def _overlaps_org_or_loc(candidate):

        return any(
            candidate in item
            or item in candidate
            for item in org_and_loc
        )

    people = set()

    # Names found after relationship triggers
    for m in PERSON_TRIGGER.finditer(text):

        cand = m.group(1)

        if not _overlaps_org_or_loc(cand):

            people.add(cand)

            result["explanations"].append(
                f"Matched relational trigger "
                f"'{m.group(0)}' → person"
            )

    # Capitalized names
    for m in CAP_NAME.finditer(text):

        cand = m.group(1)

        if _overlaps_org_or_loc(cand):
            continue

        if cand in COMMON_WORDS:
            continue

        if cand.lower() in INDIAN_CITIES:
            continue

        if any(
            cand.lower().endswith(s)
            for s in ORG_SUFFIXES
        ):
            continue

        if any(
            cand in org
            for org in result["organizations"]
        ):
            continue

        people.add(cand)

    result["people"] = _clean_names(
        list(people)
    )

    # --------------------------------------------------------
    # REMOVE DUPLICATES
    # --------------------------------------------------------

    for key in [
        "people",
        "organizations",
        "phone_numbers",
        "bank_accounts",
        "vehicles",
        "locations",
        "places",
        "dates",
    ]:
        result[key] = sorted(
            set(result[key])
        )

    return result


# ============================================================
# RELATIONSHIP EXTRACTION
# ============================================================

def _normalise_relation(text: str) -> str:
    """
    Clean the words between two entity names while preserving
    the actual action/relationship from the source text.

    Examples:

        killed
        called
        transferred money to
        works with
        threatened
        attacked
        kidnapped
    """

    relation = re.sub(
        r"\s+",
        " ",
        text.strip(),
    )

    relation = relation.strip(
        " ,.;:-"
    )

    # Remove sentence-starting filler.
    relation = re.sub(
        r"^(?:then|and|also|later|afterwards)\s+",
        "",
        relation,
        flags=re.IGNORECASE,
    )

    # Remove common passive grammar.
    relation = re.sub(
        r"^(?:was|were|is|are|has been|had been)\s+",
        "",
        relation,
        flags=re.IGNORECASE,
    )

    # Remove "by" from the end.
    relation = re.sub(
        r"\s+by$",
        "",
        relation,
        flags=re.IGNORECASE,
    )

    return relation.strip()


def _find_relation_between(
    sentence: str,
    source: str,
    target: str,
):
    """
    Find the words connecting two known entity names.

    Supports examples such as:

        Samhith killed Aniket
        Samhith called Aniket
        Samhith transferred money to Aniket
        Samhith works with Aniket
        Samhith threatened Aniket

    Also supports passive voice:

        Aniket was killed by Samhith
    """

    escaped_source = re.escape(
        source
    )

    escaped_target = re.escape(
        target
    )

    # --------------------------------------------------------
    # ACTIVE VOICE
    # --------------------------------------------------------

    active = re.search(
        rf"\b{escaped_source}\b"
        rf"\s+(.+?)\s+"
        rf"\b{escaped_target}\b",
        sentence,
        re.IGNORECASE,
    )

    if active:

        relation = _normalise_relation(
            active.group(1)
        )

        if (
            relation
            and relation.lower()
            not in RELATION_NOISE
        ):

            return relation, False

    # --------------------------------------------------------
    # PASSIVE VOICE
    # --------------------------------------------------------

    passive = re.search(
        rf"\b{escaped_target}\b"
        rf"\s+(.+?)\s+by\s+"
        rf"\b{escaped_source}\b",
        sentence,
        re.IGNORECASE,
    )

    if passive:

        relation = _normalise_relation(
            passive.group(1)
        )

        if (
            relation
            and relation.lower()
            not in RELATION_NOISE
        ):

            return relation, True

    return None, False


def _person_pairs_in_sentence(
    sentence: str,
    people: list,
):
    """
    Return people in their actual order of appearance
    within the sentence.
    """

    found = []

    for person in people:

        match = re.search(
            rf"\b{re.escape(person)}\b",
            sentence,
            re.IGNORECASE,
        )

        if match:

            found.append(
                (
                    match.start(),
                    person,
                )
            )

    found.sort(
        key=lambda x: x[0]
    )

    return [
        person
        for _, person in found
    ]


# ============================================================
# MAIN RELATIONSHIP FUNCTION
# ============================================================

def extract_relationships_from_text(
    text: str,
    extracted: dict,
) -> list:

    rels = []

    people = extracted.get(
        "people",
        [],
    )

    locs = (
        extracted.get("locations", [])
        +
        extracted.get("places", [])
    )

    orgs = extracted.get(
        "organizations",
        [],
    )

    # --------------------------------------------------------
    # Process sentence by sentence.
    # --------------------------------------------------------

    sentences = re.split(
        r"(?<=[.!?])\s+|\n+",
        text,
    )

    for sentence in sentences:

        sentence = sentence.strip()

        if not sentence:
            continue

        sentence_people = _person_pairs_in_sentence(
            sentence,
            people,
        )

        # ----------------------------------------------------
        # PERSON -> PERSON
        # ----------------------------------------------------

        if len(sentence_people) >= 2:

            for i in range(
                len(sentence_people) - 1
            ):

                source = sentence_people[i]

                for j in range(
                    i + 1,
                    len(sentence_people),
                ):

                    target = sentence_people[j]

                    relation, passive = (
                        _find_relation_between(
                            sentence,
                            source,
                            target,
                        )
                    )

                    if not relation:
                        continue

                    # ------------------------------------------------
                    # Passive:
                    #
                    # Aniket was killed by Samhith
                    #
                    # Detected order:
                    # Aniket -> Samhith
                    #
                    # Actual relationship:
                    # Samhith -> killed -> Aniket
                    # ------------------------------------------------

                    if passive:

                        actual_source = target
                        actual_target = source

                    else:

                        actual_source = source
                        actual_target = target

                    relation_text = (
                        f"{actual_source} "
                        f"{relation} "
                        f"{actual_target}"
                    )

                    rels.append({
                        "source": actual_source,
                        "target": actual_target,
                        "type": relation,
                        "description": relation_text,
                        "explanation": (
                            "Extracted relationship "
                            "from source text: "
                            f'"{sentence}"'
                        ),
                    })

        # ----------------------------------------------------
        # PERSON -> LOCATION
        # ----------------------------------------------------

        for person in sentence_people:

            for location in locs:

                if re.search(
                    rf"\b{re.escape(location)}\b",
                    sentence,
                    re.IGNORECASE,
                ):

                    rels.append({
                        "source": person,
                        "target": location,
                        "type": "visited",
                        "description": (
                            f"{person} visited "
                            f"{location}"
                        ),
                        "explanation": (
                            f"'{person}' co-occurs "
                            f"with location/place "
                            f"'{location}'"
                        ),
                    })

            # ------------------------------------------------
            # PERSON -> ORGANIZATION
            # ------------------------------------------------

            for org in orgs:

                if re.search(
                    rf"\b{re.escape(org)}\b",
                    sentence,
                    re.IGNORECASE,
                ):

                    rels.append({
                        "source": person,
                        "target": org,
                        "type": "associated_with",
                        "description": (
                            f"{person} associated "
                            f"with {org}"
                        ),
                        "explanation": (
                            f"'{person}' co-occurs "
                            f"with organization "
                            f"'{org}'"
                        ),
                    })

    # --------------------------------------------------------
    # FALLBACK
    # --------------------------------------------------------

    if not rels and len(people) >= 2:

        source = people[0]
        target = people[1]

        rels.append({
            "source": source,
            "target": target,
            "type": "associated_with",
            "description": (
                f"{source} associated "
                f"with {target}"
            ),
            "explanation": (
                "Both people were mentioned "
                "together, but no specific "
                "relationship phrase was detected."
            ),
        })

    return rels