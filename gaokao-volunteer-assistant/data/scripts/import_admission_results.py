from __future__ import annotations

import argparse
import csv
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate Anhui admission result CSV before database import.")
    parser.add_argument("csv_file", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with args.csv_file.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    missing_group = [
        row
        for row in rows
        if not row.get("subject_track") or not row.get("college_code") or not row.get("group_code")
    ]
    print(f"loaded={len(rows)} missing_group_key={len(missing_group)}")


if __name__ == "__main__":
    main()
