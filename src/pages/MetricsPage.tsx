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

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `${parseFloat((value / 1_000_000).toFixed(1))}M`
  if (value >= 1_000) return `${parseFloat((value / 1_000).toFixed(1))}K`
  return String(value)
}
