import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../store'
import {
  tcgApi,
  workflowsApi,
  semanticRulesApi,
  atomicRulesApi,
  skillsApi,
  jobsApi,
} from '../api'
import type {
  Skill as ApiSkill,
  SemanticRule as ApiSemanticRule,
  AtomicRule as ApiAtomicRule,
  TcgTestIntent,
  TcgGeneratedTestCase,
  GeneratedBddScenario,
  AsyncJob,
} from '../api'
import '../../review-workbench/src/styles.css'

// Override app-shell to work within main AppShell layout
const reviewWorkbenchStyles = `
.rw-app-shell { min-height: auto; padding: 0; }
.rw-app-shell > .tabs { margin-top: 0; }
.rw-app-shell .workflow-summary { border-radius: 8px; background: white; padding: 16px; margin-bottom: 16px; border: 1px solid #e3e8f0; }
.rw-app-shell .job-strip { border-radius: 8px; background: white; padding: 16px; margin-bottom: 16px; border: 1px solid #e3e8f0; }
.rw-app-shell .workspace { display: flex; gap: 16px; min-height: 400px; }
.rw-app-shell .three-column-layout { display: grid; grid-template-columns: 280px 1fr 300px; gap: 16px; height: 100%; }
.rw-app-shell .panel { background: white; border-radius: 8px; border: 1px solid #e3e8f0; overflow: hidden; }
.rw-app-shell .panel-heading { padding: 12px 16px; border-bottom: 1px solid #e3e8f0; display: flex; align-items: center; justify-content: space-between; }
.rw-app-shell .panel-title { font-weight: 600; font-size: 13px; color: #172033; }
.rw-app-shell .panel-meta { font-size: 11px; color: #667085; background: #f2f4f7; padding: 2px 8px; border-radius: 10px; }
.rw-app-shell .panel-body { padding: 12px; }
.rw-app-shell .artifact-list { display: flex; flex-direction: column; gap: 4px; max-height: 500px; overflow-y: auto; }
.rw-app-shell .artifact-button { width: 100%; text-align: left; padding: 8px 12px; border: 1px solid transparent; border-radius: 6px; background: none; font-size: 13px; cursor: pointer; transition: all 0.15s; }
.rw-app-shell .artifact-button:hover { background: #f8fafc; border-color: #e3e8f0; }
.rw-appshell .artifact-button.active { background: #eff6ff; border-color: #bfdbfe; }
.rw-app-shell .artifact-button-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rw-app-shell .artifact-button-heading strong { font-size: 13px; color: #172033; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rw-app-shell .artifact-button span { font-size: 11px; color: #667085; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.rw-app-shell .inspect-label { font-size: 10px; color: #98a2b3; float: right; }
.rw-app-shell .detail-panel { background: white; border-radius: 8px; border: 1px solid #e3e8f0; padding: 20px; overflow-y: auto; max-height: 600px; }
.rw-app-shell .detail-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.rw-app-shell .detail-heading h2 { font-size: 16px; margin: 0; }
.rw-app-shell .eyebrow { font-size: 11px; color: #667085; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px; }
.rw-app-shell .field-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin-bottom: 16px; }
.rw-app-shell .field dt { font-size: 12px; color: #667085; }
.rw-app-shell .field dd { font-size: 13px; color: #172033; }
.rw-app-shell .readable-section { margin-bottom: 16px; }
.rw-app-shell .readable-section h3 { font-size: 13px; font-weight: 600; margin: 0 0 6px 0; color: #344054; }
.rw-app-shell .readable-content { font-size: 13px; line-height: 1.5; color: #475467; white-space: pre-wrap; word-break: break-word; background: #f8fafc; padding: 12px; border-radius: 6px; }
.rw-app-shell .json-block { font-family: 'Fira Code', monospace; font-size: 12px; line-height: 1.5; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
.rw-app-shell .empty-state, .rw-app-shell .center-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center; color: #667085; }
.rw-app-shell .empty-state strong, .rw-app-shell .center-state strong { color: #344054; font-size: 16px; }
.rw-app-shell .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.rw-app-shell .tone-positive { background: #ecfdf3; color: #079455; }
.rw-app-shell .tone-active { background: #eff6ff; color: #175cd3; }
.rw-app-shell .tone-warning { background: #fffbeb; color: #b54708; }
.rw-app-shell .tone-negative { background: #fef2f2; color: #b42318; }
.rw-app-shell .tone-neutral { background: #f2f4f7; color: #475467; }
.rw-app-shell .request-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
.rw-app-shell .request-error strong { color: #b42318; }
.rw-app-shell .action-message { background: #ecfdf3; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
.rw-app-shell .action-message strong { color: #079455; }
.rw-app-shell .metric { text-align: center; }
.rw-app-shell .metric-value { display: block; font-size: 24px; font-weight: 700; color: #172033; }
.rw-app-shell .metric-label { font-size: 12px; color: #667085; }
.rw-app-shell .summary-metrics { display: flex; gap: 24px; flex-wrap: wrap; }
.rw-app-shell .refresh-state { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #667085; }
.rw-app-shell .job-strip-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.rw-app-shell .job-list { display: flex; flex-direction: column; gap: 8px; }
.rw-app-shell .job-card { background: #f8fafc; border: 1px solid #e3e8f0; border-radius: 6px; padding: 12px; display: flex; align-items: center; gap: 12px; font-size: 12px; }
.rw-app-shell .job-error { color: #b42318; font-size: 11px; margin-top: 4px; }
.rw-app-shell .quiet { color: #98a2b3; font-style: italic; }
.rw-app-shell .skills-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
.rw-app-shell .skill-chain { display: flex; flex-direction: column; gap: 12px; }
.rw-app-shell .skill-card { background: white; border: 1px solid #e3e8f0; border-radius: 8px; padding: 16px; display: flex; gap: 12px; }
.rw-app-shell .skill-order { width: 28px; height: 28px; border-radius: 50%; background: #eff6ff; color: #175cd3; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
.rw-app-shell .skill-card h3 { font-size: 14px; margin: 0 0 4px 0; }
.rw-app-shell .skill-card p { font-size: 12px; color: #667085; margin: 0 0 8px 0; }
.rw-app-shell .compact-definitions { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 12px; }
.rw-app-shell .compact-definitions dt { color: #667085; }
.rw-app-shell .boundary-grid { display: flex; flex-direction: column; gap: 12px; }
.rw-app-shell .callout { padding: 12px; border-radius: 6px; font-size: 12px; }
.rw-app-shell .callout.tone-neutral { background: #f8fafc; border: 1px solid #e3e8f0; }
.rw-app-shell .callout.tone-warning { background: #fffbeb; border: 1px solid #fde68a; }
.rw-app-shell .callout strong { display: block; margin-bottom: 4px; }
.rw-app-shell .linked-card { background: #f8fafc; border: 1px solid #e3e8f0; border-radius: 6px; padding: 12px; }
.rw-app-shell .linked-card-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.rw-app-shell .stack { display: flex; flex-direction: column; gap: 12px; }
.rw-app-shell .action-row { margin-top: 8px; }
.rw-app-shell .action-row button { background: #175cd3; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 500; font-size: 13px; cursor: pointer; }
.rw-app-shell .action-row button:hover { background: #1557c2; }
.rw-app-shell .action-row button:disabled { opacity: 0.5; cursor: not-allowed; }
.rw-app-shell .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rw-app-shell .tabs { display: flex; gap: 4px; border-bottom: 2px solid #e3e8f0; padding: 0; margin-bottom: 16px; }
.rw-app-shell .tab { padding: 10px 18px; border: none; background: none; font-size: 13px; font-weight: 500; color: #667085; cursor: pointer; position: relative; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.rw-app-shell .tab:hover { color: #344054; background: rgba(31, 94, 191, 0.04); }
.rw-app-shell .tab.active { color: #175cd3; border-bottom-color: #175cd3; }
.rw-app-shell .tab-count { background: #e3e8f0; color: #475467; font-size: 11px; padding: 1px 7px; border-radius: 10px; margin-left: 6px; }
.rw-app-shell .unavailable-label { font-size: 10px; color: #d0d5dd; margin-left: 6px; }
.rw-app-shell .spinner { width: 24px; height: 24px; border: 3px solid #e3e8f0; border-top-color: #175cd3; border-radius: 50%; animation: rw-spin 0.8s linear infinite; margin-bottom: 12px; }
@keyframes rw-spin { to { transform: rotate(360deg); } }
@media (max-width: 1024px) {
  .rw-app-shell .skills-layout { grid-template-columns: 1fr; }
  .rw-app-shell .three-column-layout { grid-template-columns: 1fr; }
}
`

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('rw-styles')) {
  const style = document.createElement('style')
  style.id = 'rw-styles'
  style.textContent = reviewWorkbenchStyles
  document.head.appendChild(style)
}

// Types matching review-workbench expectations
interface Workflow {
  id: string
  documentId: string
  status: string
  currentStage?: string | null
}

interface ReviewSemanticRule {
  id: string
  llmSemanticRuleCode: string
  workflowId: string
  documentId: string
  llmBusinessIntent?: string | null
  llmSummary?: string | null
  llmSection?: string | null
  llmOutputJson?: string | null
  approvalStatus: string
  semanticVersion: number
  changeType: string
  isLatest: boolean
  createdAt: string
  updatedAt: string
}

interface ReviewAtomicRule {
  id: string
  semanticRuleId: string
  llmSemanticRuleCode: string
  llmAtomicRuleCode: string
  llmRuleType: string
  llmSubtype?: string | null
  llmSummary: string
  llmOutputJson?: string | null
  llmSection: string
  workflowId: string
  atomicVersion: number
  changeType: string
  isLatest: boolean
  status: string
  createdAt: string
  updatedAt: string
}

interface ReviewTestIntent {
  id: string
  testIntentId: string
  workflowId: string
  generationJobId: string
  businessCapabilityId?: string | null
  testLevel: string
  intentType: string
  readinessStatus: string
  blockedReason?: string | null
  sourceRules?: string | null
  intentJson: string
  createdAt: string
}

interface ReviewGeneratedTestCase {
  id: string
  testCaseId: string
  versionNumber: number
  isLatest: boolean
  changeType: string
  parentVersionId?: string | null
  revisionJobId?: string | null
  workflowId: string
  atomicRuleId: string
  ruleId: string
  sourceVersionNumber: number
  semanticRuleId: string
  testIntentId?: string | null
  generationJobId: string
  title: string
  scenarioType: string
  priority: string
  preconditions?: string | null
  steps?: string | null
  expectedResults?: string | null
  dependencyTraceability?: string | null
  assumptions?: string | null
  unsupportedInferences?: string | null
  openQuestions?: string | null
  normalizedTestCaseJson?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface ReviewBddScenario {
  id: string
  workflowId: string
  generatedTestCaseId: string
  atomicRuleId: string
  ruleId: string
  sourceVersionNumber: number
  generationJobId: string
  featureTitle: string
  scenarioTitle: string
  normalizedBdd: string
  gherkinText: string
  assumptions?: string | null
  traceability?: string | null
  staleAt?: string | null
  staleReason?: string | null
  supersededByTestCaseVersionId?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface ReviewSkill {
  id: string
  name: string
  displayName?: string | null
  description?: string | null
  category: string
  workflowStage: string
  version: number
  status: string
  changeLog?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  // Extended fields for skill chain display
  stageLabel?: string
  registryId?: string
  versionLabel?: string
}

interface WorkflowBundle {
  workflow: Workflow
  semanticRules: ReviewSemanticRule[]
  atomicRules: ReviewAtomicRule[]
  testIntents: ReviewTestIntent[]
  testCases: ReviewGeneratedTestCase[]
  bddScenarios: ReviewBddScenario[]
  jobs: AsyncJob[]
  skills: ReviewSkill[]
}

// Utility functions (adapted from review-workbench/utils.ts)
function isActiveJobStatus(status?: string | null): boolean {
  return status === 'QUEUED' || status === 'RUNNING'
}

function statusTone(status?: string | null): 'positive' | 'active' | 'warning' | 'negative' | 'neutral' {
  switch (status) {
    case 'APPROVED':
    case 'READY':
    case 'SUCCEEDED':
    case 'VERIFIED':
    case 'PASS':
    case 'HIGH':
      return 'positive'
    case 'QUEUED':
    case 'RUNNING':
      return 'active'
    case 'DRAFT':
    case 'REOPENED':
    case 'PARTIAL_SUCCESS':
    case 'MEDIUM':
      return 'warning'
    case 'FAILED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'STALE':
    case 'LOW':
      return 'negative'
    default:
      return 'neutral'
  }
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id
}

function sortNewest<T extends { updatedAt?: string; createdAt?: string }>(values: T[]): T[] {
  return [...values].sort((left, right) => {
    const leftValue = left.updatedAt ?? left.createdAt ?? ''
    const rightValue = right.updatedAt ?? right.createdAt ?? ''
    return rightValue.localeCompare(leftValue)
  })
}

function isCurrentBddScenario(scenario: { status?: string | null; staleAt?: string | null }): boolean {
  return scenario.status !== 'STALE' && scenario.status !== 'ARCHIVED' && !scenario.staleAt
}

function currentBddScenarios<T extends { status?: string | null; staleAt?: string | null }>(values: T[]): T[] {
  return values.filter(isCurrentBddScenario)
}

function preserveSelection<T extends { id: string }>(current: string | null, items: T[]): string | null {
  if (!current) return null
  return items.some((item) => item.id === current) ? current : null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function tcgSkillChain(skills: ReviewSkill[]): ReviewSkill[] {
  return skills.map((skill) => ({
    ...skill,
    stageLabel: humanize(skill.workflowStage),
    registryId: skill.id,
    versionLabel: `v${skill.version}`,
  }))
}

const stageTwoJobTypes = new Set(['TEST_CASE_GENERATION', 'TEST_CASE_CHECKER', 'BDD_GENERATION'])

type TabId = 'skills' | 'rules' | 'intents' | 'cases' | 'bdd' | 'scripts'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'skills', label: 'Skills' },
  { id: 'rules', label: 'Rules' },
  { id: 'intents', label: 'Test Intents' },
  { id: 'cases', label: 'Test Cases' },
  { id: 'bdd', label: 'BDD Drafts' },
  { id: 'scripts', label: 'Scripts' },
]

export function ReviewWorkbenchPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const reviewerId = useAppStore((state) => state.reviewerId)

  const [bundle, setBundle] = useState<WorkflowBundle | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('skills')
  const [selectedSemanticId, setSelectedSemanticId] = useState<string | null>(null)
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedBddId, setSelectedBddId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const requestSequence = useRef(0)

  const loadData = useCallback(
    async (id: string, background = false) => {
      const requestId = ++requestSequence.current
      if (background) {
        setRefreshing(true)
      } else {
        setLoading(true)
        setBundle(null)
      }
      setError(null)

      try {
        const [workflow, semanticRules, atomicRules, testIntents, testCases, bddScenarios, jobs, skills] =
          await Promise.all([
            workflowsApi.get(id).then((w) => ({
              id: w.id,
              documentId: w.documentId,
              status: w.status,
              currentStage: w.currentStage,
            })),
            semanticRulesApi.byWorkflow(id).then((rules) =>
              rules.map((r) => ({
                id: r.id,
                llmSemanticRuleCode: r.llmSemanticRuleCode ?? r.semanticRuleCode ?? '',
                workflowId: r.workflowId,
                documentId: '',
                llmBusinessIntent: r.llmBusinessIntent ?? null,
                llmSummary: r.llmSummary ?? null,
                llmSection: r.llmSection ?? null,
                llmOutputJson: r.llmOutputJson ?? null,
                approvalStatus: r.approvalStatus,
                semanticVersion: r.semanticVersion ?? 1,
                changeType: r.changeType ?? '',
                isLatest: true,
                createdAt: r.createdAt ?? '',
                updatedAt: r.updatedAt ?? '',
              }))
            ),
            atomicRulesApi.byWorkflow(id).then((rules) =>
              rules.map((r) => ({
                id: r.id,
                semanticRuleId: r.semanticRuleId ?? '',
                llmSemanticRuleCode: r.llmSemanticRuleCode ?? r.semanticRuleCode ?? '',
                llmAtomicRuleCode: r.llmAtomicRuleCode ?? r.atomicRuleCode ?? '',
                llmRuleType: r.llmRuleType ?? '',
                llmSubtype: (r as Record<string, unknown>).llmSubtype as string | undefined,
                llmSummary: r.llmSummary ?? '',
                llmOutputJson: r.llmOutputJson ?? null,
                llmSection: r.llmSection ?? '',
                workflowId: r.workflowId,
                atomicVersion: r.atomicVersion ?? 1,
                changeType: r.changeType ?? '',
                isLatest: r.isLatest ?? true,
                status: r.status,
                createdAt: r.createdAt ?? '',
                updatedAt: r.updatedAt ?? '',
              }))
            ),
            tcgApi.testIntentsByWorkflow(id).then((intents) =>
              intents.map((i) => ({
                id: i.id,
                testIntentId: i.testIntentId,
                workflowId: i.workflowId,
                generationJobId: i.generationJobId,
                businessCapabilityId: i.businessCapabilityId ?? null,
                testLevel: i.testLevel,
                intentType: i.intentType,
                readinessStatus: i.readinessStatus,
                blockedReason: i.blockedReason ?? null,
                sourceRules: i.sourceRules ?? null,
                intentJson: i.intentJson,
                createdAt: i.createdAt ?? '',
              }))
            ),
            tcgApi.testCasesByWorkflow(id).then((cases) =>
              cases.map((c) => ({
                id: c.id,
                testCaseId: c.testCaseId,
                versionNumber: c.versionNumber,
                isLatest: c.isLatest,
                changeType: c.changeType,
                parentVersionId: c.parentVersionId ?? null,
                revisionJobId: c.revisionJobId ?? null,
                workflowId: c.workflowId,
                atomicRuleId: c.atomicRuleId,
                ruleId: c.ruleId,
                sourceVersionNumber: c.sourceVersionNumber,
                semanticRuleId: c.semanticRuleId,
                testIntentId: c.testIntentId ?? null,
                generationJobId: c.generationJobId,
                title: c.title,
                scenarioType: c.scenarioType,
                priority: c.priority,
                preconditions: c.preconditions ?? null,
                steps: c.steps ?? null,
                expectedResults: c.expectedResults ?? null,
                dependencyTraceability: c.dependencyTraceability ?? null,
                assumptions: c.assumptions ?? null,
                unsupportedInferences: c.unsupportedInferences ?? null,
                openQuestions: c.openQuestions ?? null,
                normalizedTestCaseJson: c.normalizedTestCaseJson ?? null,
                status: c.status,
                createdAt: c.createdAt ?? '',
                updatedAt: c.updatedAt ?? '',
              }))
            ),
            tcgApi.bddScenariosByWorkflow(id).then((scenarios) =>
              scenarios.map((s) => ({
                id: s.id,
                workflowId: s.workflowId,
                generatedTestCaseId: s.generatedTestCaseId,
                atomicRuleId: s.atomicRuleId,
                ruleId: s.ruleId,
                sourceVersionNumber: s.sourceVersionNumber,
                generationJobId: s.generationJobId,
                featureTitle: s.featureTitle,
                scenarioTitle: s.scenarioTitle,
                normalizedBdd: s.normalizedBdd,
                gherkinText: s.gherkinText,
                assumptions: s.assumptions ?? null,
                traceability: s.traceability ?? null,
                staleAt: s.staleAt ?? null,
                staleReason: s.staleReason ?? null,
                supersededByTestCaseVersionId: s.supersededByTestCaseVersionId ?? null,
                status: s.status,
                createdAt: s.createdAt ?? '',
                updatedAt: s.updatedAt ?? '',
              }))
            ),
            jobsApi.listByWorkflow(id),
            skillsApi.list().then((skills) =>
              skills.map((s) => ({
                id: s.id,
                name: s.name,
                displayName: s.displayName ?? null,
                description: s.description ?? null,
                category: s.category,
                workflowStage: s.workflowStage,
                version: s.version,
                status: s.status,
                changeLog: s.changeLog ?? null,
                createdAt: s.createdAt ?? null,
                updatedAt: s.updatedAt ?? null,
              }))
            ),
          ])

        if (requestId !== requestSequence.current) return

        const nextBundle: WorkflowBundle = { workflow, semanticRules, atomicRules, testIntents, testCases, bddScenarios, jobs, skills }
        setBundle(nextBundle)
        setLastUpdated(new Date())
        setSelectedSemanticId((current) => preserveSelection(current, nextBundle.semanticRules))
        setSelectedIntentId((current) => preserveSelection(current, nextBundle.testIntents))
        setSelectedCaseId((current) => preserveSelection(current, nextBundle.testCases))
        setSelectedBddId((current) => preserveSelection(current, preferredBddSelection(nextBundle.bddScenarios)))
      } catch (caught) {
        if (requestId === requestSequence.current) {
          setError(errorMessage(caught))
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (workflowId) {
      void loadData(workflowId)
    }
  }, [loadData, workflowId])

  const hasActiveJobs = bundle?.jobs.some((job) => isActiveJobStatus(job.status)) ?? false

  useEffect(() => {
    if (!workflowId || !hasActiveJobs) return undefined
    const timer = window.setInterval(() => void loadData(workflowId, true), 4000)
    return () => window.clearInterval(timer)
  }, [hasActiveJobs, loadData, workflowId])

  async function runTestCaseChecker(testCaseId: string) {
    await runAction('test-case-checker', async () => {
      // Note: Main frontend uses batch-based checker; individual test case checker
      // would need backend support. For now, show a message.
      setActionMessage(`Test case ${shortId(testCaseId)} selected for checker (batch mode via Test Cases page)`)
    })
  }

  async function generateBdd(testCaseId: string) {
    if (!workflowId) {
      setActionError('Load a workflow before generating BDD.')
      return
    }
    await runAction('bdd-generation', async () => {
      const response = await tcgApi.submitBddGenerationJob({
        workflowId,
        testCaseIds: [testCaseId],
        generationMode: 'standard',
        reviewerId: reviewerId.trim(),
      })
      setActionMessage(`BDD Maker job queued: ${shortId(response.jobId)}`)
      if (workflowId) await loadData(workflowId, true)
    })
  }

  async function runAction(name: string, action: () => Promise<void>) {
    if (!reviewerId.trim()) {
      setActionError('Reviewer ID is required for governed actions.')
      return
    }
    setRunningAction(name)
    setActionError(null)
    setActionMessage(null)
    try {
      await action()
    } catch (caught) {
      setActionError(errorMessage(caught))
    } finally {
      setRunningAction(null)
    }
  }

  function preferredBddSelection(scenarios: ReviewBddScenario[]): string | null {
    const sorted = sortNewest(scenarios)
    for (const s of sorted) {
      if (isCurrentBddScenario(s)) return s.id
    }
    return sorted.length > 0 ? sorted[0].id : null
  }

  if (!workflowId) {
    return (
      <div className="center-state">
        <strong>No workflow ID provided</strong>
        <span>Navigate to a workflow to view the review workbench.</span>
      </div>
    )
  }

  const tabCounts: Record<TabId, number | null> = {
    skills: bundle ? tcgSkillChain(bundle.skills).length : null,
    rules: bundle ? bundle.semanticRules.length + bundle.atomicRules.length : null,
    intents: bundle?.testIntents.length ?? null,
    cases: bundle?.testCases.length ?? null,
    bdd: bundle ? currentBddScenarios(bundle.bddScenarios).length : null,
    scripts: null,
  }

  return (
    <div className="rw-app-shell">
      <nav className="tabs" aria-label="Artifact views">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tabCounts[tab.id] !== null && <span className="tab-count">{tabCounts[tab.id]}</span>}
            {tab.id === 'scripts' && <span className="unavailable-label">Unavailable</span>}
          </button>
        ))}
      </nav>

      <main>
        {!workflowId && (
          <div className="center-state">
            <strong>No workflow ID provided</strong>
            <span>Navigate to a workflow to view the review workbench.</span>
          </div>
        )}

        {loading && (
          <div className="center-state">
            <span className="spinner" />
            <strong>Loading persisted workflow artifacts</strong>
            <span>No downstream state is inferred while loading.</span>
          </div>
        )}

        {error && (
          <div className="request-error" role="alert">
            <strong>Request failed</strong>
            <span>{error}</span>
            {workflowId && (
              <button type="button" onClick={() => void loadData(workflowId)}>
                Retry
              </button>
            )}
          </div>
        )}

        {(actionMessage || actionError) && (
          <div className={actionError ? 'request-error' : 'action-message'} role="status">
            <strong>{actionError ? 'Action failed' : 'Action queued'}</strong>
            <span>{actionError ?? actionMessage}</span>
          </div>
        )}

        {bundle && (
          <>
            <section className="workflow-summary">
              <div>
                <span className="eyebrow">Active workflow</span>
                <h1>{bundle.workflow.id}</h1>
                <p>
                  Document {bundle.workflow.documentId}
                  {bundle.workflow.currentStage ? ` / ${bundle.workflow.currentStage}` : ''}
                </p>
              </div>
              <div className="summary-metrics">
                <Metric label="Semantic rules" value={bundle.semanticRules.length} />
                <Metric label="Atomic rules" value={bundle.atomicRules.length} />
                <Metric label="Test intents" value={bundle.testIntents.length} />
                <Metric label="Test cases" value={bundle.testCases.length} />
                <Metric label="BDD drafts" value={currentBddScenarios(bundle.bddScenarios).length} />
              </div>
              <div className="refresh-state">
                <StatusBadge value={bundle.workflow.status} />
                <span>
                  {refreshing
                    ? 'Refreshing persisted state...'
                    : hasActiveJobs
                      ? 'Polling every 4 seconds'
                      : 'Polling stopped'}
                </span>
                <small>Updated {lastUpdated?.toLocaleTimeString() ?? 'never'}</small>
              </div>
            </section>

            <JobStrip jobs={bundle.jobs} />

            <section className="workspace">
              {activeTab === 'skills' && <SkillsView skills={bundle.skills} />}
              {activeTab === 'rules' && (
                <RulesView
                  atomicRules={bundle.atomicRules}
                  selectedId={selectedSemanticId}
                  semanticRules={bundle.semanticRules}
                  onSelect={setSelectedSemanticId}
                />
              )}
              {activeTab === 'intents' && (
                <IntentsView intents={bundle.testIntents} selectedId={selectedIntentId} onSelect={setSelectedIntentId} />
              )}
              {activeTab === 'cases' && (
                <TestCasesView
                  testCases={bundle.testCases}
                  selectedId={selectedCaseId}
                  onSelect={setSelectedCaseId}
                  onRunChecker={runTestCaseChecker}
                  runningAction={runningAction}
                />
              )}
              {activeTab === 'bdd' && (
                <BddView
                  scenarios={bundle.bddScenarios}
                  testCases={bundle.testCases}
                  selectedId={selectedBddId}
                  onSelect={setSelectedBddId}
                  onGenerateBdd={generateBdd}
                  runningAction={runningAction}
                />
              )}
              {activeTab === 'scripts' && <ScriptsPlaceholder />}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

// UI Components (adapted from review-workbench)

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const tone = statusTone(value)
  return <span className={`status-badge tone-${tone}`}>{value}</span>
}

function JobStrip({ jobs }: { jobs: AsyncJob[] }) {
  const stageJobs = sortNewest(jobs.filter((job) => stageTwoJobTypes.has(job.jobType)))

  return (
    <section className="job-strip" aria-label="Stage 2 job lifecycle">
      <div className="job-strip-heading">
        <div>
          <span className="eyebrow">Persisted job lifecycle</span>
          <strong>Stage 2 activity</strong>
        </div>
        <span>{stageJobs.length} jobs</span>
      </div>
      {stageJobs.length === 0 ? (
        <span className="quiet">No Stage 2 jobs are recorded.</span>
      ) : (
        <div className="job-list">
          {stageJobs.slice(0, 6).map((job) => (
            <article className="job-card" key={job.id}>
              <div>
                <strong>{humanize(job.jobType)}</strong>
                <span>{shortId(job.id)}</span>
              </div>
              <StatusBadge value={job.status} />
              <time>{formatDate(job.updatedAt)}</time>
              {job.status === 'FAILED' && job.errorMessage && <p className="job-error">{job.errorMessage}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SkillsView({ skills }: { skills: ReviewSkill[] }) {
  const chain = tcgSkillChain(skills)
  return (
    <div className="skills-layout">
      <Panel title="TCG and BDD Maker/Checker skills" meta={`${chain.length} visible`}>
        <div className="skill-chain">
          {chain.map((skill, index) => (
            <article className="skill-card" key={skill.name}>
              <div className="skill-order">{index + 1}</div>
              <div>
                <span className="eyebrow">{skill.stageLabel}</span>
                <h3>{skill.displayName}</h3>
                <p>{skill.description}</p>
                <dl className="compact-definitions">
                  <dt>Registry</dt>
                  <dd>{skill.registryId ? shortId(skill.registryId) : 'Defined by local skill manual'}</dd>
                  <dt>Category</dt>
                  <dd>{humanize(skill.category)}</dd>
                  <dt>Stage</dt>
                  <dd>{humanize(skill.workflowStage)}</dd>
                  <dt>Version</dt>
                  <dd>{skill.versionLabel}</dd>
                </dl>
              </div>
              <StatusBadge value={skill.status} />
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Draft review boundary">
        <div className="boundary-grid">
          <Callout tone="neutral" title="Maker/checker handoff">
            Test Case Maker and BDD Maker produce drafts. Checker actions are separate review gates and remain advisory.
          </Callout>
          <Callout tone="neutral" title="BDD scope">
            BDD skills stop at persisted draft review. Feature export, step binding, script generation, and execution stay unavailable.
          </Callout>
        </div>
      </Panel>
    </div>
  )
}

function ThreeColumnLayout({ sidebar, detail, aside }: { sidebar: React.ReactNode; detail: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="three-column-layout">
      <aside>{sidebar}</aside>
      <div>{detail}</div>
      <aside>{aside}</aside>
    </div>
  )
}

function ArtifactList({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Panel title={title} meta={`${count} persisted`}>
      <div className="artifact-list">{children}</div>
    </Panel>
  )
}

function ArtifactListButton({
  active,
  title,
  subtitle,
  meta,
  status,
  onClick,
}: {
  active: boolean
  title: string
  subtitle?: string | null
  meta?: string
  status: string
  onClick: () => void
}) {
  return (
    <button className={active ? 'artifact-button active' : 'artifact-button'} onClick={onClick} type="button">
      <span className="artifact-button-heading">
        <strong>{title}</strong>
        <StatusBadge value={status} />
      </span>
      {subtitle && <span>{subtitle}</span>}
      {meta && <small>{meta}</small>}
      <span className="inspect-label">Inspect</span>
    </button>
  )
}

function Panel({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-heading">
        <span className="panel-title">{title}</span>
        {meta && <span className="panel-meta">{meta}</span>}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

function DetailPanel({
  eyebrow,
  status,
  title,
  children,
}: {
  eyebrow?: string
  status?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="detail-panel">
      <div className="detail-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {status && <StatusBadge value={status} />}
      </div>
      {children}
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="field-grid">{children}</div>
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value || 'Not recorded'}</dd>
    </div>
  )
}

function TextSection({ label, value }: { label: string; value?: string | null }) {
  return (
    <ReadableSection label={label} value={value} preferredField={label.toLowerCase()} />
  )
}

function JsonSection({ label, value }: { label: string; value?: string | null }) {
  const parsed = value ? (() => { try { return JSON.parse(value) } catch { return value } })() : null
  return (
    <section className="readable-section">
      <h3>{label}</h3>
      <pre className="json-block">{typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2) || 'Not recorded'}</pre>
    </section>
  )
}

function ReadableSection({
  label,
  value,
  preferredField,
  tone,
}: {
  label: string
  value?: string | null
  preferredField?: string
  tone?: string
}) {
  const displayValue = value || 'Not recorded'
  return (
    <section className={`readable-section ${tone ? `tone-${tone}` : ''}`}>
      <h3>{label}</h3>
      <div className="readable-content">{displayValue}</div>
    </section>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state center-state">
      <strong>{title}</strong>
    </div>
  )
}

function Callout({ tone, title, children }: { tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className={`callout tone-${tone}`}>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

function RulesView({
  semanticRules,
  atomicRules,
  selectedId,
  onSelect,
}: {
  semanticRules: ReviewSemanticRule[]
  atomicRules: ReviewAtomicRule[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const selected = semanticRules.find((rule) => rule.id === selectedId) ?? null
  const children = selected ? atomicRules.filter((rule) => rule.semanticRuleId === selected.id) : []

  if (semanticRules.length === 0) return <EmptyState title="No rules recorded" />

  return (
    <ThreeColumnLayout
      sidebar={
        <ArtifactList title="Semantic rules" count={semanticRules.length}>
          {semanticRules.map((rule) => (
            <ArtifactListButton
              active={rule.id === selectedId}
              key={rule.id}
              onClick={() => onSelect(rule.id)}
              status={rule.approvalStatus}
              subtitle={rule.llmSummary ?? rule.llmBusinessIntent}
              title={rule.llmSemanticRuleCode}
            />
          ))}
        </ArtifactList>
      }
      detail={
        selected ? (
          <DetailPanel eyebrow={`Semantic rule / version ${selected.semanticVersion}`} status={selected.approvalStatus} title={selected.llmSemanticRuleCode}>
            <FieldGrid>
              <Field label="Business intent" value={selected.llmBusinessIntent} />
              <Field label="Section" value={selected.llmSection} />
              <Field label="Change type" value={humanize(selected.changeType)} />
              <Field label="Updated" value={formatDate(selected.updatedAt)} />
            </FieldGrid>
            <TextSection label="Summary" value={selected.llmSummary} />
            <JsonSection label="Persisted semantic payload" value={selected.llmOutputJson} />
          </DetailPanel>
        ) : (
          <EmptyState title="Select a semantic rule" />
        )
      }
      aside={
        <Panel title={`Atomic rules (${children.length})`}>
          {children.length === 0 ? (
            <p className="quiet">No atomic rules are linked to this row.</p>
          ) : (
            <div className="stack">
              {children.map((rule) => (
                <article className="linked-card" key={rule.id}>
                  <div className="linked-card-heading">
                    <strong>{rule.llmAtomicRuleCode}</strong>
                    <StatusBadge value={rule.status} />
                  </div>
                  <p>{rule.llmSummary}</p>
                  <dl className="compact-definitions">
                    <dt>Type</dt>
                    <dd>{rule.llmRuleType}</dd>
                    <dt>Version</dt>
                    <dd>{String(rule.atomicVersion)}</dd>
                    <dt>Section</dt>
                    <dd>{rule.llmSection}</dd>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </Panel>
      }
    />
  )
}

function IntentsView({ intents, selectedId, onSelect }: { intents: ReviewTestIntent[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const selected = intents.find((intent) => intent.id === selectedId) ?? null

  if (intents.length === 0) return <EmptyState title="No test intents recorded" />

  return (
    <ThreeColumnLayout
      sidebar={
        <ArtifactList title="Test intents" count={intents.length}>
          {intents.map((intent) => (
            <ArtifactListButton
              active={intent.id === selectedId}
              key={intent.id}
              onClick={() => onSelect(intent.id)}
              status={intent.readinessStatus}
              subtitle={`${humanize(intent.testLevel)} / ${humanize(intent.intentType)}`}
              title={intent.testIntentId}
              meta={shortId(intent.id)}
            />
          ))}
        </ArtifactList>
      }
      detail={
        selected ? (
          <DetailPanel eyebrow={selected.testIntentId} status={selected.readinessStatus} title={selected.testIntentId}>
            <FieldGrid>
              <Field label="Test level" value={selected.testLevel} />
              <Field label="Intent type" value={humanize(selected.intentType)} />
              <Field label="Readiness" value={selected.readinessStatus} />
              <Field label="Capability" value={selected.businessCapabilityId ?? 'Not linked'} />
              <Field label="Created" value={formatDate(selected.createdAt)} />
            </FieldGrid>
            {selected.blockedReason && <ReadableSection label="Blocked reason" value={selected.blockedReason} tone="negative" />}
            <JsonSection label="Intent payload" value={selected.intentJson} />
          </DetailPanel>
        ) : (
          <EmptyState title="Select a test intent" />
        )
      }
      aside={<Panel title="Intent summary"><p className="quiet">Select an intent to see details.</p></Panel>}
    />
  )
}

function TestCasesView({
  testCases,
  selectedId,
  onSelect,
  onRunChecker,
  runningAction,
}: {
  testCases: ReviewGeneratedTestCase[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRunChecker: (id: string) => void
  runningAction: string | null
}) {
  const selected = testCases.find((tc) => tc.id === selectedId) ?? null

  if (testCases.length === 0) return <EmptyState title="No test cases recorded" />

  return (
    <ThreeColumnLayout
      sidebar={
        <ArtifactList title="Latest test cases" count={testCases.length}>
          {testCases.map((testCase) => (
            <ArtifactListButton
              active={testCase.id === selectedId}
              key={testCase.id}
              onClick={() => onSelect(testCase.id)}
              status={testCase.status}
              subtitle={`${humanize(testCase.scenarioType)} / ${testCase.priority}`}
              title={testCase.title}
              meta={`${shortId(testCase.testCaseId)} / v${testCase.versionNumber}`}
            />
          ))}
        </ArtifactList>
      }
      detail={
        selected ? (
          <DetailPanel
            eyebrow={`${selected.testCaseId} / version ${selected.versionNumber}`}
            status={selected.status}
            title={selected.title}
          >
            <FieldGrid>
              <Field label="Scenario" value={humanize(selected.scenarioType)} />
              <Field label="Priority" value={selected.priority} />
              <Field label="Source rule" value={selected.ruleId} />
              <Field label="Source version" value={String(selected.sourceVersionNumber)} />
              <Field label="Test Intent" value={selected.testIntentId ?? 'Not linked'} />
              <Field label="Updated" value={formatDate(selected.updatedAt)} />
            </FieldGrid>
            <ReadableSection label="Preconditions" value={selected.preconditions} preferredField="preconditions" />
            <ReadableSection label="Steps" value={selected.steps} preferredField="steps" />
            <ReadableSection label="Expected results" value={selected.expectedResults} preferredField="expectedResults" />
            <ReadableSection label="Dependency traceability" value={selected.dependencyTraceability} preferredField="dependencyTraceability" />
            <div className="detail-grid">
              <ReadableSection label="Assumptions" value={selected.assumptions} preferredField="assumptions" />
              <ReadableSection label="Open questions" value={selected.openQuestions} preferredField="openQuestions" />
            </div>
            {selected.unsupportedInferences && (
              <ReadableSection label="Unsupported inferences" value={selected.unsupportedInferences} preferredField="unsupportedInferences" tone="negative" />
            )}
          </DetailPanel>
        ) : (
          <EmptyState title="Select a test case" />
        )
      }
      aside={
        <div className="stack">
          <Panel title="Checker assessment">
            {selected && (
              <div className="action-row">
                <button type="button" onClick={() => void onRunChecker(selected.id)} disabled={runningAction === 'test-case-checker'}>
                  {runningAction === 'test-case-checker' ? 'Queueing...' : 'Run Checker'}
                </button>
              </div>
            )}
            {!selected && <p className="quiet">Select a test case to run checker.</p>}
          </Panel>
        </div>
      }
    />
  )
}

function BddView({
  scenarios,
  testCases,
  selectedId,
  onSelect,
  onGenerateBdd,
  runningAction,
}: {
  scenarios: ReviewBddScenario[]
  testCases: ReviewGeneratedTestCase[]
  selectedId: string | null
  onSelect: (id: string) => void
  onGenerateBdd: (id: string) => void
  runningAction: string | null
}) {
  const selected = scenarios.find((s) => s.id === selectedId) ?? null
  const current = currentBddScenarios(scenarios)
  const staleCount = scenarios.length - current.length

  if (scenarios.length === 0) return <EmptyState title="No BDD scenarios recorded" />

  return (
    <ThreeColumnLayout
      sidebar={
        <ArtifactList title="BDD scenarios" count={current.length}>
          {sortNewest(current).map((scenario) => (
            <ArtifactListButton
              active={scenario.id === selectedId}
              key={scenario.id}
              onClick={() => onSelect(scenario.id)}
              status={scenario.status}
              subtitle={scenario.featureTitle}
              title={scenario.scenarioTitle}
              meta={shortId(scenario.generatedTestCaseId)}
            />
          ))}
        </ArtifactList>
      }
      detail={
        selected ? (
          <DetailPanel eyebrow={selected.featureTitle} status={selected.status} title={selected.scenarioTitle}>
            <FieldGrid>
              <Field label="Feature" value={selected.featureTitle} />
              <Field label="Status" value={selected.status} />
              <Field label="Source TC" value={shortId(selected.generatedTestCaseId)} />
              <Field label="Source version" value={String(selected.sourceVersionNumber)} />
              <Field label="Created" value={formatDate(selected.createdAt)} />
            </FieldGrid>
            <ReadableSection label="Gherkin text" value={selected.gherkinText} preferredField="gherkinText" />
            <ReadableSection label="Normalized BDD" value={selected.normalizedBdd} preferredField="normalizedBdd" />
            {selected.traceability && <ReadableSection label="Traceability" value={selected.traceability} preferredField="traceability" />}
            {selected.assumptions && <ReadableSection label="Assumptions" value={selected.assumptions} preferredField="assumptions" />}
          </DetailPanel>
        ) : (
          <EmptyState title="Select a BDD scenario" />
        )
      }
      aside={
        <div className="stack">
          <Panel title="BDD generation">
            {selected && (
              <div className="action-row">
                <button type="button" onClick={() => void onGenerateBdd(selected.generatedTestCaseId)} disabled={runningAction === 'bdd-generation'}>
                  {runningAction === 'bdd-generation' ? 'Queuing...' : 'Generate BDD'}
                </button>
              </div>
            )}
            {!selected && <p className="quiet">Select a scenario to regenerate.</p>}
          </Panel>
          {staleCount > 0 && (
            <Callout tone="warning" title="Stale scenarios">
              {staleCount} scenario{staleCount > 1 ? 's are' : ' is'} superseded by newer test-case versions and cannot be used for governed flows.
            </Callout>
          )}
        </div>
      }
    />
  )
}

function ScriptsPlaceholder() {
  return (
    <div className="center-state">
      <strong>Script generation is not available</strong>
      <p>BDD export, step binding, script generation, and execution stay outside the governed draft scope.</p>
    </div>
  )
}
