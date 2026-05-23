import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import useSchemaStore from '../store/useSchemaStore'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'
import SchemaCanvas from '../components/canvas/SchemaCanvas'
import { CanvasThemeContext } from '../contexts/CanvasThemeContext'

// Match the same pattern as api.js: VITE_API_URL holds the base without /api suffix.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

export default function SharedSchemaPage() {
  const { projectId } = useParams()
  const { loadSchema } = useSchemaStore()
  const { isAuthenticated, user } = useAuthStore()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(false)

  // 'loading' | 'owner' | 'has_access' | 'pending' | 'none'
  const [accessStatus,   setAccessStatus]   = useState('loading')
  const [requestSending, setRequestSending] = useState(false)
  const [requestDone,    setRequestDone]    = useState(false)

  // 1 — Load the public schema (no auth needed)
  useEffect(() => {
    fetch(`${API_BASE}/schemas/shared/${projectId}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'private' : 'notfound')
        return res.json()
      })
      .then(data => {
        setProject(data.project)
        loadSchema(null, null, data.schema_json || { nodes: [], edges: [] })
      })
      .catch(err => {
        setError(err.message === 'private'
          ? 'This project is private and cannot be shared publicly.'
          : 'This project does not exist or the link is invalid.')
      })
      .finally(() => setLoading(false))
  }, [projectId])  // eslint-disable-line react-hooks/exhaustive-deps

  // 2 — Check current user's access status (only when logged in)
  useEffect(() => {
    if (!isAuthenticated) { setAccessStatus('none'); return }
    setAccessStatus('loading')
    api.get(`/projects/${projectId}/my-access`)
      .then(res => setAccessStatus(res.data.status === 'accepted' ? 'has_access' : res.data.status))
      .catch(() => setAccessStatus('none'))
  }, [isAuthenticated, projectId])

  const handleRequestAccess = async () => {
    setRequestSending(true)
    try {
      await api.post(`/projects/${projectId}/request-access`)
      setRequestDone(true)
      setAccessStatus('pending')
    } catch (err) {
      // 422 means already has access — show "has access" state
      if (err.response?.status === 422) {
        setAccessStatus(err.response.data.status === 'accepted' ? 'has_access' : 'pending')
      }
    } finally {
      setRequestSending(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#f7f5f1]">
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin w-8 h-8 text-[#c96b3a]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p className="text-sm text-[#8c7b6e] font-medium">Loading schema…</p>
      </div>
    </div>
  )

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) return (
    <div className="h-screen flex items-center justify-center bg-[#f7f5f1] p-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold text-[#161413] mb-2">Schema not available</h1>
        <p className="text-sm text-[#8c7b6e] mb-6">{error}</p>
        <Link to="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c96b3a] hover:bg-[#e8724a]
                     text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          Sign in to Schema Genius
        </Link>
      </div>
    </div>
  )

  // ── CTA button — varies by auth + access state ────────────────────────────
  const renderCta = () => {
    // Not logged in → prompt to sign in (link back to THIS shared page after login)
    if (!isAuthenticated) {
      return (
        <Link
          to={`/login?next=/s/${projectId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8724a] hover:bg-[#c96b3a]
                     text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
          </svg>
          Sign in to fork &amp; edit
        </Link>
      )
    }

    // Owner or accepted collaborator → open designer
    if (accessStatus === 'owner' || accessStatus === 'has_access') {
      return (
        <Link
          to={`/projects/${projectId}/designer`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8724a] hover:bg-[#c96b3a]
                     text-white rounded-lg text-xs font-semibold transition-colors shadow-sm">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          You have access · Open Designer
        </Link>
      )
    }

    // Request already sent / pending
    if (accessStatus === 'pending' || requestDone) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-lg
                         text-xs font-medium text-white/90 border border-white/30">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          Request sent — owner notified
        </span>
      )
    }

    // Logged in, not a collaborator yet → request access
    if (accessStatus === 'none') {
      return (
        <button
          onClick={handleRequestAccess}
          disabled={requestSending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8724a] hover:bg-[#c96b3a]
                     text-white rounded-lg text-xs font-semibold transition-colors shadow-sm
                     disabled:opacity-60 disabled:cursor-wait">
          {requestSending ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Sending…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
              </svg>
              Request Editor Access
            </>
          )}
        </button>
      )
    }

    // Still resolving access status
    return null
  }

  // ── Schema view ───────────────────────────────────────────────────────────
  return (
    <CanvasThemeContext.Provider value={false}>
      <div className="h-screen flex flex-col overflow-hidden bg-gray-50">

        {/* ── CTA Banner ── */}
        <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md"
             style={{ backgroundColor: '#1a1410' }}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo mark */}
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ backgroundColor: 'rgba(245,225,200,.12)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                   style={{ color: '#e8c9a0' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
              </svg>
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-sm truncate block" style={{ color: '#f5e1c8' }}>
                {project?.name}
              </span>
              <span className="text-xs" style={{ color: '#c4a882' }}>
                by {project?.owner} · read-only view
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {/* Back to dashboard — only shown to logged-in users */}
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: 'rgba(245,225,200,.10)', color: '#e8c9a0' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(245,225,200,.18)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(245,225,200,.10)'}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
                Dashboard
              </Link>
            )}
            {/* Copy link */}
            <button
              onClick={copyLink}
              title="Copy shareable link"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
              style={{ backgroundColor: 'transparent', color: '#e8c9a0', borderColor: 'rgba(245,225,200,.25)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(245,225,200,.10)'; e.currentTarget.style.borderColor = 'rgba(245,225,200,.4)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(245,225,200,.25)' }}>
              {copied ? (
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

            {/* Auth / access CTA */}
            {renderCta()}
          </div>
        </div>

        {/* ── Canvas (read-only) ── */}
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <SchemaCanvas
              readOnly
              onNodeClick={() => {}}
              onEdgeClick={() => {}}
            />
          </ReactFlowProvider>
        </div>

      </div>
    </CanvasThemeContext.Provider>
  )
}
