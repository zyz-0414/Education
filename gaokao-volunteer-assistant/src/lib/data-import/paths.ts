import { join } from "node:path";

export const projectRoot = process.cwd();
export const dataRoot = join(projectRoot, "data");
export const anhuiCleanedDir = join(dataRoot, "cleaned", "anhui");
export const sourceIndexPath = join(dataRoot, "sources", "source_index.csv");

export const cleanedCsvPaths = {
  scoreSegments: join(anhuiCleanedDir, "score_segments.csv"),
  colleges: join(anhuiCleanedDir, "colleges.csv"),
  majors: join(anhuiCleanedDir, "majors.csv"),
  collegeGroups: join(anhuiCleanedDir, "college_groups.csv"),
  enrollmentPlans: join(anhuiCleanedDir, "enrollment_plans.csv"),
  admissionResults: join(anhuiCleanedDir, "admission_results.csv"),
  charterRules: join(anhuiCleanedDir, "charter_rules.csv"),
} as const;
