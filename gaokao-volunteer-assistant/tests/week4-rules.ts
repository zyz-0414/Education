import assert from "node:assert/strict";

import {
  formatSubjectRequirement,
  getSelectedAnhuiSubjects,
  isSubjectRequirementSatisfied,
} from "@/lib/rules/subject-requirements";
import { candidateProfileSchema } from "@/lib/validators/profile";

const physicsChemistryProfile = candidateProfileSchema.parse({
  targetYear: 2025,
  provinceCode: "AH",
  batchCode: "ordinary_undergraduate",
  firstChoiceSubject: "physics",
  secondChoiceSubjects: ["chemistry", "biology"],
  score: 550,
  rank: 70000,
});

const selectedSubjects = getSelectedAnhuiSubjects(physicsChemistryProfile);

assert.equal(isSubjectRequirementSatisfied("不限", selectedSubjects), true);
assert.equal(isSubjectRequirementSatisfied("化学", selectedSubjects), true);
assert.equal(isSubjectRequirementSatisfied("物理 + 化学", selectedSubjects), true);
assert.equal(isSubjectRequirementSatisfied("思想政治", selectedSubjects), false);
assert.equal(formatSubjectRequirement("物理 + 化学"), "物理 + 化学");

const duplicateSecondChoices = candidateProfileSchema.safeParse({
  targetYear: 2025,
  provinceCode: "AH",
  batchCode: "ordinary_undergraduate",
  firstChoiceSubject: "physics",
  secondChoiceSubjects: ["chemistry", "chemistry"],
  score: 550,
  rank: 70000,
});

assert.equal(duplicateSecondChoices.success, false);

console.log("Week 4 rule tests OK");
