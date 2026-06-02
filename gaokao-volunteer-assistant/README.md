# 安徽高考志愿助手

面向安徽普通类本科批考生的高考志愿填报辅助系统。第一版目标是：用户输入选科、分数、位次和偏好后，基于安徽公开数据生成冲稳保建议、风险提示和可解释志愿表，并适配手机端和电脑端。

本项目不承诺录取结果。所有推荐都应被理解为基于数据版本和规则模型的参考建议。

## 第一版范围

- 省份：安徽
- 批次：普通类本科批
- 推荐单位：院校专业组
- 志愿数量：最多 45 个院校专业组
- 数据口径：优先使用 2024、2025 改革后同口径数据；2026 数据发布后补充
- 暂不做：专家审核、支付、全国覆盖、原生 App、艺术体育强基专项、无边界 AI 问答

## 技术栈

- Next.js + React + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- Python 数据清洗脚本
- 后续可加入 Recharts、TanStack Table、shadcn/ui、PWA

## 目录

```text
src/app/                 页面入口
src/components/          业务组件目录
src/lib/rules/           省份规则
src/lib/recommend/       推荐算法模块
src/lib/validators/      输入校验
prisma/schema.prisma     数据库 schema 草案
data/raw/                原始数据留存
data/cleaned/            清洗后 CSV
data/sources/            数据来源索引
data/scripts/            数据准备、导入和校验脚本
docs/                    项目文档
tests/                   规则和推荐测试
```

## 本地启动

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:validate
npm run db:migrate
npm run dev
```

打开 http://localhost:3000 查看准备工作台。

## 数据准备清单

首批需要整理：

1. 安徽 2024、2025 一分一段表；
2. 安徽 2024、2025 普通本科批投档/录取数据；
3. 安徽 2025 招生计划样例，2026 发布后补充正式招生计划；
4. 院校专业组、专业列表、选科要求、学费、校区；
5. 招生章程中的语种、体检、单科、调剂、中外合作等风险规则。

所有数据必须登记到 `data/sources/source_index.csv`，保留来源 URL、发布时间、获取时间、文件哈希、处理版本和审核状态。

## 常用命令

```bash
npm run dev
npm run lint
npm run build
npm run db:validate
npm run db:generate
npm run db:migrate
npm run check
python -m pip install -r data/requirements.txt
npm run data:prepare
npm run data:check
npm run data:validate
npm run data:import
npm run verify:week4
npm run verify:week5
npm run test:week6
npm run verify:week6
```

## 当前状态

第 0 周准备已完成基础骨架。第 1-2 周已完成安徽首批数据整理：2024、2025 一分一段完整清洗，2024、2025 普通本科批投档官方长图留存并生成首批 OCR 样例，2025 招生计划样例已结构化。第 3 周已补齐 Prisma 迁移、数据导入命令、CSV 完整性校验和院校专业组基础查询 API。第 4 周已完成考生建档工作台、选科组合校验、分数位次校验、普通本科批过滤和选科不符过滤。第 5 周已完成推荐算法和推荐接口。第 6 周已完成推荐结果页、桌面表格、手机卡片、风险标签、推荐理由和院校专业组详情入口，并完成院校代码跨年复用数据审计、名称快照隔离、搜索修正和高危项默认隐藏。

## 第 3 周数据库与查询

```bash
docker compose up -d postgres
npm run db:migrate
npm run data:validate
npm run data:import
```

基础 API：

- `GET /api/college-groups?year=2025&subjectTrack=physics&q=北京`
- `GET /api/college-groups/2025/physics/2297/001`

详见 `docs/week3-database-import.md`。

## 第 4 周候选集

```bash
npm run test:week4
npm run verify:week4
```

候选集 API：

- `POST /api/candidate-groups`

详见 `docs/week4-profile-filtering.md`。

## 第 5-6 周推荐

```bash
npm run test:week5
npm run test:week6
npm run verify:week6
```

推荐 API：

- `POST /api/recommendations`

详见 `docs/week5-recommendation-algorithm.md`、`docs/week6-recommendation-results.md` 和 `docs/week6-data-audit.md`。

## 第 0-4 周本地数据库收口

当前前四周代码、CSV 和规则校验可以通过，但真实候选集查询需要本机先有 PostgreSQL 服务。Windows 安装 Docker Desktop 或 PostgreSQL 后，按 `docs/week4-local-database-setup.md` 执行迁移、导入和接口验证。
