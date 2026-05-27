import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History, RefreshCw } from 'lucide-react'
import { getErrorMessage, isJobRunning, jobsApi, workflowsApi, type AsyncJob } from '../api'
import { WorkflowStageJobs } from '../components/WorkflowStageJobs'
import { WorkflowStagePipeline } from '../components/WorkflowStagePipeline'
import { Button, EmptyState, ErrorNotice, PageTitle, Panel, PanelHeader } from '../components/ui'
import { useAppStore } from '../store'

const testCaseJobTypes = ['TEST_CASE_MAKER', 'TEST_CASE_CHECKER']

export function TestCasesStagePage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)

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

  const jobsQuery = useQuery({
    queryKey: ['workflow-jobs', workflowId],
    queryFn: () => jobsApi.listByWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: (query) => {
      const jobs = query.state.data as AsyncJob[] | undefined
      return jobs?.some((job) => isJobRunning(job.status)) ? 2000 : 5000
    },
  })

  const firstError = workflowQuery.error || jobsQuery.error

  return (
    <div className="space-y-5">
      <PageTitle
        title="Workflow Test Case Stage"
        description={workflowId}
        actions={
          <>
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

      <WorkflowStagePipeline workflowId={workflowId} activeStage="test-cases" />
      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      <WorkflowStageJobs title="Test Case Job Status" jobs={jobsQuery.data || []} jobTypes={testCaseJobTypes} />

      <Panel>
        <PanelHeader title="Test Cases" description="This stage is reserved for generated test cases." />
        <div className="p-4">
          <EmptyState title="Test case generation is not implemented yet" />
        </div>
      </Panel>
    </div>
  )
}
