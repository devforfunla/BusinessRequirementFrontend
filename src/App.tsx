import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ApprovalPage } from './pages/ApprovalPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { HistoryPage } from './pages/HistoryPage'
import { SemanticGroupPage } from './pages/SemanticGroupPage'
import { SkillsPage } from './pages/SkillsPage'
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
        <Route path="/workflows/:workflowId/semantic/:semanticRuleId" element={<SemanticGroupPage />} />
        <Route path="/workflows/:workflowId/approval" element={<ApprovalPage />} />
        <Route path="/workflows/:workflowId/history" element={<HistoryPage />} />
        <Route path="/skills" element={<SkillsPage />} />
      </Route>
    </Routes>
  )
}
