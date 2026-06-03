import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  Check,
  ClipboardList,
  Database,
  Download,
  FileText,
  Filter,
  GraduationCap,
  Info,
  ListChecks,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  WalletCards,
} from "lucide-react";

export const metadata: Metadata = {
  title: "使用说明 | 皖志愿",
  description: "皖志愿使用说明：从填写考生信息、生成推荐，到整理志愿表、查看风险报告和导出 PDF。",
};

const quickFlow = [
  {
    title: "准备信息",
    text: "拿到自己的分数、全省位次、首选科目和两门再选科目。位次比裸分更关键，建议优先核对位次。",
  },
  {
    title: "填写画像",
    text: "在首页左侧填写年份、科目、分数、位次、风险偏好、城市/专业偏好和排斥方向。",
  },
  {
    title: "生成推荐",
    text: "点击生成后，系统会先过滤选科和计划明细，再按位次、偏好和风险进行排序。",
  },
  {
    title: "加入志愿表",
    text: "从推荐列表里逐个加入，或用一键添加先搭出草稿，再手动删改和调整顺序。",
  },
  {
    title: "检查风险",
    text: "重点看滑档、保底不足、低置信度、高学费、排斥专业等提醒，不要只看综合分。",
  },
  {
    title: "保存导出",
    text: "保存到本机浏览器后，可打开报告页复核，也可以导出 PDF 给家人一起讨论。",
  },
];

const inputGroups = [
  {
    icon: <Database aria-hidden className="h-4 w-4" />,
    title: "数据年份",
    detail: "选择要参考的数据年份。通常用最新可用年份做参考；如果想对照上一年，可以切换年份后重新生成。",
    tip: "切换年份后，推荐结果、参考位次和计划明细都会重新计算。",
  },
  {
    icon: <GraduationCap aria-hidden className="h-4 w-4" />,
    title: "首选科目与再选科目",
    detail: "首选科目在物理、历史中二选一；再选科目必须选满两门。系统会据此排除不符合选科要求的院校专业组。",
    tip: "如果生成按钮不可用，先检查再选科目是不是正好选了两门。",
  },
  {
    icon: <SlidersHorizontal aria-hidden className="h-4 w-4" />,
    title: "分数与位次",
    detail: "分数用于一分一段校验，位次用于核心推荐模型。请尽量填写官方公布的一分一段位次。",
    tip: "同分人数较多时，位次区间会影响判断，建议保守看待靠边的冲刺项。",
  },
  {
    icon: <ShieldCheck aria-hidden className="h-4 w-4" />,
    title: "风险偏好",
    detail: "均衡适合大多数用户；稳妥会更重视保底；进取会保留更多冲刺机会。",
    tip: "第一次使用建议先选均衡，生成后再按家庭接受程度微调。",
  },
  {
    icon: <ListChecks aria-hidden className="h-4 w-4" />,
    title: "城市、专业与排斥方向",
    detail: "城市偏好和专业偏好会提高相关院校专业组的排序；排斥方向会触发风险提醒。",
    tip: "可以用空格、逗号或换行分隔，例如：合肥 南京；计算机 软件 数据。",
  },
  {
    icon: <WalletCards aria-hidden className="h-4 w-4" />,
    title: "学费上限",
    detail: "可留空。填写后，超过预算或学费缺失的专业会在风险标签和报告中提示。",
    tip: "如果家庭预算明确，建议填写；如果还没确定，可以先留空生成初版。",
  },
  {
    icon: <Filter aria-hidden className="h-4 w-4" />,
    title: "三个开关",
    detail: "仅有计划明细默认打开；高危冲刺默认关闭；过保兜底默认打开。",
    tip: "正式讨论方案时，建议保留计划明细和过保兜底，高危冲刺只放少量。",
  },
];

const resultBlocks = [
  {
    icon: <BadgeCheck aria-hidden className="h-4 w-4" />,
    title: "顶部指标",
    text: "可推荐项表示通过硬规则后还能参与排序的数量；选科通过表示符合当前科目组合的范围；低置信度越多，越要人工复核数据。",
  },
  {
    icon: <Table2 aria-hidden className="h-4 w-4" />,
    title: "推荐院校专业组",
    text: "表格里的档位、参考位次、位次差、计划人数、近三年位次和推荐理由要一起看。点击一行后，右侧会显示更细的专业计划和风险理由。",
  },
  {
    icon: <ShieldAlert aria-hidden className="h-4 w-4" />,
    title: "风险标签",
    text: "高危、低置信度、学费风险、计划待补、排斥方向等标签不是装饰。只要出现，就建议打开详情确认原因。",
  },
  {
    icon: <ClipboardList aria-hidden className="h-4 w-4" />,
    title: "志愿表编辑器",
    text: "加入后的条目会进入志愿表。可以上移、下移、删除，也可以查看冲稳保比例和剩余名额。",
  },
  {
    icon: <FileText aria-hidden className="h-4 w-4" />,
    title: "志愿方案报告",
    text: "报告会把整张志愿表的风险汇总成结论和调整建议，适合在最终定稿前集中检查。",
  },
  {
    icon: <Download aria-hidden className="h-4 w-4" />,
    title: "保存与导出",
    text: "保存会写入本机浏览器；导出 PDF 会生成可分享文件。换设备或清理浏览器数据后，本机草稿可能消失。",
  },
];

const riskChecks = [
  "冲刺项过多时，先减少高危或冲档条目，再补足稳档、保档和兜底。",
  "保底数量不足时，优先增加位次优势明显、计划人数相对稳定的院校专业组。",
  "出现排斥专业时，进入详情看专业计划，确认是否有不想接受的方向。",
  "出现高学费或学费待补时，先和家庭预算对齐，再决定是否保留。",
  "低置信度、OCR 待复核或历史样例不足时，不要直接定稿，建议再查官方招生计划和院校章程。",
  "最终提交前，必须以考试院志愿填报系统、学校招生章程和当年正式招生计划为准。",
];

const faqItems = [
  {
    question: "为什么生成按钮是灰色的？",
    answer: "通常是再选科目没有正好选择两门，或页面正在生成结果。先检查化学、生物、政治、地理中是否选满两门。",
  },
  {
    question: "为什么没有推荐结果？",
    answer: "可能是位次、选科、计划明细开关或偏好条件太严格。可以先确认分数位次是否正确，再尝试关闭过窄的偏好或切换风险偏好。",
  },
  {
    question: "综合分高就一定更好吗？",
    answer: "不是。综合分用于排序，但志愿方案还要看冲稳保比例、专业接受度、学费、城市、计划人数和低置信度风险。",
  },
  {
    question: "保存后在哪里看报告？",
    answer: "在志愿方案报告模块点击打开报告。报告页读取的是本机浏览器保存的草稿，所以换浏览器或换设备后需要重新保存。",
  },
  {
    question: "PDF 可以直接拿去提交吗？",
    answer: "不建议。PDF 适合讨论和复核，正式填报仍要回到官方系统逐项核对院校代码、专业组代码、专业名称和招生计划。",
  },
];

function NumberBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-accent bg-accent-soft text-sm font-semibold text-accent-strong">
      {value}
    </span>
  );
}

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-accent hover:text-accent"
            href="/"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            返回工作台
          </Link>
          <span className="inline-flex h-10 items-center gap-2 rounded border border-line bg-panel px-3 text-sm font-semibold text-muted shadow-sm">
            <BookOpenCheck aria-hidden className="h-4 w-4 text-accent" />
            使用说明
          </span>
        </div>

        <section className="rounded-lg border border-line bg-panel p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-sm font-semibold text-accent">皖志愿</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-normal sm:text-4xl">
                从填写信息到导出报告，一步一步完成志愿方案
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">
                这页适合第一次使用时从上到下看。按顺序完成后，你会得到一份可以继续讨论、复核和导出的志愿草稿。
              </p>
            </div>
            <div className="rounded border border-line bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Info aria-hidden className="h-4 w-4 text-accent" />
                最快路径
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                填分数位次和科目，选均衡策略，点击生成推荐；先把稳档、保档和兜底搭起来，再少量加入冲刺项；最后保存并打开报告检查风险。
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-line bg-panel p-4 shadow-sm lg:sticky lg:top-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks aria-hidden className="h-4 w-4 text-accent" />
              阅读顺序
            </div>
            <nav className="mt-3 grid gap-2 text-sm">
              {[
                ["完整流程", "#flow"],
                ["首页怎么填", "#inputs"],
                ["结果怎么看", "#results"],
                ["志愿表怎么整理", "#plan"],
                ["哪些地方要复核", "#risk"],
                ["常见问题", "#faq"],
              ].map(([label, href]) => (
                <a
                  className="rounded border border-line bg-background px-3 py-2 text-muted transition hover:border-accent hover:text-accent"
                  href={href}
                  key={href}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-4 rounded border border-warning bg-warning-soft p-3 text-sm leading-6 text-warning">
              推荐结果是辅助参考，不是录取承诺。正式填报前，请逐项核对官方系统、招生章程和当年招生计划。
            </div>
          </aside>

          <div className="grid gap-5">
            <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" id="flow">
              <div className="flex items-center gap-2">
                <Search aria-hidden className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-semibold">完整流程</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {quickFlow.map((item, index) => (
                  <article className="rounded border border-line bg-background p-4" key={item.title}>
                    <div className="flex items-center gap-3">
                      <NumberBadge value={index + 1} />
                      <h3 className="font-semibold">{item.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{item.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" id="inputs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal aria-hidden className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-semibold">首页左侧怎么填</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                首页左侧是建档表单。填写越接近真实意愿，推荐结果越容易进入可讨论状态。
              </p>
              <div className="mt-4 grid gap-3">
                {inputGroups.map((group) => (
                  <article className="rounded border border-line bg-background p-4" key={group.title}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-line bg-white text-accent">
                        {group.icon}
                      </span>
                      <h3 className="font-semibold">{group.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{group.detail}</p>
                    <p className="mt-2 rounded border border-line bg-white px-3 py-2 text-sm leading-6 text-muted">
                      {group.tip}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" id="results">
              <div className="flex items-center gap-2">
                <Table2 aria-hidden className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-semibold">生成后怎么看结果</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {resultBlocks.map((block) => (
                  <article className="rounded border border-line bg-background p-4" key={block.title}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-line bg-white text-accent">
                        {block.icon}
                      </span>
                      <h3 className="font-semibold">{block.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{block.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" id="plan">
              <div className="flex items-center gap-2">
                <ClipboardList aria-hidden className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-semibold">志愿表怎么整理</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  "先用一键添加或逐个添加，把候选院校专业组放入志愿表。不要急着定稿，先搭草稿。",
                  "看志愿表编辑器里的剩余名额、保底数量和冲稳保比例。冲刺项可以有，但不要挤掉保底空间。",
                  "用上移、下移调整顺序。越想优先尝试的放在前面，越承担兜底作用的放在后面。",
                  "删掉不接受的城市、专业方向、学费明显超预算或低置信度无法确认的条目。",
                  "点击保存，把当前方案写入本机浏览器。保存后再打开报告页，集中看风险结论和调整建议。",
                  "导出 PDF 前再检查一次院校代码、专业组代码、专业名称、计划人数和选科要求。",
                ].map((item, index) => (
                  <div className="flex gap-3 rounded border border-line bg-background p-3 text-sm leading-6" key={item}>
                    <NumberBadge value={index + 1} />
                    <p className="text-muted">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" id="risk">
              <div className="flex items-center gap-2">
                <AlertTriangle aria-hidden className="h-5 w-5 text-warning" />
                <h2 className="text-xl font-semibold">这些地方一定要复核</h2>
              </div>
              <div className="mt-4 grid gap-2">
                {riskChecks.map((item) => (
                  <div className="flex gap-3 rounded border border-line bg-background p-3 text-sm leading-6" key={item}>
                    <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent" />
                    <p className="text-muted">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel p-5 shadow-sm" id="faq">
              <div className="flex items-center gap-2">
                <BookOpenCheck aria-hidden className="h-5 w-5 text-accent" />
                <h2 className="text-xl font-semibold">常见问题</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {faqItems.map((item) => (
                  <article className="rounded border border-line bg-background p-4" key={item.question}>
                    <h3 className="font-semibold">{item.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.answer}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
