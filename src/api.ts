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
  workflowId?: string | null
  documentId?: string | null
  jobType: string
  status: string
  inputPayload?: string | null
  resultPayload?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type WorkflowRecord = {
  id: string
  documentId: string
  triggeredBy?: string | null
  status: string
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
  createdAt?: string | null
  updatedAt?: string | null
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

const fromResponse = <T>(request: Promise<{ data: T }>) => request.then((response) => response.data)

const optionalFromResponse = <T>(request: Promise<{ status: number; data: T }>) =>
  request.then((response) => (response.status === 204 ? null : response.data))

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
  affectedRules: (jobId: string) =>
    fromResponse<JsonRecord>(http.get(atomicPath(`/jobs/${encodeURIComponent(jobId)}/affected-rules`))),
  changes: (jobId: string) => fromResponse<JsonRecord>(http.get(atomicPath(`/jobs/${encodeURIComponent(jobId)}/changes`))),
}

export const workflowsApi = {
  list: (documentId?: string, activeOnly = true) =>
    fromResponse<WorkflowRecord[]>(
      http.get(atomicPath('/workflows'), {
        params: { documentId: documentId || undefined, activeOnly },
      }),
    ),
  get: (workflowId: string) =>
    fromResponse<WorkflowRecord>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}`))),
  history: (workflowId: string) =>
    fromResponse<ChangeHistoryItem[]>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/change-history`))),
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
  runRule: (ruleId: string) => fromResponse<JobResponse>(http.post(semanticPath(`/checker/rules/${encodeURIComponent(ruleId)}`))),
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
}

export const atomicRulesApi = {
  get: (atomicRuleId: string) =>
    fromResponse<AtomicRule>(http.get(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}`))),
  byWorkflow: (workflowId: string) =>
    fromResponse<AtomicRule[]>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/atomic-rules`))),
  allVersionsByWorkflow: (workflowId: string) =>
    fromResponse<AtomicRule[]>(http.get(atomicPath(`/workflows/${encodeURIComponent(workflowId)}/atomic-rules/all-versions`))),
  approve: (atomicRuleId: string, approverId: string) =>
    fromResponse<AtomicRule>(http.post(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}/approve`), { approverId })),
  reopen: (atomicRuleId: string, userId: string) =>
    fromResponse<AtomicRule>(http.post(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}/reopen`), { userId })),
  editByHuman: (atomicRuleId: string, editedContent: JsonRecord, editorId: string) =>
    fromResponse<AtomicRule>(
      http.post(atomicPath(`/atomic-rules/${encodeURIComponent(atomicRuleId)}/edit-by-human`), {
        editedContent,
        editorId,
      }),
    ),
}

export const atomicCheckerApi = {
  run: (workflowId: string) => fromResponse<JobResponse>(http.post(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}`))),
  latestRun: (workflowId: string) =>
    optionalFromResponse<CheckerRun>(http.get(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}/latest-run`))),
  latestResults: (workflowId: string) =>
    fromResponse<AtomicCheckerResult[]>(http.get(atomicPath(`/checker/workflow/${encodeURIComponent(workflowId)}/latest-results`))),
  latestResultByRule: (ruleId: string) =>
    optionalFromResponse<AtomicCheckerResult>(http.get(atomicPath(`/checker/rules/${encodeURIComponent(ruleId)}/latest-result`))),
}

export const rewriteApi = {
  group: (payload: {
    semanticRuleId: string
    workflowId: string
    rewriteMode: 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'
    humanFeedback?: string
  }) => fromResponse<JobResponse>(http.post(atomicPath('/rewrite/group'), payload)),
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

export function isJobRunning(status?: string | null) {
  return status === 'QUEUED' || status === 'RUNNING'
}

export function isJobDone(status?: string | null) {
  return status === 'SUCCEEDED' || status === 'FAILED'
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
