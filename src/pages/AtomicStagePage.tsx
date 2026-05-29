import { type ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Edit3, History, MessageSquareText, Play, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
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
  type JsonRecord,
  type SemanticRule,
} from '../api'
import { JobSummaryCard, WorkflowStageJobs } from '../components/WorkflowStageJobs'
import { WorkflowStagePipeline } from '../components/WorkflowStagePipeline'
import { Button, EmptyState, ErrorNotice, JsonViewButton, Label, PageTitle, Panel, PanelHeader, StatusPill, TextArea } from '../components/ui'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { latestJob } from '../workflowJobUtils'

type AtomicJobAction = 'atomic-maker' | 'atomic-checker'
type AtomicRewriteMode = 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'

const atomicJobTypes = ['ATOMIC_MAKER', 'ATOMIC_CHECKER', 'ATOMIC_REWRITE', 'EDIT']
const approvedButtonClass =
  'border-[#079455] bg-[#079455] text-white hover:bg-[#079455] disabled:cursor-default disabled:opacity-100'

export function AtomicStagePage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
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

  const jobQuery = usePolledJob(activeJobId)

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
  const jobs = jobsQuery.data || []
  const approvedSemanticCount = semanticRules.filter((rule) => rule.approvalStatus === 'APPROVED').length
  const canRunAtomicMaker = semanticRules.length > 0 && approvedSemanticCount === semanticRules.length
  const atomicResultByRule = new Map(atomicResults.map((result) => [result.targetRuleId, result]))
  const humanRewriteParent = humanRewriteRule ? findParentSemanticRule(humanRewriteRule, semanticRules) : null
  const firstError =
    workflowQuery.error || jobsQuery.error || semanticRulesQuery.error || atomicRulesQuery.error || atomicRunQuery.error || atomicResultsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Workflow Atomic Stage"
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

      <WorkflowStageJobs title="Atomic Job Status" jobs={jobs} jobTypes={atomicJobTypes} />

      <Panel>
        <PanelHeader
          title="Atomic Summaries"
          description="Atomic maker output and latest atomic checker result."
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => startJobMutation.mutate('atomic-maker')}
                disabled={startJobMutation.isPending || Boolean(activeJobId) || !canRunAtomicMaker}
                title={!canRunAtomicMaker ? 'Approve all semantic rules first' : undefined}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Run Atomic Maker
              </Button>
              <Button
                onClick={() => startJobMutation.mutate('atomic-checker')}
                disabled={startJobMutation.isPending || Boolean(activeJobId) || atomicRules.length === 0}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Run Atomic Checker
              </Button>
            </>
          }
        />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <JobSummaryCard title="Maker Summary" job={latestJob(jobs, 'ATOMIC_MAKER')} />
          <CheckerSummary title="Checker Summary" run={atomicRunQuery.data} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Atomic Rules" description={`${atomicRules.length} latest atomic rule${atomicRules.length === 1 ? '' : 's'}`} />
        {atomicRules.length === 0 && !atomicRulesQuery.isLoading ? (
          <div className="p-4"><EmptyState title="No atomic rules yet" description="Approve semantic rules, then run atomic maker." /></div>
        ) : (
          <div className="overflow-x-auto">
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
          </div>
        )}
      </Panel>

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
