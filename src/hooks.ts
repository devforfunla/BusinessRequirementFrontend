import { useQuery } from '@tanstack/react-query'
import { jobsApi, type AsyncJob, isJobRunning } from './api'

export function usePolledJob(jobId?: string | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.get(jobId || ''),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const job = query.state.data as AsyncJob | undefined
      return jobId && isJobRunning(job?.status) ? 2000 : false
    },
  })
}
