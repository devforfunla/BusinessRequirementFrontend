import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, History, Play, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  atomicCheckerApi,
  atomicMakerApi,
  atomicRulesApi,
  getErrorMessage,
  getAtomicRuleCode,
  getAtomicRuleSemanticCode,
  isJobRunning,
  jobsApi,
  semanticRulesApi,
  workflowsApi,
  type AsyncJob,
  type CheckerRun,
} from '../api'
import { JobSummaryCard, WorkflowStageJobs } from '../components/WorkflowStageJobs'
import { WorkflowStagePipeline } from '../components/WorkflowStagePipeline'
import { Button, EmptyState, ErrorNotice, JsonViewButton, PageTitle, Panel, PanelHeader, StatusPill } from '../components/ui'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { latestJob } from '../workflowJobUtils'

type AtomicJobAction = 'atomic-maker' | 'atomic-checker'

const atomicJobTypes = ['ATOMIC_MAKER', 'ATOMIC_CHECKER', 'ATOMIC_REWRITE', 'EDIT']

export function AtomicStagePage() {
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

  const atomicRulesQuery = useQuery({
    queryKey: ['atomic-rules', workflowId],
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

  const atomicStatusMutation = useMutation({
    mutationFn: ({ atomicRuleId, action }: { atomicRuleId: string; action: 'approve' | 'reopen' }) =>
      action === 'approve'
        ? atomicRulesApi.approve(atomicRuleId, reviewerId || 'reviewer-poc')
        : atomicRulesApi.reopen(atomicRuleId, reviewerId || 'reviewer-poc'),
    onSuccess: () => {
      toast.success('Atomic rule updated')
      void queryClient.invalidateQueries({ queryKey: ['atomic-rules', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const semanticRules = semanticRulesQuery.data || []
  const atomicRules = atomicRulesQuery.data || []
  const atomicResults = atomicResultsQuery.data || []
  const jobs = jobsQuery.data || []
  const approvedSemanticCount = semanticRules.filter((rule) => rule.approvalStatus === 'APPROVED').length
  const canRunAtomicMaker = semanticRules.length > 0 && approvedSemanticCount === semanticRules.length
  const atomicResultByRule = new Map(atomicResults.map((result) => [result.targetRuleId, result]))
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
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Atomic Rule</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic Parent</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {atomicRules.map((rule) => {
                  const result = atomicResultByRule.get(rule.id)
                  return (
                    <tr key={rule.id} className="border-b border-[#edf1f6] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#172033]">{getAtomicRuleCode(rule)}</p>
                        <p className="text-xs text-[#667085]">v{rule.atomicVersion ?? 0}</p>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{getAtomicRuleSemanticCode(rule)}</td>
                      <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
                      <td className="px-4 py-3"><StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => atomicStatusMutation.mutate({ atomicRuleId: rule.id, action: 'approve' })}>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button size="sm" onClick={() => atomicStatusMutation.mutate({ atomicRuleId: rule.id, action: 'reopen' })}>
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Reopen
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
      {run.calcSummaryJson ? <JsonViewButton title="Checker JSON" value={run.calcSummaryJson} label="View JSON" /> : null}
    </div>
  )
}

function formatJobType(jobType?: string | null) {
  return (jobType || 'Job').replaceAll('_', ' ').toLowerCase()
}
