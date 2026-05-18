import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import ConfirmModal from '../ui/ConfirmModal'
import { diffVersions } from '../../utils/diffVersions'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function versionLabel(v) {
  return v ? `v${v.version_number}${v.label ? ` — ${v.label}` : ''}` : '—'
}

// ── Diff sub-components ───────────────────────────────────────────────────────

/** One collapsible section (Added / Removed / Modified / Edges). */
function DiffSection({ title, count, accentCls, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  if (count === 0) return null
  return (
    <div className="border rounded-xl overflow-hidden
                    border-gray-200 dark:border-[#252a3e]">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left
                    ${open ? accentCls.header : 'bg-gray-50 dark:bg-[#1c1f2e]'}
                    transition-colors`}
      >
        <span className="text-xs font-semibold tracking-wide uppercase
                         text-gray-700 dark:text-gray-200">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                            ${accentCls.badge}`}>
            {count}
          </span>
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-[#252a3e]">
          {children}
        </div>
      )}
    </div>
  )
}

/** A single column change row inside a modified table card. */
function ColChangeRow({ change }) {
  const { kind, col, fieldDiffs } = change

  if (kind === 'added') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1">
        <span className="text-green-500 font-bold text-xs leading-none">+</span>
        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{col.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{col.type}</span>
      </div>
    )
  }

  if (kind === 'removed') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1">
        <span className="text-red-500 font-bold text-xs leading-none">−</span>
        <span className="text-xs font-mono line-through text-gray-500 dark:text-gray-500">{col.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">{col.type}</span>
      </div>
    )
  }

  // changed
  return (
    <div className="px-3 py-1.5 space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-amber-500 font-bold text-xs leading-none">~</span>
        <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">{col.name}</span>
      </div>
      {Object.entries(fieldDiffs).map(([field, { from, to }]) => (
        <div key={field} className="pl-4 flex items-center gap-1 text-[10px]">
          <span className="text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide w-20 flex-shrink-0">
            {field}
          </span>
          <span className="font-mono text-red-500 line-through">{String(from)}</span>
          <span className="text-gray-400">→</span>
          <span className="font-mono text-green-500">{String(to)}</span>
        </div>
      ))}
    </div>
  )
}

/** A table row for added/removed/modified tables. */
function TableDiffRow({ entry, kind, onFocusNode }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = kind === 'modified' && entry.colChanges.length > 0

  const rowBg = kind === 'added'
    ? 'bg-green-50 dark:bg-green-950/20'
    : kind === 'removed'
    ? 'bg-red-50 dark:bg-red-950/20'
    : 'bg-amber-50 dark:bg-amber-950/20'

  const nameCls = kind === 'added'
    ? 'text-green-700 dark:text-green-400'
    : kind === 'removed'
    ? 'text-red-700 dark:text-red-400 line-through'
    : 'text-amber-700 dark:text-amber-400'

  const prefix = kind === 'added' ? '+' : kind === 'removed' ? '−' : '~'
  const prefixCls = kind === 'added'
    ? 'text-green-500'
    : kind === 'removed'
    ? 'text-red-500'
    : 'text-amber-500'

  return (
    <div className={rowBg}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`font-bold text-xs flex-shrink-0 ${prefixCls}`}>{prefix}</span>

        <div className="flex-1 min-w-0">
          {/* Table name — clickable if we can focus it */}
          {kind !== 'removed' && onFocusNode ? (
            <button
              onClick={() => onFocusNode(entry.id)}
              className={`text-xs font-semibold font-mono truncate text-left
                          hover:underline underline-offset-2 ${nameCls}`}
            >
              {entry.name}
            </button>
          ) : (
            <span className={`text-xs font-semibold font-mono truncate block ${nameCls}`}>
              {kind === 'modified' && entry.nameChanged
                ? <>{entry.oldName} <span className="text-gray-400 no-underline not-italic">→</span> {entry.name}</>
                : entry.name}
            </span>
          )}

          {/* Summary for added/removed */}
          {kind !== 'modified' && entry.columns.length > 0 && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {entry.columns.length} column{entry.columns.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Summary for modified */}
          {kind === 'modified' && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {entry.colChanges.length} column change{entry.colChanges.length !== 1 ? 's' : ''}
              {entry.nameChanged ? ' · renamed' : ''}
            </p>
          )}
        </div>

        {hasDetails && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded
                       border border-amber-300 dark:border-amber-700
                       text-amber-600 dark:text-amber-400
                       bg-amber-100 dark:bg-amber-900/30
                       hover:bg-amber-200 dark:hover:bg-amber-900/60
                       transition-colors"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="pb-2 border-t border-amber-200 dark:border-amber-900/40
                        bg-amber-50/80 dark:bg-amber-950/10 space-y-0.5">
          {entry.colChanges.map((c, i) => (
            <ColChangeRow key={i} change={c} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Edge change row (added/removed). */
function EdgeRow({ edge, kind }) {
  const prefix    = kind === 'added' ? '+' : '−'
  const prefixCls = kind === 'added' ? 'text-green-500' : 'text-red-500'
  const textCls   = kind === 'added'
    ? 'text-green-700 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
  const bgCls     = kind === 'added'
    ? 'bg-green-50 dark:bg-green-950/20'
    : 'bg-red-50 dark:bg-red-950/20'

  const relType = edge.data?.relationshipType || edge.data?.diagramType || ''

  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${bgCls}`}>
      <span className={`font-bold text-xs flex-shrink-0 ${prefixCls}`}>{prefix}</span>
      <span className={`text-xs font-mono flex-1 min-w-0 truncate ${textCls}`}>
        {edge._sourceName} → {edge._targetName}
      </span>
      {relType && (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 font-mono">
          {relType}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoryPanel({ schemaId, onRestore, onClose, onFocusNode }) {
  const [versions,      setVersions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoring,     setRestoring]     = useState(false)

  // Compare mode state
  const [compareMode,     setCompareMode]     = useState(false)
  const [compareBaseId,   setCompareBaseId]   = useState(null)
  const [compareTargetId, setCompareTargetId] = useState(null)

  useEffect(() => {
    if (!schemaId) return
    setLoading(true)
    setError('')
    api.get(`/schemas/${schemaId}/versions`)
      .then(res => setVersions(res.data))
      .catch(() => setError('Failed to load version history.'))
      .finally(() => setLoading(false))
  }, [schemaId])

  // Restore logic
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

  // Enter compare mode: base = clicked version, target = current
  const enterCompare = (version) => {
    const current = versions.find(v => v.is_current)
    setCompareBaseId(version.id)
    setCompareTargetId(current?.id ?? version.id)
    setCompareMode(true)
  }

  const exitCompare = () => {
    setCompareMode(false)
    setCompareBaseId(null)
    setCompareTargetId(null)
  }

  // Resolved version objects for compare
  const compareBase   = useMemo(() => versions.find(v => v.id === compareBaseId),   [versions, compareBaseId])
  const compareTarget = useMemo(() => versions.find(v => v.id === compareTargetId), [versions, compareTargetId])

  // Compute diff
  const diff = useMemo(() => {
    if (!compareBase?.schema_json || !compareTarget?.schema_json) return null
    return diffVersions(compareBase.schema_json, compareTarget.schema_json)
  }, [compareBase, compareTarget])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-80 flex flex-col h-full shadow-lg
                    bg-white dark:bg-[#141620]
                    border-l border-gray-200 dark:border-[#252a3e]
                    transition-colors duration-200">

      {/* ── Header ── */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0
                      bg-gray-50 dark:bg-[#0f1117]
                      border-gray-100 dark:border-[#252a3e]">
        <div className="flex items-center gap-2">
          {compareMode && (
            <button
              onClick={exitCompare}
              className="p-1 rounded transition-colors mr-0.5
                         text-gray-400 dark:text-gray-500
                         hover:text-gray-600 dark:hover:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-[#252a3e]"
              title="Back to history"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          <div className={`w-2 h-2 rounded-full flex-shrink-0
                          ${compareMode ? 'bg-violet-500' : 'bg-indigo-500'}`}/>
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            {compareMode ? 'Compare Versions' : 'Version History'}
          </h3>
        </div>
        <button
          onClick={compareMode ? exitCompare : onClose}
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

      {/* ── Compare mode ── */}
      {compareMode ? (
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Version pickers */}
          <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0
                          border-b border-gray-100 dark:border-[#252a3e]">
            {/* Base (from) */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1
                                 text-gray-400 dark:text-gray-500">
                Base (from)
              </label>
              <select
                value={compareBaseId ?? ''}
                onChange={e => setCompareBaseId(Number(e.target.value))}
                className="w-full text-xs rounded-lg border px-2 py-1.5
                           bg-white dark:bg-[#1c1f2e]
                           border-gray-200 dark:border-[#2d3247]
                           text-gray-800 dark:text-gray-100
                           focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{versionLabel(v)}</option>
                ))}
              </select>
            </div>

            {/* Target (to) */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1
                                 text-gray-400 dark:text-gray-500">
                Target (to)
              </label>
              <select
                value={compareTargetId ?? ''}
                onChange={e => setCompareTargetId(Number(e.target.value))}
                className="w-full text-xs rounded-lg border px-2 py-1.5
                           bg-white dark:bg-[#1c1f2e]
                           border-gray-200 dark:border-[#2d3247]
                           text-gray-800 dark:text-gray-100
                           focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{versionLabel(v)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Diff results */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">

            {/* Same version selected */}
            {compareBaseId === compareTargetId && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3
                                bg-gray-100 dark:bg-[#252a3e]">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Select two different versions to compare.
                </p>
              </div>
            )}

            {/* No diff yet */}
            {compareBaseId !== compareTargetId && !diff && (
              <div className="flex items-center justify-center py-10">
                <svg className="animate-spin w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
            )}

            {/* Identical schemas */}
            {compareBaseId !== compareTargetId && diff?.isEmpty && (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3
                                bg-green-100 dark:bg-green-950/40">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">No differences found</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  These two versions are identical.
                </p>
              </div>
            )}

            {/* Diff results */}
            {compareBaseId !== compareTargetId && diff && !diff.isEmpty && (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-1.5 flex-wrap pb-1">
                  {diff.totals.added > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                     bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400">
                      +{diff.totals.added} added
                    </span>
                  )}
                  {diff.totals.removed > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                     bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                      −{diff.totals.removed} removed
                    </span>
                  )}
                  {diff.totals.modified > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                     bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                      ~{diff.totals.modified} modified
                    </span>
                  )}
                  {(diff.totals.edgesAdded + diff.totals.edgesRemoved) > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                     bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400">
                      {diff.totals.edgesAdded + diff.totals.edgesRemoved} edge{diff.totals.edgesAdded + diff.totals.edgesRemoved !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Added tables */}
                <DiffSection
                  title="Added Classes"
                  count={diff.tables.added.length}
                  defaultOpen
                  accentCls={{
                    header: 'bg-green-50 dark:bg-green-950/30',
                    badge:  'bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-300',
                  }}
                >
                  {diff.tables.added.map(t => (
                    <TableDiffRow key={t.id} entry={t} kind="added" onFocusNode={onFocusNode} />
                  ))}
                </DiffSection>

                {/* Removed tables */}
                <DiffSection
                  title="Removed Classes"
                  count={diff.tables.removed.length}
                  defaultOpen
                  accentCls={{
                    header: 'bg-red-50 dark:bg-red-950/30',
                    badge:  'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-300',
                  }}
                >
                  {diff.tables.removed.map(t => (
                    <TableDiffRow key={t.id} entry={t} kind="removed" onFocusNode={onFocusNode} />
                  ))}
                </DiffSection>

                {/* Modified tables */}
                <DiffSection
                  title="Modified Classes"
                  count={diff.tables.modified.length}
                  defaultOpen
                  accentCls={{
                    header: 'bg-amber-50 dark:bg-amber-950/30',
                    badge:  'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300',
                  }}
                >
                  {diff.tables.modified.map(t => (
                    <TableDiffRow key={t.id} entry={t} kind="modified" onFocusNode={onFocusNode} />
                  ))}
                </DiffSection>

                {/* Edge changes */}
                {(diff.edges.added.length + diff.edges.removed.length) > 0 && (
                  <DiffSection
                    title="Relationship Changes"
                    count={diff.edges.added.length + diff.edges.removed.length}
                    defaultOpen={false}
                    accentCls={{
                      header: 'bg-violet-50 dark:bg-violet-950/30',
                      badge:  'bg-violet-200 dark:bg-violet-900 text-violet-800 dark:text-violet-300',
                    }}
                  >
                    {diff.edges.added.map(e => (
                      <EdgeRow key={e.id} edge={e} kind="added" />
                    ))}
                    {diff.edges.removed.map(e => (
                      <EdgeRow key={e.id} edge={e} kind="removed" />
                    ))}
                  </DiffSection>
                )}
              </>
            )}
          </div>

          {/* Compare footer: Restore base button */}
          {compareBase && !compareBase.is_current && (
            <div className="px-3 py-3 border-t flex-shrink-0
                            bg-gray-50 dark:bg-[#0f1117]
                            border-gray-100 dark:border-[#252a3e]">
              <button
                onClick={() => { setRestoreTarget(compareBase); exitCompare() }}
                className="w-full text-xs font-semibold py-2 rounded-xl transition-all
                           border border-indigo-200 dark:border-indigo-700
                           text-indigo-600 dark:text-indigo-400
                           bg-white dark:bg-transparent
                           hover:bg-indigo-50 dark:hover:bg-indigo-950
                           hover:border-indigo-300 dark:hover:border-indigo-600"
              >
                Restore {versionLabel(compareBase)}
              </button>
            </div>
          )}
        </div>

      ) : (

        /* ── Version list mode ── */
        <>
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

                      {/* Action buttons */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {!v.is_current && (
                          <button
                            onClick={() => setRestoreTarget(v)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all
                                       border border-indigo-200 dark:border-indigo-700
                                       text-indigo-600 dark:text-indigo-400
                                       bg-white dark:bg-transparent
                                       hover:bg-indigo-50 dark:hover:bg-indigo-950
                                       hover:border-indigo-300 dark:hover:border-indigo-600"
                          >
                            Restore
                          </button>
                        )}
                        {versions.length > 1 && (
                          <button
                            onClick={() => enterCompare(v)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all
                                       border border-violet-200 dark:border-violet-800
                                       text-violet-600 dark:text-violet-400
                                       bg-white dark:bg-transparent
                                       hover:bg-violet-50 dark:hover:bg-violet-950
                                       hover:border-violet-300 dark:hover:border-violet-700"
                          >
                            Compare
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          {!loading && versions.length > 0 && (
            <div className="px-4 py-3 border-t flex-shrink-0
                            bg-gray-50 dark:bg-[#0f1117]
                            border-gray-100 dark:border-[#252a3e]">
              <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                {versions.length} save{versions.length !== 1 ? 's' : ''} · restoring doesn't delete history
              </p>
            </div>
          )}
        </>
      )}

      {/* Restore confirm modal */}
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
