import sqlite3
from pathlib import Path

from app.database import Base, engine


DB_PATH = Path(__file__).parent / "storage" / "app.db"


def migrate():

    print("Database:", DB_PATH)

    if not DB_PATH.exists():
        print("ERROR: app.db was not found.")
        return

    Base.metadata.create_all(bind=engine)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(evidence)")

    columns = {
        row[1]
        for row in cursor.fetchall()
    }

    print("\nExisting Evidence columns:")
    for column in sorted(columns):
        print("  -", column)

    # Add version
    if "version" not in columns:
        print("\nAdding: version")

        cursor.execute("""
            ALTER TABLE evidence
            ADD COLUMN version INTEGER NOT NULL DEFAULT 1
        """)

    # Add status
    if "status" not in columns:
        print("Adding: status")

        cursor.execute("""
            ALTER TABLE evidence
            ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active'
        """)

    # Add previous_version_id
    if "previous_version_id" not in columns:
        print("Adding: previous_version_id")

        cursor.execute("""
            ALTER TABLE evidence
            ADD COLUMN previous_version_id VARCHAR
        """)

    # Add verified_by
    if "verified_by" not in columns:
        print("Adding: verified_by")

        cursor.execute("""
            ALTER TABLE evidence
            ADD COLUMN verified_by VARCHAR
        """)

    # Add verified_at
    if "verified_at" not in columns:
        print("Adding: verified_at")

        cursor.execute("""
            ALTER TABLE evidence
            ADD COLUMN verified_at DATETIME
        """)

    conn.commit()

    # Verify
    cursor.execute("PRAGMA table_info(evidence)")

    new_columns = {
        row[1]
        for row in cursor.fetchall()
    }

    required = {
        "version",
        "status",
        "previous_version_id",
        "verified_by",
        "verified_at",
    }

    missing = required - new_columns

    if missing:
        print("\n❌ Migration failed.")
        print("Missing:", missing)
    else:
        print("\n✅ Migration successful!")
        print("Existing cases and evidence were preserved.")

    conn.close()

if __name__ == "__main__":
    migrate()
