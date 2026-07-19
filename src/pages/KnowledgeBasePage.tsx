import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { Archive, Box, BookOpen, ChevronDown, ChevronRight, ListTree, RefreshCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, knowledgeBaseApi, type KbDocument, type KbDocumentOutline, type KbDocumentStatus, type SectionTreeNode } from '../api'
import { cn, formatBytes, formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, Select, StatusPill, StickyScrollX, TextInput } from '../components/ui'

type StatusFilter = KbDocumentStatus | 'all'

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ingesting', label: 'Ingesting' },
  { value: 'active', label: 'Active' },
  { value: 'failed', label: 'Failed' },
  { value: 'outdated', label: 'Outdated' },
  { value: 'archived', label: 'Archived' },
]

function countAllSections(tree: SectionTreeNode[]): number {
  let count = 0
  for (const node of tree) {
    count += 1
    count += countAllSections(node.children)
  }
  return count
}

function hasNullSummary(tree: KbDocumentOutline | undefined): boolean {
  if (!tree) return false
  for (const node of tree) {
    if (node.summary === null) return true
    if (hasNullSummary(node.children)) return true
  }
  return false
}

export function KnowledgeBasePage() {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null)

  const documentsQuery = useQuery({
    queryKey: ['kb-documents', statusFilter],
    queryFn: () => knowledgeBaseApi.list(statusFilter === 'all' ? undefined : statusFilter),
    refetchInterval: (query) => {
      const docs = (query.state.data as KbDocument[] | undefined) || []
      return docs.some((d) => d.status === 'ingesting') ? 5000 : 30000
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (f: File) => knowledgeBaseApi.upload(f),
    onSuccess: () => {
      toast.success('Document uploaded')
      setFile(null)
      void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const outlineQuery = useQuery({
    queryKey: ['kb-document-outline', expandedDocId],
    queryFn: () => knowledgeBaseApi.outline(expandedDocId!),
    enabled: expandedDocId !== null,
    staleTime: 60_000,
    refetchInterval: (query) => {
      const tree = query.state.data as KbDocumentOutline | undefined
      return hasNullSummary(tree) ? 5000 : false
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => knowledgeBaseApi.delete(id),
    onSuccess: () => {
      toast.success('Document deleted')
      void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const updateVersionMutation = useMutation({
    mutationFn: (vars: { id: number; status: 'outdated' | 'archived' }) =>
      knowledgeBaseApi.updateVersionStatus(vars.id, vars.status),
    onSuccess: (_data, vars) => {
      toast.success(`Marked ${vars.status}`)
      void queryClient.invalidateQueries({ queryKey: ['kb-documents'] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const documents = documentsQuery.data || []

  return (
    <div className="space-y-5" suppressHydrationWarning>
      <PageTitle
        title="Knowledge Base"
        description="Upload reference documents. Ingested docs become searchable via the MCP search tool."
        actions={
          <Button onClick={() => void documentsQuery.refetch()} disabled={documentsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel>
        <PanelHeader title="Upload Reference Document" description="Accepted formats: PDF, TXT, Markdown, DOCX. Max 50MB." />
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Label label="File">
            <TextInput
              type="file"
              accept=".pdf,.txt,.md,.docx"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </Label>
          <Button
            variant="primary"
            onClick={() => file && uploadMutation.mutate(file)}
            disabled={!file || uploadMutation.isPending}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Documents"
          description={`${documents.length} document${documents.length === 1 ? '' : 's'}`}
          actions={
            <div className="flex items-end">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-40"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        {documentsQuery.isError ? (
          <div className="p-4">
            <ErrorNotice message={getErrorMessage(documentsQuery.error)} />
          </div>
        ) : documents.length === 0 && !documentsQuery.isLoading ? (
          <div className="p-4">
            <EmptyState
              title={statusFilter === 'all' ? 'No documents yet' : 'No documents match this filter'}
              description={
                statusFilter === 'all'
                  ? 'Upload a reference document to make it searchable via the MCP search tool.'
                  : 'Try a different status filter.'
              }
            />
          </div>
        ) : (
          <StickyScrollX>
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#667085]">
                <tr>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Document</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Size</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Pages</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Uploaded</th>
                  <th className="border-b border-[#e3e8f0] px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <Fragment key={document.id}>
                    <tr
                      className="cursor-pointer border-b border-[#edf1f6] last:border-0 hover:bg-[#f8fafc]"
                      onClick={() => setExpandedDocId((current) => (current === document.id ? null : document.id))}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#172033]">{document.name}</p>
                            {document.fileName && document.fileName !== document.name ? (
                              <p className="truncate text-xs text-[#667085]">{document.fileName}</p>
                            ) : null}
                            <p className="truncate text-xs text-[#98a2b3]">id: {document.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          title={document.status === 'failed' ? 'Ingestion failed - see backend logs for detail.' : undefined}
                        >
                          <StatusPill value={document.status.toUpperCase()} />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#475467]">{formatBytes(document.fileSize)}</td>
                      <td className="px-4 py-3 text-[#475467]">{document.pageCount ?? '-'}</td>
                      <td className="px-4 py-3 text-[#475467]">{formatDate(document.uploadedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="View outline"
                            disabled={document.status !== 'active' && document.status !== 'archived'}
                            onClick={(event) => {
                              event.stopPropagation()
                              setExpandedDocId((current) => (current === document.id ? null : document.id))
                            }}
                          >
                            <ListTree className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Mark outdated (removes from search index)"
                            disabled={document.status !== 'active'}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (window.confirm(`Mark "${document.name}" as outdated? This removes it from the MCP search index.`)) {
                                updateVersionMutation.mutate({ id: document.id, status: 'outdated' })
                              }
                            }}
                          >
                            <Archive className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Mark archived (removes from search index)"
                            disabled={document.status !== 'active' && document.status !== 'outdated'}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (window.confirm(`Mark "${document.name}" as archived? This removes it from the MCP search index.`)) {
                                updateVersionMutation.mutate({ id: document.id, status: 'archived' })
                              }
                            }}
                          >
                            <Box className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="danger"
                            title="Delete document"
                            onClick={(event) => {
                              event.stopPropagation()
                              if (window.confirm(`Delete "${document.name}"?`)) {
                                deleteMutation.mutate(document.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedDocId === document.id ? (
                      <tr>
                        <td colSpan={6} className="border-b border-[#edf1f6] bg-[#f8fafc] px-4 py-3">
                          <OutlinePanel doc={document} outlineQuery={outlineQuery} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </StickyScrollX>
        )}
      </Panel>
    </div>
  )
}

function OutlinePanel({
  doc,
  outlineQuery,
}: {
  doc: KbDocument
  outlineQuery: UseQueryResult<KbDocumentOutline>
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())

  const toggleCollapse = (sectionId: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  if (doc.status !== 'active' && doc.status !== 'archived') {
    return (
      <p className="text-sm text-[#667085]">
        Outline is available only for active or archived documents.
      </p>
    )
  }
  if (outlineQuery.isPending) {
    return <p className="text-sm text-[#667085]">Loading outline…</p>
  }
  if (outlineQuery.isError) {
    return <ErrorNotice message={getErrorMessage(outlineQuery.error)} />
  }
  const tree = outlineQuery.data || []
  if (tree.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[#172033]">No sections created.</p>
        <p className="text-xs text-[#667085]">
          Ingestion produced zero sections. The source document may have been empty or unparseable.
        </p>
      </div>
    )
  }
  const totalSections = countAllSections(tree)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#172033]">
        {totalSections} section{totalSections === 1 ? '' : 's'}, {tree.length} top-level heading{tree.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-0.5">
        {tree.map((node) => (
          <SectionNodeView
            key={node.sectionId}
            node={node}
            collapsedIds={collapsedIds}
            toggleCollapse={toggleCollapse}
          />
        ))}
      </ul>
    </div>
  )
}

function SectionNodeView({
  node,
  collapsedIds,
  toggleCollapse,
}: {
  node: SectionTreeNode
  collapsedIds: Set<number>
  toggleCollapse: (id: number) => void
}) {
  const isCollapsed = collapsedIds.has(node.sectionId)
  const hasChildren = node.children.length > 0

  return (
    <li className="list-none">
      <div
        className={cn(
          'flex items-start gap-1 py-0.5',
          hasChildren && 'cursor-pointer',
        )}
        onClick={() => hasChildren && toggleCollapse(node.sectionId)}
      >
        {hasChildren ? (
          isCollapsed ? (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
          ) : (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" aria-hidden="true" />
          )
        ) : (
          <span className="inline-block w-4 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            {node.path !== null && (
              <span className="shrink-0 text-xs text-[#667085]">{node.path}</span>
            )}
            <span className="text-sm font-medium text-[#172033]">
              {node.title ?? '(untitled)'}
            </span>
          </div>
          {node.summary !== null ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[#667085]">
              {node.summary}
            </p>
          ) : (
            <p className="mt-0.5 text-xs italic text-[#98a2b3]">Summary pending…</p>
          )}
        </div>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="pl-6">
          {node.children.map((child) => (
            <SectionNodeView
              key={child.sectionId}
              node={child}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
