# 第 5 周推荐算法

## 完成范围

- 新增安徽普通本科批推荐生成接口；
- 基于候选集继续计算参考位次；
- 支持冲、稳、保、过保和高危分档；
- 根据风险偏好、城市偏好、专业偏好、排斥方向、学费预算和招生计划明细计算偏好评分；
- 按综合推荐分排序；
- 对历史数据不足、OCR 样例、招生计划样例、缺少计划明细和位次波动较大的结果标记低置信度。

第 5 周只完成推荐能力和接口，不做第 6 周的推荐结果页。

## 推荐接口

```text
POST /api/recommendations
```

请求示例：

```json
{
  "requirePlan": true,
  "includeHighRisk": false,
  "limit": 45,
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

正式推荐默认要求有当年招生计划明细。关闭 `requirePlan` 只适合排查 OCR 历史样例，不应作为填报建议。

返回内容在第 4 周候选集字段基础上，为每个院校专业组新增：

- `recommendation.tier`：`reach`、`match`、`safe`、`very_safe`、`high_risk` 或 `null`；
- `recommendation.tierLabel`：冲、稳、保、过保、高危或待确认；
- `recommendation.referenceRank`：加权后的预测参考位次；
- `recommendation.rankGapRatio`：考生位次与参考位次差值比例；
- `recommendation.preferenceScore`：偏好评分；
- `recommendation.recommendationScore`：排序用综合分；
- `recommendation.lowConfidence`：是否低置信度；
- `recommendation.confidenceReasons`：低置信度原因；
- `recommendation.explanations`：结构化推荐说明。

## 位次模型

当前版本使用改革后同口径历史投档位次：

```text
参考位次 =
  最近一年最低位次 * 0.6
+ 上一年最低位次 * 0.4
+ 招生计划变化修正
+ 位次波动保守修正
```

当只有一年历史最低位次时，仍计算参考位次，但标为低置信度。没有历史最低位次时，推荐项保留为待确认。

## 分档规则

```text
rank_gap_ratio = (考生位次 - 参考位次) / 参考位次
```

| 档位 | 规则 |
| --- | --- |
| 冲 | 0% 到 +8% |
| 稳 | -12% 到 0% |
| 保 | -30% 到 -12% |
| 过保 | 小于 -30% |
| 高危 | 大于 +8% |

## 验证命令

```bash
npm run test:week5
npm run verify:week5
```
