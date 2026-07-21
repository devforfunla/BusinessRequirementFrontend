import type {
  AtomicRule,
  JsonRecord,
  TcgGeneratedTestCase,
  TcgReviewAction,
  TcgReviewRequest,
  TcgSourceRuleReference,
} from './api'

export type OptionalJsonArrayResult<T> =
  | { ok: true; value: T[] }
  | { ok: false; error: string }

export function toTcgSourceRule(rule: AtomicRule): TcgSourceRuleReference {
  return {
    atomicRuleId: rule.id,
    ruleId: rule.atomicRuleCode || rule.llmAtomicRuleCode || rule.id,
    versionNumber: rule.atomicVersion ?? 1,
  }
}

export function approvedAtomicRules(rules: AtomicRule[]) {
  return rules.filter((rule) => rule.status === 'APPROVED')
}

export function parseOptionalJsonArray<T = JsonRecord>(text: string, label: string): OptionalJsonArrayResult<T> {
  if (!text.trim()) return { ok: true, value: [] }

  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) {
      return { ok: false, error: `${label} must be a JSON array.` }
    }
    return { ok: true, value: parsed as T[] }
  } catch {
    return { ok: false, error: `${label} must be valid JSON.` }
  }
}

export function isActiveTcgJobStatus(status?: string | null) {
  return status === 'QUEUED' || status === 'RUNNING'
}

export function getBddEligibility(testCase: TcgGeneratedTestCase): { eligible: boolean; reason: string } {
  if (!testCase.isLatest) {
    return { eligible: false, reason: 'Stale test-case version' }
  }
  if (testCase.status === 'READY' || testCase.status === 'VERIFIED') {
    return { eligible: true, reason: 'Eligible for BDD draft generation' }
  }
  if (testCase.status === 'DRAFT') {
    return { eligible: false, reason: 'Verify or checker-promote before BDD generation' }
  }
  if (testCase.status === 'APPROVED') {
    return { eligible: false, reason: 'Approved test cases are not accepted by the current BDD slice' }
  }
  if (testCase.status === 'ARCHIVED') {
    return { eligible: false, reason: 'Archived test cases cannot produce BDD drafts' }
  }
  if (testCase.status === 'REJECTED') {
    return { eligible: false, reason: 'Rejected test cases cannot produce BDD drafts' }
  }
  return { eligible: false, reason: `${testCase.status} is not eligible for BDD draft generation` }
}

export function buildReviewRequest(
  testCase: Pick<TcgGeneratedTestCase, 'versionNumber'>,
  action: TcgReviewAction,
  reviewerId: string,
  comment?: string,
  idempotencyKey = createIdempotencyKey(action),
): TcgReviewRequest {
  const common = {
    expectedVersionNumber: testCase.versionNumber,
    comment: comment?.trim() || undefined,
  }
  const body =
    action === 'approve'
      ? { ...common, approverId: reviewerId }
      : { ...common, reviewerId }

  return {
    body,
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  }
}

function createIdempotencyKey(action: TcgReviewAction) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `tcg-${action}-${crypto.randomUUID()}`
  }
  return `tcg-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
