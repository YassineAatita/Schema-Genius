import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import SchemaCanvas from '../components/canvas/SchemaCanvas'
import TableEditor from '../components/panels/TableEditor'
import RelationshipEditor from '../components/panels/RelationshipEditor'
import useSchemaStore from '../store/useSchemaStore'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'
import ConfirmModal from '../components/ui/ConfirmModal'
import HistoryPanel from '../components/panels/HistoryPanel'
import { validateSchema } from '../utils/validateSchema'

export default function DesignerPage() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const { loadSchema, addTable, nodes, edges, isDirty, markSaved, aiGenerate,
          undo, redo, past, future } = useSchemaStore()
  const { user } = useAuthStore()

  const [project,          setProject]          = useState(null)
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
  const [showAiConfirm,     setShowAiConfirm]     = useState(false)
  const [showShareModal,    setShowShareModal]    = useState(false)
  const [showTemplatesModal,setShowTemplatesModal]= useState(false)
  const [showMoreMenu,      setShowMoreMenu]      = useState(false)
  const [showExportModal,   setShowExportModal]   = useState(false)
  const [showHistory,       setShowHistory]       = useState(false)
  const [undoToast,         setUndoToast]         = useState(null)  // { message }
  const pendingAiSchema = useRef(null)
  const moreMenuRef     = useRef(null)

  const isOwner  = project?.owner_id === user?.id
  const myRole   = project?.collaborators?.find(c => c.id === user?.id)?.pivot?.role ?? null
  const canEdit  = isOwner || myRole === 'editor'   // owner or accepted editor
  const isViewer = !isOwner && myRole === 'viewer'   // accepted viewer — read-only

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

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
  const handleUndo = useCallback(() => {
    if (useSchemaStore.getState().past.length === 0) return
    undo()
    setUndoToast({ message: 'Undone' })
    setTimeout(() => setUndoToast(null), 2000)
  }, [undo])

  const handleRedo = useCallback(() => {
    if (useSchemaStore.getState().future.length === 0) return
    redo()
    setUndoToast({ message: 'Redone' })
    setTimeout(() => setUndoToast(null), 2000)
  }, [redo])

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      // Don't intercept when typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, handleRedo])

  // Close "More" menu when clicking outside
  useEffect(() => {
    const onMouseDown = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const handleValidateClick = () => {
    setSelectedNode(null)
    setSelectedEdge(null)
    setShowHistory(false)
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

  const handleUseTemplate = (template) => {
    setShowTemplatesModal(false)
    if (nodes.length > 0) {
      pendingAiSchema.current = template
      setShowAiConfirm(true)
    } else {
      aiGenerate(template.nodes, template.edges)
    }
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

  // Called by HistoryPanel when a version is successfully restored
  const handleHistoryRestore = (schemaJson) => {
    const { schemaId, projectId: pid } = useSchemaStore.getState()
    loadSchema(schemaId, pid, schemaJson || { nodes: [], edges: [] })
    setShowHistory(false)
    setSaveMsg('')
  }

  const handleExportSQL = async (dialect = 'mysql') => {
    const { schemaId } = useSchemaStore.getState()
    if (!schemaId) return
    try {
      const response = await api.get(`/schemas/${schemaId}/export/sql?dialect=${dialect}`, { responseType: 'blob' })
      const url      = window.URL.createObjectURL(new Blob([response.data]))
      const link     = document.createElement('a')
      link.href      = url
      link.download  = `schema_${project?.name || schemaId}_${dialect}.sql`.replace(/\s+/g, '_').toLowerCase()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Make sure you have saved the schema first.')
    }
  }

  // Close history when opening another panel; viewers can't edit so don't open editors
  const handleNodeClick = (node) => {
    if (isViewer) return
    setSelectedEdge(null)
    setSelectedNode(node)
    setShowValidation(false)
    setShowHistory(false)
  }

  const handleEdgeClick = (edge) => {
    if (isViewer) return
    setSelectedNode(null)
    setSelectedEdge(edge)
    setShowValidation(false)
    setShowHistory(false)
  }

  // Right panel — history > validation > table/edge editors
  const showRightPanel = showHistory || showValidation || selectedNode || selectedEdge

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
          {isDirty && !isViewer && (
            <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200
                             px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
              Unsaved changes
            </span>
          )}
          {isViewer && (
            <span className="text-xs text-gray-400 bg-gray-100 border border-gray-200
                             px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              View only
            </span>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* Undo / Redo — editors only */}
          {canEdit && <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={handleUndo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
              className={`flex items-center justify-center p-1.5 transition-all
                ${past.length === 0
                  ? 'text-gray-300 bg-white cursor-not-allowed'
                  : 'text-gray-600 bg-white hover:bg-gray-50 hover:text-blue-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
            </button>
            <div className="w-px h-5 bg-gray-200"/>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Shift+Z)"
              className={`flex items-center justify-center p-1.5 transition-all
                ${future.length === 0
                  ? 'text-gray-300 bg-white cursor-not-allowed'
                  : 'text-gray-600 bg-white hover:bg-gray-50 hover:text-blue-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/>
              </svg>
            </button>
          </div>}

          {canEdit && <div className="w-px h-5 bg-gray-200"/>}

          {/* Add Table — editors only */}
          {canEdit && (
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
          )}

          {/* AI Generate — editors only */}
          {canEdit && (
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
          )}

          {/* ⋯ More dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg
                         border transition-all
                         ${showMoreMenu
                           ? 'border-gray-300 bg-gray-100 text-gray-700'
                           : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
              More
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border
                              border-gray-200 shadow-lg z-50 overflow-hidden py-1">

                {/* Version History */}
                <button
                  onClick={() => {
                    setShowHistory(true)
                    setSelectedNode(null)
                    setSelectedEdge(null)
                    setShowValidation(false)
                    setShowMoreMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700
                             hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Version History
                </button>

                {canEdit && <div className="h-px bg-gray-100 my-1"/>}

                {/* Templates — editors only */}
                {canEdit && <button
                  onClick={() => { setShowTemplatesModal(true); setShowMoreMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700
                             hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
                  </svg>
                  Templates
                </button>}

                {/* Validate */}
                <button
                  onClick={() => { handleValidateClick(); setShowMoreMenu(false) }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm
                             hover:bg-gray-50 transition-colors text-left
                             ${errorCount > 0 ? 'text-red-600' : warningCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                  <span className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Validate Schema
                  </span>
                  {(errorCount > 0 || warningCount > 0) && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                      ${errorCount > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {errorCount > 0 ? errorCount : warningCount}
                    </span>
                  )}
                </button>

                <div className="h-px bg-gray-100 my-1"/>

                {/* Export SQL */}
                <button
                  onClick={() => { setShowExportModal(true); setShowMoreMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700
                             hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Export SQL
                </button>
              </div>
            )}
          </div>

          {/* Share — owner only */}
          {isOwner && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg
                         border border-emerald-200 text-emerald-600 bg-emerald-50
                         hover:bg-emerald-100 hover:border-emerald-300 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Share
            </button>
          )}

          {canEdit && <button
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
          </button>}
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
              readOnly={isViewer}
            />
          </ReactFlowProvider>
        </div>

        {/* Right panel */}
        {showRightPanel && (
          <div className="w-80 h-full flex-shrink-0">
            {showHistory && (
              <HistoryPanel
                schemaId={useSchemaStore.getState().schemaId}
                onRestore={handleHistoryRestore}
                onClose={() => setShowHistory(false)}
              />
            )}
            {!showHistory && showValidation && (
              <ValidationPanel
                issues={validationIssues}
                onClose={() => setShowValidation(false)}
                onFocusNode={handleFocusNode}
              />
            )}
            {!showHistory && !showValidation && selectedNode && (
              <TableEditor
                nodeId={selectedNode.id}
                onClose={() => setSelectedNode(null)}
              />
            )}
            {!showHistory && !showValidation && selectedEdge && (
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
          Click table to edit · Click relationship to change · Drag handle to connect · Del to remove · Ctrl+Z to undo
        </p>
      </div>

      {/* Undo / Redo toast */}
      {undoToast && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-gray-800 text-white text-xs font-medium
                          px-4 py-2 rounded-full shadow-lg animate-fade-in">
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M5 13l4 4L19 7"/>
            </svg>
            {undoToast.message}
          </div>
        </div>
      )}

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

      {/* ── Share Modal ── */}
      {showShareModal && (
        <ShareModal
          projectId={projectId}
          project={project}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* ── Templates Modal ── */}
      {showTemplatesModal && (
        <TemplatesModal
          onUseTemplate={handleUseTemplate}
          onClose={() => setShowTemplatesModal(false)}
        />
      )}

      {/* ── Export SQL Modal ── */}
      {showExportModal && (
        <ExportModal
          onExport={async (dialect) => { await handleExportSQL(dialect); setShowExportModal(false) }}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  )
}

// ── Export SQL Modal ──────────────────────────────────────────────
function ExportModal({ onExport, onClose }) {
  const [selected, setSelected] = useState('mysql')
  const [exporting, setExporting] = useState(false)

  const dialects = [
    {
      value: 'mysql',
      label: 'MySQL',
      desc: 'InnoDB · backtick identifiers · AUTO_INCREMENT',
      color: 'blue',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
      ),
    },
    {
      value: 'postgresql',
      label: 'PostgreSQL',
      desc: 'SERIAL / BIGSERIAL · double-quote identifiers · inline FK constraints',
      color: 'indigo',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      ),
    },
    {
      value: 'sqlite',
      label: 'SQLite',
      desc: 'INTEGER PRIMARY KEY · AUTOINCREMENT · PRAGMA foreign_keys',
      color: 'teal',
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      ),
    },
  ]

  const colorMap = {
    blue:   { ring: 'ring-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700'   },
    indigo: { ring: 'ring-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
    teal:   { ring: 'ring-teal-500',   bg: 'bg-teal-50',   text: 'text-teal-600',   badge: 'bg-teal-100 text-teal-700'   },
  }

  async function handleDownload() {
    setExporting(true)
    await onExport(selected)
    setExporting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Export SQL</h2>
            <p className="text-sm text-gray-500 mt-0.5">Choose your target database dialect</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors -mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Dialect cards */}
        <div className="p-6 space-y-3">
          {dialects.map(d => {
            const c      = colorMap[d.color]
            const active = selected === d.value
            return (
              <button key={d.value} type="button" onClick={() => setSelected(d.value)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all
                  ${active
                    ? `border-${d.color}-400 ${c.bg} ring-2 ${c.ring}/30`
                    : 'border-gray-200 hover:border-gray-300 bg-white'}`}>

                {/* Icon circle */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
                  ${active ? c.bg : 'bg-gray-100'} ${active ? c.text : 'text-gray-400'}`}>
                  {d.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${active ? c.text : 'text-gray-800'}`}>
                      {d.label}
                    </span>
                    {active && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${c.badge}`}>
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{d.desc}</p>
                </div>

                {/* Radio dot */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${active ? `border-${d.color}-500` : 'border-gray-300'}`}>
                  {active && <div className={`w-2 h-2 rounded-full bg-${d.color}-500`}/>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600
                       hover:bg-gray-50 hover:border-gray-300 transition-all font-medium">
            Cancel
          </button>
          <button onClick={handleDownload} disabled={exporting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700 text-sm text-white font-semibold
                       transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {exporting
              ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg> Generating…</>
              : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg> Download .sql</>
            }
          </button>
        </div>
      </div>
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

// ── Share Modal ───────────────────────────────────────────────────
function ShareModal({ projectId, project, onClose }) {
  const [collaborators, setCollaborators] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviteRole,    setInviteRole]    = useState('editor')
  const [inviting,      setInviting]      = useState(false)
  const [inviteError,   setInviteError]   = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    api.get(`/projects/${projectId}/collaborators`)
      .then(res => setCollaborators(res.data))
      .finally(() => setLoading(false))
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError(''); setInviteSuccess('')
    try {
      const res = await api.post(`/projects/${projectId}/collaborators`, { email: inviteEmail.trim(), role: inviteRole })
      setCollaborators(prev => [...prev, res.data])
      setInviteEmail('')
      setInviteSuccess(`Invitation sent to ${res.data.name}! They need to accept it.`)
      setTimeout(() => setInviteSuccess(''), 3000)
    } catch (err) {
      setInviteError(err.response?.data?.message || 'No account found with that email.')
    } finally { setInviting(false) }
  }

  const handleRemove = async (userId) => {
    await api.delete(`/projects/${projectId}/collaborators/${userId}`).catch(() => {})
    setCollaborators(prev => prev.filter(c => c.id !== userId))
  }

  const handleRoleChange = async (userId, role) => {
    await api.put(`/projects/${projectId}/collaborators/${userId}`, { role }).catch(() => {})
    setCollaborators(prev => prev.map(c => c.id === userId ? { ...c, role } : c))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-modal overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Share Project</h2>
              <p className="text-xs text-gray-500">Invite teammates to collaborate</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Owner */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Owner</p>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{project?.owner?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{project?.owner?.name}</p>
                <p className="text-xs text-gray-500 truncate">{project?.owner?.email}</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Owner</span>
            </div>
          </div>

          {/* Collaborators */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Collaborators
              {collaborators.length > 0 && (
                <span className="ml-1 font-normal text-gray-400">
                  ({collaborators.filter(c => c.status === 'accepted').length} accepted
                  {collaborators.filter(c => c.status === 'pending').length > 0 &&
                    `, ${collaborators.filter(c => c.status === 'pending').length} pending`})
                </span>
              )}
            </p>
            {loading ? (
              <p className="text-center py-4 text-gray-400 text-sm">Loading...</p>
            ) : collaborators.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs">
                No collaborators yet. Invite someone below!
              </div>
            ) : (
              <div className="space-y-2">
                {collaborators.map(c => {
                  const isPending = c.status === 'pending'
                  return (
                    <div key={c.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border
                        ${isPending
                          ? 'bg-amber-50 border-amber-100'
                          : 'bg-gray-50 border-gray-100'}`}>

                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                        ${isPending ? 'bg-amber-400' : 'bg-gray-400'}`}>
                        <span className="text-white text-xs font-bold">{c.name?.[0]?.toUpperCase()}</span>
                      </div>

                      {/* Name + email */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                          {isPending && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200
                                             px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{c.email}</p>
                      </div>

                      {/* Role selector — disabled while pending */}
                      <select
                        value={c.role}
                        onChange={e => handleRoleChange(c.id, e.target.value)}
                        disabled={isPending}
                        title={isPending ? 'Cannot change role until invitation is accepted' : ''}
                        className={`text-xs border rounded-lg px-2 py-1 outline-none flex-shrink-0
                          ${isPending
                            ? 'bg-amber-50 border-amber-200 text-amber-500 cursor-not-allowed opacity-70'
                            : 'bg-white border-gray-200 text-gray-600 cursor-pointer'}`}>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemove(c.id)}
                        title={isPending ? 'Cancel invitation' : 'Remove collaborator'}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0 rounded-lg hover:bg-red-50">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Invite form */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Invite by email</p>
            {inviteSuccess && <div className="mb-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{inviteSuccess}</div>}
            {inviteError   && <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</div>}
            <div className="flex gap-2 mb-2">
              <input type="email" value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                placeholder="colleague@example.com"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 bg-white outline-none text-gray-600 cursor-pointer">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                ${inviting || !inviteEmail.trim()
                  ? 'bg-emerald-100 text-emerald-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Schema Templates ──────────────────────────────────────────────
const col = (id, name, type, opts = {}) => ({
  id, name, type,
  nullable:      opts.nullable      ?? false,
  pk:            opts.pk            ?? false,
  unique:        opts.unique        ?? false,
  autoIncrement: opts.autoIncrement ?? false,
  default:       opts.default       ?? null,
  fk:            opts.fk            ?? false,
})
const pkCol  = (id, name='id') => col(id, name, 'BIGINT', { pk: true, unique: true, autoIncrement: true })
const fkCol  = (id, name)       => col(id, name, 'BIGINT', { fk: true })
const fkNullCol = (id, name)    => col(id, name, 'BIGINT', { fk: true, nullable: true })

const SCHEMA_TEMPLATES = [
  {
    id: 'blog', name: 'Blog Platform',
    description: 'Users, posts, categories, comments, and tags with a post-tag pivot table.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-purple-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    nodes: [
      { id:'bt_users',     type:'tableNode', position:{x:80,  y:80},  data:{name:'users',     columns:[pkCol('bu1'),col('bu2','name','VARCHAR'),col('bu3','email','VARCHAR',{unique:true}),col('bu4','password','VARCHAR')]}},
      { id:'bt_categories',type:'tableNode', position:{x:80,  y:360}, data:{name:'categories',columns:[pkCol('bc1'),col('bc2','name','VARCHAR',{unique:true}),col('bc3','slug','VARCHAR',{unique:true})]}},
      { id:'bt_posts',     type:'tableNode', position:{x:460, y:80},  data:{name:'posts',     columns:[pkCol('bp1'),fkCol('bp2','user_id'),fkNullCol('bp3','category_id'),col('bp4','title','VARCHAR'),col('bp5','body','TEXT'),col('bp6','published_at','DATETIME',{nullable:true})]}},
      { id:'bt_comments',  type:'tableNode', position:{x:460, y:380}, data:{name:'comments',  columns:[pkCol('bm1'),fkCol('bm2','post_id'),fkCol('bm3','user_id'),col('bm4','body','TEXT')]}},
      { id:'bt_tags',      type:'tableNode', position:{x:840, y:80},  data:{name:'tags',      columns:[pkCol('bt1'),col('bt2','name','VARCHAR',{unique:true})]}},
      { id:'bt_post_tags', type:'tableNode', position:{x:840, y:360}, data:{name:'post_tags', columns:[pkCol('bpt1'),fkCol('bpt2','post_id'),fkCol('bpt3','tag_id')]}},
    ],
    edges: [
      {id:'be1',source:'bt_users',    target:'bt_posts',    type:'smoothstep',data:{type:'1:N',sourceLabel:'writes',targetLabel:''}},
      {id:'be2',source:'bt_categories',target:'bt_posts',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be3',source:'bt_posts',    target:'bt_comments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be4',source:'bt_users',    target:'bt_comments', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be5',source:'bt_posts',    target:'bt_post_tags',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'be6',source:'bt_tags',     target:'bt_post_tags',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },
  {
    id: 'ecommerce', name: 'E-Commerce Store',
    description: 'Products, categories, orders, order items, customers, and product reviews.',
    tableCount: 6, edgeCount: 6,
    color: 'bg-blue-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
    nodes: [
      { id:'ec_users',      type:'tableNode', position:{x:80,  y:80},  data:{name:'users',      columns:[pkCol('eu1'),col('eu2','name','VARCHAR'),col('eu3','email','VARCHAR',{unique:true}),col('eu4','password','VARCHAR')]}},
      { id:'ec_categories', type:'tableNode', position:{x:80,  y:360}, data:{name:'categories', columns:[pkCol('ec1'),col('ec2','name','VARCHAR',{unique:true}),col('ec3','description','TEXT',{nullable:true})]}},
      { id:'ec_products',   type:'tableNode', position:{x:460, y:80},  data:{name:'products',   columns:[pkCol('ep1'),fkCol('ep2','category_id'),col('ep3','name','VARCHAR'),col('ep4','price','DECIMAL'),col('ep5','stock','INT',{default:'0'})]}},
      { id:'ec_orders',     type:'tableNode', position:{x:460, y:380}, data:{name:'orders',     columns:[pkCol('eo1'),fkCol('eo2','user_id'),col('eo3','status','ENUM',{default:'pending'}),col('eo4','total_amount','DECIMAL')]}},
      { id:'ec_order_items',type:'tableNode', position:{x:840, y:80},  data:{name:'order_items',columns:[pkCol('ei1'),fkCol('ei2','order_id'),fkCol('ei3','product_id'),col('ei4','quantity','INT'),col('ei5','unit_price','DECIMAL')]}},
      { id:'ec_reviews',    type:'tableNode', position:{x:840, y:380}, data:{name:'reviews',    columns:[pkCol('er1'),fkCol('er2','product_id'),fkCol('er3','user_id'),col('er4','rating','INT'),col('er5','body','TEXT',{nullable:true})]}},
    ],
    edges: [
      {id:'ee1',source:'ec_users',     target:'ec_orders',     type:'smoothstep',data:{type:'1:N',sourceLabel:'places',targetLabel:''}},
      {id:'ee2',source:'ec_categories',target:'ec_products',   type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee3',source:'ec_orders',    target:'ec_order_items',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee4',source:'ec_products',  target:'ec_order_items',type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee5',source:'ec_products',  target:'ec_reviews',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'ee6',source:'ec_users',     target:'ec_reviews',    type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },
  {
    id: 'saas', name: 'SaaS Platform',
    description: 'Organizations, members, subscriptions, and invoices for a multi-tenant app.',
    tableCount: 5, edgeCount: 5,
    color: 'bg-indigo-600',
    icon: <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
    nodes: [
      { id:'ss_users', type:'tableNode', position:{x:80,  y:80},  data:{name:'users',         columns:[pkCol('su1'),col('su2','name','VARCHAR'),col('su3','email','VARCHAR',{unique:true}),col('su4','password','VARCHAR')]}},
      { id:'ss_orgs',  type:'tableNode', position:{x:460, y:80},  data:{name:'organizations', columns:[pkCol('so1'),fkCol('so2','owner_id'),col('so3','name','VARCHAR'),col('so4','plan','ENUM',{default:'free'})]}},
      { id:'ss_mbrs',  type:'tableNode', position:{x:80,  y:380}, data:{name:'org_members',   columns:[pkCol('sm1'),fkCol('sm2','org_id'),fkCol('sm3','user_id'),col('sm4','role','ENUM',{default:'member'})]}},
      { id:'ss_subs',  type:'tableNode', position:{x:460, y:380}, data:{name:'subscriptions', columns:[pkCol('ss1'),fkCol('ss2','org_id'),col('ss3','plan','ENUM'),col('ss4','status','ENUM',{default:'active'}),col('ss5','expires_at','DATETIME',{nullable:true})]}},
      { id:'ss_invs',  type:'tableNode', position:{x:840, y:230}, data:{name:'invoices',      columns:[pkCol('si1'),fkCol('si2','subscription_id'),col('si3','amount','DECIMAL'),col('si4','status','ENUM',{default:'unpaid'}),col('si5','issued_at','DATE')]}},
    ],
    edges: [
      {id:'se1',source:'ss_users',target:'ss_orgs', type:'smoothstep',data:{type:'1:N',sourceLabel:'owns',targetLabel:''}},
      {id:'se2',source:'ss_orgs', target:'ss_mbrs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'se3',source:'ss_users',target:'ss_mbrs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'se4',source:'ss_orgs', target:'ss_subs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
      {id:'se5',source:'ss_subs', target:'ss_invs', type:'smoothstep',data:{type:'1:N',sourceLabel:'',targetLabel:''}},
    ],
  },
]

// ── Templates Modal ───────────────────────────────────────────────
function TemplatesModal({ onUseTemplate, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-modal overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="font-bold text-gray-900">Schema Templates</h2>
            <p className="text-xs text-gray-500 mt-0.5">Start from a pre-built schema and customize it</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SCHEMA_TEMPLATES.map(t => (
            <div key={t.id}
              className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md
                         transition-all flex flex-col">
              <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center mb-3`}>
                {t.icon}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{t.name}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4 flex-1">{t.description}</p>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>{t.tableCount} tables</span>
                <span>{t.edgeCount} relations</span>
              </div>
              <button
                onClick={() => onUseTemplate(t)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs
                           font-semibold rounded-lg transition-colors">
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
