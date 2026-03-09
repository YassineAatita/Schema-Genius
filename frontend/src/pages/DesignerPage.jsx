import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import SchemaCanvas from '../components/canvas/SchemaCanvas'
import TableEditor from '../components/panels/TableEditor'
import RelationshipEditor from '../components/panels/RelationshipEditor'
import useSchemaStore from '../store/useSchemaStore'
import api from '../services/api'

export default function DesignerPage() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const { loadSchema, addTable, nodes, edges, isDirty, markSaved } = useSchemaStore()

  const [project,      setProject]      = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState('')

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
  }

  const handleEdgeClick = (edge) => {
    setSelectedNode(null)
    setSelectedEdge(edge)
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

  // Right panel — shows table editor OR relationship editor
  const showRightPanel = selectedNode || selectedEdge

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center
                      justify-between flex-shrink-0 z-10 shadow-sm">

        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
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
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"/>
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
            {selectedNode && (
              <TableEditor
                nodeId={selectedNode.id}
                onClose={() => setSelectedNode(null)}
              />
            )}
            {selectedEdge && (
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
    </div>
  )
}