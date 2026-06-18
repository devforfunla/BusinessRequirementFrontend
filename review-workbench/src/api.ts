import type {
  AsyncJob,
  AtomicRule,
  BddScenario,
  BddCheckerResult,
  CheckerResult,
  ConfidenceDecision,
  GeneratedTestCase,
  SemanticRule,
  Skill,
  TestIntent,
  Workflow,
  WorkflowBundle
} from "./types";

const API_ROOT =
  import.meta.env.VITE_API_ROOT ?? "/api/v1/business-analysis";
const SKILL_API_ROOT = import.meta.env.VITE_SKILL_API_ROOT ?? "/api/v1/skills";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(`${API_ROOT}${path}`, { method: "GET" });
}

async function apiRequest<T>(
  url: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });
  const body = await response.text();

  if (!response.ok) {
    let message = body || `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(body) as {
        message?: string;
        error?: string;
      };
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      // Preserve the backend response text when it is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (!body) {
    return undefined as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError("The service returned invalid JSON.", response.status);
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(`${API_ROOT}${path}`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function loadSkills(): Promise<Skill[]> {
  return apiRequest<Skill[]>(SKILL_API_ROOT, { method: "GET" });
}

export async function loadWorkflowBundle(
  workflowId: string
): Promise<WorkflowBundle> {
  const id = encodeURIComponent(workflowId);
  const [
    workflow,
    semanticRules,
    atomicRules,
    testIntents,
    testCases,
    bddScenarios,
    jobs,
    skills
  ] = await Promise.all([
    apiGet<Workflow>(`/workflows/${id}`),
    apiGet<SemanticRule[]>(`/workflows/${id}/semantic-rules`),
    apiGet<AtomicRule[]>(`/workflows/${id}/atomic-rules`),
    apiGet<TestIntent[]>(`/workflows/${id}/test-intents`),
    apiGet<GeneratedTestCase[]>(`/workflows/${id}/test-cases`),
    apiGet<BddScenario[]>(`/workflows/${id}/bdd-scenarios`),
    apiGet<AsyncJob[]>(`/jobs?workflowId=${id}`),
    loadSkills().catch(() => [])
  ]);

  return {
    workflow,
    semanticRules,
    atomicRules,
    testIntents,
    testCases,
    bddScenarios,
    jobs,
    skills
  };
}

export async function loadTestCaseReview(versionId: string): Promise<{
  checkerResults: CheckerResult[];
  confidenceDecisions: ConfidenceDecision[];
}> {
  const id = encodeURIComponent(versionId);
  const [checkerResults, confidenceDecisions] = await Promise.all([
    apiGet<CheckerResult[]>(`/test-cases/${id}/checker-results`),
    apiGet<ConfidenceDecision[]>(
      `/test-cases/${id}/confidence-decisions`
    )
  ]);
  return { checkerResults, confidenceDecisions };
}

export async function submitTestCaseCheckerJob(request: {
  testCaseIds: string[];
  benchmarkProfile: string;
  reviewerId: string;
}): Promise<{ jobId: string; status: string; createdAt: string }> {
  return apiPost("/test-case-checker-jobs", request);
}

export async function submitBddGenerationJob(request: {
  workflowId: string;
  testCaseIds: string[];
  generationMode: string;
  reviewerId: string;
}): Promise<{ jobId: string; status: string; createdAt: string }> {
  return apiPost("/bdd-generation-jobs", request);
}

export async function checkBddScenario(
  scenarioId: string,
  reviewerId: string
): Promise<BddCheckerResult> {
  const id = encodeURIComponent(scenarioId);
  return apiPost(`/bdd-scenarios/${id}/check`, { reviewerId });
}
