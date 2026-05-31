# 数据目录说明

## 目录

```text
raw/anhui/{year}/      原始文件，保留官方文件或下载结果
cleaned/anhui/         清洗后的统一 CSV
sources/               来源索引
scripts/               数据导入、校验和清洗脚本
```

## 规则

1. 原始文件不得覆盖，更新时新增版本。
2. 每份 cleaned CSV 必须能追溯到 `sources/source_index.csv` 的 `source_id`。
3. 清洗脚本只做结构化转换，不补造不存在的数据。
4. 2024、2025 改革后数据优先进入第一版模型。
5. 2026 当年数据发布后再切换为正式推荐依据。

## 第 1-2 周数据命令

```bash
python -m pip install -r data/requirements.txt
npm run data:prepare
npm run data:check
```

`prepare_week1_2_data.py` 会从已留存的官方 PDF、官方投档长图和招生计划样例页面生成 cleaned CSV。投档长图当前只做首批 OCR 样例抽取，完整 OCR 与人工复核需后续继续推进。
OCR 过程会在 `tmp/ocr/` 生成缓存文件，该目录不属于可追溯原始数据。
