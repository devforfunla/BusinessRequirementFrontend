import { type ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
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
  atomicCheckerApi,
  atomicMakerApi,
  atomicRulesApi,
  getAtomicRuleCode,
  getAtomicRuleSemanticCode,
  getErrorMessage,
  getSemanticRuleCode,
  isJobRunning,
  jobsApi,
  parseJsonText,
  rewriteApi,
  semanticRulesApi,
  workflowsApi,
  type AsyncJob,
  type AtomicRule,
  type CheckerRun,
  type ExtractionGroup,
  type JsonRecord,
  type SemanticRule,
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
import { cn, formatDate } from '../utils'
import { latestJob } from '../workflowJobUtils'

type AtomicJobAction = 'atomic-maker' | 'atomic-checker'
type AtomicRewriteMode = 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'

const atomicJobTypes = ['ATOMIC_MAKER', 'ATOMIC_CHECKER', 'ATOMIC_REWRITE', 'EDIT']
const approvedButtonClass =
  'border-[#079455] bg-[#079455] text-white hover:bg-[#079455] disabled:cursor-default disabled:opacity-100'

const tabDefs: TabItem[] = [
  { id: 'maker', label: 'Maker', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'checker', label: 'Checker', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { id: 'review', label: 'Review', icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'history', label: 'Job History', icon: <History className="h-3.5 w-3.5" /> },
]

export function AtomicStagePage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('maker')
  const [humanRewriteRule, setHumanRewriteRule] = useState<AtomicRule | null>(null)
  const [humanFeedback, setHumanFeedback] = useState('')
  const [editRule, setEditRule] = useState<AtomicRule | null>(null)
  const [editText, setEditText] = useState('')
  const atomicRulesQueryKey = ['atomic-rules', workflowId] as const

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
    queryKey: ['semantic-rules', workflowId],
    queryFn: () => semanticRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const atomicRulesQuery = useQuery({
    queryKey: atomicRulesQueryKey,
    queryFn: () => atomicRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const atomicRunQuery = useQuery({
    queryKey: ['atomic-checker-run', workflowId],
    queryFn: () => atomicCheckerApi.latestRun(workflowId),
    enabled: Boolean(workflowId),
  })

  const atomicResultsQuery = useQuery({
    queryKey: ['atomic-checker-results', workflowId],
    queryFn: () => atomicCheckerApi.latestResults(workflowId),
    enabled: Boolean(workflowId),
  })

  const extractionGroupsQuery = useQuery({
    queryKey: ['extraction-groups', workflowId],
    queryFn: () => atomicMakerApi.extractionGroups(workflowId),
    enabled: Boolean(workflowId),
  })

  const jobQuery = usePolledJob(activeJobId)

  // Resolve default tab based on pipeline progress
  useEffect(() => {
    const jobs = jobsQuery.data || []
    const atomicJobs = jobs.filter((j) => atomicJobTypes.includes(j.jobType))
    const hasRewrite = atomicJobs.some((j) => j.jobType === 'ATOMIC_REWRITE' || j.jobType === 'EDIT')
    const hasChecker = atomicJobs.some((j) => j.jobType === 'ATOMIC_CHECKER')
    if (hasRewrite) setActiveTab('review')
    else if (hasChecker) setActiveTab('checker')
    else setActiveTab('maker')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsQuery.data !== undefined])

  useEffect(() => {
    const job = jobQuery.data
    if (!job) return
    if (job.status === 'SUCCEEDED') {
      toast.success(`${formatJobType(job.jobType)} completed`)
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries()
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || `${formatJobType(job.jobType)} failed`)
      window.setTimeout(() => setActiveJobId(null), 0)
    }
  }, [jobQuery.data, queryClient])

  const startJobMutation = useMutation({
    mutationFn: async (action: AtomicJobAction) => {
      if (action === 'atomic-maker') return atomicMakerApi.extractAtomic(workflowId, reviewerId || 'reviewer-poc')
      return atomicCheckerApi.run(workflowId)
    },
    onSuccess: (response) => {
      setActiveJobId(response.jobId)
      toast.success('Atomic job queued')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const approveAtomicMutation = useMutation({
    mutationFn: (atomicRuleId: string) => atomicRulesApi.approve(atomicRuleId, reviewerId || 'reviewer-poc'),
    onSuccess: () => {
      toast.success('Atomic rule approved')
      void queryClient.invalidateQueries({ queryKey: atomicRulesQueryKey })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rewriteGroupMutation = useMutation({
    mutationFn: ({
      semanticRuleId,
      rewriteMode,
      humanFeedback,
    }: {
      semanticRuleId: string
      rewriteMode: AtomicRewriteMode
      humanFeedback?: string
    }) => rewriteApi.group({ semanticRuleId, workflowId, rewriteMode, humanFeedback }),
    onSuccess: (response) => {
      setActiveJobId(response.jobId)
      setHumanRewriteRule(null)
      setHumanFeedback('')
      toast.success('Atomic rewrite job queued')
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const editAtomicMutation = useMutation({
    mutationFn: () => {
      if (!editRule) throw new Error('Select an atomic rule first.')
      const parsed = JSON.parse(editText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Edited atomic rule must be a JSON object.')
      }
      return atomicRulesApi.editByHuman(editRule.id, parsed as JsonRecord, reviewerId || 'reviewer-poc')
    },
    onSuccess: () => {
      setEditRule(null)
      setEditText('')
      toast.success('Atomic rule edit saved')
      void queryClient.invalidateQueries({ queryKey: atomicRulesQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['atomic-checker-results', workflowId] })
      void queryClient.invalidateQueries({ queryKey: ['workflow-jobs', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const openEditDialog = (rule: AtomicRule) => {
    const parsed = parseJsonText(rule.content || rule.llmOutputJson)
    setEditRule(rule)
    setEditText(JSON.stringify(
      !parsed || typeof parsed !== 'object' || Array.isArray(parsed) ? buildEditableAtomicRule(rule) : parsed,
      null,
      2,
    ))
  }

  const semanticRules = semanticRulesQuery.data || []
  const atomicRules = atomicRulesQuery.data || []
  const atomicResults = atomicResultsQuery.data || []
  const extractionGroups = extractionGroupsQuery.data || []
  const jobs = jobsQuery.data || []
  const approvedSemanticCount = semanticRules.filter((rule) => rule.approvalStatus === 'APPROVED').length
  const canRunAtomicMaker = semanticRules.length > 0 && approvedSemanticCount === semanticRules.length
  const atomicResultByRule = new Map(atomicResults.map((result) => [result.targetRuleId, result]))
  const humanRewriteParent = humanRewriteRule ? findParentSemanticRule(humanRewriteRule, semanticRules) : null
  const firstError =
    workflowQuery.error || jobsQuery.error || semanticRulesQuery.error || atomicRulesQuery.error || atomicRunQuery.error || atomicResultsQuery.error || extractionGroupsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Atomic Rule Stage"
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

      <WorkflowStagePipeline workflowId={workflowId} activeStage="atomic" />
      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      {/* Tabs */}
      <Panel>
        <Tabs tabs={tabDefs} activeTab={activeTab} onChange={setActiveTab} />

        {/* ===== Maker Tab ===== */}
        {activeTab === 'maker' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="Atomic Maker"
                actions={
                  <Button
                    variant="primary"
                    onClick={() => startJobMutation.mutate('atomic-maker')}
                    disabled={startJobMutation.isPending || Boolean(activeJobId) || !canRunAtomicMaker}
                    title={!canRunAtomicMaker ? 'Approve all semantic rules first' : undefined}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Run Atomic Maker
                  </Button>
                }
              />
              <div className="p-4">
                <JobSummaryCard title="Latest Atomic Maker" job={latestJob(jobs, 'ATOMIC_MAKER')} />
              </div>
            </Panel>

            <WorkflowStageJobs title="Atomic Maker Jobs" jobs={jobs} jobTypes={['ATOMIC_MAKER']} />

            {/* Extraction Groups drill-down */}
            {extractionGroups.length > 0 ? (
              <Panel>
                <PanelHeader
                  title="Extraction Groups"
                  description={`${extractionGroups.length} parallel group${extractionGroups.length !== 1 ? 's' : ''}`}
                />
                <StickyScrollX>
                  <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Group</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic Rules</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic Rules</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job ID</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractionGroups.map((group) => (
                        <tr key={group.id} className="border-b border-[#edf1f6] align-top last:border-0">
                          <td className="px-4 py-3 font-medium text-[#172033]">{group.groupPrefix}</td>
                          <td className="px-4 py-3"><StatusPill value={group.status} /></td>
                          <td className="px-4 py-3 text-[#667085]">{group.semanticRuleCount}</td>
                          <td className="px-4 py-3 text-[#667085]">{group.atomicRulesCount}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-[#667085]">{group.jobId}</span>
                          </td>
                          <td className="max-w-xs px-4 py-3 text-xs text-[#b42318]">
                            {group.errorMessage || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StickyScrollX>
              </Panel>
            ) : null}

            {/* Extracted atomic rules - read-only list */}
            <Panel>
              <PanelHeader
                title="Extracted Atomic Rules"
                description={`${atomicRules.length} atomic rule${atomicRules.length !== 1 ? 's' : ''}`}
              />
              {atomicRules.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No atomic rules yet" description="Approve semantic rules, then run atomic maker." />
                </div>
              ) : (
                <StickyScrollX>
                  <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule Code</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic Parent</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Version</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Summary</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">JSON</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atomicRules.map((rule) => {
                        const parent = findParentSemanticRule(rule, semanticRules)
                        return (
                          <tr key={rule.id} className="border-b border-[#edf1f6] align-top last:border-0">
                            <td className="px-4 py-3 font-medium text-[#172033]">{getAtomicRuleCode(rule)}</td>
                            <td className="px-4 py-3 text-[#475467]">
                              {parent ? (
                                <Link
                                  className="font-medium text-[#175cd3] hover:underline"
                                  to={`/workflows/${encodeURIComponent(workflowId)}/semantic/${encodeURIComponent(parent.id)}`}
                                >
                                  {getSemanticRuleCode(parent)}
                                </Link>
                              ) : (
                                getAtomicRuleSemanticCode(rule)
                              )}
                            </td>
                            <td className="px-4 py-3 text-[#667085]">v{rule.atomicVersion ?? 0}</td>
                            <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
                            <td className="max-w-xs px-4 py-3 text-[#475467]">
                              <TextDetails text={getAtomicRuleSummary(rule) || '-'} />
                            </td>
                            <td className="px-4 py-3">
                              <JsonViewButton title={`${getAtomicRuleCode(rule)} JSON`} value={rule.llmOutputJson || rule.content} />
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

        {/* ===== Checker Tab ===== */}
        {activeTab === 'checker' ? (
          <div className="space-y-4 p-4">
            {/* Governance banner */}
            <CheckerGovernanceBanner run={atomicRunQuery.data} />

            <WorkflowStageJobs title="Atomic Checker Jobs" jobs={jobs} jobTypes={['ATOMIC_CHECKER']} />

            <Panel>
              <PanelHeader
                title="Checker Summary"
                actions={
                  <Button
                    onClick={() => startJobMutation.mutate('atomic-checker')}
                    disabled={startJobMutation.isPending || Boolean(activeJobId) || atomicRules.length === 0}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Run Atomic Checker
                  </Button>
                }
              />
              <div className="p-4">
                <CheckerSummary title="Latest Checker Run" run={atomicRunQuery.data} />
              </div>
            </Panel>

            {/* Per-rule findings - read-only */}
            <Panel>
              <PanelHeader
                title="Per-Rule Findings"
                description={`${atomicResults.length} rule${atomicResults.length !== 1 ? 's' : ''} checked`}
              />
              {atomicResults.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No checker findings yet" description="Run the atomic checker to see per-rule results." />
                </div>
              ) : (
                <StickyScrollX>
                  <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker Result</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Blocking</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Quality</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker Job</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Maker Job</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checked At</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atomicResults.map((result) => {
                        const atomicRule = atomicRules.find((r) => r.id === result.targetRuleId)
                        // Find the checker job to get its triggeredByJobId (maker lineage)
                        const checkerJob = jobs.find((j) => j.id === result.checkerJobId)
                        const makerJobId = checkerJob?.latestMakerJobId
                        return (
                          <tr key={result.id} className="border-b border-[#edf1f6] align-top last:border-0">
                            <td className="px-4 py-3 font-medium text-[#172033]">
                              {atomicRule ? getAtomicRuleCode(atomicRule) : result.targetRuleId}
                            </td>
                            <td className="px-4 py-3"><StatusPill value={result.llmIsPassing} /></td>
                            <td className="px-4 py-3 text-[#667085]">{result.calcBlockingCategory || '-'}</td>
                            <td className="px-4 py-3 text-[#667085]">{result.calcQualityScore || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-[#667085]">{result.checkerJobId}</span>
                            </td>
                            <td className="px-4 py-3">
                              {makerJobId ? (
                                <span className="font-mono text-xs text-[#175cd3]">{makerJobId}</span>
                              ) : (
                                <span className="text-xs text-[#98a2b3]">-</span>
                              )}
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
            <WorkflowStageJobs title="Review Jobs" jobs={jobs} jobTypes={['ATOMIC_REWRITE', 'EDIT']} />

            <Panel>
              <PanelHeader
                title="Atomic Rules Review"
                description={`${atomicRules.length} atomic rule${atomicRules.length !== 1 ? 's' : ''}`}
                actions={
                  <Button
                    variant="primary"
                    onClick={() => startJobMutation.mutate('atomic-maker')}
                    disabled={startJobMutation.isPending || Boolean(activeJobId) || !canRunAtomicMaker}
                    title={!canRunAtomicMaker ? 'Approve all semantic rules first' : undefined}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Re-run Atomic Maker
                  </Button>
                }
              />
              {atomicRules.length === 0 && !atomicRulesQuery.isLoading ? (
                <div className="p-4"><EmptyState title="No atomic rules yet" description="Approve semantic rules, then run atomic maker." /></div>
              ) : (
                <StickyScrollX>
                  <table className="w-full min-w-[1780px] border-collapse text-left text-sm">
                    <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic Parent</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Summary</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic JSON</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker JSON</th>
                        <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atomicRules.map((rule) => {
                        const result = atomicResultByRule.get(rule.id)
                        const parent = findParentSemanticRule(rule, semanticRules)
                        const isApproved = rule.status === 'APPROVED'
                        return (
                          <tr key={rule.id} className="border-b border-[#edf1f6] align-top last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#172033]">{getAtomicRuleCode(rule)}</p>
                              <p className="text-xs text-[#667085]">
                                v{rule.atomicVersion ?? 0}
                                {rule.llmSection ? ` - ${rule.llmSection}` : ''}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-[#475467]">
                              {parent ? (
                                <Link
                                  className="font-medium text-[#175cd3] hover:underline"
                                  to={`/workflows/${encodeURIComponent(workflowId)}/semantic/${encodeURIComponent(parent.id)}`}
                                >
                                  {getSemanticRuleCode(parent)}
                                </Link>
                              ) : (
                                getAtomicRuleSemanticCode(rule)
                              )}
                            </td>
                            <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
                            <td className="px-4 py-3"><StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} /></td>
                            <td className="max-w-xs px-4 py-3 text-[#475467]">
                              <TextDetails text={getAtomicRuleSummary(rule) || '-'} />
                            </td>
                            <td className="w-[100px] px-4 py-3">
                              <JsonViewButton title={`${getAtomicRuleCode(rule)} JSON`} value={rule.llmOutputJson || rule.content} />
                            </td>
                            <td className="w-[100px] px-4 py-3">
                              <JsonViewButton title={`${getAtomicRuleCode(rule)} Checker`} value={result?.llmReviewEntry || result?.llmFindings} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveAtomicMutation.mutate(rule.id)}
                                  disabled={approveAtomicMutation.isPending || isApproved}
                                  className={isApproved ? approvedButtonClass : undefined}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  {isApproved ? 'Approved' : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  title={!parent ? 'Semantic parent not found' : !result ? 'Run atomic checker first' : undefined}
                                  onClick={() => {
                                    if (!parent) return
                                    rewriteGroupMutation.mutate({
                                      semanticRuleId: parent.id,
                                      rewriteMode: 'CHECKER_FEEDBACK',
                                    })
                                  }}
                                  disabled={rewriteGroupMutation.isPending || Boolean(activeJobId) || !parent || !result}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                  Checker rewrite
                                </Button>
                                <Button
                                  size="sm"
                                  title={!parent ? 'Semantic parent not found' : undefined}
                                  onClick={() => setHumanRewriteRule(rule)}
                                  disabled={rewriteGroupMutation.isPending || Boolean(activeJobId) || !parent}
                                >
                                  <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                                  Human rewrite
                                </Button>
                                <Button size="sm" onClick={() => openEditDialog(rule)} disabled={editAtomicMutation.isPending}>
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
                </StickyScrollX>
              )}
            </Panel>
          </div>
        ) : null}

        {/* ===== Job History Tab ===== */}
        {activeTab === 'history' ? (
          <div className="space-y-4 p-4">
            <Panel>
              <PanelHeader
                title="All Atomic Jobs"
                description={`${jobs.filter((j) => atomicJobTypes.includes(j.jobType)).length} job${jobs.filter((j) => atomicJobTypes.includes(j.jobType)).length !== 1 ? 's' : ''} total`}
              />
              <JobHistoryTable jobs={jobs} jobTypes={atomicJobTypes} />
            </Panel>
          </div>
        ) : null}
      </Panel>

      {/* ===== Dialogs ===== */}
      {humanRewriteRule ? (
        <AtomicDialog
          title="Human Rewrite"
          description={getAtomicRuleCode(humanRewriteRule)}
          onClose={() => {
            setHumanRewriteRule(null)
            setHumanFeedback('')
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!humanRewriteParent) return
              rewriteGroupMutation.mutate({
                semanticRuleId: humanRewriteParent.id,
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
              <Button type="submit" variant="primary" disabled={rewriteGroupMutation.isPending || !humanFeedback.trim() || !humanRewriteParent}>
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Queue Rewrite
              </Button>
            </div>
          </form>
        </AtomicDialog>
      ) : null}

      {editRule ? (
        <AtomicDialog
          title="Edit Atomic Rule"
          description={getAtomicRuleCode(editRule)}
          onClose={() => {
            setEditRule(null)
            setEditText('')
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              editAtomicMutation.mutate()
            }}
          >
            <Label label="Atomic JSON">
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
              <Button type="submit" variant="primary" disabled={editAtomicMutation.isPending || !editText.trim()}>
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                Save Edit
              </Button>
            </div>
          </form>
        </AtomicDialog>
      ) : null}
    </div>
  )
}

// ==================== Helper Functions ====================

function findParentSemanticRule(rule: AtomicRule, semanticRules: SemanticRule[]) {
  if (rule.semanticRuleId) {
    const byId = semanticRules.find((semanticRule) => semanticRule.id === rule.semanticRuleId)
    if (byId) return byId
  }
  const semanticCode = getAtomicRuleSemanticCode(rule)
  return semanticRules.find((semanticRule) => getSemanticRuleCode(semanticRule) === semanticCode) || null
}

function getAtomicRuleSummary(rule: AtomicRule) {
  return rule.llmSummary
    || atomicJsonField(rule.llmOutputJson, 'summary')
    || atomicJsonField(rule.content, 'summary')
    || null
}

function atomicJsonField(value: string | null | undefined, fieldName: string) {
  const parsed = parseJsonText(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const fieldValue = (parsed as JsonRecord)[fieldName]
  return typeof fieldValue === 'string' && fieldValue.trim() ? fieldValue : null
}

function buildEditableAtomicRule(rule: AtomicRule) {
  const summary = getAtomicRuleSummary(rule) || ''
  return {
    atomic_rule_code: getAtomicRuleCode(rule),
    semantic_rule_code: getAtomicRuleSemanticCode(rule),
    source: {
      section: rule.llmSection || '',
    },
    ruleType: 'PRO',
    summary,
    logic: {},
  }
}

function AtomicDialog({
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
    <div className={cn('flex items-center gap-3 rounded-lg border p-4', bgColor)}>
      <ShieldCheck className={cn('h-6 w-6', textColor)} />
      <div>
        <p className={cn('text-sm font-semibold', textColor)}>
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
  const failureRate = typeof metrics?.atomic_failure_rate === 'number'
    ? metrics.atomic_failure_rate
    : typeof metrics?.failure_rate === 'number'
      ? metrics.failure_rate
      : null
  const totalChecks = typeof summary?.total_checks === 'number' ? summary.total_checks : null
  const passedChecks = typeof summary?.passed_checks === 'number' ? summary.passed_checks : null
  const failedChecks = typeof summary?.failed_checks === 'number' ? summary.failed_checks : null

  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <StatusPill value={run.calcGovernanceGate} />
      </div>

      {totalChecks != null ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded bg-[#f0f5ff] px-2 py-0.5 text-[#175cd3]">
            {totalChecks} checks
          </span>
          {passedChecks != null ? (
            <span className="rounded bg-[#ecfdf3] px-2 py-0.5 text-[#079455]">
              {passedChecks} passed
            </span>
          ) : null}
          {failedChecks != null ? (
            <span className="rounded bg-[#fef3f2] px-2 py-0.5 text-[#b42318]">
              {failedChecks} failed
            </span>
          ) : null}
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

function formatJobType(jobType?: string | null) {
  return (jobType || 'Job').replaceAll('_', ' ').toLowerCase()
}

function JobHistoryTable({ jobs, jobTypes }: { jobs: AsyncJob[]; jobTypes: string[] }) {
  const { workflowId = '' } = useParams()
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
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
            <tr>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">#</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job Type</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Job ID</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Triggered By</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Maker Job</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Created</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Error</th>
              <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {stageJobs.map((job, index) => {
              const isEdit = job.jobType === 'EDIT' || job.jobType === 'ATOMIC_REWRITE'
              return (
                <tr key={job.id} className={cn('border-b border-[#edf1f6] align-top last:border-0', isJobRunning(job.status) && 'bg-[#fafcff]')}>
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
                  <td className="px-4 py-3">
                    {job.latestMakerJobId ? (
                      <span className="font-mono text-xs text-[#175cd3]">{job.latestMakerJobId}</span>
                    ) : (
                      <span className="text-xs text-[#98a2b3]">-</span>
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
        <AtomicVersionCompareDrawer job={compareJob} workflowId={workflowId} onClose={() => setCompareJob(null)} />
      ) : null}
    </>
  )
}

function AtomicVersionCompareDrawer({ job, workflowId, onClose }: { job: AsyncJob; workflowId: string; onClose: () => void }) {
  const payload = parseJsonText(job.resultPayload) as Record<string, unknown> | null

  // For EDIT jobs: affectedRules[0] has atomicRuleCode, oldVersion, newVersion
  // For ATOMIC_REWRITE jobs: affectedRules[] has the same shape
  const affectedRules = (payload?.affectedRules as Array<Record<string, unknown>>) || []
  const firstRule = affectedRules[0]
  const ruleCode = (firstRule?.atomicRuleCode as string) || ''
  const oldVersion = firstRule?.oldVersion as number | undefined
  const newVersion = firstRule?.newVersion as number | undefined

  const compareQuery = useQuery({
    queryKey: ['atomic-compare', workflowId, ruleCode, oldVersion, newVersion],
    queryFn: () => atomicRulesApi.compareVersions(ruleCode, workflowId, oldVersion!, newVersion!),
    enabled: Boolean(ruleCode) && oldVersion != null && newVersion != null,
  })

  const compareData = compareQuery.data
  const oldJson = compareData?.version1?.llmOutputJson
  const newJson = compareData?.version2?.llmOutputJson

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
          {compareQuery.isLoading ? (
            <p className="text-sm text-[#667085]">Loading versions...</p>
          ) : compareQuery.error ? (
            <p className="text-sm text-[#b42318]">Failed to load comparison: {getErrorMessage(compareQuery.error)}</p>
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
    ATOMIC_MAKER: 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]',
    ATOMIC_CHECKER: 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]',
    ATOMIC_REWRITE: 'border-[#c4b5fd] bg-[#f5f3ff] text-[#6d28d9]',
    EDIT: 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e]',
  }
  const label = jobType.replaceAll('_', ' ')
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', colors[jobType] || 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]')}>
      {label}
    </span>
  )
}
