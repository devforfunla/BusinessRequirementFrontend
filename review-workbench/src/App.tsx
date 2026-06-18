import {
  Fragment as ReactFragment,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  checkBddScenario,
  loadTestCaseReview,
  loadWorkflowBundle,
  submitBddGenerationJob,
  submitTestCaseCheckerJob
} from "./api";
import type {
  AsyncJob,
  AtomicRule,
  BddScenario,
  BddCheckerResult,
  CheckerResult,
  ConfidenceDecision,
  GeneratedTestCase,
  SemanticRule,
  Skill,
  TestIntent,
  WorkflowBundle
} from "./types";
import {
  currentBddScenarios,
  formatDate,
  isActiveJobStatus,
  parseJsonText,
  sortBddScenarios,
  sortNewest,
  statusTone
} from "./utils";

type TabId = "skills" | "rules" | "intents" | "cases" | "bdd" | "scripts";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "skills", label: "Skills" },
  { id: "rules", label: "Rules" },
  { id: "intents", label: "Test Intents" },
  { id: "cases", label: "Test Cases" },
  { id: "bdd", label: "BDD Drafts" },
  { id: "scripts", label: "Scripts" }
];

const stageTwoJobTypes = new Set([
  "TEST_CASE_GENERATION",
  "TEST_CASE_CHECKER",
  "BDD_GENERATION"
]);

function initialWorkflowId(): string {
  return new URLSearchParams(window.location.search).get("workflowId") ?? "";
}

function initialReviewerId(): string {
  return (
    new URLSearchParams(window.location.search).get("reviewerId") ??
    "reviewer@example.com"
  );
}

export default function App() {
  const [workflowInput, setWorkflowInput] = useState(initialWorkflowId);
  const [workflowId, setWorkflowId] = useState(initialWorkflowId);
  const [reviewerId, setReviewerId] = useState(initialReviewerId);
  const [bundle, setBundle] = useState<WorkflowBundle | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("skills");
  const [selectedSemanticId, setSelectedSemanticId] = useState<string | null>(
    null
  );
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBddId, setSelectedBddId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [bddCheckerResult, setBddCheckerResult] =
    useState<BddCheckerResult | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestSequence = useRef(0);

  const loadData = useCallback(
    async (id: string, background = false) => {
      const requestId = ++requestSequence.current;
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setBundle(null);
      }
      setError(null);

      try {
        const nextBundle = await loadWorkflowBundle(id);
        if (requestId !== requestSequence.current) {
          return;
        }
        setBundle(nextBundle);
        setLastUpdated(new Date());
        setSelectedSemanticId((current) =>
          preserveSelection(current, nextBundle.semanticRules)
        );
        setSelectedIntentId((current) =>
          preserveSelection(current, nextBundle.testIntents)
        );
        setSelectedCaseId((current) =>
          preserveSelection(current, nextBundle.testCases)
        );
        setSelectedBddId((current) =>
          preserveSelection(current, preferredBddSelection(nextBundle.bddScenarios))
        );
      } catch (caught) {
        if (requestId === requestSequence.current) {
          setError(errorMessage(caught));
        }
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (workflowId) {
      void loadData(workflowId);
    }
  }, [loadData, workflowId]);

  const hasActiveJobs =
    bundle?.jobs.some((job) => isActiveJobStatus(job.status)) ?? false;

  useEffect(() => {
    if (!workflowId || !hasActiveJobs) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      void loadData(workflowId, true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, loadData, workflowId]);

  function submitWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextId = workflowInput.trim();
    if (!nextId) {
      setError("Enter a workflow ID.");
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("workflowId", nextId);
    if (reviewerId.trim()) {
      url.searchParams.set("reviewerId", reviewerId.trim());
    }
    window.history.replaceState({}, "", url);
    if (nextId === workflowId) {
      void loadData(nextId);
    } else {
      setWorkflowId(nextId);
    }
  }

  const tabCounts: Record<TabId, number | null> = {
    skills: bundle ? tcgSkillChain(bundle.skills).length : null,
    rules: bundle
      ? bundle.semanticRules.length + bundle.atomicRules.length
      : null,
    intents: bundle?.testIntents.length ?? null,
    cases: bundle?.testCases.length ?? null,
    bdd: bundle ? currentBddScenarios(bundle.bddScenarios).length : null,
    scripts: null
  };

  async function runTestCaseChecker(testCaseId: string) {
    await runAction("test-case-checker", async () => {
      const response = await submitTestCaseCheckerJob({
        testCaseIds: [testCaseId],
        benchmarkProfile: "governed_tcg_checker_v1",
        reviewerId: reviewerId.trim()
      });
      setActionMessage(`Test Case Checker job queued: ${shortId(response.jobId)}`);
      if (workflowId) {
        await loadData(workflowId, true);
      }
    });
  }

  async function generateBdd(testCaseId: string) {
    if (!workflowId) {
      setActionError("Load a workflow before generating BDD.");
      return;
    }
    await runAction("bdd-generation", async () => {
      const response = await submitBddGenerationJob({
        workflowId,
        testCaseIds: [testCaseId],
        generationMode: "standard",
        reviewerId: reviewerId.trim()
      });
      setActionMessage(`BDD Maker job queued: ${shortId(response.jobId)}`);
      await loadData(workflowId, true);
    });
  }

  async function runBddChecker(scenarioId: string) {
    await runAction("bdd-checker", async () => {
      const result = await checkBddScenario(scenarioId, reviewerId.trim());
      setBddCheckerResult(result);
      setActionMessage(`BDD Checker completed: ${humanize(result.readiness)}`);
    });
  }

  async function runAction(name: string, action: () => Promise<void>) {
    if (!reviewerId.trim()) {
      setActionError("Reviewer ID is required for governed actions.");
      return;
    }
    setRunningAction(name);
    setActionError(null);
    setActionMessage(null);
    try {
      await action();
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">LME</span>
          <div>
            <strong>Test Design Review</strong>
            <span>Persisted artifact workbench</span>
          </div>
        </div>
        <form className="workflow-form" onSubmit={submitWorkflow}>
          <label htmlFor="workflow-id">Workflow ID</label>
          <input
            id="workflow-id"
            value={workflowInput}
            onChange={(event) => setWorkflowInput(event.target.value)}
            placeholder="WF-2026-0612-001"
          />
          <label htmlFor="reviewer-id">Reviewer</label>
          <input
            id="reviewer-id"
            value={reviewerId}
            onChange={(event) => setReviewerId(event.target.value)}
            placeholder="reviewer@example.com"
          />
          <button type="submit">Load workflow</button>
        </form>
      </header>

      <nav className="tabs" aria-label="Artifact views">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "tab active" : "tab"}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tabCounts[tab.id] !== null && (
              <span className="tab-count">{tabCounts[tab.id]}</span>
            )}
            {tab.id === "scripts" && (
              <span className="unavailable-label">Unavailable</span>
            )}
          </button>
        ))}
      </nav>

      <main>
        {!workflowId && <Welcome />}

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
          <div
            className={actionError ? "request-error" : "action-message"}
            role="status"
          >
            <strong>{actionError ? "Action failed" : "Action queued"}</strong>
            <span>{actionError ?? actionMessage}</span>
          </div>
        )}

        {bundle && (
          <>
            <WorkflowSummary
              bundle={bundle}
              hasActiveJobs={hasActiveJobs}
              lastUpdated={lastUpdated}
              refreshing={refreshing}
            />
            <JobStrip jobs={bundle.jobs} />

            <section className="workspace">
              {activeTab === "skills" && <SkillsView skills={bundle.skills} />}
              {activeTab === "rules" && (
                <RulesView
                  atomicRules={bundle.atomicRules}
                  selectedId={selectedSemanticId}
                  semanticRules={bundle.semanticRules}
                  onSelect={setSelectedSemanticId}
                />
              )}
              {activeTab === "intents" && (
                <IntentsView
                  intents={bundle.testIntents}
                  selectedId={selectedIntentId}
                  onSelect={setSelectedIntentId}
                />
              )}
              {activeTab === "cases" && (
                <TestCasesView
                  testCases={bundle.testCases}
                  selectedId={selectedCaseId}
                  onSelect={setSelectedCaseId}
                  onRunChecker={runTestCaseChecker}
                  runningAction={runningAction}
                />
              )}
              {activeTab === "bdd" && (
                <BddView
                  scenarios={bundle.bddScenarios}
                  testCases={bundle.testCases}
                  selectedId={selectedBddId}
                  onSelect={setSelectedBddId}
                  onGenerateBdd={generateBdd}
                  onRunChecker={runBddChecker}
                  checkerResult={bddCheckerResult}
                  runningAction={runningAction}
                />
              )}
              {activeTab === "scripts" && <ScriptsPlaceholder />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function WorkflowSummary({
  bundle,
  hasActiveJobs,
  lastUpdated,
  refreshing
}: {
  bundle: WorkflowBundle;
  hasActiveJobs: boolean;
  lastUpdated: Date | null;
  refreshing: boolean;
}) {
  return (
    <section className="workflow-summary">
      <div>
        <span className="eyebrow">Active workflow</span>
        <h1>{bundle.workflow.id}</h1>
        <p>
          Document {bundle.workflow.documentId}
          {bundle.workflow.currentStage
            ? ` / ${bundle.workflow.currentStage}`
            : ""}
        </p>
      </div>
      <div className="summary-metrics">
        <Metric label="Semantic rules" value={bundle.semanticRules.length} />
        <Metric label="Atomic rules" value={bundle.atomicRules.length} />
        <Metric label="Test intents" value={bundle.testIntents.length} />
        <Metric label="Test cases" value={bundle.testCases.length} />
        <Metric
          label="BDD drafts"
          value={currentBddScenarios(bundle.bddScenarios).length}
        />
      </div>
      <div className="refresh-state">
        <StatusBadge value={bundle.workflow.status} />
        <span>
          {refreshing
            ? "Refreshing persisted state..."
            : hasActiveJobs
              ? "Polling every 4 seconds"
              : "Polling stopped"}
        </span>
        <small>
          Updated {lastUpdated ? lastUpdated.toLocaleTimeString() : "never"}
        </small>
      </div>
    </section>
  );
}

function JobStrip({ jobs }: { jobs: AsyncJob[] }) {
  const stageJobs = sortNewest(
    jobs.filter((job) => stageTwoJobTypes.has(job.jobType))
  );

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
              {job.status === "FAILED" && job.errorMessage && (
                <p className="job-error">{job.errorMessage}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SkillsView({ skills }: { skills: Skill[] }) {
  const chain = tcgSkillChain(skills);
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
                  <dd>{skill.registryId ? shortId(skill.registryId) : "Defined by local skill manual"}</dd>
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
            Test Case Maker and BDD Maker produce drafts. Checker actions are
            separate review gates and remain advisory.
          </Callout>
          <Callout tone="neutral" title="BDD scope">
            BDD skills stop at persisted draft review. Feature export, step
            binding, script generation, and execution stay unavailable.
          </Callout>
        </div>
      </Panel>
    </div>
  );
}

function RulesView({
  semanticRules,
  atomicRules,
  selectedId,
  onSelect
}: {
  semanticRules: SemanticRule[];
  atomicRules: AtomicRule[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected =
    semanticRules.find((rule) => rule.id === selectedId) ?? null;
  const children = selected
    ? atomicRules.filter((rule) => rule.semanticRuleId === selected.id)
    : [];

  if (semanticRules.length === 0) {
    return <EmptyState title="No rules recorded" />;
  }

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
          <DetailPanel
            eyebrow={`Semantic rule / version ${selected.semanticVersion}`}
            status={selected.approvalStatus}
            title={selected.llmSemanticRuleCode}
          >
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
                    <dd>{rule.atomicVersion}</dd>
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
  );
}

function IntentsView({
  intents,
  selectedId,
  onSelect
}: {
  intents: TestIntent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = intents.find((intent) => intent.id === selectedId) ?? null;

  if (intents.length === 0) {
    return <EmptyState title="No Test Intents recorded" />;
  }

  const parsedIntent = parseJsonText(selected?.intentJson);
  const parsedSources = parseJsonText(selected?.sourceRules);

  return (
    <ThreeColumnLayout
      sidebar={
        <ArtifactList title="Test Intents" count={intents.length}>
          {intents.map((intent) => (
            <ArtifactListButton
              active={intent.id === selectedId}
              key={intent.id}
              onClick={() => onSelect(intent.id)}
              status={intent.readinessStatus}
              subtitle={`${intent.testLevel} / ${humanize(intent.intentType)}`}
              title={intent.testIntentId}
            />
          ))}
        </ArtifactList>
      }
      detail={
        selected ? (
          <DetailPanel
            eyebrow="Persisted Test Intent"
            status={selected.readinessStatus}
            title={selected.testIntentId}
          >
            <FieldGrid>
              <Field label="Test level" value={selected.testLevel} />
              <Field label="Intent type" value={humanize(selected.intentType)} />
              <Field
                label="Business capability"
                value={selected.businessCapabilityId}
              />
              <Field label="Created" value={formatDate(selected.createdAt)} />
            </FieldGrid>
            {selected.blockedReason && (
              <Callout tone="negative" title="Blocked reason">
                {selected.blockedReason}
              </Callout>
            )}
            <JsonSection
              label="Intent design payload"
              value={selected.intentJson}
            />
          </DetailPanel>
        ) : (
          <EmptyState title="Select a Test Intent" />
        )
      }
      aside={
        selected ? (
          <div className="stack">
            <Panel title="Source rule rows">
              <ParsedValue parsed={parsedSources} />
            </Panel>
            <Panel title="Stored payload integrity">
              <IntegrityLine
                label="intentJson"
                valid={!parsedIntent.error}
              />
              <IntegrityLine
                label="sourceRules"
                valid={!parsedSources.error}
              />
              <p className="quiet">
                Invalid JSON is shown as stored. The client does not repair it.
              </p>
            </Panel>
          </div>
        ) : (
          <Panel title="Source rule rows">
            <p className="quiet">Select an intent to inspect lineage.</p>
          </Panel>
        )
      }
    />
  );
}

function TestCasesView({
  testCases,
  selectedId,
  onSelect,
  onRunChecker,
  runningAction
}: {
  testCases: GeneratedTestCase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRunChecker: (id: string) => void | Promise<void>;
  runningAction: string | null;
}) {
  const selected =
    testCases.find((testCase) => testCase.id === selectedId) ?? null;
  const [review, setReview] = useState<{
    loading: boolean;
    error: string | null;
    checkerResults: CheckerResult[];
    confidenceDecisions: ConfidenceDecision[];
  }>({
    loading: false,
    error: null,
    checkerResults: [],
    confidenceDecisions: []
  });
  const reviewSequence = useRef(0);

  useEffect(() => {
    if (!selected) {
      setReview({
        loading: false,
        error: null,
        checkerResults: [],
        confidenceDecisions: []
      });
      return;
    }

    const requestId = ++reviewSequence.current;
    setReview((current) => ({ ...current, loading: true, error: null }));
    void loadTestCaseReview(selected.id)
      .then((result) => {
        if (requestId === reviewSequence.current) {
          setReview({ loading: false, error: null, ...result });
        }
      })
      .catch((caught) => {
        if (requestId === reviewSequence.current) {
          setReview({
            loading: false,
            error: errorMessage(caught),
            checkerResults: [],
            confidenceDecisions: []
          });
        }
      });
  }, [selected]);

  if (testCases.length === 0) {
    return <EmptyState title="No generated test cases recorded" />;
  }

  const latestChecker = [...review.checkerResults].sort((left, right) =>
    right.checkedAt.localeCompare(left.checkedAt)
  )[0];
  const latestConfidence = [...review.confidenceDecisions].sort((left, right) =>
    right.decidedAt.localeCompare(left.decidedAt)
  )[0];
  const checkerPending = Boolean(selected && !latestChecker);

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
              <Field
                label="Source version"
                value={String(selected.sourceVersionNumber)}
              />
              <Field label="Test Intent" value={selected.testIntentId} />
              <Field label="Updated" value={formatDate(selected.updatedAt)} />
            </FieldGrid>
            <ReadableSection
              label="Preconditions"
              value={selected.preconditions}
              preferredField="preconditions"
            />
            <ReadableSection
              label="Steps"
              value={selected.steps}
              preferredField="steps"
            />
            <ReadableSection
              label="Expected results"
              value={selected.expectedResults}
              preferredField="expectedResults"
            />
            <TraceabilitySection
              label="Dependency traceability"
              value={selected.dependencyTraceability}
            />
            <div className="detail-grid">
              <ReadableSection
                label="Assumptions"
                value={selected.assumptions}
                preferredField="assumptions"
              />
              <ReadableSection
                label="Open questions"
                value={selected.openQuestions}
                preferredField="openQuestions"
              />
            </div>
            {selected.unsupportedInferences && (
              <ReadableSection
                label="Unsupported inferences"
                value={selected.unsupportedInferences}
                preferredField="unsupportedInferences"
                tone="negative"
              />
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
                <button
                  type="button"
                  onClick={() => void onRunChecker(selected.id)}
                  disabled={runningAction === "test-case-checker"}
                >
                  {runningAction === "test-case-checker"
                    ? "Queueing..."
                    : latestChecker
                      ? "Run Checker Again"
                      : "Run Checker"}
                </button>
                {checkerPending && (
                  <span className="quiet">Manual checker gate is pending.</span>
                )}
              </div>
            )}
            {review.loading && <p className="quiet">Loading persisted review...</p>}
            {review.error && <p className="inline-error">{review.error}</p>}
            {!review.loading && !review.error && !latestChecker && (
              <p className="quiet">No checker result is recorded.</p>
            )}
            {latestChecker && <CheckerSummary result={latestChecker} />}
          </Panel>
          <Panel title="Confidence decision">
            {!review.loading && !latestConfidence && (
              <p className="quiet">No confidence decision is recorded.</p>
            )}
            {latestConfidence && (
              <ConfidenceSummary decision={latestConfidence} />
            )}
          </Panel>
          <Callout tone="neutral" title="Manual review gate">
            Checker pass/fail is advisory. Confidence is not approval. Review
            mutations, rewrite, export, and execution stay outside this view.
          </Callout>
        </div>
      }
    />
  );
}

function BddView({
  scenarios,
  testCases,
  selectedId,
  onSelect,
  onGenerateBdd,
  onRunChecker,
  checkerResult,
  runningAction
}: {
  scenarios: BddScenario[];
  testCases: GeneratedTestCase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGenerateBdd: (testCaseId: string) => void | Promise<void>;
  onRunChecker: (scenarioId: string) => void | Promise<void>;
  checkerResult: BddCheckerResult | null;
  runningAction: string | null;
}) {
  const currentScenarios = currentBddScenarios(scenarios);
  const visibleScenarios =
    currentScenarios.length > 0 ? currentScenarios : sortBddScenarios(scenarios);
  const staleCount = scenarios.length - currentScenarios.length;
  const selected =
    visibleScenarios.find((scenario) => scenario.id === selectedId) ?? null;
  const currentScenarioByTestCase = new Map(
    currentScenarios.map((scenario) => [scenario.generatedTestCaseId, scenario])
  );

  return (
    <ThreeColumnLayout
      sidebar={
        <ArtifactList
          title="BDD drafts"
          count={visibleScenarios.length}
          meta={`${currentScenarios.length} current / ${scenarios.length} persisted`}
        >
          {visibleScenarios.length === 0 ? (
            <p className="quiet list-note">No BDD drafts are recorded.</p>
          ) : (
            visibleScenarios.map((scenario) => (
              <ArtifactListButton
                active={scenario.id === selectedId}
                key={scenario.id}
                onClick={() => onSelect(scenario.id)}
                status={scenario.status}
                subtitle={scenario.featureTitle}
                title={scenario.scenarioTitle}
                meta={`${scenario.ruleId} / v${scenario.sourceVersionNumber}`}
              />
            ))
          )}
          {staleCount > 0 && currentScenarios.length > 0 && (
            <p className="quiet list-note">{staleCount} stale history rows hidden.</p>
          )}
        </ArtifactList>
      }
      detail={
        selected ? (
          <DetailPanel
            eyebrow="Persisted BDD draft"
            status={selected.status}
            title={selected.scenarioTitle}
          >
            <FieldGrid>
              <Field label="Feature" value={selected.featureTitle} />
              <Field label="Source rule" value={selected.ruleId} />
              <Field
                label="Source version"
                value={String(selected.sourceVersionNumber)}
              />
              <Field label="Updated" value={formatDate(selected.updatedAt)} />
            </FieldGrid>
            {selected.staleAt && (
              <Callout tone="negative" title="Stale draft">
                {selected.staleReason ?? "A newer test-case version exists."}
              </Callout>
            )}
            <section className="detail-section">
              <span className="section-label">Gherkin draft</span>
              <pre className="gherkin">{selected.gherkinText}</pre>
            </section>
            <BddNormalizedSummary value={selected.normalizedBdd} />
          </DetailPanel>
        ) : (
          <EmptyState title="Select a BDD draft" />
        )
      }
      aside={
        <div className="stack">
          <Panel title="BDD Draft Generation">
            <div className="artifact-list compact-list">
              {testCases.length === 0 ? (
                <p className="quiet">No generated test cases are available.</p>
              ) : (
                testCases.map((testCase) => {
                  const existing = currentScenarioByTestCase.get(testCase.id);
                  const reason = bddDisabledReason(testCase, existing);
                  return (
                    <div className="generation-row" key={testCase.id}>
                      <div>
                        <strong>{testCase.title}</strong>
                        <span>
                          {testCase.testCaseId} / {humanize(testCase.status)}
                        </span>
                        {reason && <small>{reason}</small>}
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(reason) || runningAction === "bdd-generation"}
                        onClick={() => void onGenerateBdd(testCase.id)}
                      >
                        {existing ? "Generated" : "Generate BDD"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
          {selected ? (
            <>
              <Panel title="BDD Checker">
                <div className="action-row">
                  <button
                    type="button"
                    onClick={() => void onRunChecker(selected.id)}
                    disabled={runningAction === "bdd-checker"}
                  >
                    {runningAction === "bdd-checker"
                      ? "Checking..."
                      : "Run BDD Checker"}
                  </button>
                  <span className="quiet">Advisory draft quality check.</span>
                </div>
                {checkerResult &&
                  checkerResult.bddScenarioId === selected.id && (
                    <CheckerResultCard result={checkerResult} />
                  )}
              </Panel>
              <Panel title="Traceability">
                <TraceabilitySection label="Source lineage" value={selected.traceability} />
              </Panel>
              <Panel title="Assumptions">
                <ReadableValue value={selected.assumptions} preferredField="assumptions" />
              </Panel>
            </>
          ) : (
            <Panel title="BDD Checker">
              <p className="quiet">Select a draft to run BDD checker.</p>
            </Panel>
          )}
          <Panel title="Draft boundary">
            <p className="quiet">
              This is a persisted draft. Feature export, step binding, script
              generation, and execution remain outside this workbench.
            </p>
          </Panel>
        </div>
      }
    />
  );
}

function ScriptsPlaceholder() {
  return (
    <div className="placeholder-panel">
      <span className="placeholder-code">&lt;/&gt;</span>
      <span className="eyebrow">Deferred capability</span>
      <h2>Scripts are unavailable</h2>
      <p>
        There is no approved script-generation, step-registry, export, or
        execution contract in the current implementation slice.
      </p>
      <StatusBadge value="NOT_IMPLEMENTED" />
    </div>
  );
}

function CheckerSummary({ result }: { result: CheckerResult }) {
  return (
    <div className="stack compact">
      <div className="score-row">
        <div>
          <span className="score">{Math.round(result.totalScore * 100) / 100}</span>
          <small>Total score</small>
        </div>
        <StatusBadge value={result.isPassing ? "PASS" : "FAILED"} />
      </div>
      <p className="advisory-label">Advisory checker result</p>
      <Field
        label="Blocking category"
        value={result.blockingCategory ?? "None recorded"}
      />
      <Field label="Benchmark" value={result.benchmarkProfile} />
      <JsonSection label="Findings" value={result.findings} />
      <JsonSection
        label="Recommended actions"
        value={result.recommendedActions}
      />
      <small className="quiet">{formatDate(result.checkedAt)}</small>
    </div>
  );
}

function ConfidenceSummary({
  decision
}: {
  decision: ConfidenceDecision;
}) {
  return (
    <div className="stack compact">
      <StatusBadge value={decision.confidenceLevel} />
      <p>{decision.rationale ?? "No rationale recorded."}</p>
      <dl className="compact-definitions">
        <dt>Reviewer</dt>
        <dd>{decision.reviewerId ?? "System decision"}</dd>
        <dt>Decided</dt>
        <dd>{formatDate(decision.decidedAt)}</dd>
      </dl>
    </div>
  );
}

function Welcome() {
  return (
    <div className="welcome">
      <span className="eyebrow">TCG-NEXT-08</span>
      <h1>Review the governed TCG and BDD draft chain.</h1>
      <p>
        Enter a workflow ID to load persisted rules, skills, Test Intents,
        latest test cases, checker and confidence records, BDD drafts, and job
        status.
      </p>
      <div className="welcome-grid">
        <WelcomeCard
          title="Real APIs"
          text="Every populated view comes from the current Spring service."
        />
        <WelcomeCard
          title="Honest lifecycle"
          text="Queued, running, succeeded, and failed jobs remain distinct."
        />
        <WelcomeCard
          title="Draft review boundary"
          text="Checker and BDD draft actions are governed; export, script, and execution actions stay unavailable."
        />
      </div>
    </div>
  );
}

function ThreeColumnLayout({
  sidebar,
  detail,
  aside
}: {
  sidebar: ReactNode;
  detail: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div className="three-column-layout">
      <aside>{sidebar}</aside>
      <div>{detail}</div>
      <aside>{aside}</aside>
    </div>
  );
}

function ArtifactList({
  title,
  count,
  meta,
  children
}: {
  title: string;
  count: number;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <Panel title={title} meta={meta ?? `${count} persisted`}>
      <div className="artifact-list">{children}</div>
    </Panel>
  );
}

function ArtifactListButton({
  active,
  title,
  subtitle,
  meta,
  status,
  onClick
}: {
  active: boolean;
  title: string;
  subtitle?: string | null;
  meta?: string;
  status: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "artifact-button active" : "artifact-button"}
      onClick={onClick}
      type="button"
    >
      <span className="artifact-button-heading">
        <strong>{title}</strong>
        <StatusBadge value={status} />
      </span>
      {subtitle && <span>{subtitle}</span>}
      {meta && <small>{meta}</small>}
      <span className="inspect-label">Inspect</span>
    </button>
  );
}

function DetailPanel({
  eyebrow,
  title,
  status,
  children
}: {
  eyebrow: string;
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <article className="panel detail-panel">
      <header className="detail-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge value={status} />
      </header>
      {children}
    </article>
  );
}

function Panel({
  title,
  meta,
  children
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-heading">
        <h3>{title}</h3>
        {meta && <span>{meta}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="field-grid">{children}</div>;
}

function Field({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value || "Not recorded"}</strong>
    </div>
  );
}

function TextSection({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <section className="detail-section">
      <span className="section-label">{label}</span>
      <p>{value || "Not recorded"}</p>
    </section>
  );
}

function JsonSection({
  label,
  value,
  tone
}: {
  label: string;
  value?: string | null;
  tone?: "negative";
}) {
  const parsed = parseJsonText(value);
  return (
    <section
      className={
        tone === "negative"
          ? "detail-section detail-section-negative"
          : "detail-section"
      }
    >
      <span className="section-label">{label}</span>
      <ParsedValue parsed={parsed} />
    </section>
  );
}

function ReadableSection({
  label,
  value,
  preferredField,
  tone
}: {
  label: string;
  value?: string | null;
  preferredField?: string;
  tone?: "negative";
}) {
  return (
    <section
      className={
        tone === "negative"
          ? "detail-section detail-section-negative"
          : "detail-section"
      }
    >
      <span className="section-label">{label}</span>
      <ReadableValue value={value} preferredField={preferredField} />
    </section>
  );
}

function ReadableValue({
  value,
  preferredField
}: {
  value?: string | null;
  preferredField?: string;
}) {
  const parsed = parseJsonText(value);
  const items = readableItems(parsed.value, preferredField);
  return (
    <div className="readable-value">
      {parsed.error && <p className="parse-warning">{parsed.error}</p>}
      {items.length === 0 ? (
        <p className="quiet">Not recorded.</p>
      ) : (
        <ol className="readable-list">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ol>
      )}
      {parsed.value !== null && typeof parsed.value !== "string" && (
        <details className="technical-details">
          <summary>Trace IDs and raw payload</summary>
          <ParsedValue parsed={parsed} />
        </details>
      )}
    </div>
  );
}

function TraceabilitySection({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  const parsed = parseJsonText(value);
  const root = isRecord(parsed.value) ? parsed.value : null;
  const sourceRules = root ? readableItems(root.sourceRules) : [];
  const usedReferences = root ? readableItems(root.usedReferences) : [];
  const missingReferences = root ? readableItems(root.missingReferences) : [];
  const claims = root ? readableItems(root.claims) : [];

  return (
    <section className="detail-section">
      <span className="section-label">{label}</span>
      <div className="trace-summary">
        <Field label="Rule" value={stringValue(root?.ruleId)} />
        <Field
          label="Source version"
          value={stringValue(root?.sourceVersionNumber)}
        />
        <Field label="Intent" value={stringValue(root?.testIntentId)} />
        <Field
          label="Oracle"
          value={stringValue(recordValue(root?.oracleBinding, "outcome"))}
        />
      </div>
      <ReadableGroup title="Source rules" items={sourceRules} />
      <ReadableGroup title="Used references" items={usedReferences} />
      <ReadableGroup title="Missing references" items={missingReferences} />
      <ReadableGroup title="Claims" items={claims} />
      {parsed.value !== null && (
        <details className="technical-details">
          <summary>Trace IDs and raw payload</summary>
          <ParsedValue parsed={parsed} />
        </details>
      )}
    </section>
  );
}

function BddNormalizedSummary({ value }: { value?: string | null }) {
  const parsed = parseJsonText(value);
  const root = isRecord(parsed.value) ? parsed.value : null;
  const scenarios = Array.isArray(root?.scenarios) ? root.scenarios : [];
  return (
    <section className="detail-section">
      <span className="section-label">BDD review summary</span>
      <FieldGrid>
        <Field
          label="Feature goal"
          value={stringValue(recordValue(root?.feature, "description"))}
        />
        <Field
          label="Rule under test"
          value={stringValue(recordValue(root?.ruleUnderTest, "ruleId"))}
        />
      </FieldGrid>
      {scenarios.map((scenario, index) => {
        const scenarioRecord = isRecord(scenario) ? scenario : {};
        return (
          <article className="scenario-summary" key={index}>
            <h3>{stringValue(scenarioRecord.title) ?? `Scenario ${index + 1}`}</h3>
            <FieldGrid>
              <Field label="Objective" value={stringValue(scenarioRecord.objective)} />
              <Field
                label="Assertion target"
                value={stringValue(scenarioRecord.assertionTarget)}
              />
            </FieldGrid>
            <ReadableGroup
              title="Scenario steps"
              items={readableItems(scenarioRecord.steps)}
            />
            <ReadableGroup
              title="Oracle evidence"
              items={readableItems(scenarioRecord.oracleEvidence)}
            />
          </article>
        );
      })}
      {parsed.value !== null && (
        <details className="technical-details">
          <summary>Normalized BDD JSON</summary>
          <ParsedValue parsed={parsed} />
        </details>
      )}
    </section>
  );
}

function ReadableGroup({
  title,
  items
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="readable-group">
      <strong>{title}</strong>
      <ol className="readable-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

function CheckerResultCard({ result }: { result: BddCheckerResult }) {
  return (
    <div className="stack compact checker-card">
      <div className="score-row">
        <div>
          <span className="score">{result.totalScore}</span>
          <small>Total score</small>
        </div>
        <StatusBadge value={result.isPassing ? "PASS" : result.blockingCategory} />
      </div>
      <StatusBadge value={result.readiness} />
      <ReadableGroup title="Findings" items={result.findings} />
      <ReadableGroup title="Recommended actions" items={result.recommendedActions} />
      <dl className="compact-definitions">
        {Object.entries(result.dimensionScores).map(([key, value]) => (
          <ReactFragment key={key}>
            <dt>{humanize(key)}</dt>
            <dd>{value}</dd>
          </ReactFragment>
        ))}
      </dl>
      <small className="quiet">{formatDate(result.checkedAt)}</small>
    </div>
  );
}

function ParsedValue({
  parsed
}: {
  parsed: ReturnType<typeof parseJsonText>;
}) {
  return (
    <>
      {parsed.error && <p className="parse-warning">{parsed.error}</p>}
      <pre className="json-value">
        {parsed.value === null
          ? "Not recorded"
          : typeof parsed.value === "string"
            ? parsed.value
            : JSON.stringify(parsed.value, null, 2)}
      </pre>
    </>
  );
}

function IntegrityLine({
  label,
  valid
}: {
  label: string;
  valid: boolean;
}) {
  return (
    <div className="integrity-line">
      <span>{label}</span>
      <StatusBadge value={valid ? "VALID_JSON" : "RAW_TEXT"} />
    </div>
  );
}

function Callout({
  tone,
  title,
  children
}: {
  tone: "negative" | "neutral";
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={`callout ${tone}`}>
      <strong>{title}</strong>
      <p>{children}</p>
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status-badge ${statusTone(value)}`}>
      {humanize(value)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function WelcomeCard({ title, text }: { title: string; text: string }) {
  return (
    <article>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">0</span>
      <strong>{title}</strong>
      <p>The service returned an empty persisted collection.</p>
    </div>
  );
}

function bddDisabledReason(
  testCase: GeneratedTestCase,
  existing?: BddScenario
): string | null {
  if (existing) {
    return "Current BDD draft already exists.";
  }
  if (!testCase.isLatest) {
    return "Use the latest test-case version.";
  }
  if (!["READY", "VERIFIED", "APPROVED"].includes(testCase.status)) {
    return `Requires READY, VERIFIED, or APPROVED. Current: ${humanize(testCase.status)}.`;
  }
  return null;
}

function readableItems(value: unknown, preferredField?: string): string[] {
  if (value === null || value === undefined || value === "") {
    return [];
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => readableItems(item));
  }
  if (!isRecord(value)) {
    return [String(value)];
  }
  if (preferredField && preferredField in value) {
    return readableItems(value[preferredField]);
  }
  if ("keyword" in value && "text" in value) {
    return [`${stringValue(value.keyword) ?? "Step"} ${stringValue(value.text) ?? ""}`.trim()];
  }
  if ("title" in value && "version" in value) {
    return [`${stringValue(value.title)} (${stringValue(value.version)})`];
  }
  if ("ruleId" in value && "versionNumber" in value) {
    return [`${stringValue(value.ruleId)} v${stringValue(value.versionNumber)}`];
  }
  if ("claimId" in value && "claimType" in value) {
    return [`${stringValue(value.claimType)}: ${stringValue(value.claimId)}`];
  }
  return Object.entries(value)
    .filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")
    .map(([key, entry]) => `${humanize(key)}: ${stringValue(entry) ?? JSON.stringify(entry)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function preserveSelection<T extends { id: string }>(
  current: string | null,
  values: T[]
): string | null {
  if (current && values.some((value) => value.id === current)) {
    return current;
  }
  return values[0]?.id ?? null;
}

function preferredBddSelection(scenarios: BddScenario[]): BddScenario[] {
  const current = currentBddScenarios(scenarios);
  return current.length > 0 ? current : sortBddScenarios(scenarios);
}

function tcgSkillChain(skills: Skill[]): Array<{
  name: string;
  displayName: string;
  description: string;
  category: string;
  workflowStage: string;
  stageLabel: string;
  status: string;
  versionLabel: string;
  registryId?: string;
}> {
  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  return [
    {
      name: "test-case-generator",
      displayName: "TCG Test Case Maker",
      description:
        "Generates governed GeneratedTestCase drafts from approved rule versions through the Stage 2 domain chain.",
      category: "EXTRACTOR",
      workflowStage: "TEST_CASE",
      stageLabel: "Test Case Maker"
    },
    {
      name: "test-case-checker",
      displayName: "TCG Test Case Checker",
      description:
        "Scores generated test-case drafts and records advisory checker/confidence outputs.",
      category: "CHECKER",
      workflowStage: "TEST_CASE",
      stageLabel: "Test Case Checker"
    },
    {
      name: "bdd-draft-generator",
      displayName: "BDD Maker",
      description:
        "Generates governed BDD draft scenarios from latest eligible reviewed test cases.",
      category: "EXTRACTOR",
      workflowStage: "BDD",
      stageLabel: "BDD Maker"
    },
    {
      name: "bdd-draft-checker",
      displayName: "BDD Checker",
      description:
        "Checks BDD drafts for source alignment, GWT quality, assertion clarity, unsupported inference, and draft readiness.",
      category: "CHECKER",
      workflowStage: "BDD",
      stageLabel: "BDD Checker"
    }
  ].map((fallback) => {
    const registered = byName.get(fallback.name);
    return {
      ...fallback,
      displayName: registered?.displayName ?? fallback.displayName,
      description: registered?.description ?? fallback.description,
      category: registered?.category ?? fallback.category,
      workflowStage: registered?.workflowStage ?? fallback.workflowStage,
      status: registered?.status ?? "DEFINED",
      versionLabel:
        registered?.version !== undefined
          ? `v${registered.version}`
          : "manual",
      registryId: registered?.id
    };
  });
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Unknown request failure.";
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
