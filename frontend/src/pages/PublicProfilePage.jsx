import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../services/api'
import useAuthStore from '../store/useAuthStore'
import useProjectStore from '../store/useProjectStore'

// ── Helpers ───────────────────────────────────────────────────────────────────
const PALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316']

function timeAgo(date) {
  if (!date) return ''
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60)     return `${s}s ago`
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function nameColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0 }
  return PALETTE[Math.abs(h) % PALETTE.length]
}

const USER_TYPE_LABELS = {
  student:   'Student',
  developer: 'Developer',
  designer:  'Designer',
  fullstack: 'Full-Stack',
  other:     'Other',
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const StarIcon = ({ filled }) => (
  <svg className="w-3.5 h-3.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
  </svg>
)
const HeartIcon = ({ filled }) => (
  <svg className="w-3.5 h-3.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
  </svg>
)
const GitForkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="6"  cy="6"  r="2" strokeWidth={2}/>
    <circle cx="18" cy="6"  r="2" strokeWidth={2}/>
    <circle cx="12" cy="18" r="2" strokeWidth={2}/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v1a6 6 0 006 6m0 0a6 6 0 006-6V8M12 15v3"/>
  </svg>
)
const Spinner = ({ cls = '' }) => (
  <span className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin
                    ${cls || 'w-3.5 h-3.5'}`}/>
)

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((msg, type = 'info', ms = 3000) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), ms)
  }, [])
  return { toast, show }
}
function Toast({ toast }) {
  if (!toast) return null
  const colors = {
    info:    'bg-gray-900 text-white',
    error:   'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
    success: 'bg-emerald-600 text-white',
  }
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg
                     text-sm font-medium flex items-center gap-2 ${colors[toast.type] || colors.info}`}>
      {toast.type === 'error'   && <span>✕</span>}
      {toast.type === 'warning' && <span>⚠</span>}
      {toast.type === 'success' && <span>✓</span>}
      {toast.msg}
    </div>
  )
}

// ── Schema thumbnail ──────────────────────────────────────────────────────────
function SchemaThumbnail({ thumbnailNodes = [], tableCount = 0, edgeCount = 0, projectId = 0, width = 168, height = 96 }) {
  const W = width, H = height
  const pad = 10

  if (thumbnailNodes && thumbnailNodes.length > 0) {
    const nodes = thumbnailNodes.slice(0, 12)
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = maxX - minX, rangeY = maxY - minY
    const cols  = Math.ceil(Math.sqrt(nodes.length))
    const rows  = Math.ceil(nodes.length / cols)
    const gapX  = 4, gapY = 4
    const cellW = Math.max(14, Math.floor((W - pad * 2 - gapX * (cols - 1)) / cols))
    const cellH = Math.max(10, Math.floor((H - pad * 2 - gapY * (rows - 1)) / rows))

    let placed
    if (rangeX > 30 || rangeY > 30) {
      const rx = rangeX || 200, ry = rangeY || 200
      placed = nodes.map(n => ({
        x:     pad + Math.round(((n.x - minX) / rx) * (W - pad * 2 - cellW)),
        y:     pad + Math.round(((n.y - minY) / ry) * (H - pad * 2 - cellH)),
        color: nameColor(n.name), name: n.name,
      }))
    } else {
      placed = nodes.map((n, i) => ({
        x:     pad + (i % cols) * (cellW + gapX),
        y:     pad + Math.floor(i / cols) * (cellH + gapY),
        color: nameColor(n.name), name: n.name,
      }))
    }

    const edgeLines = edgeCount > 0 && placed.length >= 2
      ? Array.from({ length: Math.min(edgeCount, 4) }, (_, i) => ({
          x1: placed[i % placed.length].x + cellW,
          y1: placed[i % placed.length].y + cellH / 2,
          x2: placed[(i + 1) % placed.length].x,
          y2: placed[(i + 1) % placed.length].y + cellH / 2,
        }))
      : []

    return (
      <svg width={W} height={H} className="rounded-xl overflow-hidden">
        <rect width={W} height={H} fill="#f8fafc" rx={8}/>
        {edgeLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2,2" opacity={0.4}/>
        ))}
        {placed.map((n, i) => {
          const label = n.name.length > Math.max(4, Math.floor(cellW / 5.5))
            ? n.name.substring(0, Math.max(4, Math.floor(cellW / 5.5))) + '…'
            : n.name
          const headerH = Math.min(6, cellH)
          return (
            <g key={i}>
              <rect x={n.x} y={n.y} width={cellW} height={cellH} rx={3} fill={n.color} opacity={0.12}/>
              <rect x={n.x} y={n.y} width={cellW} height={headerH} rx={3} fill={n.color} opacity={0.7}/>
              <text x={n.x + 2} y={n.y + headerH - 1} fontSize={Math.min(5, headerH - 1)}
                    fill="white" opacity={0.95} fontFamily="system-ui, sans-serif"
                    style={{ userSelect: 'none' }}>{label}</text>
              {cellH > 9  && <rect x={n.x + 3} y={n.y + headerH + 2}  width={cellW * 0.6}  height={1.5} rx={1} fill={n.color} opacity={0.35}/>}
              {cellH > 13 && <rect x={n.x + 3} y={n.y + headerH + 6}  width={cellW * 0.45} height={1.5} rx={1} fill={n.color} opacity={0.22}/>}
              {cellH > 17 && <rect x={n.x + 3} y={n.y + headerH + 10} width={cellW * 0.55} height={1.5} rx={1} fill={n.color} opacity={0.15}/>}
            </g>
          )
        })}
      </svg>
    )
  }

  // Fallback
  const count = Math.min(tableCount, 12)
  if (count === 0) {
    return (
      <svg width={W} height={H} className="rounded-xl">
        <rect width={W} height={H} fill="#f1f5f9" rx={8}/>
        <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fill="#94a3b8"
              fontSize={9} fontFamily="system-ui, sans-serif">No schema yet</text>
      </svg>
    )
  }
  const cols  = Math.ceil(Math.sqrt(count))
  const rows  = Math.ceil(count / cols)
  const gapX  = 4, gapY = 4
  const cellW = Math.floor((W - pad * 2 - gapX * (cols - 1)) / cols)
  const cellH = Math.floor((H - pad * 2 - gapY * (rows - 1)) / rows)
  const gridNodes = Array.from({ length: count }, (_, i) => ({
    x:     pad + (i % cols) * (cellW + gapX),
    y:     pad + Math.floor(i / cols) * (cellH + gapY),
    color: PALETTE[(projectId * 3 + i) % PALETTE.length],
  }))
  return (
    <svg width={W} height={H} className="rounded-xl overflow-hidden">
      <rect width={W} height={H} fill="#f8fafc" rx={8}/>
      {gridNodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width={cellW} height={cellH} rx={3} fill={n.color} opacity={0.12}/>
          <rect x={n.x} y={n.y} width={cellW} height={Math.min(6, cellH)} rx={3} fill={n.color} opacity={0.55}/>
        </g>
      ))}
    </svg>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-24 bg-gray-100"/>
      <div className="p-4 space-y-2.5">
        <div className="h-4 bg-gray-100 rounded-lg w-3/4"/>
        <div className="h-3 bg-gray-100 rounded-lg w-full"/>
        <div className="h-3 bg-gray-100 rounded-lg w-5/6"/>
        <div className="h-3 bg-gray-100 rounded-lg w-1/2 mt-4"/>
        <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-2">
          <div className="h-3 bg-gray-100 rounded-lg w-1/3"/>
          <div className="h-6 bg-gray-100 rounded-lg w-20"/>
        </div>
      </div>
    </div>
  )
}

// ── Profile skeleton ──────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        <div className="w-24 h-24 rounded-2xl bg-gray-200 flex-shrink-0"/>
        <div className="flex-1 space-y-3 pt-1">
          <div className="h-7 bg-gray-200 rounded-lg w-48"/>
          <div className="h-4 bg-gray-100 rounded-lg w-32"/>
          <div className="h-3 bg-gray-100 rounded-lg w-full max-w-md"/>
          <div className="h-3 bg-gray-100 rounded-lg w-3/4 max-w-sm"/>
        </div>
      </div>
      <div className="flex gap-6 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="text-center">
            <div className="h-7 bg-gray-200 rounded w-10 mx-auto mb-1"/>
            <div className="h-3 bg-gray-100 rounded w-16"/>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Schema card (profile view) ────────────────────────────────────────────────
function ProfileSchemaCard({ card: initialCard, viewer, onStar, onLike, onFork, onOpen }) {
  const [card,     setCard]     = useState(initialCard)
  const [starring, setStarring] = useState(false)
  const [liking,   setLiking]   = useState(false)
  const [forking,  setForking]  = useState(false)

  useEffect(() => { setCard(initialCard) }, [initialCard])

  // viewer is the logged-in user; card.owner is the profile owner
  const isOwn = viewer && card.owner && viewer.id === card.owner.id

  const doStar = async (e) => {
    e.stopPropagation()
    setStarring(true)
    const updated = await onStar(card)
    if (updated) setCard(updated)
    setStarring(false)
  }
  const doLike = async (e) => {
    e.stopPropagation()
    setLiking(true)
    const updated = await onLike(card)
    if (updated) setCard(updated)
    setLiking(false)
  }
  const doFork = async (e) => {
    e.stopPropagation()
    if (card.is_forked || isOwn) return
    setForking(true)
    await onFork(card)
    setForking(false)
  }

  return (
    <div onClick={() => onOpen(card)}
         className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md
                    hover:border-blue-200/60 transition-all duration-200 cursor-pointer
                    overflow-hidden flex flex-col">

      {/* Thumbnail */}
      <div className="relative bg-gradient-to-br from-slate-50 to-gray-100
                      flex items-center justify-center py-3 border-b border-gray-100">
        <SchemaThumbnail
          thumbnailNodes={card.thumbnail_nodes}
          tableCount={card.stats?.tables || 0}
          edgeCount={card.stats?.edges || 0}
          projectId={card.id}
        />
        {card.is_featured && (
          <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                           bg-amber-400 text-amber-900 shadow-sm">★ Featured</span>
        )}
        {card.forked_from && (
          <span className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full
                           bg-violet-100 text-violet-600 border border-violet-200">Fork</span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-4 flex-1 flex flex-col">
        <h3 className="font-bold text-gray-900 text-sm truncate mb-0.5">{card.name}</h3>
        <p className="text-[11px] text-gray-400 line-clamp-2 mb-2 leading-relaxed flex-1 min-h-[2.2rem]">
          {card.description || 'No description'}
        </p>

        <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-2.5">
          <span>{card.stats?.tables || 0} tables</span>
          <span>·</span>
          <span>{card.stats?.edges || 0} relations</span>
          <span>·</span>
          <span>{timeAgo(card.created_at)}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className={`flex items-center gap-0.5 ${card.is_starred ? 'text-amber-500' : 'text-gray-400'}`}>
              <StarIcon filled={card.is_starred}/> {card.stats?.stars || 0}
            </span>
            <span className={`flex items-center gap-0.5 ${card.is_liked ? 'text-red-400' : 'text-gray-400'}`}>
              <HeartIcon filled={card.is_liked}/> {card.stats?.likes || 0}
            </span>
            <span className="flex items-center gap-0.5 text-gray-400">
              <GitForkIcon/> {card.stats?.forks || 0}
            </span>
          </div>

          {!isOwn && viewer && (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button disabled={starring} onClick={doStar}
                className={`p-1.5 rounded-lg transition-colors
                  ${card.is_starred
                    ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                    : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}>
                {starring ? <Spinner/> : <StarIcon filled={card.is_starred}/>}
              </button>
              <button disabled={liking} onClick={doLike}
                className={`p-1.5 rounded-lg transition-colors
                  ${card.is_liked
                    ? 'text-red-400 bg-red-50 hover:bg-red-100'
                    : 'text-gray-400 hover:text-red-400 hover:bg-red-50'}`}>
                {liking ? <Spinner/> : <HeartIcon filled={card.is_liked}/>}
              </button>
              <button disabled={forking || card.is_forked} onClick={doFork}
                className={`p-1.5 rounded-lg transition-colors
                  ${card.is_forked
                    ? 'text-violet-500 bg-violet-50 cursor-default'
                    : 'text-gray-400 hover:text-violet-500 hover:bg-violet-50'}`}>
                {forking ? <Spinner/> : <GitForkIcon/>}
              </button>
            </div>
          )}

          {isOwn && (
            <span className="text-[10px] text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              Your schema
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Schema detail modal (minimal, reuses ExploreView's approach) ──────────────
// Opens the schema in the ExploreView detail modal by navigating to dashboard?
// Actually simpler: open an inline detail overlay here.
function SchemaDetailModal({ card: initial, onClose, onStar, onLike, onFork, viewer, isOwner }) {
  const [card, setCard] = useState({
    stats: { stars: 0, likes: 0, forks: 0, comments: 0, tables: 0, edges: 0 },
    ...initial,
  })
  const [starring, setStarring] = useState(false)
  const [liking,   setLiking]   = useState(false)
  const [forking,  setForking]  = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const stats = card?.stats ?? {}

  const doStar = async () => {
    setStarring(true)
    const updated = await onStar(card)
    if (updated) setCard(c => ({ ...c, ...updated }))
    setStarring(false)
  }
  const doLike = async () => {
    setLiking(true)
    const updated = await onLike(card)
    if (updated) setCard(c => ({ ...c, ...updated }))
    setLiking(false)
  }
  const doFork = async () => {
    if (card.is_forked || isOwner) return
    setForking(true)
    await onFork(card)
    setCard(c => ({ ...c, is_forked: true, stats: { ...c.stats, forks: (c.stats?.forks || 0) + 1 } }))
    setForking(false)
  }

  const tabs = [
    ['overview', 'Overview'],
    ['comments', `Comments (${stats.comments ?? 0})`],
  ]

  // Comments
  const [comments, setComments] = useState([])
  const [commLoading, setCommLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (activeTab !== 'comments') return
    setCommLoading(true)
    api.get(`/projects/${card.id}/comments`)
      .then(r => setComments(r.data.data || []))
      .catch(() => {})
      .finally(() => setCommLoading(false))
  }, [activeTab, card.id])

  const postComment = async () => {
    if (!commentText.trim() || !viewer) return
    setPosting(true)
    try {
      const r = await api.post(`/projects/${card.id}/comments`, { content: commentText.trim() })
      setComments(prev => [r.data, ...prev])
      setCommentText('')
      setCard(c => ({ ...c, stats: { ...c.stats, comments: (c.stats?.comments || 0) + 1 } }))
    } catch {}
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 truncate">{card.name}</h2>
                {card.is_featured && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    ★ Featured
                  </span>
                )}
                {card.forked_from && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">
                    Forked from {card.forked_from.name}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{card.description || 'No description'}</p>
            </div>
            <button onClick={onClose}
              className="text-gray-300 hover:text-gray-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
            <span>{stats.tables ?? 0} tables · {stats.edges ?? 0} relations</span>
            <span>·</span>
            <span>{timeAgo(card.created_at)}</span>
          </div>

          {viewer && !isOwner && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button disabled={starring} onClick={doStar}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                  ${card.is_starred
                    ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                    : 'border-gray-200 text-gray-500 hover:border-amber-200 hover:text-amber-600 hover:bg-amber-50'}`}>
                {starring ? <Spinner/> : <StarIcon filled={card.is_starred}/>}
                {card.is_starred ? 'Starred' : 'Star'} · {stats.stars ?? 0}
              </button>
              <button disabled={liking} onClick={doLike}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                  ${card.is_liked
                    ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                    : 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50'}`}>
                {liking ? <Spinner/> : <HeartIcon filled={card.is_liked}/>}
                {card.is_liked ? 'Liked' : 'Like'} · {stats.likes ?? 0}
              </button>
              <button disabled={forking || card.is_forked} onClick={doFork}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                  ${card.is_forked
                    ? 'bg-violet-50 border-violet-200 text-violet-600 cursor-default'
                    : 'border-gray-200 text-gray-500 hover:border-violet-200 hover:text-violet-600 hover:bg-violet-50'}`}>
                {forking ? <Spinner/> : <GitForkIcon/>}
                {card.is_forked ? 'Forked' : 'Fork'} · {stats.forks ?? 0}
              </button>
            </div>
          )}
          {viewer && isOwner && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-medium">
                Your schema
              </span>
              <span className="text-[11px] text-gray-400">
                {stats.stars ?? 0} stars · {stats.likes ?? 0} likes · {stats.forks ?? 0} forks
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-6 border-b border-gray-100 flex-shrink-0">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors
                ${activeTab === id ? 'text-blue-600 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div>
              <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-2xl p-8
                              flex items-center justify-center mb-6 border border-gray-100">
                <SchemaThumbnail
                  thumbnailNodes={card.thumbnail_nodes}
                  tableCount={stats.tables ?? 0}
                  edgeCount={stats.edges ?? 0}
                  projectId={card.id}
                  width={280} height={160}
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Stars',    value: stats.stars    ?? 0, bg: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-600',  sub: 'text-amber-400' },
                  { label: 'Likes',    value: stats.likes    ?? 0, bg: 'bg-red-50',    border: 'border-red-100',    text: 'text-red-500',    sub: 'text-red-300' },
                  { label: 'Forks',    value: stats.forks    ?? 0, bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-600', sub: 'text-violet-400' },
                  { label: 'Comments', value: stats.comments ?? 0, bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-600',   sub: 'text-blue-400' },
                ].map(({ label, value, bg, border, text, sub }) => (
                  <div key={label} className={`${bg} ${border} border rounded-xl p-3 text-center`}>
                    <p className={`text-2xl font-bold ${text}`}>{value}</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${sub}`}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-4">Comments ({comments.length})</p>
              {viewer && (
                <div className="mb-5">
                  <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) postComment() }}
                    rows={2} placeholder="Write a comment… (Ctrl+Enter to post)"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none
                               bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                               focus:border-blue-400 transition-all"/>
                  <div className="flex justify-end mt-1.5">
                    <button onClick={postComment} disabled={!commentText.trim() || posting}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold
                                 rounded-lg transition-colors disabled:opacity-40">
                      {posting ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </div>
              )}
              {commLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                                      font-bold text-white overflow-hidden bg-blue-500 text-[10px]">
                        {c.author?.avatar_url
                          ? <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover"/>
                          : (c.author?.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-800">{c.author?.name}</span>
                          <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ value, label, onClick }) {
  const base = 'text-center'
  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} group`}>
        <p className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{value}</p>
        <p className="text-xs text-gray-500 group-hover:text-blue-500 transition-colors">{label}</p>
      </button>
    )
  }
  return (
    <div className={base}>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PublicProfilePage() {
  const { userId } = useParams()
  const navigate   = useNavigate()
  const { user: viewer } = useAuthStore()
  const { fetchProjects } = useProjectStore()
  const { toast, show: showToast } = useToast()

  const [profile,        setProfile]        = useState(null)
  const [schemas,        setSchemas]        = useState([])
  const [meta,           setMeta]           = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading,        setLoading]        = useState(true)
  const [schemasLoading, setSchemasLoading] = useState(false)
  const [notFound,       setNotFound]       = useState(false)
  const [isFollowing,    setIsFollowing]    = useState(false)
  const [followLoading,  setFollowLoading]  = useState(false)
  const [detail,         setDetail]         = useState(null)

  const isOwnProfile = viewer && profile && viewer.id === profile.user.id

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    api.get(`/users/${userId}`)
      .then(r => {
        setProfile(r.data)
        setSchemas(r.data.schemas?.data || [])
        setMeta(r.data.schemas?.meta || { current_page: 1, last_page: 1, total: 0 })
        setIsFollowing(r.data.is_following || false)
      })
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true)
        else setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [userId])

  // ── Load more schemas ─────────────────────────────────────────────────────
  const loadMore = async () => {
    if (schemasLoading || meta.current_page >= meta.last_page) return
    setSchemasLoading(true)
    try {
      const r = await api.get(`/users/${userId}`, { params: { page: meta.current_page + 1 } })
      setSchemas(prev => [...prev, ...(r.data.schemas?.data || [])])
      setMeta(r.data.schemas?.meta || meta)
    } catch {}
    setSchemasLoading(false)
  }

  // ── Follow / Unfollow ─────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!viewer || isOwnProfile) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await api.delete(`/users/${userId}/follow`)
        setIsFollowing(false)
        setProfile(p => ({ ...p, stats: { ...p.stats, followers: Math.max(0, (p.stats.followers || 1) - 1) } }))
      } else {
        await api.post(`/users/${userId}/follow`)
        setIsFollowing(true)
        setProfile(p => ({ ...p, stats: { ...p.stats, followers: (p.stats.followers || 0) + 1 } }))
      }
    } catch {}
    setFollowLoading(false)
  }

  // ── Star / Like / Fork ────────────────────────────────────────────────────
  const handleStar = useCallback(async (card) => {
    if (!viewer) return null
    try {
      if (card.is_starred) {
        await api.delete(`/projects/${card.id}/star`)
        const updated = { ...card, is_starred: false, stats: { ...card.stats, stars: (card.stats?.stars ?? 1) - 1 } }
        setSchemas(prev => prev.map(c => c.id === card.id ? updated : c))
        return updated
      } else {
        await api.post(`/projects/${card.id}/star`)
        const updated = { ...card, is_starred: true, stats: { ...card.stats, stars: (card.stats?.stars ?? 0) + 1 } }
        setSchemas(prev => prev.map(c => c.id === card.id ? updated : c))
        return updated
      }
    } catch (err) {
      if (err.response?.status === 403) showToast("You can't star your own schema.", 'warning')
      return null
    }
  }, [viewer, showToast])

  const handleLike = useCallback(async (card) => {
    if (!viewer) return null
    try {
      if (card.is_liked) {
        await api.delete(`/projects/${card.id}/like`)
        const updated = { ...card, is_liked: false, stats: { ...card.stats, likes: (card.stats?.likes ?? 1) - 1 } }
        setSchemas(prev => prev.map(c => c.id === card.id ? updated : c))
        return updated
      } else {
        await api.post(`/projects/${card.id}/like`)
        const updated = { ...card, is_liked: true, stats: { ...card.stats, likes: (card.stats?.likes ?? 0) + 1 } }
        setSchemas(prev => prev.map(c => c.id === card.id ? updated : c))
        return updated
      }
    } catch (err) {
      if (err.response?.status === 403) showToast("You can't like your own schema.", 'warning')
      return null
    }
  }, [viewer, showToast])

  const handleFork = useCallback(async (card) => {
    if (!viewer || card.is_forked) return false
    try {
      await api.post(`/projects/${card.id}/fork`)
      setSchemas(prev => prev.map(c =>
        c.id === card.id
          ? { ...c, is_forked: true, stats: { ...c.stats, forks: (c.stats?.forks ?? 0) + 1 } }
          : c
      ))
      showToast('Schema forked — check your My Schemas tab.', 'success')
      fetchProjects().catch(() => {})
      return true
    } catch (err) {
      if (err.response?.status === 403)      showToast(err.response?.data?.error || "You can't fork this schema.", 'warning')
      else if (err.response?.status === 409) showToast('You have already forked this schema.', 'info')
      else                                   showToast('Fork failed. Please try again.', 'error')
      return false
    }
  }, [viewer, showToast, fetchProjects])

  // ── 404 state ─────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        <nav className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo_white.svg" alt="Schema Genius"
                 className="h-7 w-auto"
                 style={{ filter: 'invert(1) brightness(0) saturate(100%) invert(28%) sepia(45%) saturate(700%) hue-rotate(200deg)' }}/>
          </Link>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Dashboard
          </button>
        </nav>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm px-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">User not found</h1>
            <p className="text-sm text-gray-500 mb-6">
              This profile doesn't exist or may have been removed.
            </p>
            <button onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700
                         text-sm text-white font-semibold rounded-xl transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              Go back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const u     = profile?.user
  const stats = profile?.stats

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc]">

      {/* Top nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius"
               className="h-7 w-auto"
               style={{ filter: 'invert(1) brightness(0) saturate(100%) invert(28%) sepia(45%) saturate(700%) hue-rotate(200deg)' }}/>
        </Link>
        <button onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
          Dashboard
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* Profile header */}
        {loading ? (
          <ProfileSkeleton/>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">

              {/* Avatar */}
              <div className="flex-shrink-0">
                {u?.avatar_url ? (
                  <img src={u.avatar_url} alt={u.name}
                       className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white shadow-md"/>
                ) : (
                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-white
                                  font-bold text-3xl shadow-md ring-4 ring-white"
                       style={{ background: nameColor(u?.name || '') }}>
                    {(u?.name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">{u?.name}</h1>
                  {u?.user_type && (
                    <span className="mt-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50
                                     text-blue-600 border border-blue-100">
                      {USER_TYPE_LABELS[u.user_type] || u.user_type}
                    </span>
                  )}
                </div>
                {u?.headline && (
                  <p className="text-sm text-gray-600 font-medium mb-2">{u.headline}</p>
                )}
                {u?.bio && (
                  <p className="text-sm text-gray-500 leading-relaxed mb-3 max-w-xl">{u.bio}</p>
                )}
                <p className="text-xs text-gray-400">
                  Member since {new Date(u?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex-shrink-0 flex gap-2 sm:mt-0 mt-0">
                {isOwnProfile ? (
                  <button onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold
                               border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50
                               transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit profile
                  </button>
                ) : (
                  <button onClick={handleFollow} disabled={followLoading}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl
                                transition-all disabled:opacity-60
                      ${isFollowing
                        ? 'border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200'}`}>
                    {followLoading ? (
                      <Spinner cls="w-4 h-4"/>
                    ) : isFollowing ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                        Following
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                        </svg>
                        Follow
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 sm:gap-10 mt-6 pt-6 border-t border-gray-100 flex-wrap">
              <StatPill value={stats?.public_schemas ?? 0} label="Public schemas"/>
              <StatPill value={stats?.followers ?? 0} label="Followers"/>
              <StatPill value={stats?.following ?? 0} label="Following"/>
              <StatPill
                value={stats?.total_stars ?? 0}
                label="Stars received"
              />
            </div>
          </div>
        )}

        {/* Schemas section */}
        {!loading && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">
                Public schemas
                {meta.total > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-400">({meta.total})</span>
                )}
              </h2>
            </div>

            {schemas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">No public schemas yet</p>
                <p className="text-xs text-gray-400">
                  {isOwnProfile
                    ? 'Make one of your projects public to show it here.'
                    : `${u?.name} hasn't published any schemas yet.`}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {schemas.map(card => (
                    <ProfileSchemaCard
                      key={card.id}
                      card={card}
                      viewer={viewer}
                      onStar={handleStar}
                      onLike={handleLike}
                      onFork={handleFork}
                      onOpen={setDetail}
                    />
                  ))}
                </div>

                {meta.current_page < meta.last_page && (
                  <div className="flex justify-center mt-8">
                    <button onClick={loadMore} disabled={schemasLoading}
                      className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 text-sm font-medium
                                 text-gray-500 rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50
                                 transition-all disabled:opacity-40">
                      {schemasLoading && (
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                      )}
                      Load more · {meta.total - schemas.length} remaining
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <SchemaDetailModal
          card={detail}
          onClose={() => setDetail(null)}
          onStar={handleStar}
          onLike={handleLike}
          onFork={handleFork}
          viewer={viewer}
          isOwner={isOwnProfile || (viewer && detail.owner && viewer.id === detail.owner.id)}
        />
      )}

      <Toast toast={toast}/>
    </div>
  )
}
