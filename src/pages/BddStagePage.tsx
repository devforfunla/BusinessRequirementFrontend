import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  FileCode2,
  History,
  Play,
  RefreshCw,
  ShieldCheck,
  TestTube2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  atomicRulesApi,
  getAtomicRuleCode,
  getAtomicRuleSemanticCode,
  getErrorMessage,
  jobsApi,
  parseJsonText,
  tcgApi,
  workflowsApi,
  type AsyncJob,
  type AtomicRule,
  type GeneratedBddScenario,
  type TcgDependencyReference,
  type TcgCheckerResult,
  type TcgConfidenceDecision,
  type TcgGeneratedTestCase,
  type TcgPreferenceReference,
  type TcgReviewAction,
  type TcgTestIntent,
} from '../api'
import { WorkflowStagePipeline } from '../components/WorkflowStagePipeline'
import {
  Button,
  EmptyState,
  ErrorNotice,
  JsonBlock,
  JsonViewButton,
  Label,
  PageTitle,
  Panel,
  PanelHeader,
  Select,
  StatusPill,
  StickyScrollX,
  Tabs,
  TextArea,
  type TabItem,
} from '../components/ui'
import { useAppStore } from '../store'
import {
  approvedAtomicRules,
  buildReviewRequest,
  getBddEligibility,
  isActiveTcgJobStatus,
  parseOptionalJsonArray,
  toTcgSourceRule,
} from '../tcgBddUtils'
import { cn, formatDate } from '../utils'

const tabs: TabItem[] = [
  { id: 'source', label: 'TCG Maker', icon: <TestTube2 className="h-3.5 w-3.5" /> },
  { id: 'review', label: 'Review', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'bdd', label: 'BDD Drafts', icon: <FileCode2 className="h-3.5 w-3.5" /> },
  { id: 'jobs', label: 'Job History', icon: <History className="h-3.5 w-3.5" /> },
]

const tcgJobTypes = ['TEST_CASE_GENERATION', 'TEST_CASE_CHECKER', 'BDD_GENERATION']

export function BddStagePage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeTab, setActiveTab] = useState('source')
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[] | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedBddCaseIds, setSelectedBddCaseIds] = useState<string[] | null>(null)
  const [selectedBddId, setSelectedBddId] = useState<string | null>(null)
  const [generationMode, setGenerationMode] = useState('standard')
  const [bddGenerationMode, setBddGenerationMode] = useState('standard')
  const [referenceJson, setReferenceJson] = useState('')
  const [preferenceJson, setPreferenceJson] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  useEffect(() => {
    if (workflowId) setWorkflowId(workflowId)
  }, [setWorkflowId, workflowId])

  const workflowQuery = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowsApi.get(workflowId),
    enabled: Boolean(workflowId),
  })

  useEffect(() => {
    if (workflowQuery.data?.documentId) setDocumentId(workflowQuery.data.documentId)
  }, [setDocumentId, workflowQuery.data?.documentId])

  const jobsQuery = useQuery({
    queryKey: ['workflow-jobs', workflowId],
    queryFn: () => jobsApi.listByWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: (query) => {
      const jobs = query.state.data as AsyncJob[] | undefined
      return jobs?.some((job) => isActiveTcgJobStatus(job.status)) ? 4000 : false
    },
  })

  const jobs = jobsQuery.data || []
  const hasActiveJobs = jobs.some((job) => isActiveTcgJobStatus(job.status))
  const hasActiveTcgJob = jobs.some((job) => tcgJobTypes.includes(job.jobType) && isActiveTcgJobStatus(job.status))

  const atomicRulesQuery = useQuery({
    queryKey: ['atomic-rules', workflowId],
    queryFn: () => atomicRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: hasActiveJobs ? 4000 : false,
  })

  const testIntentsQuery = useQuery({
    queryKey: ['tcg-test-intents', workflowId],
    queryFn: () => tcgApi.testIntentsByWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: hasActiveJobs ? 4000 : false,
  })

  const testCasesQuery = useQuery({
    queryKey: ['tcg-test-cases', workflowId],
    queryFn: () => tcgApi.testCasesByWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: hasActiveJobs ? 4000 : false,
  })

  const bddScenariosQuery = useQuery({
    queryKey: ['tcg-bdd-scenarios', workflowId],
    queryFn: () => tcgApi.bddScenariosByWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: hasActiveJobs ? 4000 : false,
  })

  const atomicRules = useMemo(() => atomicRulesQuery.data || [], [atomicRulesQuery.data])
  const approvedRules = useMemo(() => approvedAtomicRules(atomicRules), [atomicRules])
  const approvedRuleIds = useMemo(() => approvedRules.map((rule) => rule.id), [approvedRules])
  const testIntents = useMemo(() => testIntentsQuery.data || [], [testIntentsQuery.data])
  const testCases = useMemo(() => testCasesQuery.data || [], [testCasesQuery.data])
  const bddScenarios = useMemo(() => bddScenariosQuery.data || [], [bddScenariosQuery.data])
  const eligibleBddCases = useMemo(
    () => testCases.filter((testCase) => getBddEligibility(testCase).eligible),
    [testCases],
  )
  const eligibleBddCaseIds = useMemo(() => eligibleBddCases.map((testCase) => testCase.id), [eligibleBddCases])
  const effectiveSelectedSourceIds = useMemo(
    () => (selectedSourceIds ?? approvedRuleIds).filter((id) => approvedRuleIds.includes(id)),
    [approvedRuleIds, selectedSourceIds],
  )
  const effectiveSelectedBddCaseIds = useMemo(
    () => (selectedBddCaseIds ?? eligibleBddCaseIds).filter((id) => eligibleBddCaseIds.includes(id)),
    [eligibleBddCaseIds, selectedBddCaseIds],
  )
  const effectiveSelectedCaseId =
    selectedCaseId && testCases.some((testCase) => testCase.id === selectedCaseId)
      ? selectedCaseId
      : testCases[0]?.id || null
  const effectiveSelectedBddId =
    selectedBddId && bddScenarios.some((scenario) => scenario.id === selectedBddId)
      ? selectedBddId
      : bddScenarios[0]?.id || null
  const selectedCase = testCases.find((testCase) => testCase.id === effectiveSelectedCaseId) || null
  const selectedBdd = bddScenarios.find((scenario) => scenario.id === effectiveSelectedBddId) || null

  const checkerQuery = useQuery({
    queryKey: ['tcg-checker-results', effectiveSelectedCaseId],
    queryFn: () => tcgApi.checkerResults(effectiveSelectedCaseId || ''),
    enabled: Boolean(effectiveSelectedCaseId),
  })

  const confidenceQuery = useQuery({
    queryKey: ['tcg-confidence-decisions', effectiveSelectedCaseId],
    queryFn: () => tcgApi.confidenceDecisions(effectiveSelectedCaseId || ''),
    enabled: Boolean(effectiveSelectedCaseId),
  })

  const generateMutation = useMutation({
    mutationFn: () => {
      const selectedRules = approvedRules.filter((rule) => effectiveSelectedSourceIds.includes(rule.id))
      if (selectedRules.length === 0) throw new Error('Select at least one approved atomic rule.')
      const referencePackage = parseOptionalJsonArray<TcgDependencyReference>(referenceJson, 'Reference package')
      if (!referencePackage.ok) throw new Error(referencePackage.error)
      const teamPreferences = parseOptionalJsonArray<TcgPreferenceReference>(preferenceJson, 'Team preferences')
      if (!teamPreferences.ok) throw new Error(teamPreferences.error)
      return tcgApi.submitGenerationJob({
        workflowId,
        sourceRules: selectedRules.map(toTcgSourceRule),
        referencePackage: referencePackage.value,
        teamPreferences: teamPreferences.value,
        generationMode,
        reviewerId: reviewerId || 'reviewer-poc',
      })
    },
    onSuccess: (response) => {
      toast.success(`TCG job queued: ${response.jobId}`)
      setActiveTab('review')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ testCase, action }: { testCase: TcgGeneratedTestCase; action: TcgReviewAction }) =>
      tcgApi.reviewTestCase(
        testCase.id,
        action,
        buildReviewRequest(testCase, action, reviewerId || 'reviewer-poc', reviewComment),
      ),
    onSuccess: () => {
      toast.success('Review status updated')
      setReviewComment('')
      void queryClient.invalidateQueries({ queryKey: ['tcg-test-cases', workflowId] })
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const bddMutation = useMutation({
    mutationFn: () => {
      if (effectiveSelectedBddCaseIds.length === 0) throw new Error('Select at least one READY or VERIFIED test case.')
      return tcgApi.submitBddGenerationJob({
        workflowId,
        testCaseIds: effectiveSelectedBddCaseIds,
        generationMode: bddGenerationMode,
        reviewerId: reviewerId || 'reviewer-poc',
      })
    },
    onSuccess: (response) => {
      toast.success(`BDD job queued: ${response.jobId}`)
      setActiveTab('bdd')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const firstError =
    workflowQuery.error ||
    jobsQuery.error ||
    atomicRulesQuery.error ||
    testIntentsQuery.error ||
    testCasesQuery.error ||
    bddScenariosQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="BDD Stage"
        description={workflowId}
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#c8d0dc] bg-white px-3 text-sm font-medium text-[#172033] hover:bg-[#eef2f7]"
              to={`/workflows/${encodeURIComponent(workflowId)}/history`}
            >
              <History className="h-4 w-4" aria-hidden="true" />
              History
            </Link>
            <Button onClick={() => void queryClient.invalidateQueries()} disabled={workflowQuery.isFetching}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <WorkflowStagePipeline workflowId={workflowId} activeStage="bdd" />
      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      <Panel>
        <PanelHeader
          title="TCG / BDD Workbench"
          description={hasActiveTcgJob ? 'Polling active Stage 2 jobs every 4 seconds.' : 'No active Stage 2 job.'}
        />
        <div className="grid gap-3 p-4 md:grid-cols-5">
          <MetricCard label="Approved Atomics" value={approvedRules.length} tone="green" />
          <MetricCard label="Test Intents" value={testIntents.length} tone="blue" />
          <MetricCard label="Test Cases" value={testCases.length} tone="purple" />
          <MetricCard label="BDD Drafts" value={bddScenarios.length} tone="neutral" />
          <MetricCard label="Active Jobs" value={jobs.filter((job) => isActiveTcgJobStatus(job.status)).length} tone="orange" />
        </div>
      </Panel>

      <Panel>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'source' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="Source Rules"
                description={`${effectiveSelectedSourceIds.length}/${approvedRules.length} approved atomic rules selected`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={generationMode} onChange={(event) => setGenerationMode(event.target.value)}>
                      <option value="standard">standard</option>
                      <option value="risk_focused">risk_focused</option>
                      <option value="regression_focused">regression_focused</option>
                    </Select>
                    <Button
                      variant="primary"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending || hasActiveTcgJob || effectiveSelectedSourceIds.length === 0}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Generate TCG
                    </Button>
                  </div>
                }
              />
              <SourceRuleTable
                rules={approvedRules}
                selectedIds={effectiveSelectedSourceIds}
                onChange={(ids) => setSelectedSourceIds(ids)}
              />
            </Panel>

            <Panel>
              <PanelHeader title="Advanced Context" description="Optional structured inputs" />
              <div className="grid gap-4 p-4 xl:grid-cols-2">
                <Label label="Reference package JSON">
                  <TextArea
                    className="min-h-44 font-mono text-xs"
                    value={referenceJson}
                    onChange={(event) => setReferenceJson(event.target.value)}
                    placeholder='[{"id":"REF-1","category":"rule_reference","title":"Rulebook","usageRole":"source"}]'
                  />
                </Label>
                <Label label="Team preferences JSON">
                  <TextArea
                    className="min-h-44 font-mono text-xs"
                    value={preferenceJson}
                    onChange={(event) => setPreferenceJson(event.target.value)}
                    placeholder='[{"preferenceId":"PREF-1","preferenceStatement":"Prefer API-level tests"}]'
                  />
                </Label>
              </div>
            </Panel>

            <TestIntentTable intents={testIntents} />
          </div>
        ) : null}

        {activeTab === 'review' ? (
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <Panel>
              <PanelHeader title="Generated Test Cases" description={`${testCases.length} latest version rows`} />
              <TestCaseTable
                testCases={testCases}
                selectedId={effectiveSelectedCaseId}
                onSelect={setSelectedCaseId}
              />
            </Panel>
            <div className="space-y-4">
              <SelectedTestCasePanel
                testCase={selectedCase}
                checkerResults={checkerQuery.data || []}
                confidenceDecisions={confidenceQuery.data || []}
                loadingReview={checkerQuery.isLoading || confidenceQuery.isLoading}
                reviewError={checkerQuery.error || confidenceQuery.error}
                reviewComment={reviewComment}
                onReviewCommentChange={setReviewComment}
                onReview={(action) => selectedCase && reviewMutation.mutate({ testCase: selectedCase, action })}
                disabled={reviewMutation.isPending || hasActiveTcgJob}
              />
            </div>
          </div>
        ) : null}

        {activeTab === 'bdd' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="BDD Draft Generation"
                description={`${effectiveSelectedBddCaseIds.length}/${eligibleBddCases.length} eligible test cases selected`}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={bddGenerationMode} onChange={(event) => setBddGenerationMode(event.target.value)}>
                      <option value="standard">standard</option>
                    </Select>
                    <Button
                      variant="primary"
                      onClick={() => bddMutation.mutate()}
                      disabled={bddMutation.isPending || hasActiveTcgJob || effectiveSelectedBddCaseIds.length === 0}
                    >
                      <FileCode2 className="h-4 w-4" aria-hidden="true" />
                      Generate BDD
                    </Button>
                  </div>
                }
              />
              <BddEligibilityTable
                testCases={testCases}
                selectedIds={effectiveSelectedBddCaseIds}
                onChange={(ids) => setSelectedBddCaseIds(ids)}
              />
            </Panel>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Panel>
                <PanelHeader title="BDD Drafts" description={`${bddScenarios.length} persisted draft rows`} />
                <BddScenarioList scenarios={bddScenarios} selectedId={effectiveSelectedBddId} onSelect={setSelectedBddId} />
              </Panel>
              <BddScenarioDetail scenario={selectedBdd} testCases={testCases} />
            </div>
          </div>
        ) : null}

        {activeTab === 'jobs' ? (
          <div className="p-4">
            <Panel>
              <PanelHeader title="Stage 2 Job History" description={`${stageJobs(jobs).length} TCG/BDD jobs`} />
              <JobHistoryTable jobs={stageJobs(jobs)} />
            </Panel>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}

function SourceRuleTable({
  rules,
  selectedIds,
  onChange,
}: {
  rules: AtomicRule[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const allSelected = rules.length > 0 && selectedIds.length === rules.length
  if (rules.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No approved atomic rules" description="Approve atomic rules before generating test cases." />
      </div>
    )
  }
  return (
    <StickyScrollX>
      <table className="w-full min-w-[950px] border-collapse text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
          <tr>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">
              <input
                aria-label="Select all approved atomic rules"
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onChange(event.target.checked ? rules.map((rule) => rule.id) : [])}
              />
            </th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic Rule</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Summary</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id} className="border-b border-[#edf1f6] align-top last:border-0">
              <td className="px-4 py-3">
                <input
                  aria-label={`Select ${getAtomicRuleCode(rule)}`}
                  type="checkbox"
                  checked={selectedIds.includes(rule.id)}
                  onChange={(event) => {
                    onChange(event.target.checked ? [...selectedIds, rule.id] : selectedIds.filter((id) => id !== rule.id))
                  }}
                />
              </td>
              <td className="px-4 py-3 font-medium text-[#172033]">{getAtomicRuleCode(rule)}</td>
              <td className="px-4 py-3 text-[#475467]">{getAtomicRuleSemanticCode(rule)}</td>
              <td className="px-4 py-3 text-[#667085]">v{rule.atomicVersion ?? 1}</td>
              <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
              <td className="max-w-lg px-4 py-3 text-[#475467]"><TextDetails text={rule.llmSummary || '-'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </StickyScrollX>
  )
}

function TestIntentTable({ intents }: { intents: TcgTestIntent[] }) {
  return (
    <Panel>
      <PanelHeader title="Test Intents" description={`${intents.length} persisted intents`} />
      {intents.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No test intents yet" />
        </div>
      ) : (
        <StickyScrollX>
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Intent</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Level</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Type</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Readiness</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Capability</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Payload</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((intent) => (
                <tr key={intent.id} className="border-b border-[#edf1f6] align-top last:border-0">
                  <td className="px-4 py-3 font-medium text-[#172033]">{intent.testIntentId}</td>
                  <td className="px-4 py-3 text-[#475467]">{intent.testLevel}</td>
                  <td className="px-4 py-3 text-[#475467]">{intent.intentType}</td>
                  <td className="px-4 py-3"><StatusPill value={intent.readinessStatus} /></td>
                  <td className="px-4 py-3 text-[#667085]">{intent.businessCapabilityId || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <JsonViewButton title={`${intent.testIntentId} payload`} value={intent.intentJson} />
                      <JsonViewButton title={`${intent.testIntentId} source rules`} value={intent.sourceRules} label="Sources" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyScrollX>
      )}
    </Panel>
  )
}

function TestCaseTable({
  testCases,
  selectedId,
  onSelect,
}: {
  testCases: TcgGeneratedTestCase[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (testCases.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No generated test cases" />
      </div>
    )
  }
  return (
    <StickyScrollX>
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
          <tr>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Test Case</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Scenario</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Priority</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Source</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((testCase) => (
            <tr
              key={testCase.id}
              className={cn('border-b border-[#edf1f6] align-top last:border-0', selectedId === testCase.id && 'bg-[#f8fbff]')}
            >
              <td className="max-w-sm px-4 py-3">
                <button className="font-medium text-[#175cd3] hover:underline" type="button" onClick={() => onSelect(testCase.id)}>
                  {testCase.title}
                </button>
                <p className="mt-1 font-mono text-xs text-[#667085]">{testCase.testCaseId}</p>
              </td>
              <td className="px-4 py-3 text-[#667085]">v{testCase.versionNumber}</td>
              <td className="px-4 py-3 text-[#475467]">{testCase.scenarioType}</td>
              <td className="px-4 py-3"><StatusPill value={testCase.priority} /></td>
              <td className="px-4 py-3"><StatusPill value={testCase.status} /></td>
              <td className="px-4 py-3 text-[#475467]">{testCase.ruleId} / v{testCase.sourceVersionNumber}</td>
              <td className="px-4 py-3">
                <Button size="sm" onClick={() => onSelect(testCase.id)}>Inspect</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </StickyScrollX>
  )
}

function SelectedTestCasePanel({
  testCase,
  checkerResults,
  confidenceDecisions,
  loadingReview,
  reviewError,
  reviewComment,
  onReviewCommentChange,
  onReview,
  disabled,
}: {
  testCase: TcgGeneratedTestCase | null
  checkerResults: TcgCheckerResult[]
  confidenceDecisions: TcgConfidenceDecision[]
  loadingReview: boolean
  reviewError: unknown
  reviewComment: string
  onReviewCommentChange: (value: string) => void
  onReview: (action: TcgReviewAction) => void
  disabled: boolean
}) {
  if (!testCase) return <Panel><div className="p-4"><EmptyState title="Select a test case" /></div></Panel>
  const latestChecker = newest(checkerResults, 'checkedAt')
  const latestConfidence = newest(confidenceDecisions, 'decidedAt')
  const canVerify = testCase.status === 'READY'
  const canReject = testCase.status === 'READY' || testCase.status === 'VERIFIED'
  const canApprove = testCase.status === 'VERIFIED'

  return (
    <>
      <Panel>
        <PanelHeader title={testCase.title} description={`${testCase.testCaseId} / v${testCase.versionNumber}`} />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Status" value={<StatusPill value={testCase.status} />} />
            <InfoItem label="Scenario" value={testCase.scenarioType} />
            <InfoItem label="Priority" value={testCase.priority} />
            <InfoItem label="Source" value={`${testCase.ruleId} / v${testCase.sourceVersionNumber}`} />
          </div>
          <JsonSection title="Preconditions" value={testCase.preconditions} />
          <JsonSection title="Steps" value={testCase.steps} />
          <JsonSection title="Expected Results" value={testCase.expectedResults} />
          <JsonSection title="Traceability" value={testCase.dependencyTraceability} />
          {testCase.unsupportedInferences ? <JsonSection title="Unsupported Inferences" value={testCase.unsupportedInferences} tone="danger" /> : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Limited Review" description="Version-guarded transition" />
        <div className="space-y-3 p-4">
          <Label label="Comment">
            <TextArea className="min-h-20" value={reviewComment} onChange={(event) => onReviewCommentChange(event.target.value)} />
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onReview('verify')} disabled={disabled || !canVerify}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verify
            </Button>
            <Button size="sm" variant="danger" onClick={() => onReview('reject')} disabled={disabled || !canReject}>
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button size="sm" variant="primary" onClick={() => onReview('approve')} disabled={disabled || !canApprove}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Checker / Confidence" />
        <div className="space-y-3 p-4">
          {loadingReview ? <p className="text-sm text-[#667085]">Loading review records...</p> : null}
          {reviewError ? <ErrorNotice message={getErrorMessage(reviewError)} /> : null}
          <CheckerSummary result={latestChecker} />
          <ConfidenceSummary decision={latestConfidence} />
        </div>
      </Panel>
    </>
  )
}

function BddEligibilityTable({
  testCases,
  selectedIds,
  onChange,
}: {
  testCases: TcgGeneratedTestCase[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  if (testCases.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No test cases available" />
      </div>
    )
  }
  return (
    <StickyScrollX>
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
          <tr>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Use</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Test Case</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Eligibility</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((testCase) => {
            const eligibility = getBddEligibility(testCase)
            return (
              <tr key={testCase.id} className="border-b border-[#edf1f6] align-top last:border-0">
                <td className="px-4 py-3">
                  <input
                    aria-label={`Select ${testCase.title} for BDD`}
                    type="checkbox"
                    checked={selectedIds.includes(testCase.id)}
                    disabled={!eligibility.eligible}
                    onChange={(event) => {
                      onChange(event.target.checked ? [...selectedIds, testCase.id] : selectedIds.filter((id) => id !== testCase.id))
                    }}
                  />
                </td>
                <td className="max-w-sm px-4 py-3 font-medium text-[#172033]">{testCase.title}</td>
                <td className="px-4 py-3 text-[#667085]">v{testCase.versionNumber}{testCase.isLatest ? '' : ' stale'}</td>
                <td className="px-4 py-3"><StatusPill value={testCase.status} /></td>
                <td className="px-4 py-3 text-[#475467]">{eligibility.reason}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </StickyScrollX>
  )
}

function BddScenarioList({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: GeneratedBddScenario[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (scenarios.length === 0) {
    return <div className="p-4"><EmptyState title="No BDD drafts yet" /></div>
  }
  return (
    <div className="divide-y divide-[#edf1f6]">
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          onClick={() => onSelect(scenario.id)}
          className={cn('block w-full px-4 py-3 text-left hover:bg-[#f8fafc]', selectedId === scenario.id && 'bg-[#f8fbff]')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-[#172033]">{scenario.scenarioTitle}</p>
              <p className="mt-1 truncate text-sm text-[#667085]">{scenario.featureTitle}</p>
              <p className="mt-1 text-xs text-[#667085]">{scenario.ruleId} / v{scenario.sourceVersionNumber}</p>
            </div>
            <StatusPill value={scenario.status} />
          </div>
        </button>
      ))}
    </div>
  )
}

function BddScenarioDetail({
  scenario,
  testCases,
}: {
  scenario: GeneratedBddScenario | null
  testCases: TcgGeneratedTestCase[]
}) {
  if (!scenario) return <Panel><div className="p-4"><EmptyState title="Select a BDD draft" /></div></Panel>
  const sourceCase = testCases.find((testCase) => testCase.id === scenario.generatedTestCaseId)
  return (
    <Panel>
      <PanelHeader title={scenario.scenarioTitle} description={scenario.featureTitle} actions={<StatusPill value={scenario.status} />} />
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem label="Source Rule" value={`${scenario.ruleId} / v${scenario.sourceVersionNumber}`} />
          <InfoItem label="Test Case" value={sourceCase?.title || scenario.generatedTestCaseId} />
          <InfoItem label="Generation Job" value={scenario.generationJobId} />
          <InfoItem label="Updated" value={formatDate(scenario.updatedAt)} />
        </div>
        {scenario.staleAt ? (
          <div className="rounded-md border border-[#f7b4ae] bg-[#fff1f0] px-3 py-2 text-sm text-[#b42318]">
            {scenario.staleReason || 'A newer source test-case version exists.'}
          </div>
        ) : null}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase text-[#667085]">Gherkin Draft</p>
          <pre className="max-h-[520px] overflow-auto rounded-md border border-[#d8dee8] bg-[#101828] p-4 text-sm leading-6 text-[#e6edf7]">
            {scenario.gherkinText}
          </pre>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <JsonSection title="Traceability" value={scenario.traceability} />
          <JsonSection title="Assumptions" value={scenario.assumptions} />
        </div>
      </div>
    </Panel>
  )
}

function JobHistoryTable({ jobs }: { jobs: AsyncJob[] }) {
  if (jobs.length === 0) {
    return <div className="p-4"><EmptyState title="No Stage 2 jobs yet" /></div>
  }
  return (
    <StickyScrollX>
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
          <tr>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job Type</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job ID</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Created</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Payload</th>
            <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b border-[#edf1f6] align-top last:border-0">
              <td className="px-4 py-3"><JobTypePill jobType={job.jobType} /></td>
              <td className="px-4 py-3"><StatusPill value={job.status} /></td>
              <td className="px-4 py-3 font-mono text-xs text-[#667085]">{job.id}</td>
              <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(job.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(job.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <JsonViewButton title={`${job.jobType} input`} value={job.inputPayload} label="Input" />
                  <JsonViewButton title={`${job.jobType} result`} value={job.resultPayload} label="Result" />
                </div>
              </td>
              <td className="max-w-xs px-4 py-3 text-xs text-[#b42318]">{job.errorMessage || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StickyScrollX>
  )
}

function CheckerSummary({ result }: { result?: TcgCheckerResult | null }) {
  if (!result) return <p className="text-sm text-[#667085]">No checker result recorded.</p>
  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">Advisory checker</p>
        <StatusPill value={result.isPassing ? 'PASS' : 'FAILED'} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-[#f5f0ff] px-2 py-0.5 text-[#6b21a8]">Score {formatScore(result.totalScore)}</span>
        <span className="rounded bg-[#f8fafc] px-2 py-0.5 text-[#475467]">{result.blockingCategory || 'No blocking category'}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <JsonViewButton title="Dimension Scores" value={result.dimensionScores} label="Dimensions" />
        <JsonViewButton title="Findings" value={result.findings} />
        <JsonViewButton title="Recommended Actions" value={result.recommendedActions} label="Actions" />
      </div>
    </div>
  )
}

function ConfidenceSummary({ decision }: { decision?: TcgConfidenceDecision | null }) {
  if (!decision) return <p className="text-sm text-[#667085]">No confidence decision recorded.</p>
  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">Confidence decision</p>
        <StatusPill value={decision.confidenceLevel} />
      </div>
      <p className="mt-2 text-sm text-[#475467]">{decision.rationale || 'No rationale recorded.'}</p>
      <p className="mt-2 text-xs text-[#667085]">{formatDate(decision.decidedAt)}</p>
    </div>
  )
}

function JsonSection({ title, value, tone }: { title: string; value?: string | null; tone?: 'danger' }) {
  return (
    <section className={cn('rounded-md border p-3', tone === 'danger' ? 'border-[#f7b4ae] bg-[#fff7f6]' : 'border-[#d8dee8] bg-[#fbfcfe]')}>
      <p className="mb-2 text-xs font-semibold uppercase text-[#667085]">{title}</p>
      <JsonBlock value={value ? parseJsonText(value) : null} className="max-h-64" />
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'neutral'
}) {
  const styles = {
    blue: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    green: 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]',
    orange: 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]',
    purple: 'border-[#d8c4f7] bg-[#f5f0ff] text-[#6b21a8]',
    neutral: 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]',
  }
  return (
    <div className={cn('rounded-md border p-3', styles[tone])}>
      <p className="text-xs font-medium uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase text-[#667085]">{label}</p>
      <div className="mt-1 truncate text-sm text-[#172033]">{value || '-'}</div>
    </div>
  )
}

function TextDetails({ text }: { text: string }) {
  const safeText = text || '-'
  if (safeText.length <= 96) return <span>{safeText}</span>
  return (
    <details className="rounded-md border border-[#d8dee8] bg-[#f8fafc]">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#175cd3] hover:bg-[#edf2f7]">
        {safeText.slice(0, 96)}...
      </summary>
      <div className="border-t border-[#e3e8f0] p-3 text-xs">{safeText}</div>
    </details>
  )
}

function JobTypePill({ jobType }: { jobType: string }) {
  const colors: Record<string, string> = {
    TEST_CASE_GENERATION: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    TEST_CASE_CHECKER: 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]',
    BDD_GENERATION: 'border-[#d8c4f7] bg-[#f5f0ff] text-[#6b21a8]',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', colors[jobType] || 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]')}>
      {jobType.replaceAll('_', ' ')}
    </span>
  )
}

function stageJobs(jobs: AsyncJob[]) {
  return jobs
    .filter((job) => tcgJobTypes.includes(job.jobType))
    .sort((left, right) => jobTime(right) - jobTime(left))
}

function jobTime(job: AsyncJob) {
  return Date.parse(job.updatedAt || job.createdAt || '') || 0
}

function newest<T>(items: T[], field: keyof T) {
  return [...items].sort((left, right) => String(right[field] || '').localeCompare(String(left[field] || '')))[0] || null
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
