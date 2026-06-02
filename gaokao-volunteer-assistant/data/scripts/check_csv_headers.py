from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED_HEADERS = {
    "cleaned/anhui/score_segments.csv": [
        "year",
        "province_code",
        "subject_track",
        "score",
        "count",
        "cumulative_count",
        "rank_min",
        "rank_max",
        "source_id",
    ],
    "cleaned/anhui/admission_results.csv": [
        "year",
        "province_code",
        "batch_code",
        "subject_track",
        "college_code",
        "group_code",
        "major_code",
        "min_score",
        "min_rank",
        "avg_score",
        "avg_rank",
        "max_score",
        "max_rank",
        "admitted_count",
        "source_id",
    ],
    "cleaned/anhui/enrollment_plans.csv": [
        "year",
        "province_code",
        "batch_code",
        "subject_track",
        "college_code",
        "group_code",
        "major_code",
        "major_name",
        "subject_requirement",
        "plan_count",
        "tuition",
        "duration",
        "campus",
        "note",
        "source_id",
    ],
    "cleaned/anhui/college_groups.csv": [
        "year",
        "province_code",
        "batch_code",
        "subject_track",
        "college_code",
        "group_code",
        "college_name",
        "subject_requirement",
        "group_note",
        "source_id",
    ],
    "cleaned/anhui/colleges.csv": [
        "college_code",
        "college_name",
        "province",
        "city",
        "level",
        "ownership",
        "tags",
        "official_site",
        "source_id",
    ],
    "cleaned/anhui/majors.csv": [
        "major_code",
        "major_name",
        "major_category",
        "degree_category",
        "duration",
        "notes",
        "source_id",
    ],
    "sources/source_index.csv": [
        "source_id",
        "title",
        "source_url",
        "publisher",
        "published_at",
        "fetched_at",
        "file_hash",
        "parser_version",
        "review_status",
        "notes",
    ],
}


def read_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file)
        return next(reader)


def main() -> None:
    failures: list[str] = []

    for relative_path, expected in EXPECTED_HEADERS.items():
        path = ROOT / relative_path
        if not path.exists():
            failures.append(f"{relative_path}: missing file")
            continue

        actual = read_header(path)
        if actual != expected:
            failures.append(f"{relative_path}: header mismatch\nexpected={expected}\nactual={actual}")

    if failures:
        raise SystemExit("\n".join(failures))

    print("CSV headers OK")


if __name__ == "__main__":
    main()
