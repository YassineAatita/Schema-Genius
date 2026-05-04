import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, Sparkles, Upload, CheckCircle, LayoutTemplate,
  Download, History, Image as ImageIcon,
  Sun, Moon, Save, Wifi, WifiOff, Copy, Flame, Code2,
} from 'lucide-react'
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
import OrmExportModal from '../components/ui/OrmExportModal'
import HistoryPanel from '../components/panels/HistoryPanel'
import { validateSchema } from '../utils/validateSchema'
import { joinProjectChannel, leaveProjectChannel } from '../services/websocket'
import { CanvasThemeContext } from '../contexts/CanvasThemeContext'
import { SCHEMA_TEMPLATES } from '../data/schemaTemplates'

// Deterministic cursor / avatar colors for remote collaborators
const CURSOR_COLORS = ['#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16']
const getCursorColor = (id) => CURSOR_COLORS[(id || 0) % CURSOR_COLORS.length]

export default function DesignerPage() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const { loadSchema, addTable, addTableAt, nodes, edges, isDirty, markSaved, aiGenerate, aiMerge,
          undo, redo, past, future } = useSchemaStore()
  const { user } = useAuthStore()

  const [project,          setProject]          = useState(null)
  const [editingName,    setEditingName]    = useState(false)
  const [editNameValue,  setEditNameValue]  = useState('')
  const [nameSaving,     setNameSaving]     = useState(false)
  const nameInputRef     = useRef(null)
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
  const [showOrmModal,      setShowOrmModal]      = useState(false)
  const [showHistory,       setShowHistory]       = useState(false)
  const [undoToast,         setUndoToast]         = useState(null)  // { message }
  const [showGenerateMenu,  setShowGenerateMenu]  = useState(false)
  const [showImportSql,     setShowImportSql]     = useState(false)
  const [showVisionAi,      setShowVisionAi]      = useState(false)
  const [visionLoading,     setVisionLoading]     = useState(false)
  const [visionError,       setVisionError]       = useState('')
  const pendingAiSchema    = useRef(null)
  const pendingGenerationId = useRef(null)   // tracks DB id of the last AI generation
  const moreMenuRef        = useRef(null)
  const generateMenuRef  = useRef(null)
  const canvasRef        = useRef(null)

  // Copy SQL state
  const [copySqlState,   setCopySqlState]   = useState('idle')  // 'idle'|'copying'|'copied'

  // Roast my schema state
  const [showRoastModal, setShowRoastModal] = useState(false)
  const [roastLoading,   setRoastLoading]   = useState(false)
  const [roastItems,     setRoastItems]     = useState([])
  const [roastError,     setRoastError]     = useState('')

  // Canvas dark mode — persisted to localStorage
  const [canvasDark, setCanvasDark] = useState(
    () => localStorage.getItem('canvas-theme') === 'dark'
  )
  const toggleCanvasTheme = useCallback(() => {
    setCanvasDark(d => {
      const next = !d
      localStorage.setItem('canvas-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  // Drop handler — called by SchemaCanvas when a table chip is dropped onto the canvas
  const handleDropTable = useCallback((x, y) => {
    addTableAt(x, y)
  }, [addTableAt])

  // ── Real-time collaboration ────────────────────────────────────────────────
  const channelRef               = useRef(null)
  const [activeUsers,   setActiveUsers]   = useState([])   // presence members
  const [remoteCursors, setRemoteCursors] = useState({})   // { userId: { userId, name, color, x, y } }

  const isOwner  = project?.owner_id === user?.id
  const myRole   = project?.collaborators?.find(c => c.id === user?.id)?.pivot?.role ?? null
  const canEdit  = isOwner || myRole === 'editor'   // owner or accepted editor
  const isViewer = !isOwner && myRole === 'viewer'   // accepted viewer — read-only

  // Run validation whenever nodes or edges change
  const validationIssues = useMemo(() => validateSchema(nodes, edges), [nodes, edges])
  const errorCount   = validationIssues.filter(i => i.type === 'error').length
  const warningCount = validationIssues.filter(i => i.type === 'warning').length

  // AI suggestions state
  const [aiSuggestions,     setAiSuggestions]     = useState([])
  const [aiSuggestLoading,  setAiSuggestLoading]  = useState(false)
  const [aiSuggestError,    setAiSuggestError]     = useState('')
  const [ignoredSuggestions,setIgnoredSuggestions] = useState(new Set())

  // ── Auto-save + Save Version ───────────────────────────────────────────────
  const [autoSaveState,  setAutoSaveState]  = useState('idle')  // 'idle'|'saving'|'saved'|'error'
  const [autoSavedAt,    setAutoSavedAt]    = useState(null)
  const [showSaveModal,  setShowSaveModal]  = useState(false)
  const autoSaveTimerRef = useRef(null)

  // ── WebSocket connection banner ────────────────────────────────────────────
  // 'connected' | 'connecting' | 'disconnected' | 'failed' | 'unavailable' | 'reconnected'
  const [wsConnStatus,    setWsConnStatus]    = useState('connected')
  const reconnectedTimerRef = useRef(null)
  // Keeps the last non-null banner config alive during fade-out transition
  const lastBannerRef = useRef(null)

  // Load project + schema — prefer draft_json (most recent auto-save) over last version
  useEffect(() => {
    api.get(`/projects/${projectId}`)
      .then(res => {
        setProject(res.data)
        const schema = res.data.schema
        if (schema) {
          const json = schema.draft_json          // auto-saved draft (newest)
            ?? schema.current_version?.schema_json  // last named version
            ?? { nodes: [], edges: [] }
          loadSchema(schema.id, projectId, json)
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

  // ── Auto-save: silent background save every 30 s when dirty ───────────────
  useEffect(() => {
    const runAutoSave = async () => {
      const state = useSchemaStore.getState()
      if (!state.schemaId || !state.isDirty || !canEdit) return
      setAutoSaveState('saving')
      try {
        await api.patch(`/schemas/${state.schemaId}/autosave`, {
          schema_json: { nodes: state.nodes, edges: state.edges, meta: {} },
        })
        setAutoSaveState('saved')
        setAutoSavedAt(new Date())
        // Auto-save only clears the indicator; it does NOT call markSaved() so
        // isDirty stays true until the user explicitly saves a version.
        setTimeout(() => setAutoSaveState('idle'), 4000)
      } catch {
        setAutoSaveState('error')
        setTimeout(() => setAutoSaveState('idle'), 5000)
      }
    }

    autoSaveTimerRef.current = setInterval(runAutoSave, 30_000)
    return () => clearInterval(autoSaveTimerRef.current)
  }, [canEdit])  // re-arm when edit permission changes

  // ── WebSocket connection state listener ───────────────────────────────────
  // Primary: browser online/offline events (fire reliably on all network drops).
  // Secondary: Echo/pusher-js state_change (fires on reconnect in some setups).
  // Whichever source fires first wins — duplicate signals are ignored.
  useEffect(() => {
    // True once the user has experienced at least one network loss this session.
    // Prevents the green "Reconnected" banner from appearing on the initial connect.
    let hadNetworkLoss = false

    // ── Check current state on mount ──────────────────────────────────────
    if (!navigator.onLine) {
      hadNetworkLoss = true
      setWsConnStatus('disconnected')
    }

    // ── Browser offline event ─────────────────────────────────────────────
    const handleOffline = () => {
      hadNetworkLoss = true
      clearTimeout(reconnectedTimerRef.current)
      setWsConnStatus('disconnected')
    }

    // ── Browser online event ──────────────────────────────────────────────
    const handleOnline = () => {
      if (!hadNetworkLoss) return   // shouldn't happen, but guard anyway
      setWsConnStatus('reconnected')
      clearTimeout(reconnectedTimerRef.current)
      reconnectedTimerRef.current = setTimeout(() => setWsConnStatus('connected'), 3000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)

    // ── Supplementary: Echo/pusher-js state_change ────────────────────────
    // Kept as a secondary source — useful in environments where pusher-js
    // detects reconnection independently (e.g., server restarts).
    const connection = window.Echo?.connector?.pusher?.connection
    const echoHandler = ({ previous, current }) => {
      if (previous === 'connected' && current !== 'connected') {
        // Network drop detected via pusher before browser event (rare)
        hadNetworkLoss = true
        clearTimeout(reconnectedTimerRef.current)
        setWsConnStatus('disconnected')
      } else if (current === 'connected' && hadNetworkLoss) {
        // Pusher reconnected — only show banner if browser online hasn't already
        setWsConnStatus('reconnected')
        clearTimeout(reconnectedTimerRef.current)
        reconnectedTimerRef.current = setTimeout(() => setWsConnStatus('connected'), 3000)
      }
    }
    connection?.bind('state_change', echoHandler)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
      connection?.unbind('state_change', echoHandler)
      clearTimeout(reconnectedTimerRef.current)
    }
  }, [])

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

  // ── Inline project-name editing ──────────────────────────────────
  const startEditName = useCallback(() => {
    if (!isOwner) return
    setEditNameValue(project?.name || '')
    setEditingName(true)
    // Focus the input on next tick after it renders
    setTimeout(() => nameInputRef.current?.select(), 0)
  }, [isOwner, project])

  const saveEditName = useCallback(async () => {
    const trimmed = editNameValue.trim()
    if (!trimmed || trimmed === project?.name) { setEditingName(false); return }
    setNameSaving(true)
    try {
      await api.put(`/projects/${projectId}`, { name: trimmed })
      setProject(prev => ({ ...prev, name: trimmed }))
    } catch { /* keep existing name on failure */ }
    finally { setNameSaving(false); setEditingName(false) }
  }, [editNameValue, project, projectId])

  const handleNameKeyDown = useCallback((e) => {
    if (e.key === 'Enter')  { e.preventDefault(); saveEditName() }
    if (e.key === 'Escape') { setEditingName(false) }
  }, [saveEditName])

  // ── Reverb presence channel ────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !user?.id) return

    const channel = joinProjectChannel(parseInt(projectId))
    channelRef.current = channel

    // Log subscription success/failure so we know if the channel is actually live
    channel
      .subscribed(() => console.log('[Collab] ✅ subscribed to presence-project.' + projectId))
      .error(err  => console.error('[Collab] ❌ channel subscription error:', err))

    // Presence: who is viewing this project right now
    channel
      .here(users => {
        console.log('[Collab] .here() —', users.length, 'member(s):', users.map(u => u.name))
        setActiveUsers(users)
      })
      .joining(u => {
        console.log('[Collab] .joining():', u.name)
        setActiveUsers(prev => [...prev.filter(p => p.id !== u.id), u])
      })
      .leaving(u => {
        console.log('[Collab] .leaving():', u.name)
        setActiveUsers(prev => prev.filter(p => p.id !== u.id))
        setRemoteCursors(prev => { const n = { ...prev }; delete n[u.id]; return n })
      })

    // Wire store broadcast → channel whisper.
    // Echo v2.x whisper() uses this.pusher.channels.channels[this.name].trigger().
    // Access the pusher-js channel directly to avoid any silent failure in that path.
    setBroadcastFn((event, data) => {
      const echoChannel = channelRef.current
      if (!echoChannel) {
        console.warn('[Collab] whisper("' + event + '") skipped — channelRef is null')
        return
      }
      console.log('[Collab] whisper →', event, data)
      try {
        // Direct pusher-js trigger — bypasses any Echo wrapper issues
        const pusherCh = window.Echo?.connector?.pusher?.channels?.channels?.[echoChannel.name]
        if (pusherCh) {
          pusherCh.trigger('client-' + event, data)
        } else {
          console.warn('[Collab] pusher channel not found for', echoChannel.name, '— falling back to Echo whisper')
          echoChannel.whisper(event, data)
        }
      } catch (err) {
        console.error('[Collab] whisper error:', err)
      }
    })

    // Helper: apply an incoming remote event without re-broadcasting or dirtying
    const applyRemote = (fn) => { setRemoteUpdate(true); fn(); setRemoteUpdate(false) }

    channel
      .listenForWhisper('SchemaNodeAdded', (payload) => {
        console.log('[Collab] ← SchemaNodeAdded', payload)
        const { node } = payload
        applyRemote(() => useSchemaStore.setState(s => ({
          nodes: s.nodes.some(n => n.id === node.id) ? s.nodes : [...s.nodes, node],
        })))
      })
      .listenForWhisper('SchemaNodeUpdated', (payload) => {
        console.log('[Collab] ← SchemaNodeUpdated', payload)
        const { nodeId, data } = payload
        applyRemote(() => useSchemaStore.getState().updateNodeData(nodeId, data))
      })
      .listenForWhisper('SchemaNodeMoved', (payload) => {
        console.log('[Collab] ← SchemaNodeMoved', payload)
        const { nodeId, position } = payload
        applyRemote(() => useSchemaStore.setState(s => ({
          nodes: s.nodes.map(n => n.id === nodeId ? { ...n, position } : n),
        })))
      })
      .listenForWhisper('SchemaNodeDeleted', (payload) => {
        console.log('[Collab] ← SchemaNodeDeleted', payload)
        const { nodeId } = payload
        applyRemote(() => useSchemaStore.setState(s => ({
          nodes: s.nodes.filter(n => n.id !== nodeId),
          edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        })))
      })
      .listenForWhisper('SchemaEdgeAdded', (payload) => {
        console.log('[Collab] ← SchemaEdgeAdded', payload)
        const { edge } = payload
        applyRemote(() => useSchemaStore.setState(s => ({
          edges: s.edges.some(e => e.id === edge.id) ? s.edges : [...s.edges, edge],
        })))
      })
      .listenForWhisper('SchemaEdgeDeleted', (payload) => {
        console.log('[Collab] ← SchemaEdgeDeleted', payload)
        const { edgeId } = payload
        applyRemote(() => useSchemaStore.setState(s => ({
          edges: s.edges.filter(e => e.id !== edgeId),
        })))
      })
      .listenForWhisper('SchemaEdgeUpdated', (payload) => {
        console.log('[Collab] ← SchemaEdgeUpdated', payload)
        const { edgeId, changes } = payload
        applyRemote(() => useSchemaStore.getState().updateEdge(edgeId, changes))
      })
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

  const handleFetchSuggestions = useCallback(async () => {
    if (nodes.length === 0) {
      setAiSuggestError('Add some tables first before requesting AI suggestions.')
      return
    }
    setAiSuggestLoading(true)
    setAiSuggestError('')
    try {
      const res = await api.post('/ai/suggest', {
        schema: { nodes, edges },
        project_id: projectId,
      })
      setAiSuggestions(res.data.suggestions || [])
      setIgnoredSuggestions(new Set())
    } catch (err) {
      setAiSuggestError(err.response?.data?.error || 'AI service unavailable. Try again.')
    } finally {
      setAiSuggestLoading(false)
    }
  }, [nodes, edges, projectId])

  const handleApplySuggestion = useCallback((suggestion) => {
    const { updateNodeData } = useSchemaStore.getState()
    const { action, nodeId } = suggestion
    if (!action) return

    if (action.type === 'add_index' && nodeId && action.columnName) {
      const node = useSchemaStore.getState().nodes.find(n => n.id === nodeId)
      if (node) {
        const newColumns = node.data.columns.map(col =>
          col.name?.toLowerCase() === action.columnName.toLowerCase()
            ? { ...col, index: true }
            : col
        )
        updateNodeData(nodeId, { columns: newColumns })
      }
    } else if (action.type === 'set_not_null' && nodeId && action.columnName) {
      const node = useSchemaStore.getState().nodes.find(n => n.id === nodeId)
      if (node) {
        const newColumns = node.data.columns.map(col =>
          col.name?.toLowerCase() === action.columnName.toLowerCase()
            ? { ...col, nullable: false }
            : col
        )
        updateNodeData(nodeId, { columns: newColumns })
      }
    } else if (action.type === 'add_timestamps' && nodeId) {
      const node = useSchemaStore.getState().nodes.find(n => n.id === nodeId)
      if (node) {
        const existingNames = new Set(node.data.columns.map(c => c.name?.toLowerCase()))
        const toAdd = []
        if (!existingNames.has('created_at')) {
          toAdd.push({ id: `col_${Date.now()}_ca`, name: 'created_at', type: 'TIMESTAMP', nullable: false, pk: false, unique: false, autoIncrement: false, default: 'CURRENT_TIMESTAMP', fk: false })
        }
        if (!existingNames.has('updated_at')) {
          toAdd.push({ id: `col_${Date.now()}_ua`, name: 'updated_at', type: 'TIMESTAMP', nullable: true, pk: false, unique: false, autoIncrement: false, default: null, fk: false })
        }
        if (toAdd.length > 0) {
          updateNodeData(nodeId, { columns: [...node.data.columns, ...toAdd] })
        }
      }
    } else if (action.type === 'rename_column' && nodeId && action.columnName && action.newName) {
      const node = useSchemaStore.getState().nodes.find(n => n.id === nodeId)
      if (node) {
        const newColumns = node.data.columns.map(col =>
          col.name?.toLowerCase() === action.columnName.toLowerCase()
            ? { ...col, name: action.newName }
            : col
        )
        updateNodeData(nodeId, { columns: newColumns })
      }
    }
    // Mark as ignored/applied so it disappears
    setIgnoredSuggestions(prev => new Set([...prev, suggestion.id]))
  }, [])

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
      const res = await api.post('/ai/generate', { prompt: aiPrompt.trim(), project_id: projectId })
      const schema = res.data
      if (!schema.nodes?.length) {
        setAiError('The AI returned an empty schema. Try a more specific description.')
        return
      }
      // Remember the DB generation id so we can mark it applied if the user accepts
      pendingGenerationId.current = schema.generation_id ?? null
      // If canvas already has tables, ask for confirmation before replacing
      if (nodes.length > 0) {
        pendingAiSchema.current = schema
        setShowAiModal(false)
        setShowAiConfirm(true)
      } else {
        aiGenerate(schema.nodes, schema.edges || [])
        if (pendingGenerationId.current) {
          api.patch(`/ai/generations/${pendingGenerationId.current}/apply`).catch(() => {})
          pendingGenerationId.current = null
        }
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
      // Mark the pending generation as applied (fire-and-forget)
      if (pendingGenerationId.current) {
        api.patch(`/ai/generations/${pendingGenerationId.current}/apply`).catch(() => {})
        pendingGenerationId.current = null
      }
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

  // Called by SaveVersionModal with an optional label string
  const handleSaveVersion = async (label = null) => {
    const state = useSchemaStore.getState()
    if (!state.schemaId) return
    setSaving(true)
    setSaveMsg('')
    try {
      await api.put(`/schemas/${state.schemaId}`, {
        schema_json: { nodes: state.nodes, edges: state.edges, meta: {} },
        label: label || null,
      })
      // Also clear the draft_json now that a proper version exists
      api.patch(`/schemas/${state.schemaId}/autosave`, {
        schema_json: { nodes: state.nodes, edges: state.edges, meta: {} },
      }).catch(() => {})
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
    // Clear draft_json so next load uses the restored version, not a stale draft
    if (schemaId) {
      api.patch(`/schemas/${schemaId}/autosave`, {
        schema_json: schemaJson || { nodes: [], edges: [] },
      }).catch(() => {})
    }
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

  // ── Copy SQL ──────────────────────────────────────────────────────────────
  // Re-uses the export endpoint but reads the response as plain text instead of
  // downloading it, then writes to the clipboard.
  const handleCopySql = async () => {
    const { schemaId } = useSchemaStore.getState()
    if (!schemaId) return
    setCopySqlState('copying')
    try {
      const response = await api.get(`/schemas/${schemaId}/export/sql`, { responseType: 'text' })
      await navigator.clipboard.writeText(response.data)
      setCopySqlState('copied')
      setTimeout(() => setCopySqlState('idle'), 2000)
    } catch {
      setCopySqlState('idle')
    }
  }

  // ── Add AI schema to canvas (iterative / merge mode) ─────────────────────
  const handleAddToCanvas = () => {
    if (pendingAiSchema.current) {
      aiMerge(pendingAiSchema.current.nodes, pendingAiSchema.current.edges || [])
      if (pendingGenerationId.current) {
        api.patch(`/ai/generations/${pendingGenerationId.current}/apply`).catch(() => {})
        pendingGenerationId.current = null
      }
      pendingAiSchema.current = null
      setAiPrompt('')
    }
    setShowAiConfirm(false)
  }

  // ── Roast my schema ───────────────────────────────────────────────────────
  const handleRoast = useCallback(async () => {
    if (nodes.length === 0) return
    setRoastLoading(true)
    setRoastError('')
    setRoastItems([])
    try {
      const res = await api.post('/ai/roast', { schema: { nodes, edges } })
      setRoastItems(res.data.roasts || [])
    } catch (err) {
      setRoastError(err.response?.data?.error || 'AI service unavailable. Please try again.')
    } finally {
      setRoastLoading(false)
      setShowRoastModal(true)
    }
  }, [nodes, edges])

  const handleVisionGenerate = async (imageDataUrl, prompt) => {
    setVisionLoading(true)
    setVisionError('')
    try {
      const res = await api.post('/ai/generate-from-image', { image: imageDataUrl, prompt, project_id: projectId })
      const schema = res.data
      if (!schema.nodes?.length) {
        setVisionError('No tables detected. Try a clearer image or add a description.')
        return
      }
      // Remember the DB generation id
      pendingGenerationId.current = schema.generation_id ?? null
      if (nodes.length > 0) {
        pendingAiSchema.current = schema
        setShowVisionAi(false)
        setShowAiConfirm(true)
      } else {
        aiGenerate(schema.nodes, schema.edges || [])
        if (pendingGenerationId.current) {
          api.patch(`/ai/generations/${pendingGenerationId.current}/apply`).catch(() => {})
          pendingGenerationId.current = null
        }
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

  // ── WS banner config ────────────────────────────────────────────────────────
  const wsBanner = wsConnStatus === 'reconnected' ? {
    bg: 'bg-emerald-500', text: 'text-white', icon: <Wifi className="w-3.5 h-3.5"/>,
    msg: 'Reconnected — you\'re back online',
  } : wsConnStatus === 'connecting' ? {
    bg: 'bg-amber-400', text: 'text-amber-900', icon: (
      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
    ),
    msg: 'Reconnecting…',
  } : ['disconnected', 'failed', 'unavailable'].includes(wsConnStatus) ? {
    bg: 'bg-red-500', text: 'text-white', icon: <WifiOff className="w-3.5 h-3.5"/>,
    msg: 'Connection lost — changes are saved locally. Reconnecting…',
  } : null
  // Keep last non-null banner alive so content doesn't vanish mid-fade-out
  if (wsBanner) lastBannerRef.current = wsBanner

  return (
  <CanvasThemeContext.Provider value={canvasDark}>
    <div
      data-canvas-theme={canvasDark ? 'dark' : 'light'}
      className="h-screen flex flex-col overflow-hidden relative transition-colors duration-200
                 bg-gray-50 dark:bg-[#0f1117]">

      {/* ── WebSocket reconnect banner — always in DOM, transitions height+opacity ── */}
      <div className={`overflow-hidden flex-shrink-0 transition-all duration-300 ease-in-out
                       ${wsBanner ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
        {lastBannerRef.current && (
          <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold
                           ${lastBannerRef.current.bg} ${lastBannerRef.current.text}`}>
            {lastBannerRef.current.icon}
            {lastBannerRef.current.msg}
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      {/* overflow-x-auto makes it scrollable on narrow mobile screens instead of wrapping/breaking */}
      <div className="flex-shrink-0 z-10 shadow-sm overflow-x-auto
                      transition-colors duration-200
                      bg-white dark:bg-[#141620]
                      border-b border-gray-200 dark:border-[#252a3e]">
      <div className="px-4 py-2.5 flex items-center justify-between min-w-max">

        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => {
              if (isDirty) { setShowLeaveModal(true); return }
              navigate('/dashboard')
            }}
            className="p-1 rounded-lg transition-colors
                       text-gray-400 dark:text-gray-500
                       hover:text-gray-700 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-[#252a3e]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-[#252a3e]"/>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
              </svg>
            </div>
            <div>
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  onBlur={saveEditName}
                  onKeyDown={handleNameKeyDown}
                  disabled={nameSaving}
                  maxLength={100}
                  className="font-semibold text-sm leading-tight text-gray-800 dark:text-gray-100
                             bg-white dark:bg-[#1e2235] border border-blue-400 rounded-lg
                             px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40
                             w-40 disabled:opacity-60"
                />
              ) : (
                <div className="flex items-center gap-1 group/name">
                  <p className="font-semibold text-sm leading-tight text-gray-800 dark:text-gray-100 truncate max-w-[160px]">
                    {project?.name || 'Loading...'}
                  </p>
                  {isOwner && project && (
                    <button
                      onClick={startEditName}
                      title="Rename project"
                      className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded
                                 text-gray-400 hover:text-blue-500 transition-all flex-shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs leading-tight text-gray-400 dark:text-gray-500">
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
          {/* Auto-save status micro-indicator */}
          {canEdit && autoSaveState !== 'idle' && (
            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition-all
              ${autoSaveState === 'saving'
                ? 'text-blue-500 bg-blue-50 border border-blue-200'
                : autoSaveState === 'saved'
                  ? 'text-green-600 bg-green-50 border border-green-200'
                  : 'text-red-500 bg-red-50 border border-red-200'}`}>
              {autoSaveState === 'saving' ? (
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              ) : autoSaveState === 'saved' ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              )}
              {autoSaveState === 'saving' ? 'Auto-saving…'
                : autoSaveState === 'saved' ? `Auto-saved${autoSavedAt ? ' · ' + autoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                : 'Auto-save failed'}
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

          {/* Undo / Redo */}
          {canEdit && (
            <div className="flex items-center rounded-lg overflow-hidden border border-gray-200 dark:border-[#252a3e]">
              <button onClick={handleUndo} disabled={past.length === 0} title="Undo (Ctrl+Z)"
                className={`p-1.5 transition-all
                  ${past.length === 0
                    ? 'text-gray-300 dark:text-gray-600 bg-white dark:bg-[#141620] cursor-not-allowed'
                    : 'text-gray-500 bg-white dark:bg-[#141620] hover:bg-gray-50 dark:hover:bg-[#252a3e] hover:text-blue-600'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-[#252a3e]"/>
              <button onClick={handleRedo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)"
                className={`p-1.5 transition-all
                  ${future.length === 0
                    ? 'text-gray-300 dark:text-gray-600 bg-white dark:bg-[#141620] cursor-not-allowed'
                    : 'text-gray-500 bg-white dark:bg-[#141620] hover:bg-gray-50 dark:hover:bg-[#252a3e] hover:text-blue-600'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"/>
                </svg>
              </button>
            </div>
          )}

          {/* Active collaborators avatar stack */}
          {activeUsers.filter(u => u.id !== user?.id).length > 0 && (
            <div className="flex items-center gap-1.5">
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

          {/* Save Version */}
          {canEdit && (
            <button
              onClick={() => setShowSaveModal(true)}
              disabled={saving}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all
                ${saveMsg === 'saved' ? 'bg-green-500 text-white'
                  : saveMsg === 'error' ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                  : saving ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}>
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
                <Save className="w-4 h-4"/>
              )}
              {saving ? 'Saving…' : saveMsg === 'saved' ? 'Saved!' : saveMsg === 'error' ? 'Retry Save' : 'Save Version'}
            </button>
          )}
        </div>
      </div>
      </div>{/* end overflow-x-auto toolbar wrapper */}

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
              onDropTable={canEdit ? handleDropTable : undefined}
            />
          </ReactFlowProvider>
        </div>

        {/* Right panel — fixed overlay on mobile, side panel on md+ */}
        {showRightPanel && (
          <div className="absolute inset-y-0 right-0 w-full sm:w-80 md:relative md:w-80 h-full flex-shrink-0 z-20 md:z-auto">
            {showHistory && (
              <HistoryPanel
                schemaId={useSchemaStore.getState().schemaId}
                onRestore={handleHistoryRestore}
                onClose={() => setShowHistory(false)}
                onFocusNode={handleFocusNode}
              />
            )}
            {!showHistory && showValidation && (
              <ValidationPanel
                issues={validationIssues}
                onClose={() => setShowValidation(false)}
                onFocusNode={handleFocusNode}
                suggestions={aiSuggestions.filter(s => !ignoredSuggestions.has(s.id))}
                suggestLoading={aiSuggestLoading}
                suggestError={aiSuggestError}
                onFetchSuggestions={handleFetchSuggestions}
                onApplySuggestion={handleApplySuggestion}
                onIgnoreSuggestion={(id) => setIgnoredSuggestions(prev => new Set([...prev, id]))}
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

      {/* ── Floating Action Pill ── */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20
                      flex items-center rounded-full border shadow-lg px-2 py-1.5 gap-0.5
                      transition-colors duration-200
                      bg-white dark:bg-[#141620]
                      border-gray-200 dark:border-[#252a3e]">

        {/* Add Table — click to place at auto-position, drag to place at exact drop position */}
        {canEdit && (
          <div className="relative group">
            <button
              onClick={() => addTable()}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'tableNode')
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors
                         cursor-grab active:cursor-grabbing
                         text-gray-500 dark:text-gray-400
                         hover:text-blue-600 dark:hover:text-blue-400
                         hover:bg-blue-50 dark:hover:bg-blue-950">
              <Plus className="w-4 h-4"/>
            </button>
            <PillTooltip>Add Table · drag to place</PillTooltip>
          </div>
        )}

        {/* Generate (AI) */}
        {canEdit && (
          <div className="relative group" ref={generateMenuRef}>
            <button
              onClick={() => setShowGenerateMenu(v => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors
                         text-gray-500 dark:text-gray-400
                         hover:text-purple-600 dark:hover:text-purple-400
                         hover:bg-purple-50 dark:hover:bg-purple-950">
              <Sparkles className="w-4 h-4"/>
            </button>
            <PillTooltip>Generate</PillTooltip>
            {showGenerateMenu && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-10 w-44
                              rounded-xl shadow-xl z-30 py-1 overflow-hidden
                              bg-white dark:bg-[#1c1f2e]
                              border border-gray-200 dark:border-[#252a3e]">
                <button
                  onClick={() => { setShowGenerateMenu(false); setShowAiModal(true) }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2
                             text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-[#252a3e]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500"/>
                  From description
                </button>
                <button
                  onClick={() => { setShowGenerateMenu(false); setShowVisionAi(true) }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2
                             text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-[#252a3e]">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500"/>
                  From image
                </button>
              </div>
            )}
          </div>
        )}

        {/* Import SQL */}
        {canEdit && (
          <div className="relative group">
            <button
              onClick={() => setShowImportSql(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors
                         text-gray-500 dark:text-gray-400
                         hover:text-orange-600 dark:hover:text-orange-400
                         hover:bg-orange-50 dark:hover:bg-orange-950">
              <Upload className="w-4 h-4"/>
            </button>
            <PillTooltip>Import SQL</PillTooltip>
          </div>
        )}

        {/* Divider — only shown when canEdit */}
        {canEdit && <div className="w-px h-5 mx-0.5 bg-gray-200 dark:bg-[#252a3e]"/>}

        {/* Validate */}
        <div className="relative group">
          <button
            onClick={() => { setShowValidation(v => !v); setShowHistory(false); setSelectedNode(null); setSelectedEdge(null) }}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors
              ${showValidation
                ? 'text-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950'}`}>
            <CheckCircle className="w-4 h-4"/>
            {(errorCount > 0 || warningCount > 0) && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center
                                text-[9px] font-bold text-white rounded-full px-0.5
                                ${errorCount > 0 ? 'bg-red-500' : 'bg-amber-400'}`}>
                {errorCount > 0 ? errorCount : warningCount}
              </span>
            )}
          </button>
          <PillTooltip>Validate</PillTooltip>
        </div>

        {/* Templates */}
        {canEdit && (
          <div className="relative group">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-colors
                         text-gray-500 dark:text-gray-400
                         hover:text-teal-600 dark:hover:text-teal-400
                         hover:bg-teal-50 dark:hover:bg-teal-950">
              <LayoutTemplate className="w-4 h-4"/>
            </button>
            <PillTooltip>Templates</PillTooltip>
          </div>
        )}

        {/* Export SQL */}
        <div className="relative group" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(v => !v)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
              ${showMoreMenu
                ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950'
                : 'text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950'}`}>
            <Download className="w-4 h-4"/>
          </button>
          <PillTooltip>Export SQL</PillTooltip>
          {showMoreMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-10 w-36
                            rounded-xl shadow-xl z-30 py-1 overflow-hidden
                            bg-white dark:bg-[#1c1f2e]
                            border border-gray-200 dark:border-[#252a3e]">
              {['mysql','postgresql','sqlite'].map(d => (
                <button
                  key={d}
                  onClick={() => { setShowMoreMenu(false); handleExportSQL(d) }}
                  className="w-full text-left px-3 py-2 text-sm capitalize
                             text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-[#252a3e]">
                  {d === 'mysql' ? 'MySQL' : d === 'postgresql' ? 'PostgreSQL' : 'SQLite'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Models (ORM) */}
        <div className="relative group">
          <button
            onClick={() => setShowOrmModal(true)}
            disabled={nodes.length === 0}
            title="Export ORM model classes"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
              ${nodes.length === 0
                ? 'opacity-25 cursor-not-allowed text-gray-400 dark:text-gray-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950'}`}>
            <Code2 className="w-4 h-4"/>
          </button>
          <PillTooltip>Export Models</PillTooltip>
        </div>

        {/* Copy SQL */}
        <div className="relative group">
          <button
            onClick={handleCopySql}
            disabled={copySqlState === 'copying'}
            title="Copy SQL to clipboard"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
              ${copySqlState === 'copied'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950'
                : copySqlState === 'copying'
                  ? 'text-gray-300 dark:text-gray-600 bg-white dark:bg-[#141620] cursor-wait'
                  : 'text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950'}`}>
            {copySqlState === 'copied' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
            ) : copySqlState === 'copying' ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <Copy className="w-4 h-4"/>
            )}
          </button>
          <PillTooltip>{copySqlState === 'copied' ? 'Copied!' : 'Copy SQL'}</PillTooltip>
        </div>

        {/* Version History */}
        <div className="relative group">
          <button
            onClick={() => { setShowHistory(v => !v); setShowValidation(false); setSelectedNode(null); setSelectedEdge(null) }}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
              ${showHistory
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950'
                : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950'}`}>
            <History className="w-4 h-4"/>
          </button>
          <PillTooltip>Version History</PillTooltip>
        </div>

        {/* Export PNG */}
        <div className="relative group">
          <button
            onClick={handleExportImage}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors
                       text-gray-500 dark:text-gray-400
                       hover:text-pink-600 dark:hover:text-pink-400
                       hover:bg-pink-50 dark:hover:bg-pink-950">
            <ImageIcon className="w-4 h-4"/>
          </button>
          <PillTooltip>Export PNG</PillTooltip>
        </div>

        {/* Roast 🔥 */}
        <div className="relative group">
          <button
            onClick={handleRoast}
            disabled={roastLoading || nodes.length === 0}
            title="Roast my schema"
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors
              ${roastLoading
                ? 'opacity-50 cursor-wait'
                : nodes.length === 0
                  ? 'opacity-25 cursor-not-allowed text-gray-400 dark:text-gray-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950'}`}>
            {roastLoading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            ) : (
              <Flame className="w-4 h-4"/>
            )}
          </button>
          <PillTooltip>Roast my schema</PillTooltip>
        </div>

        {/* Divider before theme toggle */}
        <div className="w-px h-5 mx-0.5 bg-gray-200 dark:bg-[#252a3e]"/>

        {/* Dark Mode Toggle */}
        <div className="relative group">
          <button
            onClick={toggleCanvasTheme}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors
                       text-gray-500 dark:text-gray-400
                       hover:text-amber-500 dark:hover:text-amber-400
                       hover:bg-amber-50 dark:hover:bg-amber-950">
            {canvasDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
          </button>
          <PillTooltip>{canvasDark ? 'Light Mode' : 'Dark Mode'}</PillTooltip>
        </div>

      </div>

      {/* Help tip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <p className="text-xs backdrop-blur px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap
                      transition-colors duration-200
                      text-gray-400 dark:text-gray-600
                      bg-white/90 dark:bg-[#141620]/90
                      border border-gray-200 dark:border-[#252a3e]">
          Click table to edit · Click relationship to change · Drag handle to connect · Del to remove · Ctrl+Z to undo
        </p>
      </div>

      {/* Undo / Redo toast */}
      {undoToast && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
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
        variant="info"
        title="Leave without a saved version?"
        message="Your work is auto-saved and safe — you won't lose any data. However, you haven't created a named version yet, so you won't be able to compare or restore this exact state from Version History later."
        confirmText="Leave anyway"
        cancelText="Stay here"
        onConfirm={() => navigate('/dashboard')}
        onCancel={() => setShowLeaveModal(false)}
      />

      <AiConfirmModal
        open={showAiConfirm}
        onReplace={confirmAiReplace}
        onAddToCanvas={handleAddToCanvas}
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
          onProjectUpdate={(updates) => setProject(prev => ({ ...prev, ...updates }))}
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

      {/* ── Roast Modal ── */}
      {showRoastModal && (
        <RoastModal
          items={roastItems}
          error={roastError}
          onClose={() => { setShowRoastModal(false); setRoastItems([]); setRoastError('') }}
        />
      )}

      {/* ── ORM Export Modal ── */}
      {showOrmModal && (
        <OrmExportModal onClose={() => setShowOrmModal(false)} />
      )}

      {/* ── Save Version Modal ── */}
      {showSaveModal && (
        <SaveVersionModal
          saving={saving}
          saveMsg={saveMsg}
          onSave={(label) => { setShowSaveModal(false); handleSaveVersion(label) }}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  </CanvasThemeContext.Provider>
  )
}

// ── AI Confirm Modal — Replace / Add to canvas / Cancel ──────────
function AiConfirmModal({ open, onReplace, onAddToCanvas, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">

        {/* Icon + heading */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">Apply AI schema?</h3>
            <p className="text-xs text-gray-400 mt-0.5">Your canvas already has tables</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          Choose how to apply the generated schema — you can keep what you have or start fresh.
        </p>

        {/* Options */}
        <div className="flex flex-col gap-2.5 mb-5">

          {/* Add to canvas */}
          <button
            onClick={onAddToCanvas}
            className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50
                       hover:bg-emerald-100 hover:border-emerald-300 transition-all text-left group">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 group-hover:bg-emerald-200
                            flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4v16m8-8H4"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-700">Add to canvas</div>
              <div className="text-xs text-emerald-500 mt-0.5">New tables placed beside existing ones — nothing removed</div>
            </div>
          </button>

          {/* Replace */}
          <button
            onClick={onReplace}
            className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-amber-200 bg-amber-50
                       hover:bg-amber-100 hover:border-amber-300 transition-all text-left group">
            <div className="w-8 h-8 rounded-lg bg-amber-100 group-hover:bg-amber-200
                            flex items-center justify-center flex-shrink-0 transition-colors">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-700">Replace everything</div>
              <div className="text-xs text-amber-500 mt-0.5">Current tables and relationships will be removed</div>
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-700 transition-colors py-1">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Roast Modal ───────────────────────────────────────────────────
const ROAST_SEVERITY = {
  critical: {
    bg:     'bg-red-50',
    border: 'border-red-200',
    badge:  'bg-red-100 text-red-700',
    dot:    'bg-red-500',
    label:  'Critical',
  },
  bad: {
    bg:     'bg-orange-50',
    border: 'border-orange-200',
    badge:  'bg-orange-100 text-orange-700',
    dot:    'bg-orange-400',
    label:  'Bad',
  },
  meh: {
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    badge:  'bg-amber-100 text-amber-700',
    dot:    'bg-amber-400',
    label:  'Meh',
  },
}

function RoastModal({ items, error, onClose }) {
  const criticalCount = items.filter(r => r.severity === 'critical').length
  const badCount      = items.filter(r => r.severity === 'bad').length
  const mehCount      = items.filter(r => r.severity === 'meh').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100
                        bg-gradient-to-r from-orange-50 to-red-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Flame className="w-7 h-7 text-orange-500 flex-shrink-0"/>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">Schema Roast</h2>
              <p className="text-xs text-gray-400 mt-0.5">Brutally honest feedback from your AI DBA</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* All-clear state */}
          {!error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-5xl mb-4">🏆</div>
              <p className="font-bold text-gray-900 text-lg mb-1">Your schema is clean.</p>
              <p className="text-sm text-gray-400">Even the AI couldn't find anything to roast. Nicely done.</p>
            </div>
          )}

          {/* Summary badges */}
          {!error && items.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pb-1">
              {criticalCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
                  {criticalCount} critical
                </span>
              )}
              {badCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"/>
                  {badCount} bad
                </span>
              )}
              {mehCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                  {mehCount} meh
                </span>
              )}
            </div>
          )}

          {/* Roast cards */}
          {!error && items.map((roast) => {
            const sev = ROAST_SEVERITY[roast.severity] ?? ROAST_SEVERITY.meh
            return (
              <div
                key={roast.id}
                className={`rounded-xl border p-4 ${sev.bg} ${sev.border}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 leading-snug">{roast.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${sev.badge}`}>
                        {sev.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{roast.description}</p>
                    {roast.table && (
                      <code className="mt-1.5 inline-block text-[11px] bg-white/70 border border-gray-200
                                       text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        {roast.table}
                      </code>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400 italic">AI feedback — always verify before acting.</p>
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700
                       rounded-xl transition-colors shadow-sm">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pill tooltip (shared by all floating pill icon buttons) ───────
function PillTooltip({ children }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      <div className="bg-gray-800 text-white text-[11px] font-medium px-2 py-1
                      rounded-lg whitespace-nowrap shadow-lg">
        {children}
      </div>
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
const IMPACT_COLOR = {
  high:   { bg: 'bg-rose-50 dark:bg-rose-950/40',   border: 'border-rose-200 dark:border-rose-800',   text: 'text-rose-700 dark:text-rose-300',   badge: 'bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300' },
  low:    { bg: 'bg-blue-50 dark:bg-blue-950/40',   border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-700 dark:text-blue-300',   badge: 'bg-blue-100 dark:bg-blue-900 text-blue-500 dark:text-blue-300' },
}

const CATEGORY_ICON = {
  index:        { emoji: '⚡', label: 'Index' },
  nullability:  { emoji: '🔒', label: 'Nullable' },
  timestamps:   { emoji: '🕐', label: 'Timestamps' },
  relationship: { emoji: '🔗', label: 'Relation' },
  naming:       { emoji: '✏️', label: 'Naming' },
  junction:     { emoji: '🔀', label: 'Junction' },
}

function ValidationPanel({
  issues, onClose, onFocusNode,
  suggestions, suggestLoading, suggestError,
  onFetchSuggestions, onApplySuggestion, onIgnoreSuggestion,
}) {
  const [tab, setTab] = useState('issues')
  const errors   = issues.filter(i => i.type === 'error')
  const warnings = issues.filter(i => i.type === 'warning')

  return (
    <div className="w-80 flex flex-col h-full shadow-lg
                    bg-white dark:bg-[#141620]
                    border-l border-gray-200 dark:border-[#252a3e]
                    transition-colors duration-200">

      {/* Header */}
      <div className="px-4 pt-3 pb-0 border-b
                      bg-gray-50 dark:bg-[#0f1117]
                      border-gray-100 dark:border-[#252a3e]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500"/>
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100">Schema Analysis</h3>
          </div>
          <button onClick={onClose}
            className="p-1 rounded transition-colors
                       text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-[#252a3e]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setTab('issues')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2
              ${tab === 'issues'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-[#141620]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Issues
            {issues.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${errors.length > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
                {issues.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2
              ${tab === 'ai'
                ? 'border-violet-500 text-violet-600 dark:text-violet-400 bg-white dark:bg-[#141620]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            AI Suggestions
            {suggestions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500 text-white">
                {suggestions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Issues tab ── */}
      {tab === 'issues' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {issues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4
                              bg-green-100 dark:bg-green-950">
                <svg className="w-7 h-7 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p className="font-semibold mb-1 text-gray-800 dark:text-gray-100">Schema looks good!</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">No errors or warnings found.</p>
            </div>
          )}

          {issues.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {errors.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full
                                 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
                  {errors.length} error{errors.length !== 1 ? 's' : ''}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full
                                 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                  {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <IssueGroup title="Errors" color="red" issues={errors} onFocusNode={onFocusNode}/>
          )}
          {warnings.length > 0 && (
            <IssueGroup title="Warnings" color="amber" issues={warnings} onFocusNode={onFocusNode}/>
          )}
        </div>
      )}

      {/* ── AI Suggestions tab ── */}
      {tab === 'ai' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* Fetch button */}
          <button
            onClick={onFetchSuggestions}
            disabled={suggestLoading}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl
                        text-xs font-semibold transition-all border
                        ${suggestLoading
                          ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 text-violet-400 cursor-wait'
                          : 'bg-gradient-to-r from-violet-600 to-purple-600 border-transparent text-white hover:from-violet-700 hover:to-purple-700 shadow-sm'}`}
          >
            {suggestLoading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Analysing schema…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                {suggestions.length > 0 ? 'Re-analyse Schema' : 'Analyse with AI'}
              </>
            )}
          </button>

          {/* Error */}
          {suggestError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <p className="text-xs text-red-700 dark:text-red-300 leading-snug">{suggestError}</p>
            </div>
          )}

          {/* Empty state — never fetched */}
          {!suggestLoading && !suggestError && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3
                              bg-violet-100 dark:bg-violet-950">
                <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <p className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-100">AI-Powered Suggestions</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed max-w-[200px]">
                Click "Analyse with AI" to get smart recommendations for indexes, timestamps, naming, and more.
              </p>
            </div>
          )}

          {/* Suggestion cards */}
          {suggestions.map((s) => {
            const impact  = IMPACT_COLOR[s.impact] || IMPACT_COLOR.low
            const catMeta = CATEGORY_ICON[s.category] || { emoji: '💡', label: s.category }
            const canAutoApply = ['add_index','set_not_null','add_timestamps','rename_column'].includes(s.action?.type)

            return (
              <div key={s.id}
                className={`rounded-xl border p-3 space-y-2 ${impact.bg} ${impact.border}`}
              >
                {/* Top row: category badge + impact */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${impact.badge}`}>
                    {catMeta.emoji} {catMeta.label}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${impact.text} opacity-70`}>
                    {s.impact} impact
                  </span>
                </div>

                {/* Title */}
                <p className={`text-xs font-semibold leading-snug ${impact.text}`}>{s.title}</p>

                {/* Description */}
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{s.description}</p>

                {/* Table badge */}
                {s.tableName && (
                  <code className="text-[10px] font-mono px-1.5 py-0.5 rounded
                                   bg-white/60 dark:bg-black/30 text-gray-600 dark:text-gray-300 border
                                   border-gray-200 dark:border-gray-700">
                    {s.tableName}
                  </code>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 pt-0.5">
                  {canAutoApply && (
                    <button
                      onClick={() => onApplySuggestion(s)}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                                 bg-white dark:bg-black/30 border border-green-300 dark:border-green-700
                                 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40
                                 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      Apply
                    </button>
                  )}
                  <button
                    onClick={() => onIgnoreSuggestion(s.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                               bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-700
                               text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800
                               transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IssueGroup({ title, color, issues, onFocusNode }) {
  const isRed = color === 'red'
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2
        ${isRed ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
        {title}
      </p>
      <div className="space-y-2">
        {issues.map((issue, i) => (
          <div key={i}
            className={`rounded-xl border p-3 flex items-start gap-3
              ${isRed
                ? 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900'}`}
          >
            <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5
              ${isRed ? 'bg-red-100 dark:bg-red-900' : 'bg-amber-100 dark:bg-amber-900'}`}>
              <svg className={`w-3.5 h-3.5 ${isRed ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold font-mono mb-0.5 truncate
                            text-gray-500 dark:text-gray-400">
                {issue.tableName}
              </p>
              <p className={`text-xs leading-snug
                ${isRed ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {issue.message}
              </p>
            </div>
            <button
              onClick={() => onFocusNode(issue.nodeId)}
              title="Open table editor"
              className={`flex-shrink-0 p-1 rounded-lg transition-colors
                ${isRed
                  ? 'text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900'
                  : 'text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900'}`}
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
function ShareModal({ projectId, project, onProjectUpdate, onClose }) {
  const [tab,           setTab]           = useState('friends')  // 'friends' | 'email' | 'link'
  const [collaborators, setCollaborators] = useState([])
  const [collabLoading, setCollabLoading] = useState(true)
  const [friends,       setFriends]       = useState([])
  const [friendsLoading,setFriendsLoading]= useState(true)
  const [inviteRole,    setInviteRole]    = useState('editor')
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviting,      setInviting]      = useState(false)  // false | userId | 'email'
  const [inviteError,   setInviteError]   = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [linkCopied,    setLinkCopied]    = useState(false)
  const [visibility,    setVisibility]    = useState(project?.visibility || 'private')
  const [visUpdating,   setVisUpdating]   = useState(false)

  const shareUrl = `${window.location.origin}/s/${projectId}`

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const handleVisibilityToggle = async () => {
    const newVis = visibility === 'public' ? 'private' : 'public'
    setVisUpdating(true)
    try {
      await api.put(`/projects/${projectId}`, { visibility: newVis })
      setVisibility(newVis)
      // Sync back to parent so reopening the modal reads the correct visibility
      if (onProjectUpdate) onProjectUpdate({ visibility: newVis })
    } catch { /* keep current on error */ }
    finally { setVisUpdating(false) }
  }

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

  // Approve / decline a visitor's access request directly from the collaborators panel
  const handleApproveAccess = async (userId) => {
    try {
      await api.post(`/projects/${projectId}/access-requests/${userId}/approve`)
      setCollaborators(prev => prev.map(c => c.id === userId ? { ...c, status: 'accepted', source: 'invitation' } : c))
    } catch {}
  }
  const handleDeclineAccess = async (userId) => {
    try {
      await api.post(`/projects/${projectId}/access-requests/${userId}/decline`)
      setCollaborators(prev => prev.filter(c => c.id !== userId))
    } catch {}
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
          <button onClick={() => setTab('link')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
              ${tab === 'link'
                ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/50'
                : 'text-gray-400 hover:text-gray-600'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m-3.928-3.928a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1"/>
            </svg>
            Public Link
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Role selector — only relevant for friend/email invite tabs, not the public link tab */}
            {tab !== 'link' && (
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
            )}

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

                {/* Pending access requests — shown to owner so they can approve/decline */}
                {!collabLoading && collaborators.filter(c => c.status === 'pending' && c.source === 'request').length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide px-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block"/>
                      Pending access requests
                    </p>
                    {collaborators
                      .filter(c => c.status === 'pending' && c.source === 'request')
                      .map(c => (
                        <div key={c.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-violet-100 bg-violet-50">
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center
                                          font-bold text-white text-sm overflow-hidden
                                          ${c.avatar_url ? '' : 'bg-violet-500'}`}>
                            {c.avatar_url
                              ? <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover"/>
                              : (c.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleApproveAccess(c.id)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
                                         bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                              Accept
                            </button>
                            <button
                              onClick={() => handleDeclineAccess(c.id)}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg
                                         bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    <div className="border-t border-gray-100 pt-1 mt-1"/>
                  </div>
                )}

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

            {/* ── Public Link Tab ── */}
            {tab === 'link' && (
              <div className="space-y-4">
                {/* Visibility toggle */}
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Project visibility</p>
                    <p className="text-[11px] text-gray-400">
                      {visibility === 'public'
                        ? 'Anyone with the link can view this schema'
                        : 'Only you and collaborators can view'}
                    </p>
                  </div>
                  <button
                    onClick={handleVisibilityToggle}
                    disabled={visUpdating}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                      ${visUpdating ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                      ${visibility === 'public' ? 'bg-violet-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow
                                      transition-transform ${visibility === 'public' ? 'translate-x-[18px]' : 'translate-x-0.5'}`}/>
                  </button>
                </div>

                {/* Shareable link section */}
                {visibility === 'public' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
                      Shareable link
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600
                                   bg-gray-50 font-mono overflow-hidden text-ellipsis focus:outline-none"
                      />
                      <button
                        onClick={copyShareLink}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                                    whitespace-nowrap transition-all flex-shrink-0
                          ${linkCopied
                            ? 'bg-green-500 text-white'
                            : 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm'}`}>
                        {linkCopied ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                            Copy link
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Anyone can view this schema without logging in. They can sign in to fork and edit their own copy.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-5 text-center">
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <p className="text-sm font-medium text-gray-500">Project is private</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Toggle the switch above to make this project public and generate a shareable link.
                    </p>
                  </div>
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
// SCHEMA_TEMPLATES imported from ../data/schemaTemplates

// ── Templates Modal ───────────────────────────────────────────────
function TemplatesModal({ onUseTemplate, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = SCHEMA_TEMPLATES.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl animate-modal
                      flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">
              Schema Templates
              <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                {SCHEMA_TEMPLATES.length}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Start from a pre-built schema and customize it</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg w-44
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-300"
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-400 text-sm">No templates match "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map(t => (
                <div key={t.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md
                             transition-all flex flex-col">
                  <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center mb-3 flex-shrink-0`}>
                    {t.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-snug">{t.name}</h3>
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
          )}
        </div>
      </div>
    </div>
  )
}

// ── Save Version Modal ─────────────────────────────────────────────
// Lets the user optionally name a snapshot before committing it to version history.
function SaveVersionModal({ saving, saveMsg, onSave, onClose }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && !saving) { e.preventDefault(); onSave(label.trim() || null) }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [label, saving, onClose, onSave])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Save Version</h2>
              <p className="text-xs text-gray-500">Create a named snapshot in version history</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">
            Version label <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            autoFocus
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Add orders table, v2 schema…"
            maxLength={100}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder:text-gray-300"
          />
          <p className="text-[11px] text-gray-400 mt-2">
            Leave blank to save without a label. All saves appear in Version History.
          </p>

          {saveMsg === 'error' && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-red-700">Save failed. Please try again.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200
                       hover:border-gray-300 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(label.trim() || null)}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all
              ${saving
                ? 'bg-blue-400 text-white cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}>
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                </svg>
                Save Version
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
