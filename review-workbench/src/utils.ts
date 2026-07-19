export interface ParsedText {
  value: unknown;
  raw: string;
  error?: string;
}

export function parseJsonText(input?: string | null): ParsedText {
  const raw = input?.trim() ?? "";
  if (!raw) {
    return { value: null, raw: "" };
  }

  try {
    return { value: JSON.parse(raw) as unknown, raw };
  } catch {
    return {
      value: raw,
      raw,
      error: "Stored value is not valid JSON; raw text is shown."
    };
  }
}

export function displayText(input?: string | null): string {
  const parsed = parseJsonText(input);
  if (parsed.value === null) {
    return "Not recorded";
  }
  if (typeof parsed.value === "string") {
    return parsed.value;
  }
  return JSON.stringify(parsed.value, null, 2);
}

export function isActiveJobStatus(status?: string | null): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

export function statusTone(status?: string | null):
  | "positive"
  | "active"
  | "warning"
  | "negative"
  | "neutral" {
  switch (status) {
    case "APPROVED":
    case "READY":
    case "SUCCEEDED":
    case "VERIFIED":
    case "PASS":
    case "HIGH":
      return "positive";
    case "QUEUED":
    case "RUNNING":
      return "active";
    case "DRAFT":
    case "REOPENED":
    case "PARTIAL_SUCCESS":
    case "MEDIUM":
      return "warning";
    case "FAILED":
    case "REJECTED":
    case "BLOCKED":
    case "STALE":
    case "LOW":
      return "negative";
    default:
      return "neutral";
  }
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "Not recorded";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function sortNewest<T extends { updatedAt?: string; createdAt?: string }>(
  values: T[]
): T[] {
  return [...values].sort((left, right) => {
    const leftValue = left.updatedAt ?? left.createdAt ?? "";
    const rightValue = right.updatedAt ?? right.createdAt ?? "";
    return rightValue.localeCompare(leftValue);
  });
}

export function isCurrentBddScenario(scenario: {
  status?: string | null;
  staleAt?: string | null;
}): boolean {
  return scenario.status !== "STALE" && scenario.status !== "ARCHIVED" && !scenario.staleAt;
}

export function sortBddScenarios<
  T extends {
    status?: string | null;
    staleAt?: string | null;
    updatedAt?: string;
    createdAt?: string;
  }
>(values: T[]): T[] {
  return [...values].sort((left, right) => {
    const leftHistory = isCurrentBddScenario(left) ? 0 : 1;
    const rightHistory = isCurrentBddScenario(right) ? 0 : 1;
    if (leftHistory !== rightHistory) {
      return leftHistory - rightHistory;
    }
    const leftValue = left.updatedAt ?? left.createdAt ?? "";
    const rightValue = right.updatedAt ?? right.createdAt ?? "";
    return rightValue.localeCompare(leftValue);
  });
}

export function currentBddScenarios<
  T extends {
    status?: string | null;
    staleAt?: string | null;
    updatedAt?: string;
    createdAt?: string;
  }
>(values: T[]): T[] {
  return sortBddScenarios(values.filter(isCurrentBddScenario));
}
