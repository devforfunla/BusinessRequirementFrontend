import { describe, expect, it } from 'vitest'
import {
  approvedAtomicRules,
  buildReviewRequest,
  getBddEligibility,
  isActiveTcgJobStatus,
  parseOptionalJsonArray,
  toTcgSourceRule,
} from './tcgBddUtils'
import type { AtomicRule, TcgGeneratedTestCase } from './api'

function atomicRule(overrides: Partial<AtomicRule> = {}): AtomicRule {
  return {
    id: 'AR-1',
    workflowId: 'WF-1',
    status: 'APPROVED',
    llmAtomicRuleCode: 'RULE-1',
    atomicVersion: 3,
    ...overrides,
  }
}

function testCase(overrides: Partial<TcgGeneratedTestCase> = {}): TcgGeneratedTestCase {
  return {
    id: 'TC-V1',
    testCaseId: 'TC-1',
    versionNumber: 1,
    isLatest: true,
    changeType: 'GENERATED_INITIAL',
    workflowId: 'WF-1',
    atomicRuleId: 'AR-1',
    ruleId: 'RULE-1',
    sourceVersionNumber: 3,
    semanticRuleId: 'SR-1',
    generationJobId: 'JOB-1',
    title: 'Margin rule happy path',
    scenarioType: 'positive',
    priority: 'medium',
    status: 'READY',
    ...overrides,
  }
}

describe('TCG source-rule mapping', () => {
  it('maps approved atomic rules to the current backend sourceRules contract', () => {
    expect(toTcgSourceRule(atomicRule())).toEqual({
      atomicRuleId: 'AR-1',
      ruleId: 'RULE-1',
      versionNumber: 3,
    })
  })

  it('filters source selection to approved atomic rules', () => {
    const rules = [
      atomicRule({ id: 'approved', status: 'APPROVED' }),
      atomicRule({ id: 'draft', status: 'DRAFT' }),
    ]

    expect(approvedAtomicRules(rules).map((rule) => rule.id)).toEqual(['approved'])
  })
})

describe('advanced JSON fields', () => {
  it('returns an empty array for blank optional JSON fields', () => {
    expect(parseOptionalJsonArray('', 'Reference package')).toEqual({ ok: true, value: [] })
  })

  it('accepts JSON arrays', () => {
    expect(parseOptionalJsonArray('[{"id":"REF-1"}]', 'Reference package')).toEqual({
      ok: true,
      value: [{ id: 'REF-1' }],
    })
  })

  it('rejects invalid JSON and non-array JSON visibly', () => {
    expect(parseOptionalJsonArray('{bad', 'Reference package')).toEqual({
      ok: false,
      error: 'Reference package must be valid JSON.',
    })
    expect(parseOptionalJsonArray('{"id":"REF-1"}', 'Reference package')).toEqual({
      ok: false,
      error: 'Reference package must be a JSON array.',
    })
  })
})

describe('job polling states', () => {
  it('treats only QUEUED and RUNNING as active', () => {
    expect(isActiveTcgJobStatus('QUEUED')).toBe(true)
    expect(isActiveTcgJobStatus('RUNNING')).toBe(true)
    expect(isActiveTcgJobStatus('SUCCEEDED')).toBe(false)
    expect(isActiveTcgJobStatus('PARTIAL_SUCCESS')).toBe(false)
    expect(isActiveTcgJobStatus('FAILED')).toBe(false)
  })
})

describe('review request guardrails', () => {
  it('includes expectedVersionNumber and idempotency header for reviewer transitions', () => {
    const request = buildReviewRequest(testCase({ versionNumber: 4 }), 'verify', 'qa-user', 'looks good', 'idem-1')

    expect(request).toEqual({
      body: {
        expectedVersionNumber: 4,
        reviewerId: 'qa-user',
        comment: 'looks good',
      },
      headers: {
        'Idempotency-Key': 'idem-1',
      },
    })
  })

  it('uses approverId for approve transitions', () => {
    const request = buildReviewRequest(testCase({ versionNumber: 2 }), 'approve', 'qa-approver', '', 'idem-2')

    expect(request).toEqual({
      body: {
        expectedVersionNumber: 2,
        approverId: 'qa-approver',
        comment: undefined,
      },
      headers: {
        'Idempotency-Key': 'idem-2',
      },
    })
  })
})

describe('BDD generation eligibility', () => {
  it('allows only latest READY or VERIFIED test cases', () => {
    expect(getBddEligibility(testCase({ status: 'READY' })).eligible).toBe(true)
    expect(getBddEligibility(testCase({ status: 'VERIFIED' })).eligible).toBe(true)
    expect(getBddEligibility(testCase({ status: 'DRAFT' })).eligible).toBe(false)
    expect(getBddEligibility(testCase({ status: 'APPROVED' })).eligible).toBe(false)
    expect(getBddEligibility(testCase({ status: 'ARCHIVED' })).eligible).toBe(false)
    expect(getBddEligibility(testCase({ status: 'REJECTED' })).eligible).toBe(false)
    expect(getBddEligibility(testCase({ status: 'READY', isLatest: false })).eligible).toBe(false)
  })
})
