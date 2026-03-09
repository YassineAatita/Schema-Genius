import { useState, useEffect, useRef } from 'react'
import useSchemaStore from '../../store/useSchemaStore'

const COLUMN_TYPES = [
  'BIGINT','INT','SMALLINT',
  'VARCHAR','TEXT','LONGTEXT',
  'BOOLEAN',
  'DATE','DATETIME','TIMESTAMP',
  'DECIMAL','FLOAT','ENUM',
]

export default function TableEditor({ nodeId, onClose }) {
  const { nodes, updateNodeData, deleteNode } = useSchemaStore()

  const [tableName, setTableName] = useState('')
  const [columns,   setColumns]   = useState([])
  const [isDirty,   setIsDirty]   = useState(false)
  const [saved,     setSaved]     = useState(false)

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
    }, [nodeId, nodes])  // ← add nodes here

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
    // Deep clone columns before saving to avoid reference issues
    const colsToSave = JSON.parse(JSON.stringify(columns))
    updateNodeData(nodeId, { name: tableName, columns: colsToSave })
    setIsDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteTable = () => {
    if (!window.confirm(`Delete table "${tableName}"?`)) return
    deleteNode(nodeId)
    onClose()
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"/>
          <h3 className="font-semibold text-gray-800 text-sm">Table Editor</h3>
        </div>
        <button onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors">
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
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Table Name
          </label>
          <input
            type="text"
            value={tableName}
            onChange={e => handleNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Columns */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Columns ({columns.length})
            </label>
            <button
              onClick={addColumn}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium
                         flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
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
              <div className="text-center py-6 text-gray-300 text-xs
                              border-2 border-dashed border-gray-200 rounded-lg">
                No columns — click Add Column
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">

        {isDirty && (
          <p className="text-xs text-amber-600 text-center flex items-center justify-center gap-1">
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
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
          className="w-full py-2 rounded-lg text-xs text-red-400 hover:text-red-600
                     hover:bg-red-50 transition-colors border border-transparent
                     hover:border-red-100">
          Delete this table
        </button>
      </div>
    </div>
  )
}

// ── Column Row ───────────────────────────────────────────────────
function ColumnRow({ col, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">

      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-2 bg-gray-50">

        {/* PK toggle */}
        <button
          onClick={() => onChange('pk', !col.pk)}
          title="Toggle Primary Key"
          className={`flex-shrink-0 p-0.5 rounded transition-colors
            ${col.pk ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-400'}`}>
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
          className="flex-1 min-w-0 text-xs bg-transparent border-none
                     outline-none font-mono text-gray-700"
          placeholder="column_name"
        />

        {/* Type */}
        <select
          value={col.type}
          onChange={e => onChange('type', e.target.value)}
          className="text-xs border border-gray-200 bg-white rounded px-1 py-0.5
                     outline-none text-gray-600 cursor-pointer max-w-[80px]">
          {COLUMN_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="text-gray-300 hover:text-red-400 flex-shrink-0 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-3 py-3 space-y-2.5 bg-white border-t border-gray-100">
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
                <span className="text-xs text-gray-600">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Default Value</label>
            <input
              type="text"
              value={col.default || ''}
              onChange={e => onChange('default', e.target.value || null)}
              placeholder="NULL"
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>
        </div>
      )}
    </div>
  )
}