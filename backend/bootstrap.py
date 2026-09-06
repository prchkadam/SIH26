"""Initialize the disposable hackathon demo only on its first container start."""

from app.database import Investigator, SessionLocal, init_db


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        has_investigator = db.query(Investigator.id).first() is not None
    finally:
        db.close()

    if not has_investigator:
        # seed.main() creates the three documented demo accounts and synthetic
        # network data. It is deliberately not run again after the first boot.
        from seed import main as seed_demo

        seed_demo()


if __name__ == "__main__":
    main()
