import { AlertTriangle, RefreshCw, Upload, X } from 'lucide-react'
import type { UnknownTerm } from '../api'
import { Button } from './ui'

export function UnknownTermsModal({
  jobType,
  unknownTerms,
  onClose,
  onUploadDocs,
  onRetry,
}: {
  jobType: string
  unknownTerms: UnknownTerm[]
  onClose: () => void
  onUploadDocs: () => void
  onRetry: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#101828]/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-[600px] flex-col rounded-lg border border-[#f7b4ae] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#f7b4ae] bg-[#fff1f0] px-5 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#b42318]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#b42318]">Knowledge Gap Detected</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[#b42318] hover:bg-[#fde8e8] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          <p className="text-sm text-[#475467]">
            <strong className="text-[#172033]">{jobType}</strong> job failed —{' '}
            {unknownTerms.length} term{unknownTerms.length === 1 ? '' : 's'} could not be found in
            the knowledge base. Upload documents covering these topics, then retry.
          </p>

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase text-[#667085]">
              Missing terms ({unknownTerms.length})
            </h3>
            <div className="mt-2 max-h-64 overflow-auto rounded-md border border-[#e3e8f0] bg-[#f8fafc]">
              {unknownTerms.map((term, i) => (
                <div
                  key={i}
                  className="border-b border-[#e3e8f0] px-4 py-2.5 last:border-0"
                >
                  <p className="text-sm font-medium text-[#172033]">{term.query}</p>
                  <p className="mt-0.5 text-xs text-[#98a2b3]">{term.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex justify-end gap-3 border-t border-[#e3e8f0] bg-[#f8fafc] px-5 py-3">
          <Button variant="secondary" onClick={onUploadDocs}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload Knowledge Documents
          </Button>
          <Button variant="primary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry Extraction
          </Button>
        </div>
      </div>
    </div>
  )
}
