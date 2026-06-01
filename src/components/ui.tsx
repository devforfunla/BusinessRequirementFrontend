import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Inbox, X } from 'lucide-react'
import { parseJsonText } from '../api'
import { cn } from '../utils'

export type TabItem = { id: string; label: string; icon?: ReactNode }

export function Tabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabItem[]
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div className="flex border-b border-[#e3e8f0]" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
              isActive
                ? 'border-[#1f6feb] text-[#1f6feb]'
                : 'border-transparent text-[#667085] hover:border-[#c8d0dc] hover:text-[#344054]',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Wraps horizontally-scrollable content (e.g. wide tables) and pins
 * a scrollbar to the bottom of the viewport while the content is in view.
 */
export function StickyScrollX({ children, className }: { children: ReactNode; className?: string }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollbarRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  const syncWidth = useCallback(() => {
    const content = contentRef.current
    const inner = innerRef.current
    if (!content || !inner) return
    inner.style.width = `${content.scrollWidth}px`
  }, [])

  useEffect(() => {
    syncWidth()
    const content = contentRef.current
    if (!content) return
    const ro = new ResizeObserver(syncWidth)
    ro.observe(content)
    if (content.firstElementChild) ro.observe(content.firstElementChild)
    return () => ro.disconnect()
  }, [syncWidth])

  const onContentScroll = useCallback(() => {
    if (syncing.current) return
    syncing.current = true
    if (scrollbarRef.current && contentRef.current) {
      scrollbarRef.current.scrollLeft = contentRef.current.scrollLeft
    }
    syncing.current = false
  }, [])

  const onScrollbarScroll = useCallback(() => {
    if (syncing.current) return
    syncing.current = true
    if (contentRef.current && scrollbarRef.current) {
      contentRef.current.scrollLeft = scrollbarRef.current.scrollLeft
    }
    syncing.current = false
  }, [])

  return (
    <div className={cn('relative', className)}>
      <div ref={contentRef} className="overflow-x-auto" onScroll={onContentScroll}>
        {children}
      </div>
      <div
        ref={scrollbarRef}
        className="sticky bottom-0 overflow-x-auto overflow-y-hidden"
        style={{ height: 12 }}
        onScroll={onScrollbarScroll}
      >
        <div ref={innerRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({ className, variant = 'secondary', size = 'md', ...props }: ButtonProps) {
  const variants = {
    primary: 'border-[#1f6feb] bg-[#1f6feb] text-white hover:bg-[#1a5fca]',
    secondary: 'border-[#c8d0dc] bg-white text-[#172033] hover:bg-[#eef2f7]',
    ghost: 'border-transparent bg-transparent text-[#334155] hover:bg-[#e7edf5]',
    danger: 'border-[#d14343] bg-white text-[#b42318] hover:bg-[#fff1f0]',
  }
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-3 text-sm',
    icon: 'h-9 w-9 p-0',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border font-medium transition focus:outline-none focus:ring-2 focus:ring-[#6aa4ff]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-[#d8dee8] bg-white shadow-sm', className)} {...props} />
}

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#e3e8f0] px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-[#172033]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[#667085]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-[#172033]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-[#667085]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded-md border border-[#c8d0dc] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#1f6feb] focus:ring-2 focus:ring-[#cfe1ff]',
        props.className,
      )}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-28 w-full rounded-md border border-[#c8d0dc] bg-white px-3 py-2 text-sm text-[#172033] outline-none focus:border-[#1f6feb] focus:ring-2 focus:ring-[#cfe1ff]',
        props.className,
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-9 rounded-md border border-[#c8d0dc] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#1f6feb] focus:ring-2 focus:ring-[#cfe1ff]',
        props.className,
      )}
    />
  )
}

export function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function StatusPill({ value }: { value?: string | null }) {
  const normalized = value || 'UNKNOWN'
  const style =
    normalized === 'SUCCEEDED' || normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PASSED' || normalized === 'Transformed'
      ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
      : normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'BLOCKED' || normalized === 'ERROR' || normalized === 'Transform Failed'
        ? 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'
        : normalized === 'PARTIAL_SUCCESS' || normalized === 'WARNED'
          ? 'border-[#f5c97a] bg-[#fffbeb] text-[#b54708]'
          : normalized === 'RUNNING' || normalized === 'PROCESSING' || normalized === 'QUEUED' || normalized === 'DRAFT' || normalized === 'Transforming'
            ? 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]'
            : normalized === 'Uploaded'
              ? 'border-[#d8c4f7] bg-[#f5f0ff] text-[#6b21a8]'
              : 'border-[#d8dee8] bg-[#f8fafc] text-[#475467]'
  return <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', style)}>{normalized}</span>
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-[#c8d0dc] bg-[#f8fafc] px-4 py-8 text-center">
      <Inbox className="h-8 w-8 text-[#98a2b3]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-[#344054]">{title}</p>
      {description ? <p className="mt-1 max-w-xl text-sm text-[#667085]">{description}</p> : null}
    </div>
  )
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[#f7b4ae] bg-[#fff7f6] px-3 py-2 text-sm text-[#b42318]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  const parsed = typeof value === 'string' ? parseJsonText(value) : value
  const display = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
  return (
    <pre className={cn('json-pre max-h-96 overflow-auto rounded-md bg-[#101828] p-3 text-xs leading-5 text-[#e6edf7]', className)}>
      {display || 'null'}
    </pre>
  )
}

export function JsonDetails({ title, value }: { title: string; value?: string | null }) {
  if (!value) return <span className="text-[#98a2b3]">-</span>
  return (
    <details className="mt-2 rounded-md border border-[#d8dee8] bg-[#f8fafc]">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#175cd3] hover:bg-[#edf2f7]">
        View {title}
      </summary>
      <div className="border-t border-[#e3e8f0] overflow-x-auto p-2">
        <JsonBlock className="max-h-80 max-w-sm" value={value} />
      </div>
    </details>
  )
}

export function JsonViewButton({ title, value, label }: { title: string; value?: string | null; label?: string }) {
  const [open, setOpen] = useState(false)
  if (!value) return <span className="text-[#98a2b3]">-</span>
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label || 'View'}
      </Button>
      {open ? (
        <JsonDrawer title={title} value={value} onClose={() => setOpen(false)} />
      ) : null}
    </>
  )
}

export function JsonDrawer({
  title,
  value,
  onClose,
}: {
  title: string
  value?: string | null
  onClose: () => void
}) {
  if (!value) return null
  const parsed = typeof value === 'string' ? parseJsonText(value) : value
  const display = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#101828]/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-[#c8d0dc] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e3e8f0] bg-[#f8fafc] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded bg-[#1f6feb] px-2 py-0.5 text-xs font-medium text-white">JSON</span>
            <h2 className="text-sm font-semibold text-[#172033]">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#667085] hover:bg-[#edf2f7] hover:text-[#172033] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-[#fafbfc]">
          <pre className="flex min-h-full text-xs leading-6" style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}>
            <div className="sticky left-0 select-none border-r border-[#d8dee8] bg-[#f0f2f5] px-2 py-5 text-right text-[#8b949e] select-none">
              {display.split('\n').map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="flex-1 py-5 pl-4 pr-2 text-[#24292f] overflow-x-auto whitespace-pre"
              dangerouslySetInnerHTML={{ __html: colorizeJson(display || 'null') }}
            />
          </pre>
        </div>
      </div>
    </div>
  )
}

export function colorizeJson(json: string): string {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // field names: "key":  →  brown/maroon
    .replace(/(^[ \t]*)"([^"]+)":/gm, (_, space, key) => `${space}<span style="color:#a31515">"${key}"</span>:`)
    // string values: ": "value"  →  dark blue
    .replace(/: "([^"]*)"/g, (_, val) => ': <span style="color:#0451a5">"' + val + '"</span>')
    // numbers: : 123  →  green
    .replace(/: (-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span style="color:#098658">$1</span>')
    // booleans: true/false  →  blue
    .replace(/: (true|false)/g, ': <span style="color:#0000ff">$1</span>')
    // null: null  →  blue (same as bool)
    .replace(/: (null)/g, ': <span style="color:#0000ff">$1</span>')
    // key names inside nested objects
    .replace(/([{,]\s*)"([^"]+)":/g, (_, pre, key) => `${pre}<span style="color:#a31515">"${key}"</span>:`)
    // string values in arrays
    .replace(/(,|\[)\s*"([^"]*)"/g, (_, pre, val) => `${pre}<span style="color:#0451a5">"${val}"</span>`)
    // numbers in arrays
    .replace(/(,|\[)\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (_, pre, num) => `${pre}<span style="color:#098658">${num}</span>`)
}
