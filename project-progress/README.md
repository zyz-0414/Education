# 安徽高考志愿助手工程进度记录

更新时间：2026-06-01

## 当前项目位置

- 项目根目录：`D:\education\gaokao-volunteer-assistant`
- 本地访问地址：`http://localhost:3000`
- 双击启动入口：`D:\education\start-gaokao-assistant.bat`
- 数据库自动启动：优先启动本机 PostgreSQL 服务 `postgresql*`，找不到服务时再尝试 Docker Desktop。

## 前五周验收结论

第 0-5 周任务已全部完成并通过本机验证。

- `npm run verify:week5` 已通过，覆盖 lint、Prisma schema、CSV 表头、CSV 完整性、第 4 周规则烟测和第 5 周推荐算法测试。
- PostgreSQL 18.4 服务已启动，`localhost:5432` 可连接。
- 数据库 `gaokao_volunteer_assistant` 已创建，迁移和数据导入已完成。
- `POST /api/candidate-groups` 已用真实数据库验证成功。
- `POST /api/recommendations` 已实现，可生成安徽普通本科批推荐列表。
- 当前页面可以在 `http://localhost:3000` 完成安徽考生建档、分数位次校验和规则候选集查询。

## 2026-06-01 启动与上传更新

- 已新增根目录双击启动文件：`D:\education\start-gaokao-assistant.bat`。
- 启动文件已支持关机重启后的数据库自动恢复：
  - 优先检查 `localhost:5432`；
  - 如果 PostgreSQL 未运行，自动尝试启动本机 Windows 服务 `postgresql*`；
  - 如果本机服务不存在，再尝试 Docker Desktop；
  - 数据库可用后自动执行 Prisma 迁移检查；
  - 数据库为空或关键表缺失时，自动导入 cleaned CSV。
- 已新增数据库保障脚本：`D:\education\gaokao-volunteer-assistant\data\scripts\ensure_local_database.ts`。
- 已新增 npm 命令：`npm run db:ensure-local`。
- 启动文件已实测通过：能识别 PostgreSQL、确认迁移、确认数据，并打开 `http://localhost:3000`。
- 项目准备上传到 GitHub 仓库：`https://github.com/zyz-0414/Education.git`。

## 已完成任务

### 第 0 周：项目准备

- 已确定第一版只做安徽普通类本科批。
- 已初始化 Next.js、React、TypeScript、Tailwind CSS 项目。
- 已建立 `docs/`、`data/`、`prisma/`、`src/lib/` 等基础目录。
- 已写入 README、技术栈说明、项目计划、数据清单。

### 第 1-2 周：安徽数据整理

- 已采集并留存 2024、2025 安徽一分一段官方 PDF。
- 已采集并留存 2024、2025 安徽普通本科批投档官方长图。
- 已整理 2025 招生计划样例。
- 已生成首批 cleaned CSV：
  - `score_segments.csv`
  - `admission_results.csv`
  - `college_groups.csv`
  - `enrollment_plans.csv`
  - `colleges.csv`
  - `majors.csv`
  - `source_index.csv`

### 第 3 周：数据库和导入

- 已设计 Prisma schema。
- 已补齐 PostgreSQL 迁移文件。
- 已实现数据导入脚本。
- 已实现 CSV 完整性校验。
- 已在本机 PostgreSQL 18.4 完成数据库创建、迁移和数据导入。
- 已实现院校专业组基础查询 API：
  - `GET /api/college-groups`
  - `GET /api/college-groups/{year}/{subjectTrack}/{collegeCode}/{groupCode}`

### 第 4 周：用户建档和规则过滤

- 已将首页改为安徽考生建档工作台。
- 已实现安徽普通本科批输入表单。
- 已实现首选科目和再选科目校验。
- 已实现分数/位次一分一段校验。
- 已实现普通本科批候选集查询。
- 已实现选科不符过滤。
- 已实现候选集 API：
  - `POST /api/candidate-groups`
- 已用真实数据库验证候选集 API：默认物理类样例返回候选集成功。
- 已新增规则烟测：
  - `npm run test:week4`

### 第 5 周：推荐算法

- 已实现参考位次模型：
  - 最近两年最低位次加权；
  - 招生计划变化修正；
  - 位次波动保守修正。
- 已实现冲、稳、保、过保、高危分档。
- 已实现风险偏好、城市偏好、专业偏好、排斥方向、学费预算和计划明细偏好评分。
- 已实现推荐排序。
- 已实现低置信度标记和原因输出。
- 已新增推荐接口：
  - `POST /api/recommendations`
- 已新增第 5 周说明和测试：
  - `docs/week5-recommendation-algorithm.md`
  - `npm run test:week5`
  - `npm run verify:week5`

## 后续限制和待办

### 本机环境说明

- 当前机器已安装 PostgreSQL 18.4，服务名为 `postgresql-x64-18`，`localhost:5432` 已可连接。
- 双击启动脚本已支持自动启动本机 PostgreSQL 服务；关机重启后通常直接双击 `start-gaokao-assistant.bat` 即可。
- `psql.exe` 位于 `E:\PostqreSQL\bin\psql.exe`，但该目录暂未加入 PATH，所以直接运行 `psql --version` 仍会提示找不到命令。
- 当前机器仍没有可用的 `docker` 命令；本项目本地开发已改用原生 PostgreSQL。
- 已补充 Windows 本地数据库安装和导入说明：`D:\education\gaokao-volunteer-assistant\docs\week4-local-database-setup.md`。
- 已新增前四周综合校验命令：`npm run verify:week4`。

### 数据质量限制

- 投档结果目前是 OCR 首批样例，不是完整人工复核版。
- 招生计划目前只有 2025 年样例数据，不是 2026 正式计划。
- 招生章程风险规则目前还没有结构化导入。

这些是第一版后续数据增强事项，不阻塞第 0-4 周验收。

### 第 5 周之后功能

- 第 6 周推荐结果页还没完成。
- 第 7 周志愿表编辑器还没完成。
- 第 8 周风险检测和报告还没完成。
- 第 9 周响应式最终适配、部署和公开演示说明还没完成。

## 下一步建议

1. 如需命令行直接使用 `psql`，把 `E:\PostqreSQL\bin` 加入系统 PATH。
2. 第 0-5 周已经闭环；后续再进入第 6 周：推荐结果页、风险标签、推荐理由展示和院校专业组详情入口。

> 当前只收口第 0-5 周时，第 6 周不需要进入。

## 常用命令

```bash
cd D:\education\gaokao-volunteer-assistant
npm run dev
npm run check
npm run test:week4
npm run verify:week4
npm run test:week5
npm run verify:week5
npm run data:validate
npm run data:import
```
