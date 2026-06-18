export interface Workflow {
  id: string;
  documentId: string;
  triggeredBy?: string | null;
  status: string;
  currentStage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SemanticRule {
  id: string;
  llmSemanticRuleCode: string;
  workflowId: string;
  documentId: string;
  llmBusinessIntent?: string | null;
  llmSummary?: string | null;
  llmSection?: string | null;
  llmOutputJson?: string | null;
  approvalStatus: string;
  semanticVersion: number;
  changeType: string;
  isLatest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AtomicRule {
  id: string;
  semanticRuleId: string;
  llmSemanticRuleCode: string;
  llmAtomicRuleCode: string;
  llmRuleType: string;
  llmSubtype?: string | null;
  llmSummary: string;
  llmOutputJson?: string | null;
  llmSection: string;
  workflowId: string;
  atomicVersion: number;
  changeType: string;
  isLatest: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestIntent {
  id: string;
  testIntentId: string;
  workflowId: string;
  generationJobId: string;
  businessCapabilityId?: string | null;
  testLevel: string;
  intentType: string;
  readinessStatus: string;
  blockedReason?: string | null;
  sourceRules?: string | null;
  intentJson: string;
  createdAt: string;
}

export interface GeneratedTestCase {
  id: string;
  testCaseId: string;
  versionNumber: number;
  isLatest: boolean;
  changeType: string;
  parentVersionId?: string | null;
  revisionJobId?: string | null;
  workflowId: string;
  atomicRuleId: string;
  ruleId: string;
  sourceVersionNumber: number;
  semanticRuleId: string;
  testIntentId?: string | null;
  generationJobId: string;
  title: string;
  scenarioType: string;
  priority: string;
  preconditions?: string | null;
  steps?: string | null;
  expectedResults?: string | null;
  dependencyTraceability?: string | null;
  assumptions?: string | null;
  unsupportedInferences?: string | null;
  openQuestions?: string | null;
  normalizedTestCaseJson?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckerResult {
  id: string;
  workflowId: string;
  targetTestCaseId: string;
  atomicRuleId?: string | null;
  testIntentId?: string | null;
  checkerJobId: string;
  isPassing: boolean;
  totalScore: number;
  dimensionScores?: string | null;
  findings?: string | null;
  recommendedActions?: string | null;
  blockingCategory?: string | null;
  benchmarkProfile?: string | null;
  checkedAt: string;
}

export interface ConfidenceDecision {
  id: string;
  workflowId: string;
  targetTestCaseId: string;
  atomicRuleId?: string | null;
  testIntentId?: string | null;
  checkerJobId?: string | null;
  confidenceLevel: string;
  rationale?: string | null;
  reviewerId?: string | null;
  decidedAt: string;
}

export interface BddScenario {
  id: string;
  workflowId: string;
  generatedTestCaseId: string;
  atomicRuleId: string;
  ruleId: string;
  sourceVersionNumber: number;
  generationJobId: string;
  featureTitle: string;
  scenarioTitle: string;
  normalizedBdd: string;
  gherkinText: string;
  assumptions?: string | null;
  traceability?: string | null;
  staleAt?: string | null;
  staleReason?: string | null;
  supersededByTestCaseVersionId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AsyncJob {
  id: string;
  workflowId?: string | null;
  documentId?: string | null;
  jobType: string;
  status: string;
  resultPayload?: string | null;
  errorMessage?: string | null;
  triggeredByJobId?: string | null;
  latestMakerJobId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  category: "EXTRACTOR" | "CHECKER" | string;
  workflowStage: "SEMANTIC_ANALYSIS" | "ATOMIC_ANALYSIS" | "TEST_CASE" | "BDD" | string;
  version: number;
  status: string;
  changeLog?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BddCheckerResult {
  bddScenarioId: string;
  workflowId: string;
  isPassing: boolean;
  totalScore: number;
  dimensionScores: Record<string, number>;
  findings: string[];
  recommendedActions: string[];
  blockingCategory: string;
  readiness: string;
  reviewerId: string;
  checkedAt: string;
}

export interface WorkflowBundle {
  workflow: Workflow;
  semanticRules: SemanticRule[];
  atomicRules: AtomicRule[];
  testIntents: TestIntent[];
  testCases: GeneratedTestCase[];
  bddScenarios: BddScenario[];
  jobs: AsyncJob[];
  skills: Skill[];
}
