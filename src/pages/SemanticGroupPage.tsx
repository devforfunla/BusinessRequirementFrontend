import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  atomicCheckerApi,
  atomicRulesApi,
  getErrorMessage,
  parseJsonText,
  rewriteApi,
  semanticCheckerApi,
  semanticRulesApi,
  type JsonRecord,
} from '../api'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, JsonBlock, Label, PageTitle, Panel, PanelHeader, Select, StatusPill, TextArea } from '../components/ui'

export function SemanticGroupPage() {
  const { workflowId = '', semanticRuleId = '' } = useParams()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const [rewriteMode, setRewriteMode] = useState<'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK'>('CHECKER_FEEDBACK')
  const [humanFeedback, setHumanFeedback] = useState('')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [selectedAtomicRuleId, setSelectedAtomicRuleId] = useState('')
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (workflowId) setWorkflowId(workflowId)
  }, [setWorkflowId, workflowId])

  const semanticRuleQuery = useQuery({
    queryKey: ['semantic-rule', semanticRuleId],
    queryFn: () => semanticRulesApi.get(semanticRuleId),
    enabled: Boolean(semanticRuleId),
  })

  const semanticResultQuery = useQuery({
    queryKey: ['semantic-checker-result', semanticRuleId],
    queryFn: () => semanticCheckerApi.latestResultByRule(semanticRuleId),
    enabled: Boolean(semanticRuleId),
  })

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

  const jobQuery = usePolledJob(activeJobId)

  useEffect(() => {
    const job = jobQuery.data
    if (!job) return
    if (job.status === 'SUCCEEDED') {
      toast.success('Rewrite completed')
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries()
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || 'Rewrite failed')
      window.setTimeout(() => setActiveJobId(null), 0)
    }
  }, [jobQuery.data, queryClient])

  const semanticRule = semanticRuleQuery.data
  const atomicRules = atomicRulesQuery.data || []
  const semanticRuleCode = semanticRule?.semanticRuleCode
  const childAtomicRules = atomicRules.filter((rule) => !semanticRuleCode || rule.semanticRuleCode === semanticRuleCode)
  const atomicResultByRule = new Map((atomicResultsQuery.data || []).map((result) => [result.targetRuleId, result]))
  const selectedAtomicRule = childAtomicRules.find((rule) => rule.id === selectedAtomicRuleId) || null

  const loadAtomicRuleForEdit = (rule: { id: string; content?: string | null }) => {
    setSelectedAtomicRuleId(rule.id)
    const parsed = parseJsonText(rule.content)
    setEditText(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2))
  }

  const rewriteMutation = useMutation({
    mutationFn: () =>
      rewriteApi.group({
        semanticRuleId,
        workflowId,
        rewriteMode,
        humanFeedback: rewriteMode === 'HUMAN_FEEDBACK' ? humanFeedback : undefined,
      }),
    onSuccess: (response) => {
      toast.success('Rewrite job queued')
      setActiveJobId(response.jobId)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const editMutation = useMutation({
    mutationFn: () => {
      if (!selectedAtomicRule) throw new Error('Select an atomic rule first.')
      const parsed = JSON.parse(editText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Edited content must be a JSON object.')
      }
      return atomicRulesApi.editByHuman(selectedAtomicRule.id, parsed as JsonRecord, reviewerId || 'reviewer-poc')
    },
    onSuccess: () => {
      toast.success('Human edit saved')
      void queryClient.invalidateQueries({ queryKey: ['atomic-rules', workflowId] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const firstError = semanticRuleQuery.error || semanticResultQuery.error || atomicRulesQuery.error || atomicResultsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Semantic Rule Group"
        description={semanticRule?.semanticRuleCode || semanticRuleId}
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#c8d0dc] bg-white px-3 text-sm font-medium text-[#172033] hover:bg-[#eef2f7]"
              to={`/workflows/${encodeURIComponent(workflowId)}`}
            >
              Back to Workflow
            </Link>
            <Button onClick={() => void queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Panel>
          <PanelHeader title="Semantic Rule" actions={<StatusPill value={semanticRule?.approvalStatus || 'LOADING'} />} />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-[#667085]">Business Intent</p>
              <p className="mt-2 text-sm text-[#344054]">{semanticRule?.businessIntent || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#667085]">Summary</p>
              <p className="mt-2 text-sm text-[#344054]">{semanticRule?.summary || '-'}</p>
            </div>
            <div className="lg:col-span-2">
              <p className="text-xs font-semibold uppercase text-[#667085]">Latest Semantic Checker Result</p>
              <div className="mt-2 rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill value={semanticResultQuery.data?.llmIsPassing || 'NOT_CHECKED'} />
                  <span className="text-xs text-[#667085]">{formatDate(semanticResultQuery.data?.checkedAt)}</span>
                </div>
                {semanticResultQuery.data?.llmFindings ? <JsonBlock className="mt-3 max-h-52" value={semanticResultQuery.data.llmFindings} /> : null}
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Rewrite Group" description="Rewrite the atomic group under this semantic rule." />
          <div className="space-y-4 p-4">
            <Label label="Rewrite Mode">
              <Select value={rewriteMode} onChange={(event) => setRewriteMode(event.target.value as 'CHECKER_FEEDBACK' | 'HUMAN_FEEDBACK')}>
                <option value="CHECKER_FEEDBACK">Checker feedback</option>
                <option value="HUMAN_FEEDBACK">Human feedback</option>
              </Select>
            </Label>
            <Label label="Human Feedback">
              <TextArea value={humanFeedback} onChange={(event) => setHumanFeedback(event.target.value)} disabled={rewriteMode !== 'HUMAN_FEEDBACK'} />
            </Label>
            <Button
              variant="primary"
              onClick={() => rewriteMutation.mutate()}
              disabled={rewriteMutation.isPending || Boolean(activeJobId) || !semanticRuleId}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rewrite Atomic Group
            </Button>
            {activeJobId ? (
              <p className="text-sm text-[#475467]">
                Job <span className="font-mono text-xs">{activeJobId}</span> <StatusPill value={jobQuery.data?.status || 'QUEUED'} />
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Child Atomic Rules" description={`${childAtomicRules.length} latest atomic rule${childAtomicRules.length === 1 ? '' : 's'}`} />
        {childAtomicRules.length === 0 && !atomicRulesQuery.isLoading ? (
          <div className="p-4"><EmptyState title="No child atomic rules" description="Run atomic maker after semantic approval." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Rule</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Checker</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {childAtomicRules.map((rule) => {
                  const result = atomicResultByRule.get(rule.id)
                  return (
                    <tr key={rule.id} className="border-b border-[#edf1f6] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#172033]">{rule.atomicRuleCode}</p>
                        <p className="text-xs text-[#667085]">v{rule.atomicVersion ?? 0}</p>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={rule.status} /></td>
                      <td className="px-4 py-3"><StatusPill value={result?.llmIsPassing || 'NOT_CHECKED'} /></td>
                      <td className="px-4 py-3 text-[#475467]">{formatDate(rule.updatedAt || rule.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" onClick={() => loadAtomicRuleForEdit(rule)}>
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit JSON
                        </Button>
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
        <PanelHeader
          title="Human Edit"
          description={selectedAtomicRule ? selectedAtomicRule.atomicRuleCode : 'Select an atomic rule to edit'}
          actions={
            <Button variant="primary" onClick={() => editMutation.mutate()} disabled={!selectedAtomicRule || editMutation.isPending}>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Edit
            </Button>
          }
        />
        <div className="grid gap-4 p-4 lg:grid-cols-[280px_1fr]">
          <Label label="Atomic Rule">
            <Select
              value={selectedAtomicRule?.id || ''}
              onChange={(event) => {
                const rule = childAtomicRules.find((candidate) => candidate.id === event.target.value)
                if (rule) loadAtomicRuleForEdit(rule)
              }}
            >
              <option value="">Select a rule</option>
              {childAtomicRules.map((rule) => (
                <option key={rule.id} value={rule.id}>{rule.atomicRuleCode}</option>
              ))}
            </Select>
          </Label>
          <TextArea className="min-h-[360px] font-mono text-xs" value={editText} onChange={(event) => setEditText(event.target.value)} />
        </div>
      </Panel>
    </div>
  )
}
