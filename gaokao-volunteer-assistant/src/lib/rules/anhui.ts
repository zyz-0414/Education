export const anhuiProvinceConfig = {
  provinceCode: "AH",
  provinceName: "安徽",
  examMode: "3+1+2",
  volunteerUnitType: "college_group",
  ordinaryUndergraduate: {
    batchCode: "ordinary_undergraduate",
    maxVolunteers: 45,
    majorsPerGroup: 6,
    hasMajorAdjustment: true,
  },
  firstChoiceSubjects: ["physics", "history"] as const,
  secondChoiceSubjects: ["chemistry", "biology", "politics", "geography"] as const,
} as const;

export type AnhuiFirstChoiceSubject =
  (typeof anhuiProvinceConfig.firstChoiceSubjects)[number];

export type AnhuiSecondChoiceSubject =
  (typeof anhuiProvinceConfig.secondChoiceSubjects)[number];
