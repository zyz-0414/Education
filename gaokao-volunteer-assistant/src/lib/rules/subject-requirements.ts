import type {
  AnhuiFirstChoiceSubject,
  AnhuiSecondChoiceSubject,
} from "@/lib/rules/anhui";

export type AnhuiSubject = AnhuiFirstChoiceSubject | AnhuiSecondChoiceSubject;

export const anhuiSubjectLabels: Record<AnhuiSubject, string> = {
  physics: "物理",
  history: "历史",
  chemistry: "化学",
  biology: "生物",
  politics: "思想政治",
  geography: "地理",
};

const subjectMatchers: Array<[AnhuiSubject, RegExp]> = [
  ["physics", /物理/],
  ["history", /历史/],
  ["chemistry", /化学/],
  ["biology", /生物/],
  ["politics", /思想政治|政治/],
  ["geography", /地理/],
];

function normalizeRequirement(requirement: string | null | undefined) {
  return (requirement ?? "")
    .replace(/\s+/g, "")
    .replace(/[＋]/g, "+")
    .replace(/[，、]/g, "+")
    .trim();
}

export function getSelectedAnhuiSubjects(params: {
  firstChoiceSubject: AnhuiFirstChoiceSubject;
  secondChoiceSubjects: AnhuiSecondChoiceSubject[];
}) {
  return [params.firstChoiceSubject, ...params.secondChoiceSubjects];
}

export function getRequiredSubjects(requirement: string | null | undefined): AnhuiSubject[] {
  const normalized = normalizeRequirement(requirement);

  if (!normalized || normalized === "不限") {
    return [];
  }

  return subjectMatchers
    .filter(([subject]) => {
      if (subject === "physics" && /不限/.test(normalized) && !/物理/.test(normalized)) {
        return false;
      }

      if (subject === "history" && /不限/.test(normalized) && !/历史/.test(normalized)) {
        return false;
      }

      return subjectMatchers.find(([candidate]) => candidate === subject)?.[1].test(normalized);
    })
    .map(([subject]) => subject);
}

export function getMissingRequiredSubjects(
  requirement: string | null | undefined,
  selectedSubjects: AnhuiSubject[],
) {
  const selected = new Set(selectedSubjects);

  return getRequiredSubjects(requirement).filter((subject) => !selected.has(subject));
}

export function isSubjectRequirementSatisfied(
  requirement: string | null | undefined,
  selectedSubjects: AnhuiSubject[],
) {
  return getMissingRequiredSubjects(requirement, selectedSubjects).length === 0;
}

export function formatSubjectRequirement(requirement: string | null | undefined) {
  const requiredSubjects = getRequiredSubjects(requirement);

  if (requiredSubjects.length === 0) {
    return "不限";
  }

  return requiredSubjects.map((subject) => anhuiSubjectLabels[subject]).join(" + ");
}
