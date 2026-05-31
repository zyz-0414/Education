import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  ListChecks,
  MapPinned,
  ShieldCheck,
} from "lucide-react";

const preparationItems = [
  {
    title: "范围锁定",
    status: "已确定",
    body: "第一版只做安徽普通类本科批，推荐单位为院校专业组，志愿上限按 45 个设计。",
    icon: MapPinned,
  },
  {
    title: "技术栈",
    status: "已初始化",
    body: "Next.js、TypeScript、Tailwind CSS、Prisma、PostgreSQL、Python 数据脚本。",
    icon: GitBranch,
  },
  {
    title: "数据底座",
    status: "待采集",
    body: "已建立 raw、cleaned、sources 和 scripts 目录，先整理 2024-2025 改革后数据。",
    icon: Database,
  },
  {
    title: "规则原则",
    status: "已记录",
    body: "硬规则先过滤，位次模型后排序；低置信度必须标注，不承诺录取。",
    icon: ShieldCheck,
  },
];

const dataChecklist = [
  "安徽 2024、2025 一分一段表",
  "安徽 2024、2025 普通本科批投档/录取数据",
  "安徽 2025 招生计划样例，2026 发布后补充正式计划",
  "院校专业组、专业列表、选科要求、学费、校区",
  "招生章程中的语种、体检、单科、调剂等风险规则",
];

const routes = [
  ["/profile", "考生建档"],
  ["/preferences", "偏好设置"],
  ["/recommend", "推荐结果"],
  ["/plan", "志愿表"],
  ["/admin/import", "数据导入"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">安徽普通类本科批 MVP</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
              安徽高考志愿助手
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
              当前是第 0 周准备面板：先把项目结构、数据口径、技术底座和第一批采集清单固定下来，
              后续再进入数据整理、规则过滤和推荐算法开发。
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 border border-line bg-panel p-4 text-sm sm:w-auto">
            <span className="font-semibold">第一版边界</span>
            <span className="text-muted">安徽 / 普通类本科批 / 院校专业组 / 响应式 Web</span>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {preparationItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="border border-line bg-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <Icon aria-hidden className="h-5 w-5 text-accent" />
                  <span className="text-xs font-semibold text-accent-strong">{item.status}</span>
                </div>
                <h2 className="mt-5 text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <BookOpenCheck aria-hidden className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold">考生建档入口草稿</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                省份
                <select className="h-11 border border-line bg-white px-3 text-sm" defaultValue="AH">
                  <option value="AH">安徽</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                批次
                <select className="h-11 border border-line bg-white px-3 text-sm" defaultValue="ordinary_undergraduate">
                  <option value="ordinary_undergraduate">普通类本科批</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                首选科目
                <select className="h-11 border border-line bg-white px-3 text-sm" defaultValue="physics">
                  <option value="physics">物理</option>
                  <option value="history">历史</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                位次
                <input
                  className="h-11 border border-line bg-white px-3 text-sm"
                  inputMode="numeric"
                  placeholder="例如：18000"
                />
              </label>
            </div>
            <div className="mt-5 flex items-start gap-3 border border-line bg-background p-4 text-sm leading-6 text-muted">
              <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p>
                正式推荐需要先导入一分一段、招生计划和历史录取数据。当前表单只作为入口结构，
                不生成录取承诺或正式志愿方案。
              </p>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <ListChecks aria-hidden className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold">首批数据清单</h2>
            </div>
            <ul className="mt-5 space-y-3">
              {dataChecklist.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-muted">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <FileText aria-hidden className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold">页面路线</h2>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {routes.map(([path, label]) => (
                <div key={path} className="border border-line bg-background px-3 py-2 text-sm">
                  <span className="font-semibold">{label}</span>
                  <span className="ml-2 text-muted">{path}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <div className="flex items-center gap-2">
              <Database aria-hidden className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-semibold">下一步</h2>
            </div>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-muted">
              <li>1. 收集安徽 2024、2025 核心官方数据并登记 source_index。</li>
              <li>2. 按 cleaned CSV 模板整理第一批样例数据。</li>
              <li>3. 校验 Prisma schema，连 PostgreSQL 后生成迁移。</li>
              <li>4. 实现用户建档、位次校验和选科硬过滤。</li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
