import { z } from "zod";

export const firstChoiceSubjectSchema = z.enum(["physics", "history"]);
export const secondChoiceSubjectSchema = z.enum([
  "chemistry",
  "biology",
  "politics",
  "geography",
]);

export const candidateProfileSchema = z.object({
  targetYear: z.coerce.number().int().min(2024).max(2026).default(2025),
  provinceCode: z.literal("AH"),
  batchCode: z.literal("ordinary_undergraduate"),
  firstChoiceSubject: firstChoiceSubjectSchema,
  secondChoiceSubjects: z.array(secondChoiceSubjectSchema).length(2),
  score: z.coerce.number().int().min(0).max(750),
  rank: z.coerce.number().int().positive(),
  riskPreference: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
  tuitionLimit: z.coerce.number().int().positive().optional(),
  preferredCities: z.array(z.string()).default([]),
  preferredMajorCategories: z.array(z.string()).default([]),
  rejectedMajorCategories: z.array(z.string()).default([]),
}).superRefine((profile, ctx) => {
  const uniqueSecondChoices = new Set(profile.secondChoiceSubjects);

  if (uniqueSecondChoices.size !== profile.secondChoiceSubjects.length) {
    ctx.addIssue({
      code: "custom",
      message: "再选科目不能重复",
      path: ["secondChoiceSubjects"],
    });
  }
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
export type CandidateFirstChoiceSubject = z.infer<typeof firstChoiceSubjectSchema>;
export type CandidateSecondChoiceSubject = z.infer<typeof secondChoiceSubjectSchema>;
