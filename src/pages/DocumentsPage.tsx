import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { documentsApi, getErrorMessage } from '../api'
import { useAppStore } from '../store'
import { formatBytes, formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, StatusPill, TextInput } from '../components/ui'

export function DocumentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setReviewerId = useAppStore((state) => state.setReviewerId)
  const setDocumentId = useAppStore((state) => state.setDocumentId)
  const [file, setFile] = useState<File | null>(null)

  const documentsQuery = useQuery({
    queryKey: ['documents', reviewerId],
    queryFn: () => (reviewerId ? documentsApi.listByReviewer(reviewerId) : documentsApi.list()),
    refetchInterval: 5000,
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a PDF or TXT document first.')
      const uploaded = await documentsApi.upload(file, reviewerId || 'reviewer-poc')
      await documentsApi.transform(uploaded.documentId)
      return uploaded
    },
    onSuccess: (uploaded) => {
      toast.success('Document uploaded and transform started')
      setDocumentId(uploaded.documentId)
      setFile(null)
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const transformMutation = useMutation({
    mutationFn: documentsApi.transform,
    onSuccess: () => {
      toast.success('Transform requested')
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      toast.success('Document deleted')
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documents = documentsQuery.data || []

  return (
    <div className="space-y-5">
      <PageTitle
        title="Documents"
        description="Upload source material, transform it to markdown, and start semantic analysis from a completed document."
        actions={
          <Button onClick={() => void documentsQuery.refetch()} disabled={documentsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel>
        <PanelHeader title="Upload Source Document" description="Supported upload formats come from the backend document service." />
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
          <Label label="File">
            <TextInput
              type="file"
              accept=".pdf,.txt"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </Label>
          <Label label="Reviewer ID">
            <TextInput value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} />
          </Label>
          <Button variant="primary" onClick={() => uploadMutation.mutate()} disabled={!file || uploadMutation.isPending}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload and Transform
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Document Queue" description={`${documents.length} document${documents.length === 1 ? '' : 's'}`} />
        {documentsQuery.isError ? <div className="p-4"><ErrorNotice message={getErrorMessage(documentsQuery.error)} /></div> : null}
        {documents.length === 0 && !documentsQuery.isLoading ? (
          <div className="p-4">
            <EmptyState title="No documents found" description="Upload a document to begin the two-phase rule workflow." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Document</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Size</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Pages</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Updated</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-b border-[#edf1f6] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-[#667085]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#172033]">{document.fileName}</p>
                          <p className="truncate text-xs text-[#667085]">{document.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusPill value={document.transformStatus} /></td>
                    <td className="px-4 py-3 text-[#475467]">{formatBytes(document.fileSize)}</td>
                    <td className="px-4 py-3 text-[#475467]">{document.totalPages || '-'}</td>
                    <td className="px-4 py-3 text-[#475467]">{formatDate(document.updatedAt || document.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setDocumentId(document.id)
                            navigate(`/workflows?documentId=${encodeURIComponent(document.id)}`)
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => transformMutation.mutate(document.id)}
                          disabled={transformMutation.isPending || document.transformStatus === 'PROCESSING'}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          Transform
                        </Button>
                        <Button
                          size="icon"
                          variant="danger"
                          title="Delete document"
                          onClick={() => {
                            if (window.confirm(`Delete ${document.fileName}?`)) deleteMutation.mutate(document.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
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
