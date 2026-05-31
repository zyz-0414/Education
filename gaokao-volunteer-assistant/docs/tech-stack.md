# 技术栈确认

## 已选

| 模块 | 技术 |
| --- | --- |
| 全栈框架 | Next.js |
| 语言 | TypeScript |
| UI | Tailwind CSS |
| ORM | Prisma |
| 数据库 | PostgreSQL |
| 校验 | Zod |
| 数据处理 | Python 脚本 |
| 版本管理 | Git + GitHub |

## 后续按需加入

- shadcn/ui：当开始沉淀稳定组件时加入；
- TanStack Table：推荐结果和志愿表需要复杂表格时加入；
- Recharts：做位次趋势、梯度分布和回测图表时加入；
- PDF 导出：报告功能进入 P1 后加入；
- RAG/LLM：P2 才加入，只能解释结构化结果，不直接生成关键数值。

## 部署建议

第一版推荐 Vercel + Neon/Supabase PostgreSQL。若后续需要长期任务、对象存储或复杂数据后台，再考虑云服务器。
