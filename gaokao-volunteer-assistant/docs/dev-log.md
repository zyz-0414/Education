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
- 完成第 6 周推荐结果页：页面接入推荐接口，新增桌面推荐表格、手机推荐卡片、风险标签、推荐理由和院校专业组详情入口。
- 新增 `docs/week6-recommendation-results.md` 和 `npm run verify:week6`，第 6 周仍不进入志愿表编辑器。
- 修复推荐结果误把 2025 年 `1029` 北华大学显示为北京大学的问题：院校专业组新增当年院校名称快照，推荐展示优先使用快照；推荐默认要求有招生计划明细，OCR 历史样例仅用于排查。
- 新增 `npm run test:week6`，守卫 2024/2025 院校代码复用下的北京大学和北华大学名称映射。

## 2026-06-02

- 按第 0-6 周范围再次执行 `npm run verify:week6`，lint、Prisma schema、CSV 表头、CSV 完整性、第 4/5/6 周测试和生产构建均已通过。
- 完成第 6 周全量数据一致性审计：当前 cleaned CSV 中确认 22 个 `college_code` 存在跨年院校名称复用、30 组历史匹配键存在跨年混用风险，招生计划和投档结果均能引用到专业组。
- 修复 OCR 名称脏值：`1034` 物理组由 `4北京第二外国语学院` 修正为 `北京第二外国语学院`。
- 专业组搜索改为使用当年 `collegeNameSnapshot`，避免全局院校主表名称把 2025 年 `1029` 北华大学误命中到“北京大学”查询中。
- 推荐历史投档匹配加入院校名称快照隔离，避免跨年代码复用时混用不同院校的历史位次。
- “显示高危项”默认关闭，`POST /api/recommendations` 默认也不返回高危项；`550` 分、`70000` 位次样例在默认、正式和调试但隐藏高危项模式下均不返回北京大学。
- 新增 `docs/week6-data-audit.md`，记录数据审计范围、发现、修复策略和当前限制。
- 完成第 7 周志愿表编辑器：推荐项可加入志愿表，支持重复拦截、45 个上限、删除、上移/下移排序、冲稳保比例提示和本地方案保存。
- 新增 `src/lib/volunteer-plan.ts`、`tests/week7-volunteer-plan.ts`、`docs/week7-volunteer-plan-editor.md`、`npm run test:week7` 和 `npm run verify:week7`。

## 2026-06-02 数据增强

- 接入用户放置在 `D:\education\data` 下的安徽近年 Excel 数据，并新增 `data/scripts/prepare_collected_anhui_data.py`。
- `npm run data:prepare` 默认改为生成 2024-2025 专业组口径 cleaned CSV，旧样例/OCR 脚本保留为 `npm run data:prepare:legacy`。
- 本轮采用 2024-2025 新高考专业组口径；2017-2023 旧文理科/院校专业口径暂不混入推荐模型。
- cleaned CSV 已扩展为：`college_groups=9507`、`enrollment_plans=47401`、`admission_results=8723`、`colleges=1710`、`majors=20455`、`score_segments=1934`。
- `data:import` 改为批量替换型导入，解决几万行招生计划逐行 upsert 超时问题；本机导入耗时约 11 秒。
- 新增 `tests/collected-data-smoke.ts`、`npm run test:data` 和 `npm run verify:data`，防止回退到样例计划或选科要求文本污染。
- 默认物理样例（2025、550 分、70000 位、化学+生物）在 `requirePlan=true` 下可推荐结果由 2 条提升到 294 条。

## 2026-06-02 推荐算法调优与界面收口

- 根据 `665/1450`、`664/1500`、`640/7000` 等实测反馈，扩展内部候选池到 5000 条，并改为按配额生成 45 条推荐方案，避免少数合理项之后被极端过保项填充。
- 推荐分档改为自适应位次差：冲刺上限从固定 `8%/350 位` 调整为 `12%`，并按考生位次段提供 350/600/1000 位的绝对缓冲；7000 名考生的 6000 多名参考位次不再默认判为高危。
- 新增 `includeHighRisk` 和 `includeVerySafe` 控制，高危冲刺和过保兜底可由用户按意愿打开或关闭。
- 推荐展示顺序调整为 `高危 -> 冲 -> 稳 -> 保 -> 过保`，每档内部按参考位次从小到大展示，即从更难到更容易展示；候选挑选仍保留更接近位次的可行性排序。
- 左侧画像侧栏和右侧详情侧栏已在桌面布局下加入独立纵向滚动，长表单和长详情不会挤压主推荐列表。
- 复测 `665/1450` 物理化学生物前 12 条未出现安徽大学、安徽医科大学等明显过保项；`640/7000` 打开高危后高危项和冲刺项按参考位次难度正确排序。
- 已通过 `npm run verify:week7` 和 `npm run test:data`。
