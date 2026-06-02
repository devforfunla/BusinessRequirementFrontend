import { isJobRunning, normalizeJobStatus, type AsyncJob } from './api'

export function latestJob(jobs: AsyncJob[], jobType: string): AsyncJob | null {
  return latestStageJob(jobs.filter((job) => job.jobType === jobType))
}

export function latestStageJob(jobs: AsyncJob[]): AsyncJob | null {
  if (jobs.length === 0) return null
  return [...jobs].sort((a, b) => jobActivityTime(b) - jobActivityTime(a))[0]
}

export function deriveStageStatus(jobs: AsyncJob[]): string {
  if (jobs.length === 0) return 'NOT_STARTED'
  if (jobs.some((job) => isJobRunning(job.status))) return 'RUNNING'
  return normalizeJobStatus(latestStageJob(jobs)?.status)
}

function jobActivityTime(job: AsyncJob) {
  return Date.parse(job.updatedAt || job.createdAt || '') || 0
}
