import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Edit3,
  Eye,
  History,
  Layers3,
  MessageSquareText,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  atomicRulesApi,
  getErrorMessage,
  isJobRunning,
  parseJsonText,
  semanticRulesApi,
  testCaseBatchesApi,
  testCaseCheckerApi,
  testCaseJobsApi,
  testCaseMakerApi,
  testCasesApi,
  workflowsApi,
  type AsyncJob,
  type GeneratedTestCase,
  type JsonRecord,
  type TestCaseCheckerResult,
  type TestCaseCheckerRun,
  type TestCaseEditPayload,
  type TestCaseGenerationBatch,
  type TestCaseJobResponse,
} from '../api'
import { JobSummaryCard, WorkflowStageJobs } from '../components/WorkflowStageJobs'
import { WorkflowStagePipeline } from '../components/WorkflowStagePipeline'
import {
  Button,
  EmptyState,
  ErrorNotice,
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
import { cn, formatDate } from '../utils'

const testCaseJobTypes = ['TEST_CASE_MAKER', 'TEST_CASE_CHECKER', 'TEST_CASE_REWRITE', 'TEST_CASE_EDIT']

const tabs: TabItem[] = [
  { id: 'maker', label: 'Maker', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'checker', label: 'Checker', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'review', label: 'Review', icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'history', label: 'Job History', icon: <History className="h-3.5 w-3.5" /> },
]

export function TestCasesStagePage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('maker')
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [humanRewriteCase, setHumanRewriteCase] = useState<GeneratedTestCase | null>(null)
  const [humanFeedback, setHumanFeedback] = useState('')
  const [editCase, setEditCase] = useState<GeneratedTestCase | null>(null)
  const [editText, setEditText] = useState('')
  const [versionCase, setVersionCase] = useState<GeneratedTestCase | null>(null)

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

  const semanticRulesQuery = useQuery({
    queryKey: ['semantic-rules', workflowId],
    queryFn: () => semanticRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const atomicRulesQuery = useQuery({
    queryKey: ['atomic-rules', workflowId],
    queryFn: () => atomicRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const batchesQuery = useQuery({
    queryKey: ['test-case-batches', workflowId],
    queryFn: () => testCaseBatchesApi.list(workflowId),
    enabled: Boolean(workflowId),
  })

  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data])
  const activeBatchId = useMemo(() => {
    if (selectedBatchId && batches.some((batch) => batch.id === selectedBatchId)) return selectedBatchId
    return batches.find((batch) => batch.status === 'ACTIVE')?.id || batches[0]?.id || ''
  }, [batches, selectedBatchId])
  const activeBatch = batches.find((batch) => batch.id === activeBatchId) || null

  useEffect(() => {
    if (!selectedBatchId && activeBatchId) {
      const timer = window.setTimeout(() => setSelectedBatchId(activeBatchId), 0)
      return () => window.clearTimeout(timer)
    }
  }, [activeBatchId, selectedBatchId])

  const jobsQuery = useQuery({
    queryKey: ['test-case-jobs', activeBatchId],
    queryFn: () => testCaseJobsApi.listByBatch(activeBatchId),
    enabled: Boolean(activeBatchId),
    refetchInterval: (query) => {
      const jobs = query.state.data as TestCaseJobResponse[] | undefined
      return jobs?.some((job) => isJobRunning(job.status)) ? 2000 : 5000
    },
  })

  const activeJobQuery = useQuery({
    queryKey: ['test-case-job', activeJobId],
    queryFn: () => testCaseJobsApi.get(activeJobId || ''),
    enabled: Boolean(activeJobId),
    refetchInterval: (query) => {
      const job = query.state.data as TestCaseJobResponse | undefined
      return activeJobId && isJobRunning(job?.status) ? 2000 : false
    },
  })

  const testCasesQuery = useQuery({
    queryKey: ['test-cases', activeBatchId],
    queryFn: () => testCasesApi.byBatch(activeBatchId, true),
    enabled: Boolean(activeBatchId),
  })

  const checkerRunQuery = useQuery({
    queryKey: ['test-case-checker-latest-run', activeBatchId],
    queryFn: () => testCaseCheckerApi.latestRun(activeBatchId),
    enabled: Boolean(activeBatchId),
  })

  const checkerResultsQuery = useQuery({
    queryKey: ['test-case-checker-results', activeBatchId],
    queryFn: () => testCaseCheckerApi.resultsByBatch(activeBatchId),
    enabled: Boolean(activeBatchId),
  })

  const checkerRunsQuery = useQuery({
    queryKey: ['test-case-checker-runs', activeBatchId],
    queryFn: () => testCaseCheckerApi.runs(activeBatchId),
    enabled: Boolean(activeBatchId),
  })

  useEffect(() => {
    const job = activeJobQuery.data
    if (!job) return
    if (job.status === 'SUCCEEDED' || job.status === 'PARTIAL_SUCCESS') {
      if (job.status === 'PARTIAL_SUCCESS') {
        toast.warning(`${formatJobType(job.jobType)} completed with partial success`)
      } else {
        toast.success(`${formatJobType(job.jobType)} completed`)
      }
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries()
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || `${formatJobType(job.jobType)} failed`)
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries()
    }
  }, [activeJobQuery.data, queryClient])

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data])
  const semanticRules = semanticRulesQuery.data || []
  const atomicRules = atomicRulesQuery.data || []
  const approvedAtomicRules = atomicRules.filter((rule) => rule.status === 'APPROVED')
  const testCases = testCasesQuery.data || []
  const checkerResults = checkerResultsQuery.data || []
  const checkerResultByCase = new Map(checkerResults.map((result) => [result.targetTestCaseId, result]))
  const latestMakerJob = latestJob(jobs, 'TEST_CASE_MAKER')
  const latestCheckerJob = latestJob(jobs, 'TEST_CASE_CHECKER')

  useEffect(() => {
    const hasReviewJob = jobs.some((job) => job.jobType === 'TEST_CASE_REWRITE' || job.jobType === 'TEST_CASE_EDIT')
    const hasCheckerJob = jobs.some((job) => job.jobType === 'TEST_CASE_CHECKER')
    const hasMakerJob = jobs.some((job) => job.jobType === 'TEST_CASE_MAKER')
    const nextTab = hasReviewJob ? 'review' : hasCheckerJob ? 'checker' : hasMakerJob ? 'maker' : null
    if (!nextTab) return
    const timer = window.setTimeout(() => setActiveTab(nextTab), 0)
    return () => window.clearTimeout(timer)
  }, [jobs])

  const generateMutation = useMutation({
    mutationFn: () => testCaseMakerApi.generate(workflowId, reviewerId || 'reviewer-poc', batches.length > 0),
    onSuccess: (response) => {
      setSelectedBatchId(response.batchId)
      setActiveJobId(response.jobId)
      toast.success('Test case generation job queued')
      void queryClient.invalidateQueries()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const checkerMutation = useMutation({
    mutationFn: () => {
      if (!activeBatchId) throw new Error('Select a test case batch first.')
      return testCaseCheckerApi.run(activeBatchId)
    },
    onSuccess: (response) => {
      setActiveJobId(response.id)
      toast.success('Test case checker job queued')
      void queryClient.invalidateQueries({ queryKey: ['test-case-jobs', activeBatchId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const activateBatchMutation = useMutation({
    mutationFn: (batchId: string) => testCaseBatchesApi.activate(batchId),
    onSuccess: (batch) => {
      setSelectedBatchId(batch.id)
      toast.success('Test case batch activated')
      void queryClient.invalidateQueries({ queryKey: ['test-case-batches', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const statusMutation = useMutation({
    mutationFn: ({ testCaseId, action }: { testCaseId: string; action: 'approve' | 'reject' | 'reopen' }) => {
      if (action === 'approve') return testCasesApi.approve(testCaseId)
      if (action === 'reject') return testCasesApi.reject(testCaseId)
      return testCasesApi.reopen(testCaseId)
    },
    onSuccess: () => {
      toast.success('Test case status updated')
      void queryClient.invalidateQueries({ queryKey: ['test-cases', activeBatchId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rewriteMutation = useMutation({
    mutationFn: ({
      testCaseId,
      rewriteMode,
      humanFeedback,
    }: {
      testCaseId: string
      rewriteMode: 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'
      humanFeedback?: string
    }) => testCasesApi.rewrite(testCaseId, { rewriteMode, humanFeedback, requesterId: reviewerId || 'reviewer-poc' }),
    onSuccess: (response) => {
      setActiveJobId(response.jobId)
      setHumanRewriteCase(null)
      setHumanFeedback('')
      toast.success('Test case rewrite job queued')
      void queryClient.invalidateQueries()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editCase) throw new Error('Select a test case first.')
      const parsed = JSON.parse(editText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Edited test case must be a JSON object.')
      }
      return testCasesApi.editByHuman(editCase.id, {
        ...(parsed as Omit<TestCaseEditPayload, 'editorId'>),
        editorId: reviewerId || 'reviewer-poc',
      } as TestCaseEditPayload)
    },
    onSuccess: () => {
      setEditCase(null)
      setEditText('')
      toast.success('Human edit saved as a new version')
      void queryClient.invalidateQueries()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const openEditDialog = (testCase: GeneratedTestCase) => {
    setEditCase(testCase)
    setEditText(JSON.stringify(testCaseToEditPayload(testCase, reviewerId || 'reviewer-poc'), null, 2))
  }

  const firstError =
    workflowQuery.error ||
    semanticRulesQuery.error ||
    atomicRulesQuery.error ||
    batchesQuery.error ||
    jobsQuery.error ||
    testCasesQuery.error ||
    checkerRunQuery.error ||
    checkerResultsQuery.error ||
    checkerRunsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Test Case Stage"
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

      <WorkflowStagePipeline workflowId={workflowId} activeStage="test-cases" />
      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      <Panel>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'maker' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="Test Case Maker"
                description="Generates one latest draft test case per approved atomic rule."
                actions={
                  <Button
                    variant="primary"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending || Boolean(activeJobId) || approvedAtomicRules.length === 0}
                    title={approvedAtomicRules.length === 0 ? 'Approve atomic rules before generating test cases' : undefined}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Generate Batch
                  </Button>
                }
              />
              <div className="grid gap-3 p-4 md:grid-cols-4">
                <MetricCard label="Approved Atomics" value={approvedAtomicRules.length} tone="green" />
                <MetricCard label="Semantic Context" value={semanticRules.length} tone="blue" />
                <MetricCard label="Batches" value={batches.length} tone="neutral" />
                <MetricCard label="Latest Cases" value={testCases.length} tone="purple" />
              </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <PanelHeader title="Latest Maker Job" />
                <div className="p-4">
                  <JobSummaryCard title="Latest Test Case Maker" job={latestMakerJob as AsyncJob | undefined} />
                </div>
              </Panel>
              <Panel>
                <PanelHeader
                  title="Selected Batch"
                  actions={
                    batches.length > 0 ? (
                      <Select value={activeBatchId} onChange={(event) => setSelectedBatchId(event.target.value)}>
                        {batches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.status} - {formatDate(batch.createdAt)}
                          </option>
                        ))}
                      </Select>
                    ) : null
                  }
                />
                <div className="p-4">
                  {activeBatch ? <BatchSummary batch={activeBatch} /> : <EmptyState title="No test case batch yet" />}
                </div>
              </Panel>
            </div>

            <BatchTable batches={batches} selectedBatchId={activeBatchId} onSelect={setSelectedBatchId} onActivate={(id) => activateBatchMutation.mutate(id)} />
            <WorkflowStageJobs title="Test Case Jobs" jobs={jobs as AsyncJob[]} jobTypes={testCaseJobTypes} />
            <TestCaseTable testCases={testCases} checkerResultByCase={checkerResultByCase} compact />
          </div>
        ) : null}

        {activeTab === 'checker' ? (
          <div className="space-y-4 p-4">
            <CheckerGovernanceBanner run={checkerRunQuery.data} />

            <Panel>
              <PanelHeader
                title="Test Case Checker"
                description="Reviews generated test cases against the snapshotted atomic rules."
                actions={
                  <Button
                    onClick={() => checkerMutation.mutate()}
                    disabled={checkerMutation.isPending || Boolean(activeJobId) || !activeBatchId || testCases.length === 0}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Run Checker
                  </Button>
                }
              />
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <CheckerSummary title="Latest Checker Run" run={checkerRunQuery.data} />
                <JobSummaryCard title="Latest Checker Job" job={latestCheckerJob as AsyncJob | undefined} />
              </div>
            </Panel>

            <CheckerResultsTable results={checkerResults} testCases={testCases} />
          </div>
        ) : null}

        {activeTab === 'review' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="Review Queue"
                description="Approve, reject, edit, or rewrite the latest version of each generated test case."
              />
              <div className="grid gap-3 p-4 md:grid-cols-4">
                <MetricCard label="Draft" value={testCases.filter((item) => item.approvalStatus === 'DRAFT').length} tone="blue" />
                <MetricCard label="Approved" value={testCases.filter((item) => item.approvalStatus === 'APPROVED').length} tone="green" />
                <MetricCard label="Rejected" value={testCases.filter((item) => item.approvalStatus === 'REJECTED').length} tone="red" />
                <MetricCard label="Checker Failed" value={checkerResults.filter((item) => item.calcIsPassing === 'FAILED').length} tone="orange" />
              </div>
            </Panel>

            <ReviewTable
              testCases={testCases}
              checkerResultByCase={checkerResultByCase}
              onApprove={(testCase) => statusMutation.mutate({ testCaseId: testCase.id, action: 'approve' })}
              onReject={(testCase) => statusMutation.mutate({ testCaseId: testCase.id, action: 'reject' })}
              onReopen={(testCase) => statusMutation.mutate({ testCaseId: testCase.id, action: 'reopen' })}
              onCheckerRewrite={(testCase) =>
                rewriteMutation.mutate({ testCaseId: testCase.id, rewriteMode: 'CHECKER_FEEDBACK' })
              }
              onHumanRewrite={setHumanRewriteCase}
              onEdit={openEditDialog}
              onVersions={setVersionCase}
              disabled={statusMutation.isPending || rewriteMutation.isPending || editMutation.isPending || Boolean(activeJobId)}
            />
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="All Test Case Jobs"
                description={activeBatch ? `Batch ${activeBatch.id}` : 'No batch selected'}
              />
              <JobHistoryTable jobs={jobs} checkerRuns={checkerRunsQuery.data || []} />
            </Panel>
          </div>
        ) : null}
      </Panel>

      {humanRewriteCase ? (
        <TestCaseDialog
          title="Human Rewrite"
          description={getTestCaseCode(humanRewriteCase)}
          onClose={() => {
            setHumanRewriteCase(null)
            setHumanFeedback('')
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              rewriteMutation.mutate({
                testCaseId: humanRewriteCase.id,
                rewriteMode: 'HUMAN_FEEDBACK',
                humanFeedback,
              })
            }}
          >
            <Label label="Feedback">
              <TextArea className="min-h-36" value={humanFeedback} onChange={(event) => setHumanFeedback(event.target.value)} />
            </Label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  setHumanRewriteCase(null)
                  setHumanFeedback('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={rewriteMutation.isPending || !humanFeedback.trim()}>
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Queue Rewrite
              </Button>
            </div>
          </form>
        </TestCaseDialog>
      ) : null}

      {editCase ? (
        <TestCaseDialog
          title="Edit Test Case"
          description={getTestCaseCode(editCase)}
          onClose={() => {
            setEditCase(null)
            setEditText('')
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              editMutation.mutate()
            }}
          >
            <Label label="Test Case JSON">
              <TextArea className="min-h-[420px] font-mono text-xs" value={editText} onChange={(event) => setEditText(event.target.value)} />
            </Label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  setEditCase(null)
                  setEditText('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={editMutation.isPending || !editText.trim()}>
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Save Version
              </Button>
            </div>
          </form>
        </TestCaseDialog>
      ) : null}

      {versionCase && activeBatchId ? (
        <VersionHistoryDialog testCase={versionCase} batchId={activeBatchId} onClose={() => setVersionCase(null)} />
      ) : null}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'neutral' }) {
  const styles = {
    blue: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    green: 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]',
    red: 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]',
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

function BatchSummary({ batch }: { batch: TestCaseGenerationBatch }) {
  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-[#667085]">{batch.id}</p>
          <p className="mt-1 text-sm font-semibold text-[#172033]">{formatDate(batch.createdAt)}</p>
        </div>
        <StatusPill value={batch.status} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-2">
        <span>Workflow: {batch.sourceWorkflowId}</span>
        <span>Triggered by: {batch.triggeredBy || '-'}</span>
      </div>
    </div>
  )
}

function BatchTable({
  batches,
  selectedBatchId,
  onSelect,
  onActivate,
}: {
  batches: TestCaseGenerationBatch[]
  selectedBatchId: string
  onSelect: (batchId: string) => void
  onActivate: (batchId: string) => void
}) {
  return (
    <Panel>
      <PanelHeader title="Generation Batches" description={`${batches.length} batch${batches.length === 1 ? '' : 'es'} for this workflow`} />
      {batches.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No batches yet" description="Generate a test case batch from approved atomic rules." />
        </div>
      ) : (
        <StickyScrollX>
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Batch</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Triggered By</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Created</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className={cn('border-b border-[#edf1f6] align-top last:border-0', selectedBatchId === batch.id && 'bg-[#f8fbff]')}>
                  <td className="px-4 py-3">
                    <button type="button" className="font-mono text-xs font-medium text-[#175cd3] hover:underline" onClick={() => onSelect(batch.id)}>
                      {batch.id}
                    </button>
                  </td>
                  <td className="px-4 py-3"><StatusPill value={batch.status} /></td>
                  <td className="px-4 py-3 text-[#475467]">{batch.triggeredBy || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(batch.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(batch.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onSelect(batch.id)}>Select</Button>
                      {batch.status !== 'ACTIVE' ? (
                        <Button size="sm" onClick={() => onActivate(batch.id)}>Activate</Button>
                      ) : null}
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
  checkerResultByCase,
  compact,
}: {
  testCases: GeneratedTestCase[]
  checkerResultByCase: Map<string, TestCaseCheckerResult>
  compact?: boolean
}) {
  return (
    <Panel>
      <PanelHeader title="Generated Test Cases" description={`${testCases.length} latest test case${testCases.length === 1 ? '' : 's'}`} />
      {testCases.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No test cases yet" description="Generate a batch after atomic rules are approved." />
        </div>
      ) : (
        <StickyScrollX>
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Test Case</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic Rule</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Priority</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map((testCase) => {
                const result = checkerResultByCase.get(testCase.id)
                return (
                  <tr key={testCase.id} className="border-b border-[#edf1f6] align-top last:border-0">
                    <td className="max-w-sm px-4 py-3">
                      <p className="font-medium text-[#172033]">{getTestCaseCode(testCase)}</p>
                      <TextDetails text={testCase.llmTestCaseTitle || testCase.llmObjective || '-'} />
                    </td>
                    <td className="px-4 py-3 text-[#475467]">{testCase.sourceAtomicRuleCode || '-'}</td>
                    <td className="px-4 py-3 text-[#475467]">{testCase.sourceSemanticRuleCode || '-'}</td>
                    <td className="px-4 py-3"><StatusPill value={testCase.llmPriority || 'UNSET'} /></td>
                    <td className="px-4 py-3"><StatusPill value={testCase.approvalStatus} /></td>
                    <td className="px-4 py-3"><CheckerResultPill result={result} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <JsonViewButton title={`${getTestCaseCode(testCase)} JSON`} value={testCase.llmOutputJson} />
                        {!compact ? <JsonViewButton title="Checker Review" value={result?.llmReviewEntry} label="Review" /> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </StickyScrollX>
      )}
    </Panel>
  )
}

function CheckerGovernanceBanner({ run }: { run?: TestCaseCheckerRun | null }) {
  if (!run) return null
  const gate = run.calcGovernanceGate || 'UNKNOWN'
  const style =
    gate === 'PASSED' ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]' :
    gate === 'BLOCKED' || gate === 'FAILED' ? 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]' :
    'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]'

  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-4', style)}>
      <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Governance Gate: {gate}</p>
        {run.llmHighLevelFeedback ? <p className="mt-1 text-sm text-[#475467]">{run.llmHighLevelFeedback}</p> : null}
      </div>
      <StatusPill value={gate} />
    </div>
  )
}

function CheckerSummary({ title, run }: { title: string; run?: TestCaseCheckerRun | null }) {
  if (!run) {
    return (
      <div className="rounded-md border border-dashed border-[#c8d0dc] bg-[#f8fafc] p-3">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <p className="mt-1 text-sm text-[#667085]">No checker run yet.</p>
      </div>
    )
  }

  const summary = asRecord(parseJsonText(run.calcSummaryJson))
  const metrics = asRecord(parseJsonText(run.calcGovernanceMetricsJson))
  const total = numberField(summary, 'total_reviews')
  const passed = numberField(summary, 'passed_reviews')
  const failed = numberField(summary, 'failed_reviews')
  const score = numberField(metrics, 'overall_quality_score')

  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <StatusPill value={run.calcGovernanceGate} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {total != null ? <span className="rounded bg-[#eff6ff] px-2 py-0.5 text-[#175cd3]">{total} reviewed</span> : null}
        {passed != null ? <span className="rounded bg-[#ecfdf3] px-2 py-0.5 text-[#067647]">{passed} passed</span> : null}
        {failed != null ? <span className="rounded bg-[#fff1f0] px-2 py-0.5 text-[#b42318]">{failed} failed</span> : null}
        {score != null ? <span className="rounded bg-[#f5f0ff] px-2 py-0.5 text-[#6b21a8]">Score {score}</span> : null}
      </div>
      <p className="mt-3 text-xs text-[#667085]">{run.model || 'model unknown'} - {formatDate(run.checkedAt)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <JsonViewButton title="Checker Summary" value={run.calcSummaryJson} label="Summary" />
        <JsonViewButton title="Checker Output" value={run.rawOutputJson} label="Raw" />
      </div>
    </div>
  )
}

function CheckerResultsTable({ results, testCases }: { results: TestCaseCheckerResult[]; testCases: GeneratedTestCase[] }) {
  const testCaseById = new Map(testCases.map((testCase) => [testCase.id, testCase]))
  return (
    <Panel>
      <PanelHeader title="Per-Test-Case Findings" description={`${results.length} checker result${results.length === 1 ? '' : 's'}`} />
      {results.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No checker findings yet" description="Run the checker for the selected batch." />
        </div>
      ) : (
        <StickyScrollX>
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Test Case</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic Rule</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Result</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Blocking</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Action</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checked</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const testCase = testCaseById.get(result.targetTestCaseId)
                return (
                  <tr key={result.id} className="border-b border-[#edf1f6] align-top last:border-0">
                    <td className="px-4 py-3 font-medium text-[#172033]">{testCase ? getTestCaseCode(testCase) : result.targetTestCaseId}</td>
                    <td className="px-4 py-3 text-[#475467]">{result.sourceAtomicRuleCode || '-'}</td>
                    <td className="px-4 py-3"><StatusPill value={result.calcIsPassing} /></td>
                    <td className="px-4 py-3 text-[#475467]">{result.calcBlockingCategory || '-'}</td>
                    <td className="px-4 py-3 text-[#475467]">{result.calcRecommendedAction || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(result.checkedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <JsonViewButton title="Findings" value={result.llmFindings} />
                        <JsonViewButton title="Dimensions" value={result.llmDimensionReviews} label="Dimensions" />
                        <JsonViewButton title="Review Entry" value={result.llmReviewEntry} label="Review" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </StickyScrollX>
      )}
    </Panel>
  )
}

function ReviewTable({
  testCases,
  checkerResultByCase,
  onApprove,
  onReject,
  onReopen,
  onCheckerRewrite,
  onHumanRewrite,
  onEdit,
  onVersions,
  disabled,
}: {
  testCases: GeneratedTestCase[]
  checkerResultByCase: Map<string, TestCaseCheckerResult>
  onApprove: (testCase: GeneratedTestCase) => void
  onReject: (testCase: GeneratedTestCase) => void
  onReopen: (testCase: GeneratedTestCase) => void
  onCheckerRewrite: (testCase: GeneratedTestCase) => void
  onHumanRewrite: (testCase: GeneratedTestCase) => void
  onEdit: (testCase: GeneratedTestCase) => void
  onVersions: (testCase: GeneratedTestCase) => void
  disabled: boolean
}) {
  const groups = useMemo(() => {
    const groupMap = new Map<string, GeneratedTestCase[]>()
    for (const testCase of testCases) {
      const key = testCase.sourceSemanticRuleCode || 'Ungrouped'
      groupMap.set(key, [...(groupMap.get(key) || []), testCase])
    }
    return [...groupMap.entries()]
  }, [testCases])

  if (testCases.length === 0) {
    return (
      <Panel>
        <div className="p-4">
          <EmptyState title="No test cases to review" />
        </div>
      </Panel>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map(([semanticCode, cases]) => (
        <Panel key={semanticCode}>
          <PanelHeader title={semanticCode} description={`${cases.length} test case${cases.length === 1 ? '' : 's'}`} />
          <StickyScrollX>
            <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Test Case</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic Rule</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Approval</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Expected Result</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((testCase) => {
                  const result = checkerResultByCase.get(testCase.id)
                  const checkerFailed = result?.calcIsPassing === 'FAILED'
                  return (
                    <tr key={testCase.id} className="border-b border-[#edf1f6] align-top last:border-0">
                      <td className="max-w-sm px-4 py-3">
                        <p className="font-medium text-[#172033]">{getTestCaseCode(testCase)}</p>
                        <TextDetails text={testCase.llmTestCaseTitle || testCase.llmObjective || '-'} />
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{testCase.sourceAtomicRuleCode || '-'}</td>
                      <td className="px-4 py-3 text-[#667085]">v{testCase.testCaseVersion}</td>
                      <td className="px-4 py-3"><StatusPill value={testCase.approvalStatus} /></td>
                      <td className="px-4 py-3"><CheckerResultPill result={result} /></td>
                      <td className="max-w-sm px-4 py-3 text-[#475467]"><TextDetails text={testCase.llmExpectedResult || '-'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => onApprove(testCase)} disabled={disabled || testCase.approvalStatus === 'APPROVED'}>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => onReject(testCase)} disabled={disabled || testCase.approvalStatus === 'REJECTED'}>
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => onReopen(testCase)} disabled={disabled || testCase.approvalStatus === 'DRAFT'}>
                            Reopen
                          </Button>
                          <Button size="sm" onClick={() => onCheckerRewrite(testCase)} disabled={disabled || !checkerFailed}>
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Checker rewrite
                          </Button>
                          <Button size="sm" onClick={() => onHumanRewrite(testCase)} disabled={disabled}>
                            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                            Human rewrite
                          </Button>
                          <Button size="sm" onClick={() => onEdit(testCase)} disabled={disabled}>
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button size="sm" onClick={() => onVersions(testCase)}>
                            <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Versions
                          </Button>
                          <JsonViewButton title={`${getTestCaseCode(testCase)} JSON`} value={testCase.llmOutputJson} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </StickyScrollX>
        </Panel>
      ))}
    </div>
  )
}

function JobHistoryTable({ jobs, checkerRuns }: { jobs: TestCaseJobResponse[]; checkerRuns: TestCaseCheckerRun[] }) {
  const sortedJobs = [...jobs].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return tb - ta
  })
  if (sortedJobs.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No jobs for this batch" />
      </div>
    )
  }

  return (
    <StickyScrollX>
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
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
          {sortedJobs.map((job) => (
            <tr key={job.id} className="border-b border-[#edf1f6] align-top last:border-0">
              <td className="px-4 py-3"><JobTypePill jobType={job.jobType} /></td>
              <td className="px-4 py-3"><StatusPill value={job.status} /></td>
              <td className="px-4 py-3"><span className="font-mono text-xs text-[#667085]">{job.id}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(job.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(job.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <JsonViewButton title={`${job.jobType} Input`} value={job.inputPayload} label="Input" />
                  <JsonViewButton title={`${job.jobType} Result`} value={job.resultPayload} label="Result" />
                </div>
              </td>
              <td className="max-w-xs px-4 py-3 text-xs text-[#b42318]">{job.errorMessage || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {checkerRuns.length > 0 ? (
        <div className="border-t border-[#e3e8f0] p-4">
          <p className="mb-3 text-sm font-semibold text-[#172033]">Checker Runs</p>
          <div className="grid gap-2 md:grid-cols-2">
            {checkerRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#172033]">{run.checkScope || run.sourceSemanticRuleCode || run.id}</p>
                    <p className="mt-1 font-mono text-xs text-[#667085]">{run.checkerJobId}</p>
                  </div>
                  <StatusPill value={run.calcGovernanceGate} />
                </div>
                <p className="mt-2 text-xs text-[#667085]">{formatDate(run.checkedAt)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </StickyScrollX>
  )
}

function VersionHistoryDialog({ testCase, batchId, onClose }: { testCase: GeneratedTestCase; batchId: string; onClose: () => void }) {
  const versionsQuery = useQuery({
    queryKey: ['test-case-versions', batchId, testCase.sourceAtomicRuleId],
    queryFn: () => testCasesApi.versions(testCase.sourceAtomicRuleId, batchId),
  })
  const versions = versionsQuery.data || []

  return (
    <TestCaseDialog title="Version History" description={getTestCaseCode(testCase)} onClose={onClose} wide>
      {versionsQuery.isLoading ? (
        <p className="text-sm text-[#667085]">Loading versions...</p>
      ) : versionsQuery.error ? (
        <ErrorNotice message={getErrorMessage(versionsQuery.error)} />
      ) : versions.length === 0 ? (
        <EmptyState title="No versions found" />
      ) : (
        <StickyScrollX>
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Latest</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Approval</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Title</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Maker Job</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
                <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">JSON</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-b border-[#edf1f6] align-top last:border-0">
                  <td className="px-4 py-3 text-[#667085]">v{version.testCaseVersion}</td>
                  <td className="px-4 py-3"><StatusPill value={version.isLatest ? 'LATEST' : 'OLD'} /></td>
                  <td className="px-4 py-3"><StatusPill value={version.approvalStatus} /></td>
                  <td className="max-w-sm px-4 py-3 text-[#475467]"><TextDetails text={version.llmTestCaseTitle || '-' } /></td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-[#667085]">{version.makerJobId || '-'}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(version.updatedAt)}</td>
                  <td className="px-4 py-3"><JsonViewButton title={`v${version.testCaseVersion} JSON`} value={version.llmOutputJson} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyScrollX>
      )}
    </TestCaseDialog>
  )
}

function TestCaseDialog({
  title,
  description,
  children,
  onClose,
  wide,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/45 px-4 py-6">
      <div className={cn('max-h-full w-full overflow-auto rounded-lg border border-[#d8dee8] bg-white shadow-xl', wide ? 'max-w-6xl' : 'max-w-3xl')}>
        <div className="flex items-start justify-between gap-4 border-b border-[#e3e8f0] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#172033]">{title}</h2>
            {description ? <p className="mt-1 truncate text-sm text-[#667085]">{description}</p> : null}
          </div>
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function CheckerResultPill({ result }: { result?: TestCaseCheckerResult }) {
  if (!result) return <StatusPill value="NOT_CHECKED" />
  return <StatusPill value={result.calcIsPassing || 'REVIEWED'} />
}

function JobTypePill({ jobType }: { jobType: string }) {
  const colors: Record<string, string> = {
    TEST_CASE_MAKER: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    TEST_CASE_CHECKER: 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]',
    TEST_CASE_REWRITE: 'border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]',
    TEST_CASE_EDIT: 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', colors[jobType] || 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]')}>
      {jobType.replaceAll('_', ' ')}
    </span>
  )
}

function TextDetails({ text }: { text: string }) {
  const safeText = text || '-'
  const preview = safeText.length > 80 ? safeText.slice(0, 80) + '...' : safeText
  if (safeText.length <= 80) return <span>{safeText}</span>
  return (
    <details className="rounded-md border border-[#d8dee8] bg-[#f8fafc]">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#175cd3] hover:bg-[#edf2f7]">
        {preview}
      </summary>
      <div className="border-t border-[#e3e8f0] p-3 text-xs">{safeText}</div>
    </details>
  )
}

function getTestCaseCode(testCase: GeneratedTestCase) {
  return testCase.calcTestCaseCode || testCase.sourceAtomicRuleCode || testCase.id
}

function latestJob(jobs: TestCaseJobResponse[], jobType: string) {
  return jobs
    .filter((job) => job.jobType === jobType)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })[0]
}

function formatJobType(jobType?: string | null) {
  return (jobType || 'Job').replaceAll('_', ' ').toLowerCase()
}

function testCaseToEditPayload(testCase: GeneratedTestCase, editorId: string): TestCaseEditPayload {
  const output = asRecord(parseJsonText(testCase.llmOutputJson)) || {}
  return {
    editorId,
    title: testCase.llmTestCaseTitle || stringField(output, 'title') || getTestCaseCode(testCase),
    objective: testCase.llmObjective || stringField(output, 'objective') || '',
    ruleUnderTest: asRecord(parseJsonText(testCase.llmRuleUnderTest)) || asRecord(output.rule_under_test) || {},
    preconditions: stringArray(parseJsonText(testCase.llmPreconditions)) || stringArray(output.preconditions) || [],
    testData: asRecord(parseJsonText(testCase.llmTestData)) || asRecord(output.test_data) || {},
    testSteps: recordArray(parseJsonText(testCase.llmTestSteps)) || recordArray(output.test_steps) || [],
    expectedResult: testCase.llmExpectedResult || stringField(output, 'expected_result') || '',
    variants: recordArray(parseJsonText(testCase.llmVariants)) || recordArray(output.variants) || [],
    priority: testCase.llmPriority || stringField(output, 'priority') || 'MEDIUM',
    testType: testCase.llmTestType || stringField(output, 'test_type') || 'POSITIVE',
    assumptions: stringArray(parseJsonText(testCase.llmAssumptions)) || stringArray(output.assumptions) || [],
    traceability: asRecord(parseJsonText(testCase.llmTraceability)) || asRecord(output.traceability) || {},
  }
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

function recordArray(value: unknown): JsonRecord[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map((item) => String(item))
}

function stringField(record: JsonRecord | null, field: string) {
  const value = record?.[field]
  return typeof value === 'string' ? value : null
}

function numberField(record: JsonRecord | null, field: string) {
  const value = record?.[field]
  return typeof value === 'number' ? value : null
}
