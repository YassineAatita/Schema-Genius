import { useState, useEffect, useRef } from 'react'
import useSchemaStore from '../../store/useSchemaStore'
import ConfirmModal from '../ui/ConfirmModal'

// ── Column type groups (Problem 3) ────────────────────────────────────────────
const COLUMN_TYPE_GROUPS = [
  {
    label: 'Numeric',
    types: ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'FLOAT', 'DOUBLE'],
  },
  {
    label: 'String',
    types: ['VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'ENUM'],
  },
  {
    label: 'Date / Time',
    types: ['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'],
  },
  {
    label: 'Binary',
    types: ['BLOB', 'MEDIUMBLOB', 'LONGBLOB'],
  },
  {
    label: 'Other',
    types: ['BOOLEAN', 'JSON', 'UUID'],
  },
]

// Only these types may carry AUTO_INCREMENT (Problem 4)
const NUMERIC_TYPES = new Set(['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT'])

// Foreign-key referential actions (Problem 2)
const FK_ACTIONS = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION']

// ── TableEditor ───────────────────────────────────────────────────────────────
export default function TableEditor({ nodeId, onClose }) {
  const { nodes, updateNodeData, deleteNode, cleanupFkRefsForColumn } = useSchemaStore()

  const [tableName,       setTableName]       = useState('')
  const [columns,         setColumns]         = useState([])
  const [methods,         setMethods]         = useState([])
  const [isDirty,         setIsDirty]         = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [showDelModal,    setShowDelModal]     = useState(false)
  // colDeletePending: null | { colId, colName, isPkWarning, fkRefs: [{table,column}] }
  const [colDeletePending, setColDeletePending] = useState(null)

  const currentNodeId = useRef(null)

  // Load data when nodeId changes — and ONLY then
  useEffect(() => {
    if (currentNodeId.current === nodeId) return
    currentNodeId.current = nodeId

    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    setTableName(node.data.name)
    setColumns(JSON.parse(JSON.stringify(node.data.columns || [])))
    setMethods(JSON.parse(JSON.stringify(node.data.methods ?? [])))
    setIsDirty(false)
    setSaved(false)
  }, [nodeId, nodes])  // eslint-disable-line react-hooks/exhaustive-deps

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
      index:         false,   // Problem 4 — new field
      default:       null,
      fk:            false,
      fkRef:         null,    // Problem 2 — new field
    }
    setColumns(prev => [...prev, newCol])
    setIsDirty(true)
    setSaved(false)
  }

  // ── Problem 1: Single-PK enforcement ─────────────────────────────────────────
  // Clicking PK on a column:
  //   • if it was already PK → toggle it off
  //   • if it was not PK    → make it the sole PK, clear all others
  const handlePkToggle = (colId) => {
    setColumns(prev => {
      const col = prev.find(c => c.id === colId)
      if (!col) return prev
      if (col.pk) {
        // Toggle off
        return prev.map(c => c.id === colId ? { ...c, pk: false } : c)
      }
      // Set as sole PK — clear all others
      return prev.map(c => ({ ...c, pk: c.id === colId }))
    })
    setIsDirty(true)
    setSaved(false)
  }

  // ── General column field update ───────────────────────────────────────────────
  const updateColumn = (colId, field, value) => {
    setColumns(prev =>
      prev.map(c => {
        if (c.id !== colId) return c
        const updated = { ...c, [field]: value }
        // Enabling FK: initialise fkRef with safe defaults
        if (field === 'fk' && value && !c.fkRef) {
          updated.fkRef = { table: '', column: '', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' }
        }
        // Disabling FK: wipe the reference so stale data doesn't survive
        if (field === 'fk' && !value) {
          updated.fkRef = null
        }
        return updated
      })
    )
    setIsDirty(true)
    setSaved(false)
  }

  // Internal — removes a column from local state with no checks.
  const _deleteColumn = (colId, colName) => {
    setColumns(prev =>
      prev
        .filter(c => c.id !== colId)
        // also clear any self-referential FK in the same table
        .map(c =>
          c.fk && c.fkRef?.table === tableName && c.fkRef?.column === colName
            ? { ...c, fk: false, fkRef: null }
            : c
        )
    )
    setIsDirty(true)
    setSaved(false)
  }

  // ── Column delete with safety checks ─────────────────────────────────────────
  // Scenario 1: column is referenced as FK by another table  → danger warning
  // Scenario 2: column is the last PK in this table          → advisory warning
  // Both can fire together.
  const requestDeleteColumn = (colId) => {
    const col = columns.find(c => c.id === colId)
    if (!col) return

    // Scenario 2 — last PK?
    const isPkWarning = col.pk && columns.filter(c => c.pk).length === 1

    // Scenario 1 — scan every node on the canvas for FK refs pointing here.
    // We check both the store (other tables) and local state (self-referential).
    const fkRefs = []

    // Other tables (from store)
    nodes.forEach(n => {
      if (n.id === nodeId) return
      ;(n.data?.columns || []).forEach(c => {
        if (c.fk && c.fkRef?.table === tableName && c.fkRef?.column === col.name) {
          fkRefs.push({ table: n.data.name, column: c.name })
        }
      })
    })

    // Same table — self-referential (local state)
    columns.forEach(c => {
      if (c.id === colId) return
      if (c.fk && c.fkRef?.table === tableName && c.fkRef?.column === col.name) {
        fkRefs.push({ table: tableName, column: c.name })
      }
    })

    // No warnings → delete immediately without a dialog
    if (!isPkWarning && fkRefs.length === 0) {
      _deleteColumn(colId, col.name)
      return
    }

    // Queue the confirmation
    setColDeletePending({ colId, colName: col.name, isPkWarning, fkRefs })
  }

  const confirmDeleteColumn = () => {
    if (!colDeletePending) return
    const { colId, colName } = colDeletePending
    // Remove column + self-referential cleanup from local state
    _deleteColumn(colId, colName)
    // Wipe orphaned FK refs in all other store nodes
    cleanupFkRefsForColumn(tableName, colName)
    setColDeletePending(null)
  }

  // ── Method mutations ──────────────────────────────────────────────────────────
  const addMethod = () => {
    setMethods(prev => [
      ...prev,
      { id: `mth_${Date.now()}`, visibility: '+', name: 'newMethod' },
    ])
    setIsDirty(true)
    setSaved(false)
  }

  const updateMethod = (mthId, field, value) => {
    setMethods(prev =>
      prev.map(m => m.id === mthId ? { ...m, [field]: value } : m)
    )
    setIsDirty(true)
    setSaved(false)
  }

  const deleteMethod = (mthId) => {
    setMethods(prev => prev.filter(m => m.id !== mthId))
    setIsDirty(true)
    setSaved(false)
  }

  const handleSaveTable = () => {
    const colsToSave = JSON.parse(JSON.stringify(columns))
    const mthsToSave = JSON.parse(JSON.stringify(methods))
    updateNodeData(nodeId, { name: tableName, columns: colsToSave, methods: mthsToSave })
    setIsDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleteTable  = () => setShowDelModal(true)
  const confirmDeleteTable = () => { deleteNode(nodeId); onClose() }

  // Other tables on the canvas — passed to ColumnRow for FK dropdowns
  const otherTables = nodes.filter(n => n.id !== nodeId)

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
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Class Editor</h3>
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
                otherTables={otherTables}
                onChange={(field, val) => updateColumn(col.id, field, val)}
                onPkToggle={() => handlePkToggle(col.id)}
                onDelete={() => requestDeleteColumn(col.id)}
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

        {/* Methods */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide
                              text-gray-500 dark:text-gray-500">
              Methods ({methods.length})
            </label>
            <button
              onClick={addMethod}
              className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors
                         text-purple-600 dark:text-purple-400
                         hover:text-purple-700 dark:hover:text-purple-300
                         hover:bg-purple-50 dark:hover:bg-purple-950">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4"/>
              </svg>
              Add Method
            </button>
          </div>

          <div className="space-y-1.5">
            {methods.map((m) => (
              <div key={m.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border
                           border-gray-200 dark:border-[#252a3e]
                           bg-gray-50 dark:bg-[#252a3e]">

                {/* Visibility selector */}
                <select
                  value={m.visibility}
                  onChange={e => updateMethod(m.id, 'visibility', e.target.value)}
                  title="+  public   −  private   #  protected"
                  className="flex-shrink-0 text-xs font-mono rounded px-1 py-0.5 outline-none cursor-pointer
                             w-10 text-center
                             border border-gray-200 dark:border-[#2d3247]
                             bg-white dark:bg-[#1c1f2e]
                             text-purple-600 dark:text-purple-400">
                  <option value="+">+</option>
                  <option value="-">−</option>
                  <option value="#">#</option>
                </select>

                {/* Method name */}
                <input
                  type="text"
                  value={m.name}
                  onChange={e => updateMethod(m.id, 'name', e.target.value)}
                  className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none font-mono
                             text-gray-700 dark:text-gray-300"
                  placeholder="methodName"
                />

                {/* () suffix hint */}
                <span className="text-xs text-gray-300 dark:text-gray-600 font-mono flex-shrink-0">
                  ()
                </span>

                {/* Delete */}
                <button
                  onClick={() => deleteMethod(m.id)}
                  className="flex-shrink-0 transition-colors
                             text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}

            {methods.length === 0 && (
              <div className="text-center py-4 text-xs
                              border-2 border-dashed rounded-lg
                              text-gray-300 dark:text-gray-600
                              border-gray-200 dark:border-[#252a3e]">
                No methods — click Add Method
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

      {/* ── Column delete warning modal ── */}
      {colDeletePending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setColDeletePending(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
          <div
            className="relative w-full max-w-sm bg-white dark:bg-[#1c1f2e] rounded-2xl shadow-2xl
                       border border-gray-100 dark:border-[#252a3e] p-6 animate-modal"
            onClick={e => e.stopPropagation()}>

            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto
                            ${colDeletePending.fkRefs.length > 0
                              ? 'bg-red-100 dark:bg-red-950/40'
                              : 'bg-amber-100 dark:bg-amber-950/40'}`}>
              <svg className={`w-6 h-6 ${colDeletePending.fkRefs.length > 0 ? 'text-red-500' : 'text-amber-500'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732
                     4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-center mb-4
                           text-gray-900 dark:text-gray-100">
              Delete column &ldquo;{colDeletePending.colName}&rdquo;?
            </h3>

            {/* FK references warning */}
            {colDeletePending.fkRefs.length > 0 && (
              <div className="mb-3 rounded-lg border p-3
                              bg-red-50 dark:bg-red-950/20
                              border-red-200 dark:border-red-800/40">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">
                  Referenced by {colDeletePending.fkRefs.length === 1 ? 'a foreign key' : 'foreign keys'} in:
                </p>
                <ul className="space-y-0.5">
                  {colDeletePending.fkRefs.map((ref, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-300 font-mono">
                      <svg className="w-3 h-3 flex-shrink-0 text-red-400" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
                      </svg>
                      {ref.table}.{ref.column}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Confirming will automatically clear {colDeletePending.fkRefs.length === 1 ? 'that' : 'those'} FK reference{colDeletePending.fkRefs.length > 1 ? 's' : ''}.
                </p>
              </div>
            )}

            {/* Last-PK warning */}
            {colDeletePending.isPkWarning && (
              <div className="mb-3 rounded-lg border p-3
                              bg-amber-50 dark:bg-amber-950/20
                              border-amber-200 dark:border-amber-800/40">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6
                         6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
                      clipRule="evenodd"/>
                  </svg>
                  This is the only primary key in <strong className="font-semibold">{tableName}</strong>.
                  Deleting it will leave the table without a primary key, which may break SQL export and validation.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setColDeletePending(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
                           text-gray-600 dark:text-gray-300
                           bg-gray-100 dark:bg-[#252a3e]
                           hover:bg-gray-200 dark:hover:bg-[#2d3247]">
                Cancel
              </button>
              <button
                onClick={confirmDeleteColumn}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                            transition-all shadow-lg
                            ${colDeletePending.fkRefs.length > 0
                              ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                              : 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/20'}`}>
                Delete Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Column Row ────────────────────────────────────────────────────────────────
function ColumnRow({ col, otherTables, onChange, onPkToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  // Safe fkRef with defaults — handles old schemas that have fk:true but no fkRef object
  const fkRef = col.fkRef || { table: '', column: '', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' }

  // Look up the referenced table node so we can list its columns
  const refTableNode = fkRef.table
    ? otherTables.find(t => t.data?.name === fkRef.table)
    : null
  const refColumns   = refTableNode?.data?.columns || []

  // Warning flags
  const refTableMissing = col.fk && fkRef.table && !refTableNode
  const autoIncTypeWarn = col.autoIncrement && !NUMERIC_TYPES.has(col.type)

  // Update a single field of fkRef and propagate as a whole object
  const setFkRef = (field, value) => {
    const updated = { ...fkRef, [field]: value }
    // Changing the target table resets the column selection
    if (field === 'table') updated.column = ''
    onChange('fkRef', updated)
  }

  return (
    <div className="border rounded-lg overflow-hidden
                    border-gray-200 dark:border-[#252a3e]
                    bg-white dark:bg-[#1c1f2e]">

      {/* ── Main row (always visible) ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-2 py-2
                      bg-gray-50 dark:bg-[#252a3e]">

        {/* PK key icon — Problem 1: uses dedicated onPkToggle handler */}
        <button
          onClick={onPkToggle}
          title={col.pk ? 'Remove Primary Key' : 'Set as Primary Key (clears others)'}
          className={`flex-shrink-0 p-0.5 rounded transition-colors
            ${col.pk
              ? 'text-yellow-500'
              : 'text-gray-300 dark:text-gray-600 hover:text-yellow-400 dark:hover:text-yellow-500'}`}>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6
                 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
              clipRule="evenodd"/>
          </svg>
        </button>

        {/* Column name */}
        <input
          type="text"
          value={col.name}
          onChange={e => onChange('name', e.target.value)}
          className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none font-mono
                     text-gray-700 dark:text-gray-300"
          placeholder="column_name"
        />

        {/* Problem 3: Type selector with optgroups */}
        <select
          value={col.type}
          onChange={e => onChange('type', e.target.value)}
          className="text-xs rounded px-1 py-0.5 outline-none cursor-pointer max-w-[90px]
                     border border-gray-200 dark:border-[#2d3247]
                     bg-white dark:bg-[#1c1f2e]
                     text-gray-600 dark:text-gray-300">
          {COLUMN_TYPE_GROUPS.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Expand chevron */}
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

        {/* Delete column */}
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

      {/* ── Expanded constraints section ──────────────────────────────────── */}
      {expanded && (
        <div className="px-3 py-3 space-y-3 border-t
                        bg-white dark:bg-[#1c1f2e]
                        border-gray-100 dark:border-[#252a3e]">

          {/* Problem 4: All constraint checkboxes */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">

            {/* NOT NULL / Nullable */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!col.nullable}
                onChange={e => onChange('nullable', e.target.checked)}
                className="rounded text-blue-600 cursor-pointer w-3 h-3"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Nullable</span>
            </label>

            {/* Unique */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!col.unique}
                onChange={e => onChange('unique', e.target.checked)}
                className="rounded text-blue-600 cursor-pointer w-3 h-3"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Unique</span>
            </label>

            {/* Auto Increment — dimmed when type is not numeric */}
            <label className={`flex items-center gap-1.5 cursor-pointer ${autoIncTypeWarn ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={!!col.autoIncrement}
                onChange={e => onChange('autoIncrement', e.target.checked)}
                className="rounded text-blue-600 cursor-pointer w-3 h-3"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Auto Incr.</span>
            </label>

            {/* Index (new) */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!col.index}
                onChange={e => onChange('index', e.target.checked)}
                className="rounded text-blue-600 cursor-pointer w-3 h-3"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Index</span>
            </label>

            {/* Foreign Key — full width so sub-form doesn't feel cramped */}
            <label className="flex items-center gap-1.5 cursor-pointer col-span-2">
              <input
                type="checkbox"
                checked={!!col.fk}
                onChange={e => onChange('fk', e.target.checked)}
                className="rounded text-blue-600 cursor-pointer w-3 h-3"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Foreign Key</span>
            </label>
          </div>

          {/* Auto Increment type warning */}
          {autoIncTypeWarn && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1 -mt-1">
              <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742
                     2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1
                     0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"/>
              </svg>
              Auto Increment only works on INT, BIGINT, SMALLINT, or TINYINT.
            </p>
          )}

          {/* ── Problem 2: FK Reference sub-form ─────────────────────────── */}
          {col.fk && (
            <div className="rounded-lg border p-2.5 space-y-2
                            bg-blue-50/50 dark:bg-blue-950/20
                            border-blue-200 dark:border-blue-800/40">

              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101
                       M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1"/>
                </svg>
                FK Reference
              </p>

              {/* References table */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">
                  References table
                </label>
                <select
                  value={fkRef.table}
                  onChange={e => setFkRef('table', e.target.value)}
                  className="w-full text-xs rounded px-2 py-1.5 outline-none cursor-pointer
                             border border-gray-200 dark:border-[#2d3247]
                             bg-white dark:bg-[#1c1f2e]
                             text-gray-700 dark:text-gray-300
                             focus:ring-1 focus:ring-blue-500">
                  <option value="">— select table —</option>
                  {otherTables.map(t => (
                    <option key={t.id} value={t.data?.name}>{t.data?.name}</option>
                  ))}
                </select>
              </div>

              {/* References column */}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">
                  References column
                </label>
                <select
                  value={fkRef.column}
                  onChange={e => setFkRef('column', e.target.value)}
                  disabled={!fkRef.table}
                  className="w-full text-xs rounded px-2 py-1.5 outline-none cursor-pointer
                             border border-gray-200 dark:border-[#2d3247]
                             bg-white dark:bg-[#1c1f2e]
                             text-gray-700 dark:text-gray-300
                             focus:ring-1 focus:ring-blue-500
                             disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">— select column —</option>
                  {refColumns.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>

              {/* On Delete / On Update */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">
                    On Delete
                  </label>
                  <select
                    value={fkRef.onDelete || 'RESTRICT'}
                    onChange={e => setFkRef('onDelete', e.target.value)}
                    className="w-full text-xs rounded px-2 py-1.5 outline-none cursor-pointer
                               border border-gray-200 dark:border-[#2d3247]
                               bg-white dark:bg-[#1c1f2e]
                               text-gray-700 dark:text-gray-300
                               focus:ring-1 focus:ring-blue-500">
                    {FK_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">
                    On Update
                  </label>
                  <select
                    value={fkRef.onUpdate || 'RESTRICT'}
                    onChange={e => setFkRef('onUpdate', e.target.value)}
                    className="w-full text-xs rounded px-2 py-1.5 outline-none cursor-pointer
                               border border-gray-200 dark:border-[#2d3247]
                               bg-white dark:bg-[#1c1f2e]
                               text-gray-700 dark:text-gray-300
                               focus:ring-1 focus:ring-blue-500">
                    {FK_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* Warning: referenced table was deleted from the canvas */}
              {refTableMissing && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742
                         2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1
                         0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"/>
                  </svg>
                  Referenced table &ldquo;{fkRef.table}&rdquo; no longer exists on this canvas.
                </p>
              )}
            </div>
          )}

          {/* Default Value */}
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
