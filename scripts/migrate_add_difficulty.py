#!/usr/bin/env python3
import argparse
import sqlite3
import sys

def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def main() -> int:
    parser = argparse.ArgumentParser(description="Add difficulty column to annotations table.")
    parser.add_argument(
        "--db",
        default="backend/data/labelscore.db",
        help="Path to sqlite database file.",
    )
    args = parser.parse_args()

    try:
        conn = sqlite3.connect(args.db)
    except sqlite3.Error as exc:
        print(f"Failed to open database: {exc}", file=sys.stderr)
        return 1

    try:
        if column_exists(conn, "annotations", "difficulty"):
            print("difficulty column already exists")
            return 0

        conn.execute(
            "ALTER TABLE annotations ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'default'"
        )
        conn.commit()
        print("difficulty column added")
        return 0
    except sqlite3.Error as exc:
        print(f"Failed to alter table: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
