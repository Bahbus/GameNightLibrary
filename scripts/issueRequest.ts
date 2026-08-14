export type AuthorAssociation =
  | "OWNER"
  | "MEMBER"
  | "COLLABORATOR"
  | "CONTRIBUTOR"
  | "FIRST_TIMER"
  | "FIRST_TIME_CONTRIBUTOR"
  | "NONE";

export function fieldsFromIssue(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  const expression = /^### (.+)\n\n([\s\S]*?)(?=\n### |\s*$)/gm;
  for (const match of body.matchAll(expression)) {
    const value = match[2].trim();
    if (value && value !== "_No response_") fields.set(match[1].trim(), value);
  }
  return fields;
}

export function requestDecision({
  association,
  approved,
  hasRequestLabel
}: {
  association: AuthorAssociation;
  approved: boolean;
  hasRequestLabel: boolean;
}): "automate" | "suggestion" | "ignore" {
  if (!hasRequestLabel) return "ignore";
  if (["OWNER", "MEMBER", "COLLABORATOR"].includes(association) || approved) {
    return "automate";
  }
  return "suggestion";
}
