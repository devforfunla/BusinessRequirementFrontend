import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AppState = {
  reviewerId: string
  selectedDocumentId: string | null
  selectedWorkflowId: string | null
  setReviewerId: (reviewerId: string) => void
  setDocumentId: (documentId: string | null) => void
  setWorkflowId: (workflowId: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      reviewerId: 'reviewer-poc',
      selectedDocumentId: null,
      selectedWorkflowId: null,
      setReviewerId: (reviewerId) => set({ reviewerId }),
      setDocumentId: (selectedDocumentId) => set({ selectedDocumentId }),
      setWorkflowId: (selectedWorkflowId) => set({ selectedWorkflowId }),
    }),
    {
      name: 'business-requirement-ui',
      partialize: (state) => ({
        reviewerId: state.reviewerId,
        selectedDocumentId: state.selectedDocumentId,
        selectedWorkflowId: state.selectedWorkflowId,
      }),
    },
  ),
)
