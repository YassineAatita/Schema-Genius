import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { parseSqlToSchema } from '../utils/parseSql'
import SchemaCanvas from '../components/canvas/SchemaCanvas'
import TableEditor from '../components/panels/TableEditor'
import RelationshipEditor from '../components/panels/RelationshipEditor'
import useSchemaStore, { setBroadcastFn, setRemoteUpdate } from '../store/useSchemaStore'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'
import ConfirmModal from '../components/ui/ConfirmModal'
import HistoryPanel from '../components/panels/HistoryPanel'
import { validateSchema } from '../utils/validateSchema'
import { joinProjectChannel, leaveProjectChannel } from '../services/websocket'

// Deterministic cursor / avatar colors for remote collaborators
const CURSOR_COLORS = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16']
const getCursorColor = (id) => CURSOR_COLORS[(id || 0) % CURSOR_COLORS.length]

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
  const [showHistory,       setShowHistory]       = useState(false)
  const [undoToast,         setUndoToast]         = useState(null)  // { message }
  const [showGenerateMenu,  setShowGenerateMenu]  = useState(false)
  const [showImportSql,     setShowImportSql]     = useState(false)
  const [showVisionAi,      setShowVisionAi]      = useState(false)
  const [visionLoading,     setVisionLoading]     = useState(false)
  const [visionError,       setVisionError]       = useState('')
  const pendingAiSchema  = useRef(null)
  const moreMenuRef      = useRef(null)
  const generateMenuRef  = useRef(null)
  const canvasRef        = useRef(null)

  // ── Real-time collaboration ────────────────────────────────────────────────
  const channelRef               = useRef(null)
  const [activeUsers,   setActiveUsers]   = useState([])   // presence members
  const [remoteCursors, setRemoteCursors] = useState({})   // { userId: { userId, name, color, x, y } }

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

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const onMouseDown = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target))
        setShowMoreMenu(false)
      if (generateMenuRef.current && !generateMenuRef.current.contains(e.target))
        setShowGenerateMenu(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── Reverb presence channel ────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !user?.id) return

    const channel = joinProjectChannel(parseInt(projectId))
    channelRef.current = channel

    // Presence: who is viewing this project right now
    channel
      .here(users  => setActiveUsers(users))
      .joining(u   => setActiveUsers(prev => [...prev.filter(p => p.id !== u.id), u]))
      .leaving(u   => {
        setActiveUsers(prev => prev.filter(p => p.id !== u.id))
        setRemoteCursors(prev => { const n = { ...prev }; delete n[u.id]; return n })
      })

    // Wire store broadcast → channel whisper (viewers get the fn but store skips
    // emitting when canEdit is false, so this is safe)
    setBroadcastFn((event, data) => {
      try { channelRef.current?.whisper(event, data) } catch {}
    })

    // Helper: apply an incoming remote event without re-broadcasting or dirtying
    const applyRemote = (fn) => { setRemoteUpdate(true); fn(); setRemoteUpdate(false) }

    channel
      .listenForWhisper('SchemaNodeAdded', ({ node }) =>
        applyRemote(() => useSchemaStore.setState(s => ({
          nodes: s.nodes.some(n => n.id === node.id) ? s.nodes : [...s.nodes, node],
        })))
      )
      .listenForWhisper('SchemaNodeUpdated', ({ nodeId, data }) =>
        applyRemote(() => useSchemaStore.getState().updateNodeData(nodeId, data))
      )
      .listenForWhisper('SchemaNodeMoved', ({ nodeId, position }) =>
        applyRemote(() => useSchemaStore.setState(s => ({
          nodes: s.nodes.map(n => n.id === nodeId ? { ...n, position } : n),
        })))
      )
      .listenForWhisper('SchemaNodeDeleted', ({ nodeId }) =>
        applyRemote(() => useSchemaStore.setState(s => ({
          nodes: s.nodes.filter(n => n.id !== nodeId),
          edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        })))
      )
      .listenForWhisper('SchemaEdgeAdded', ({ edge }) =>
        applyRemote(() => useSchemaStore.setState(s => ({
          edges: s.edges.some(e => e.id === edge.id) ? s.edges : [...s.edges, edge],
        })))
      )
      .listenForWhisper('SchemaEdgeDeleted', ({ edgeId }) =>
        applyRemote(() => useSchemaStore.setState(s => ({
          edges: s.edges.filter(e => e.id !== edgeId),
        })))
      )
      .listenForWhisper('CursorMoved', ({ userId, name, x, y }) => {
        if (userId === user.id) return
        setRemoteCursors(prev => ({
          ...prev,
          [userId]: { userId, name, x, y, color: getCursorColor(userId) },
        }))
      })

    return () => {
      setBroadcastFn(null)
      channelRef.current = null
      leaveProjectChannel(parseInt(projectId))
      setActiveUsers([])
      setRemoteCursors({})
    }
  }, [projectId, user?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active-user heartbeat ──────────────────────────────────────────────────
  // POST on mount so the dashboard badge increments within one polling cycle.
  // Refresh every 90 s so the cache TTL (300 s) never expires while designing.
  // DELETE on unmount so the badge clears immediately without waiting for TTL.
  useEffect(() => {
    if (!projectId || !user?.id) return
    api.post(`/projects/${projectId}/active`).catch(() => {})
    const interval = setInterval(
      () => api.post(`/projects/${projectId}/active`).catch(() => {}),
      90000
    )
    return () => {
      clearInterval(interval)
      api.delete(`/projects/${projectId}/active`).catch(() => {})
    }
  }, [projectId, user?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  // Cursor move handler — only editors/owners emit; viewers receive only
  const handleCursorMove = useCallback((x, y) => {
    if (!user || isViewer) return
    try { channelRef.current?.whisper('CursorMoved', { userId: user.id, name: user.name, x, y }) } catch {}
  }, [user, isViewer])

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
      const dialectSuffix = dialect !== 'mysql' ? `_${dialect}` : ''
      link.download  = `schema_${project?.name || schemaId}${dialectSuffix}.sql`.replace(/\s+/g, '_').toLowerCase()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Make sure you have saved the schema first.')
    }
  }

  const handleExportImage = async () => {
    const el = canvasRef.current?.querySelector('.react-flow__renderer')
    if (!el) return
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#F9FAFB',
        pixelRatio: 2,
        filter: (node) => !node.classList?.contains('react-flow__controls')
                       && !node.classList?.contains('react-flow__minimap'),
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${project?.name || 'schema'}_diagram.png`.replace(/\s+/g, '_').toLowerCase()
      link.click()
    } catch {
      alert('Image export failed. Please try again.')
    }
  }

  const handleVisionGenerate = async (imageDataUrl, prompt) => {
    setVisionLoading(true)
    setVisionError('')
    try {
      const res = await api.post('/ai/generate-from-image', { image: imageDataUrl, prompt })
      const schema = res.data
      if (!schema.nodes?.length) {
        setVisionError('No tables detected. Try a clearer image or add a description.')
        return
      }
      if (nodes.length > 0) {
        pendingAiSchema.current = schema
        setShowVisionAi(false)
        setShowAiConfirm(true)
      } else {
        aiGenerate(schema.nodes, schema.edges || [])
        setShowVisionAi(false)
      }
    } catch (err) {
      setVisionError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setVisionLoading(false)
    }
  }

  const handleImportSql = (schema) => {
    if (nodes.length > 0) {
      pendingAiSchema.current = schema
      setShowImportSql(false)
      setShowAiConfirm(true)
    } else {
      aiGenerate(schema.nodes, schema.edges || [])
      setShowImportSql(false)
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
        <div className="flex items-center gap-1.5">

          {/* Undo / Redo */}
          {canEdit && (
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={handleUndo} disabled={past.length === 0} title="Undo (Ctrl+Z)"
                className={`p-1.5 transition-all ${past.length === 0 ? 'text-gray-300 bg-white cursor-not-allowed' : 'text-gray-500 bg-white hover:bg-gray-50 hover:text-blue-600'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </button>
              <div className="w-px h-4 bg-gray-200"/>
              <button onClick={handleRedo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)"
                className={`p-1.5 transition-all ${future.length === 0 ? 'text-gray-300 bg-white cursor-not-allowed' : 'text-gray-500 bg-white hover:bg-gray-50 hover:text-blue-600'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/>
                </svg>
              </button>
            </div>
          )}

          {canEdit && <div className="w-px h-5 bg-gray-200 mx-0.5"/>}

          {/* Add Table */}
          {canEdit && (
            <button onClick={addTable} title="Add a new table"
              className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg
                         border border-gray-200 bg-white text-gray-600
                         hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              <span className="hidden sm:inline">Table</span>
            </button>
          )}

          {/* Generate dropdown — editors only */}
          {canEdit && (
            <div className="relative" ref={generateMenuRef}>
              <button
                onClick={() => setShowGenerateMenu(v => !v)}
                className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg border transition-all
                  ${showGenerateMenu
                    ? 'border-violet-300 bg-violet-100 text-violet-700'
                    : 'border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:border-violet-300'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <span className="hidden sm:inline">Generate</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {showGenerateMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border
                                border-gray-200 shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-3 py-1.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">AI Generation</p>
                  </div>
                  <button
                    onClick={() => { setShowAiModal(true); setAiError(''); setShowGenerateMenu(false) }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">From description</p>
                      <p className="text-xs text-gray-400">Describe your app in plain text</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowVisionAi(true); setVisionError(''); setShowGenerateMenu(false) }}
                    className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left">
                    <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">From image</p>
                      <p className="text-xs text-gray-400">Upload a sketch or screenshot</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Import SQL */}
          {canEdit && (
            <button
              onClick={() => setShowImportSql(true)}
              title="Import SQL — paste CREATE TABLE statements"
              className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg
                         border border-blue-200 bg-blue-50 text-blue-600
                         hover:bg-blue-100 hover:border-blue-300 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              <span className="hidden sm:inline">Import SQL</span>
            </button>
          )}

          <div className="w-px h-5 bg-gray-200 mx-0.5"/>

          {/* ⋯ More dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              title="More options"
              className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1.5 rounded-lg border transition-all
                ${showMoreMenu
                  ? 'border-gray-300 bg-gray-100 text-gray-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
              </svg>
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border
                              border-gray-200 shadow-xl z-50 overflow-hidden py-1">

                <button onClick={() => { setShowHistory(true); setSelectedNode(null); setSelectedEdge(null); setShowValidation(false); setShowMoreMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Version History
                </button>

                {canEdit && (
                  <button onClick={() => { setShowTemplatesModal(true); setShowMoreMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
                    </svg>
                    Templates
                  </button>
                )}

                <button onClick={() => { handleValidateClick(); setShowMoreMenu(false) }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left
                    ${errorCount > 0 ? 'text-red-600' : warningCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                  <span className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Validate Schema
                  </span>
                  {(errorCount > 0 || warningCount > 0) && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${errorCount > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {errorCount > 0 ? errorCount : warningCount}
                    </span>
                  )}
                </button>

                <div className="h-px bg-gray-100 my-1"/>

                {/* Export SQL — dialect sub-menu */}
                <div className="px-4 pt-2.5 pb-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                    Export SQL
                  </p>
                  <div className="flex gap-1.5">
                    {[
                      { dialect: 'mysql',      label: 'MySQL',      color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
                      { dialect: 'postgresql', label: 'PostgreSQL', color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
                      { dialect: 'sqlite',     label: 'SQLite',     color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
                    ].map(({ dialect, label, color }) => (
                      <button key={dialect}
                        onClick={() => { handleExportSQL(dialect); setShowMoreMenu(false) }}
                        className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg border transition-colors ${color}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => { handleExportImage(); setShowMoreMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Export as PNG
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-gray-200 mx-0.5"/>

          {/* Active collaborators avatar stack */}
          {activeUsers.filter(u => u.id !== user?.id).length > 0 && (
            <div className="flex items-center gap-1.5 mr-1">
              <div className="flex -space-x-2">
                {activeUsers
                  .filter(u => u.id !== user?.id)
                  .slice(0, 4)
                  .map(u => (
                    <div
                      key={u.id}
                      title={u.name}
                      className="w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center
                                 text-[11px] font-bold text-white overflow-hidden flex-shrink-0"
                      style={{ backgroundColor: getCursorColor(u.id) }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover"/>
                        : (u.name || '?')[0].toUpperCase()
                      }
                    </div>
                  ))
                }
                {activeUsers.filter(u => u.id !== user?.id).length > 4 && (
                  <div className="w-7 h-7 rounded-full ring-2 ring-white bg-gray-400 flex items-center
                                  justify-center text-[11px] font-bold text-white flex-shrink-0">
                    +{activeUsers.filter(u => u.id !== user?.id).length - 4}
                  </div>
                )}
              </div>
              <span className="text-[11px] text-gray-400 hidden lg:inline whitespace-nowrap">
                {activeUsers.filter(u => u.id !== user?.id).length} online
              </span>
            </div>
          )}

          {/* Share */}
          {isOwner && (
            <button onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1.5 rounded-lg
                         border border-emerald-200 bg-emerald-50 text-emerald-600
                         hover:bg-emerald-100 hover:border-emerald-300 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* Save */}
          {canEdit && (
            <button onClick={handleSave} disabled={saving || (!isDirty && saveMsg !== 'error')}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all
                ${saveMsg === 'saved' ? 'bg-green-500 text-white'
                  : saveMsg === 'error' ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                  : saving ? 'bg-blue-400 text-white cursor-wait'
                  : isDirty ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              {saving ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : saveMsg === 'saved' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-4 0V3m0 0L8 6m4-3l4 3"/>
                </svg>
              )}
              {saving ? 'Saving…' : saveMsg === 'saved' ? 'Saved!' : saveMsg === 'error' ? 'Retry' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas */}
        <div className="flex-1 overflow-hidden" ref={canvasRef}>
          <ReactFlowProvider>
            <SchemaCanvas
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              readOnly={isViewer}
              onCursorMove={handleCursorMove}
              remoteCursors={remoteCursors}
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

      {/* ── Import SQL Modal ── */}
      {showImportSql && (
        <ImportSqlModal
          onImport={handleImportSql}
          onClose={() => setShowImportSql(false)}
        />
      )}

      {/* ── Vision AI Modal ── */}
      {showVisionAi && (
        <VisionAiModal
          loading={visionLoading}
          error={visionError}
          onGenerate={handleVisionGenerate}
          onClose={() => { setShowVisionAi(false); setVisionError('') }}
        />
      )}

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
    </div>
  )
}

// ── Import SQL Modal ─────────────────────────────────────────────
function ImportSqlModal({ onImport, onClose }) {
  const [sql,     setSql]     = useState('')
  const [preview, setPreview] = useState(null)   // { nodes, edges } | null
  const [error,   setError]   = useState('')

  const handleParse = () => {
    setError('')
    setPreview(null)
    const trimmed = sql.trim()
    if (!trimmed) { setError('Paste some SQL first.'); return }
    const result = parseSqlToSchema(trimmed)
    if (!result || result.nodes.length === 0) {
      setError('No CREATE TABLE statements found. Make sure your SQL contains valid table definitions.')
      return
    }
    setPreview(result)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Import SQL</h2>
              <p className="text-xs text-gray-400">MySQL · PostgreSQL · SQLite</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Paste your <code className="bg-gray-100 px-1 rounded text-xs">CREATE TABLE</code> statements below.
            Foreign keys will automatically become relationships on the canvas.
          </p>

          <textarea
            value={sql}
            onChange={e => { setSql(e.target.value); setPreview(null); setError('') }}
            placeholder={`CREATE TABLE users (\n  id BIGINT PRIMARY KEY AUTO_INCREMENT,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE NOT NULL\n);\n\nCREATE TABLE posts (\n  id BIGINT PRIMARY KEY AUTO_INCREMENT,\n  user_id BIGINT NOT NULL,\n  title VARCHAR(255),\n  FOREIGN KEY (user_id) REFERENCES users(id)\n);`}
            rows={12}
            className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-xl resize-none
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-300 bg-gray-50"
          />

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {preview && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-sm font-medium text-green-800 mb-2">
                ✓ Found {preview.nodes.length} table{preview.nodes.length !== 1 ? 's' : ''}
                {preview.edges.length > 0 && ` · ${preview.edges.length} relationship${preview.edges.length !== 1 ? 's' : ''}`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.nodes.map(n => (
                  <span key={n.id}
                    className="text-xs bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {n.data.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200
                       hover:border-gray-300 rounded-xl transition-colors">
            Cancel
          </button>
          <div className="flex gap-2">
            <button onClick={handleParse}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200
                         hover:bg-blue-100 rounded-xl transition-colors">
              Parse SQL
            </button>
            <button
              onClick={() => preview && onImport(preview)}
              disabled={!preview}
              className={`px-5 py-2 text-sm font-medium rounded-xl transition-all
                ${preview
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              Import to Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Vision AI Modal ───────────────────────────────────────────────
function VisionAiModal({ loading, error, onGenerate, onClose }) {
  const [image,   setImage]   = useState(null)    // data URL
  const [prompt,  setPrompt]  = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    loadFile(e.dataTransfer.files[0])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-100 to-violet-100
                            flex items-center justify-center">
              <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">Generate from Image</h2>
              <p className="text-xs text-gray-400">AI Vision · Upload a sketch or screenshot</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Drop zone */}
          <div
            onClick={() => !image && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
              ${image ? 'border-green-300 bg-green-50' : dragOver
                ? 'border-violet-400 bg-violet-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'}`}
            style={{ minHeight: 180 }}
          >
            {image ? (
              <div className="relative">
                <img src={image} alt="Preview" className="w-full max-h-64 object-contain rounded-xl"/>
                <button
                  onClick={(e) => { e.stopPropagation(); setImage(null) }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-md
                             flex items-center justify-center text-gray-500 hover:text-red-500
                             border border-gray-200 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">Drop an image here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 3 MB</p>
                <p className="text-xs text-gray-400 mt-0.5">Sketches · Whiteboards · Screenshots · Paint drawings</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => loadFile(e.target.files[0])}/>
          </div>

          {/* Optional prompt */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Additional context <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder='e.g. "This is an e-commerce system with users and orders"'
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                         placeholder:text-gray-300"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <svg className="animate-spin w-4 h-4 text-violet-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <p className="text-sm text-violet-700 font-medium">Analysing image with AI…</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200
                       hover:border-gray-300 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={() => image && onGenerate(image, prompt.trim())}
            disabled={!image || loading}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-xl transition-all
              ${image && !loading
                ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
            {loading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            )}
            {loading ? 'Generating…' : 'Generate Schema'}
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
  const [tab,           setTab]           = useState('friends')  // 'friends' | 'email'
  const [collaborators, setCollaborators] = useState([])
  const [collabLoading, setCollabLoading] = useState(true)
  const [friends,       setFriends]       = useState([])
  const [friendsLoading,setFriendsLoading]= useState(true)
  const [inviteRole,    setInviteRole]    = useState('editor')
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviting,      setInviting]      = useState(false)  // false | userId | 'email'
  const [inviteError,   setInviteError]   = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    // Load collaborators + friends in parallel
    api.get(`/projects/${projectId}/collaborators`)
      .then(res => setCollaborators(res.data))
      .finally(() => setCollabLoading(false))
    api.get('/friends')
      .then(res => setFriends(res.data))
      .finally(() => setFriendsLoading(false))
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const isAlreadyCollaborator = (userId) =>
    collaborators.some(c => c.id === userId)

  const handleInviteFriend = async (friend) => {
    if (isAlreadyCollaborator(friend.id)) return
    setInviting(friend.id); setInviteError(''); setInviteSuccess('')
    try {
      const res = await api.post(`/projects/${projectId}/collaborators`, { user_id: friend.id, role: inviteRole })
      setCollaborators(prev => [...prev, res.data])
      setInviteSuccess(`${friend.name} was invited as ${inviteRole}!`)
      setTimeout(() => setInviteSuccess(''), 3000)
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Could not send invite.')
    } finally { setInviting(false) }
  }

  const handleInviteEmail = async () => {
    if (!inviteEmail.trim()) return
    setInviting('email'); setInviteError(''); setInviteSuccess('')
    try {
      const res = await api.post(`/projects/${projectId}/collaborators`, { email: inviteEmail.trim(), role: inviteRole })
      setCollaborators(prev => [...prev, res.data])
      setInviteEmail('')
      setInviteSuccess(`Invitation sent to ${res.data.name}!`)
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-modal overflow-hidden flex flex-col"
           style={{ maxHeight: '88vh' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
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

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
          <button onClick={() => { setTab('friends'); setInviteError(''); setInviteSuccess('') }}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
              ${tab === 'friends'
                ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                : 'text-gray-400 hover:text-gray-600'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Invite from Friends
            {friends.length > 0 && (
              <span className="bg-emerald-100 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {friends.length}
              </span>
            )}
          </button>
          <button onClick={() => { setTab('email'); setInviteError(''); setInviteSuccess('') }}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
              ${tab === 'email'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                : 'text-gray-400 hover:text-gray-600'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Invite by Email
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Role selector — shared between tabs */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <div>
                <p className="text-xs font-semibold text-gray-700">Role for new invites</p>
                <p className="text-[11px] text-gray-400">Editors can modify, viewers can only view</p>
              </div>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white outline-none
                           text-gray-700 cursor-pointer focus:ring-2 focus:ring-emerald-400">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            {/* Feedback */}
            {inviteSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                <p className="text-xs text-emerald-700 font-medium">{inviteSuccess}</p>
              </div>
            )}
            {inviteError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                <p className="text-xs text-red-700">{inviteError}</p>
              </div>
            )}

            {/* ── Friends Tab ── */}
            {tab === 'friends' && (
              <div className="space-y-2">
                {friendsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"/>
                    Loading friends…
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600">No friends yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Go to <a href="/dashboard" target="_blank" className="text-blue-500 hover:underline">Dashboard → Friends</a> to connect with teammates first.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-gray-400 px-1">
                      Click <strong>Invite</strong> to send a collaboration request
                    </p>
                    {friends.map(f => {
                      const already    = isAlreadyCollaborator(f.id)
                      const isInviting = inviting === f.id
                      return (
                        <div key={f.friendship_id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                            ${already ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>

                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center
                                          font-bold text-white text-sm overflow-hidden
                                          ${f.avatar_url ? '' : 'bg-emerald-500'}`}>
                            {f.avatar_url
                              ? <img src={f.avatar_url} alt={f.name} className="w-full h-full object-cover"/>
                              : (f.name || '?')[0].toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{f.name}</p>
                            <p className="text-xs text-gray-400 truncate">{f.email}</p>
                          </div>

                          {/* Action */}
                          {already ? (
                            <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                              Already invited
                            </span>
                          ) : isInviting ? (
                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/>
                          ) : (
                            <button onClick={() => handleInviteFriend(f)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600
                                         hover:bg-emerald-700 text-white transition-colors shadow-sm">
                              Invite
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── Email Tab ── */}
            {tab === 'email' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                  Send invitation by email
                </label>
                <div className="flex gap-2">
                  <input type="email" value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleInviteEmail()}
                    placeholder="colleague@example.com"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button onClick={handleInviteEmail} disabled={inviting === 'email' || !inviteEmail.trim()}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
                      ${inviting === 'email' || !inviteEmail.trim()
                        ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}>
                    {inviting === 'email' ? 'Sending…' : 'Send Invite'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  The user must already have a Schema Genius account.
                </p>
              </div>
            )}

            {/* ── Current collaborators ── */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Current collaborators
                {collaborators.length > 0 && (
                  <span className="ml-1 font-normal normal-case">
                    ({collaborators.filter(c=>c.status==='accepted').length} active
                    {collaborators.filter(c=>c.status==='pending').length > 0 &&
                      `, ${collaborators.filter(c=>c.status==='pending').length} pending`})
                  </span>
                )}
              </p>

              {/* Owner row */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{project?.owner?.name?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{project?.owner?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{project?.owner?.email}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Owner</span>
              </div>

              {collabLoading ? (
                <p className="text-center py-3 text-gray-400 text-xs">Loading…</p>
              ) : collaborators.length === 0 ? (
                <p className="text-center py-4 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">
                  No collaborators yet
                </p>
              ) : (
                <div className="space-y-1.5">
                  {collaborators.map(c => {
                    const isPending = c.status === 'pending'
                    return (
                      <div key={c.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl border
                          ${isPending ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold overflow-hidden
                                        ${c.avatar_url ? '' : isPending ? 'bg-amber-400' : 'bg-gray-400'}`}>
                          {c.avatar_url
                            ? <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover"/>
                            : c.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                            {isPending && (
                              <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200
                                               px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Pending</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 truncate">{c.email}</p>
                        </div>
                        <select value={c.role} onChange={e => handleRoleChange(c.id, e.target.value)}
                          disabled={isPending}
                          className={`text-xs border rounded-lg px-2 py-1 outline-none flex-shrink-0
                            ${isPending
                              ? 'bg-amber-50 border-amber-200 text-amber-500 cursor-not-allowed opacity-70'
                              : 'bg-white border-gray-200 text-gray-600 cursor-pointer'}`}>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button onClick={() => handleRemove(c.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors p-1 flex-shrink-0 rounded hover:bg-red-50">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

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
