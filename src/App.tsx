import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ApprovalPage } from './pages/ApprovalPage'
import { ApplicationLogsPage } from './pages/ApplicationLogsPage'
import { AtomicStagePage } from './pages/AtomicStagePage'
import { DocumentsPage } from './pages/DocumentsPage'
import { HistoryPage } from './pages/HistoryPage'
import { SemanticGroupPage } from './pages/SemanticGroupPage'
import { SemanticStagePage } from './pages/SemanticStagePage'
import { SkillsPage } from './pages/SkillsPage'
import { TestCasesStagePage } from './pages/TestCasesStagePage'
import { TraceLogsPage } from './pages/TraceLogsPage'
import { WorkflowOverviewPage } from './pages/WorkflowOverviewPage'
import { WorkflowsPage } from './pages/WorkflowsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowOverviewPage />} />
        <Route path="/workflows/:workflowId/semantic" element={<SemanticStagePage />} />
        <Route path="/workflows/:workflowId/atomic" element={<AtomicStagePage />} />
        <Route path="/workflows/:workflowId/test-cases" element={<TestCasesStagePage />} />
        <Route path="/workflows/:workflowId/semantic/:semanticRuleId" element={<SemanticGroupPage />} />
        <Route path="/workflows/:workflowId/approval" element={<ApprovalPage />} />
        <Route path="/workflows/:workflowId/history" element={<HistoryPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/application-logs" element={<ApplicationLogsPage />} />
        <Route path="/trace-logs" element={<TraceLogsPage />} />
      </Route>
    </Routes>
  )
}
