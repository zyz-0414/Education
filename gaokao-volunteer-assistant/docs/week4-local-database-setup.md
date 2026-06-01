# 第 0-4 周本地数据库收口说明

## 当前检查结果

2026-06-01 最终状态：

- Node.js 和 npm 可用；
- `.env` 已存在，`DATABASE_URL` 指向 `postgresql://postgres:postgres@localhost:5432/gaokao_volunteer_assistant?schema=public`；
- `docker` 命令不可用；
- 已安装 PostgreSQL 18.4，服务名为 `postgresql-x64-18`；
- `localhost:5432` 已有 PostgreSQL 服务监听；
- `psql.exe` 位于 `E:\PostqreSQL\bin\psql.exe`，但该目录暂未加入 PATH；
- 已创建数据库 `gaokao_volunteer_assistant`；
- `npm run db:migrate` 已成功；
- `npm run data:import` 已成功；
- `npm run verify:week4` 已通过；
- `POST /api/candidate-groups` 已用真实数据库验证通过。

因此第 0-4 周代码、CSV、数据库迁移、数据导入和候选集接口已经闭环。

## 方案 A：使用 Docker Desktop

适合后续部署习惯接近生产环境的场景。

1. 打开 Docker 官方安装页：https://docs.docker.com/desktop/setup/install/windows-install/
2. 下载并安装 Docker Desktop for Windows。
3. 安装完成后启动 Docker Desktop，等待左下角显示 Docker 正在运行。
4. 打开 PowerShell，执行：

```powershell
cd D:\education\gaokao-volunteer-assistant
docker compose up -d postgres
npm run db:migrate
npm run data:validate
npm run data:import
```

如果 5432 端口被其他服务占用，先关闭占用服务，或修改 `docker-compose.yml` 的端口映射和 `.env` 的 `DATABASE_URL`。

## 方案 B：安装原生 PostgreSQL

适合不想安装 Docker Desktop，只需要本机开发数据库的场景。

1. 打开 PostgreSQL 官方 Windows 下载页：https://www.postgresql.org/download/windows/
2. 下载 Windows installer。
3. 安装时建议保持端口 `5432`，超级用户 `postgres` 的密码设置为 `postgres`，方便直接使用当前 `.env`。
4. 安装完成后确认 PostgreSQL 服务已启动。
5. 如果安装器没有自动把 `psql` 加入 PATH，可以把类似下面的目录加入系统 PATH：

```text
C:\Program Files\PostgreSQL\16\bin
```

6. 打开 PowerShell，执行：

```powershell
createdb -U postgres gaokao_volunteer_assistant
cd D:\education\gaokao-volunteer-assistant
npm run db:migrate
npm run data:validate
npm run data:import
```

如果你安装的是 PostgreSQL 17 或 18，PATH 里的版本号按实际安装目录调整即可。

本机当前实际路径是：

```text
E:\PostqreSQL\bin
```

如果不想改 PATH，也可以使用完整路径执行：

```powershell
& "E:\PostqreSQL\bin\psql.exe" --version
```

## 导入后验证

数据库安装、迁移、导入完成后，执行：

```powershell
cd D:\education\gaokao-volunteer-assistant
npm run verify:week4
npm run dev
```

打开 `http://localhost:3000`，用默认表单生成候选集。页面应该能显示一分一段校验、批次范围、选科通过数量和候选院校专业组。

也可以用接口直接验证：

```powershell
$body = @{
  requirePlan = $false
  limit = 5
  offset = 0
  profile = @{
    targetYear = 2025
    provinceCode = "AH"
    batchCode = "ordinary_undergraduate"
    firstChoiceSubject = "physics"
    secondChoiceSubjects = @("chemistry", "biology")
    score = 550
    rank = 70000
    riskPreference = "balanced"
    preferredCities = @()
    preferredMajorCategories = @()
    rejectedMajorCategories = @()
  }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/candidate-groups" -ContentType "application/json" -Body $body
```

## 前四周边界

这份说明只服务第 0-4 周闭环：项目骨架、数据清洗、数据库导入、基础查询 API、考生建档和规则过滤。第 5 周之后的冲稳保算法、推荐结果页、志愿表编辑器和报告页面暂不处理。
