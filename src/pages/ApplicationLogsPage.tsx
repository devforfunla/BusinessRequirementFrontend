import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { applicationLogsApi, getErrorMessage } from '../api'
import { Button, EmptyState, ErrorNotice, Label, PageTitle, Panel, PanelHeader, Select, TextInput } from '../components/ui'
import { cn, formatBytes, formatDate } from '../utils'

const tailOptions = [200, 500, 1000, 5000]
const levelOptions = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG']

export function ApplicationLogsPage() {
  const [tail, setTail] = useState(500)
  const [level, setLevel] = useState('ALL')
  const [query, setQuery] = useState('')
  const [liveRefresh, setLiveRefresh] = useState(true)

  const logsQuery = useQuery({
    queryKey: ['application-logs', tail, level, query],
    queryFn: () =>
      applicationLogsApi.get({
        tail,
        level: level === 'ALL' ? undefined : level,
        q: query.trim() || undefined,
      }),
    refetchInterval: liveRefresh ? 2500 : false,
  })

  const logData = logsQuery.data

  return (
    <div className="space-y-5">
      <PageTitle
        title="Application Logs"
        description="Read the backend application log file without leaving the review UI."
        actions={
          <Button onClick={() => void logsQuery.refetch()} disabled={logsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <Panel>
        <PanelHeader
          title="Runtime Log"
          description={
            logData
              ? `${logData.fileName} - ${formatBytes(logData.fileSize)} - ${logData.returnedLines} lines`
              : 'Waiting for log data'
          }
          actions={
            <label className="flex h-9 items-center gap-2 rounded-md border border-[#c8d0dc] bg-white px-3 text-sm text-[#344054]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#1f6feb]"
                checked={liveRefresh}
                onChange={(event) => setLiveRefresh(event.target.checked)}
              />
              Live
            </label>
          }
        />
        <div className="grid gap-3 border-b border-[#e3e8f0] p-4 lg:grid-cols-[160px_160px_1fr]">
          <Label label="Tail">
            <Select value={tail} onChange={(event) => setTail(Number(event.target.value))}>
              {tailOptions.map((option) => (
                <option key={option} value={option}>
                  {option} lines
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Level">
            <Select value={level} onChange={(event) => setLevel(event.target.value)}>
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Label>
          <Label label="Filter">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#98a2b3]" aria-hidden="true" />
              <TextInput className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </Label>
        </div>

        {logsQuery.isError ? (
          <div className="p-4">
            <ErrorNotice message={getErrorMessage(logsQuery.error)} />
          </div>
        ) : null}

        {!logsQuery.isLoading && logData?.lines.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No log lines found" description="Adjust the filters or wait for the backend to write new entries." />
          </div>
        ) : (
          <div className="max-h-[680px] overflow-auto bg-[#0b1220]">
            <div className="min-w-[1000px] py-2 font-mono text-xs leading-5">
              {(logData?.lines || []).map((line, index) => (
                <div
                  key={`${index}-${line}`}
                  className={cn('whitespace-pre-wrap px-4 py-0.5 text-[#d7e0ea]', getLogLineClass(line))}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {logData?.lastModified ? (
          <div className="border-t border-[#e3e8f0] px-4 py-2 text-xs text-[#667085]">
            Last modified {formatDate(logData.lastModified)}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}

function getLogLineClass(line: string) {
  const normalized = line.toLowerCase()
  if (normalized.includes(' error')) return 'bg-[#3b1115] text-[#ffd3cd]'
  if (normalized.includes(' warn')) return 'bg-[#33260b] text-[#ffe6a6]'
  if (normalized.includes(' debug')) return 'text-[#a8c7fa]'
  return ''
}
