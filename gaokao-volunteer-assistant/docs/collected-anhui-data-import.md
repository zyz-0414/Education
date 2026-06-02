# 安徽收集数据导入说明

本轮数据更新使用用户放置在 `D:\education\data` 下的安徽 Excel 数据，覆盖项目原先的开发样例 CSV。清洗脚本为：

```bash
python -m pip install -r data/requirements.txt
npm run data:prepare
npm run verify:data
npm run data:import
```

如果本机默认 `python` 未安装 `openpyxl`，需要先执行上面的依赖安装；Codex 本次验证使用内置 Python 跑通了同一脚本。

## 采用年份

当前推荐模型按“院校专业组”作为志愿单位。安徽 2024 年起使用新高考专业组口径，因此本轮正式接入：

- 2024 一分一段、普通本科批招生计划、普通本科批专业组投档线；
- 2025 一分一段、普通本科批招生计划、普通本科批专业组投档线；
- 2025 专业录取分数线仅用于补充院校省份、城市、公私性质，不直接写入推荐历史位次。

2017-2023 数据仍保留在原始目录中，但属于文理科旧口径或院校/专业口径，暂不混入 2026 前的专业组推荐模型，避免把不同志愿单位直接加权。

## 生成规模

本次生成并导入：

| 表 | 行数 |
| --- | ---: |
| `score_segments.csv` | 1,934 |
| `college_groups.csv` | 9,507 |
| `enrollment_plans.csv` | 47,401 |
| `admission_results.csv` | 8,723 |
| `colleges.csv` | 1,710 |
| `majors.csv` | 20,455 |

默认样例档案（2025 安徽普通本科批，物理，化学+生物，550 分，70000 位）在 `requirePlan=true` 下，可推荐结果由原先样例数据下的 2 条提升到 294 条。

## 注意事项

- 2026 招生计划尚未公布，当前仍以 2025 作为可报专业明细和最近一年投档参考。
- 安徽院校代码存在跨年复用，`college` 主表继续只作代码级基础信息，展示和历史匹配以 `college_groups.college_name` 年度快照为准。
- `data:import` 已改为批量替换型导入，适配几万行 cleaned CSV；导入前仍应先跑 `npm run data:validate`。
