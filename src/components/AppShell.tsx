import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Activity, BarChart3, BookOpen, ChevronLeft, ChevronRight, FileText, GitBranch, Layers3, ScrollText, Settings, ShieldCheck } from 'lucide-react'
import { useAppStore } from '../store'
import { cn } from '../utils'
import { TextInput } from './ui'

const navItems = [
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { to: '/workflows', label: 'Workflows', icon: GitBranch },
  { to: '/skills', label: 'Skills', icon: Settings },
  { to: '/application-logs', label: 'Application Logs', icon: ScrollText },
  { to: '/trace-logs', label: 'Trace Logs', icon: Activity },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const reviewerId = useAppStore((state) => state.reviewerId)
  const setReviewerId = useAppStore((state) => state.setReviewerId)
  const selectedDocumentId = useAppStore((state) => state.selectedDocumentId)
  const selectedWorkflowId = useAppStore((state) => state.selectedWorkflowId)

  const sidebarWidth = collapsed ? 'w-16' : 'w-64'

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <aside className={cn('fixed inset-y-0 left-0 hidden border-r border-[#d8dee8] bg-white transition-all lg:flex lg:flex-col', sidebarWidth)}>
        <div className={cn('flex h-16 items-center gap-3 border-b border-[#e3e8f0] px-5', collapsed && 'justify-center px-2')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#1f6feb] text-white">
            <Layers3 className="h-5 w-5" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-sm font-semibold">Requirement Rules</p>
              <p className="text-xs text-[#667085]">Semantic to atomic POC</p>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-[#344054] hover:bg-[#edf2f7]',
                  collapsed && 'justify-center px-0',
                  isActive && 'bg-[#e8f1ff] text-[#175cd3]',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#e3e8f0] p-4">
          {!collapsed ? (
            <label className="grid gap-1.5 text-xs font-medium text-[#475467]">
              Reviewer ID
              <TextInput value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} />
            </label>
          ) : (
            <ShieldCheck className="mx-auto h-4 w-4 text-[#667085]" />
          )}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-10 items-center justify-center border-t border-[#e3e8f0] text-[#667085] hover:bg-[#edf2f7]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className={cn('lg:pl-64 transition-all', collapsed && 'lg:pl-16')}>
        <header className="sticky top-0 z-20 border-b border-[#d8dee8] bg-white/95 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <MobileNav />
              <div className="hidden items-center gap-2 rounded-md border border-[#d8dee8] bg-[#f8fafc] px-3 py-1.5 text-xs text-[#475467] sm:flex">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="max-w-64 truncate">Document: {selectedDocumentId || 'none selected'}</span>
              </div>
              <div className="hidden items-center gap-2 rounded-md border border-[#d8dee8] bg-[#f8fafc] px-3 py-1.5 text-xs text-[#475467] sm:flex">
                <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="max-w-64 truncate">Workflow: {selectedWorkflowId || 'none selected'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#667085]" aria-hidden="true" />
              <TextInput
                className="w-44"
                aria-label="Reviewer ID"
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
              />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function MobileNav() {
  return (
    <div className="flex gap-1 lg:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8dee8] bg-white text-[#344054]',
              isActive && 'border-[#1f6feb] bg-[#e8f1ff] text-[#175cd3]',
            )
          }
          title={item.label}
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
        </NavLink>
      ))}
    </div>
  )
}
