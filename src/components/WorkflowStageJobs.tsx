import { Activity, AlertCircle, Clock3 } from 'lucide-react'
import type { AsyncJob } from '../api'
import { formatDate } from '../utils'
import { EmptyState, JsonBlock, Panel, PanelHeader, StatusPill } from './ui'

export function WorkflowStageJobs({
  title,
  jobs,
  jobTypes,
}: {
  title: string
  jobs: AsyncJob[]
  jobTypes: string[]
}) {
  const stageJobs = jobs.filter((job) => jobTypes.includes(job.jobType))
  const latestByType = jobTypes
    .map((jobType) => stageJobs.find((job) => job.jobType === jobType))
    .filter((job): job is AsyncJob => Boolean(job))

  return (
    <Panel>
      <PanelHeader title={title} description={`${stageJobs.length} job${stageJobs.length === 1 ? '' : 's'} for this stage`} />
      {latestByType.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No jobs for this stage" />
        </div>
      ) : (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {latestByType.map((job) => (
            <div key={job.id} className="rounded-md border border-[#d8dee8] bg-[#f8fafc] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#172033]">{job.jobType}</p>
                  <p className="mt-1 truncate font-mono text-xs text-[#667085]">{job.id}</p>
                </div>
                <StatusPill value={job.status} />
              </div>
              <div className="mt-3 grid gap-2 text-xs text-[#667085] sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(job.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(job.updatedAt)}
                </span>
              </div>
              {job.errorMessage ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-[#f7b4ae] bg-[#fff7f6] px-3 py-2 text-xs text-[#b42318]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{job.errorMessage}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

export function JobSummaryCard({ title, job }: { title: string; job?: AsyncJob | null }) {
  if (!job) {
    return (
      <div className="rounded-md border border-dashed border-[#c8d0dc] bg-[#f8fafc] p-3">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <p className="mt-1 text-sm text-[#667085]">No completed job yet.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-[#d8dee8] bg-[#fbfcfe] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>
        <StatusPill value={job.status} />
      </div>
      <p className="mt-2 font-mono text-xs text-[#667085]">{job.id}</p>
      {job.resultPayload ? <JsonBlock className="mt-3 min-h-64 max-h-[460px] flex-1" value={job.resultPayload} /> : null}
      {job.errorMessage ? <p className="mt-2 text-sm text-[#b42318]">{job.errorMessage}</p> : null}
    </div>
  )
}
