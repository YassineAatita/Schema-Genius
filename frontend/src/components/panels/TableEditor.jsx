import { useState, useEffect, useRef } from 'react'
import useSchemaStore from '../../store/useSchemaStore'
import ConfirmModal from '../ui/ConfirmModal'

const COLUMN_TYPES = [
  'BIGINT','INT','SMALLINT',
  'VARCHAR','TEXT','LONGTEXT',
  'BOOLEAN',
  'DATE','DATETIME','TIMESTAMP',
  'DECIMAL','FLOAT','ENUM',
]

export default function TableEditor({ nodeId, onClose }) {
  const { nodes, updateNodeData, deleteNode } = useSchemaStore()

  const [tableName,     setTableName]     = useState('')
  const [columns,       setColumns]       = useState([])
  const [isDirty,       setIsDirty]       = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [showDelModal,  setShowDelModal]  = useState(false)

  const currentNodeId = useRef(null)

  // Load data when nodeId changes — and ONLY then
  useEffect(() => {
    if (currentNodeId.current === nodeId) return
    currentNodeId.current = nodeId

    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    setTableName(node.data.name)
    setColumns(JSON.parse(JSON.stringify(node.data.columns || [])))
    setIsDirty(false)
    setSaved(false)
  }, [nodeId, nodes])

  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null

  const handleNameChange = (val) => {
    setTableName(val)
    setIsDirty(true)
    setSaved(false)
  }

  const addColumn = () => {
    const newCol = {
      id:            `col_${Date.now()}`,
      name:          'new_column',
      type:          'VARCHAR',
      nullable:      true,
      pk:            false,
      unique:        false,
      autoIncrement: false,
      default:       null,
      fk:            false,
    }
    setColumns(prev => [...prev, newCol])
    setIsDirty(true)
    setSaved(false)
  }

  const updateColumn = (colId, field, value) => {
    setColumns(prev =>
      prev.map(c => c.id === colId ? { ...c, [field]: value } : c)
    )
    setIsDirty(true)
    setSaved(false)
  }

  const deleteColumn = (colId) => {
    setColumns(prev => prev.filter(c => c.id !== colId))
    setIsDirty(true)
    setSaved(false)
  }

  const handleSaveTable = () => {
    const colsToSave = JSON.parse(JSON.stringify(columns))
    updateNodeData(nodeId, { name: tableName, columns: colsToSave })
    setIsDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteTable = () => setShowDelModal(true)
  const confirmDeleteTable = () => {
    deleteNode(nodeId)
    onClose()
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
          <div className="w-2 h-2 rounded-full bg-blue-500"/>
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Table Editor</h3>
        </div>
        <button onClick={onClose}
          className="p-1 rounded transition-colors
                     text-gray-400 dark:text-gray-500
                     hover:text-gray-600 dark:hover:text-gray-300
                     hover:bg-gray-100 dark:hover:bg-[#252a3e]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Table Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5
                            text-gray-500 dark:text-gray-500">
            Table Name
          </label>
          <input
            type="text"
            value={tableName}
            onChange={e => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       bg-white dark:bg-[#1c1f2e]
                       border-gray-200 dark:border-[#2d3247]
                       text-gray-800 dark:text-gray-100
                       transition-colors duration-200"
          />
        </div>

        {/* Columns */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide
                              text-gray-500 dark:text-gray-500">
              Columns ({columns.length})
            </label>
            <button
              onClick={addColumn}
              className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors
                         text-blue-600 dark:text-blue-400
                         hover:text-blue-700 dark:hover:text-blue-300
                         hover:bg-blue-50 dark:hover:bg-blue-950">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4"/>
              </svg>
              Add Column
            </button>
          </div>

          <div className="space-y-2">
            {columns.map((col) => (
              <ColumnRow
                key={col.id}
                col={col}
                onChange={(field, val) => updateColumn(col.id, field, val)}
                onDelete={() => deleteColumn(col.id)}
              />
            ))}
            {columns.length === 0 && (
              <div className="text-center py-6 text-xs
                              border-2 border-dashed rounded-lg
                              text-gray-300 dark:text-gray-600
                              border-gray-200 dark:border-[#252a3e]">
                No columns — click Add Column
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t space-y-2
                      bg-gray-50 dark:bg-[#0f1117]
                      border-gray-100 dark:border-[#252a3e]">

        {isDirty && (
          <p className="text-xs text-amber-600 dark:text-amber-500 text-center flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213
                   2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11
                   13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1
                   1 0 00-1-1z"
                clipRule="evenodd"/>
            </svg>
            Unsaved changes
          </p>
        )}

        <button
          onClick={handleSaveTable}
          disabled={false}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all
            ${saved
              ? 'bg-green-500 text-white'
              : isDirty
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 dark:bg-[#252a3e] text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
        >
          {saved
            ? <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                Table Saved!
              </span>
            : 'Save Table'
          }
        </button>

        <button
          onClick={handleDeleteTable}
          className="w-full py-2 rounded-lg text-xs transition-colors border border-transparent
                     text-red-400 hover:text-red-600
                     hover:bg-red-50 dark:hover:bg-red-950/40
                     hover:border-red-100 dark:hover:border-red-900">
          Delete this table
        </button>
      </div>

      <ConfirmModal
        open={showDelModal}
        variant="danger"
        title="Delete table?"
        message={`"${tableName}" and all its columns will be permanently removed from the schema.`}
        confirmText="Delete table"
        cancelText="Cancel"
        onConfirm={confirmDeleteTable}
        onCancel={() => setShowDelModal(false)}
      />
    </div>
  )
}

// ── Column Row ───────────────────────────────────────────────────
function ColumnRow({ col, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden
                    border-gray-200 dark:border-[#252a3e]
                    bg-white dark:bg-[#1c1f2e]">

      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-2
                      bg-gray-50 dark:bg-[#252a3e]">

        {/* PK toggle */}
        <button
          onClick={() => onChange('pk', !col.pk)}
          title="Toggle Primary Key"
          className={`flex-shrink-0 p-0.5 rounded transition-colors
            ${col.pk ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-400'}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6
                 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
              clipRule="evenodd"/>
          </svg>
        </button>

        {/* Name */}
        <input
          type="text"
          value={col.name}
          onChange={e => onChange('name', e.target.value)}
          className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none font-mono
                     text-gray-700 dark:text-gray-300"
          placeholder="column_name"
        />

        {/* Type */}
        <select
          value={col.type}
          onChange={e => onChange('type', e.target.value)}
          className="text-xs rounded px-1 py-0.5 outline-none cursor-pointer max-w-[80px]
                     border border-gray-200 dark:border-[#2d3247]
                     bg-white dark:bg-[#1c1f2e]
                     text-gray-600 dark:text-gray-300">
          {COLUMN_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 transition-colors
                     text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 transition-colors
                     text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-3 py-3 space-y-2.5 border-t
                        bg-white dark:bg-[#1c1f2e]
                        border-gray-100 dark:border-[#252a3e]">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['nullable',      'Nullable'],
              ['unique',        'Unique'],
              ['autoIncrement', 'Auto Increment'],
              ['fk',            'Foreign Key'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!col[field]}
                  onChange={e => onChange(field, e.target.checked)}
                  className="rounded text-blue-600 cursor-pointer w-3 h-3"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs block mb-1 text-gray-400 dark:text-gray-500">Default Value</label>
            <input
              type="text"
              value={col.default || ''}
              onChange={e => onChange('default', e.target.value || null)}
              placeholder="NULL"
              className="w-full text-xs px-2 py-1.5 rounded-lg font-mono
                         focus:outline-none focus:ring-1 focus:ring-blue-500
                         border border-gray-200 dark:border-[#2d3247]
                         bg-white dark:bg-[#0f1117]
                         text-gray-700 dark:text-gray-300
                         placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
        </div>
      )}
    </div>
  )
}
