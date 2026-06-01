# 双击启动说明

## 最简单方式

双击根目录里的：

```text
D:\education\start-gaokao-assistant.bat
```

脚本会做这些事：

1. 进入 `gaokao-volunteer-assistant` 项目目录；
2. 检查 Node.js 和 npm；
3. 如果还没有 `node_modules`，自动执行 `npm install`；
4. 检查 PostgreSQL 是否已经在 `localhost:5432` 运行；
5. 如果 PostgreSQL 没运行，优先尝试启动本机 Windows 服务 `postgresql*`；
6. 如果本机 PostgreSQL 服务不存在，再尝试用 Docker Desktop 执行 `docker compose up -d postgres`；
7. 数据库启动后自动执行 Prisma 迁移，并在数据为空时导入 cleaned CSV；
8. 如果 3000 端口没有服务，启动 `npm run dev -- -p 3000`；
9. 等待本地页面响应；
10. 自动打开 `http://localhost:3000`。

## 注意

页面打开不等于数据库已经可用。当前项目的候选集查询需要 PostgreSQL。

当前电脑已经安装原生 PostgreSQL 18.4，服务名为 `postgresql-x64-18`。关机重启后双击启动文件时，脚本会尝试自动启动这个服务。

如果电脑既没有本机 PostgreSQL 服务，也没有安装 Docker Desktop，启动脚本无法凭空创建数据库，只会打开网页，并在候选集查询时显示“数据库暂不可用”。

## 本次启动器更新记录

- 已加入数据库自动启动。
- 已加入 Prisma 迁移检查。
- 已加入本地数据自动检查和补导入。
- 已修复网页服务已经运行时重复执行 `prisma generate` 可能导致文件占用的问题。
- 已实测双击启动流程可以在当前电脑上打开页面并确认数据库数据存在。
