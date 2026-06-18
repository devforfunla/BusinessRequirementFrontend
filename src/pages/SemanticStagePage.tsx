import { type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  Edit3,
  Eye,
  History,
  MessageSquareText,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getErrorMessage,
  getSemanticRuleBusinessIntent,
  getSemanticRuleCode,
  getSemanticRuleSummary,
  isJobRunning,
  jobsApi,
  parseJsonText,
  semanticCheckerApi,
  semanticMakerApi,
  semanticRulesApi,
  workflowsApi,
  type AsyncJob,
  type CheckerRun,
  type JsonRecord,
  type SemanticRule,
  type SemanticRuleRewriteMode,
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
  StatusPill,
  StickyScrollX,
  Tabs,
  type TabItem,
  TextArea,
} from '../components/ui'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { latestJob } from '../workflowJobUtils'

type SemanticJobAction = 'semantic-checker'

const semanticJobTypes = ['SEMANTIC_MAKER', 'SEMANTIC_CHECKER', 'SEMANTIC_REWRITE', 'SEMANTIC_EDIT']
const approvedButtonClass =
  'border-[#079455] bg-[#079455] text-white hover:bg-[#079455] disabled:cursor-default disabled:opacity-100'

const tabs: TabItem[] = [
  { id: 'maker', label: 'Maker', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'checker', label: 'Checker', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'review', label: 'Review', icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'history', label: 'Job History', icon: <History className="h-3.5 w-3.5" /> },
]

export function SemanticStagePage() {
  const { workflowId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('maker')
  const [humanRewriteRule, setHumanRewriteRule] = useState<SemanticRule | null>(null)
  const [humanFeedback, setHumanFeedback] = useState('')
  const [editRule, setEditRule] = useState<SemanticRule | null>(null)
  const [editText, setEditText] = useState('')
  const semanticRulesQueryKey = ['semantic-rules', workflowId] as const

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
      return jobs?.some((job) => isJobRunning(job.status)) ? 2000 : 5000
    },
  })

  const semanticRulesQuery = useQuery({
    queryKey: semanticRulesQueryKey,
    queryFn: () => semanticRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  // When SEMANTIC_MAKER job completes (user may have started from documents page),
  // refetch semantic rules so the list updates without manual refresh
  useEffect(() => {
    const jobs = jobsQuery.data || []
    const makerJob = jobs.find((j) => j.jobType === 'SEMANTIC_MAKER')
    if (makerJob && (makerJob.status === 'SUCCEEDED' || makerJob.status === 'PARTIAL_SUCCESS')) {
      void queryClient.invalidateQueries({ queryKey: semanticRulesQueryKey })
    }
  }, [jobsQuery.data, queryClient, semanticRulesQueryKey])

  const semanticRunQuery = useQuery({
    queryKey: ['semantic-checker-run', workflowId],
    queryFn: () => semanticCheckerApi.latestRun(workflowId),
    enabled: Boolean(workflowId),
  })

  const semanticResultsQuery = useQuery({
    queryKey: ['semantic-checker-results', workflowId],
    queryFn: () => semanticCheckerApi.latestResults(workflowId),
    enabled: Boolean(workflowId),
  })

  const jobQuery = usePolledJob(activeJobId)

  // Resolve default tab based on pipeline progress
  useEffect(() => {
    const jobs = jobsQuery.data || []
    const semanticJobs = jobs.filter((j) => semanticJobTypes.includes(j.jobType))
    const hasRewrite = semanticJobs.some((j) => j.jobType === 'SEMANTIC_REWRITE' || j.jobType === 'SEMANTIC_EDIT')
    const hasChecker = semanticJobs.some((j) => j.jobType === 'SEMANTIC_CHECKER')
    const nextTab = hasRewrite ? 'review' : hasChecker ? 'checker' : 'maker'
    const timer = window.setTimeout(() => setActiveTab(nextTab), 0)
    return () => window.clearTimeout(timer)
    // Only run on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsQuery.data !== undefined])

  useEffect(() => {
    const job = jobQuery.data
    if (!job) return
    if (job.status === 'SUCCEEDED' || job.status === 'PARTIAL_SUCCESS') {
      if (job.status === 'PARTIAL_SUCCESS') {
        toast.warning(`${semanticJobSuccessMessage(job.jobType)} (partial success)`)
      } else {
        toast.success(semanticJobSuccessMessage(job.jobType))
      }
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries()
      // Re-run maker creates a new workflow — navigate to it
      if (job.jobType === 'SEMANTIC_MAKER' && job.workflowId && job.workflowId !== workflowId) {
        setWorkflowId(job.workflowId)
        navigate(`/workflows/${encodeURIComponent(job.workflowId)}/semantic`)
      }
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || semanticJobFailureMessage(job.jobType))
      window.setTimeout(() => setActiveJobId(null), 0)
    }
  }, [jobQuery.data, queryClient, navigate, workflowId, setWorkflowId])

  const startJobMutation = useMutation({
    mutationFn: async (action: SemanticJobAction) => {
      if (action === 'semantic-checker') return semanticCheckerApi.run(workflowId)
      throw new Error(`Unsupported semantic action: ${action}`)
    },
    onSuccess: (response) => {
      setActiveJobId(response.jobId)
      toast.success('Semantic checker job queued')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const approveSemanticMutation = useMutation({
    mutationFn: (semanticRuleId: string) => semanticRulesApi.approve(semanticRuleId, reviewerId || 'reviewer-poc'),
    onMutate: async (semanticRuleId) => {
      await queryClient.cancelQueries({ queryKey: semanticRulesQueryKey })
      const previousRules = queryClient.getQueryData<SemanticRule[]>(semanticRulesQueryKey)
      queryClient.setQueryData<SemanticRule[]>(semanticRulesQueryKey, (rules) =>
        rules?.map((rule) => (rule.id === semanticRuleId ? { ...rule, approvalStatus: 'APPROVED' } : rule)),
      )
      return { previousRules }
    },
    onSuccess: (approvedRule) => {
      toast.success('Semantic rule approved')
      queryClient.setQueryData<SemanticRule[]>(semanticRulesQueryKey, (rules) =>
        rules?.map((rule) => (rule.id === approvedRule.id ? approvedRule : rule)),
      )
    },
    onError: (error, _semanticRuleId, context) => {
      if (context?.previousRules) queryClient.setQueryData(semanticRulesQueryKey, context.previousRules)
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: semanticRulesQueryKey })
    },
  })

  const approveAllMutation = useMutation({
    mutationFn: () => semanticRulesApi.approveAll(workflowId, reviewerId || 'reviewer-poc'),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: semanticRulesQueryKey })
      const previousRules = queryClient.getQueryData<SemanticRule[]>(semanticRulesQueryKey)
      queryClient.setQueryData<SemanticRule[]>(semanticRulesQueryKey, (rules) =>
        rules?.map((rule) => ({ ...rule, approvalStatus: 'APPROVED' })),
      )
      return { previousRules }
    },
    onSuccess: () => {
      toast.success('Semantic rules approved')
    },
    onError: (error, _variables, context) => {
      if (context?.previousRules) queryClient.setQueryData(semanticRulesQueryKey, context.previousRules)
      toast.error(getErrorMessage(error))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: semanticRulesQueryKey })
    },
  })

  const proceedMutation = useMutation({
    mutationFn: () => semanticRulesApi.approvalStatus(workflowId),
    onSuccess: (data) => {
      const canProceed = (data as Record<string, unknown>).canProceed
      if (canProceed) {
        navigate(`/workflows/${encodeURIComponent(workflowId)}/atomic`)
      } else {
        toast.error('Cannot proceed to next stage unless all semantic rules are approved.')
      }
    },
    onError: () => toast.error('Failed to check approval status.'),
  })

  const documentId = workflowQuery.data?.documentId || ''

  const reRunMakerMutation = useMutation({
    mutationFn: () => semanticMakerApi.extract(documentId, reviewerId || 'reviewer-poc', true),
    onSuccess: (response) => {
      setActiveJobId(response.jobId)
      toast.success('Semantic maker re-run job queued')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rewriteSemanticMutation = useMutation({
    mutationFn: ({
      semanticRuleId,
      rewriteMode,
      humanFeedback,
    }: {
      semanticRuleId: string
      rewriteMode: SemanticRuleRewriteMode
      humanFeedback?: string
    }) => semanticRulesApi.rewrite(semanticRuleId, { workflowId, rewriteMode, humanFeedback }),
    onSuccess: (response) => {
      setActiveJobId(response.jobId)
      setHumanRewriteRule(null)
      setHumanFeedback('')
      toast.success('Semantic rewrite job queued')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const editSemanticMutation = useMutation({
    mutationFn: () => {
      if (!editRule) throw new Error('Select a semantic rule first.')
      const parsed = JSON.parse(editText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Edited semantic rule must be a JSON object.')
      }
      return semanticRulesApi.editByHuman(editRule.id, parsed as JsonRecord, reviewerId || 'reviewer-poc')
    },
    onSuccess: () => {
      setEditRule(null)
      setEditText('')
      toast.success('Semantic rule edit saved')
      void queryClient.invalidateQueries({ queryKey: semanticRulesQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['semantic-checker-results', workflowId] })
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const openEditDialog = (rule: SemanticRule) => {
    const parsed = parseJsonText(rule.llmOutputJson)
    setEditRule(rule)
    setEditText(JSON.stringify(
      !parsed || typeof parsed !== 'object' || Array.isArray(parsed) ? buildEditableSemanticRule(rule) : parsed,
      null,
      2,
    ))
  }

  const semanticRules = semanticRulesQuery.data || []
  const semanticResults = semanticResultsQuery.data || []
  const jobs = jobsQuery.data || []
  const approvedSemanticCount = semanticRules.filter((rule) => rule.approvalStatus === 'APPROVED').length
  const allSemanticRulesApproved = semanticRules.length > 0 && approvedSemanticCount === semanticRules.length
  const semanticResultByRule = new Map(semanticResults.map((result) => [result.targetSemanticRuleId, result]))
  const firstError = workflowQuery.error || jobsQuery.error || semanticRulesQuery.error || semanticRunQuery.error || semanticResultsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Semantic Rule Stage"
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

      <WorkflowStagePipeline workflowId={workflowId} activeStage="semantic" />
      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      {/* Tabs */}
      <Panel>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* ===== Maker Tab ===== */}
        {activeTab === 'maker' ? (
          <div className="space-y-4 p-4">
            <WorkflowStageJobs title="Semantic Maker Jobs" jobs={jobs} jobTypes={['SEMANTIC_MAKER']} />

            <Panel>
              <PanelHeader title="Maker Summary" />
              <div className="p-4">
                <JobSummaryCard title="Latest Semantic Maker" job={latestJob(jobs, 'SEMANTIC_MAKER')} />
              </div>
            </Panel>

            {/* Extracted semantic rules - read-only list */}
            <Panel>
              <PanelHeader
                title="Extracted Semantic Rules"
                description={`${semanticRules.length} semantic rule${semanticRules.length !== 1 ? 's' : ''} extracted`}
              />
              {semanticRules.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No semantic rules yet" description="Run semantic maker from the documents page." />
                </div>
              ) : (
                <StickyScrollX>
                  <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule Code</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Section</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Summary</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">JSON</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanticRules.map((rule) => (
                        <tr key={rule.id} className="border-b border-[#edf1f6] align-top last:border-0">
                          <td className="px-4 py-3">
                            <Link
                              className="font-medium text-[#175cd3] hover:underline"
                              to={`/workflows/${encodeURIComponent(workflowId)}/semantic/${encodeURIComponent(rule.id)}`}
                            >
                              {getSemanticRuleCode(rule)}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[#667085]">v{rule.semanticVersion ?? 0}</td>
                          <td className="px-4 py-3 text-[#667085]">{rule.llmSection || '-'}</td>
                          <td className="max-w-xs px-4 py-3 text-[#475467]">
                            <TextDetails text={getSemanticRuleSummary(rule) || getSemanticRuleBusinessIntent(rule) || '-'} />
                          </td>
                          <td className="px-4 py-3"><StatusPill value={rule.approvalStatus} /></td>
                          <td className="px-4 py-3">
                            <JsonViewButton title={`${getSemanticRuleCode(rule)} JSON`} value={rule.llmOutputJson} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StickyScrollX>
              )}
            </Panel>
          </div>
        ) : null}

        {/* ===== Checker Tab ===== */}
        {activeTab === 'checker' ? (
          <div className="space-y-4 p-4">
            {/* Governance banner */}
            <CheckerGovernanceBanner run={semanticRunQuery.data} />

            <WorkflowStageJobs title="Semantic Checker Jobs" jobs={jobs} jobTypes={['SEMANTIC_CHECKER']} />

            <Panel>
              <PanelHeader
                title="Checker Summary"
                actions={
                  <Button
                    onClick={() => startJobMutation.mutate('semantic-checker')}
                    disabled={startJobMutation.isPending || Boolean(activeJobId) || semanticRules.length === 0}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Run Semantic Checker
                  </Button>
                }
              />
              <div className="p-4">
                <CheckerSummary title="Latest Checker Run" run={semanticRunQuery.data} />
              </div>
            </Panel>

            {/* Per-rule findings - read-only */}
            <Panel>
              <PanelHeader
                title="Per-Rule Findings"
                description={`${semanticResults.length} rule${semanticResults.length !== 1 ? 's' : ''} checked`}
              />
              {semanticResults.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No checker findings yet" description="Run the semantic checker to see per-rule results." />
                </div>
              ) : (
                <StickyScrollX>
                  <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker Result</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Blocking</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Quality</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker Job</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checked At</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanticResults.map((result) => {
                        const parentRule = semanticRules.find((r) => r.id === result.targetSemanticRuleId)
                        return (
                          <tr key={result.id} className="border-b border-[#edf1f6] align-top last:border-0">
                            <td className="px-4 py-3">
                              {parentRule ? (
                                <Link
                                  className="font-medium text-[#175cd3] hover:underline"
                                  to={`/workflows/${encodeURIComponent(workflowId)}/semantic/${encodeURIComponent(parentRule.id)}`}
                                >
                                  {getSemanticRuleCode(parentRule)}
                                </Link>
                              ) : (
                                <span className="text-[#667085]">{result.targetSemanticRuleId}</span>
                              )}
                            </td>
                            <td className="px-4 py-3"><StatusPill value={result.llmIsPassing} /></td>
                            <td className="px-4 py-3 text-[#667085]">{result.calcBlockingCategory || '-'}</td>
                            <td className="px-4 py-3 text-[#667085]">{result.calcQualityScore || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-[#667085]">{result.checkerJobId}</span>
                            </td>
                            <td className="px-4 py-3 text-[#667085]">{formatDate(result.checkedAt)}</td>
                            <td className="px-4 py-3">
                              <JsonViewButton
                                title="Checker Findings"
                                value={result.llmReviewEntry || result.llmFindings}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </StickyScrollX>
              )}
            </Panel>
          </div>
        ) : null}

        {/* ===== Review Tab ===== */}
        {activeTab === 'review' ? (
          <div className="space-y-4 p-4">
            {/* Rewrite/Edit job history */}
            <WorkflowStageJobs title="Review Jobs" jobs={jobs} jobTypes={['SEMANTIC_REWRITE', 'SEMANTIC_EDIT']} />

            {/* Actionable rules table */}
            <Panel>
              <PanelHeader
                title="Semantic Rules Review"
                description={`${approvedSemanticCount}/${semanticRules.length} approved`}
                actions={
                  <>
                    <Button
                      onClick={() => reRunMakerMutation.mutate()}
                      disabled={reRunMakerMutation.isPending || Boolean(activeJobId) || !documentId}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Re-run Maker
                    </Button>
                    <Button
                      onClick={() => approveAllMutation.mutate()}
                      disabled={approveAllMutation.isPending || semanticRules.length === 0 || allSemanticRulesApproved}
                      className={allSemanticRulesApproved ? approvedButtonClass : undefined}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {allSemanticRulesApproved ? 'All Approved' : 'Approve All'}
                    </Button>
                    <Button
                      onClick={() => proceedMutation.mutate()}
                      disabled={proceedMutation.isPending || semanticRules.length === 0}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      Proceed to Atomic
                    </Button>
                  </>
                }
              />
              {semanticRules.length === 0 && !semanticRulesQuery.isLoading ? (
                <div className="p-4"><EmptyState title="No semantic rules yet" description="Run semantic maker from the documents page." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1780px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Approval</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Summary</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic JSON</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker JSON</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semanticRules.map((rule) => {
                        const result = semanticResultByRule.get(rule.id)
                        const isApproved = rule.approvalStatus === 'APPROVED'
                        return (
                          <tr key={rule.id} className="border-b border-[#edf1f6] align-top last:border-0">
                            <td className="px-4 py-3">
                              <Link className="font-medium text-[#175cd3] hover:underline" to={`/workflows/${encodeURIComponent(workflowId)}/semantic/${encodeURIComponent(rule.id)}`}>
                                {getSemanticRuleCode(rule)}
                              </Link>
                              <p className="text-xs text-[#667085]">
                                v{rule.semanticVersion ?? 0}
                                {rule.llmSection ? ` - ${rule.llmSection}` : ''}
                              </p>
                            </td>
                            <td className="px-4 py-3"><StatusPill value={rule.approvalStatus} /></td>
                            <td className="px-4 py-3">
                              <StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} />
                            </td>
                            <td className="max-w-xs px-4 py-3 text-[#475467]">
                              <TextDetails text={getSemanticRuleSummary(rule) || getSemanticRuleBusinessIntent(rule) || '-'} />
                            </td>
                            <td className="w-[100px] px-4 py-3">
                              <JsonViewButton
                                title={`${getSemanticRuleCode(rule)} JSON`}
                                value={rule.llmOutputJson}
                              />
                            </td>
                            <td className="w-[100px] px-4 py-3">
                              <JsonViewButton
                                title={`${getSemanticRuleCode(rule)} Checker`}
                                value={result?.llmReviewEntry || result?.llmFindings}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveSemanticMutation.mutate(rule.id)}
                                  disabled={approveSemanticMutation.isPending || isApproved}
                                  className={isApproved ? approvedButtonClass : undefined}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  {isApproved ? 'Approved' : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  title={!result ? 'Run semantic checker first' : undefined}
                                  onClick={() =>
                                    rewriteSemanticMutation.mutate({
                                      semanticRuleId: rule.id,
                                      rewriteMode: 'CHECKER_FEEDBACK',
                                    })
                                  }
                                  disabled={rewriteSemanticMutation.isPending || Boolean(activeJobId) || !result}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  Checker rewrite
                                </Button>
                                <Button size="sm" onClick={() => setHumanRewriteRule(rule)} disabled={rewriteSemanticMutation.isPending || Boolean(activeJobId)}>
                                  <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                                  Human rewrite
                                </Button>
                                <Button size="sm" onClick={() => openEditDialog(rule)} disabled={editSemanticMutation.isPending}>
                                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Edit
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        ) : null}

        {/* ===== Job History Tab ===== */}
        {activeTab === 'history' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="All Semantic Jobs"
                description={`${jobs.filter((j) => semanticJobTypes.includes(j.jobType)).length} job${jobs.filter((j) => semanticJobTypes.includes(j.jobType)).length !== 1 ? 's' : ''} total`}
              />
              <JobHistoryTable jobs={jobs} jobTypes={semanticJobTypes} />
            </Panel>
          </div>
        ) : null}
      </Panel>

      {/* ===== Dialogs ===== */}
      {humanRewriteRule ? (
        <SemanticDialog
          title="Human Rewrite"
          description={getSemanticRuleCode(humanRewriteRule)}
          onClose={() => {
            setHumanRewriteRule(null)
            setHumanFeedback('')
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              rewriteSemanticMutation.mutate({
                semanticRuleId: humanRewriteRule.id,
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
                  setHumanRewriteRule(null)
                  setHumanFeedback('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={rewriteSemanticMutation.isPending || !humanFeedback.trim()}>
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Queue Rewrite
              </Button>
            </div>
          </form>
        </SemanticDialog>
      ) : null}

      {editRule ? (
        <SemanticDialog
          title="Edit Semantic Rule"
          description={getSemanticRuleCode(editRule)}
          onClose={() => {
            setEditRule(null)
            setEditText('')
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              editSemanticMutation.mutate()
            }}
          >
            <Label label="Semantic JSON">
              <TextArea className="min-h-[420px] font-mono text-xs" value={editText} onChange={(event) => setEditText(event.target.value)} />
            </Label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  setEditRule(null)
                  setEditText('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={editSemanticMutation.isPending || !editText.trim()}>
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Save Edit
              </Button>
            </div>
          </form>
        </SemanticDialog>
      ) : null}
    </div>
  )
}

// ==================== Helper Components ====================

function semanticJobSuccessMessage(jobType?: string | null) {
  if (jobType === 'SEMANTIC_REWRITE') return 'Semantic rewrite completed'
  if (jobType === 'SEMANTIC_EDIT') return 'Semantic edit completed'
  return 'Semantic checker completed'
}

function semanticJobFailureMessage(jobType?: string | null) {
  if (jobType === 'SEMANTIC_REWRITE') return 'Semantic rewrite failed'
  if (jobType === 'SEMANTIC_EDIT') return 'Semantic edit failed'
  return 'Semantic checker failed'
}

function buildEditableSemanticRule(rule: SemanticRule) {
  const summary = getSemanticRuleSummary(rule) || ''
  const intent = getSemanticRuleBusinessIntent(rule) || summary || 'Human-edited semantic rule'
  return {
    semantic_rule_code: getSemanticRuleCode(rule),
    source: {
      doc_type: 'business_requirement',
      section: rule.llmSection || '',
      raw_text_scope: rule.llmSection || '',
    },
    business_intent: intent,
    summary: summary || intent,
    business_context: intent,
    preconditions: [],
    acceptance_criteria: [],
    cross_refs: [],
    tags: [],
  }
}

function SemanticDialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/45 px-4 py-6">
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-lg border border-[#d8dee8] bg-white shadow-xl">
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

function TextDetails({ text }: { text: string }) {
  const preview = text.length > 60 ? text.slice(0, 60) + '...' : text
  if (text.length <= 60) return <span>{text}</span>
  return (
    <details className="rounded-md border border-[#d8dee8] bg-[#f8fafc]">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#175cd3] hover:bg-[#edf2f7]">
        {preview}
      </summary>
      <div className="border-t border-[#e3e8f0] p-3 text-xs">{text}</div>
    </details>
  )
}

function CheckerGovernanceBanner({ run }: { run?: CheckerRun | null }) {
  if (!run) return null
  const gate = run.calcGovernanceGate || 'UNKNOWN'
  const bgColor =
    gate === 'PASSED' ? 'border-[#9bd4b5] bg-[#ecfdf3]' :
    gate === 'FAILED' ? 'border-[#f7b4ae] bg-[#fff1f0]' :
    'border-[#d8dee8] bg-[#f8fafc]'
  const textColor =
    gate === 'PASSED' ? 'text-[#067647]' :
    gate === 'FAILED' ? 'text-[#b42318]' :
    'text-[#475467]'

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${bgColor}`}>
      <ShieldCheck className={`h-6 w-6 ${textColor}`} />
      <div>
        <p className={`text-sm font-semibold ${textColor}`}>
          Governance Gate: {gate}
        </p>
        {run.llmHighLevelFeedback ? (
          <p className="mt-1 text-sm text-[#475467]">{run.llmHighLevelFeedback}</p>
        ) : null}
      </div>
      <div className="ml-auto">
        <StatusPill value={gate} />
      </div>
    </div>
  )
}

function CheckerSummary({ title, run }: { title: string; run?: CheckerRun | null }) {
  if (!run) {
    return (
      <div className="rounded-md border border-dashed border-[#c8d0dc] bg-[#f8fafc] p-3">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <p className="mt-1 text-sm text-[#667085]">No checker run yet.</p>
      </div>
    )
  }

  const metrics = parseJsonText(run.calcGovernanceMetricsJson) as Record<string, unknown> | null
  const summary = parseJsonText(run.calcSummaryJson) as Record<string, unknown> | null
  const qualityScore = typeof metrics?.overall_quality_score === 'number' ? metrics.overall_quality_score : null
  const failureRate = typeof metrics?.semantic_failure_rate === 'number' ? metrics.semantic_failure_rate : null
  const totalChecks = typeof summary?.total_checks === 'number' ? summary.total_checks : null
  const passedChecks = typeof summary?.passed_checks === 'number' ? summary.passed_checks : null
  const failedChecks = typeof summary?.failed_checks === 'number' ? summary.failed_checks : null

  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <StatusPill value={run.calcGovernanceGate} />
      </div>

      {(totalChecks != null) ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded bg-[#f0f5ff] px-2 py-0.5 text-[#175cd3]">
            {totalChecks} checks
          </span>
          {passedChecks != null && (
            <span className="rounded bg-[#ecfdf3] px-2 py-0.5 text-[#079455]">
              {passedChecks} passed
            </span>
          )}
          {failedChecks != null && (
            <span className="rounded bg-[#fef3f2] px-2 py-0.5 text-[#b42318]">
              {failedChecks} failed
            </span>
          )}
        </div>
      ) : null}

      {qualityScore != null ? (
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="rounded bg-[#f0f5ff] px-2 py-0.5 text-[#175cd3]">
            Score: {(qualityScore * 100).toFixed(1)}%
          </span>
          {failureRate != null && failureRate > 0 ? (
            <span className="rounded bg-[#fef3f2] px-2 py-0.5 text-[#b42318]">
              Failure: {(failureRate * 100).toFixed(1)}%
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-[#667085]">{run.model || 'model unknown'} - {formatDate(run.checkedAt)}</p>
      {run.calcSummaryJson ? <JsonViewButton title="Checker JSON" value={run.calcSummaryJson} label="View JSON" /> : null}
    </div>
  )
}

function JobHistoryTable({ jobs, jobTypes }: { jobs: AsyncJob[]; jobTypes: string[] }) {
  const [compareJob, setCompareJob] = useState<AsyncJob | null>(null)

  const stageJobs = jobs
    .filter((j) => jobTypes.includes(j.jobType))
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta // newest first
    })

  if (stageJobs.length === 0) {
    return (
      <div className="p-4">
        <EmptyState title="No jobs yet" description="Jobs will appear here once you run maker, checker, or review operations." />
      </div>
    )
  }

  return (
    <>
      <StickyScrollX>
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
            <tr>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">#</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job Type</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job ID</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Triggered By</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Created</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Error</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {stageJobs.map((job, index) => {
              const isEdit = job.jobType === 'SEMANTIC_EDIT' || job.jobType === 'SEMANTIC_REWRITE'
              return (
                <tr key={job.id} className="border-b border-[#edf1f6] align-top last:border-0">
                  <td className="px-4 py-3 text-[#667085]">{stageJobs.length - index}</td>
                  <td className="px-4 py-3">
                    <JobTypePill jobType={job.jobType} />
                  </td>
                  <td className="px-4 py-3"><StatusPill value={job.status} /></td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[#667085]">{job.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    {job.triggeredByJobId ? (
                      <span className="font-mono text-xs text-[#175cd3]">{job.triggeredByJobId}</span>
                    ) : (
                      <span className="text-xs text-[#98a2b3]">manual</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#667085]">{formatDate(job.createdAt)}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-[#b42318]">{job.errorMessage || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <JsonViewButton title={`${job.jobType} Result`} value={job.resultPayload} />
                      {isEdit && job.status === 'SUCCEEDED' ? (
                        <Button size="sm" onClick={() => setCompareJob(job)}>Compare</Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </StickyScrollX>
      {compareJob ? (
        <SemanticVersionCompareDrawer job={compareJob} onClose={() => setCompareJob(null)} />
      ) : null}
    </>
  )
}

function SemanticVersionCompareDrawer({ job, onClose }: { job: AsyncJob; onClose: () => void }) {
  const payload = parseJsonText(job.resultPayload) as Record<string, unknown> | null
  const oldRuleId = payload?.oldSemanticRuleId as string | undefined
  const newRuleId = payload?.newSemanticRuleId as string | undefined
  const ruleCode = payload?.semanticRuleCode as string | undefined
  const oldVersion = payload?.oldVersion as number | undefined
  const newVersion = payload?.newVersion as number | undefined

  const oldRuleQuery = useQuery({
    queryKey: ['semantic-rule', oldRuleId],
    queryFn: () => semanticRulesApi.get(oldRuleId!),
    enabled: Boolean(oldRuleId),
  })
  const newRuleQuery = useQuery({
    queryKey: ['semantic-rule', newRuleId],
    queryFn: () => semanticRulesApi.get(newRuleId!),
    enabled: Boolean(newRuleId),
  })

  const oldJson = oldRuleQuery.data?.llmOutputJson
  const newJson = newRuleQuery.data?.llmOutputJson
  const isLoading = oldRuleQuery.isLoading || newRuleQuery.isLoading

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#101828]/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 flex h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-[#c8d0dc] bg-white shadow-2xl my-4">
        <div className="flex items-center justify-between border-b border-[#e3e8f0] bg-[#f8fafc] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-[#6d28d9] px-2 py-0.5 text-xs font-medium text-white">DIFF</span>
            <h2 className="text-sm font-semibold text-[#172033]">
              {ruleCode || 'Rule'} &mdash; v{oldVersion ?? '?'} &rarr; v{newVersion ?? '?'}
            </h2>
          </div>
          <Button size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <p className="text-sm text-[#667085]">Loading versions...</p>
          ) : !oldJson && !newJson ? (
            <p className="text-sm text-[#667085]">No JSON data available for comparison.</p>
          ) : (
            <DiffView oldJson={oldJson} newJson={newJson} oldLabel={`v${oldVersion ?? '?'}`} newLabel={`v${newVersion ?? '?'}`} />
          )}
        </div>
      </div>
    </div>
  )
}

function DiffView({ oldJson, newJson, oldLabel, newLabel }: { oldJson?: string | null; newJson?: string | null; oldLabel: string; newLabel: string }) {
  const oldParsed = parseJsonText(oldJson)
  const newParsed = parseJsonText(newJson)
  const oldFormatted = typeof oldParsed === 'string' ? oldParsed : JSON.stringify(oldParsed, null, 2) || ''
  const newFormatted = typeof newParsed === 'string' ? newParsed : JSON.stringify(newParsed, null, 2) || ''
  const oldLines = oldFormatted.split('\n')
  const newLines = newFormatted.split('\n')

  // Simple line-level diff: mark lines that differ
  const maxLen = Math.max(oldLines.length, newLines.length)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[#b42318]">{oldLabel} (Before)</p>
        <pre className="max-h-[70vh] overflow-auto rounded-md border border-[#e3e8f0] bg-white p-3 text-xs leading-5 text-[#24292f]">
          {Array.from({ length: maxLen }, (_, i) => {
            const line = oldLines[i] ?? ''
            const changed = line !== (newLines[i] ?? '')
            return (
              <div key={i} className={changed ? 'bg-[#fff1f0] text-[#b42318]' : ''}>
                <span className="mr-3 inline-block w-6 text-right text-[#98a2b3] select-none">{i + 1}</span>
                {line}
              </div>
            )
          })}
        </pre>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[#079455]">{newLabel} (After)</p>
        <pre className="max-h-[70vh] overflow-auto rounded-md border border-[#e3e8f0] bg-white p-3 text-xs leading-5 text-[#24292f]">
          {Array.from({ length: maxLen }, (_, i) => {
            const line = newLines[i] ?? ''
            const changed = line !== (oldLines[i] ?? '')
            return (
              <div key={i} className={changed ? 'bg-[#ecfdf3] text-[#067647]' : ''}>
                <span className="mr-3 inline-block w-6 text-right text-[#98a2b3] select-none">{i + 1}</span>
                {line}
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}

function JobTypePill({ jobType }: { jobType: string }) {
  const colors: Record<string, string> = {
    SEMANTIC_MAKER: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    SEMANTIC_CHECKER: 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]',
    SEMANTIC_REWRITE: 'border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]',
    SEMANTIC_EDIT: 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]',
    ATOMIC_MAKER: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    ATOMIC_CHECKER: 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]',
    ATOMIC_REWRITE: 'border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]',
    ATOMIC_REWRITE_CHECKER_FEEDBACK: 'border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]',
    ATOMIC_REWRITE_HUMAN_FEEDBACK: 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]',
    EDIT: 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]',
  }
  const label = jobType.replaceAll('_', ' ')
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${colors[jobType] || 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]'}`}>
      {label}
    </span>
  )
}
