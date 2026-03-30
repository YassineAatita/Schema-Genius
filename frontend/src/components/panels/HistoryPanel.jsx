import { useEffect, useState } from 'react'
import api from '../../services/api'
import ConfirmModal from '../ui/ConfirmModal'

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
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
  const [versions,      setVersions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoring,     setRestoring]     = useState(false)

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
    <div className="w-80 flex flex-col h-full shadow-lg
                    bg-white dark:bg-[#141620]
                    border-l border-gray-200 dark:border-[#252a3e]
                    transition-colors duration-200">

      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between
                      bg-gray-50 dark:bg-[#0f1117]
                      border-gray-100 dark:border-[#252a3e]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500"/>
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Version History</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors
                     text-gray-400 dark:text-gray-500
                     hover:text-gray-600 dark:hover:text-gray-300
                     hover:bg-gray-100 dark:hover:bg-[#252a3e]"
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
          <div className="m-4 p-3 rounded-xl text-xs
                          bg-red-50 dark:bg-red-950/40
                          border border-red-200 dark:border-red-900
                          text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3
                            bg-gray-100 dark:bg-[#252a3e]">
              <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="font-medium text-sm mb-1 text-gray-600 dark:text-gray-400">No saves yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Save your schema to start building version history.
            </p>
          </div>
        )}

        {/* Version list */}
        {!loading && !error && versions.length > 0 && (
          <div className="p-3 space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className={`rounded-xl border p-3 transition-all
                  ${v.is_current
                    ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50'
                    : 'border-gray-200 dark:border-[#252a3e] bg-white dark:bg-[#1c1f2e] hover:border-gray-300 dark:hover:border-[#2d3247]'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded
                        ${v.is_current
                          ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300'
                          : 'bg-gray-100 dark:bg-[#252a3e] text-gray-500 dark:text-gray-400'}`}>
                        v{v.version_number}
                      </span>
                      {v.is_current && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded
                                         text-indigo-600 dark:text-indigo-300
                                         bg-indigo-100 dark:bg-indigo-900">
                          Current
                        </span>
                      )}
                      {v.label && (
                        <span className="text-xs italic truncate
                                         text-gray-500 dark:text-gray-400">
                          {v.label}
                        </span>
                      )}
                    </div>

                    <p className="text-xs mt-1.5 flex items-center gap-1
                                  text-gray-400 dark:text-gray-500">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span title={formatDate(v.created_at)}>{timeAgo(v.created_at)}</span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="truncate">{v.created_by}</span>
                    </p>
                  </div>

                  {!v.is_current && (
                    <button
                      onClick={() => setRestoreTarget(v)}
                      className="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg
                                 transition-all
                                 border border-indigo-200 dark:border-indigo-700
                                 text-indigo-600 dark:text-indigo-400
                                 bg-white dark:bg-transparent
                                 hover:bg-indigo-50 dark:hover:bg-indigo-950
                                 hover:border-indigo-300 dark:hover:border-indigo-600"
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
        <div className="px-4 py-3 border-t
                        bg-gray-50 dark:bg-[#0f1117]
                        border-gray-100 dark:border-[#252a3e]">
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            {versions.length} save{versions.length !== 1 ? 's' : ''} · restoring doesn't delete history
          </p>
        </div>
      )}

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
