import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '../utils'

export type WorkflowStage = 'semantic' | 'atomic' | 'test-cases' | 'bdd' | 'test-scripts'

const stages = [
  { id: 'semantic', label: 'Semantic Rule', group: 'Business Analysis' },
  { id: 'atomic', label: 'Atomic Rule', group: 'Business Analysis' },
  { id: 'test-cases', label: 'Test Case', group: '' },
  { id: 'bdd', label: 'BDD', group: '' },
  { id: 'test-scripts', label: 'Test Script', group: '' },
] satisfies Array<{ id: WorkflowStage; label: string; group: string }>

export function WorkflowStagePipeline({ workflowId, activeStage }: { workflowId: string; activeStage: WorkflowStage }) {
  const activeIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === activeStage),
  )
  const progressRatio = activeIndex / Math.max(1, stages.length - 1)

  return (
    <nav className="overflow-x-auto rounded-lg border border-[#d8dee8] bg-white px-4 py-3 shadow-sm" aria-label="Workflow stages">
      <div className="relative mx-auto min-w-[520px] max-w-3xl px-2">
        {/* Track background */}
        <div
          className="absolute left-[10%] right-[10%] top-[1.375rem] h-1.5 -translate-y-1/2 rounded-full bg-[#edf2f7]"
          aria-hidden="true"
        />
        {/* Track fill */}
        <div
          className="absolute left-[10%] top-[1.375rem] h-1.5 -translate-y-1/2 rounded-full bg-[#0b65a8] transition-all duration-300"
          style={{ width: `calc(80% * ${progressRatio})` }}
          aria-hidden="true"
        />
        <ol className="relative z-10 grid" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
        {stages.map((stage, index) => {
          const isActive = stage.id === activeStage
          const isComplete = index < activeIndex
          const isReached = index <= activeIndex
          // BDD and test-scripts routes don't exist yet — link to test-cases as placeholder
          const href = stage.id === 'bdd' || stage.id === 'test-scripts'
            ? `/workflows/${encodeURIComponent(workflowId)}/test-cases`
            : `/workflows/${encodeURIComponent(workflowId)}/${stage.id}`

          return (
            <li key={stage.id} className="min-w-0">
              <Link
                to={href}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'group flex min-w-0 flex-col items-center text-center outline-none transition',
                  'focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-[#0b65a8] focus-visible:ring-offset-4',
                )}
              >
                <span
                  className={cn(
                    'h-4 max-w-full truncate text-xs font-semibold uppercase leading-4 transition-colors',
                    isReached ? 'text-[#0b65a8]' : 'text-[#475467] group-hover:text-[#0b65a8]',
                  )}
                >
                  {stage.label}
                </span>
                <span
                  className={cn(
                    'mt-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    isComplete && 'border-[#0b65a8] bg-[#0b65a8] text-white',
                    isActive && 'border-[#0b65a8] bg-[#0b65a8] text-white shadow-[0_0_0_3px_rgba(11,101,168,0.12)]',
                    !isReached && 'border-[#edf2f7] bg-[#edf2f7] text-transparent group-hover:border-[#c9d8e5]',
                  )}
                  aria-hidden="true"
                >
                  {isComplete ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                  {isActive ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      </div>
    </nav>
  )
}
