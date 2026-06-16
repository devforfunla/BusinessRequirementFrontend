import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FileCode2,
  History,
  Layers,
  RefreshCw,
  TestTube2,
} from 'lucide-react'
import {
  atomicMakerApi,
  atomicRulesApi,
  getErrorMessage,
  isJobRunning,
  jobsApi,
  normalizeJobStatus,
  semanticRulesApi,
  workflowsApi,
  type AsyncJob,
  type AtomicRule,
  type ExtractionGroup,
  type SemanticRule,
} from '../api'
import { WorkflowStagePipeline, type WorkflowStage } from '../components/WorkflowStagePipeline'
import { Button, ErrorNotice, PageTitle, Panel, PanelHeader, StatusPill } from '../components/ui'
import { useAppStore } from '../store'
import { cn, formatDate } from '../utils'
import { deriveStageStatus, latestJob, latestStageJob } from '../workflowJobUtils'

type StageCardDef = {
  id: WorkflowStage
  label: string
  icon: React.ReactNode
  href: (workflowId: string) => string
  jobTypes: string[]
  group?: string
}

const stageCards: StageCardDef[] = [
  {
    id: 'semantic',
    label: 'Semantic Rule',
    icon: <Layers className="h-5 w-5" />,
    href: (wid) => `/workflows/${encodeURIComponent(wid)}/semantic`,
    jobTypes: ['SEMANTIC_MAKER', 'SEMANTIC_CHECKER', 'SEMANTIC_REWRITE', 'SEMANTIC_EDIT'],
    group: 'Business Analysis',
  },
  {
    id: 'atomic',
    label: 'Atomic Rule',
    icon: <ClipboardCheck className="h-5 w-5" />,
    href: (wid) => `/workflows/${encodeURIComponent(wid)}/atomic`,
    jobTypes: ['ATOMIC_MAKER', 'ATOMIC_CHECKER', 'ATOMIC_REWRITE', 'ATOMIC_REWRITE_CHECKER_FEEDBACK', 'ATOMIC_REWRITE_HUMAN_FEEDBACK', 'EDIT'],
    group: 'Business Analysis',
  },
  {
    id: 'test-cases',
    label: 'Test Case',
    icon: <TestTube2 className="h-5 w-5" />,
    href: (wid) => `/workflows/${encodeURIComponent(wid)}/test-cases`,
    jobTypes: ['TEST_CASE_GENERATION', 'TEST_CASE_CHECKER'],
  },
  {
    id: 'bdd',
    label: 'BDD',
    icon: <FileCode2 className="h-5 w-5" />,
    href: (wid) => `/workflows/${encodeURIComponent(wid)}/bdd`,
    jobTypes: ['BDD_GENERATION'],
  },
  {
    id: 'test-scripts',
    label: 'Test Script',
    icon: <Code2 className="h-5 w-5" />,
    href: (wid) => `/workflows/${encodeURIComponent(wid)}/bdd`,
    jobTypes: ['TEST_SCRIPT_MAKER'],
  },
]

export function WorkflowOverviewPage() {
  const { workflowId = '' } = useParams()
  const queryClient = useQueryClient()
  const setWorkflowId = useAppStore((s) => s.setWorkflowId)
  const setDocumentId = useAppStore((s) => s.setDocumentId)

  useEffect(() => {
    if (workflowId) setWorkflowId(workflowId)
  }, [setWorkflowId, workflowId])

  const workflowQuery = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowsApi.get(workflowId),
    enabled: Boolean(workflowId),
  })

  useEffect(() => {
    if (workflowQuery.data?.documentId) setDocumentId(workflowQuery.data.documentId)
  }, [setDocumentId, workflowQuery.data?.documentId])

  const jobsQuery = useQuery({
    queryKey: ['workflow-jobs-unified', workflowId],
    queryFn: () => jobsApi.listUnifiedByWorkflow(workflowId),
    enabled: Boolean(workflowId),
    refetchInterval: (query) => {
      const jobs = query.state.data as AsyncJob[] | undefined
      return jobs?.some((j) => isJobRunning(j.status)) ? 2000 : 5000
    },
  })

  const semanticRulesQuery = useQuery({
    queryKey: ['semantic-rules', workflowId],
    queryFn: () => semanticRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const atomicRulesQuery = useQuery({
    queryKey: ['atomic-rules', workflowId],
    queryFn: () => atomicRulesApi.byWorkflow(workflowId),
    enabled: Boolean(workflowId),
  })

  const extractionGroupsQuery = useQuery({
    queryKey: ['extraction-groups', workflowId],
    queryFn: () => atomicMakerApi.extractionGroups(workflowId),
    enabled: Boolean(workflowId),
  })

  const workflow = workflowQuery.data
  const jobs = jobsQuery.data || []
  const semanticRules = semanticRulesQuery.data || []
  const atomicRules = atomicRulesQuery.data || []
  const extractionGroups = extractionGroupsQuery.data || []
  const firstError = workflowQuery.error || jobsQuery.error || extractionGroupsQuery.error

  // Determine active stage based on which jobs exist
  const activeStage = resolveActiveStage(jobs)

  return (
    <div className="space-y-5">
      <PageTitle
        title="Workflow Dashboard"
        description={workflowId}
        actions={
          <>
            <Link
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#c8d0dc] bg-white px-3 text-sm font-medium text-[#172033] hover:bg-[#eef2f7]"
              to={`/workflows/${encodeURIComponent(workflowId)}/history`}
            >
              <History className="h-4 w-4" aria-hidden="true" />
              History
            </Link>
            <Button onClick={() => void queryClient.invalidateQueries()} disabled={workflowQuery.isFetching}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <WorkflowStagePipeline workflowId={workflowId} activeStage={activeStage} />
      {firstError ? <ErrorNotice message={getErrorMessage(firstError)} /> : null}

      {/* Workflow info */}
      {workflow ? (
        <Panel>
          <PanelHeader title="Workflow Info" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Status" value={<StatusPill value={workflow.status} />} />
            <InfoItem label="Document" value={workflow.documentId} />
            <InfoItem label="Created" value={formatDate(workflow.createdAt)} />
            <InfoItem label="Updated" value={formatDate(workflow.updatedAt)} />
          </div>
        </Panel>
      ) : null}

      {/* Stage cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {stageCards.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            workflowId={workflowId}
            jobs={jobs}
            semanticRules={semanticRules}
            atomicRules={atomicRules}
            extractionGroups={extractionGroups}
          />
        ))}
      </div>
    </div>
  )
}

function StageCard({
  stage,
  workflowId,
  jobs,
  semanticRules,
  atomicRules,
  extractionGroups,
}: {
  stage: StageCardDef
  workflowId: string
  jobs: AsyncJob[]
  semanticRules: SemanticRule[]
  atomicRules: AtomicRule[]
  extractionGroups: ExtractionGroup[]
}) {
  const stageJobs = jobs.filter((j) => stage.jobTypes.includes(j.jobType))
  const hasJobs = stageJobs.length > 0
  const latestActivity = latestStageJob(stageJobs)
  const stageStatus = deriveStageStatus(stageJobs)
  const stepJobs = buildStepJobs(stage, stageJobs)
  const atomicExtractionSummary = stage.id === 'atomic'
    ? summarizeLatestAtomicExtractionGroups(stageJobs, extractionGroups)
    : null

  // Compute stage-specific stats
  let ruleCount = 0
  let approvedCount = 0
  if (stage.id === 'semantic') {
    ruleCount = semanticRules.length
    approvedCount = semanticRules.filter((r) => r.approvalStatus === 'APPROVED').length
  } else if (stage.id === 'atomic') {
    ruleCount = atomicRules.length
    approvedCount = atomicRules.filter((r) => r.status === 'APPROVED').length
  }

  return (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-[#e3e8f0] px-4 py-3">
        <span className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          hasJobs ? 'bg-[#eff6ff] text-[#175cd3]' : 'bg-[#f8fafc] text-[#98a2b3]',
        )}>
          {stage.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#172033]">{stage.label}</h3>
          {stage.group ? (
            <p className="text-xs text-[#667085]">{stage.group}</p>
          ) : null}
        </div>
        <StatusPill value={stageStatus} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Stats */}
        {(stage.id === 'semantic' || stage.id === 'atomic') && ruleCount > 0 ? (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="rounded bg-[#f0f5ff] px-2 py-0.5 text-[#175cd3]">
              {ruleCount} rules
            </span>
            <span className={cn(
              'rounded px-2 py-0.5',
              approvedCount === ruleCount
                ? 'bg-[#ecfdf3] text-[#079455]'
                : 'bg-[#fffbeb] text-[#b54708]',
            )}>
              {approvedCount}/{ruleCount} approved
            </span>
          </div>
        ) : null}

        {/* Job summary */}
        <div className="flex flex-wrap gap-2 text-xs text-[#667085]">
          <span>{stageJobs.length} job{stageJobs.length !== 1 ? 's' : ''}</span>
          {latestActivity ? (
            <span>Last: {formatDate(latestActivity.updatedAt || latestActivity.createdAt)}</span>
          ) : null}
          {atomicExtractionSummary ? (
            <Link
              to={`/workflows/${encodeURIComponent(workflowId)}/atomic?tab=maker#extraction-groups`}
              className={cn(
                'inline-flex rounded px-2 py-0.5 font-medium hover:underline',
                atomicExtractionSummary.failed > 0
                  ? 'bg-[#fff1f0] text-[#b42318]'
                  : 'bg-[#ecfdf3] text-[#079455]',
              )}
            >
              {atomicExtractionSummary.failed > 0
                ? `${atomicExtractionSummary.failed}/${atomicExtractionSummary.total} groups failed`
                : `${atomicExtractionSummary.succeeded}/${atomicExtractionSummary.total} groups succeeded`}
            </Link>
          ) : null}
        </div>

        {!hasJobs ? (
          <p className="text-sm text-[#98a2b3]">No jobs run yet</p>
        ) : null}

        {/* Steps mini-pipeline */}
        {hasJobs ? (
          <div className="flex items-center gap-1 text-xs">
            {stepJobs.map((step, index) => (
              <span key={step.label} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="text-[#c8d0dc]">&rarr;</span> : null}
                <StepDot label={step.label} job={step.job} />
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#e3e8f0] px-4 py-2.5">
        <Link
          to={stage.href(workflowId)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#175cd3] hover:underline"
        >
          Open Stage
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Panel>
  )
}

function StepDot({ label, job }: { label: string; job?: AsyncJob | null }) {
  const status = normalizeJobStatus(job?.status)
  const color = !job
    ? 'bg-[#e3e8f0] text-[#98a2b3]'
    : status === 'SUCCEEDED'
      ? 'bg-[#ecfdf3] text-[#079455]'
      : status === 'FAILED'
        ? 'bg-[#fff1f0] text-[#b42318]'
        : status === 'PARTIAL_SUCCESS'
          ? 'bg-[#fffbeb] text-[#b54708]'
          : isJobRunning(status)
            ? 'bg-[#eff6ff] text-[#175cd3]'
            : 'bg-[#f8fafc] text-[#475467]'

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', color)}>
      {status === 'SUCCEEDED' ? <CheckCircle2 className="h-3 w-3" /> : null}
      {label}
    </span>
  )
}

function buildStepJobs(stage: StageCardDef, stageJobs: AsyncJob[]) {
  const steps = [{ label: 'Maker', job: latestJob(stageJobs, stage.jobTypes[0]) }]
  if (stage.jobTypes[1]) {
    steps.push({ label: 'Checker', job: latestJob(stageJobs, stage.jobTypes[1]) })
  }
  const reviewJobTypes = stage.jobTypes.slice(2)
  if (reviewJobTypes.length > 0) {
    steps.push({
      label: 'Review',
      job: reviewJobTypes.map((jobType) => latestJob(stageJobs, jobType)).find(Boolean) || null,
    })
  }
  return steps
}

function summarizeLatestAtomicExtractionGroups(stageJobs: AsyncJob[], extractionGroups: ExtractionGroup[]) {
  const latestMakerJob = latestJob(stageJobs, 'ATOMIC_MAKER')
  if (!latestMakerJob) return null

  const groups = extractionGroups.filter((group) => group.jobId === latestMakerJob.id)
  if (groups.length === 0) return null

  const failed = groups.filter((group) => group.status === 'FAILED').length
  const succeeded = groups.filter((group) => group.status === 'SUCCEEDED').length
  return {
    total: groups.length,
    succeeded,
    failed,
  }
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[#667085]">{label}</p>
      <div className="mt-1 text-sm text-[#172033]">{value || '-'}</div>
    </div>
  )
}

function resolveActiveStage(jobs: AsyncJob[]): WorkflowStage {
  const jobTypes = new Set(jobs.map((j) => j.jobType))
  if (jobTypes.has('TEST_SCRIPT_MAKER')) return 'test-scripts'
  if (jobTypes.has('BDD_GENERATION')) return 'bdd'
  if (jobTypes.has('TEST_CASE_GENERATION') || jobTypes.has('TEST_CASE_CHECKER')) return 'test-cases'
  if (jobTypes.has('ATOMIC_MAKER') || jobTypes.has('ATOMIC_CHECKER') || jobTypes.has('ATOMIC_REWRITE') || jobTypes.has('ATOMIC_REWRITE_CHECKER_FEEDBACK') || jobTypes.has('ATOMIC_REWRITE_HUMAN_FEEDBACK') || jobTypes.has('EDIT')) return 'atomic'
  return 'semantic'
}
