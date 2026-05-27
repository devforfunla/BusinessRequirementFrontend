import type { AsyncJob } from './api'

export function latestJob(jobs: AsyncJob[], jobType: string) {
  return jobs.find((job) => job.jobType === jobType) || null
}
