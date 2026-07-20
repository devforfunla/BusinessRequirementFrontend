import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, GitBranch, RefreshCw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { getErrorMessage, traceLogsApi, type JobTraceResponse, type JobTraceSummary, type LlmCallTrace } from '../api'
import { Button, EmptyState, ErrorNotice, JsonBlock, Label, PageTitle, Panel, PanelHeader, SourcesList, StatusPill, TextInput } from '../components/ui'
import { cn, formatDate } from '../utils'

export function TraceLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialWorkflowId = searchParams.get('workflowId') || ''
  const [workflowId, setWorkflowId] = useState(initialWorkflowId)
  const [submittedWorkflowId, setSubmittedWorkflowId] = useState(initialWorkflowId)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const workflowTraceQuery = useQuery({
    queryKey: ['trace-workflow', submittedWorkflowId],
    queryFn: () => traceLogsApi.getByWorkflowId(submittedWorkflowId),
    enabled: Boolean(submittedWorkflowId),
  })

  const workflowTrace = workflowTraceQuery.data

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextId = workflowId.trim()
    setSubmittedWorkflowId(nextId)
    setExpandedJobId(null)
    setSearchParams(nextId ? { workflowId: nextId } : {})
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Trace Logs"
        description="View all jobs and agent sessions for a workflow."
        actions={
          <Button
            onClick={() => void workflowTraceQuery.refetch()}
            disabled={!submittedWorkflowId || workflowTraceQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel>
        <PanelHeader
          title="Workflow Search"
          description="Enter a workflow ID to view its trace."
        />
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-end"
        >
          <Label label="Workflow ID">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#98a2b3]"
                aria-hidden="true"
              />
              <TextInput
                className="pl-9 font-mono"
                value={workflowId}
                onChange={(event) => setWorkflowId(event.target.value)}
              />
            </div>
          </Label>
          <Button type="submit" variant="primary" disabled={!workflowId.trim()}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </Panel>

      {!submittedWorkflowId ? (
        <EmptyState title="No workflow selected" description="Enter a workflow ID to load its trace." />
      ) : null}

      {submittedWorkflowId && workflowTraceQuery.isLoading ? (
        <EmptyState title="Loading workflow trace..." />
      ) : null}

      {workflowTraceQuery.isError ? (
        <ErrorNotice message={getErrorMessage(workflowTraceQuery.error)} />
      ) : null}

      {workflowTrace ? (
        <>
          <Panel>
            <PanelHeader
              title="Workflow"
              description={workflowTrace.workflow.id}
              actions={<StatusPill value={workflowTrace.workflow.status} />}
            />
            <div className="grid gap-4 p-4 lg:grid-cols-4">
              <TraceField
                label="Workflow ID"
                value={workflowTrace.workflow.id}
                mono
                icon={<GitBranch className="h-4 w-4" />}
              />
              <TraceField label="Document" value={workflowTrace.workflow.documentId} mono />
              <TraceField label="Triggered By" value={workflowTrace.workflow.triggeredBy || '-'} />
              <TraceField label="Created" value={formatDate(workflowTrace.workflow.createdAt)} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Jobs"
              description={`${workflowTrace.aggregate.totalJobs} job${workflowTrace.aggregate.totalJobs === 1 ? '' : 's'}`}
            />
            <div className="flex flex-wrap items-center gap-3 border-b border-[#e3e8f0] px-4 py-2">
              <span className="text-sm text-[#667085]">
                {workflowTrace.aggregate.totalJobs} total
              </span>
              {workflowTrace.aggregate.failedJobs > 0 ? (
                <span className="rounded border border-[#f7b4ae] bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#b42318]">
                  {workflowTrace.aggregate.failedJobs} failed
                </span>
              ) : null}
              {workflowTrace.aggregate.hasUnknownTerms ? (
                <span className="inline-flex items-center gap-1 rounded border border-[#f7b4ae] bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#b42318]">
                  <AlertTriangle className="h-3 w-3" />
                  Knowledge Gaps
                </span>
              ) : null}
            </div>

            {workflowTrace.jobs.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No jobs found for this workflow" />
              </div>
            ) : (
              <div className="divide-y divide-[#e3e8f0]">
                {workflowTrace.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    isExpanded={expandedJobId === job.id}
                    onToggle={() =>
                      setExpandedJobId(expandedJobId === job.id ? null : job.id)
                    }
                  />
                ))}
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function JobRow({
  job,
  isExpanded,
  onToggle,
}: {
  job: JobTraceSummary
  isExpanded: boolean
  onToggle: () => void
}) {
  const jobTraceQuery = useQuery({
    queryKey: ['trace-log', job.id],
    queryFn: () => traceLogsApi.getByJobId(job.id),
    enabled: isExpanded,
  })

  const isFailed = job.status === 'FAILED' || job.status === 'FAILED_UNKNOWN_TERMS'
  const hasUnknownTerms = job.status === 'FAILED_UNKNOWN_TERMS'

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn('flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f8fafc]', isFailed && 'border-l-2 border-l-[#f7b4ae]')}
      >
        <span className="min-w-[140px] font-medium text-[#172033]">{job.jobType}</span>
        <StatusPill value={job.status} />
        <span className="text-xs text-[#98a2b3]">{formatDate(job.createdAt)}</span>
        {hasUnknownTerms ? (
          <AlertTriangle className="h-3.5 w-3.5 text-[#b42318]" />
        ) : null}
        {job.errorMessage ? (
          <span className="truncate text-xs text-[#667085]">{job.errorMessage}</span>
        ) : null}
      </button>

      {isExpanded ? (
        <div className="border-t border-[#e3e8f0] bg-[#f8fafc] p-4">
          {jobTraceQuery.isLoading ? (
            <p className="py-4 text-center text-sm text-[#667085]">Loading job trace...</p>
          ) : jobTraceQuery.isError ? (
            <ErrorNotice message={getErrorMessage(jobTraceQuery.error)} />
          ) : jobTraceQuery.data ? (
            <JobTraceDetail trace={jobTraceQuery.data} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function JobTraceDetail({ trace }: { trace: JobTraceResponse }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-4">
        <TraceField label="Job ID" value={trace.job.id} mono />
        <TraceField label="Workflow" value={trace.job.workflowId || '-'} mono />
        <TraceField label="Document" value={trace.job.documentId || '-'} mono />
        <TraceField label="Updated" value={formatDate(trace.job.updatedAt)} />
      </div>
      {trace.job.errorMessage || trace.job.inputPayload || trace.job.resultPayload ? (
        <div className="space-y-2">
          {trace.job.errorMessage ? <ErrorNotice message={trace.job.errorMessage} /> : null}
          <PayloadDetails title="Input Payload" value={trace.job.inputPayload} />
          <PayloadDetails title="Result Payload" value={trace.job.resultPayload} />
        </div>
      ) : null}

      <div className="border-t border-[#e3e8f0] pt-4">
        <h4 className="mb-2 text-sm font-semibold text-[#344054]">
          Agent Sessions ({trace.agentSessions.length})
        </h4>
        {trace.agentSessions.length === 0 ? (
          <EmptyState title="No agent sessions found" />
        ) : (
          <div className="space-y-3">
            {trace.agentSessions.map((agentTrace) => (
              <section key={agentTrace.session.id} className="rounded-md border border-[#d8dee8] bg-white p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#667085]" aria-hidden="true" />
                      <h3 className="truncate font-semibold text-[#172033]">
                        {agentTrace.session.skillName || agentTrace.session.jobType}
                      </h3>
                      <StatusPill value={agentTrace.session.finalStatus} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-[#667085]">{agentTrace.session.id}</p>
                  </div>
                  <div className="grid gap-2 text-right text-xs text-[#667085] sm:grid-cols-3">
                    <span>{agentTrace.session.model || '-'}</span>
                    <span>{formatDuration(agentTrace.session.totalDurationMs)}</span>
                    <span>{formatTokens(agentTrace.session.totalTokens)}</span>
                  </div>
                </div>

                <div className="mt-2 grid gap-3 lg:grid-cols-4">
                  <TraceField label="Rounds" value={agentTrace.session.totalRounds ?? '-'} />
                  <TraceField
                    label="Validation"
                    value={agentTrace.session.validationPassed == null ? '-' : String(agentTrace.session.validationPassed)}
                  />
                  <TraceField label="Created" value={formatDate(agentTrace.session.createdAt)} />
                  <TraceField label="Completed" value={formatDate(agentTrace.session.completedAt)} />
                </div>

                {agentTrace.session.finalValidationMessage ? (
                  <div className="mt-2 rounded-md border border-[#d8dee8] bg-[#f8fafc] px-3 py-2 text-sm text-[#475467]">
                    {agentTrace.session.finalValidationMessage}
                  </div>
                ) : null}

                {agentTrace.session.finalStatus === 'FAILED_UNKNOWN_TERMS' &&
                agentTrace.unknownTerms.length > 0 ? (
                  <div className="mt-2 rounded-md border border-[#f7b4ae] bg-[#fff1f0] px-4 py-3">
                    <h4 className="text-sm font-semibold text-[#b42318]">
                      Knowledge Gap - {agentTrace.unknownTerms.length} term
                      {agentTrace.unknownTerms.length === 1 ? '' : 's'}
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {agentTrace.unknownTerms.map((term, i) => (
                        <span
                          key={i}
                          className="rounded border border-[#f7b4ae] bg-white px-2 py-0.5 text-xs text-[#b42318]"
                          title={term.reason}
                        >
                          {term.query}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-2">
                  <LlmCalls calls={agentTrace.llmCalls} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {trace.unscopedLlmCalls.length > 0 ? (
        <div className="border-t border-[#e3e8f0] pt-4">
          <h4 className="mb-2 text-sm font-semibold text-[#344054]">
            Unscoped LLM Calls ({trace.unscopedLlmCalls.length})
          </h4>
          <LlmCalls calls={trace.unscopedLlmCalls} />
        </div>
      ) : null}
    </div>
  )
}

function LlmCalls({ calls }: { calls: LlmCallTrace[] }) {
  if (calls.length === 0) {
    return <EmptyState title="No LLM audit calls found" />
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-[#344054]">LLM Audit</h4>
      <div className="space-y-2">
        {calls.map((trace) => (
          <details key={trace.call.id} className="rounded-md border border-[#d8dee8] bg-white">
            <summary className="grid cursor-pointer gap-3 px-3 py-2 text-sm hover:bg-[#f8fafc] md:grid-cols-[110px_1fr_120px_110px_120px] md:items-center">
              <span className="font-medium text-[#172033]">Round {trace.call.iterationRound ?? '-'}</span>
              <span className="min-w-0 truncate font-mono text-xs text-[#667085]">{trace.call.llmCallId}</span>
              <StatusPill value={trace.call.status} />
              <span className="text-xs text-[#667085]">{formatDuration(trace.call.durationMs)}</span>
              <span className="text-xs text-[#667085]">{formatTokens(trace.call.totalTokens)}</span>
            </summary>
            <div className="space-y-3 border-t border-[#e3e8f0] p-3">
              <div className="grid gap-3 lg:grid-cols-4">
                <TraceField label="Model" value={trace.call.model} />
                <TraceField label="Retry Count" value={trace.call.retryCount ?? 0} />
                <TraceField label="Created" value={formatDate(trace.call.createdAt)} />
                <TraceField label="Prompt Tokens" value={trace.call.promptTokens ?? '-'} />
              </div>
              {trace.call.errorMessage ? <ErrorNotice message={trace.call.errorMessage} /> : null}
              <PayloadDetails title="Prompt" value={trace.call.prompt} />
              <PayloadDetails title="Response" value={trace.call.response} />

              {/* Tool Calls */}
              {trace.toolCalls.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase text-[#667085]">
                    Tool Calls ({trace.toolCalls.length})
                  </h5>
                  {trace.toolCalls.map((tc) => (
                    <details key={tc.id} className="rounded-md border border-[#d8dee8] bg-white">
                      <summary className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-xs hover:bg-[#f8fafc]">
                        <span className="font-medium text-[#172033]">{tc.toolName}</span>
                        <StatusPill value={tc.status} />
                        <span className="text-[#667085]">{formatDuration(tc.durationMs)}</span>
                        <span className="text-[#98a2b3]">{formatDate(tc.createdAt)}</span>
                      </summary>
                      <div className="space-y-2 border-t border-[#e3e8f0] p-3">
                        {tc.errorMessage ? <ErrorNotice message={tc.errorMessage} /> : null}
                        <PayloadDetails title="Request" value={tc.requestJson} />
                        {tc.responseJson ? <PayloadDetails title="Response" value={tc.responseJson} /> : null}
                        <SourcesList sourcesJson={tc.sourcesJson} />
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

function PayloadDetails({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null
  return (
    <details className="rounded-md border border-[#d8dee8] bg-[#f8fafc]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[#344054]">{title}</summary>
      <div className="border-t border-[#e3e8f0] p-3">
        <JsonBlock value={value} className="max-h-[420px]" />
      </div>
    </details>
  )
}

function TraceField({
  label,
  value,
  mono,
  icon,
}: {
  label: string
  value: string | number
  mono?: boolean
  icon?: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#e3e8f0] bg-[#f8fafc] px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-[#667085]">
        {icon}
        {label}
      </div>
      <div className={mono ? 'mt-1 truncate font-mono text-xs text-[#172033]' : 'mt-1 truncate text-sm text-[#172033]'}>{value}</div>
    </div>
  )
}

function formatDuration(value?: number | null) {
  if (value == null) return '-'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function formatTokens(value?: number | null) {
  if (value == null) return '-'
  return `${value.toLocaleString()} tokens`
}
