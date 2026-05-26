import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, RefreshCw } from 'lucide-react'
import { getErrorMessage, jobsApi, workflowsApi } from '../api'
import { formatDate } from '../utils'
import { Button, EmptyState, ErrorNotice, JsonBlock, PageTitle, Panel, PanelHeader, StatusPill } from '../components/ui'

export function HistoryPage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ['change-history', workflowId],
    queryFn: () => workflowsApi.history(workflowId),
    enabled: Boolean(workflowId),
  })

  const affectedQuery = useQuery({
    queryKey: ['job-affected-rules', selectedEventId],
    queryFn: () => jobsApi.affectedRules(selectedEventId || ''),
    enabled: Boolean(selectedEventId),
    retry: false,
  })

  const changesQuery = useQuery({
    queryKey: ['job-changes', selectedEventId],
    queryFn: () => jobsApi.changes(selectedEventId || ''),
    enabled: Boolean(selectedEventId),
    retry: false,
  })

  const history = historyQuery.data || []

  return (
    <div className="space-y-5">
      <PageTitle
        title="Change History"
        description={workflowId}
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center justify-center rounded-md border border-[#c8d0dc] bg-white px-3 text-sm font-medium text-[#172033] hover:bg-[#eef2f7]"
              to={`/workflows/${encodeURIComponent(workflowId)}`}
            >
              Back to Workflow
            </Link>
            <Button onClick={() => void queryClient.invalidateQueries()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      {historyQuery.error ? <ErrorNotice message={getErrorMessage(historyQuery.error)} /> : null}

      <div className="grid gap-4 xl:grid-cols-[520px_1fr]">
        <Panel>
          <PanelHeader title="Timeline" description={`${history.length} event${history.length === 1 ? '' : 's'}`} />
          {history.length === 0 && !historyQuery.isLoading ? (
            <div className="p-4"><EmptyState title="No change history" description="Rewrite and human edit events will appear here." /></div>
          ) : (
            <div className="divide-y divide-[#edf1f6]">
              {history.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="grid w-full gap-2 px-4 py-3 text-left hover:bg-[#f8fafc]"
                  onClick={() => setSelectedEventId(event.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-[#172033]">{event.changeType}</span>
                    <StatusPill value={event.status || 'EVENT'} />
                  </div>
                  <p className="truncate font-mono text-xs text-[#667085]">{event.id}</p>
                  <p className="text-xs text-[#667085]">{formatDate(event.timestamp)}</p>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Event Detail"
            description={selectedEventId || 'Select a timeline event'}
            actions={
              selectedEventId ? (
                <Button onClick={() => void Promise.all([affectedQuery.refetch(), changesQuery.refetch()])}>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Load Detail
                </Button>
              ) : null
            }
          />
          <div className="space-y-4 p-4">
            {affectedQuery.error ? <ErrorNotice message={getErrorMessage(affectedQuery.error)} /> : null}
            {changesQuery.error ? <ErrorNotice message={getErrorMessage(changesQuery.error)} /> : null}
            {selectedEventId ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-[#667085]">Affected Rules</p>
                  <JsonBlock value={affectedQuery.data || { message: 'No affected-rule detail loaded yet.' }} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-[#667085]">Field Changes</p>
                  <JsonBlock value={changesQuery.data || { message: 'No field-change detail loaded yet.' }} />
                </div>
              </>
            ) : (
              <EmptyState title="No event selected" description="Choose a timeline row to inspect affected rules and field-level changes." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
