import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import useAuthStore from '../../store/useAuthStore'
import useProjectStore from '../../store/useProjectStore'

// ── Constants ─────────────────────────────────────────────────────────────────
const PALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316']

function timeAgo(date) {
  if (!date) return ''
  const s = Math.floor((Date.now() - new Date(date)) / 1000)
  if (s < 60)     return `${s}s ago`
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Simple string → consistent colour hash
function nameColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0 }
  return PALETTE[Math.abs(h) % PALETTE.length]
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
    <circle cx="6" cy="6" r="2" strokeWidth={2}/>
    <circle cx="18" cy="6" r="2" strokeWidth={2}/>
    <circle cx="12" cy="18" r="2" strokeWidth={2}/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v1a6 6 0 006 6m0 0a6 6 0 006-6V8M12 15v3"/>
  </svg>
)
const GlobeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={2}/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
  </svg>
)
const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth={2}/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)
const Spinner = ({ cls = '' }) => (
  <span className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin ${cls || 'w-3.5 h-3.5'}`}/>
)

// ── Toast (lightweight) ───────────────────────────────────────────────────────
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
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium
                     flex items-center gap-2 ${colors[toast.type] || colors.info}`}>
      {toast.type === 'error'   && <span>✕</span>}
      {toast.type === 'warning' && <span>⚠</span>}
      {toast.type === 'success' && <span>✓</span>}
      {toast.msg}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-5 h-5 text-[9px]' : 'w-7 h-7 text-[10px]'
  return (
    <div className={`${dim} rounded-full flex-shrink-0 flex items-center justify-center
                     font-bold text-white overflow-hidden bg-blue-500`}>
      {url ? <img src={url} alt="" className="w-full h-full object-cover"/> : (name || '?')[0].toUpperCase()}
    </div>
  )
}

// ── Schema thumbnail ──────────────────────────────────────────────────────────
// BUG 1 FIX: when all nodes share the same position (rangeX ≤ 30 && rangeY ≤ 30,
// i.e. no one has dragged the canvas), fall back to a grid layout while keeping
// name-derived colours so each schema still looks visually unique.
function SchemaThumbnail({ thumbnailNodes = [], tableCount = 0, edgeCount = 0, projectId = 0, width = 168, height = 96 }) {
  const W = width, H = height
  const pad = 10

  if (thumbnailNodes && thumbnailNodes.length > 0) {
    const nodes = thumbnailNodes.slice(0, 12)

    // Measure position spread to decide layout strategy
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = maxX - minX
    const rangeY = maxY - minY

    // Grid dimensions (used in both layout modes)
    const cols = Math.ceil(Math.sqrt(nodes.length))
    const rows = Math.ceil(nodes.length / cols)
    const gapX = 4, gapY = 4
    const cellW = Math.max(14, Math.floor((W - pad * 2 - gapX * (cols - 1)) / cols))
    const cellH = Math.max(10, Math.floor((H - pad * 2 - gapY * (rows - 1)) / rows))

    let placed
    if (rangeX > 30 || rangeY > 30) {
      // Real positional layout — nodes were actually dragged around on the canvas
      const rx = rangeX || 200, ry = rangeY || 200
      placed = nodes.map(n => ({
        x:     pad + Math.round(((n.x - minX) / rx) * (W - pad * 2 - cellW)),
        y:     pad + Math.round(((n.y - minY) / ry) * (H - pad * 2 - cellH)),
        color: nameColor(n.name),
        name:  n.name,
      }))
    } else {
      // BUG 1 FIX — all nodes at same position; place them in a grid so they're
      // all visible. Colours still derived from table names → unique per schema.
      placed = nodes.map((n, i) => ({
        x:     pad + (i % cols) * (cellW + gapX),
        y:     pad + Math.floor(i / cols) * (cellH + gapY),
        color: nameColor(n.name),
        name:  n.name,
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
              {/* BUG 1 FIX — table name label inside header bar makes each thumbnail unique */}
              <text x={n.x + 2} y={n.y + headerH - 1}
                    fontSize={Math.min(5, headerH - 1)}
                    fill="white" opacity={0.95}
                    fontFamily="system-ui, sans-serif"
                    style={{ userSelect: 'none' }}>
                {label}
              </text>
              {cellH > 9  && <rect x={n.x + 3} y={n.y + headerH + 2} width={cellW * 0.6}  height={1.5} rx={1} fill={n.color} opacity={0.35}/>}
              {cellH > 13 && <rect x={n.x + 3} y={n.y + headerH + 6} width={cellW * 0.45} height={1.5} rx={1} fill={n.color} opacity={0.22}/>}
              {cellH > 17 && <rect x={n.x + 3} y={n.y + headerH + 10} width={cellW * 0.55} height={1.5} rx={1} fill={n.color} opacity={0.15}/>}
            </g>
          )
        })}
      </svg>
    )
  }

  // Fallback: generic grid when thumbnail_nodes is empty (no schema version saved yet)
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

// ── Publish modal — BUG 10 FIX ────────────────────────────────────────────────
function PublishModal({ card, onClose, onConfirm }) {
  const [desc,      setDesc]      = useState(card.description || '')
  const [publishing, setPublishing] = useState(false)

  const handlePublish = async () => {
    setPublishing(true)
    await onConfirm(card, desc.trim())
    setPublishing(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Publish schema</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              <span className="font-semibold text-gray-600">"{card.name}"</span> will appear in Discover for everyone
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-300 hover:text-gray-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(helps others discover it)</span>
            </label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              rows={3} maxLength={500}
              placeholder="What does this schema model? e.g. E-commerce platform with products, orders, and users."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                         bg-gray-50 transition-all text-gray-700"/>
            <p className="text-xs text-gray-400 text-right mt-1">{desc.length}/500</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-5 flex items-start gap-2.5">
            <GlobeIcon/>
            <div>
              <p className="text-xs font-semibold text-emerald-700">This schema will be public</p>
              <p className="text-xs text-emerald-600 mt-0.5">Anyone on Schema Genius can find, star, like, fork, and comment on it. You can make it private again at any time.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500
                         font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handlePublish} disabled={publishing}
              className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm
                         font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {publishing ? <><Spinner cls="w-4 h-4"/>Publishing…</> : <><GlobeIcon/>Publish schema</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Schema card ───────────────────────────────────────────────────────────────
function SchemaCard({ card: initialCard, onStar, onLike, onFork, onOpen, isOwn, onToggleVisibility, onPublish }) {
  const [card,     setCard]     = useState(initialCard)
  const [starring, setStarring] = useState(false)
  const [liking,   setLiking]   = useState(false)
  const [forking,  setForking]  = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showPublish, setShowPublish] = useState(false) // BUG 10

  useEffect(() => { setCard(initialCard) }, [initialCard])

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
    if (card.is_forked) return
    setForking(true)
    await onFork(card)
    setForking(false)
  }

  // BUG 9 FIX — making private is a direct toggle; making public opens PublishModal (BUG 10)
  const doMakePrivate = async (e) => {
    e.stopPropagation()
    setToggling(true)
    await onToggleVisibility(card, 'private')
    setCard(c => ({ ...c, visibility: 'private' }))
    setToggling(false)
  }
  const doPublishConfirm = async (c, desc) => {
    await onPublish(c, desc)
    setCard(cv => ({ ...cv, visibility: 'public', description: desc || cv.description }))
  }

  return (
    <>
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
            <span>{card.stats?.tables || 0} classes</span>
            <span>·</span>
            <span>{card.stats?.edges || 0} relations</span>
            {!isOwn && <><span>·</span><span>{card.stats?.comments || 0} comments</span></>}
          </div>

          {!isOwn && card.owner && (
            <div className="flex items-center gap-1.5 mb-3" onClick={e => e.stopPropagation()}>
              <Link to={`/u/${card.owner.id}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <Avatar url={card.owner.avatar_url} name={card.owner.name}/>
                <span className="text-[11px] text-gray-500 truncate hover:text-blue-500 transition-colors">{card.owner.name}</span>
              </Link>
            </div>
          )}

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

            {!isOwn ? (
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
            ) : (
              /* BUG 9 FIX — more prominent publish / private toggle */
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                {card.visibility === 'public' ? (
                  <button disabled={toggling} onClick={doMakePrivate}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium
                               bg-emerald-50 text-emerald-600 border border-emerald-100
                               hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all group">
                    {toggling ? <Spinner cls="w-3 h-3"/> : (
                      <>
                        <span className="group-hover:hidden"><GlobeIcon/></span>
                        <span className="hidden group-hover:inline"><LockIcon/></span>
                      </>
                    )}
                    <span className="group-hover:hidden">Public</span>
                    <span className="hidden group-hover:inline">Make private</span>
                  </button>
                ) : (
                  /* BUG 9 FIX — large, prominent "Publish" CTA for private schemas */
                  <button onClick={e => { e.stopPropagation(); setShowPublish(true) }}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold
                               bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm
                               transition-colors">
                    <GlobeIcon/>
                    Publish
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BUG 10 FIX — PublishModal */}
      {showPublish && (
        <PublishModal
          card={card}
          onClose={() => setShowPublish(false)}
          onConfirm={doPublishConfirm}
        />
      )}
    </>
  )
}

// ── Comment item ──────────────────────────────────────────────────────────────
function CommentItem({ c, parentId, user, onDelete, onStartEdit, onSaveEdit, editId, editText, setEditText, onReply }) {
  return (
    <div className={`flex gap-2.5 ${parentId ? 'ml-8 mt-2' : ''}`}>
      <Avatar url={c.author?.avatar_url} name={c.author?.name} size="md"/>
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-800">{c.author?.name}</span>
            <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
            {c.updated_at !== c.created_at && (
              <span className="text-[10px] text-gray-400 italic">edited</span>
            )}
          </div>
          {editId === c.id ? (
            <div className="flex gap-2 items-end">
              <textarea value={editText} onChange={e => setEditText(e.target.value)}
                rows={2}
                className="flex-1 text-xs p-1.5 border border-gray-200 rounded-lg resize-none
                           focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"/>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={() => onSaveEdit(c.id)}
                  className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded-lg font-medium">Save</button>
                <button onClick={() => onStartEdit(null, '')}
                  className="text-[10px] px-2 py-1 border border-gray-200 text-gray-500 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 px-1">
          {!parentId && user && (
            <button onClick={() => onReply({ id: c.id, authorName: c.author?.name })}
              className="text-[10px] text-gray-400 hover:text-blue-500 font-medium transition-colors">
              Reply
            </button>
          )}
          {user?.id === c.author?.id && editId !== c.id && (
            <button onClick={() => onStartEdit(c.id, c.content)}
              className="text-[10px] text-gray-400 hover:text-blue-500 font-medium transition-colors">
              Edit
            </button>
          )}
          {user?.id === c.author?.id && (
            <button onClick={() => onDelete(c.id, parentId)}
              className="text-[10px] text-gray-400 hover:text-red-400 font-medium transition-colors">
              Delete
            </button>
          )}
        </div>
        {c.replies?.map(r => (
          <CommentItem key={r.id} c={r} parentId={c.id} user={user}
            onDelete={onDelete} onStartEdit={onStartEdit} onSaveEdit={onSaveEdit}
            editId={editId} editText={editText} setEditText={setEditText} onReply={onReply}/>
        ))}
      </div>
    </div>
  )
}

// ── Comments section ──────────────────────────────────────────────────────────
function CommentsSection({ projectId, user }) {
  const [comments, setComments] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [text,     setText]     = useState('')
  const [posting,  setPosting]  = useState(false)
  const [replyTo,  setReplyTo]  = useState(null)
  const [editId,   setEditId]   = useState(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    setLoading(true)
    setComments([])
    api.get(`/projects/${projectId}/comments`)
      .then(r => setComments(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  const post = async () => {
    if (!text.trim() || !user) return
    setPosting(true)
    try {
      const r = await api.post(`/projects/${projectId}/comments`, {
        content:   text.trim(),
        parent_id: replyTo?.id ?? null,
      })
      if (replyTo) {
        setComments(prev => prev.map(c =>
          c.id === replyTo.id
            ? { ...c, replies: [...(c.replies || []), r.data] }
            : c
        ))
      } else {
        setComments(prev => [r.data, ...prev])
      }
      setText(''); setReplyTo(null)
    } catch {}
    setPosting(false)
  }

  const handleDelete = async (id, parentId) => {
    try { await api.delete(`/comments/${id}`) } catch { return }
    if (parentId) {
      setComments(prev => prev.map(c =>
        c.id === parentId
          ? { ...c, replies: (c.replies || []).filter(r => r.id !== id) }
          : c
      ))
    } else {
      setComments(prev => prev.filter(c => c.id !== id))
    }
  }

  const handleSaveEdit = async (id) => {
    if (!editText.trim()) return
    try {
      const r = await api.put(`/comments/${id}`, { content: editText.trim() })
      setComments(prev => prev.map(c => {
        if (c.id === id) return r.data
        return { ...c, replies: (c.replies || []).map(rep => rep.id === id ? r.data : rep) }
      }))
      setEditId(null); setEditText('')
    } catch {}
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-4">
        Comments ({comments.length})
      </p>
      {user && (
        <div className="flex gap-2.5 mb-5">
          <Avatar url={user.avatar_url} name={user.name} size="md"/>
          <div className="flex-1">
            {replyTo && (
              <div className="flex items-center gap-2 mb-1.5 text-[10px] text-blue-500 font-medium">
                <span>Replying to @{replyTo.authorName}</span>
                <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 font-bold">×</button>
              </div>
            )}
            <textarea value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) post() }}
              rows={2} placeholder="Write a comment… (Ctrl+Enter to post)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none
                         bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                         focus:border-blue-400 transition-all"/>
            <div className="flex justify-end mt-1.5">
              <button onClick={post} disabled={!text.trim() || posting}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold
                           rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {comments.map(c => (
            <CommentItem key={c.id} c={c} parentId={null} user={user}
              onDelete={handleDelete}
              onStartEdit={(id, content) => { setEditId(id); setEditText(content) }}
              onSaveEdit={handleSaveEdit}
              editId={editId} editText={editText} setEditText={setEditText}
              onReply={setReplyTo}/>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Schema detail modal — BUG 1, 4 FIX ───────────────────────────────────────
function SchemaDetailModal({ card: initial, onClose, onStar, onLike, onFork, user, isOwner }) {
  // BUG 1 FIX — initialise with a guaranteed-safe object so stats access never throws
  const safeInitial = {
    stats:  { stars: 0, likes: 0, forks: 0, comments: 0, tables: 0, edges: 0 },
    ...initial,
  }
  const [card,         setCard]        = useState(safeInitial)
  const [starring,     setStarring]    = useState(false)
  const [liking,       setLiking]      = useState(false)
  const [forking,      setForking]     = useState(false)
  const [activeTab,    setActiveTab]   = useState('overview')
  const [forkTree,     setForkTree]    = useState(null)
  // BUG 5 FIX — follow state for the schema owner
  const [following,    setFollowing]   = useState(false)
  const [followLoading,setFollowLoad]  = useState(false)

  // BUG 4 FIX — determine if viewer is the owner here so effects can use it
  const viewerIsOwner = isOwner || (user && safeInitial.owner && user.id === safeInitial.owner.id)

  // Refresh the card from the detail endpoint (only for public projects)
  useEffect(() => {
    if (!initial?.id) return
    api.get(`/explore/projects/${initial.id}`)
      .then(r => {
        if (r.data && typeof r.data === 'object') {
          // BUG 1 FIX — merge fresh data but always preserve stats shape
          setCard({
            stats: { stars: 0, likes: 0, forks: 0, comments: 0, tables: 0, edges: 0 },
            ...r.data,
          })
        }
      })
      .catch(() => {})
  }, [initial?.id])

  // BUG 5 FIX — load follow status when modal opens for a non-owner public schema
  useEffect(() => {
    if (!user || viewerIsOwner || !safeInitial.owner?.id) return
    api.get(`/users/${safeInitial.owner.id}/follow-status`)
      .then(r => setFollowing(r.data.following ?? false))
      .catch(() => {})
  }, [safeInitial.owner?.id, user, viewerIsOwner])

  // Load fork tree when Forks tab is activated
  useEffect(() => {
    if (activeTab !== 'forks' || forkTree !== null) return
    api.get(`/projects/${card.id}/fork-tree`)
      .then(r => setForkTree(r.data))
      .catch(() => setForkTree({ descendants: [] }))
  }, [activeTab, card.id, forkTree])

  const doStar = async () => {
    setStarring(true)
    const updated = await onStar(card)
    if (updated) setCard({ stats: card.stats, ...updated })
    setStarring(false)
  }
  const doLike = async () => {
    setLiking(true)
    const updated = await onLike(card)
    if (updated) setCard({ stats: card.stats, ...updated })
    setLiking(false)
  }
  const doFork = async () => {
    if (card.is_forked || viewerIsOwner) return
    setForking(true)
    await onFork(card)
    setCard(c => ({ ...c, is_forked: true, stats: { ...c.stats, forks: (c.stats?.forks || 0) + 1 } }))
    setForking(false)
  }

  // BUG 5 FIX — follow/unfollow the schema owner
  const doFollow = async () => {
    if (!user || viewerIsOwner || !card.owner?.id) return
    setFollowLoad(true)
    try {
      if (following) {
        await api.delete(`/users/${card.owner.id}/follow`)
        setFollowing(false)
      } else {
        await api.post(`/users/${card.owner.id}/follow`)
        setFollowing(true)
      }
    } catch {}
    setFollowLoad(false)
  }

  // Safe stats with defaults, never throws
  const stats     = card?.stats ?? {}
  const commCount = stats.comments ?? 0
  const forkCount = stats.forks    ?? 0

  const tabs = [
    ['overview', 'Overview'],
    ['comments', `Comments (${commCount})`],
    ['forks',    `Forks (${forkCount})`],
  ]

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

          {/* Owner + meta */}
          <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-gray-400">
            {card.owner && (
              <div className="flex items-center gap-1.5">
                <Link to={`/u/${card.owner.id}`} onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                  <Avatar url={card.owner.avatar_url} name={card.owner.name}/>
                  <span className="font-medium text-gray-600 hover:text-blue-600 transition-colors">{card.owner.name}</span>
                </Link>
                {/* BUG 5 FIX — Follow/Unfollow button next to owner name */}
                {user && !viewerIsOwner && (
                  <button onClick={doFollow} disabled={followLoading}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-all disabled:opacity-50
                      ${following
                        ? 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                        : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300'}`}>
                    {followLoading ? '…' : following ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            )}
            <span>·</span>
            <span>{stats.tables ?? 0} classes · {stats.edges ?? 0} relations</span>
            <span>·</span>
            <span>{timeAgo(card.created_at)}</span>
          </div>

          {/* BUG 4 FIX — hide Star/Like/Fork for the schema owner */}
          {user && !viewerIsOwner && (
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
          {/* BUG 4 FIX — owner sees an informative owner badge instead of action buttons */}
          {user && viewerIsOwner && (
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

        {/* Sub-tabs */}
        <div className="flex items-center gap-0.5 px-6 border-b border-gray-100 flex-shrink-0">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors
                ${activeTab === id
                  ? 'text-blue-600 border-blue-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
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
                  width={280}
                  height={160}
                />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Stars',    value: stats.stars    ?? 0, bg: 'bg-amber-50',   border: 'border-amber-100',  text: 'text-amber-600',  sub: 'text-amber-400' },
                  { label: 'Likes',    value: stats.likes    ?? 0, bg: 'bg-red-50',     border: 'border-red-100',    text: 'text-red-500',    sub: 'text-red-300' },
                  { label: 'Forks',    value: stats.forks    ?? 0, bg: 'bg-violet-50',  border: 'border-violet-100', text: 'text-violet-600', sub: 'text-violet-400' },
                  { label: 'Comments', value: stats.comments ?? 0, bg: 'bg-blue-50',    border: 'border-blue-100',   text: 'text-blue-600',   sub: 'text-blue-400' },
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
            <CommentsSection projectId={card.id} user={user}/>
          )}

          {activeTab === 'forks' && (
            <div>
              {forkTree === null ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : (forkTree.descendants || []).length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <GitForkIcon/>
                  </div>
                  <p className="text-sm font-medium text-gray-500 mb-1">No forks yet</p>
                  <p className="text-xs text-gray-400 mb-4">Be the first to fork this schema</p>
                  {!card.is_forked && user && !viewerIsOwner && (
                    <button onClick={doFork} disabled={forking}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold
                                 rounded-xl transition-colors">
                      {forking ? 'Forking…' : 'Fork this schema'}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {forkTree.root && (
                    <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z"/>
                      </svg>
                      <p className="text-xs text-blue-700 font-medium">
                        Root: <span className="font-bold">{forkTree.root.name}</span> by {forkTree.root.owner}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(forkTree.descendants || []).map((node, i) => (
                      <div key={i}
                           style={{ marginLeft: `${(node.depth || 0) * 20}px` }}
                           className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] text-violet-600 font-bold">{node.depth}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{node.name}</p>
                          <p className="text-[10px] text-gray-400">by {node.owner} · {timeAgo(node.forked_at)}</p>
                        </div>
                        {node.id === forkTree.current_id && (
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                            current
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Featured banner ───────────────────────────────────────────────────────────
function FeaturedBanner({ featured, onOpen }) {
  if (!featured) return null
  const stats = featured.stats ?? {}
  return (
    <div className="relative bg-gradient-to-r from-amber-500/10 via-orange-400/5 to-amber-400/10
                    border border-amber-200/60 rounded-2xl p-5 mb-6 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]"
           style={{ backgroundImage: 'radial-gradient(circle, #f59e0b 1px, transparent 1px)', backgroundSize: '24px 24px' }}/>
      <div className="relative flex items-center gap-5">
        <div className="flex-shrink-0">
          <SchemaThumbnail
            thumbnailNodes={featured.thumbnail_nodes}
            tableCount={stats.tables ?? 0}
            edgeCount={stats.edges   ?? 0}
            projectId={featured.id}
            width={148}
            height={84}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-900">
              ★ Schema of the Week
            </span>
            {featured.featured_week_of && (
              <span className="text-[10px] text-amber-600 font-medium">
                Week of {new Date(featured.featured_week_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-base truncate">{featured.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-1 mb-1">{featured.description || 'No description'}</p>
          {featured.featured_note && (
            <p className="text-xs text-amber-700/70 italic">"{featured.featured_note}"</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {featured.owner && (
              <>
                <Link to={`/u/${featured.owner.id}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                  <Avatar url={featured.owner.avatar_url} name={featured.owner.name}/>
                  <span className="text-xs text-gray-600 font-medium hover:text-blue-600 transition-colors">{featured.owner.name}</span>
                </Link>
                <span className="text-gray-300">·</span>
              </>
            )}
            <span className="text-xs text-gray-400">
              {stats.stars ?? 0} stars · {stats.forks ?? 0} forks
            </span>
          </div>
        </div>
        <button onClick={() => onOpen(featured)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600
                     text-white text-sm font-semibold rounded-xl shadow-sm transition-colors">
          View
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-500 mb-1">{title}</p>
      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">{subtitle}</p>
    </div>
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

// ── Main ExploreView ──────────────────────────────────────────────────────────
export default function ExploreView() {
  const { user } = useAuthStore()
  const { fetchProjects } = useProjectStore()
  const { toast, show: showToast } = useToast()

  const [tab,      setTab]      = useState('discover')
  const [cards,    setCards]    = useState([])
  const [featured, setFeatured] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [meta,     setMeta]     = useState({ current_page: 1, last_page: 1, total: 0 })
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState('recent')
  const [detail,   setDetail]   = useState(null)   // card being shown in detail modal
  const [detailIsOwner, setDetailIsOwner] = useState(false) // BUG 4 FIX

  const searchTimer = useRef(null)

  // ── Data fetching ────────────────────────────────────────────────
  const fetchCards = useCallback(async (page = 1, reset = true) => {
    setLoading(true)
    try {
      const params = { page }
      let url
      if (tab === 'discover') {
        url = '/explore'
        params.sort = sort
        if (search.trim()) params.search = search.trim()
      } else if (tab === 'network') {
        url = '/explore/network'
      } else {
        url = '/explore/my-schemas'
      }
      const r = await api.get(url, { params })
      const data = r.data.data || []
      const m    = r.data.meta || { current_page: page, last_page: 1, total: data.length }
      setCards(prev => reset ? data : [...prev, ...data])
      setMeta(m)
    } catch {}
    setLoading(false)
  }, [tab, search, sort])

  // Reload on tab/sort change
  useEffect(() => { fetchCards(1, true) }, [tab, sort])

  // Debounced search
  useEffect(() => {
    if (tab !== 'discover') return
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchCards(1, true), 380)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  // Featured banner (discover tab only)
  useEffect(() => {
    if (tab !== 'discover') return
    api.get('/explore/featured').then(r => setFeatured(r.data)).catch(() => {})
  }, [tab])

  // ── Interaction handlers ─────────────────────────────────────────
  const handleStar = useCallback(async (card) => {
    if (!user) return null
    try {
      if (card.is_starred) {
        await api.delete(`/projects/${card.id}/star`)
        return { ...card, is_starred: false, stats: { ...card.stats, stars: (card.stats?.stars ?? 1) - 1 } }
      } else {
        await api.post(`/projects/${card.id}/star`)
        return { ...card, is_starred: true, stats: { ...card.stats, stars: (card.stats?.stars ?? 0) + 1 } }
      }
    } catch (err) {
      if (err.response?.status === 403) showToast("You can't star your own schema.", 'warning')
      return null
    }
  }, [user, showToast])

  const handleLike = useCallback(async (card) => {
    if (!user) return null
    try {
      if (card.is_liked) {
        await api.delete(`/projects/${card.id}/like`)
        return { ...card, is_liked: false, stats: { ...card.stats, likes: (card.stats?.likes ?? 1) - 1 } }
      } else {
        await api.post(`/projects/${card.id}/like`)
        return { ...card, is_liked: true, stats: { ...card.stats, likes: (card.stats?.likes ?? 0) + 1 } }
      }
    } catch (err) {
      if (err.response?.status === 403) showToast("You can't like your own schema.", 'warning')
      return null
    }
  }, [user, showToast])

  // BUG 6 FIX — handleFork returns true/false and shows feedback on 403
  // BUG 2 FIX — fetchProjects() called after success so dashboard updates immediately
  const handleFork = useCallback(async (card) => {
    if (!user || card.is_forked) return false
    try {
      await api.post(`/projects/${card.id}/fork`)
      setCards(prev => prev.map(c =>
        c.id === card.id
          ? { ...c, is_forked: true, stats: { ...c.stats, forks: (c.stats?.forks ?? 0) + 1 } }
          : c
      ))
      showToast('Schema forked — check your My Schemas tab.', 'success')
      // Refresh the dashboard project list so the forked project appears immediately
      fetchProjects().catch(() => {})
      return true
    } catch (err) {
      if (err.response?.status === 403)       showToast(err.response?.data?.error || "You can't fork this schema.", 'warning')
      else if (err.response?.status === 409)  showToast('You have already forked this schema.', 'info')
      else                                    showToast('Fork failed. Please try again.', 'error')
      return false
    }
  }, [user, showToast, fetchProjects])

  const handleToggleVisibility = useCallback(async (card, next) => {
    await api.put(`/projects/${card.id}`, { visibility: next })
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, visibility: next } : c))
  }, [])

  // BUG 10 FIX — handlePublish: sets visibility=public AND updates description
  const handlePublish = useCallback(async (card, description) => {
    await api.put(`/projects/${card.id}`, {
      visibility: 'public',
      ...(description ? { description } : {}),
    })
    setCards(prev => prev.map(c =>
      c.id === card.id
        ? { ...c, visibility: 'public', description: description || c.description }
        : c
    ))
    showToast('Schema published! It now appears in Discover.', 'success')
  }, [showToast])

  const syncCard = useCallback((updated) => {
    if (!updated) return
    setCards(prev => prev.map(c => c.id === updated.id ? updated : c))
  }, [])

  const handleStarSync = useCallback(async (card) => {
    const updated = await handleStar(card)
    syncCard(updated)
    return updated
  }, [handleStar, syncCard])

  const handleLikeSync = useCallback(async (card) => {
    const updated = await handleLike(card)
    syncCard(updated)
    return updated
  }, [handleLike, syncCard])

  // BUG 4 FIX — open detail with owner context
  const handleOpenDetail = useCallback((card) => {
    setDetail(card)
    setDetailIsOwner(
      tab === 'my-schemas' ||
      (user != null && card.owner != null && user.id === card.owner.id)
    )
  }, [tab, user])

  // ── Tabs ─────────────────────────────────────────────────────────
  const TABS = [
    ['discover',    'Discover'],
    ['network',     'My Network'],
    ['my-schemas',  'My Schemas'],
  ]

  const SORT_OPTIONS = [
    ['recent',   'Most recent'],
    ['popular',  'Most popular'],
    ['stars',    'Most starred'],
    ['forks',    'Most forked'],
    ['trending', 'Trending'],
  ]

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-0.5">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setSearch('') }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                ${tab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'discover' && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                type="text" placeholder="Search schemas…"
                className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-48
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                           bg-gray-50 transition-all"/>
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="py-2 pl-3 pr-8 text-sm border border-gray-200 rounded-xl bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                         text-gray-600 transition-all">
              {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Featured banner — only rendered when a featured schema exists */}
      {tab === 'discover' && featured && (
        <FeaturedBanner featured={featured} onOpen={handleOpenDetail}/>
      )}

      {/* Card grid */}
      {loading && cards.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i}/>)}
        </div>
      ) : cards.length === 0 ? (
        tab === 'discover' ? (
          <EmptyState
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>}
            title={search ? 'No schemas match your search' : 'No public schemas yet'}
            subtitle={search ? 'Try a different search term or sort.' : 'Be the first to make a schema public!'}
          />
        ) : tab === 'network' ? (
          <EmptyState
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
            title="Your network is quiet"
            subtitle="Follow people or add friends to see their public schemas here."
          />
        ) : (
          <EmptyState
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
            title="No projects yet"
            subtitle="Create a project and make it public to see it here with community stats."
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards.map(card => (
              <SchemaCard
                key={card.id}
                card={card}
                onStar={handleStarSync}
                onLike={handleLikeSync}
                onFork={handleFork}
                onOpen={handleOpenDetail}
                isOwn={tab === 'my-schemas'}
                onToggleVisibility={handleToggleVisibility}
                onPublish={handlePublish}
              />
            ))}
          </div>

          {meta.current_page < meta.last_page && (
            <div className="flex justify-center mt-8">
              <button onClick={() => fetchCards(meta.current_page + 1, false)} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 text-sm font-medium
                           text-gray-500 rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50
                           transition-all disabled:opacity-40">
                {loading && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>}
                Load more · {meta.total - cards.length} remaining
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {detail && (
        <SchemaDetailModal
          card={detail}
          onClose={() => setDetail(null)}
          onStar={handleStarSync}
          onLike={handleLikeSync}
          onFork={handleFork}
          user={user}
          isOwner={detailIsOwner}
        />
      )}

      {/* Global toast */}
      <Toast toast={toast}/>
    </div>
  )
}
