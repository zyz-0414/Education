import { z } from "zod";

export const candidateProfileSchema = z.object({
  provinceCode: z.literal("AH"),
  batchCode: z.literal("ordinary_undergraduate"),
  firstChoiceSubject: z.enum(["physics", "history"]),
  secondChoiceSubjects: z.array(z.enum(["chemistry", "biology", "politics", "geography"])).length(2),
  score: z.number().int().min(0).max(750).optional(),
  rank: z.number().int().positive(),
  riskPreference: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
  tuitionLimit: z.number().int().positive().optional(),
  preferredCities: z.array(z.string()).default([]),
  preferredMajorCategories: z.array(z.string()).default([]),
  rejectedMajorCategories: z.array(z.string()).default([]),
});

export type CandidateProfile = z.infer<typeof candidateProfileSchema>;
