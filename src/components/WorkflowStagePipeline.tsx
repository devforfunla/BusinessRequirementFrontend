import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, GitBranch, ListChecks } from 'lucide-react'
import { cn } from '../utils'

export type WorkflowStage = 'semantic' | 'atomic' | 'test-cases'

const stages = [
  { id: 'semantic', label: 'Semantic Rule', icon: GitBranch },
  { id: 'atomic', label: 'Atomic Rule', icon: ListChecks },
  { id: 'test-cases', label: 'Test Cases', icon: ClipboardCheck },
] satisfies Array<{ id: WorkflowStage; label: string; icon: typeof GitBranch }>

export function WorkflowStagePipeline({ workflowId, activeStage }: { workflowId: string; activeStage: WorkflowStage }) {
  return (
    <nav className="rounded-lg border border-[#d8dee8] bg-white px-4 py-4 shadow-sm" aria-label="Workflow stages">
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {stages.map((stage, index) => {
          const isActive = stage.id === activeStage
          return (
            <li key={stage.id} className="contents">
              <Link
                to={`/workflows/${encodeURIComponent(workflowId)}/${stage.id}`}
                className={cn(
                  'group flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-md border px-3 py-2 transition',
                  isActive
                    ? 'border-[#1f6feb] bg-[#e8f1ff] text-[#175cd3] shadow-sm'
                    : 'border-[#e3e8f0] bg-[#f8fafc] text-[#344054] hover:border-[#b9c7da] hover:bg-[#f1f5f9]',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isActive ? 'border-[#1f6feb] bg-white' : 'border-[#c8d0dc] bg-white text-[#667085]',
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <stage.icon className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate">{stage.label}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-[#667085]">{isActive ? 'Current stage' : 'Open stage'}</span>
                </span>
                {isActive ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              </Link>
              {index < stages.length - 1 ? (
                <span className="flex items-center justify-center text-[#98a2b3]" aria-hidden="true">
                  <ChevronDown className="h-5 w-5 md:hidden" />
                  <ChevronRight className="hidden h-5 w-5 md:block" />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
