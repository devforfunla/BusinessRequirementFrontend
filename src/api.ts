import axios from 'axios'

export type JsonRecord = Record<string, unknown>

export type DocumentRecord = {
  id: string
  fileName: string
  fileType?: string | null
  fileSize?: number | null
  fileHash?: string | null
  totalPages?: number | null
  reviewerId: string
  transformStatus: string
  structuredMarkdown?: string | null
  transformModelVersion?: string | null
  transformTimestamp?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type DocumentUploadResponse = {
  documentId: string
  fileName: string
  fileType?: string | null
  fileSize?: number | null
  status: string
  reviewerId: string
  createdAt?: string | null
}

export type JobResponse = {
  jobId: string
  status: string
  createdAt?: string | null
  documentId?: string | null
  workflowId?: string | null
}

export type AsyncJob = {
  id: string
  batchId?: string | null
  workflowId?: string | null
  documentId?: string | null
  jobType: string
  status: string
  inputPayload?: string | null
  resultPayload?: string | null
  errorMessage?: string | null
  triggeredByJobId?: string | null
  latestMakerJobId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type ExtractionGroup = {
  id: string
  jobId: string
  workflowId: string
  groupPrefix: string
  semanticRuleIds?: string | null
  semanticRuleCount: number
  status: string
  atomicRulesCount: number
  errorMessage?: string | null
  createdAt?: string | null
}

export type WorkflowRecord = {
  id: string
  documentId: string
  triggeredBy?: string | null
  status: string
  currentStage?: string | null
  atomicMakerSkill?: SkillSummary | null
  checkerSkill?: SkillSummary | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SkillSummary = {
  id: string
  name: string
  displayName?: string | null
  version: number
}

export type SemanticRule = {
  id: string
  semanticRuleCode?: string | null
  llmSemanticRuleCode?: string | null
  workflowId: string
  documentId?: string | null
  semanticVersion?: number | null
  changeType?: string | null
  approvalStatus: string
  summary?: string | null
  llmSummary?: string | null
  businessIntent?: string | null
  llmBusinessIntent?: string | null
  llmSection?: string | null
  llmOutputJson?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SemanticRuleRewriteMode = 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'

export type AtomicRule = {
  id: string
  atomicRuleCode?: string | null
  llmAtomicRuleCode?: string | null
  workflowId: string
  atomicVersion?: number | null
  changeType?: string | null
  status: string
  semanticRuleCode?: string | null
  llmSemanticRuleCode?: string | null
  semanticRuleId?: string | null
  content?: string | null
  llmOutputJson?: string | null
  llmSummary?: string | null
  llmSection?: string | null
  humanInterventionId?: string | null
  makerJobId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type AtomicRuleOperationResponse = {
  id: string
  atomicRuleCode?: string | null
  workflowId: string
  atomicVersion?: number | null
  changeType?: string | null
  status: string
  semanticRuleCode?: string | null
  content?: string | null
  humanInterventionId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type FieldDiff = {
  changed: boolean
  oldValue?: string | null
  newValue?: string | null
}

export type RuleCompareResponse = {
  atomicRuleCode: string
  version1: AtomicRule
  version2: AtomicRule
  diff: Record<string, FieldDiff>
}

export type CheckerRun = {
  id: string
  checkerJobId: string
  workflowId?: string | null
  documentId?: string | null
  checkScope?: string | null
  calcGovernanceGate?: string | null
  calcSummaryJson?: string | null
  calcGovernanceMetricsJson?: string | null
  llmHighLevelFeedback?: string | null
  calcRecommendedAction?: string | null
  rawOutputJson?: string | null
  model?: string | null
  checkedAt?: string | null
}

export type SemanticCheckerResult = {
  id: string
  targetSemanticRuleId: string
  workflowId?: string | null
  checkerJobId: string
  semanticCheckerRunId?: string | null
  llmIsPassing: string
  llmFindings?: string | null
  calcBlockingCategory?: string | null
  calcQualityScore?: string | null
  llmReviewEntry?: string | null
  checkedAt?: string | null
  model?: string | null
}

export type AtomicCheckerResult = {
  id: string
  targetRuleId: string
  targetRuleType?: string | null
  workflowId?: string | null
  checkerJobId: string
  atomicCheckerRunId?: string | null
  llmIsPassing: string
  llmFindings?: string | null
  calcBlockingCategory?: string | null
  calcQualityScore?: string | null
  llmReviewEntry?: string | null
  checkedAt?: string | null
  model?: string | null
}

export type TestCaseGenerationBatch = {
  id: string
  sourceWorkflowId: string
  sourceDocumentId?: string | null
  sourceRulesSnapshot?: string | null
  triggeredBy?: string | null
  makerSkillId?: string | null
  checkerSkillId?: string | null
  status: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type GeneratedTestCase = {
  id: string
  batchId: string
  sourceAtomicRuleId: string
  sourceAtomicRuleCode?: string | null
  sourceSemanticRuleCode?: string | null
  calcTestCaseCode?: string | null
  llmTestCaseTitle?: string | null
  llmObjective?: string | null
  llmRuleUnderTest?: string | null
  llmPreconditions?: string | null
  llmTestSteps?: string | null
  llmExpectedResult?: string | null
  llmTestData?: string | null
  llmVariants?: string | null
  llmAssumptions?: string | null
  llmTraceability?: string | null
  llmPriority?: string | null
  llmTestType?: string | null
  llmOutputJson?: string | null
  makerJobId?: string | null
  testCaseVersion: number
  isLatest: boolean
  approvalStatus: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type TestCaseCheckerRun = {
  id: string
  checkerJobId: string
  batchId: string
  checkScope?: string | null
  sourceSemanticRuleCode?: string | null
  targetTestCaseId?: string | null
  llmHighLevelFeedback?: string | null
  llmRunFindings?: string | null
  llmRecommendations?: string | null
  calcGovernanceGate?: string | null
  calcSummaryJson?: string | null
  calcGovernanceMetricsJson?: string | null
  calcRecommendedAction?: string | null
  rawOutputJson?: string | null
  model?: string | null
  checkedAt?: string | null
}

export type TestCaseCheckerResult = {
  id: string
  checkerRunId: string
  checkerJobId: string
  batchId: string
  targetTestCaseId: string
  sourceAtomicRuleId?: string | null
  sourceAtomicRuleCode?: string | null
  sourceSemanticRuleCode?: string | null
  llmFindings?: string | null
  llmDimensionReviews?: string | null
  llmRecommendations?: string | null
  llmReviewEntry?: string | null
  calcIsPassing?: string | null
  calcQualityScore?: string | null
  calcBlockingCategory?: string | null
  calcRecommendedAction?: string | null
  model?: string | null
  checkedAt?: string | null
}

export type TestCaseGenerationResponse = {
  jobId: string
  batchId: string
  status: string
}

export type TestCaseJobResponse = {
  id: string
  batchId: string
  jobType: string
  status: string
  inputPayload?: string | null
  resultPayload?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

function toWorkflowJob(job: TestCaseJobResponse, workflowId: string): AsyncJob {
  return {
    id: job.id,
    batchId: job.batchId,
    workflowId,
    jobType: job.jobType,
    status: normalizeJobStatus(job.status),
    inputPayload: job.inputPayload,
    resultPayload: job.resultPayload,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

function sortJobsByActivityDesc(jobs: AsyncJob[]) {
  return [...jobs].sort((a, b) => jobActivityTime(b) - jobActivityTime(a))
}

function jobActivityTime(job: AsyncJob) {
  return Date.parse(job.updatedAt || job.createdAt || '') || 0
}

export type TestCaseRewriteMode = 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'

export type TestCaseEditPayload = {
  editorId: string
  title: string
  objective: string
  ruleUnderTest?: JsonRecord
  preconditions?: string[]
  testData?: JsonRecord
  testSteps: Array<JsonRecord>
  expectedResult: string
  variants?: Array<JsonRecord>
  priority: string
  testType: string
  assumptions?: string[]
  traceability?: JsonRecord
}

export type Skill = {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  category: 'EXTRACTOR' | 'CHECKER' | string
  workflowStage: 'SEMANTIC_ANALYSIS' | 'ATOMIC_ANALYSIS' | 'TEST_CASE' | 'BDD' | string
  version: number
  status: string
  skillContent?: string | null
  changeLog?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SkillResource = {
  id: string
  skillId: string
  version: number
  resourceType: string
  fileName: string
  fileContent?: string | null
  mimeType?: string | null
  sortOrder: number
}

export type SkillDetail = {
  skill: Skill
  resources: SkillResource[]
  used: boolean
}

export type ChangeHistoryItem = {
  id: string
  changeType: string
  timestamp?: string | null
  status?: string | null
  affectedRules?: Array<JsonRecord>
}

export type ApplicationLogResponse = {
  fileName: string
  fileSize: number
  lastModified?: string | null
  requestedTail: number
  returnedLines: number
  lines: string[]
}

export type WorkflowTraceRecord = {
  id: string
  documentId: string
  triggeredBy?: string | null
  atomicMakerSkillId?: string | null
  checkerSkillId?: string | null
  status: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type LlmAgentSession = {
  id: string
  jobId: string
  workflowId?: string | null
  jobType: string
  model?: string | null
  skillName?: string | null
  skillId?: string | null
  skillVersion?: string | null
  finalStatus: string
  validationPassed?: boolean | null
  totalRounds?: number | null
  totalDurationMs?: number | null
  finalValidationMessage?: string | null
  totalPromptTokens?: number | null
  totalCompletionTokens?: number | null
  totalTokens?: number | null
  createdAt?: string | null
  completedAt?: string | null
}

export type LlmCallAudit = {
  id: string
  agentSessionId?: string | null
  llmCallId: string
  workflowId?: string | null
  jobId?: string | null
  jobType: string
  iterationRound?: number | null
  model: string
  status: string
  retryCount?: number | null
  durationMs?: number | null
  prompt: string
  response?: string | null
  errorMessage?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  createdAt?: string | null
}

export type AgentTrace = {
  session: LlmAgentSession
  llmCalls: LlmCallAudit[]
}

export type JobTraceResponse = {
  job: AsyncJob
  workflow?: WorkflowTraceRecord | null
  agentSessions: AgentTrace[]
  unscopedLlmCalls: LlmCallAudit[]
}

const http = axios.create({
  baseURL: '/api/v1',
  headers: {
    Accept: 'application/json',
  },
})

const testCaseHttp = axios.create({
  baseURL: '/testcase-api/v1',
  headers: {
    Accept: 'application/json',
  },
})

const fromResponse = <T>(request: Promise<{ data: T }>) => request.then((response) => response.data)

const optionalFromResponse = <T>(request: Promise<{ status: number; data: T }>) =>
  request.then((response) => (response.status === 204 ? null : response.data))

const nullableFromResponse = <T>(request: Promise<{ status: number; data: T }>) =>
  request
    .then((response) => (response.status === 204 ? null : response.data))
    .catch((error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null
      throw error
    })

const atomicPath = (path: string) => `/atomic-analysis${path}`
const semanticPath = (path: string) => `/semantic-analysis${path}`
const businessPath = (path: string) => `/business-analysis${path}`

export const documentsApi = {
  list: () => fromResponse<DocumentRecord[]>(http.get(businessPath('/documents'))),
  listByReviewer: (reviewerId: string) =>
    fromResponse<DocumentRecord[]>(http.get(businessPath(`/documents/reviewer/${encodeURIComponent(reviewerId)}`))),
  get: (documentId: string) =>
    fromResponse<DocumentRecord>(http.get(businessPath(`/documents/${encodeURIComponent(documentId)}`))),
  upload: (file: File, reviewerId: string) => {
    const body = new FormData()
    body.append('file', file)
    body.append('reviewerId', reviewerId)
    return fromResponse<DocumentUploadResponse>(
      http.post(businessPath('/documents/upload'), body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    )
  },
  transform: (documentId: string) =>
    fromResponse<DocumentRecord>(http.post(businessPath(`/documents/${encodeURIComponent(documentId)}/transform`))),
  delete: (documentId: string) =>
    fromResponse<{ message: string }>(http.delete(businessPath(`/documents/${encodeURIComponent(documentId)}`))),
}

export const jobsApi = {
  get: (jobId: string) => fromResponse<AsyncJob>(http.get(`/business-analysis/jobs/${encodeURIComponent(jobId)}`)),
  listByWorkflow: (workflowId: string, jobType?: string) =>
    fromResponse<AsyncJob[]>(
      http.get('/business-analysis/jobs', {
        params: { workflowId, jobType },
      }),
    ),
  listUnifiedByWorkflow: async (workflowId: string) => {
    const [businessJobs, testCaseJobs] = await Promise.all([
      jobsApi.listByWorkflow(workflowId),
      fromResponse<TestCaseJobResponse[]>(
        testCaseHttp.get('/test-generation/jobs', {
          params: { sourceWorkflowId: workflowId },
        }),
      ),
    ])
    return sortJobsByActivityDesc([
      ...businessJobs.map((job) => ({ ...job, status: normalizeJobStatus(job.status) })),
      ...testCaseJobs.map((job) => toWorkflowJob(job, workflowId)),
    ])
  },
  affectedRules: (jobId: string) =>
    fromResponse<JsonRecord>(http.get(atomicPath(`/jobs/${encodeURIComponent(jobId)}/affected-rules`))),
  changes: (jobId: string) => fromResponse<JsonRecord>(http.get(atomicPath(`/jobs/${encodeURIComponent(jobId)}/changes`))),
}

export const workflowsApi = {
  list: (documentId?: string, activeOnly = true) =>
    fromResponse<WorkflowRecord[]>(
      http.get(businessPath('/workflows'), {
        params: { documentId: documentId || undefined, activeOnly },
      }),
    ),
  get: (workflowId: string) =>
    fromResponse<WorkflowRecord>(http.get(businessPath(`/workflows/${encodeURIComponent(workflowId)}`))),
  history: (workflowId: string) =>
    fromResponse<ChangeHistoryItem[]>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/change-history`))),
  activate: (workflowId: string) =>
    fromResponse<WorkflowRecord>(http.post(businessPath(`/workflows/${encodeURIComponent(workflowId)}/activate`))),
}

export const semanticMakerApi = {
  extract: (documentId: string, reviewerId: string, confirmReExtract = false) =>
    fromResponse<JobResponse>(
      http.post(semanticPath('/maker/extract'), {
        documentId,
        reviewerId,
        confirmReExtract,
      }),
    ),
}

export const semanticRulesApi = {
  get: (semanticRuleId: string) =>
    fromResponse<SemanticRule>(http.get(semanticPath(`/semantic-rules/${encodeURIComponent(semanticRuleId)}`))),
  byWorkflow: (workflowId: string) =>
    fromResponse<SemanticRule[]>(http.get(semanticPath(`/workflows/${encodeURIComponent(workflowId)}/semantic-rules`))),
  byDocument: (documentId: string) =>
    fromResponse<SemanticRule[]>(http.get(semanticPath(`/documents/${encodeURIComponent(documentId)}/semantic-rules`))),
  approve: (semanticRuleId: string, approverId: string) =>
    fromResponse<SemanticRule>(
      http.post(semanticPath(`/semantic-rules/${encodeURIComponent(semanticRuleId)}/approve`), { approverId }),
    ),
  reject: (semanticRuleId: string, reviewerId: string, reason?: string) =>
    fromResponse<SemanticRule>(
      http.post(semanticPath(`/semantic-rules/${encodeURIComponent(semanticRuleId)}/reject`), { reviewerId, reason }),
    ),
  approveAll: (workflowId: string, approverId: string) =>
    fromResponse<JsonRecord>(
      http.post(semanticPath(`/workflows/${encodeURIComponent(workflowId)}/semantic-rules/approve-all`), { approverId }),
    ),
  approvalStatus: (workflowId: string) =>
    fromResponse<JsonRecord>(http.get(semanticPath(`/workflows/${encodeURIComponent(workflowId)}/semantic-rules/approval-status`))),
  rewrite: (
    semanticRuleId: string,
    payload: { workflowId: string; rewriteMode: SemanticRuleRewriteMode; humanFeedback?: string },
  ) => fromResponse<JobResponse>(http.post(semanticPath(`/semantic-rules/${encodeURIComponent(semanticRuleId)}/rewrite`), payload)),
  editByHuman: (semanticRuleId: string, editedContent: JsonRecord, editorId: string) =>
    fromResponse<SemanticRule>(
      http.post(semanticPath(`/semantic-rules/${encodeURIComponent(semanticRuleId)}/edit-by-human`), {
        editedContent,
        editorId,
      }),
    ),
}

export const semanticCheckerApi = {
  run: (workflowId: string) => fromResponse<JobResponse>(http.post(semanticPath(`/checker/workflow/${encodeURIComponent(workflowId)}`))),
  latestRun: (workflowId: string) =>
    optionalFromResponse<CheckerRun>(http.get(semanticPath(`/checker/workflow/${encodeURIComponent(workflowId)}/latest-run`))),
  latestResults: (workflowId: string) =>
    fromResponse<SemanticCheckerResult[]>(
      http.get(semanticPath(`/checker/workflow/${encodeURIComponent(workflowId)}/latest-results`)),
    ),
  resultsByRule: (ruleId: string) =>
    fromResponse<SemanticCheckerResult[]>(http.get(semanticPath(`/checker/rules/${encodeURIComponent(ruleId)}/results`))),
  latestResultByRule: (ruleId: string) =>
    optionalFromResponse<SemanticCheckerResult>(http.get(semanticPath(`/checker/rules/${encodeURIComponent(ruleId)}/latest-result`))),
}

export const atomicMakerApi = {
  extractAtomic: (workflowId: string, reviewerId: string) =>
    fromResponse<JobResponse>(
      http.post(atomicPath(`/maker/extract-atomic/${encodeURIComponent(workflowId)}`), null, {
        params: { reviewerId },
      }),
    ),
  extractionGroups: (workflowId: string) =>
    fromResponse<ExtractionGroup[]>(
      http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/extraction-groups`)),
    ),
}

export const atomicRulesApi = {
  get: (atomicRuleId: string) =>
    fromResponse<AtomicRule>(http.get(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}`))),
  byWorkflow: (workflowId: string) =>
    fromResponse<AtomicRule[]>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/atomic-rules`))),
  allVersionsByWorkflow: (workflowId: string) =>
    fromResponse<AtomicRule[]>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/atomic-rules/all-versions`))),
  approve: (atomicRuleId: string, approverId: string) =>
    fromResponse<AtomicRuleOperationResponse>(http.post(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}/approve`), { approverId })),
  reopen: (atomicRuleId: string, userId: string) =>
    fromResponse<AtomicRuleOperationResponse>(http.post(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}/reopen`), { userId })),
  editByHuman: (atomicRuleId: string, editedContent: JsonRecord, editorId: string) =>
    fromResponse<AtomicRuleOperationResponse>(
      http.post(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}/edit-by-human`), {
        editedContent,
        editorId,
      }),
    ),
  compareVersions: (atomicRuleCode: string, workflowId: string, version1: number, version2: number) =>
    fromResponse<RuleCompareResponse>(
      http.get(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleCode)}/compare`), {
        params: { workflowId, version1, version2 },
      }),
    ),
  versionHistory: (atomicRuleCode: string, workflowId: string) =>
    fromResponse<AtomicRule[]>(http.get(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleCode)}/versions`), {
      params: { workflowId },
    })),
  bulkApprove: (ruleIds: string[], approverId: string) =>
    fromResponse<{ approved: number; total: number }>(
      http.post(atomicPath('/atomic-rules/approve-bulk'), { ruleIds, approverId }),
    ),
}

export const atomicCheckerApi = {
  run: (workflowId: string) => fromResponse<JobResponse>(http.post(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}`))),
  latestRun: (workflowId: string) =>
    optionalFromResponse<CheckerRun>(http.get(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}/latest-run`))),
  allRuns: (workflowId: string) =>
    fromResponse<CheckerRun[]>(http.get(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}/runs`))),
  runsByJob: (jobId: string) =>
    fromResponse<CheckerRun[]>(http.get(atomicPath(`/checker/jobs/${encodeURIComponent(jobId)}/runs`))),
  latestResults: (workflowId: string) =>
    fromResponse<AtomicCheckerResult[]>(http.get(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}/latest-results`))),
  latestResultByRule: (ruleId: string) =>
    optionalFromResponse<AtomicCheckerResult>(http.get(atomicPath(`/checker/rules/${encodeURIComponent(ruleId)}/latest-result`))),
}

export const testCaseMakerApi = {
  generate: (sourceWorkflowId: string, reviewerId: string, confirmReGenerate = false) =>
    fromResponse<TestCaseGenerationResponse>(
      testCaseHttp.post('/test-generation/maker/generate', {
        sourceWorkflowId,
        reviewerId,
        confirmReGenerate,
      }),
    ),
}

export const testCaseBatchesApi = {
  list: (sourceWorkflowId?: string) =>
    fromResponse<TestCaseGenerationBatch[]>(
      testCaseHttp.get('/test-generation/batches', {
        params: { sourceWorkflowId: sourceWorkflowId || undefined },
      }),
    ),
  get: (batchId: string) =>
    fromResponse<TestCaseGenerationBatch>(testCaseHttp.get(`/test-generation/batches/${encodeURIComponent(batchId)}`)),
  activate: (batchId: string) =>
    fromResponse<TestCaseGenerationBatch>(
      testCaseHttp.post(`/test-generation/batches/${encodeURIComponent(batchId)}/activate`),
    ),
}

export const testCaseJobsApi = {
  get: (jobId: string) => fromResponse<TestCaseJobResponse>(testCaseHttp.get(`/test-generation/jobs/${encodeURIComponent(jobId)}`)),
  listByBatch: (batchId: string) =>
    fromResponse<TestCaseJobResponse[]>(
      testCaseHttp.get('/test-generation/jobs', {
        params: { batchId },
      }),
    ),
  listBySourceWorkflow: (sourceWorkflowId: string) =>
    fromResponse<TestCaseJobResponse[]>(
      testCaseHttp.get('/test-generation/jobs', {
        params: { sourceWorkflowId },
      }),
    ),
}

export const testCasesApi = {
  listLatest: () => fromResponse<GeneratedTestCase[]>(testCaseHttp.get('/test-generation/test-cases')),
  byBatch: (batchId: string, latestOnly = true) =>
    fromResponse<GeneratedTestCase[]>(
      testCaseHttp.get(`/test-generation/batches/${encodeURIComponent(batchId)}/test-cases`, {
        params: { latestOnly },
      }),
    ),
  get: (testCaseId: string) =>
    fromResponse<GeneratedTestCase>(testCaseHttp.get(`/test-generation/test-cases/${encodeURIComponent(testCaseId)}`)),
  versions: (sourceAtomicRuleId: string, batchId: string) =>
    fromResponse<GeneratedTestCase[]>(
      testCaseHttp.get(`/test-generation/test-cases/${encodeURIComponent(sourceAtomicRuleId)}/versions`, {
        params: { batchId },
      }),
    ),
  approve: (testCaseId: string) =>
    fromResponse<GeneratedTestCase>(testCaseHttp.post(`/test-generation/test-cases/${encodeURIComponent(testCaseId)}/approve`)),
  reject: (testCaseId: string) =>
    fromResponse<GeneratedTestCase>(testCaseHttp.post(`/test-generation/test-cases/${encodeURIComponent(testCaseId)}/reject`)),
  reopen: (testCaseId: string) =>
    fromResponse<GeneratedTestCase>(testCaseHttp.post(`/test-generation/test-cases/${encodeURIComponent(testCaseId)}/reopen`)),
  editByHuman: (testCaseId: string, payload: TestCaseEditPayload) =>
    fromResponse<GeneratedTestCase>(
      testCaseHttp.post(`/test-generation/test-cases/${encodeURIComponent(testCaseId)}/edit-by-human`, payload),
    ),
  rewrite: (
    testCaseId: string,
    payload: { rewriteMode: TestCaseRewriteMode; humanFeedback?: string; requesterId?: string },
  ) =>
    fromResponse<{ jobId: string; status: string }>(
      testCaseHttp.post(`/test-generation/test-cases/${encodeURIComponent(testCaseId)}/rewrite`, payload),
    ),
}

export const testCaseCheckerApi = {
  run: (batchId: string) =>
    fromResponse<TestCaseJobResponse>(testCaseHttp.post(`/test-generation/checker/batch/${encodeURIComponent(batchId)}`)),
  latestRun: (batchId: string) =>
    nullableFromResponse<TestCaseCheckerRun>(
      testCaseHttp.get(`/test-generation/checker/batch/${encodeURIComponent(batchId)}/latest-run`),
    ),
  runs: (batchId: string) =>
    fromResponse<TestCaseCheckerRun[]>(
      testCaseHttp.get(`/test-generation/checker/batch/${encodeURIComponent(batchId)}/runs`),
    ),
  resultsByBatch: (batchId: string) =>
    fromResponse<TestCaseCheckerResult[]>(
      testCaseHttp.get(`/test-generation/checker/batch/${encodeURIComponent(batchId)}/results`),
    ),
  resultsByTestCase: (testCaseId: string) =>
    fromResponse<TestCaseCheckerResult[]>(
      testCaseHttp.get(`/test-generation/checker/test-cases/${encodeURIComponent(testCaseId)}/results`),
    ),
  latestResultByTestCase: (testCaseId: string) =>
    nullableFromResponse<TestCaseCheckerResult>(
      testCaseHttp.get(`/test-generation/checker/test-cases/${encodeURIComponent(testCaseId)}/latest-result`),
    ),
  resultsByJob: (jobId: string) =>
    fromResponse<TestCaseCheckerResult[]>(
      testCaseHttp.get(`/test-generation/checker/jobs/${encodeURIComponent(jobId)}/results`),
    ),
}

export const rewriteApi = {
  group: (payload: {
    atomicRuleId: string
    semanticRuleId: string
    workflowId: string
    rewriteMode: 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'
    humanFeedback?: string
  }) => fromResponse<JobResponse>(http.post(atomicPath('/rewrite/group'), payload)),
  semanticGroup: (payload: {
    semanticRuleId: string
    workflowId: string
    rewriteMode: 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'
    humanFeedback?: string
  }) => fromResponse<JobResponse>(http.post(atomicPath('/rewrite/semantic-group'), payload)),
}

export const skillsApi = {
  list: () => fromResponse<Skill[]>(http.get('/skills')),
  detail: (skillId: string) => fromResponse<SkillDetail>(http.get(`/skills/${encodeURIComponent(skillId)}`)),
  create: (payload: Omit<Skill, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'>) =>
    fromResponse<Skill>(http.post('/skills', payload)),
  activate: (skillId: string) => fromResponse<Skill>(http.post(`/skills/${encodeURIComponent(skillId)}/activate`)),
  delete: (skillId: string) => fromResponse<{ message: string }>(http.delete(`/skills/${encodeURIComponent(skillId)}`)),
  resources: (skillId: string) =>
    fromResponse<SkillResource[]>(http.get(`/skills/${encodeURIComponent(skillId)}/resources`)),
}

export const applicationLogsApi = {
  get: (params: { tail?: number; level?: string; q?: string }) =>
    fromResponse<ApplicationLogResponse>(http.get('/application-logs', { params })),
}

export const traceLogsApi = {
  getByJobId: (jobId: string) =>
    fromResponse<JobTraceResponse>(http.get(`/trace/jobs/${encodeURIComponent(jobId)}`)),
}

export function normalizeJobStatus(status?: string | null) {
  const normalized = (status || 'UNKNOWN').trim().toUpperCase()
  return normalized === 'COMPLETED' ? 'SUCCEEDED' : normalized
}

export function isJobRunning(status?: string | null) {
  const normalized = normalizeJobStatus(status)
  return normalized === 'QUEUED' || normalized === 'RUNNING'
}

export function isJobDone(status?: string | null) {
  const normalized = normalizeJobStatus(status)
  return normalized === 'SUCCEEDED' || normalized === 'FAILED' || normalized === 'PARTIAL_SUCCESS'
}

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: string; error?: string } | string | undefined
    if (typeof body === 'string') return body || error.message || 'Request failed'
    return body?.message || body?.error || error.message || `Request failed${error.response?.status ? ` (${error.response.status})` : ''}`
  }
  if (error instanceof Error) return error.message
  return 'Unexpected error'
}

export function parseJsonText(value?: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

export function getSemanticRuleCode(rule?: SemanticRule | null) {
  return rule?.semanticRuleCode || rule?.llmSemanticRuleCode || rule?.id || '-'
}

export function getSemanticRuleSummary(rule?: SemanticRule | null) {
  return rule?.summary || rule?.llmSummary || semanticJsonField(rule?.llmOutputJson, 'summary') || null
}

export function getSemanticRuleBusinessIntent(rule?: SemanticRule | null) {
  return rule?.businessIntent || rule?.llmBusinessIntent || semanticJsonField(rule?.llmOutputJson, 'business_intent') || null
}

export function getAtomicRuleCode(rule?: AtomicRule | null) {
  return rule?.atomicRuleCode || rule?.llmAtomicRuleCode || rule?.id || '-'
}

export function getAtomicRuleSemanticCode(rule?: AtomicRule | null) {
  return rule?.semanticRuleCode || rule?.llmSemanticRuleCode || '-'
}

function semanticJsonField(value: string | null | undefined, fieldName: string) {
  const parsed = parseJsonText(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const fieldValue = (parsed as JsonRecord)[fieldName]
  return typeof fieldValue === 'string' && fieldValue.trim() ? fieldValue : null
}
