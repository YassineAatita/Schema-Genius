import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import SchemaCanvas from '../components/canvas/SchemaCanvas'
import TableEditor from '../components/panels/TableEditor'
import RelationshipEditor from '../components/panels/RelationshipEditor'
import useSchemaStore from '../store/useSchemaStore'
import api from '../services/api'
import ConfirmModal from '../components/ui/ConfirmModal'
import { validateSchema } from '../utils/validateSchema'

export default function DesignerPage() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const { loadSchema, addTable, nodes, edges, isDirty, markSaved, aiGenerate } = useSchemaStore()

  const [project,        setProject]        = useState(null)
  const [selectedNode,   setSelectedNode]   = useState(null)
  const [selectedEdge,   setSelectedEdge]   = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [saveMsg,        setSaveMsg]        = useState('')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [showAiModal,    setShowAiModal]    = useState(false)
  const [aiPrompt,       setAiPrompt]       = useState('')
  const [aiLoading,      setAiLoading]      = useState(false)
  const [aiError,        setAiError]        = useState('')
  const [showAiConfirm,  setShowAiConfirm]  = useState(false)
  const pendingAiSchema = useRef(null)

  // Run validation whenever nodes change
  const validationIssues = useMemo(() => validateSchema(nodes), [nodes])
  const errorCount   = validationIssues.filter(i => i.type === 'error').length
  const warningCount = validationIssues.filter(i => i.type === 'warning').length

  // Load project + schema
  useEffect(() => {
    api.get(`/projects/${projectId}`)
      .then(res => {
        setProject(res.data)
        const schema = res.data.schema
        if (schema) {
          const json = schema.current_version?.schema_json
          loadSchema(schema.id, projectId, json || { nodes: [], edges: [] })
        }
      })
      .catch(() => navigate('/dashboard'))
  }, [projectId])

  // Warn on browser refresh / tab close when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Keep selected edge in sync when edges update in store
  useEffect(() => {
    if (selectedEdge) {
      const updated = edges.find(e => e.id === selectedEdge.id)
      if (updated) setSelectedEdge(updated)
      else setSelectedEdge(null)
    }
  }, [edges])

  const handleNodeClick = (node) => {
    setSelectedEdge(null)
    setSelectedNode(node)
    setShowValidation(false)
  }

  const handleEdgeClick = (edge) => {
    setSelectedNode(null)
    setSelectedEdge(edge)
    setShowValidation(false)
  }

  const handleValidateClick = () => {
    setSelectedNode(null)
    setSelectedEdge(null)
    setShowValidation(v => !v)
  }

  const handleFocusNode = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
      setShowValidation(false)
    }
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const res = await api.post('/ai/generate', { prompt: aiPrompt.trim() })
      const schema = res.data
      if (!schema.nodes?.length) {
        setAiError('The AI returned an empty schema. Try a more specific description.')
        return
      }
      // If canvas already has tables, ask for confirmation before replacing
      if (nodes.length > 0) {
        pendingAiSchema.current = schema
        setShowAiModal(false)
        setShowAiConfirm(true)
      } else {
        aiGenerate(schema.nodes, schema.edges || [])
        setShowAiModal(false)
        setAiPrompt('')
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong. Please try again.'
      setAiError(msg)
    } finally {
      setAiLoading(false)
    }
  }

  const confirmAiReplace = () => {
    if (pendingAiSchema.current) {
      aiGenerate(pendingAiSchema.current.nodes, pendingAiSchema.current.edges || [])
      pendingAiSchema.current = null
      setAiPrompt('')
    }
    setShowAiConfirm(false)
  }

  const handleSave = async () => {
    const state = useSchemaStore.getState()
    if (!state.schemaId) return
    setSaving(true)
    setSaveMsg('')
    try {
      await api.put(`/schemas/${state.schemaId}`, {
        schema_json: { nodes: state.nodes, edges: state.edges, meta: {} },
        label: null,
      })
      markSaved()
      setSaveMsg('saved')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      console.error(err)
      setSaveMsg('error')
    } finally {
      setSaving(false)
    }
  }

  const handleExportSQL = async () => {
    const { schemaId } = useSchemaStore.getState()
    if (!schemaId) return
    try {
      const response = await api.get(`/schemas/${schemaId}/export/sql`, { responseType: 'blob' })
      const url      = window.URL.createObjectURL(new Blob([response.data]))
      const link     = document.createElement('a')
      link.href      = url
      link.download  = `schema_${project?.name || schemaId}.sql`.replace(/\s+/g, '_').toLowerCase()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Make sure you have saved the schema first.')
    }
  }

  // Right panel — validation takes priority over table/edge editors
  const showRightPanel = showValidation || selectedNode || selectedEdge

  // Validate button color
  const validateBtnClass = errorCount > 0
    ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
    : warningCount > 0
      ? 'border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100'
      : 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100'

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center
                      justify-between flex-shrink-0 z-10 shadow-sm">

        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => {
              if (isDirty) { setShowLeaveModal(true); return }
              navigate('/dashboard')
            }}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg
                       hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="w-px h-5 bg-gray-200"/>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm leading-tight">
                {project?.name || 'Loading...'}
              </p>
              <p className="text-xs text-gray-400 leading-tight">
                {nodes.length} table{nodes.length !== 1 ? 's' : ''} · {edges.length} relationship{edges.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {isDirty && (
            <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200
                             px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
              Unsaved changes
            </span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* AI Generate */}
          <button
            onClick={() => { setShowAiModal(true); setAiError('') }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg
                       border border-violet-200 text-violet-600 bg-violet-50
                       hover:bg-violet-100 hover:border-violet-300 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            AI Generate
          </button>

          <button
            onClick={addTable}
            className="flex items-center gap-1.5 text-sm text-gray-700 border border-gray-200
                       hover:border-blue-300 hover:text-blue-600 px-3 py-1.5 rounded-lg
                       transition-all bg-white hover:bg-blue-50 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add Table
          </button>

          {/* Validate button */}
          {nodes.length > 0 && (
            <button
              onClick={handleValidateClick}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5
                          rounded-lg border transition-all ${validateBtnClass}
                          ${showValidation ? 'ring-2 ring-offset-1 ring-current/30' : ''}`}
            >
              {errorCount > 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              ) : warningCount > 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
              {errorCount > 0
                ? `${errorCount} error${errorCount !== 1 ? 's' : ''}`
                : warningCount > 0
                  ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}`
                  : 'Valid'}
            </button>
          )}

          {/* Export SQL */}
          <button
            onClick={handleExportSQL}
            className="flex items-center gap-1.5 text-sm text-gray-700 border border-gray-200
                       hover:border-blue-300 hover:text-blue-600 px-3 py-1.5 rounded-lg
                       transition-all bg-white hover:bg-blue-50 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export SQL
          </button>

          <button
            onClick={handleSave}
            disabled={saving || (!isDirty && saveMsg !== 'error')}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5
                        rounded-lg transition-all
              ${saveMsg === 'saved'
                ? 'bg-green-500 text-white'
                : saveMsg === 'error'
                  ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                  : saving
                    ? 'bg-blue-400 text-white cursor-wait'
                    : isDirty
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving...
              </>
            ) : saveMsg === 'saved' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                Saved!
              </>
            ) : saveMsg === 'error' ? 'Retry Save' : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-4 0V3m0 0L8 6m4-3l4 3"/>
                </svg>
                Save Schema
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <SchemaCanvas
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          </ReactFlowProvider>
        </div>

        {/* Right panel */}
        {showRightPanel && (
          <div className="w-80 h-full flex-shrink-0">
            {showValidation && (
              <ValidationPanel
                issues={validationIssues}
                onClose={() => setShowValidation(false)}
                onFocusNode={handleFocusNode}
              />
            )}
            {!showValidation && selectedNode && (
              <TableEditor
                nodeId={selectedNode.id}
                onClose={() => setSelectedNode(null)}
              />
            )}
            {!showValidation && selectedEdge && (
              <RelationshipEditor
                edge={selectedEdge}
                onClose={() => setSelectedEdge(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* Help tip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <p className="text-xs text-gray-400 bg-white/90 backdrop-blur px-3 py-1.5
                      rounded-full border border-gray-200 shadow-sm whitespace-nowrap">
          Click table to edit · Click relationship line to change type · Drag handle to connect · Delete key to remove
        </p>
      </div>

      <ConfirmModal
        open={showLeaveModal}
        variant="warning"
        title="Unsaved changes"
        message="You have unsaved changes that will be lost if you leave. Are you sure you want to go back to the dashboard?"
        confirmText="Leave anyway"
        cancelText="Stay"
        onConfirm={() => navigate('/dashboard')}
        onCancel={() => setShowLeaveModal(false)}
      />

      <ConfirmModal
        open={showAiConfirm}
        variant="warning"
        title="Replace existing schema?"
        message="The AI will replace your current tables and relationships. This cannot be undone. Save your schema first if you want to keep it."
        confirmText="Replace anyway"
        cancelText="Cancel"
        onConfirm={confirmAiReplace}
        onCancel={() => setShowAiConfirm(false)}
      />

      {/* ── AI Generate Modal ── */}
      {showAiModal && <AiModal
        prompt={aiPrompt}
        onPromptChange={setAiPrompt}
        loading={aiLoading}
        error={aiError}
        onGenerate={handleAiGenerate}
        onClose={() => setShowAiModal(false)}
      />}
    </div>
  )
}

// ── Validation Panel ──────────────────────────────────────────────
function ValidationPanel({ issues, onClose, onFocusNode }) {
  const errors   = issues.filter(i => i.type === 'error')
  const warnings = issues.filter(i => i.type === 'warning')

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500"/>
          <h3 className="font-semibold text-gray-800 text-sm">Schema Validation</h3>
        </div>
        <button onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* All clear */}
        {issues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p className="font-semibold text-gray-800 mb-1">Schema looks good!</p>
            <p className="text-xs text-gray-400">No errors or warnings found.</p>
          </div>
        )}

        {/* Summary pills */}
        {issues.length > 0 && (
          <div className="flex gap-2">
            {errors.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold bg-red-50
                               border border-red-200 text-red-600 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
                {errors.length} error{errors.length !== 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold bg-amber-50
                               border border-amber-200 text-amber-600 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <IssueGroup
            title="Errors"
            color="red"
            issues={errors}
            onFocusNode={onFocusNode}
          />
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <IssueGroup
            title="Warnings"
            color="amber"
            issues={warnings}
            onFocusNode={onFocusNode}
          />
        )}
      </div>
    </div>
  )
}

function IssueGroup({ title, color, issues, onFocusNode }) {
  const isRed = color === 'red'
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2
        ${isRed ? 'text-red-500' : 'text-amber-500'}`}>
        {title}
      </p>
      <div className="space-y-2">
        {issues.map((issue, i) => (
          <div key={i}
            className={`rounded-xl border p-3 flex items-start gap-3
              ${isRed
                ? 'bg-red-50 border-red-100'
                : 'bg-amber-50 border-amber-100'}`}
          >
            {/* Icon */}
            <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5
              ${isRed ? 'bg-red-100' : 'bg-amber-100'}`}>
              <svg className={`w-3.5 h-3.5 ${isRed ? 'text-red-500' : 'text-amber-500'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 font-mono mb-0.5 truncate">
                {issue.tableName}
              </p>
              <p className={`text-xs leading-snug ${isRed ? 'text-red-700' : 'text-amber-700'}`}>
                {issue.message}
              </p>
            </div>

            {/* Go to button */}
            <button
              onClick={() => onFocusNode(issue.nodeId)}
              title="Open table editor"
              className={`flex-shrink-0 p-1 rounded-lg transition-colors
                ${isRed
                  ? 'text-red-400 hover:text-red-600 hover:bg-red-100'
                  : 'text-amber-400 hover:text-amber-600 hover:bg-amber-100'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AI Generate Modal ─────────────────────────────────────────────
const EXAMPLES = [
  'E-commerce platform with products, categories, orders, and customers',
  'Blog with users, posts, comments, and tags',
  'School management with students, courses, teachers, and enrollments',
  'Hospital system with patients, doctors, appointments, and prescriptions',
]

function AiModal({ prompt, onPromptChange, loading, error, onGenerate, onClose }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-modal overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between
                        bg-gradient-to-r from-violet-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">AI Schema Generator</h2>
              <p className="text-xs text-gray-500">Powered by Llama 3.3 · Free via Groq</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Prompt */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Describe your database
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="e.g. An e-commerce store with products, categories, orders, customers, and reviews"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                         resize-none text-gray-800 placeholder-gray-400 leading-relaxed"
            />
            <p className="text-xs text-gray-400 mt-1">Press Ctrl+Enter to generate</p>
          </div>

          {/* Examples */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Examples</p>
            <div className="space-y-1.5">
              {EXAMPLES.map((ex, i) => (
                <button key={i}
                  onClick={() => onPromptChange(ex)}
                  className="w-full text-left text-xs text-gray-600 px-3 py-2 rounded-lg
                             bg-gray-50 hover:bg-violet-50 hover:text-violet-700
                             border border-gray-100 hover:border-violet-200
                             transition-all truncate">
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <p className="text-xs text-red-700 leading-snug">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600
                       hover:bg-gray-50 transition-colors font-medium">
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={loading || !prompt.trim()}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              flex items-center justify-center gap-2
              ${loading || !prompt.trim()
                ? 'bg-violet-200 text-violet-400 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-200'}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                Generate Schema
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
