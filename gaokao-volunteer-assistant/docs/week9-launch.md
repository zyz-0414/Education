# 第 9 周响应式适配和线上 Demo 发布

## 完成范围

- 页面正式收口为“安徽高考志愿助手”，移除首页和报告页中的开发周次标签；
- 保留第一版范围：安徽普通类本科批、院校专业组推荐、志愿表编辑、风险报告和 PDF 导出；
- 新增 Vercel 部署配置 `vercel.json`；
- 新增生产迁移命令 `npm run db:deploy`；
- 新增第 9 周验收命令 `npm run verify:week9`；
- `npm run build` 会先执行 `prisma generate`，再执行 `next build`；
- PDF 导出已加入项目内中文字体 `public/fonts/NotoSansCJKsc-Regular.otf`，避免 Linux 部署环境缺少中文字体；
- `.env.example` 已补充 Vercel + Neon PostgreSQL 的环境变量说明。

第 9 周不新增账号系统、支付、专家审核、服务端志愿方案持久化、分享链接、AI 问答、PWA 和扩省功能。

## 推荐部署形态

第一版线上 Demo 推荐：

```text
Vercel
  -> Next.js App Router 页面和 Route Handler
  -> POST /api/recommendations
  -> POST /api/volunteer-report/pdf

Neon PostgreSQL
  -> Prisma schema 迁移
  -> cleaned CSV 批量导入
```

线上仍使用浏览器 `localStorage` 保存志愿方案。刷新、报告页和 PDF 导出依赖同一浏览器中的本地草稿，不做跨设备同步。

## 实际发布记录

2026-06-03 已完成第一版 Production 发布：

- 线上地址：https://gaokao-volunteer-assistant.vercel.app
- Vercel 项目：`v026-8108s-projects/gaokao-volunteer-assistant`
- Vercel 部署 ID：`dpl_5ZGb7vK165J4EP6qMkxXbL2h5y3r`
- Neon 资源：`gaokao-volunteer-assistant-db`
- Neon 区域：`sin1`
- Neon 计划：`free_v3`
- 已新增 `.vercelignore`，排除 `.env`、`.env.local`、`.vercel`、`.next` 和 `node_modules`，避免本地环境文件进入 Vercel 上传包；
- 已完成 Neon 生产库迁移，应用 `20260531150000_week3_database_import` 和 `20260601162000_college_group_name_snapshot`；
- 已完成 cleaned CSV 导入：`sources=11`、`provincePolicies=3`、`colleges=1942`、`majors=20455`、`scoreSegments=2882`、`collegeGroups=11542`、`enrollmentPlans=47401`、`admissionResults=10758`。

线上冒烟结果：

- 首页返回 `200`，页面包含“安徽高考志愿助手”；
- `/.env` 返回 `404`；
- `POST /api/recommendations` 使用 2025 物理、化学+生物、550 分、70000 位次样例返回 `5/5` 条推荐，分数位次校验通过；
- `POST /api/volunteer-report/pdf` 返回 `200`、`application/pdf`，响应以 `%PDF` 开头。

## 环境变量

Vercel Production 环境至少需要：

```bash
DATABASE_URL="Neon pooled connection string"
NEXT_PUBLIC_DATA_VERSION="demo-anhui-2025-v1"
```

执行迁移和导入时，建议在本地临时把 `DATABASE_URL` 设置为 Neon direct connection string，再运行：

```bash
npm run db:deploy
npm run data:validate
npm run data:import
```

原因：应用运行适合使用 Neon pooled connection string；Prisma 迁移和批量数据导入使用 direct connection string 更稳。

## 本地验收

```bash
npm run verify:week9
```

`verify:week9` 会先执行第 0-8 周验收，再执行生产构建。

## Vercel CLI 准备

本机如果没有 `vercel` 命令，可以用 npm 安装：

```bash
npm install -g vercel@latest
```

官方文档入口：

- Vercel CLI：https://vercel.com/docs/cli
- Vercel 控制台：https://vercel.com/dashboard
- Neon 控制台：https://console.neon.tech/

安装后用下面命令确认：

```bash
vercel --version
vercel login
vercel whoami
```

当前开发机已安装 Vercel CLI，版本为 `54.7.1`。如果 `vercel whoami` 没有返回账号邮箱，说明还没有完成登录，需要先执行 `vercel login` 并在浏览器中确认账号。

## 浏览器验收清单

建议至少检查以下视口：

| 视口 | 重点 |
| --- | --- |
| 375px | 首页表单、推荐卡片、志愿表手机卡片、报告页按钮换行 |
| 390px | 常见手机宽度完整流程 |
| 768px | 平板布局和卡片密度 |
| 1280px | 桌面推荐表格、详情侧栏、滚动区域 |
| 1440px | 大屏信息密度和左右栏高度 |

核心流程：

1. 打开 `/`；
2. 使用 2025、物理、化学+生物、550 分、70000 位次样例生成推荐；
3. 确认默认不返回明显高危项；
4. 一键加入推荐到志愿表；
5. 保存方案；
6. 查看首页风险报告；
7. 打开 `/report`；
8. 导出 PDF；
9. 检查浏览器控制台无错误。

## 线上部署步骤

1. 将代码推送到 GitHub 仓库；
2. 在 Vercel 导入仓库，项目根目录选择 `gaokao-volunteer-assistant`；
3. 在 Neon 创建 PostgreSQL 数据库；
4. 在 Vercel Production 环境变量中配置 `DATABASE_URL` 和 `NEXT_PUBLIC_DATA_VERSION`；
5. 在本地使用 Neon direct connection string 执行 `npm run db:deploy`；
6. 执行 `npm run data:validate` 和 `npm run data:import` 导入 cleaned CSV；
7. 在 Vercel 触发 Production 部署；
8. 打开线上地址按浏览器验收清单完成一次完整流程。

如果使用 CLI 部署，登录并绑定项目后可执行：

```bash
vercel link
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_DATA_VERSION production
vercel --prod
```

`DATABASE_URL` 在 Vercel 中使用 Neon pooled connection string；本地执行 `npm run db:deploy` 和 `npm run data:import` 时，临时使用 Neon direct connection string。

## 公开演示说明

推荐演示样例：

```text
年份：2025
首选科目：物理
再选科目：化学、生物
分数：550
位次：70000
风险偏好：均衡
城市偏好：合肥 南京
专业偏好：计算机 软件
排斥方向：护理 土木
学费上限：20000
```

演示时需要明确说明：

- 当前是安徽普通类本科批第一版 Demo；
- 当前数据以 2024-2025 专业组口径为主；
- 2026 当年招生计划发布后需要重新导入；
- 推荐结果只做概率参考，不构成录取承诺；
- 高考志愿最终填报必须以安徽省教育招生考试院和高校招生章程最新信息为准。

## 后续建议

第 10 周建议进入回测和作品集打磨：

1. 用 2024 数据预测 2025，检查冲稳保分档；
2. 补充 README 作品集说明；
3. 增加演示截图；
4. 再考虑 PWA、分享链接或多方案对比。
