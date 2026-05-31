# 开发日志

## 2026-05-30

- 根据本地调研文档确定第一版范围：安徽普通类本科批响应式 Web MVP。
- 初始化 Next.js、TypeScript、Tailwind CSS 项目。
- 安装 Prisma 6.19.3、Zod、lucide-react、clsx、tailwind-merge。
- 建立 `docs/`、`data/`、`prisma/`、`src/lib/` 和 `tests/` 基础目录。
- 新增 Prisma schema 草案、CSV 模板、数据采集清单和首页准备面板。
- npm audit 仍显示 Next 内置 PostCSS 依赖链存在中等漏洞，当前修复建议会破坏性降级 Next，暂记录不强制处理。
- 完成第 1-2 周首批数据整理：采集 2024、2025 安徽一分一段官方 PDF，采集 2024、2025 普通本科批投档官方长图，采集 2025 招生计划样例页面。
- 新增 `data/scripts/prepare_week1_2_data.py`，生成完整 `score_segments.csv`、首批 OCR `admission_results.csv`、`college_groups.csv`、`enrollment_plans.csv`、`colleges.csv`、`majors.csv` 和具体来源索引。
- 根据安徽数据特点，将 `subject_track` 纳入院校专业组、招生计划和投档结果的数据键，避免历史/物理科目组合复用专业组号导致冲突。
