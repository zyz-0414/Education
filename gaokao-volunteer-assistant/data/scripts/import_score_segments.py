from __future__ import annotations

import argparse
import csv
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate Anhui score segment CSV before database import.")
    parser.add_argument("csv_file", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with args.csv_file.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    missing_rank = [row for row in rows if not row.get("rank_min") and not row.get("rank_max")]
    print(f"loaded={len(rows)} missing_rank_interval={len(missing_rank)}")


if __name__ == "__main__":
    main()
