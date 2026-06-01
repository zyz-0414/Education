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
- 完成第 3 周数据库和导入：补齐 Prisma 初始迁移，新增 `major` 模型、`data:validate` 和 `data:import` 命令，导入脚本按来源、政策、院校、专业、一分一段、专业组、招生计划、投档结果顺序写入 PostgreSQL。
- 新增院校专业组基础查询 API：`GET /api/college-groups` 和 `GET /api/college-groups/{year}/{subjectTrack}/{collegeCode}/{groupCode}`，返回专业组、计划、投档结果和来源追溯信息。
- 完成第 4 周用户建档和规则过滤：新增建档工作台、`POST /api/candidate-groups`、选科组合校验、分数位次校验、普通本科批过滤和选科不符过滤。
- 新增 `docs/week4-profile-filtering.md` 和 `npm run test:week4`，记录候选集接口与核心规则烟测。

## 2026-06-01

- 按第 0-4 周范围收口项目状态：`npm run check`、`npm run data:check`、`npm run data:validate`、`npm run test:week4` 均已通过。
- 新增 `npm run verify:week4`，用于一次性执行 lint、Prisma schema 校验、CSV 表头校验、CSV 完整性校验和第 4 周规则测试。
- 确认本机当前没有 `docker`、`psql` 和 `localhost:5432` PostgreSQL 服务，`npm run db:migrate` 因数据库未启动而失败。
- 新增 `docs/week4-local-database-setup.md`，记录 Windows 下使用 Docker Desktop 或原生 PostgreSQL 完成迁移、导入和候选集接口验证的步骤。
- 用户安装 PostgreSQL 18.4 后，确认服务 `postgresql-x64-18` 正常运行，`localhost:5432` 可连接。
- 使用 `E:\PostqreSQL\bin\createdb.exe` 创建 `gaokao_volunteer_assistant`，并成功执行 `npm run db:migrate`、`npm run data:import`、`npm run verify:week4`。
- 启动本地开发服务后，用真实数据库验证 `POST /api/candidate-groups`：2025 物理类 550 分、70000 位次样例校验通过并返回候选集。
- 完成第 5 周推荐算法：新增位次模型保守修正、冲稳保分档、偏好评分、推荐排序和低置信度标记。
- 新增 `POST /api/recommendations`，返回安徽普通本科批推荐列表及结构化推荐说明。
- 新增 `docs/week5-recommendation-algorithm.md`、`npm run test:week5` 和 `npm run verify:week5`。
- 第 5 周审查时将内部候选池放宽到 5000 条，避免正式数据量变大后推荐排序被候选预取上限截断。
