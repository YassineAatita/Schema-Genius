import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, FolderKanban, Globe, Sparkles,
  BarChart2, ArrowLeft, ShieldCheck, TrendingUp, ChevronRight,
  AlertCircle, Star, Heart, GitFork, MessageSquare, Activity,
  UserCheck, UserX, Lock, Zap, CheckCircle, Search, Filter,
  Trash2, ShieldAlert, ShieldOff, ChevronLeft, RefreshCw,
  MoreVertical, FolderOpen, EyeOff, Trophy, Calendar, Eye,
  Menu, X,
} from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'

// ── Sidebar nav item ──────────────────────────────────────────────
function AdminNavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all cursor-pointer
                  ${active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                    : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'}`}>
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-60"/>}
    </button>
  )
}

// ── Colour palette for stat cards ────────────────────────────────
const CARD_COLORS = {
  indigo:  { ring: 'ring-indigo-500/20',  bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  val: 'text-indigo-300'  },
  emerald: { ring: 'ring-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400', val: 'text-emerald-300' },
  amber:   { ring: 'ring-amber-500/20',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   val: 'text-amber-300'   },
  rose:    { ring: 'ring-rose-500/20',    bg: 'bg-rose-500/10',    text: 'text-rose-400',    val: 'text-rose-300'    },
  blue:    { ring: 'ring-blue-500/20',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    val: 'text-blue-300'    },
  violet:  { ring: 'ring-violet-500/20',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  val: 'text-violet-300'  },
  cyan:    { ring: 'ring-cyan-500/20',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    val: 'text-cyan-300'    },
  pink:    { ring: 'ring-pink-500/20',    bg: 'bg-pink-500/10',    text: 'text-pink-400',    val: 'text-pink-300'    },
}

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = 'indigo', trend }) {
  const c = CARD_COLORS[color] || CARD_COLORS.indigo
  return (
    <div className={`bg-white/5 border border-white/8 rounded-2xl p-4 ring-1 ${c.ring} flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`w-8 h-8 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className={`w-4 h-4 ${c.text}`}>{icon}</span>
        </div>
        {sub && (
          <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{sub}</span>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold ${c.val}`}>
          {value != null ? value.toLocaleString() : <span className="text-gray-600 text-base">—</span>}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
      </div>
      {trend != null && (
        <p className={`text-[11px] font-medium flex items-center gap-1
                       ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-gray-600'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}
          {trend > 0 ? `+${trend}` : trend} this week
        </p>
      )}
    </div>
  )
}

// ── Sparkline (14-day mini bar chart) ─────────────────────────────
function Sparkline({ data = [], color = '#6366f1', label = '' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const H = 36, W = 160, barW = Math.floor(W / data.length) - 1
  return (
    <div>
      {label && <p className="text-[10px] text-gray-600 mb-1.5 font-medium uppercase tracking-wider">{label}</p>}
      <svg width={W} height={H} className="overflow-visible">
        {data.map((v, i) => {
          const h = Math.max(2, Math.round((v / max) * H))
          return (
            <rect
              key={i}
              x={i * (barW + 1)}
              y={H - h}
              width={barW}
              height={h}
              rx={1}
              fill={color}
              opacity={v === 0 ? 0.15 : 0.7}
            />
          )
        })}
      </svg>
      <p className="text-[10px] text-gray-600 mt-1">Last 14 days</p>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
      <span className="w-4 border-t border-white/10 flex-1"/>
      {children}
      <span className="flex-1 border-t border-white/10"/>
    </p>
  )
}

// ── Placeholder panel ─────────────────────────────────────────────
function PlaceholderPanel({ icon, title, description }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-8">
      <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center
                      justify-center text-gray-500 mb-5">
        {icon}
      </div>
      <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-indigo-400
                       bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full font-medium">
        <AlertCircle className="w-3 h-3"/>
        Coming in the next sub-task
      </span>
    </div>
  )
}

// ── Overview section ──────────────────────────────────────────────
function OverviewSection() {
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.get('/admin/overview')
      .then(r => setStats(r.data))
      .catch(() => setError('Failed to load overview stats.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-6">
      {[0,1,2,3].map(g => (
        <div key={g}>
          <div className="h-3 bg-white/5 rounded w-24 mb-3 animate-pulse"/>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-4 h-28 animate-pulse"/>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
      <AlertCircle className="w-8 h-8 text-rose-400"/>
      <p className="text-rose-400 text-sm font-medium">{error}</p>
      <button onClick={() => window.location.reload()}
        className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
    </div>
  )

  const u = stats.users
  const p = stats.projects
  const ai = stats.ai
  const e = stats.engagement
  const t = stats.trends

  return (
    <div className="space-y-8 pb-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">Live stats across all platform activity</p>
        </div>
        <span className="text-[11px] text-gray-600 bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
          Updated just now
        </span>
      </div>

      {/* ── Users ── */}
      <div>
        <SectionLabel>Users</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total registered"  value={u.total}     icon={<Users className="w-4 h-4"/>}     color="indigo"  />
          <StatCard label="Active accounts"   value={u.active}    icon={<UserCheck className="w-4 h-4"/>}  color="emerald" sub="active"   />
          <StatCard label="Suspended"         value={u.suspended} icon={<UserX className="w-4 h-4"/>}      color="rose"    sub="blocked"  />
          <StatCard label="New this month"    value={u.new_month} icon={<TrendingUp className="w-4 h-4"/>} color="blue"    sub="30 days"  trend={u.new_week} />
        </div>
      </div>

      {/* ── Projects ── */}
      <div>
        <SectionLabel>Projects</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total projects"      value={p.total}        icon={<FolderKanban className="w-4 h-4"/>} color="indigo"  />
          <StatCard label="Public schemas"      value={p.public}       icon={<Globe className="w-4 h-4"/>}        color="emerald" sub="public"   />
          <StatCard label="Private schemas"     value={p.private}      icon={<Lock className="w-4 h-4"/>}         color="amber"   sub="private"  />
          <StatCard label="Active this week"    value={p.active_week}  icon={<Activity className="w-4 h-4"/>}     color="cyan"    sub="7 days"   trend={p.new_week} />
        </div>
      </div>

      {/* ── AI Usage ── */}
      <div>
        <SectionLabel>AI Generation</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Total generations"   value={ai.total}   icon={<Sparkles className="w-4 h-4"/>}     color="violet"  />
          <StatCard label="Applied to canvas"   value={ai.applied} icon={<CheckCircle className="w-4 h-4"/>}  color="emerald" sub="applied"  />
          <StatCard label="Generated this week" value={ai.week}    icon={<Zap className="w-4 h-4"/>}          color="amber"   sub="7 days"   trend={ai.week} />
        </div>
      </div>

      {/* ── Engagement ── */}
      <div>
        <SectionLabel>Community Engagement</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total stars"    value={e.stars}    icon={<Star className="w-4 h-4"/>}          color="amber"   />
          <StatCard label="Total likes"    value={e.likes}    icon={<Heart className="w-4 h-4"/>}         color="pink"    />
          <StatCard label="Total forks"    value={e.forks}    icon={<GitFork className="w-4 h-4"/>}       color="violet"  />
          <StatCard label="Total comments" value={e.comments} icon={<MessageSquare className="w-4 h-4"/>} color="blue"    />
        </div>
      </div>

      {/* ── Trend sparklines ── */}
      <div>
        <SectionLabel>14-Day Trends</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Registrations sparkline */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">New Registrations</p>
                <p className="text-xs text-gray-500 mt-0.5">{u.new_week} this week</p>
              </div>
              <Users className="w-4 h-4 text-indigo-400"/>
            </div>
            <Sparkline data={t.registrations_14d} color="#6366f1"/>
          </div>

          {/* AI generations sparkline */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">AI Generations</p>
                <p className="text-xs text-gray-500 mt-0.5">{ai.week} this week</p>
              </div>
              <Sparkles className="w-4 h-4 text-violet-400"/>
            </div>
            <Sparkline data={t.ai_14d} color="#8b5cf6"/>
          </div>

        </div>
      </div>

    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────
function RoleBadge({ roles = [] }) {
  const name = roles[0]?.name ?? 'developer'
  if (name === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                       bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
        <ShieldCheck className="w-2.5 h-2.5"/> admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                     bg-white/8 text-gray-400 border border-white/12">
      developer
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────
function StatusBadge({ active }) {
  return active
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                        bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/> active
      </span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                        bg-rose-500/15 text-rose-300 border border-rose-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block"/> suspended
      </span>
}

// ── Confirm delete modal ──────────────────────────────────────────
function DeleteConfirmModal({ user, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-[#13151f] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-400"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Delete User Account</h3>
            <p className="text-xs text-gray-500 mt-0.5">This action is permanent and cannot be undone.</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-xl p-3 mb-5">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Deleting this account will permanently remove the user's profile, projects, and all associated data.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/8 text-gray-300
                       hover:bg-white/12 transition-colors border border-white/8 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white
                       hover:bg-rose-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row action menu ───────────────────────────────────────────────
function RowMenu({ user, currentAdmin, onToggle, onRoleChange, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isSelf = user.id === currentAdmin?.id
  const isAdmin = user.roles?.some(r => r.name === 'admin')

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (isSelf) return <span className="text-[10px] text-gray-600 px-2">—</span>

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-colors">
        <MoreVertical className="w-3.5 h-3.5"/>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-52 bg-[#13151f] border border-white/12 rounded-xl
                        shadow-2xl py-1.5 text-sm overflow-hidden">
          {/* Toggle active */}
          <button
            onClick={() => { setOpen(false); onToggle(user) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium
                        transition-colors hover:bg-white/6
                        ${user.is_active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}>
            {user.is_active
              ? <><UserX className="w-3.5 h-3.5"/> Suspend account</>
              : <><UserCheck className="w-3.5 h-3.5"/> Reactivate account</>
            }
          </button>
          {/* Toggle role */}
          <button
            onClick={() => { setOpen(false); onRoleChange(user, isAdmin ? 'developer' : 'admin') }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium
                       text-indigo-400 hover:text-indigo-300 hover:bg-white/6 transition-colors">
            {isAdmin
              ? <><ShieldOff className="w-3.5 h-3.5"/> Remove admin role</>
              : <><ShieldAlert className="w-3.5 h-3.5"/> Promote to admin</>
            }
          </button>
          {/* Divider */}
          <div className="mx-3 my-1.5 border-t border-white/8"/>
          {/* Delete */}
          <button
            onClick={() => { setOpen(false); onDelete(user) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium
                       text-rose-400 hover:text-rose-300 hover:bg-rose-500/8 transition-colors">
            <Trash2 className="w-3.5 h-3.5"/> Delete account
          </button>
        </div>
      )}
    </div>
  )
}

// ── Users section ─────────────────────────────────────────────────
function UsersSection() {
  const { user: currentAdmin } = useAuthStore()

  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')
  const [statusFilter,setStatusFilter]= useState('')   // '' | 'active' | 'suspended'
  const [roleFilter,  setRoleFilter]  = useState('')   // '' | 'admin' | 'developer'
  const [page,        setPage]        = useState(1)
  const [actionError, setActionError] = useState('')
  const [deleteTarget,setDeleteTarget]= useState(null) // user to confirm delete
  const [deleting,    setDeleting]    = useState(false)
  const [toastMsg,    setToastMsg]    = useState('')

  const searchTimeout = useRef(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const fetchUsers = useCallback((pg = 1, q = search, status = statusFilter, role = roleFilter) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: pg })
    if (q)      params.set('q',      q)
    if (status) params.set('status', status)
    if (role)   params.set('role',   role)
    api.get(`/admin/users?${params}`)
      .then(r => { setData(r.data); setPage(pg) })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }, [search, statusFilter, roleFilter])

  useEffect(() => { fetchUsers(1) }, [])   // initial load

  // Debounced search
  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchUsers(1, val, statusFilter, roleFilter), 400)
  }

  const handleStatusFilter = (val) => {
    setStatusFilter(val)
    fetchUsers(1, search, val, roleFilter)
  }

  const handleRoleFilter = (val) => {
    setRoleFilter(val)
    fetchUsers(1, search, statusFilter, val)
  }

  // ── Toggle active ──
  const handleToggle = async (user) => {
    setActionError('')
    try {
      const res = await api.put(`/admin/users/${user.id}/toggle-active`)
      setData(prev => ({
        ...prev,
        data: prev.data.map(u => u.id === user.id ? { ...u, is_active: res.data.is_active } : u),
      }))
      showToast(res.data.message)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Action failed.')
    }
  }

  // ── Change role ──
  const handleRoleChange = async (user, newRole) => {
    setActionError('')
    try {
      const res = await api.put(`/admin/users/${user.id}/role`, { role: newRole })
      setData(prev => ({
        ...prev,
        data: prev.data.map(u => u.id === user.id
          ? { ...u, roles: res.data.roles.map(name => ({ name })) }
          : u
        ),
      }))
      showToast(res.data.message)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Action failed.')
    }
  }

  // ── Delete ──
  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`)
      setData(prev => ({
        ...prev,
        total: prev.total - 1,
        data: prev.data.filter(u => u.id !== deleteTarget.id),
      }))
      showToast('User account deleted.')
      setDeleteTarget(null)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Delete failed.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const users = data?.data ?? []
  const meta  = data ? {
    total:        data.total,
    from:         data.from,
    to:           data.to,
    currentPage:  data.current_page,
    lastPage:     data.last_page,
  } : null

  return (
    <div className="flex flex-col gap-5 pb-4 h-full">

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d2e] border border-indigo-500/30 text-indigo-300
                        text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/>
          {toastMsg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">User Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {meta ? `${meta.total.toLocaleString()} users total` : 'Browse, search and manage all platform users'}
          </p>
        </div>
        <button
          onClick={() => fetchUsers(page)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 bg-white/5
                     border border-white/8 px-3 py-1.5 rounded-xl transition-colors">
          <RefreshCw className="w-3 h-3"/> Refresh
        </button>
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none"/>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200
                       placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1
                       focus:ring-indigo-500/30 transition-colors"
          />
        </div>
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => handleStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-gray-300
                     focus:outline-none focus:border-indigo-500/50 cursor-pointer">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={e => handleRoleFilter(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-gray-300
                     focus:outline-none focus:border-indigo-500/50 cursor-pointer">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
        </select>
      </div>

      {/* ── Action error banner ── */}
      {actionError && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300
                        text-xs font-medium px-4 py-2.5 rounded-xl flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/>
          {actionError}
          <button onClick={() => setActionError('')} className="ml-auto text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white/3 border border-white/8 rounded-2xl">

        {/* Table header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_2.5rem] gap-3 px-4 py-2.5 border-b border-white/8
                        text-[10px] font-bold text-gray-600 uppercase tracking-widest flex-shrink-0">
          <span>User</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Projects</span>
          <span/>
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_2.5rem] gap-3 px-4 py-3 items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/8 animate-pulse flex-shrink-0"/>
                  <div className="h-3 bg-white/8 rounded w-24 animate-pulse"/>
                </div>
                <div className="h-3 bg-white/8 rounded w-32 animate-pulse"/>
                <div className="h-4 bg-white/8 rounded-full w-16 animate-pulse"/>
                <div className="h-4 bg-white/8 rounded-full w-14 animate-pulse"/>
                <div className="h-3 bg-white/8 rounded w-8 animate-pulse"/>
                <div className="w-6 h-6 bg-white/8 rounded animate-pulse"/>
              </div>
            ))
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-7 h-7 text-rose-400"/>
              <p className="text-sm text-rose-400 font-medium">{error}</p>
              <button onClick={() => fetchUsers(page)} className="text-xs text-gray-500 hover:text-gray-300 underline">
                Retry
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Users className="w-7 h-7 text-gray-600"/>
              <p className="text-sm text-gray-500">No users found</p>
              {(search || statusFilter || roleFilter) && (
                <button
                  onClick={() => { setSearch(''); setStatusFilter(''); setRoleFilter(''); fetchUsers(1, '', '', '') }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-1">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            users.map(u => (
              <div
                key={u.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_2.5rem] gap-3 px-4 py-2.5 items-center
                           hover:bg-white/3 transition-colors group">
                {/* Avatar + name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-600/20 ring-1 ring-indigo-500/20 flex items-center
                                  justify-center flex-shrink-0 overflow-hidden">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover"/>
                      : <span className="text-[10px] font-bold text-indigo-400">{(u.name || '?')[0].toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-200 truncate leading-tight">{u.name}</p>
                    <p className="text-[10px] text-gray-600 leading-tight">
                      joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {/* Email */}
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                {/* Role */}
                <div><RoleBadge roles={u.roles}/></div>
                {/* Status */}
                <div><StatusBadge active={u.is_active}/></div>
                {/* Projects count */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <FolderOpen className="w-3 h-3"/>
                  {u.projects_count ?? 0}
                </div>
                {/* Actions */}
                <RowMenu
                  user={u}
                  currentAdmin={currentAdmin}
                  onToggle={handleToggle}
                  onRoleChange={handleRoleChange}
                  onDelete={setDeleteTarget}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Pagination ── */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between flex-shrink-0 pt-1">
          <p className="text-[11px] text-gray-600">
            Showing {meta.from}–{meta.to} of {meta.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={meta.currentPage <= 1 || loading}
              onClick={() => fetchUsers(meta.currentPage - 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                         text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors">
              <ChevronLeft className="w-3 h-3"/> Prev
            </button>
            {/* Page numbers */}
            {Array.from({ length: meta.lastPage }, (_, i) => i + 1)
              .filter(n => Math.abs(n - meta.currentPage) <= 2)
              .map(n => (
                <button
                  key={n}
                  onClick={() => fetchUsers(n)}
                  disabled={loading}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                              ${n === meta.currentPage
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/5 border border-white/8 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                  {n}
                </button>
              ))
            }
            <button
              disabled={meta.currentPage >= meta.lastPage || loading}
              onClick={() => fetchUsers(meta.currentPage + 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                         text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors">
              Next <ChevronRight className="w-3 h-3"/>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ── Projects Section ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────

// Visibility badge for projects
function VisibilityBadge({ visibility, featured }) {
  if (featured) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                       bg-amber-500/15 text-amber-300 border border-amber-500/25">
        <Trophy className="w-2.5 h-2.5"/> featured
      </span>
    )
  }
  if (visibility === 'public') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                       bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
        <Eye className="w-2.5 h-2.5"/> public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                     bg-white/8 text-gray-500 border border-white/12">
      <Lock className="w-2.5 h-2.5"/> private
    </span>
  )
}

// Mini stat pill
function MiniStat({ icon, count, color = 'text-gray-600' }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] ${color}`}>
      {icon}{count}
    </span>
  )
}

// Feature SOTW modal
function FeatureModal({ project, onConfirm, onCancel, loading }) {
  // Default week_of = THIS week's Monday (matching what ExploreController::featured() queries for).
  // Uses local date arithmetic (not toISOString) to avoid UTC timezone shift bugs.
  const thisMonday = () => {
    const d = new Date()
    const day = d.getDay()                       // 0=Sun, 1=Mon, …, 6=Sat
    const diff = day === 0 ? -6 : 1 - day        // Sun→-6, Mon→0, Tue→-1, Wed→-2, …
    d.setDate(d.getDate() + diff)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const [weekOf, setWeekOf] = useState(thisMonday)
  const [note,   setNote]   = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-[#13151f] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-amber-400"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Feature as Schema of the Week</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{project.name}</p>
          </div>
        </div>

        {/* Week picker */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
            Week of (Monday)
          </label>
          <input
            type="date"
            value={weekOf}
            onChange={e => setWeekOf(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200
                       focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30
                       transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Note */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
            Editor's Note <span className="text-gray-600 normal-case font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Why is this schema notable…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200
                       placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1
                       focus:ring-indigo-500/30 transition-colors resize-none"
          />
          <p className="text-[10px] text-gray-600 text-right mt-0.5">{note.length}/500</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/8 text-gray-300
                       hover:bg-white/12 transition-colors border border-white/8 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(weekOf, note)}
            disabled={loading || !weekOf}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-black
                       hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
            {loading ? 'Featuring…' : 'Feature it'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Delete project confirm modal
function DeleteProjectModal({ project, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-[#13151f] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-400"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Delete Project</h3>
            <p className="text-xs text-gray-500 mt-0.5">This cannot be undone.</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-white truncate">{project.name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Owner: {project.owner?.name ?? '—'}</p>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          All schemas, versions, stars, likes, forks, and comments attached to this project will be permanently erased.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/8 text-gray-300
                       hover:bg-white/12 transition-colors border border-white/8 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white
                       hover:bg-rose-500 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Project row action menu
function ProjectRowMenu({ project, onForcePrivate, onFeature, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isPublic = project.visibility === 'public'

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/8 transition-colors">
        <MoreVertical className="w-3.5 h-3.5"/>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-52 bg-[#13151f] border border-white/12 rounded-xl
                        shadow-2xl py-1.5 overflow-hidden">
          {/* Feature as SOTW — only for public */}
          <button
            onClick={() => { setOpen(false); onFeature(project) }}
            disabled={!isPublic}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium
                        transition-colors
                        ${isPublic
                          ? 'text-amber-400 hover:text-amber-300 hover:bg-white/6'
                          : 'text-gray-700 cursor-not-allowed'}`}>
            <Trophy className="w-3.5 h-3.5"/> Feature as SOTW
            {!isPublic && <span className="ml-auto text-[9px] text-gray-700">public only</span>}
          </button>
          {/* Force private — only for public */}
          <button
            onClick={() => { setOpen(false); onForcePrivate(project) }}
            disabled={!isPublic}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium
                        transition-colors
                        ${isPublic
                          ? 'text-sky-400 hover:text-sky-300 hover:bg-white/6'
                          : 'text-gray-700 cursor-not-allowed'}`}>
            <EyeOff className="w-3.5 h-3.5"/> Force private
            {!isPublic && <span className="ml-auto text-[9px] text-gray-700">already private</span>}
          </button>
          {/* Divider */}
          <div className="mx-3 my-1.5 border-t border-white/8"/>
          {/* Delete */}
          <button
            onClick={() => { setOpen(false); onDelete(project) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium
                       text-rose-400 hover:text-rose-300 hover:bg-rose-500/8 transition-colors">
            <Trash2 className="w-3.5 h-3.5"/> Delete project
          </button>
        </div>
      )}
    </div>
  )
}

// ── Projects section ──────────────────────────────────────────────
function ProjectsSection() {
  const [data,           setData]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [search,         setSearch]         = useState('')
  const [visFilter,      setVisFilter]      = useState('')
  const [page,           setPage]           = useState(1)
  const [actionError,    setActionError]    = useState('')
  const [toastMsg,       setToastMsg]       = useState('')
  const [featureTarget,  setFeatureTarget]  = useState(null)   // project to feature
  const [featureLoading, setFeatureLoading] = useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState(null)   // project to delete
  const [deleteLoading,  setDeleteLoading]  = useState(false)
  const [forceLoading,   setForceLoading]   = useState(null)   // id being forced private

  const searchTimeout = useRef(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const fetchProjects = useCallback((pg = 1, q = search, vis = visFilter) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: pg })
    if (q)   params.set('q',          q)
    if (vis) params.set('visibility', vis)
    api.get(`/admin/projects?${params}`)
      .then(r => { setData(r.data); setPage(pg) })
      .catch(() => setError('Failed to load projects.'))
      .finally(() => setLoading(false))
  }, [search, visFilter])

  useEffect(() => { fetchProjects(1) }, [])

  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchProjects(1, val, visFilter), 400)
  }

  const handleVisFilter = (val) => {
    setVisFilter(val)
    fetchProjects(1, search, val)
  }

  // ── Force private ──
  const handleForcePrivate = async (project) => {
    setForceLoading(project.id)
    setActionError('')
    try {
      await api.put(`/admin/projects/${project.id}/force-private`)
      setData(prev => ({
        ...prev,
        data: prev.data.map(p => p.id === project.id ? { ...p, visibility: 'private' } : p),
      }))
      showToast(`"${project.name}" is now private.`)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Action failed.')
    } finally {
      setForceLoading(null)
    }
  }

  // ── Feature project ──
  const handleFeatureConfirm = async (weekOf, note) => {
    setFeatureLoading(true)
    setActionError('')
    try {
      await api.post(`/admin/projects/${featureTarget.id}/feature`, { week_of: weekOf, note: note || null })
      showToast(`"${featureTarget.name}" featured as Schema of the Week!`)
      setFeatureTarget(null)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Feature action failed.')
      setFeatureTarget(null)
    } finally {
      setFeatureLoading(false)
    }
  }

  // ── Delete project ──
  const handleDeleteConfirm = async () => {
    setDeleteLoading(true)
    setActionError('')
    try {
      await api.delete(`/admin/projects/${deleteTarget.id}`)
      setData(prev => ({
        ...prev,
        total: prev.total - 1,
        data: prev.data.filter(p => p.id !== deleteTarget.id),
      }))
      showToast('Project permanently deleted.')
      setDeleteTarget(null)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Delete failed.')
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const projects = data?.data ?? []
  const meta = data ? {
    total: data.total, from: data.from, to: data.to,
    currentPage: data.current_page, lastPage: data.last_page,
  } : null

  return (
    <div className="flex flex-col gap-5 pb-4 h-full">

      {/* Feature modal */}
      {featureTarget && (
        <FeatureModal
          project={featureTarget}
          onConfirm={handleFeatureConfirm}
          onCancel={() => setFeatureTarget(null)}
          loading={featureLoading}
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteProjectModal
          project={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d2e] border border-indigo-500/30 text-indigo-300
                        text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/>
          {toastMsg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">Project Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {meta ? `${meta.total.toLocaleString()} projects total` : 'Browse, moderate and manage all platform projects'}
          </p>
        </div>
        <button
          onClick={() => fetchProjects(page)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 bg-white/5
                     border border-white/8 px-3 py-1.5 rounded-xl transition-colors">
          <RefreshCw className="w-3 h-3"/> Refresh
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none"/>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search project or owner name…"
            className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200
                       placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1
                       focus:ring-indigo-500/30 transition-colors"
          />
        </div>
        <select
          value={visFilter}
          onChange={e => handleVisFilter(e.target.value)}
          className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-gray-300
                     focus:outline-none focus:border-indigo-500/50 cursor-pointer">
          <option value="">All visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>

      {/* ── Action error ── */}
      {actionError && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300
                        text-xs font-medium px-4 py-2.5 rounded-xl flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/>
          {actionError}
          <button onClick={() => setActionError('')} className="ml-auto text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white/3 border border-white/8 rounded-2xl">
        {/* Header row */}
        <div className="grid grid-cols-[3fr_2fr_1fr_auto_auto_2.5rem] gap-3 px-4 py-2.5 border-b border-white/8
                        text-[10px] font-bold text-gray-600 uppercase tracking-widest flex-shrink-0">
          <span>Project</span>
          <span>Owner</span>
          <span>Visibility</span>
          <span>Stats</span>
          <span>Created</span>
          <span/>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[3fr_2fr_1fr_auto_auto_2.5rem] gap-3 px-4 py-3 items-center">
                <div className="flex flex-col gap-1">
                  <div className="h-3 bg-white/8 rounded w-36 animate-pulse"/>
                  <div className="h-2.5 bg-white/5 rounded w-52 animate-pulse"/>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/8 animate-pulse flex-shrink-0"/>
                  <div className="h-3 bg-white/8 rounded w-20 animate-pulse"/>
                </div>
                <div className="h-4 bg-white/8 rounded-full w-14 animate-pulse"/>
                <div className="flex gap-2">
                  {[0,1,2].map(j => <div key={j} className="h-3 bg-white/8 rounded w-8 animate-pulse"/>)}
                </div>
                <div className="h-3 bg-white/8 rounded w-16 animate-pulse"/>
                <div className="w-6 h-6 bg-white/8 rounded animate-pulse"/>
              </div>
            ))
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-7 h-7 text-rose-400"/>
              <p className="text-sm text-rose-400 font-medium">{error}</p>
              <button onClick={() => fetchProjects(page)} className="text-xs text-gray-500 hover:text-gray-300 underline">
                Retry
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FolderKanban className="w-7 h-7 text-gray-600"/>
              <p className="text-sm text-gray-500">No projects found</p>
              {(search || visFilter) && (
                <button
                  onClick={() => { setSearch(''); setVisFilter(''); fetchProjects(1, '', '') }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-1">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            projects.map(p => (
              <div
                key={p.id}
                className="grid grid-cols-[3fr_2fr_1fr_auto_auto_2.5rem] gap-3 px-4 py-2.5 items-center
                           hover:bg-white/3 transition-colors">
                {/* Name + description */}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-200 truncate leading-tight">{p.name}</p>
                  {p.description && (
                    <p className="text-[10px] text-gray-600 truncate mt-0.5 leading-tight">{p.description}</p>
                  )}
                </div>
                {/* Owner */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/20 ring-1 ring-indigo-500/20 flex items-center
                                  justify-center flex-shrink-0 overflow-hidden">
                    {p.owner?.avatar_url
                      ? <img src={p.owner.avatar_url} alt="" className="w-full h-full object-cover"/>
                      : <span className="text-[9px] font-bold text-indigo-400">
                          {(p.owner?.name || '?')[0].toUpperCase()}
                        </span>
                    }
                  </div>
                  <span className="text-xs text-gray-400 truncate">{p.owner?.name ?? '—'}</span>
                </div>
                {/* Visibility */}
                <div>
                  <VisibilityBadge
                    visibility={p.visibility}
                    featured={!!p.featured_schema}
                  />
                </div>
                {/* Stats */}
                <div className="flex items-center gap-2.5">
                  <MiniStat icon={<Star className="w-3 h-3"/>}    count={p.stars_count}    color="text-amber-600"/>
                  <MiniStat icon={<Heart className="w-3 h-3"/>}   count={p.likes_count}    color="text-pink-600"/>
                  <MiniStat icon={<GitFork className="w-3 h-3"/>} count={p.forks_count}    color="text-violet-600"/>
                  <MiniStat icon={<MessageSquare className="w-3 h-3"/>} count={p.comments_count} color="text-blue-600"/>
                </div>
                {/* Created */}
                <p className="text-[10px] text-gray-600 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {/* Actions */}
                <div className="relative">
                  {forceLoading === p.id
                    ? <RefreshCw className="w-3.5 h-3.5 text-gray-600 animate-spin mx-auto"/>
                    : <ProjectRowMenu
                        project={p}
                        onForcePrivate={handleForcePrivate}
                        onFeature={setFeatureTarget}
                        onDelete={setDeleteTarget}
                      />
                  }
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Pagination ── */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between flex-shrink-0 pt-1">
          <p className="text-[11px] text-gray-600">
            Showing {meta.from}–{meta.to} of {meta.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={meta.currentPage <= 1 || loading}
              onClick={() => fetchProjects(meta.currentPage - 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                         text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors">
              <ChevronLeft className="w-3 h-3"/> Prev
            </button>
            {Array.from({ length: meta.lastPage }, (_, i) => i + 1)
              .filter(n => Math.abs(n - meta.currentPage) <= 2)
              .map(n => (
                <button
                  key={n}
                  onClick={() => fetchProjects(n)}
                  disabled={loading}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                              ${n === meta.currentPage
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/5 border border-white/8 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                  {n}
                </button>
              ))
            }
            <button
              disabled={meta.currentPage >= meta.lastPage || loading}
              onClick={() => fetchProjects(meta.currentPage + 1)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                         text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors">
              Next <ChevronRight className="w-3 h-3"/>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ── Community Section ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────

// Delete comment confirm modal
function DeleteCommentModal({ comment, onConfirm, onCancel, loading }) {
  const preview = comment.content.length > 120
    ? comment.content.slice(0, 120) + '…'
    : comment.content
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}/>
      <div className="relative bg-[#13151f] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-rose-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-rose-400"/>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Delete Comment</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              By <span className="text-gray-300">{comment.author?.name ?? '—'}</span>
            </p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/8 rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-400 leading-relaxed italic">"{preview}"</p>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          Any replies to this comment will also be deleted (cascade).
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-white/8 text-gray-300
                       hover:bg-white/12 transition-colors border border-white/8 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white
                       hover:bg-rose-500 transition-colors disabled:opacity-60
                       flex items-center justify-center gap-2">
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Single ranked project row for leaderboard
function LeaderboardRow({ rank, project, metricKey, metricLabel, color }) {
  const count = project[metricKey] ?? 0
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/4 transition-colors">
      <span className="text-sm w-5 flex-shrink-0 text-center">
        {rank <= 3 ? medals[rank - 1] : (
          <span className="text-[11px] font-bold text-gray-600">{rank}</span>
        )}
      </span>
      <div className="w-6 h-6 rounded-full bg-indigo-600/20 ring-1 ring-indigo-500/20 flex items-center
                      justify-center flex-shrink-0 overflow-hidden">
        {project.owner?.avatar_url
          ? <img src={project.owner.avatar_url} alt="" className="w-full h-full object-cover"/>
          : <span className="text-[9px] font-bold text-indigo-400">
              {(project.owner?.name || '?')[0].toUpperCase()}
            </span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-200 truncate leading-tight">{project.name}</p>
        <p className="text-[10px] text-gray-600 truncate">{project.owner?.name ?? '—'}</p>
      </div>
      <span className={`text-xs font-bold ${color} flex-shrink-0`}>{count.toLocaleString()}</span>
    </div>
  )
}

// Leaderboard column card
function LeaderboardCard({ title, icon, projects = [], metricKey, metricLabel, color, loading }) {
  return (
    <div className="flex-1 bg-white/3 border border-white/8 rounded-2xl flex flex-col overflow-hidden min-w-0">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2 flex-shrink-0">
        <span className={color}>{icon}</span>
        <p className="text-xs font-bold text-white">{title}</p>
      </div>
      {/* Rows */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3">
              <div className="w-5 h-3 bg-white/8 rounded animate-pulse"/>
              <div className="w-6 h-6 rounded-full bg-white/8 animate-pulse flex-shrink-0"/>
              <div className="flex-1 space-y-1">
                <div className="h-2.5 bg-white/8 rounded w-3/4 animate-pulse"/>
                <div className="h-2 bg-white/5 rounded w-1/2 animate-pulse"/>
              </div>
              <div className="w-8 h-3 bg-white/8 rounded animate-pulse"/>
            </div>
          ))
        ) : projects.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-gray-600">No data yet</div>
        ) : (
          projects.map((p, i) => (
            <LeaderboardRow
              key={p.id}
              rank={i + 1}
              project={p}
              metricKey={metricKey}
              metricLabel={metricLabel}
              color={color}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Community section ─────────────────────────────────────────────
function CommunitySection() {
  const [activeTab,      setActiveTab]      = useState('comments')  // 'comments' | 'leaderboard'

  // ── Comments state ──
  const [commentsData,   setCommentsData]   = useState(null)
  const [commentsLoad,   setCommentsLoad]   = useState(true)
  const [commentsError,  setCommentsError]  = useState('')
  const [search,         setSearch]         = useState('')
  const [typeFilter,     setTypeFilter]     = useState('')           // '' | 'top-level' | 'replies'
  const [page,           setPage]           = useState(1)
  const [deleteTarget,   setDeleteTarget]   = useState(null)
  const [deleteLoading,  setDeleteLoading]  = useState(false)
  const [actionError,    setActionError]    = useState('')
  const [toastMsg,       setToastMsg]       = useState('')

  // ── Leaderboard state ──
  const [topData,        setTopData]        = useState(null)
  const [topLoad,        setTopLoad]        = useState(false)
  const [topError,       setTopError]       = useState('')

  const searchTimeout = useRef(null)

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // ── Fetch comments ──
  const fetchComments = useCallback((pg = 1, q = search, type = typeFilter) => {
    setCommentsLoad(true)
    setCommentsError('')
    const params = new URLSearchParams({ page: pg })
    if (q)    params.set('q',    q)
    if (type) params.set('type', type)
    api.get(`/admin/community/comments?${params}`)
      .then(r => { setCommentsData(r.data); setPage(pg) })
      .catch(() => setCommentsError('Failed to load comments.'))
      .finally(() => setCommentsLoad(false))
  }, [search, typeFilter])

  // ── Fetch leaderboard ──
  const fetchTop = useCallback(() => {
    setTopLoad(true)
    setTopError('')
    api.get('/admin/community/top-projects')
      .then(r => setTopData(r.data))
      .catch(() => setTopError('Failed to load leaderboard.'))
      .finally(() => setTopLoad(false))
  }, [])

  // Load comments on mount; lazy-load leaderboard on tab switch
  useEffect(() => { fetchComments(1) }, [])
  useEffect(() => {
    if (activeTab === 'leaderboard' && !topData && !topLoad) fetchTop()
  }, [activeTab])

  const handleSearch = (val) => {
    setSearch(val)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchComments(1, val, typeFilter), 400)
  }

  const handleTypeFilter = (val) => {
    setTypeFilter(val)
    fetchComments(1, search, val)
  }

  // ── Delete comment ──
  const handleDeleteConfirm = async () => {
    setDeleteLoading(true)
    setActionError('')
    try {
      await api.delete(`/admin/community/comments/${deleteTarget.id}`)
      setCommentsData(prev => ({
        ...prev,
        total: prev.total - 1,
        data:  prev.data.filter(c => c.id !== deleteTarget.id),
      }))
      showToast('Comment deleted.')
      setDeleteTarget(null)
    } catch (e) {
      setActionError(e.response?.data?.error || 'Delete failed.')
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const comments = commentsData?.data ?? []
  const meta = commentsData ? {
    total: commentsData.total, from: commentsData.from, to: commentsData.to,
    currentPage: commentsData.current_page, lastPage: commentsData.last_page,
  } : null

  return (
    <div className="flex flex-col gap-5 pb-4 h-full">

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteCommentModal
          comment={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d2e] border border-indigo-500/30 text-indigo-300
                        text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/>
          {toastMsg}
        </div>
      )}

      {/* ── Header + tabs ── */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white">Community Moderation</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeTab === 'comments'
              ? (meta ? `${meta.total.toLocaleString()} comments total` : 'Moderate public comments')
              : 'Most-engaged public schemas'}
          </p>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
          {[
            { id: 'comments',     label: 'Comments',    icon: <MessageSquare className="w-3.5 h-3.5"/> },
            { id: 'leaderboard',  label: 'Top Schemas', icon: <Trophy className="w-3.5 h-3.5"/> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          transition-colors
                          ${activeTab === t.id
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                            : 'text-gray-500 hover:text-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Action error ── */}
      {actionError && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300
                        text-xs font-medium px-4 py-2.5 rounded-xl flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/>
          {actionError}
          <button onClick={() => setActionError('')} className="ml-auto text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {/* ════════ COMMENTS TAB ════════ */}
      {activeTab === 'comments' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none"/>
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search comment content…"
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200
                           placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1
                           focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => handleTypeFilter(e.target.value)}
              className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-gray-300
                         focus:outline-none focus:border-indigo-500/50 cursor-pointer">
              <option value="">All comments</option>
              <option value="top-level">Top-level only</option>
              <option value="replies">Replies only</option>
            </select>
            <button
              onClick={() => fetchComments(page)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 bg-white/5
                         border border-white/8 px-3 py-1.5 rounded-xl transition-colors">
              <RefreshCw className="w-3 h-3"/> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white/3 border border-white/8 rounded-2xl">
            {/* Header */}
            <div className="grid grid-cols-[2fr_3fr_2fr_auto_2.5rem] gap-3 px-4 py-2.5 border-b border-white/8
                            text-[10px] font-bold text-gray-600 uppercase tracking-widest flex-shrink-0">
              <span>Author</span>
              <span>Content</span>
              <span>Project</span>
              <span>Date</span>
              <span/>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {commentsLoad ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[2fr_3fr_2fr_auto_2.5rem] gap-3 px-4 py-3 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/8 animate-pulse flex-shrink-0"/>
                      <div className="h-3 bg-white/8 rounded w-20 animate-pulse"/>
                    </div>
                    <div className="h-3 bg-white/8 rounded w-full animate-pulse"/>
                    <div className="h-3 bg-white/8 rounded w-24 animate-pulse"/>
                    <div className="h-3 bg-white/8 rounded w-14 animate-pulse"/>
                    <div className="w-6 h-6 bg-white/8 rounded animate-pulse"/>
                  </div>
                ))
              ) : commentsError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <AlertCircle className="w-7 h-7 text-rose-400"/>
                  <p className="text-sm text-rose-400 font-medium">{commentsError}</p>
                  <button onClick={() => fetchComments(page)}
                    className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <MessageSquare className="w-7 h-7 text-gray-600"/>
                  <p className="text-sm text-gray-500">No comments found</p>
                  {(search || typeFilter) && (
                    <button
                      onClick={() => { setSearch(''); setTypeFilter(''); fetchComments(1, '', '') }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline mt-1">
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                comments.map(c => (
                  <div
                    key={c.id}
                    className={`grid grid-cols-[2fr_3fr_2fr_auto_2.5rem] gap-3 px-4 py-2.5 items-start
                                hover:bg-white/3 transition-colors
                                ${c.parent_id ? 'border-l-2 border-indigo-500/20' : ''}`}>
                    {/* Author */}
                    <div className="flex items-center gap-2 min-w-0 pt-0.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/20 ring-1 ring-indigo-500/20
                                      flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {c.author?.avatar_url
                          ? <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover"/>
                          : <span className="text-[9px] font-bold text-indigo-400">
                              {(c.author?.name || '?')[0].toUpperCase()}
                            </span>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-300 truncate">{c.author?.name ?? '—'}</p>
                        {c.parent_id && (
                          <span className="text-[9px] text-indigo-400/70 font-medium">↳ reply</span>
                        )}
                      </div>
                    </div>
                    {/* Content */}
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 break-words">
                      {c.content}
                    </p>
                    {/* Project */}
                    <p className="text-xs text-gray-500 truncate pt-0.5">
                      {c.project?.name ?? <span className="text-gray-700 italic">deleted</span>}
                    </p>
                    {/* Date */}
                    <p className="text-[10px] text-gray-600 whitespace-nowrap pt-0.5">
                      {new Date(c.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="p-1.5 rounded-lg text-gray-700 hover:text-rose-400 hover:bg-rose-500/10
                                 transition-colors mt-0.5">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {meta && meta.lastPage > 1 && (
            <div className="flex items-center justify-between flex-shrink-0 pt-1">
              <p className="text-[11px] text-gray-600">
                Showing {meta.from}–{meta.to} of {meta.total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={meta.currentPage <= 1 || commentsLoad}
                  onClick={() => fetchComments(meta.currentPage - 1)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                             text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30
                             disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3 h-3"/> Prev
                </button>
                {Array.from({ length: meta.lastPage }, (_, i) => i + 1)
                  .filter(n => Math.abs(n - meta.currentPage) <= 2)
                  .map(n => (
                    <button
                      key={n}
                      onClick={() => fetchComments(n)}
                      disabled={commentsLoad}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                                  ${n === meta.currentPage
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white/5 border border-white/8 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                      {n}
                    </button>
                  ))
                }
                <button
                  disabled={meta.currentPage >= meta.lastPage || commentsLoad}
                  onClick={() => fetchComments(meta.currentPage + 1)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                             text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30
                             disabled:cursor-not-allowed transition-colors">
                  Next <ChevronRight className="w-3 h-3"/>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════ LEADERBOARD TAB ════════ */}
      {activeTab === 'leaderboard' && (
        <>
          {topError ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <AlertCircle className="w-7 h-7 text-rose-400"/>
              <p className="text-sm text-rose-400 font-medium">{topError}</p>
              <button onClick={fetchTop}
                className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
            </div>
          ) : (
            <div className="flex gap-4 flex-1 overflow-hidden">
              <LeaderboardCard
                title="Most Starred"
                icon={<Star className="w-4 h-4"/>}
                projects={topData?.top_starred ?? []}
                metricKey="stars_count"
                metricLabel="stars"
                color="text-amber-400"
                loading={topLoad}
              />
              <LeaderboardCard
                title="Most Liked"
                icon={<Heart className="w-4 h-4"/>}
                projects={topData?.top_liked ?? []}
                metricKey="likes_count"
                metricLabel="likes"
                color="text-pink-400"
                loading={topLoad}
              />
              <LeaderboardCard
                title="Most Forked"
                icon={<GitFork className="w-4 h-4"/>}
                projects={topData?.top_forked ?? []}
                metricKey="forks_count"
                metricLabel="forks"
                color="text-violet-400"
                loading={topLoad}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ── AI Usage Section ──────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────

// 30-day bar sparkline (wider than the overview one)
function AiSparkline({ data = [], color = '#8b5cf6' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const H = 48, barW = 6, gap = 2
  const W = data.length * (barW + gap) - gap
  return (
    <svg width={W} height={H} className="overflow-visible">
      {data.map((v, i) => {
        const h = Math.max(2, Math.round((v / max) * H))
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={H - h}
            width={barW}
            height={h}
            rx={1.5}
            fill={color}
            opacity={v === 0 ? 0.12 : 0.65}
          />
        )
      })}
    </svg>
  )
}

// Apply-rate ring (simple arc SVG)
function ApplyRateRing({ rate = 0 }) {
  const r = 22, cx = 28, cy = 28
  const circ = 2 * Math.PI * r
  const dash  = (rate / 100) * circ
  return (
    <svg width={56} height={56} className="flex-shrink-0">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5}/>
      {/* Fill */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        opacity={0.85}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight="700" fill="#c4b5fd">
        {rate}%
      </text>
    </svg>
  )
}

// ── AI Usage section ──────────────────────────────────────────────
function AiUsageSection() {
  const [activeTab,    setActiveTab]    = useState('users')   // 'users' | 'prompts'

  // ── Stats state ──
  const [stats,        setStats]        = useState(null)
  const [statsLoad,    setStatsLoad]    = useState(true)
  const [statsError,   setStatsError]   = useState('')

  // ── Per-user state ──
  const [usersData,    setUsersData]    = useState(null)
  const [usersLoad,    setUsersLoad]    = useState(true)
  const [usersError,   setUsersError]   = useState('')
  const [userSearch,   setUserSearch]   = useState('')
  const [usersPage,    setUsersPage]    = useState(1)

  // ── Prompts state ──
  const [promptsData,  setPromptsData]  = useState(null)
  const [promptsLoad,  setPromptsLoad]  = useState(false)
  const [promptsError, setPromptsError] = useState('')
  const [promptSearch, setPromptSearch] = useState('')
  const [appliedFilter,setAppliedFilter]= useState('')   // '' | '1' | '0'
  const [promptsPage,  setPromptsPage]  = useState(1)

  const userSearchRef   = useRef(null)
  const promptSearchRef = useRef(null)

  // ── Fetch stats ──
  useEffect(() => {
    api.get('/admin/ai/stats')
      .then(r => setStats(r.data))
      .catch(() => setStatsError('Failed to load AI stats.'))
      .finally(() => setStatsLoad(false))
  }, [])

  // ── Fetch per-user ──
  const fetchUsers = useCallback((pg = 1, q = userSearch) => {
    setUsersLoad(true)
    setUsersError('')
    const params = new URLSearchParams({ page: pg })
    if (q) params.set('q', q)
    api.get(`/admin/ai/users?${params}`)
      .then(r => { setUsersData(r.data); setUsersPage(pg) })
      .catch(() => setUsersError('Failed to load user AI stats.'))
      .finally(() => setUsersLoad(false))
  }, [userSearch])

  // ── Fetch prompts ──
  const fetchPrompts = useCallback((pg = 1, q = promptSearch, applied = appliedFilter) => {
    setPromptsLoad(true)
    setPromptsError('')
    const params = new URLSearchParams({ page: pg })
    if (q)       params.set('q',       q)
    if (applied) params.set('applied', applied)
    api.get(`/admin/ai/prompts?${params}`)
      .then(r => { setPromptsData(r.data); setPromptsPage(pg) })
      .catch(() => setPromptsError('Failed to load prompts.'))
      .finally(() => setPromptsLoad(false))
  }, [promptSearch, appliedFilter])

  // Initial loads
  useEffect(() => { fetchUsers(1) }, [])
  useEffect(() => {
    if (activeTab === 'prompts' && !promptsData && !promptsLoad) fetchPrompts(1)
  }, [activeTab])

  const handleUserSearch = (val) => {
    setUserSearch(val)
    clearTimeout(userSearchRef.current)
    userSearchRef.current = setTimeout(() => fetchUsers(1, val), 400)
  }

  const handlePromptSearch = (val) => {
    setPromptSearch(val)
    clearTimeout(promptSearchRef.current)
    promptSearchRef.current = setTimeout(() => fetchPrompts(1, val, appliedFilter), 400)
  }

  const handleAppliedFilter = (val) => {
    setAppliedFilter(val)
    fetchPrompts(1, promptSearch, val)
  }

  const usersMeta = usersData ? {
    total: usersData.total, from: usersData.from, to: usersData.to,
    currentPage: usersData.current_page, lastPage: usersData.last_page,
  } : null

  const promptsMeta = promptsData ? {
    total: promptsData.total, from: promptsData.from, to: promptsData.to,
    currentPage: promptsData.current_page, lastPage: promptsData.last_page,
  } : null

  return (
    <div className="flex flex-col gap-5 pb-4 h-full">

      {/* ── Summary stat cards ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">AI Usage Analytics</h2>
          <span className="text-[11px] text-gray-600 bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
            All-time statistics
          </span>
        </div>

        {statsError ? (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300
                          text-xs px-4 py-2.5 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/> {statsError}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Total */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 ring-1 ring-violet-500/20
                            flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 bg-violet-500/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-400"/>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-300">
                  {statsLoad ? <span className="text-gray-600 text-base">—</span> : (stats?.total ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Total generations</p>
              </div>
              <p className="text-[11px] text-violet-400 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3"/> {statsLoad ? '…' : stats?.week ?? 0} this week
              </p>
            </div>

            {/* Applied */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 ring-1 ring-emerald-500/20
                            flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-400"/>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-300">
                  {statsLoad ? <span className="text-gray-600 text-base">—</span> : (stats?.applied ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Applied to canvas</p>
              </div>
              <p className="text-[11px] text-gray-600 font-medium">
                {statsLoad ? '…' : `${stats?.apply_rate ?? 0}% apply rate`}
              </p>
            </div>

            {/* Unique users */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 ring-1 ring-indigo-500/20
                            flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                  <Users className="w-4 h-4 text-indigo-400"/>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-300">
                  {statsLoad ? <span className="text-gray-600 text-base">—</span> : (stats?.unique_users ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Unique users</p>
              </div>
              <p className="text-[11px] text-gray-600 font-medium">who've used AI</p>
            </div>

            {/* Apply rate ring */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 ring-1 ring-violet-500/20
                            flex items-center gap-4">
              {statsLoad
                ? <div className="w-14 h-14 rounded-full border-4 border-white/8 animate-pulse flex-shrink-0"/>
                : <ApplyRateRing rate={stats?.apply_rate ?? 0}/>
              }
              <div>
                <p className="text-sm font-bold text-white">Apply Rate</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Generations users kept and applied to their schema
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 30-day trend bar */}
        {!statsLoad && !statsError && stats?.trend_30d && (
          <div className="bg-white/5 border border-white/8 rounded-2xl px-5 py-4 flex items-center gap-6">
            <div className="flex-shrink-0">
              <p className="text-xs font-semibold text-white mb-0.5">Daily Generations</p>
              <p className="text-[10px] text-gray-600">Last 30 days</p>
            </div>
            <div className="flex-1 overflow-hidden">
              <AiSparkline data={stats.trend_30d} color="#8b5cf6"/>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-xl p-1">
          {[
            { id: 'users',   label: 'Per-User Usage', icon: <Users className="w-3.5 h-3.5"/>    },
            { id: 'prompts', label: 'Recent Prompts',  icon: <MessageSquare className="w-3.5 h-3.5"/> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          transition-colors
                          ${activeTab === t.id
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                            : 'text-gray-500 hover:text-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        {activeTab === 'users' && usersMeta && (
          <p className="text-[11px] text-gray-600">{usersMeta.total.toLocaleString()} users with AI activity</p>
        )}
        {activeTab === 'prompts' && promptsMeta && (
          <p className="text-[11px] text-gray-600">{promptsMeta.total.toLocaleString()} total prompts</p>
        )}
      </div>

      {/* ════════ PER-USER TAB ════════ */}
      {activeTab === 'users' && (
        <>
          {/* Search + refresh */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none"/>
              <input
                type="text"
                value={userSearch}
                onChange={e => handleUserSearch(e.target.value)}
                placeholder="Search user name or email…"
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200
                           placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1
                           focus:ring-violet-500/30 transition-colors"
              />
            </div>
            <button
              onClick={() => fetchUsers(usersPage)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 bg-white/5
                         border border-white/8 px-3 py-1.5 rounded-xl transition-colors">
              <RefreshCw className="w-3 h-3"/> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white/3 border border-white/8 rounded-2xl">
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_2fr] gap-3 px-4 py-2.5 border-b border-white/8
                            text-[10px] font-bold text-gray-600 uppercase tracking-widest flex-shrink-0">
              <span>User</span>
              <span>Email</span>
              <span>Total</span>
              <span>Applied</span>
              <span>Apply Rate</span>
              <span>Last Used</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {usersLoad ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_2fr] gap-3 px-4 py-3 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/8 animate-pulse flex-shrink-0"/>
                      <div className="h-3 bg-white/8 rounded w-24 animate-pulse"/>
                    </div>
                    {[0,1,2,3,4].map(j => (
                      <div key={j} className="h-3 bg-white/8 rounded w-16 animate-pulse"/>
                    ))}
                  </div>
                ))
              ) : usersError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <AlertCircle className="w-7 h-7 text-rose-400"/>
                  <p className="text-sm text-rose-400">{usersError}</p>
                  <button onClick={() => fetchUsers(usersPage)}
                    className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
                </div>
              ) : (usersData?.data ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Sparkles className="w-7 h-7 text-gray-600"/>
                  <p className="text-sm text-gray-500">No AI activity yet</p>
                </div>
              ) : (
                (usersData?.data ?? []).map((u, idx) => {
                  const rank = ((usersData?.current_page ?? 1) - 1) * 20 + idx + 1
                  return (
                    <div key={u.id}
                      className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_2fr] gap-3 px-4 py-2.5 items-center
                                 hover:bg-white/3 transition-colors">
                      {/* User */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-gray-700 w-4 text-center flex-shrink-0">{rank}</span>
                        <div className="w-6 h-6 rounded-full bg-violet-600/20 ring-1 ring-violet-500/20
                                        flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover"/>
                            : <span className="text-[9px] font-bold text-violet-400">
                                {(u.name || '?')[0].toUpperCase()}
                              </span>
                          }
                        </div>
                        <p className="text-xs font-semibold text-gray-200 truncate">{u.name}</p>
                      </div>
                      {/* Email */}
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      {/* Total */}
                      <p className="text-xs font-bold text-violet-300">{u.generations_count}</p>
                      {/* Applied */}
                      <p className="text-xs text-emerald-400">{u.applied_count}</p>
                      {/* Apply rate */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 max-w-16 h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${u.apply_rate}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium">{u.apply_rate}%</span>
                      </div>
                      {/* Last used */}
                      <p className="text-[10px] text-gray-600">
                        {u.last_used
                          ? new Date(u.last_used).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })
                          : '—'}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Pagination */}
          {usersMeta && usersMeta.lastPage > 1 && (
            <div className="flex items-center justify-between flex-shrink-0">
              <p className="text-[11px] text-gray-600">
                Showing {usersMeta.from}–{usersMeta.to} of {usersMeta.total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={usersMeta.currentPage <= 1 || usersLoad}
                  onClick={() => fetchUsers(usersMeta.currentPage - 1)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                             text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-3 h-3"/> Prev
                </button>
                {Array.from({ length: usersMeta.lastPage }, (_, i) => i + 1)
                  .filter(n => Math.abs(n - usersMeta.currentPage) <= 2)
                  .map(n => (
                    <button key={n} onClick={() => fetchUsers(n)} disabled={usersLoad}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                                  ${n === usersMeta.currentPage
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-white/5 border border-white/8 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                      {n}
                    </button>
                  ))
                }
                <button
                  disabled={usersMeta.currentPage >= usersMeta.lastPage || usersLoad}
                  onClick={() => fetchUsers(usersMeta.currentPage + 1)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                             text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  Next <ChevronRight className="w-3 h-3"/>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════ PROMPTS TAB ════════ */}
      {activeTab === 'prompts' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none"/>
              <input
                type="text"
                value={promptSearch}
                onChange={e => handlePromptSearch(e.target.value)}
                placeholder="Search prompt text…"
                className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200
                           placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1
                           focus:ring-violet-500/30 transition-colors"
              />
            </div>
            <select
              value={appliedFilter}
              onChange={e => handleAppliedFilter(e.target.value)}
              className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs text-gray-300
                         focus:outline-none focus:border-violet-500/50 cursor-pointer">
              <option value="">All results</option>
              <option value="1">Applied only</option>
              <option value="0">Discarded only</option>
            </select>
            <button
              onClick={() => fetchPrompts(promptsPage)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 bg-white/5
                         border border-white/8 px-3 py-1.5 rounded-xl transition-colors">
              <RefreshCw className="w-3 h-3"/> Refresh
            </button>
          </div>

          {/* Prompts list */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white/3 border border-white/8 rounded-2xl">
            <div className="grid grid-cols-[3fr_2fr_2fr_auto_auto] gap-3 px-4 py-2.5 border-b border-white/8
                            text-[10px] font-bold text-gray-600 uppercase tracking-widest flex-shrink-0">
              <span>Prompt</span>
              <span>User</span>
              <span>Project</span>
              <span>Result</span>
              <span>Date</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {promptsLoad ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[3fr_2fr_2fr_auto_auto] gap-3 px-4 py-3 items-center">
                    <div className="h-3 bg-white/8 rounded w-full animate-pulse"/>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-white/8 animate-pulse flex-shrink-0"/>
                      <div className="h-3 bg-white/8 rounded w-20 animate-pulse"/>
                    </div>
                    <div className="h-3 bg-white/8 rounded w-24 animate-pulse"/>
                    <div className="h-4 bg-white/8 rounded-full w-14 animate-pulse"/>
                    <div className="h-3 bg-white/8 rounded w-16 animate-pulse"/>
                  </div>
                ))
              ) : promptsError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <AlertCircle className="w-7 h-7 text-rose-400"/>
                  <p className="text-sm text-rose-400">{promptsError}</p>
                  <button onClick={() => fetchPrompts(promptsPage)}
                    className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
                </div>
              ) : (promptsData?.data ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <MessageSquare className="w-7 h-7 text-gray-600"/>
                  <p className="text-sm text-gray-500">No prompts found</p>
                  {(promptSearch || appliedFilter) && (
                    <button
                      onClick={() => { setPromptSearch(''); setAppliedFilter(''); fetchPrompts(1, '', '') }}
                      className="text-xs text-violet-400 hover:text-violet-300 underline mt-1">
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                (promptsData?.data ?? []).map(p => (
                  <div key={p.id}
                    className="grid grid-cols-[3fr_2fr_2fr_auto_auto] gap-3 px-4 py-2.5 items-start
                               hover:bg-white/3 transition-colors">
                    {/* Prompt text */}
                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 break-words">
                      {p.prompt}
                    </p>
                    {/* User */}
                    <div className="flex items-center gap-2 min-w-0 pt-0.5">
                      <div className="w-5 h-5 rounded-full bg-violet-600/20 ring-1 ring-violet-500/20
                                      flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {p.user?.avatar_url
                          ? <img src={p.user.avatar_url} alt="" className="w-full h-full object-cover"/>
                          : <span className="text-[8px] font-bold text-violet-400">
                              {(p.user?.name || '?')[0].toUpperCase()}
                            </span>
                        }
                      </div>
                      <span className="text-xs text-gray-400 truncate">{p.user?.name ?? '—'}</span>
                    </div>
                    {/* Project */}
                    <p className="text-xs text-gray-500 truncate pt-0.5">
                      {p.project?.name ?? <span className="text-gray-700 italic">deleted</span>}
                    </p>
                    {/* Applied badge */}
                    <div className="pt-0.5">
                      {p.applied
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                                           bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                            <CheckCircle className="w-2.5 h-2.5"/> applied
                          </span>
                        : <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full
                                           bg-white/5 text-gray-600 border border-white/10">
                            discarded
                          </span>
                      }
                    </div>
                    {/* Date */}
                    <p className="text-[10px] text-gray-600 whitespace-nowrap pt-0.5">
                      {new Date(p.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {promptsMeta && promptsMeta.lastPage > 1 && (
            <div className="flex items-center justify-between flex-shrink-0">
              <p className="text-[11px] text-gray-600">
                Showing {promptsMeta.from}–{promptsMeta.to} of {promptsMeta.total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={promptsMeta.currentPage <= 1 || promptsLoad}
                  onClick={() => fetchPrompts(promptsMeta.currentPage - 1)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                             text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronLeft className="w-3 h-3"/> Prev
                </button>
                {Array.from({ length: promptsMeta.lastPage }, (_, i) => i + 1)
                  .filter(n => Math.abs(n - promptsMeta.currentPage) <= 2)
                  .map(n => (
                    <button key={n} onClick={() => fetchPrompts(n)} disabled={promptsLoad}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                                  ${n === promptsMeta.currentPage
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-white/5 border border-white/8 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
                      {n}
                    </button>
                  ))
                }
                <button
                  disabled={promptsMeta.currentPage >= promptsMeta.lastPage || promptsLoad}
                  onClick={() => fetchPrompts(promptsMeta.currentPage + 1)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/8
                             text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                  Next <ChevronRight className="w-3 h-3"/>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Schema of the Week Section ────────────────────────────────────
function FeaturedSection({ onNavigate }) {
  const [featured, setFeatured] = useState(null)   // null = no schema for this week
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [toggling, setToggling] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  // Load current week's featured schema on mount
  useEffect(() => {
    api.get('/admin/featured/current')
      .then(r => setFeatured(r.data))
      .catch(() => setError('Failed to load the current featured schema.'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async () => {
    if (!featured || toggling) return
    const newValue = !featured.is_visible
    setToggling(true)
    setError('')
    try {
      const res = await api.patch('/admin/featured/visibility', { is_visible: newValue })
      setFeatured(prev => ({ ...prev, is_visible: res.data.is_visible }))
      showToast(
        newValue
          ? 'Schema of the Week is now visible on the Explore page.'
          : 'Schema of the Week is now hidden from the Explore page.'
      )
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update visibility.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-4 max-w-2xl">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1d2e] border border-indigo-500/30 text-indigo-300
                        text-xs font-medium px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"/>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Schema of the Week</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Control the featured banner that appears at the top of the Discover tab on the Explore page.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-300
                        text-xs font-medium px-4 py-2.5 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/>
          {error}
          <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">

        {/* Current schema info row */}
        <div className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-amber-500/20">
            <Trophy className="w-5 h-5 text-amber-400"/>
          </div>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 bg-white/8 rounded w-48 animate-pulse"/>
                <div className="h-3 bg-white/5 rounded w-64 animate-pulse"/>
              </div>
            ) : featured ? (
              <>
                <p className="text-sm font-bold text-white truncate">{featured.project_name}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>
                    Week of{' '}
                    {new Date(featured.week_of).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                  {featured.auto_selected ? (
                    <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/15
                                     border border-indigo-500/25 px-1.5 py-0.5 rounded-full">
                      auto-picked
                    </span>
                  ) : featured.featured_by ? (
                    <span className="text-[10px] text-gray-600">by {featured.featured_by}</span>
                  ) : null}
                </p>
                {featured.note && (
                  <p className="text-xs text-gray-600 mt-1.5 italic leading-relaxed">
                    &ldquo;{featured.note}&rdquo;
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-500">No schema featured this week</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Feature a public project from the{' '}
                  <button
                    onClick={() => onNavigate?.('projects')}
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors">
                    Projects section
                  </button>
                  {' '}to enable this toggle.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/8"/>

        {/* Visibility toggle row */}
        <div className="px-6 py-5 flex items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-200">Show on Explore page</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {featured
                ? 'When ON, the featured banner is shown at the top of the Discover tab.'
                : 'No schema is featured this week — feature one first to enable this toggle.'}
            </p>
          </div>
          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={!featured || toggling || loading}
            role="switch"
            aria-checked={featured?.is_visible ?? false}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
                        transition-colors duration-200 ease-in-out
                        focus:outline-none focus:ring-2 focus:ring-amber-500/50
                        focus:ring-offset-2 focus:ring-offset-[#0f1117]
                        ${featured?.is_visible ? 'bg-amber-500' : 'bg-white/15'}
                        ${(!featured || toggling || loading) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white
                          shadow ring-0 transition duration-200 ease-in-out
                          ${featured?.is_visible ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Status badge row */}
        {!loading && featured && (
          <>
            <div className="border-t border-white/8"/>
            <div className="px-6 py-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1
                               rounded-full border transition-colors
                               ${featured.is_visible
                                 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                 : 'bg-white/5 text-gray-500 border-white/10'}`}>
                {featured.is_visible
                  ? <Eye className="w-3 h-3"/>
                  : <EyeOff className="w-3 h-3"/>}
                {featured.is_visible ? 'Visible on Explore' : 'Hidden from Explore'}
              </span>
              {toggling && (
                <span className="text-[11px] text-gray-600 animate-pulse">Saving…</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* History hint */}
      <p className="text-xs text-gray-600 leading-relaxed">
        To change which schema is featured, go to the{' '}
        <button
          onClick={() => onNavigate?.('projects')}
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors">
          Projects section
        </button>
        {' '}and choose &ldquo;Feature as SOTW&rdquo; from the context menu of any public project.
      </p>
    </div>
  )
}

// ── Main AdminPage ────────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [section, setSection] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = [
    { id: 'overview',   label: 'Overview',        icon: <LayoutDashboard className="w-4 h-4"/> },
    { id: 'users',      label: 'Users',            icon: <Users className="w-4 h-4"/>          },
    { id: 'projects',   label: 'Projects',         icon: <FolderKanban className="w-4 h-4"/>   },
    { id: 'community',  label: 'Community',        icon: <Globe className="w-4 h-4"/>           },
    { id: 'ai-usage',   label: 'AI Usage',         icon: <Sparkles className="w-4 h-4"/>       },
    { id: 'featured',   label: 'Schema of Week',   icon: <Trophy className="w-4 h-4"/>         },
  ]

  const sectionContent = {
    overview:   <OverviewSection/>,
    users:      <UsersSection/>,
    projects:   <ProjectsSection/>,
    community:  <CommunitySection/>,
    'ai-usage': <AiUsageSection/>,
    featured:   <FeaturedSection onNavigate={setSection}/>,
  }

  const currentLabel = navItems.find(n => n.id === section)?.label ?? 'Admin'

  const handleNavClick = (id) => {
    setSection(id)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-[#0b0d14] overflow-hidden">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ════════ SIDEBAR ════════ */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-[#0f1117] border-r border-white/5
        flex flex-col h-full transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:flex md:flex-shrink-0
      `}>

        {/* Logo */}
        <div className="px-6 pt-7 pb-5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto"/>
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-300
                             bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3 h-3"/>
              Admin Panel
            </span>
          </div>
        </div>

        {/* Nav */}
        <p className="px-6 text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Sections</p>
        <nav className="px-3 space-y-0.5 flex-1">
          {navItems.map(item => (
            <AdminNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={section === item.id}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </nav>

        {/* Divider + back */}
        <div className="mx-6 border-t border-white/8 my-3"/>
        <nav className="px-3 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                       transition-all text-gray-500 hover:bg-white/8 hover:text-gray-200">
            <ArrowLeft className="w-4 h-4 flex-shrink-0"/>
            <span>Back to Dashboard</span>
          </button>
        </nav>

        {/* Admin badge */}
        <div className="mx-4 mb-5 p-3 bg-white/5 border border-white/8 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-600/20 flex items-center
                          justify-center ring-2 ring-indigo-500/20 flex-shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover"/>
              : <span className="text-xs font-bold text-indigo-400">{(user?.name || 'A')[0].toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-indigo-400 font-medium">Administrator</p>
          </div>
        </div>
      </aside>

      {/* ════════ MAIN ════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top bar */}
        <header className="bg-[#0f1117] border-b border-white/5 px-4 md:px-8 py-4 flex items-center
                           justify-between flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="md:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl
                         bg-white/5 border border-white/10 text-gray-400 hover:text-white
                         hover:bg-white/10 transition-colors">
              <Menu className="w-4 h-4"/>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">{currentLabel}</h1>
              <p className="text-xs text-gray-600 mt-0.5 hidden sm:block">Schema Genius · Admin Panel</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-gray-600">Logged in as</span>
            <span className="text-[11px] font-semibold text-gray-400 max-w-[160px] truncate">{user?.email}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-7 flex flex-col min-w-0">
          <div className="min-w-0 overflow-x-auto">
            {sectionContent[section]}
          </div>
        </main>
      </div>
    </div>
  )
}
