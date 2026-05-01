import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'
import useSchemaStore from '../../store/useSchemaStore'

// ── Type badge colours ────────────────────────────────────────────────────────
const TYPE_COLORS = {
  // Numeric
  BIGINT:    'bg-blue-100   text-blue-700',
  INT:       'bg-blue-100   text-blue-700',
  INTEGER:   'bg-blue-100   text-blue-700',
  SMALLINT:  'bg-blue-100   text-blue-700',
  TINYINT:   'bg-blue-100   text-blue-700',
  DECIMAL:   'bg-yellow-100 text-yellow-700',
  FLOAT:     'bg-yellow-100 text-yellow-700',
  DOUBLE:    'bg-yellow-100 text-yellow-700',
  // String
  VARCHAR:   'bg-purple-100 text-purple-700',
  CHAR:      'bg-purple-100 text-purple-700',
  TEXT:      'bg-purple-100 text-purple-700',
  LONGTEXT:  'bg-purple-100 text-purple-700',
  ENUM:      'bg-pink-100   text-pink-700',
  // Date / Time
  DATE:      'bg-orange-100 text-orange-700',
  TIME:      'bg-orange-100 text-orange-700',
  DATETIME:  'bg-orange-100 text-orange-700',
  TIMESTAMP: 'bg-orange-100 text-orange-700',
  // Binary
  BLOB:      'bg-slate-100  text-slate-600',
  MEDIUMBLOB:'bg-slate-100  text-slate-600',
  LONGBLOB:  'bg-slate-100  text-slate-600',
  // Other
  BOOLEAN:   'bg-green-100  text-green-700',
  JSON:      'bg-cyan-100   text-cyan-700',
  UUID:      'bg-indigo-100 text-indigo-700',
}
const TYPE_COLORS_DARK = {
  // Numeric
  BIGINT:    'dark:bg-blue-950   dark:text-blue-300',
  INT:       'dark:bg-blue-950   dark:text-blue-300',
  INTEGER:   'dark:bg-blue-950   dark:text-blue-300',
  SMALLINT:  'dark:bg-blue-950   dark:text-blue-300',
  TINYINT:   'dark:bg-blue-950   dark:text-blue-300',
  DECIMAL:   'dark:bg-yellow-950 dark:text-yellow-300',
  FLOAT:     'dark:bg-yellow-950 dark:text-yellow-300',
  DOUBLE:    'dark:bg-yellow-950 dark:text-yellow-300',
  // String
  VARCHAR:   'dark:bg-purple-950 dark:text-purple-300',
  CHAR:      'dark:bg-purple-950 dark:text-purple-300',
  TEXT:      'dark:bg-purple-950 dark:text-purple-300',
  LONGTEXT:  'dark:bg-purple-950 dark:text-purple-300',
  ENUM:      'dark:bg-pink-950   dark:text-pink-300',
  // Date / Time
  DATE:      'dark:bg-orange-950 dark:text-orange-300',
  TIME:      'dark:bg-orange-950 dark:text-orange-300',
  DATETIME:  'dark:bg-orange-950 dark:text-orange-300',
  TIMESTAMP: 'dark:bg-orange-950 dark:text-orange-300',
  // Binary
  BLOB:      'dark:bg-slate-800  dark:text-slate-300',
  MEDIUMBLOB:'dark:bg-slate-800  dark:text-slate-300',
  LONGBLOB:  'dark:bg-slate-800  dark:text-slate-300',
  // Other
  BOOLEAN:   'dark:bg-green-950  dark:text-green-300',
  JSON:      'dark:bg-cyan-950   dark:text-cyan-300',
  UUID:      'dark:bg-indigo-950 dark:text-indigo-300',
}

export default function TableNode({ id, data, selected }) {
  const { updateNodeData } = useSchemaStore()

  const [editingNote, setEditingNote] = useState(false)
  const [noteText,    setNoteText]    = useState('')

  const hasNote = !!(data.annotation && data.annotation.trim())

  const openNote = (e) => {
    e.stopPropagation()
    setNoteText(data.annotation || '')
    setEditingNote(true)
  }
  const saveNote = () => {
    const trimmed = noteText.trim()
    if (trimmed !== (data.annotation || '').trim()) {
      updateNodeData(id, { annotation: trimmed || null })
    }
    setEditingNote(false)
  }
  const clearNote = (e) => {
    e.stopPropagation()
    updateNodeData(id, { annotation: null })
    setEditingNote(false)
    setNoteText('')
  }

  // Shared handle class — small teal dots shown at column-row edges
  const colHandleCls = [
    '!w-2 !h-2 !rounded-full',
    '!bg-blue-400 dark:!bg-blue-500',
    '!border !border-white dark:!border-[#1c1f2e]',
    '!opacity-0 group-hover/node:!opacity-100',
    'transition-opacity duration-150',
  ].join(' ')

  return (
    <div
      className={`group/node rounded-xl shadow-md border-2 min-w-[220px] max-w-[280px]
                  transition-all duration-150
                  bg-white dark:bg-[#1c1f2e]
                  ${selected
                    ? 'border-blue-500 shadow-blue-200 dark:shadow-blue-900/40 shadow-lg'
                    : 'border-gray-200 dark:border-[#2d3247]'}`}
    >

      {/* ── Table header ─────────────────────────────────────────────────── */}
      <div className="group bg-blue-600 dark:bg-blue-800 rounded-t-xl px-4 py-2.5
                      flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-blue-200 flex-shrink-0" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M3 6h18M3 14h18M3 18h18"/>
          </svg>
          <span className="text-white font-semibold text-sm truncate">{data.name}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="text-blue-200 dark:text-blue-300 text-xs">
            {data.columns?.length || 0} col{data.columns?.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={openNote}
            title={hasNote ? 'Edit note' : 'Add note'}
            className={`nodrag nopan p-0.5 rounded transition-all leading-none
              ${hasNote
                ? 'text-yellow-300 opacity-100'
                : 'text-blue-200 opacity-0 group-hover:opacity-100 hover:text-yellow-200'}`}>
            <MessageSquare className="w-3 h-3" fill={hasNote ? 'currentColor' : 'none'}/>
          </button>
        </div>
      </div>

      {/* ── Column rows — each row gets its own left + right handle ──────── */}
      <div className="divide-y divide-gray-100 dark:divide-[#252a3e]">
        {data.columns?.map((col) => (
          <div
            key={col.id}
            // `relative` is required so Handle children with position:absolute
            // are measured within this row by React Flow's getBoundingClientRect.
            className="relative px-3 py-2 flex items-center justify-between gap-2
                       hover:bg-gray-50 dark:hover:bg-[#252a3e] transition-colors"
          >
            {/* Left column handle */}
            <Handle
              type="source"
              position={Position.Left}
              id={`col-${col.id}-left`}
              className={colHandleCls}
            />

            {/* Left side: key icon + name */}
            <div className="flex items-center gap-1.5 min-w-0">
              {col.pk ? (
                <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1C8.676 1 6 3.676 6 7c0 2.65 1.628 4.934 4 5.745V21h2v-2h2v-2h-2v-2h2v-2h-2v-1.255C14.372 11.934 16 9.65 16 7c0-3.324-2.676-6-4-6zm0 2c2.206 0 4 1.794 4 4s-1.794 4-4 4-4-1.794-4-4 1.794-4 4-4zm0 1a3 3 0 100 6 3 3 0 000-6z"/>
                </svg>
              ) : col.fk ? (
                <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1"/>
                </svg>
              ) : (
                <div className="w-3 h-3 flex-shrink-0"/>
              )}

              <span className={`text-xs truncate
                ${col.pk
                  ? 'font-semibold text-gray-800 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400'}`}>
                {col.name}
              </span>

              {col.nullable && (
                <span className="text-gray-300 dark:text-gray-600 text-xs flex-shrink-0">?</span>
              )}
            </div>

            {/* Right side: type badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0
              ${TYPE_COLORS[col.type]      || 'bg-gray-100  text-gray-600'}
              ${TYPE_COLORS_DARK[col.type] || 'dark:bg-slate-800 dark:text-slate-300'}`}>
              {col.type}
            </span>

            {/* Right column handle */}
            <Handle
              type="source"
              position={Position.Right}
              id={`col-${col.id}-right`}
              className={colHandleCls}
            />
          </div>
        ))}

        {(!data.columns || data.columns.length === 0) && (
          <div className="px-3 py-3 text-center text-gray-300 dark:text-gray-600 text-xs">
            No columns yet
          </div>
        )}
      </div>

      {/* ── Sticky note ──────────────────────────────────────────────────── */}
      {(hasNote || editingNote) && (
        <div
          className="nodrag nopan border-t border-yellow-300 dark:border-yellow-600/40"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {editingNote ? (
            <textarea
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={saveNote}
              onKeyDown={e => {
                if (e.key === 'Escape') { setEditingNote(false); setNoteText(data.annotation || '') }
                e.stopPropagation()
              }}
              placeholder="Add a note…"
              rows={3}
              className="nodrag nopan w-full px-3 py-2 text-[11px] leading-relaxed
                         resize-none outline-none border-none
                         bg-yellow-100 dark:bg-yellow-900/30
                         text-yellow-900 dark:text-yellow-200
                         placeholder:text-yellow-500 dark:placeholder:text-yellow-700
                         rounded-b-[10px]"
            />
          ) : (
            <div
              className="group/note relative px-3 py-2 cursor-pointer
                         bg-yellow-100 dark:bg-yellow-900/30 rounded-b-[10px]"
              onClick={openNote}
            >
              <p className="text-[11px] leading-relaxed break-words whitespace-pre-wrap pr-5
                            text-yellow-900 dark:text-yellow-200">
                {data.annotation}
              </p>
              <button
                onClick={clearNote}
                title="Remove note"
                className="nodrag nopan absolute top-1.5 right-1.5
                           text-yellow-500 dark:text-yellow-600
                           hover:text-yellow-700 dark:hover:text-yellow-400
                           opacity-0 group-hover/note:opacity-100
                           transition-opacity leading-none text-xs font-bold">
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Legacy 4-point handles (hidden, kept for backward-compat) ─────
           Existing saved edges that stored sourceHandle/targetHandle as
           "top"/"bottom"/"left"/"right" continue to anchor here.
           New connections use the per-column handles above instead.     ── */}
      <Handle type="source" position={Position.Top}
        id="top"    style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, pointerEvents: 'none' }}/>
      <Handle type="source" position={Position.Bottom}
        id="bottom" style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, pointerEvents: 'none' }}/>
      <Handle type="source" position={Position.Left}
        id="left"   style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, pointerEvents: 'none' }}/>
      <Handle type="source" position={Position.Right}
        id="right"  style={{ opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, pointerEvents: 'none' }}/>
    </div>
  )
}
