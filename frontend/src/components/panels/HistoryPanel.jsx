import { useEffect, useState } from 'react'
import api from '../../services/api'
import ConfirmModal from '../ui/ConfirmModal'

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoryPanel({ schemaId, onRestore, onClose }) {
  const [versions,        setVersions]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [restoreTarget,   setRestoreTarget]   = useState(null)   // version to confirm
  const [restoring,       setRestoring]       = useState(false)

  useEffect(() => {
    if (!schemaId) return
    setLoading(true)
    setError('')
    api.get(`/schemas/${schemaId}/versions`)
      .then(res => setVersions(res.data))
      .catch(() => setError('Failed to load version history.'))
      .finally(() => setLoading(false))
  }, [schemaId])

  const confirmRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const res = await api.post(`/schemas/${schemaId}/versions/${restoreTarget.id}/restore`)
      onRestore(res.data.schema_json)
      // Refresh list so new current is highlighted
      const updated = await api.get(`/schemas/${schemaId}/versions`)
      setVersions(updated.data)
    } catch {
      setError('Restore failed. Please try again.')
    } finally {
      setRestoring(false)
      setRestoreTarget(null)
    }
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500"/>
          <h3 className="font-semibold text-gray-800 text-sm">Version History</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin w-6 h-6 mb-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <p className="text-xs">Loading history…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="font-medium text-gray-600 text-sm mb-1">No saves yet</p>
            <p className="text-xs text-gray-400">Save your schema to start building version history.</p>
          </div>
        )}

        {/* Version list */}
        {!loading && !error && versions.length > 0 && (
          <div className="p-3 space-y-2">
            {versions.map((v, idx) => (
              <div
                key={v.id}
                className={`rounded-xl border p-3 transition-all
                  ${v.is_current
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Version badge + label */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded
                        ${v.is_current
                          ? 'bg-indigo-200 text-indigo-700'
                          : 'bg-gray-100 text-gray-500'}`}>
                        v{v.version_number}
                      </span>
                      {v.is_current && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-100
                                         px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      {v.label && (
                        <span className="text-xs text-gray-500 italic truncate">{v.label}</span>
                      )}
                    </div>

                    {/* Timestamp + author */}
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span title={formatDate(v.created_at)}>{timeAgo(v.created_at)}</span>
                      <span className="text-gray-300">·</span>
                      <span className="truncate">{v.created_by}</span>
                    </p>
                  </div>

                  {/* Restore button */}
                  {!v.is_current && (
                    <button
                      onClick={() => setRestoreTarget(v)}
                      className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg
                                 border border-indigo-200 text-indigo-600 bg-white
                                 hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {!loading && versions.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            {versions.length} save{versions.length !== 1 ? 's' : ''} · restoring doesn't delete history
          </p>
        </div>
      )}

      {/* Confirm restore modal */}
      <ConfirmModal
        open={!!restoreTarget}
        variant="warning"
        title={`Restore to v${restoreTarget?.version_number}?`}
        message={`This will load the v${restoreTarget?.version_number} snapshot onto the canvas${restoreTarget?.label ? ` ("${restoreTarget.label}")` : ''}. Your unsaved changes will be lost. Save first if you want to keep them.`}
        confirmText={restoring ? 'Restoring…' : 'Restore'}
        cancelText="Cancel"
        onConfirm={confirmRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  )
}
