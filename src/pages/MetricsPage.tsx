import { type FormEvent, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { getErrorMessage, metricsApi, type TokenCostParams } from '../api'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, TextInput } from '../components/ui'

export function MetricsPage() {
  // Token Usage state
  const [tokenParams, setTokenParams] = useState<TokenCostParams>({})
  const [submittedParams, setSubmittedParams] = useState<TokenCostParams | null>(null)

  const tokenQuery = useQuery({
    queryKey: ['metrics-token-cost', submittedParams],
    queryFn: () => metricsApi.tokenCost(submittedParams!),
    enabled: submittedParams !== null,
  })

  const tokenData = tokenQuery.data

  // Checker Pass Rate state
  const [checkerWorkflowId, setCheckerWorkflowId] = useState('')
  const [submittedCheckerWfId, setSubmittedCheckerWfId] = useState('')

  const checkerQuery = useQuery({
    queryKey: ['metrics-checker-pass-rate', submittedCheckerWfId],
    queryFn: () => metricsApi.checkerPassRate(submittedCheckerWfId),
    enabled: Boolean(submittedCheckerWfId),
  })

  const checkerData = checkerQuery.data

  function handleCheckerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedCheckerWfId(checkerWorkflowId.trim())
  }

  function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const p = { ...tokenParams }
    // Remove empty strings so undefined params are omitted from the request
    const cleaned: TokenCostParams = {}
    if (p.workflowId?.trim()) cleaned.workflowId = p.workflowId.trim()
    if (p.jobId?.trim()) cleaned.jobId = p.jobId.trim()
    if (p.from?.trim()) cleaned.from = p.from.trim()
    if (p.to?.trim()) cleaned.to = p.to.trim()
    setSubmittedParams(Object.keys(cleaned).length > 0 ? cleaned : null)
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Metrics"
        description="Token usage and checker pass rate dashboards for agent job runs."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Token Usage Panel */}
        <Panel>
          <PanelHeader title="Token Usage" description="Aggregated token consumption across LLM and tool calls." />
          <form onSubmit={handleTokenSubmit} className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Label label="Workflow ID">
                <TextInput
                  className="font-mono"
                  placeholder="e.g. WF-2026-0709-001"
                  value={tokenParams.workflowId || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, workflowId: e.target.value || undefined }))}
                />
              </Label>
              <Label label="Job ID">
                <TextInput
                  className="font-mono"
                  placeholder="UUID"
                  value={tokenParams.jobId || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, jobId: e.target.value || undefined }))}
                />
              </Label>
              <Label label="From">
                <TextInput
                  placeholder="YYYY-MM-DD"
                  value={tokenParams.from || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, from: e.target.value || undefined }))}
                />
              </Label>
              <Label label="To">
                <TextInput
                  placeholder="YYYY-MM-DD"
                  value={tokenParams.to || ''}
                  onChange={(e) => setTokenParams((p) => ({ ...p, to: e.target.value || undefined }))}
                />
              </Label>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={tokenQuery.isFetching}>
                <Search className="h-4 w-4" aria-hidden="true" />
                Search
              </Button>
            </div>
          </form>

          {!submittedParams ? (
            <div className="p-4 pt-0">
              <EmptyState title="Enter filters and click Search" description="At least one filter is required." />
            </div>
          ) : tokenQuery.isError ? (
            <div className="p-4 pt-0">
              <ErrorNotice message={getErrorMessage(tokenQuery.error)} />
            </div>
          ) : tokenData ? (
            <div className="grid grid-cols-2 gap-3 p-4 pt-0">
              <MetricCard label="Total Tokens" value={formatLargeNumber(
                tokenData.metrics.llmPromptTokens + tokenData.metrics.llmCompletionTokens +
                tokenData.metrics.toolPromptTokens + tokenData.metrics.toolCompletionTokens
              )} />
              <MetricCard label="LLM Tokens" value={formatLargeNumber(
                tokenData.metrics.llmPromptTokens + tokenData.metrics.llmCompletionTokens
              )} />
              <MetricCard label="Tool Tokens" value={formatLargeNumber(
                tokenData.metrics.toolPromptTokens + tokenData.metrics.toolCompletionTokens
              )} />
              <MetricCard
                label="Prompt / Completion"
                value={`${formatLargeNumber(tokenData.metrics.llmPromptTokens)} / ${formatLargeNumber(tokenData.metrics.llmCompletionTokens)}`}
                small
              />
              <MetricCard
                label="LLM / Tool Calls"
                value={`${tokenData.metrics.llmCallCount} / ${tokenData.metrics.toolCallCount}`}
                small
              />
            </div>
          ) : null}
        </Panel>

        {/* Checker Pass Rate Panel */}
        <Panel>
          <PanelHeader title="Checker Pass Rate" description="Rule checker validation results by workflow." />
          <form onSubmit={handleCheckerSubmit} className="space-y-3 p-4">
            <Label label="Workflow ID">
              <TextInput
                className="font-mono"
                placeholder="e.g. WF-2026-0709-001"
                value={checkerWorkflowId}
                onChange={(e) => setCheckerWorkflowId(e.target.value)}
              />
            </Label>
            <Button type="submit" variant="primary" disabled={!checkerWorkflowId.trim() || checkerQuery.isFetching}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </form>

          {!submittedCheckerWfId ? (
            <div className="p-4 pt-0">
              <EmptyState title="Enter a workflow ID and click Search" />
            </div>
          ) : checkerQuery.isError ? (
            <div className="p-4 pt-0">
              <ErrorNotice message={getErrorMessage(checkerQuery.error)} />
            </div>
          ) : checkerData ? (
            <div className="grid grid-cols-1 gap-3 p-4 pt-0">
              <PassRateCard rate={checkerData.passRate} />
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Total Rules" value={checkerData.totalRulesExtracted} />
                <MetricCard label="Rules Passed" value={checkerData.rulesPassedCheck} />
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  small,
}: {
  label: string
  value: string | number
  small?: boolean
}) {
  return (
    <div className="rounded-md border border-[#e3e8f0] bg-[#f8fafc] px-4 py-3 text-center">
      <div className={small ? 'text-base font-semibold text-[#172033]' : 'text-2xl font-bold text-[#172033]'}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[#667085]">{label}</div>
    </div>
  )
}

function PassRateCard({ rate }: { rate: number }) {
  const colorClass =
    rate >= 90 ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
    : rate >= 70 ? 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]'
    : 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'

  return (
    <div className={`rounded-md border px-4 py-6 text-center ${colorClass}`}>
      <div className="text-3xl font-bold">{rate.toFixed(1)}%</div>
      <div className="mt-1 text-xs opacity-70">Pass Rate</div>
    </div>
  )
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `${parseFloat((value / 1_000_000).toFixed(1))}M`
  if (value >= 1_000) return `${parseFloat((value / 1_000).toFixed(1))}K`
  return String(value)
}
