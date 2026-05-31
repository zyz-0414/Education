# 第 3 周数据库和导入说明

## 目标

第 3 周把第 1-2 周 cleaned CSV 接入 PostgreSQL，并提供基础查询 API。当前范围只覆盖安徽普通类本科批开发数据，不生成正式推荐结论。

## 数据库

Prisma schema 位于 `prisma/schema.prisma`，迁移文件位于 `prisma/migrations/20260531150000_week3_database_import/migration.sql`。

主要表：

- `source`：数据来源索引；
- `province_policy`：安徽普通本科批规则基线；
- `score_segment`：一分一段；
- `college`、`major`：院校和专业基础数据；
- `college_group`：院校专业组；
- `major_plan`：招生计划；
- `admission_result`：历史投档/录取结果；
- `charter_rule`：招生章程风险规则；
- `recommendation_run`：后续推荐运行记录。

## 执行顺序

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run data:check
npm run data:validate
npm run data:import
```

如果是部署环境或已有数据库，用 `npx prisma migrate deploy` 替代 `npm run db:migrate`。

## 导入行为

`npm run data:import` 使用 `data/scripts/import_week3_data.ts`。

导入顺序：

1. 来源索引；
2. 安徽本科批政策基线；
3. 院校、专业；
4. 一分一段；
5. 院校专业组；
6. 招生计划；
7. 投档结果；
8. 招生章程规则。

来源、政策、院校、专业、一分一段、院校专业组和招生计划使用唯一键 upsert。投档结果和章程规则当前使用全量替换，避免后续分专业录取明细出现时被过早的唯一键限制。

## 校验

`npm run data:validate` 会检查：

- CSV 来源 ID 是否都能追溯到 `source_index.csv`；
- 一分一段位次区间是否能由同分人数和累计人数反推；
- 一分一段、院校专业组、招生计划、投档结果的业务键是否重复；
- 招生计划和投档结果是否都能关联到院校专业组；
- 所有关联数据是否能关联到院校。

当前校验通过的行数：

| 表 | 行数 |
| --- | ---: |
| sources | 10 |
| scoreSegments | 1934 |
| colleges | 51 |
| majors | 17 |
| collegeGroups | 219 |
| enrollmentPlans | 17 |
| admissionResults | 216 |
| charterRules | 0 |

## 查询 API

列表：

```text
GET /api/college-groups?year=2025&subjectTrack=physics&q=北京&limit=20&offset=0
```

详情：

```text
GET /api/college-groups/2025/physics/2297/001
```

返回内容包含院校、院校专业组、招生计划、历史投档结果、章程规则和各项来源信息。
