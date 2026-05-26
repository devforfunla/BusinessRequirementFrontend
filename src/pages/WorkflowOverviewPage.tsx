import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CheckSquare, FileJson, History, Play, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  atomicCheckerApi,
  atomicMakerApi,
  atomicRulesApi,
  getErrorMessage,
  semanticCheckerApi,
  semanticRulesApi,
  workflowsApi,
} from '../api'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, JsonBlock, PageTitle, Panel, PanelHeader, StatusPill } from '../components/ui'

type JobAction = 'semantic-checker' | 'atomic-maker' | 'atomic-checker'

export function WorkflowOverviewPage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeJobLabel, setActiveJobLabel] = useState<string | null>(null)

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
      toast.success(`${activeJobLabel || 'Job'} completed`)
      window.setTimeout(() => {
        setActiveJobId(null)
        setActiveJobLabel(null)
      }, 0)
      void queryClient.invalidateQueries()
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || `${activeJobLabel || 'Job'} failed`)
      window.setTimeout(() => {
        setActiveJobId(null)
        setActiveJobLabel(null)
      }, 0)
    }
  }, [activeJobLabel, jobQuery.data, queryClient])

  const startJobMutation = useMutation({
    mutationFn: async (action: JobAction) => {
      if (action === 'semantic-checker') return semanticCheckerApi.run(workflowId)
      if (action === 'atomic-maker') return atomicMakerApi.extractAtomic(workflowId, reviewerId || 'reviewer-poc')
      return atomicCheckerApi.run(workflowId)
    },
    onSuccess: (response, action) => {
      setActiveJobId(response.jobId)
      setActiveJobLabel(action)
      toast.success('Job queued')
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
  const semanticResults = semanticResultsQuery.data || []
  const atomicResults = atomicResultsQuery.data || []
  const approvedSemanticCount = semanticRules.filter((rule) => rule.approvalStatus === 'APPROVED').length
  const canRunAtomicMaker = semanticRules.length > 0 && approvedSemanticCount === semanticRules.length

  const semanticResultByRule = new Map(semanticResults.map((result) => [result.targetSemanticRuleId, result]))
  const atomicResultByRule = new Map(atomicResults.map((result) => [result.targetRuleId, result]))

  const firstError =
    workflowQuery.error ||
    semanticRulesQuery.error ||
    atomicRulesQuery.error ||
    semanticRunQuery.error ||
    atomicRunQuery.error ||
    semanticResultsQuery.error ||
    atomicResultsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Workflow Review"
        description={workflowId}
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#c8d0dc] bg-white px-3 text-sm font-medium text-[#172033] hover:bg-[#eef2f7]"
              to={`/workflows/${encodeURIComponent(workflowId)}/approval`}
            >
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              Approval
            </Link>
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

      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard title="Workflow" value={workflowQuery.data?.status || 'LOADING'} />
        <MetricCard title="Semantic Rules" value={`${approvedSemanticCount}/${semanticRules.length} approved`} />
        <MetricCard title="Atomic Rules" value={`${atomicRules.length} latest`} />
        <MetricCard title="Active Job" value={activeJobId ? jobQuery.data?.status || 'QUEUED' : 'none'} />
      </div>

      <Panel>
        <PanelHeader
          title="Phase Controls"
          description="Semantic rules must be reviewed and approved before atomic rule generation."
          actions={
            <>
              <Button
                onClick={() => startJobMutation.mutate('semantic-checker')}
                disabled={startJobMutation.isPending || Boolean(activeJobId) || semanticRules.length === 0}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Run Semantic Checker
              </Button>
              <Button
                onClick={() => approveAllMutation.mutate()}
                disabled={approveAllMutation.isPending || semanticRules.length === 0}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve Semantic
              </Button>
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
          <CheckerSummary title="Semantic Checker" run={semanticRunQuery.data} />
          <CheckerSummary title="Atomic Checker" run={atomicRunQuery.data} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Semantic Rules" description="Review semantic-only rules before atomic extraction." />
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
                          {rule.semanticRuleCode}
                        </Link>
                        <p className="text-xs text-[#667085]">v{rule.semanticVersion ?? 0} {rule.changeType || ''}</p>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={rule.approvalStatus} /></td>
                      <td className="px-4 py-3"><StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} /></td>
                      <td className="max-w-xl px-4 py-3 text-[#475467]">
                        <p className="line-clamp-2">{rule.summary || rule.businessIntent || '-'}</p>
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

      <Panel>
        <PanelHeader title="Atomic Rules" description="Generated only after semantic approval." />
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
                        <p className="font-medium text-[#172033]">{rule.atomicRuleCode}</p>
                        <p className="text-xs text-[#667085]">v{rule.atomicVersion ?? 0} {rule.changeType || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{rule.semanticRuleCode || '-'}</td>
                      <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
                      <td className="px-4 py-3"><StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => atomicStatusMutation.mutate({ atomicRuleId: rule.id, action: 'approve' })}>
                            Approve
                          </Button>
                          <Button size="sm" onClick={() => atomicStatusMutation.mutate({ atomicRuleId: rule.id, action: 'reopen' })}>
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-medium uppercase text-[#667085]">{title}</p>
      <p className="mt-2 truncate text-lg font-semibold text-[#172033]">{value}</p>
    </Panel>
  )
}

function CheckerSummary({ title, run }: { title: string; run?: Awaited<ReturnType<typeof semanticCheckerApi.latestRun>> }) {
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
      <div className="mt-3 flex items-center gap-2 text-xs text-[#667085]">
        <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{run.model || 'model unknown'} - {formatDate(run.checkedAt)}</span>
      </div>
      {run.calcSummaryJson ? <JsonBlock className="mt-3 max-h-44" value={run.calcSummaryJson} /> : null}
    </div>
  )
}
