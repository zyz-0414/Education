# 第 4 周用户建档和规则过滤

## 完成范围

- 首页已切换为安徽考生建档工作台；
- 支持安徽、普通本科批、物理/历史首选科目和 4 选 2 再选科目；
- 用一分一段表校验分数和位次是否匹配；
- 候选集只查询安徽普通本科批院校专业组；
- 根据院校专业组和专业计划选科要求过滤不符合项；
- 可选择只保留已有招生计划明细的候选组。

## 候选集接口

```text
POST /api/candidate-groups
```

请求示例：

```json
{
  "requirePlan": false,
  "limit": 30,
  "offset": 0,
  "profile": {
    "targetYear": 2025,
    "provinceCode": "AH",
    "batchCode": "ordinary_undergraduate",
    "firstChoiceSubject": "physics",
    "secondChoiceSubjects": ["chemistry", "biology"],
    "score": 550,
    "rank": 70000,
    "riskPreference": "balanced",
    "preferredCities": [],
    "preferredMajorCategories": [],
    "rejectedMajorCategories": []
  }
}
```

返回内容包含：

- `scoreRankCheck`：一分一段命中行、位次区间和校验问题；
- `filters`：普通本科批数量、首选科目数量、选科通过数量、排除数量；
- `items`：候选院校专业组、计划明细、历史最低分/位次和来源状态。

## 当前边界

第四周只生成规则候选集，不做冲稳保分档和推荐排序。计划数据仍是 2025 样例，2026 正式招生计划发布后需要替换正式数据源。
