import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertCircle, Inbox } from 'lucide-react'
import { parseJsonText } from '../api'
import { cn } from '../utils'

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
    normalized === 'SUCCEEDED' || normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PASSED'
      ? 'border-[#9bd4b5] bg-[#ecfdf3] text-[#067647]'
      : normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'BLOCKED'
        ? 'border-[#f7b4ae] bg-[#fff1f0] text-[#b42318]'
        : normalized === 'RUNNING' || normalized === 'PROCESSING' || normalized === 'QUEUED' || normalized === 'DRAFT'
          ? 'border-[#b8ccf0] bg-[#eff6ff] text-[#175cd3]'
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
      <div className="border-t border-[#e3e8f0] p-2">
        <JsonBlock className="max-h-72 min-w-[360px]" value={value} />
      </div>
    </details>
  )
}
