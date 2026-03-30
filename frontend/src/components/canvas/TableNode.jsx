import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'
import useSchemaStore from '../../store/useSchemaStore'

// Light type-badge classes
const TYPE_COLORS = {
  BIGINT:   'bg-blue-100   text-blue-700',
  INT:      'bg-blue-100   text-blue-700',
  VARCHAR:  'bg-purple-100 text-purple-700',
  TEXT:     'bg-purple-100 text-purple-700',
  BOOLEAN:  'bg-green-100  text-green-700',
  DATE:     'bg-orange-100 text-orange-700',
  DATETIME: 'bg-orange-100 text-orange-700',
  DECIMAL:  'bg-yellow-100 text-yellow-700',
  ENUM:     'bg-pink-100   text-pink-700',
}

// Dark type-badge overrides (Tailwind dark: classes via @variant in index.css)
const TYPE_COLORS_DARK = {
  BIGINT:   'dark:bg-blue-950   dark:text-blue-300',
  INT:      'dark:bg-blue-950   dark:text-blue-300',
  VARCHAR:  'dark:bg-purple-950 dark:text-purple-300',
  TEXT:     'dark:bg-purple-950 dark:text-purple-300',
  BOOLEAN:  'dark:bg-green-950  dark:text-green-300',
  DATE:     'dark:bg-orange-950 dark:text-orange-300',
  DATETIME: 'dark:bg-orange-950 dark:text-orange-300',
  DECIMAL:  'dark:bg-yellow-950 dark:text-yellow-300',
  ENUM:     'dark:bg-pink-950   dark:text-pink-300',
}

// id is provided by React Flow alongside data and selected
export default function TableNode({ id, data, selected }) {
  const { updateNodeData } = useSchemaStore()

  const [editingNote, setEditingNote] = useState(false)
  const [noteText,    setNoteText]    = useState('')

  const hasNote = !!(data.annotation && data.annotation.trim())

  // Open the note editor — called from the header icon OR from clicking the note body
  const openNote = (e) => {
    e.stopPropagation()
    setNoteText(data.annotation || '')
    setEditingNote(true)
  }

  // onBlur of the textarea — persist whatever the user typed
  const saveNote = () => {
    const trimmed = noteText.trim()
    // Avoid a spurious updateNodeData call if nothing changed
    if (trimmed !== (data.annotation || '').trim()) {
      updateNodeData(id, { annotation: trimmed || null })
    }
    setEditingNote(false)
  }

  // × button — erase the annotation
  const clearNote = (e) => {
    e.stopPropagation()
    updateNodeData(id, { annotation: null })
    setEditingNote(false)
    setNoteText('')
  }

  return (
    <div className={`rounded-xl shadow-md border-2 min-w-[220px] max-w-[280px]
                     transition-all duration-150
                     bg-white dark:bg-[#1c1f2e]
                     ${selected
                       ? 'border-blue-500 shadow-blue-200 dark:shadow-blue-900/40 shadow-lg'
                       : 'border-gray-200 dark:border-[#2d3247]'}`}>

      {/* ── Table Header ── */}
      {/* `group` enables opacity-0 → group-hover:opacity-100 for the note icon */}
      <div className="group bg-blue-600 dark:bg-blue-800 rounded-t-xl px-4 py-2.5
                      flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 text-blue-200 flex-shrink-0" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h18M3 6h18M3 14h18M3 18h18"/>
          </svg>
          <span className="text-white font-semibold text-sm truncate">
            {data.name}
          </span>
        </div>

        {/* Right side of header: col count + note icon */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <span className="text-blue-200 dark:text-blue-300 text-xs">
            {data.columns?.length || 0} col{data.columns?.length !== 1 ? 's' : ''}
          </span>

          {/* Note icon — invisible until hover; stays visible (yellow) when a note exists */}
          <button
            onClick={openNote}
            title={hasNote ? 'Edit note' : 'Add note'}
            className={`nodrag nopan p-0.5 rounded transition-all leading-none
              ${hasNote
                ? 'text-yellow-300 opacity-100'
                : 'text-blue-200 opacity-0 group-hover:opacity-100 hover:text-yellow-200'}`}>
            <MessageSquare
              className="w-3 h-3"
              fill={hasNote ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>

      {/* ── Columns List ── */}
      <div className="divide-y divide-gray-100 dark:divide-[#252a3e]">
        {data.columns?.map((col) => (
          <div key={col.id}
            className="px-3 py-2 flex items-center justify-between gap-2
                       hover:bg-gray-50 dark:hover:bg-[#252a3e] transition-colors">

            {/* Left: key icon + column name */}
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

            {/* Right: type badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0
              ${TYPE_COLORS[col.type]      || 'bg-gray-100  text-gray-600'}
              ${TYPE_COLORS_DARK[col.type] || 'dark:bg-slate-800 dark:text-slate-300'}`}>
              {col.type}
            </span>
          </div>
        ))}

        {/* Empty columns state */}
        {(!data.columns || data.columns.length === 0) && (
          <div className="px-3 py-3 text-center text-gray-300 dark:text-gray-600 text-xs">
            No columns yet
          </div>
        )}
      </div>

      {/* ── Sticky Note ──
          Renders at the bottom of the node when a note exists or is being written.
          `nodrag nopan` prevents React Flow from treating this area as draggable.
          Handles reposition automatically as the node's height grows. */}
      {(hasNote || editingNote) && (
        <div
          className="nodrag nopan border-t border-yellow-300 dark:border-yellow-600/40"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {editingNote ? (
            /* ── Edit mode: yellow textarea ── */
            <textarea
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onBlur={saveNote}
              onKeyDown={e => {
                // Escape cancels without saving
                if (e.key === 'Escape') {
                  setEditingNote(false)
                  setNoteText(data.annotation || '')
                }
                // Prevent React Flow from capturing arrow/delete keys while typing
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
            /* ── View mode: note text + × button ── */
            <div
              className="group/note relative px-3 py-2 cursor-pointer
                         bg-yellow-100 dark:bg-yellow-900/30
                         rounded-b-[10px]"
              onClick={openNote}
            >
              <p className="text-[11px] leading-relaxed break-words whitespace-pre-wrap pr-5
                            text-yellow-900 dark:text-yellow-200">
                {data.annotation}
              </p>

              {/* Delete note button — appears on hover */}
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

      {/* ── 4-way connection handles ── */}
      <Handle type="source" position={Position.Top}    id="top"    className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-[#1c1f2e]"/>
      <Handle type="source" position={Position.Right}  id="right"  className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-[#1c1f2e]"/>
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-[#1c1f2e]"/>
      <Handle type="source" position={Position.Left}   id="left"   className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-[#1c1f2e]"/>
    </div>
  )
}
