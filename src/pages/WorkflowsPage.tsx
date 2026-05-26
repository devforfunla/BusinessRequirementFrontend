import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { documentsApi, getErrorMessage, semanticMakerApi, workflowsApi } from '../api'
import { usePolledJob } from '../hooks'
import { useAppStore } from '../store'
import { formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, Select, StatusPill, TextInput } from '../components/ui'

export function WorkflowsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const setWorkflowId = useAppStore((state) => state.setWorkflowId)
  const initialDocumentId = searchParams.get('documentId') || selectedDocumentId || ''
  const [documentFilter, setDocumentFilter] = useState(initialDocumentId)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const documentsQuery = useQuery({
    queryKey: ['documents', reviewerId],
    queryFn: () => (reviewerId ? documentsApi.listByReviewer(reviewerId) : documentsApi.list()),
    refetchInterval: 5000,
  })

  const workflowsQuery = useQuery({
    queryKey: ['workflows', documentFilter],
    queryFn: () => workflowsApi.list(documentFilter || undefined, true),
    refetchInterval: 5000,
  })

  const jobQuery = usePolledJob(activeJobId)

  useEffect(() => {
    const job = jobQuery.data
    if (!job) return
    if (job.status === 'SUCCEEDED') {
      toast.success('Semantic rule extraction completed')
      window.setTimeout(() => setActiveJobId(null), 0)
      void queryClient.invalidateQueries({ queryKey: ['workflows'] })
      if (job.workflowId) {
        setWorkflowId(job.workflowId)
        navigate(`/workflows/${encodeURIComponent(job.workflowId)}`)
      }
    }
    if (job.status === 'FAILED') {
      toast.error(job.errorMessage || 'Semantic rule extraction failed')
      window.setTimeout(() => setActiveJobId(null), 0)
    }
  }, [jobQuery.data, navigate, queryClient, setWorkflowId])

  const semanticMakerMutation = useMutation({
    mutationFn: () => semanticMakerApi.extract(documentFilter, reviewerId || 'reviewer-poc'),
    onSuccess: (response) => {
      toast.success('Semantic maker job queued')
      setActiveJobId(response.jobId)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documents = documentsQuery.data || []
  const workflows = workflowsQuery.data || []
  const selectedDocument = documents.find((document) => document.id === documentFilter)
  const canExtract = Boolean(documentFilter) && selectedDocument?.transformStatus === 'COMPLETED'

  return (
    <div className="space-y-5">
      <PageTitle
        title="Workflows"
        description="Create semantic analysis workflows from transformed documents, then open a workflow for review and atomic generation."
        actions={
          <Button onClick={() => void workflowsQuery.refetch()} disabled={workflowsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel>
        <PanelHeader
          title="Semantic Extraction"
          description="This starts the new two-phase flow. The frontend does not call the legacy atomic maker extract endpoint."
          actions={
            <Button
              variant="primary"
              onClick={() => semanticMakerMutation.mutate()}
              disabled={!canExtract || semanticMakerMutation.isPending || Boolean(activeJobId)}
              title={!canExtract ? 'Select a document with COMPLETED transform status' : undefined}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run Semantic Maker
            </Button>
          }
        />
        <div className="grid gap-4 p-4 lg:grid-cols-[360px_1fr_auto] lg:items-end">
          <Label label="Document">
            <Select
              value={documentFilter}
              onChange={(event) => {
                setDocumentFilter(event.target.value)
                setDocumentId(event.target.value || null)
                setSearchParams(event.target.value ? { documentId: event.target.value } : {})
              }}
            >
              <option value="">All documents</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.fileName} - {document.transformStatus}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Document ID">
            <TextInput
              value={documentFilter}
              onChange={(event) => {
                setDocumentFilter(event.target.value)
                setDocumentId(event.target.value || null)
              }}
              placeholder="Paste a document ID"
            />
          </Label>
          <div className="flex items-center gap-2">
            <StatusPill value={selectedDocument?.transformStatus || (documentFilter ? 'UNKNOWN' : 'NO_FILTER')} />
          </div>
        </div>
        {activeJobId ? (
          <div className="border-t border-[#e3e8f0] px-4 py-3 text-sm text-[#475467]">
            Job <span className="font-mono text-xs">{activeJobId}</span> is <StatusPill value={jobQuery.data?.status || 'QUEUED'} />
          </div>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader title="Active Workflows" description={`${workflows.length} workflow${workflows.length === 1 ? '' : 's'}`} />
        {workflowsQuery.isError ? <div className="p-4"><ErrorNotice message={getErrorMessage(workflowsQuery.error)} /></div> : null}
        {workflows.length === 0 && !workflowsQuery.isLoading ? (
          <div className="p-4">
            <EmptyState title="No workflows found" description="Run semantic maker after a document transform is completed." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Workflow</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Maker Skill</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Created</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((workflow) => (
                  <tr key={workflow.id} className="border-b border-[#edf1f6] last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#172033]">{workflow.id}</p>
                      <p className="text-xs text-[#667085]">Document {workflow.documentId}</p>
                    </td>
                    <td className="px-4 py-3"><StatusPill value={workflow.status} /></td>
                    <td className="px-4 py-3 text-[#475467]">
                      {workflow.atomicMakerSkill?.displayName || workflow.atomicMakerSkill?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-[#475467]">{formatDate(workflow.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-md border border-[#1f6feb] bg-[#1f6feb] px-3 text-xs font-medium text-white hover:bg-[#1a5fca]"
                        to={`/workflows/${encodeURIComponent(workflow.id)}`}
                        onClick={() => {
                          setWorkflowId(workflow.id)
                          setDocumentId(workflow.documentId)
                        }}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
