import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { atomicCheckerApi, atomicRulesApi, getErrorMessage } from '../api'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, JsonBlock, PageTitle, Panel, PanelHeader, StatusPill } from '../components/ui'

export function ApprovalPage() {
  const { workflowId = '' } = useParams()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const queryClient = useQueryClient()

  const atomicRulesQuery = useQuery({
    queryKey: ['atomic-rules', workflowId],
    queryFn: () => atomicRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const atomicResultsQuery = useQuery({
    queryKey: ['atomic-checker-results', workflowId],
    queryFn: () => atomicCheckerApi.latestResults(workflowId),
    enabled: Boolean(workflowId),
  })

  const statusMutation = useMutation({
    mutationFn: ({ atomicRuleId, action }: { atomicRuleId: string; action: 'approve' | 'reopen' }) =>
      action === 'approve'
        ? atomicRulesApi.approve(atomicRuleId, reviewerId || 'reviewer-poc')
        : atomicRulesApi.reopen(atomicRuleId, reviewerId || 'reviewer-poc'),
    onSuccess: () => {
      toast.success('Approval status updated')
      void queryClient.invalidateQueries({ queryKey: ['atomic-rules', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const atomicRules = atomicRulesQuery.data || []
  const checkerByRule = new Map((atomicResultsQuery.data || []).map((result) => [result.targetRuleId, result]))
  const firstError = atomicRulesQuery.error || atomicResultsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Atomic Approval"
        description={workflowId}
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#c8d0dc] bg-white px-3 text-sm font-medium text-[#172033] hover:bg-[#eef2f7]"
              to={`/workflows/${encodeURIComponent(workflowId)}/atomic`}
            >
              Back to Atomic Stage
            </Link>
            <Button onClick={() => void queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      <Panel>
        <PanelHeader title="Latest Atomic Rules" description={`${atomicRules.length} rule${atomicRules.length === 1 ? '' : 's'}`} />
        {atomicRules.length === 0 && !atomicRulesQuery.isLoading ? (
          <div className="p-4"><EmptyState title="No atomic rules" description="Run atomic maker from the workflow page." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Semantic Parent</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {atomicRules.map((rule) => {
                  const checker = checkerByRule.get(rule.id)
                  return (
                    <tr key={rule.id} className="border-b border-[#edf1f6] align-top last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#172033]">{rule.atomicRuleCode}</p>
                        <p className="text-xs text-[#667085]">v{rule.atomicVersion ?? 0}</p>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{rule.semanticRuleCode || '-'}</td>
                      <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <StatusPill value={checker?.llmIsPassing || 'NOT_CHECKED'} />
                          {checker?.llmFindings ? <JsonBlock className="max-h-32 w-80" value={checker.llmFindings} /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{formatDate(rule.updatedAt || rule.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => statusMutation.mutate({ atomicRuleId: rule.id, action: 'approve' })}>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Approve
                          </Button>
                          <Button size="sm" onClick={() => statusMutation.mutate({ atomicRuleId: rule.id, action: 'reopen' })}>
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
