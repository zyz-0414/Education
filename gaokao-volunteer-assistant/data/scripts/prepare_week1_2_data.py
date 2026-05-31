from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import statistics
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

import pandas as pd
from PIL import Image
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "anhui"
CLEANED = ROOT / "data" / "cleaned" / "anhui"
SOURCES = ROOT / "data" / "sources" / "source_index.csv"
OCR_CACHE = ROOT / "tmp" / "ocr"

PROVINCE_CODE = "AH"
BATCH_CODE = "ordinary_undergraduate"
PARSER_VERSION = "week1_2_data_v1"


@dataclass(frozen=True)
class AdmissionOcrJob:
    year: int
    subject_track: str
    source_id: str
    image: Path
    crop_height: int = 1000


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_files(paths: Iterable[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(path.name.encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def official_admission_images(year: int, subject_track: str) -> list[Path]:
    pattern = f"admission_ordinary_undergraduate_{subject_track}_{year}_*.jpg"
    return [
        path
        for path in (RAW / str(year)).glob(pattern)
        if re.search(r"_\d{2}\.jpg$", path.name)
    ]


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def normalize_subject_track(text: str) -> str:
    if "物理" in text:
        return "physics"
    if "历史" in text:
        return "history"
    raise ValueError(f"unknown subject track: {text}")


def parse_group_text(group_text: str) -> tuple[str, str]:
    group_match = re.search(r"(\d{3})\s*专业组", group_text)
    group_code = group_match.group(1) if group_match else group_text[:3]

    requirements = re.findall(r"（([^（）]+)）", group_text)
    subject_requirement = requirements[0] if requirements else ""
    subject_requirement = subject_requirement.replace("+", " + ")
    return group_code, subject_requirement


def parse_int(text: str) -> int | None:
    cleaned = re.sub(r"[^\d]", "", str(text))
    return int(cleaned) if cleaned else None


def extract_score_segments(pdf_path: Path, year: int, source_id: str) -> list[dict[str, object]]:
    reader = PdfReader(str(pdf_path))
    if reader.is_encrypted:
        reader.decrypt("")

    rows: list[dict[str, object]] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        subject_line = next((line for line in lines if line.startswith("科类：")), "")
        subject_track = normalize_subject_track(subject_line)

        for line in lines:
            if not re.match(r"^\d{2,3}(及以上)?\s+\d+\s+\d+", line):
                continue

            tokens = line.split()
            for index in range(0, len(tokens), 3):
                triple = tokens[index : index + 3]
                if len(triple) != 3:
                    continue

                score_text, count_text, cumulative_text = triple
                score = parse_int(score_text)
                count = parse_int(count_text)
                cumulative = parse_int(cumulative_text)
                if score is None or count is None or cumulative is None:
                    continue

                rows.append(
                    {
                        "year": year,
                        "province_code": PROVINCE_CODE,
                        "subject_track": subject_track,
                        "score": score,
                        "count": count,
                        "cumulative_count": cumulative,
                        "rank_min": cumulative - count + 1,
                        "rank_max": cumulative,
                        "source_id": source_id,
                    }
                )

    rows.sort(key=lambda item: (item["year"], item["subject_track"], -int(item["score"])))
    return rows


def cell_center(box: list[list[float]]) -> tuple[float, float]:
    x = sum(point[0] for point in box) / 4
    y = sum(point[1] for point in box) / 4
    return x, y


def run_ocr(job: AdmissionOcrJob) -> list[list[object]]:
    from rapidocr_onnxruntime import RapidOCR

    OCR_CACHE.mkdir(parents=True, exist_ok=True)
    cache_path = OCR_CACHE / f"{job.image.stem}_top{job.crop_height}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    image = Image.open(job.image)
    crop = image.crop((0, 0, image.width, min(job.crop_height, image.height)))
    crop_path = OCR_CACHE / f"{job.image.stem}_top{job.crop_height}.jpg"
    crop.save(crop_path)

    ocr = RapidOCR()
    result, _elapsed = ocr(str(crop_path), use_cls=False)
    serializable = result or []
    cache_path.write_text(json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8")
    return serializable


def parse_admission_ocr(job: AdmissionOcrJob) -> list[dict[str, object]]:
    ocr_result = run_ocr(job)
    items: list[tuple[float, float, str, float]] = []
    for box, text, confidence in ocr_result:
        x, y = cell_center(box)
        if y < 130 or confidence < 0.6:
            continue
        items.append((x, y, str(text), float(confidence)))

    items.sort(key=lambda item: item[1])
    clusters: list[dict[str, object]] = []
    for item in items:
        _, y, _, _ = item
        if not clusters or abs(y - float(clusters[-1]["y"])) > 8:
            clusters.append({"y": y, "items": [item]})
            continue

        row_items = clusters[-1]["items"]
        assert isinstance(row_items, list)
        row_items.append(item)
        clusters[-1]["y"] = statistics.mean(row_item[1] for row_item in row_items)

    rows: list[dict[str, object]] = []
    for cluster in clusters:
        row_items = sorted(cluster["items"], key=lambda item: item[0])

        def column_text(left: int, right: int) -> str:
            return "".join(text for x, _y, text, _conf in row_items if left <= x < right).strip()

        college_code = column_text(0, 80)
        college_name = column_text(60, 285)
        subject_text = column_text(285, 380)
        group_text = column_text(380, 675)
        count_text = column_text(675, 725)
        score_text = column_text(725, 770)
        rank_text = column_text(765, 840)

        if not re.fullmatch(r"\d{4}", college_code):
            merged_match = re.match(r"^(\d{4})(.+)$", college_code)
            if not merged_match:
                merged_match = re.match(r"^(\d{4})(.+)$", college_name)
            if not merged_match:
                continue
            college_code = merged_match.group(1)
            college_name = merged_match.group(2)
        if "专业组" not in group_text:
            continue

        group_code, subject_requirement = parse_group_text(group_text)
        rows.append(
            {
                "year": job.year,
                "province_code": PROVINCE_CODE,
                "batch_code": BATCH_CODE,
                "subject_track": job.subject_track,
                "college_code": college_code,
                "college_name": college_name,
                "group_code": group_code,
                "major_code": "",
                "min_score": parse_int(score_text) or "",
                "min_rank": parse_int(rank_text) or "",
                "avg_score": "",
                "avg_rank": "",
                "max_score": "",
                "max_rank": "",
                "admitted_count": parse_int(count_text) or "",
                "subject_requirement": subject_requirement,
                "group_note": f"{group_text}; OCR sample from {job.image.name}, top {job.crop_height}px",
                "source_id": job.source_id,
            }
        )

    return rows


def extract_enrollment_plan_sample(path: Path) -> tuple[list[dict[str, object]], list[dict[str, object]], list[dict[str, object]]]:
    table = pd.read_html(path)[0]
    table.columns = [str(value).replace("\n", "").strip() for value in table.iloc[0].tolist()]
    table = table.iloc[1:].copy()

    plan_rows: list[dict[str, object]] = []
    college_rows = [
        {
            "college_code": "2297",
            "college_name": "陕西国际商贸学院",
            "province": "陕西",
            "city": "西安",
            "level": "本科",
            "ownership": "民办",
            "tags": json.dumps(["普通本科"], ensure_ascii=False),
            "official_site": "https://zs.csiic.com/",
            "source_id": "src_csiic_2025_anhui_plan_sample",
        }
    ]
    major_rows: list[dict[str, object]] = []

    for _index, item in table.iterrows():
        group_text = str(item["专业组"]).strip()
        group_code, subject_requirement = parse_group_text(group_text)
        subject_track = normalize_subject_track(str(item["科类"]))
        major_code = str(item["省编专业代号"]).zfill(2)
        major_name = str(item["专业名称"]).strip()
        duration = str(item["学制"]).strip()

        plan_rows.append(
            {
                "year": 2025,
                "province_code": PROVINCE_CODE,
                "batch_code": BATCH_CODE,
                "subject_track": subject_track,
                "college_code": "2297",
                "group_code": group_code,
                "major_code": major_code,
                "major_name": major_name,
                "subject_requirement": subject_requirement,
                "plan_count": parse_int(str(item["计划数"])) or "",
                "tuition": parse_int(str(item[[col for col in table.columns if "学费" in col][0]])) or "",
                "duration": duration,
                "campus": "",
                "note": f"{group_text}; 招生计划样例，2026正式计划发布后替换正式推荐依据",
                "source_id": "src_csiic_2025_anhui_plan_sample",
            }
        )

        major_rows.append(
            {
                "major_code": major_code,
                "major_name": major_name,
                "major_category": "",
                "degree_category": "本科",
                "duration": duration,
                "notes": "来自陕西国际商贸学院2025在皖招生计划样例，省编专业代号非国标专业代码",
                "source_id": "src_csiic_2025_anhui_plan_sample",
            }
        )

    return plan_rows, college_rows, major_rows


def build_source_index() -> list[dict[str, object]]:
    fetched_at = date.today().isoformat()
    rows = [
        {
            "source_id": "src_ah_exam",
            "title": "安徽省教育招生考试院",
            "source_url": "https://www.ahzsks.cn/",
            "publisher": "安徽省教育招生考试院",
            "published_at": "",
            "fetched_at": fetched_at,
            "file_hash": "",
            "parser_version": "",
            "review_status": "planned",
            "notes": "官方考试院入口",
        },
        {
            "source_id": "src_ah_service",
            "title": "安徽省普通高校招生考生服务平台",
            "source_url": "https://xgk.ahzsks.cn/",
            "publisher": "安徽省教育招生考试院",
            "published_at": "",
            "fetched_at": fetched_at,
            "file_hash": "",
            "parser_version": "",
            "review_status": "planned",
            "notes": "志愿填报服务平台入口",
        },
        {
            "source_id": "src_chsi",
            "title": "阳光高考平台",
            "source_url": "https://gaokao.chsi.com.cn/",
            "publisher": "教育部阳光高考",
            "published_at": "",
            "fetched_at": fetched_at,
            "file_hash": "",
            "parser_version": "",
            "review_status": "planned",
            "notes": "招生计划和章程参考入口",
        },
        {
            "source_id": "src_ah_2024_score_segments",
            "title": "安徽省2024年普通高等学校招生统一考试考生成绩分档表（含加分）",
            "source_url": "https://www.ahzsks.cn/ggl/7625.htm",
            "publisher": "安徽省教育招生考试院",
            "published_at": "2024-06-25",
            "fetched_at": fetched_at,
            "file_hash": sha256_file(RAW / "2024" / "score_segments_2024_official.pdf"),
            "parser_version": PARSER_VERSION,
            "review_status": "collected",
            "notes": "官方PDF；页面跳转到 https://www.ahzsks.cn/an-hui-sheng-2024-kskscjfdb.pdf",
        },
        {
            "source_id": "src_ah_2025_score_segments",
            "title": "安徽省2025年普通高等学校招生统一考试考生成绩分档表（含加分）",
            "source_url": "https://www.ahzsks.cn/ggl/8359.htm",
            "publisher": "安徽省教育招生考试院",
            "published_at": "2025-06-25",
            "fetched_at": fetched_at,
            "file_hash": sha256_file(RAW / "2025" / "score_segments_2025_official.pdf"),
            "parser_version": PARSER_VERSION,
            "review_status": "collected",
            "notes": "官方PDF；清洗为历史/物理两个科目轨道",
        },
        {
            "source_id": "src_ah_2024_admission_physics",
            "title": "安徽省2024年普通高校招生普通本科批院校投档分数及名次（物理科目组合）",
            "source_url": "https://www.ahzsks.cn/ggl/7730.htm",
            "publisher": "安徽省教育招生考试院",
            "published_at": "2024-07-26",
            "fetched_at": fetched_at,
            "file_hash": sha256_files(official_admission_images(2024, "physics")),
            "parser_version": PARSER_VERSION,
            "review_status": "ocr_sample_needs_review",
            "notes": "官方长图已完整留存；cleaned CSV 先抽取首图顶部样例行",
        },
        {
            "source_id": "src_ah_2024_admission_history",
            "title": "安徽省2024年普通高校招生普通本科批院校投档分数及名次（历史科目组合）",
            "source_url": "https://www.ahzsks.cn/ggl/7729.htm",
            "publisher": "安徽省教育招生考试院",
            "published_at": "2024-07-26",
            "fetched_at": fetched_at,
            "file_hash": sha256_files(official_admission_images(2024, "history")),
            "parser_version": PARSER_VERSION,
            "review_status": "ocr_sample_needs_review",
            "notes": "官方长图已完整留存；cleaned CSV 先抽取首图顶部样例行",
        },
        {
            "source_id": "src_ah_2025_admission_physics",
            "title": "安徽省2025年普通高校招生普通本科批院校投档最低分及名次（物理科目组合）",
            "source_url": "https://www.ahzsks.cn/ggl/8467.htm",
            "publisher": "安徽省教育招生考试院",
            "published_at": "2025-07-24",
            "fetched_at": fetched_at,
            "file_hash": sha256_files(official_admission_images(2025, "physics")),
            "parser_version": PARSER_VERSION,
            "review_status": "ocr_sample_needs_review",
            "notes": "官方长图已完整留存；cleaned CSV 先抽取首图顶部样例行",
        },
        {
            "source_id": "src_ah_2025_admission_history",
            "title": "安徽省2025年普通高校招生普通本科批院校投档最低分及名次（历史科目组合）",
            "source_url": "https://www.ahzsks.cn/ggl/8466.htm",
            "publisher": "安徽省教育招生考试院",
            "published_at": "2025-07-24",
            "fetched_at": fetched_at,
            "file_hash": sha256_files(official_admission_images(2025, "history")),
            "parser_version": PARSER_VERSION,
            "review_status": "ocr_sample_needs_review",
            "notes": "官方长图已完整留存；cleaned CSV 先抽取首图顶部样例行",
        },
        {
            "source_id": "src_csiic_2025_anhui_plan_sample",
            "title": "陕西国际商贸学院安徽省2025年本科招生专业计划一览表",
            "source_url": "https://zs.csiic.com/2025/0612/c3234a118682/page.htm",
            "publisher": "陕西国际商贸学院招生就业处",
            "published_at": "2025-06-12",
            "fetched_at": fetched_at,
            "file_hash": sha256_file(RAW / "2025" / "enrollment_plan_sample_shaanxi_guoji_shangmao_2025_anhui_page.htm"),
            "parser_version": PARSER_VERSION,
            "review_status": "sample_collected",
            "notes": "2025招生计划样例；用于开发期演示，不作为2026正式推荐依据",
        },
    ]
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Build week 1-2 Anhui cleaned CSV files from collected official sources.")
    parser.add_argument("--skip-ocr", action="store_true", help="Skip admission image OCR and only build PDF/HTML-derived CSV files.")
    args = parser.parse_args()

    score_rows = []
    score_rows.extend(extract_score_segments(RAW / "2024" / "score_segments_2024_official.pdf", 2024, "src_ah_2024_score_segments"))
    score_rows.extend(extract_score_segments(RAW / "2025" / "score_segments_2025_official.pdf", 2025, "src_ah_2025_score_segments"))

    plan_rows, college_rows, major_rows = extract_enrollment_plan_sample(
        RAW / "2025" / "enrollment_plan_sample_shaanxi_guoji_shangmao_2025_anhui_page.htm"
    )

    admission_rows: list[dict[str, object]] = []
    if not args.skip_ocr:
        jobs = [
            AdmissionOcrJob(2024, "physics", "src_ah_2024_admission_physics", RAW / "2024" / "admission_ordinary_undergraduate_physics_2024_01.jpg"),
            AdmissionOcrJob(2024, "history", "src_ah_2024_admission_history", RAW / "2024" / "admission_ordinary_undergraduate_history_2024_01.jpg"),
            AdmissionOcrJob(2025, "physics", "src_ah_2025_admission_physics", RAW / "2025" / "admission_ordinary_undergraduate_physics_2025_01.jpg"),
            AdmissionOcrJob(2025, "history", "src_ah_2025_admission_history", RAW / "2025" / "admission_ordinary_undergraduate_history_2025_01.jpg"),
        ]
        for job in jobs:
            admission_rows.extend(parse_admission_ocr(job))

    college_by_code = {row["college_code"]: row for row in college_rows}
    for row in admission_rows:
        college_by_code.setdefault(
            row["college_code"],
            {
                "college_code": row["college_code"],
                "college_name": row["college_name"],
                "province": "",
                "city": "",
                "level": "本科",
                "ownership": "",
                "tags": json.dumps(["普通本科批投档样例"], ensure_ascii=False),
                "official_site": "",
                "source_id": row["source_id"],
            },
        )

    group_by_key: dict[tuple[object, ...], dict[str, object]] = {}
    for row in admission_rows:
        key = (row["year"], row["province_code"], row["batch_code"], row["subject_track"], row["college_code"], row["group_code"])
        group_by_key[key] = {
            "year": row["year"],
            "province_code": row["province_code"],
            "batch_code": row["batch_code"],
            "subject_track": row["subject_track"],
            "college_code": row["college_code"],
            "group_code": row["group_code"],
            "subject_requirement": row["subject_requirement"],
            "group_note": row["group_note"],
            "source_id": row["source_id"],
        }

    for row in plan_rows:
        key = (row["year"], row["province_code"], row["batch_code"], row["subject_track"], row["college_code"], row["group_code"])
        group_by_key[key] = {
            "year": row["year"],
            "province_code": row["province_code"],
            "batch_code": row["batch_code"],
            "subject_track": row["subject_track"],
            "college_code": row["college_code"],
            "group_code": row["group_code"],
            "subject_requirement": row["subject_requirement"],
            "group_note": "来自招生计划样例",
            "source_id": row["source_id"],
        }

    write_csv(
        CLEANED / "score_segments.csv",
        ["year", "province_code", "subject_track", "score", "count", "cumulative_count", "rank_min", "rank_max", "source_id"],
        score_rows,
    )
    write_csv(
        CLEANED / "admission_results.csv",
        [
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
        admission_rows,
    )
    write_csv(
        CLEANED / "college_groups.csv",
        ["year", "province_code", "batch_code", "subject_track", "college_code", "group_code", "subject_requirement", "group_note", "source_id"],
        list(group_by_key.values()),
    )
    write_csv(
        CLEANED / "enrollment_plans.csv",
        [
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
        plan_rows,
    )
    write_csv(
        CLEANED / "colleges.csv",
        ["college_code", "college_name", "province", "city", "level", "ownership", "tags", "official_site", "source_id"],
        list(college_by_code.values()),
    )
    write_csv(
        CLEANED / "majors.csv",
        ["major_code", "major_name", "major_category", "degree_category", "duration", "notes", "source_id"],
        major_rows,
    )
    write_csv(
        SOURCES,
        ["source_id", "title", "source_url", "publisher", "published_at", "fetched_at", "file_hash", "parser_version", "review_status", "notes"],
        build_source_index(),
    )

    print(
        "built "
        f"score_segments={len(score_rows)} "
        f"admission_results={len(admission_rows)} "
        f"college_groups={len(group_by_key)} "
        f"enrollment_plans={len(plan_rows)} "
        f"colleges={len(college_by_code)}"
    )


if __name__ == "__main__":
    main()
