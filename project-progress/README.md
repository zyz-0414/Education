# 安徽高考志愿助手工程进度记录

更新时间：2026-06-02

## 当前项目位置

- 项目根目录：`D:\education\gaokao-volunteer-assistant`
- 本地访问地址：`http://localhost:3000`
- 双击启动入口：`D:\education\start-gaokao-assistant.bat`
- 数据库自动启动：优先启动本机 PostgreSQL 服务 `postgresql*`，找不到服务时再尝试 Docker Desktop。

## 前七周验收结论

第 0-7 周任务已全部完成并通过本机验证。

- `npm run verify:week7` 已通过，覆盖 lint、Prisma schema、CSV 表头、CSV 完整性、第 4 周规则烟测、第 5 周推荐算法测试、第 6 周数据守卫测试、第 6 周生产构建和第 7 周志愿表规则测试。
- PostgreSQL 18.4 服务已启动，`localhost:5432` 可连接。
- 数据库 `gaokao_volunteer_assistant` 已创建，迁移和数据导入已完成。
- `POST /api/candidate-groups` 已用真实数据库验证成功。
- `POST /api/recommendations` 已实现，可生成安徽普通本科批推荐列表。
- 当前页面可以在 `http://localhost:3000` 完成安徽考生建档、分数位次校验、推荐生成、桌面表格/手机卡片展示、风险标签查看、院校专业组详情查看、志愿表编辑和本地方案保存。
- 已完成第 6 周数据一致性审计：确认 22 个院校代码存在跨年名称复用、30 组历史匹配键存在跨年混用风险，推荐展示、搜索和历史匹配均已改用当年院校名称快照隔离。
- `550` 分、`70000` 位次样例在默认推荐、正式推荐和调试但隐藏高危项模式下均不会返回北京大学；显式打开高危项时，北京大学只会以 `high_risk` 出现。

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

## 2026-06-02 第六周数据审计与上传收口

- 已再次执行 `npm run verify:week6`，覆盖 lint、Prisma schema、CSV 表头、CSV 完整性、第 4 周规则测试、第 5 周推荐算法测试、第 6 周数据守卫测试和生产构建。
- 已重新执行 `npm run data:import`，本地 PostgreSQL 数据库与最新 cleaned CSV 保持一致。
- 已新增第 6 周数据一致性审计文档：`D:\education\gaokao-volunteer-assistant\docs\week6-data-audit.md`。
- 已修复 OCR 名称脏值：`1034` 物理组由 `4北京第二外国语学院` 修正为 `北京第二外国语学院`。
- 已将专业组搜索从全局院校主表名称切换为当年专业组名称快照，避免搜索“北京大学”带出 2025 年 `1029` 北华大学。
- 已将推荐历史匹配加入院校名称快照隔离，避免跨年代码复用时把不同院校的历史位次混入同一推荐依据。
- 已将“显示高危项”改为默认关闭，API 默认也不返回高危项，避免把位次差距过大的院校误呈现为可用推荐。
- 本次第 0-6 周收口提交将推送到 GitHub 仓库：`https://github.com/zyz-0414/Education.git`。

## 2026-06-02 第七周志愿表编辑器

- 已完成第 7 周志愿表编辑器：
  - 推荐项加入志愿表；
  - 重复加入拦截；
  - 删除志愿；
  - 上移/下移排序；
  - 45 个院校专业组上限；
  - 冲、稳、保、过保比例提示；
  - 保底不足、高危项进入方案等提示；
  - 浏览器本地保存和刷新恢复。
- 已新增第 7 周规则模块和测试：
  - `src/lib/volunteer-plan.ts`
  - `tests/week7-volunteer-plan.ts`
  - `npm run test:week7`
  - `npm run verify:week7`
- 已新增第 7 周说明文档：`D:\education\gaokao-volunteer-assistant\docs\week7-volunteer-plan-editor.md`。

## 2026-06-02 数据增强与推荐数量修复

- 已接入用户放置在 `D:\education\data` 下的安徽近年 Excel 数据。
- 已新增收集版清洗脚本：`D:\education\gaokao-volunteer-assistant\data\scripts\prepare_collected_anhui_data.py`。
- `npm run data:prepare` 当前默认生成 2024-2025 专业组口径 cleaned CSV；旧首批样例/OCR 脚本保留为 `npm run data:prepare:legacy`。
- 已覆盖旧样例计划数据，当前 cleaned CSV 规模为：
  - `college_groups.csv`：9,507 行；
  - `enrollment_plans.csv`：47,401 行；
  - `admission_results.csv`：8,723 行；
  - `colleges.csv`：1,710 行；
  - `majors.csv`：20,455 行；
  - `score_segments.csv`：1,934 行。
- 已新增 `npm run test:data` 和 `npm run verify:data`，用于检查全量数据规模、来源索引和选科要求清洗质量。
- 已将 `data:import` 改为批量替换型导入，解决全量计划逐行 upsert 超时；本机重新导入 PostgreSQL 成功，耗时约 11 秒。
- 默认物理样例（2025、550 分、70000 位、化学+生物）在 `requirePlan=true` 下可推荐结果已由 2 条提升到 294 条。
- 本轮只采用 2024-2025 新高考专业组口径；2017-2023 旧文理科/院校专业口径暂不混入推荐模型。

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

### 第 6 周：推荐结果页

- 已将首页工作台接入 `POST /api/recommendations`。
- 已实现电脑端推荐表格：
  - 分档；
  - 院校专业组；
  - 参考位次和位次差；
  - 招生计划和历史最低位次；
  - 风险标签；
  - 推荐理由。
- 已实现手机端推荐卡片。
- 已实现风险标签展示：
  - 高危；
  - 低置信度；
  - 计划待补；
  - 学费风险；
  - 排斥方向；
  - OCR 待复核。
- 已实现院校专业组详情面板和数据详情入口。
- 已修复不同年份院校代码复用导致的名称误配问题：推荐展示优先使用当年院校专业组名称快照。
- 推荐默认只使用有计划明细的专业组；OCR 历史样例只作为数据排查入口。
- 已完成全量数据一致性审计，并新增代码复用、名称快照、OCR 脏值和专业组引用守卫。
- 已将高危项默认隐藏；只有用户手动打开时才显示位次差距过大的高危结果。
- 已新增第 6 周说明和验收命令：
  - `docs/week6-recommendation-results.md`
  - `docs/week6-data-audit.md`
  - `npm run test:week6`
  - `npm run verify:week6`

### 第 7 周：志愿表编辑器

- 已新增志愿表编辑器面板。
- 已实现推荐项加入志愿表。
- 已实现重复加入拦截。
- 已实现删除志愿。
- 已实现上移/下移排序。
- 已实现 45 个院校专业组上限。
- 已实现冲、稳、保、过保比例提示。
- 已实现保底不足、高危项进入方案等提示。
- 已实现浏览器本地方案保存和刷新恢复。
- 已新增第 7 周说明和验收命令：
  - `docs/week7-volunteer-plan-editor.md`
  - `npm run test:week7`
  - `npm run verify:week7`

## 后续限制和待办

### 本机环境说明

- 当前机器已安装 PostgreSQL 18.4，服务名为 `postgresql-x64-18`，`localhost:5432` 已可连接。
- 双击启动脚本已支持自动启动本机 PostgreSQL 服务；关机重启后通常直接双击 `start-gaokao-assistant.bat` 即可。
- `psql.exe` 位于 `E:\PostqreSQL\bin\psql.exe`，但该目录暂未加入 PATH，所以直接运行 `psql --version` 仍会提示找不到命令。
- 当前机器仍没有可用的 `docker` 命令；本项目本地开发已改用原生 PostgreSQL。
- 已补充 Windows 本地数据库安装和导入说明：`D:\education\gaokao-volunteer-assistant\docs\week4-local-database-setup.md`。
- 已新增前四周综合校验命令：`npm run verify:week4`。

### 数据质量限制

- 当前推荐数据底座已从 OCR/样例升级为 2024-2025 专业组口径 Excel 清洗结果。
- 2026 当年招生计划尚未公布，当前仍以 2025 普通本科批招生计划作为最近可用专业明细。
- 2017-2023 往年数据是旧文理科/院校专业口径，暂不直接混入专业组推荐模型。
- 招生章程风险规则目前还没有结构化导入。

这些是第一版后续数据增强事项，不阻塞第 0-7 周验收。

### 第 7 周之后功能

- 第 8 周风险检测和报告还没完成。
- 第 9 周响应式最终适配、部署和公开演示说明还没完成。

## 下一步建议

1. 如需命令行直接使用 `psql`，把 `E:\PostqreSQL\bin` 加入系统 PATH。
2. 第 0-7 周已经闭环；后续再进入第 8 周：风险检测、保底不足分析、专业组排斥专业、高学费、低置信度和简版报告页面。

## 2026-06-02 推荐算法审查与上传收口

- 已审查本轮推荐算法、候选池、API 选项、前端开关、志愿表编辑器和侧栏滚动改动，未发现阻塞发布的问题。
- 已修复高位次样例推荐过少、过保项过多的问题：内部候选池提升到 5000，推荐结果按高危/冲/稳/保/过保配额生成。
- 已修复 `640/7000` 样例中冲刺范围偏保守的问题：6000 多名参考位次现在进入冲刺，约 5900 名及以下才进入高危。
- 已开放“高危冲刺”和“过保兜底”控制项，便于不同用户选择是否纳入更激进或更保守的志愿。
- 已修复展示排序：高危排在冲前面，同一档内按参考位次从小到大展示，符合从更难到更容易的志愿浏览顺序。
- 已给左侧画像栏和右侧详情栏加入桌面端独立纵向滚动。
- 验证结果：`npm run verify:week7`、`npm run test:data` 均已通过；`665/1450` 前 12 条未出现安徽大学、安徽医科大学等明显过保项。

## 常用命令

```bash
cd D:\education\gaokao-volunteer-assistant
npm run dev
npm run check
npm run test:week4
npm run verify:week4
npm run test:week5
npm run verify:week5
npm run test:week6
npm run verify:week6
npm run test:week7
npm run verify:week7
npm run verify:data
npm run data:validate
npm run data:import
```
