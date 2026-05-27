import { Navigate, useParams } from 'react-router-dom'

export function WorkflowOverviewPage() {
  const { workflowId = '' } = useParams()
  return <Navigate to={`/workflows/${encodeURIComponent(workflowId)}/semantic`} replace />
}
