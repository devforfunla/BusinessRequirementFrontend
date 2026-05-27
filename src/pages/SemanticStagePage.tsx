import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, History, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  getErrorMessage,
  getSemanticRuleBusinessIntent,
  getSemanticRuleCode,
  getSemanticRuleSummary,
  isJobRunning,
  jobsApi,
  semanticCheckerApi,
  semanticRulesApi,
  workflowsApi,
  type AsyncJob,
  type CheckerRun,
} from '../api'
import { JobSummaryCard, WorkflowStageJobs } from '../components/WorkflowStageJobs'
import { WorkflowStagePipeline } from '../components/WorkflowStagePipeline'
import { Button, EmptyState, ErrorNotice, JsonBlock, PageTitle, Panel, PanelHeader, StatusPill } from '../components/ui'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { latestJob } from '../workflowJobUtils'

type SemanticJobAction = 'semantic-checker'

const semanticJobTypes = ['SEMANTIC_MAKER', 'SEMANTIC_CHECKER']

export function SemanticStagePage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

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

  useEffect(() => {
    const job = jobQuery.data
    if (!job) return
    if (job.status === 'SUCCEEDED') {
      toast.success('Semantic checker completed')
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries()
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || 'Semantic checker failed')
      window.setTimeout(() => setActiveJobId(null), 0)
    }
  }, [jobQuery.data, queryClient])

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
    onSuccess: () => {
      toast.success('Semantic rule approved')
      void queryClient.invalidateQueries({ queryKey: ['semantic-rules', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rejectSemanticMutation = useMutation({
    mutationFn: ({ semanticRuleId, reason }: { semanticRuleId: string; reason?: string }) =>
      semanticRulesApi.reject(semanticRuleId, reviewerId || 'reviewer-poc', reason),
    onSuccess: () => {
      toast.success('Semantic rule rejected')
      void queryClient.invalidateQueries({ queryKey: ['semantic-rules', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const approveAllMutation = useMutation({
    mutationFn: () => semanticRulesApi.approveAll(workflowId, reviewerId || 'reviewer-poc'),
    onSuccess: () => {
      toast.success('Semantic rules approved')
      void queryClient.invalidateQueries({ queryKey: ['semantic-rules', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const semanticRules = semanticRulesQuery.data || []
  const semanticResults = semanticResultsQuery.data || []
  const jobs = jobsQuery.data || []
  const approvedSemanticCount = semanticRules.filter((rule) => rule.approvalStatus === 'APPROVED').length
  const semanticResultByRule = new Map(semanticResults.map((result) => [result.targetSemanticRuleId, result]))
  const firstError = workflowQuery.error || jobsQuery.error || semanticRulesQuery.error || semanticRunQuery.error || semanticResultsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Workflow Semantic Stage"
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

      <WorkflowStageJobs title="Semantic Job Status" jobs={jobs} jobTypes={semanticJobTypes} />

      <Panel>
        <PanelHeader
          title="Semantic Summaries"
          description="Semantic maker output and latest semantic checker result."
          actions={
            <>
              <Button
                onClick={() => startJobMutation.mutate('semantic-checker')}
                disabled={startJobMutation.isPending || Boolean(activeJobId) || semanticRules.length === 0}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Run Semantic Checker
              </Button>
            </>
          }
        />
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <JobSummaryCard title="Maker Summary" job={latestJob(jobs, 'SEMANTIC_MAKER')} />
          <CheckerSummary title="Checker Summary" run={semanticRunQuery.data} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Semantic Rules"
          description={`${approvedSemanticCount}/${semanticRules.length} approved`}
          actions={
            <Button onClick={() => approveAllMutation.mutate()} disabled={approveAllMutation.isPending || semanticRules.length === 0}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Approve All
            </Button>
          }
        />
        {semanticRules.length === 0 && !semanticRulesQuery.isLoading ? (
          <div className="p-4"><EmptyState title="No semantic rules yet" description="Run semantic maker from the workflows page." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Approval</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Summary</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {semanticRules.map((rule) => {
                  const result = semanticResultByRule.get(rule.id)
                  return (
                    <tr key={rule.id} className="border-b border-[#edf1f6] last:border-0">
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
                      <td className="px-4 py-3"><StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} /></td>
                      <td className="max-w-xl px-4 py-3 text-[#475467]">
                        <p className="line-clamp-2">{getSemanticRuleSummary(rule) || getSemanticRuleBusinessIntent(rule) || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => approveSemanticMutation.mutate(rule.id)} disabled={approveSemanticMutation.isPending}>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button
                            size="icon"
                            variant="danger"
                            title="Reject semantic rule"
                            onClick={() => {
                              const reason = window.prompt('Reject reason')
                              rejectSemanticMutation.mutate({ semanticRuleId: rule.id, reason: reason || undefined })
                            }}
                            disabled={rejectSemanticMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
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
  return (
    <div className="rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <StatusPill value={run.calcGovernanceGate} />
      </div>
      <p className="mt-2 text-sm text-[#475467]">{run.llmHighLevelFeedback || 'No feedback text.'}</p>
      <p className="mt-3 text-xs text-[#667085]">{run.model || 'model unknown'} - {formatDate(run.checkedAt)}</p>
      {run.calcSummaryJson ? <JsonBlock className="mt-3 max-h-44" value={run.calcSummaryJson} /> : null}
    </div>
  )
}
