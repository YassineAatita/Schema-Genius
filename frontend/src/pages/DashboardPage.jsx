import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import useProjectStore from '../store/useProjectStore'
import api from '../services/api'
import ConfirmModal from '../components/ui/ConfirmModal'
import ExploreView from '../components/explore/ExploreView'
import '../services/websocket'   // ensure window.Echo is initialised

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const USER_TYPES = [
  { value: 'student',   label: 'Student',    emoji: '🎓' },
  { value: 'developer', label: 'Developer',  emoji: '💻' },
  { value: 'designer',  label: 'Designer',   emoji: '🎨' },
  { value: 'fullstack', label: 'Full-Stack', emoji: '⚡' },
  { value: 'other',     label: 'Other',      emoji: '🌐' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const { projects, loading, fetchProjects, deleteProject, updateProject } = useProjectStore()

  // ── View state — BUG 8 FIX: persist to sessionStorage so browser refresh stays on the same tab ──
  const [view, setViewRaw] = useState(() => sessionStorage.getItem('dashboard_view') || 'dashboard')
  const setView = (v) => { sessionStorage.setItem('dashboard_view', v); setViewRaw(v) }

  // ── Projects state ────────────────────────────────────────────
  const [showModal,     setShowModal]     = useState(false)
  const [search,        setSearch]        = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [editingProject,setEditingProject]= useState(null)   // project object being edited
  const [invitations,       setInvitations]       = useState([])
  const [friendRequestsBell,setFriendRequestsBell]= useState([])
  const [notifications,     setNotifications]     = useState([])
  const [bellTab,           setBellTab]           = useState('invitations') // 'invitations' | 'notifications'
  const [showBell,          setShowBell]          = useState(false)
  const [friendReqCount,    setFriendReqCount]    = useState(0)
  const bellRef = useRef(null)

  // ── Active-users-per-project (presence badge) ─────────────────
  // { [projectId]: number }  — how many OTHER users are in that project's designer
  const [projectActiveUsers, setProjectActiveUsers] = useState({})

  // ── Friends view state ────────────────────────────────────────
  const [friendsList,        setFriendsList]        = useState([])
  const [friendRequests,     setFriendRequests]     = useState([])
  const [friendsLoaded,      setFriendsLoaded]      = useState(false)
  const [friendsTab,         setFriendsTab]         = useState('friends')
  const [friendSearch,       setFriendSearch]       = useState('')
  const [friendSearchRes,    setFriendSearchRes]    = useState([])
  const [friendSearching,    setFriendSearching]    = useState(false)
  const [friendSearchDone,   setFriendSearchDone]   = useState(false)
  const [friendActionLoading,setFriendActionLoading]= useState(null)
  const [friendToast,        setFriendToast]        = useState(null)
  const friendSearchTimer = useRef(null)

  // ── Profile state ─────────────────────────────────────────────
  const fileRef                                   = useRef()
  const [editing,       setEditing]               = useState(false)
  const [saving,        setSaving]                = useState(false)
  const [aiLoading,     setAiLoading]             = useState(false)
  const [avatarLoading, setAvatarLoading]         = useState(false)
  const [profileSuccess,setProfileSuccess]        = useState('')
  const [profileError,  setProfileError]          = useState('')
  const [pName,         setPName]                 = useState('')
  const [pUserType,     setPUserType]             = useState('developer')
  const [pHeadline,     setPHeadline]             = useState('')
  const [pBio,          setPBio]                  = useState('')
  const [avatarPreview, setAvatarPreview]         = useState(null)

  // ── Bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { logout(); navigate('/login') })
    fetchProjects()
    fetchInvitations()
    fetchNotifications()
    api.get('/friends/requests').then(r => setFriendReqCount(r.data.length)).catch(() => {})
  }, [])

  // Sync profile fields when user changes
  useEffect(() => {
    setPName(user?.name || '')
    setPUserType(user?.user_type || 'developer')
    setPHeadline(user?.headline || '')
    setPBio(user?.bio || '')
    setAvatarPreview(user?.avatar_url || null)
  }, [user])

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Invitations ───────────────────────────────────────────────
  // BUG 5 FIX — also fetch pending friend requests and show them in the bell
  const fetchInvitations = async () => {
    try {
      const [invRes, frRes] = await Promise.all([
        api.get('/invitations'),
        api.get('/friends/requests'),
      ])
      setInvitations(invRes.data)
      setFriendRequestsBell(frRes.data)
      setFriendReqCount(frRes.data.length)
    } catch {}
  }
  const handleAccept = async (projectId) => {
    await api.post(`/invitations/${projectId}/accept`)
    setInvitations(prev => prev.filter(i => i.project_id !== projectId))
    fetchProjects()
  }
  const handleDecline = async (projectId) => {
    await api.post(`/invitations/${projectId}/decline`)
    setInvitations(prev => prev.filter(i => i.project_id !== projectId))
  }

  // BUG 5 FIX — friend-request accept/decline from bell invitations panel
  const handleBellFriendAccept = async (req) => {
    try {
      await api.post(`/friends/${req.friendship_id}/accept`)
      setFriendRequestsBell(prev => prev.filter(r => r.friendship_id !== req.friendship_id))
      setFriendReqCount(c => Math.max(0, c - 1))
      setFriendsList(prev => [{ friendship_id: req.friendship_id, id: req.id, name: req.name, email: req.email, avatar_url: req.avatar_url, headline: req.headline }, ...prev])
    } catch {}
  }
  const handleBellFriendDecline = async (req) => {
    try {
      await api.post(`/friends/${req.friendship_id}/decline`)
      setFriendRequestsBell(prev => prev.filter(r => r.friendship_id !== req.friendship_id))
      setFriendReqCount(c => Math.max(0, c - 1))
    } catch {}
  }

  // ── Notifications ─────────────────────────────────────────────
  const fetchNotifications = async () => {
    try { const res = await api.get('/notifications'); setNotifications(res.data.notifications || []) } catch {}
  }
  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }
  const clearNotifications = async () => {
    await api.delete('/notifications/clear')
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const totalBellCount = invitations.length + friendRequestsBell.length + unreadCount

  // ── Friends helpers ────────────────────────────────────────────
  const loadFriendsData = async () => {
    if (friendsLoaded) return
    const [fl, rq] = await Promise.all([api.get('/friends'), api.get('/friends/requests')]).catch(() => [{ data: [] }, { data: [] }])
    setFriendsList(fl?.data || [])
    setFriendRequests(rq?.data || [])
    setFriendReqCount((rq?.data || []).length)
    setFriendsLoaded(true)
  }

  useEffect(() => {
    if (view === 'friends') loadFriendsData()
  }, [view])

  // ── Active-user badges (polling) ──────────────────────────────
  // Do NOT join presence channels here — that would make the dashboard user
  // a presence member, causing other users' dashboards to incorrectly count
  // them as "active in the designer".  Instead, DesignerPage writes a
  // heartbeat to the cache (POST /projects/{id}/active) and this effect
  // polls the summary endpoint every 10 s.  Counts are cleared immediately
  // when the user leaves the designer (DELETE /projects/{id}/active).
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await api.get('/projects/active-counts')
        setProjectActiveUsers(res.data)
      } catch { /* network error — keep stale counts */ }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 10000)
    return () => clearInterval(interval)
  }, [])   // run once on mount; the endpoint always returns fresh data

  useEffect(() => {
    clearTimeout(friendSearchTimer.current)
    if (friendSearch.trim().length < 2) { setFriendSearchRes([]); setFriendSearchDone(false); return }
    setFriendSearching(true)
    friendSearchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(friendSearch.trim())}`)
        setFriendSearchRes(res.data); setFriendSearchDone(true)
      } catch { setFriendSearchRes([]) }
      finally { setFriendSearching(false) }
    }, 400)
  }, [friendSearch])

  const showFriendToast = (msg, type = 'success') => {
    setFriendToast({ msg, type })
    setTimeout(() => setFriendToast(null), 3000)
  }

  const updateFriendStatus = (userId, status, fid = null) => {
    setFriendSearchRes(prev => prev.map(u => u.id === userId ? { ...u, friendship_status: status, friendship_id: fid } : u))
  }

  const handleFriendSend = async (target) => {
    setFriendActionLoading(target.id)
    try {
      const res = await api.post('/friends', { user_id: target.id })
      updateFriendStatus(target.id, 'request_sent', res.data.friendship_id)
      showFriendToast(`Friend request sent to ${target.name}!`)
    } catch (err) { showFriendToast(err.response?.data?.message || 'Could not send request.', 'error') }
    finally { setFriendActionLoading(null) }
  }

  const handleFriendAccept = async (target, fid) => {
    setFriendActionLoading(target.id)
    try {
      await api.post(`/friends/${fid}/accept`)
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== fid))
      setFriendsList(prev => [{ friendship_id: fid, id: target.id, name: target.name, email: target.email, avatar_url: target.avatar_url, headline: target.headline }, ...prev])
      setFriendReqCount(c => Math.max(0, c - 1))
      updateFriendStatus(target.id, 'friends', fid)
      showFriendToast(`You and ${target.name} are now friends!`)
    } catch (err) { showFriendToast(err.response?.data?.message || 'Could not accept.', 'error') }
    finally { setFriendActionLoading(null) }
  }

  const handleFriendDecline = async (target, fid) => {
    setFriendActionLoading(target.id)
    try {
      await api.post(`/friends/${fid}/decline`)
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== fid))
      setFriendReqCount(c => Math.max(0, c - 1))
      updateFriendStatus(target.id, 'none', null)
      showFriendToast('Request removed.')
    } catch (err) { showFriendToast(err.response?.data?.message || 'Error.', 'error') }
    finally { setFriendActionLoading(null) }
  }

  const handleFriendUnfriend = async (target, fid) => {
    setFriendActionLoading(target.id)
    try {
      await api.delete(`/friends/${fid}`)
      setFriendsList(prev => prev.filter(f => f.friendship_id !== fid))
      updateFriendStatus(target.id, 'none', null)
      showFriendToast(`Removed ${target.name} from friends.`)
    } catch (err) { showFriendToast(err.response?.data?.message || 'Error.', 'error') }
    finally { setFriendActionLoading(null) }
  }

  // ── Auth ──────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await api.post('/auth/logout') } finally { logout(); navigate('/login') }
  }

  // ── Projects ──────────────────────────────────────────────────
  const handleDelete  = (id, name) => setPendingDelete({ id, name })
  const confirmDelete = async () => { await deleteProject(pendingDelete.id); setPendingDelete(null) }
  const handleEditSave = async (id, name, description) => {
    await updateProject(id, { name, description })
    setEditingProject(null)
  }
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const owned    = projects.filter(p => p.is_owner).length
  const shared   = projects.filter(p => !p.is_owner).length

  // ── Profile helpers ───────────────────────────────────────────
  function flash(msg, type = 'success') {
    if (type === 'success') setProfileSuccess(msg)
    else setProfileError(msg)
    setTimeout(() => { setProfileSuccess(''); setProfileError('') }, 3000)
  }

  const ALLOWED_TYPES = ['image/jpeg','image/png','image/jpg','image/gif','image/webp']

  async function onAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      flash('Only JPEG, PNG, GIF, or WebP images are allowed', 'error'); e.target.value = ''; return
    }
    if (file.size > 2 * 1024 * 1024) {
      flash(`Image must be under 2MB (yours is ${(file.size/1024/1024).toFixed(1)}MB)`, 'error'); e.target.value = ''; return
    }
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarLoading(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      await api.post('/profile/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const me = await api.get('/auth/me')
      setUser(me.data)
      flash('Profile photo updated!')
    } catch { flash('Upload failed. Please try again.', 'error') }
    finally { setAvatarLoading(false); e.target.value = '' }
  }

  async function enhanceBio() {
    if (!pBio.trim()) return
    setAiLoading(true)
    try { const res = await api.post('/ai/enhance-bio', { bio: pBio, user_type: pUserType }); setPBio(res.data.bio) }
    catch { flash('AI enhancement failed', 'error') }
    finally { setAiLoading(false) }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await api.put('/profile', { name: pName, user_type: pUserType, headline: pHeadline, bio: pBio })
      const me = await api.get('/auth/me')
      setUser(me.data)
      setEditing(false)
      flash('Profile saved!')
    } catch (err) { flash(err.response?.data?.message || 'Save failed', 'error') }
    finally { setSaving(false) }
  }

  function cancelEdit() {
    setPName(user?.name || ''); setPUserType(user?.user_type || 'developer')
    setPHeadline(user?.headline || ''); setPBio(user?.bio || '')
    setAvatarPreview(user?.avatar_url || null); setEditing(false)
  }

  const typeInfo = USER_TYPES.find(t => t.value === (user?.user_type || pUserType)) || USER_TYPES[1]

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#f5f7fb] overflow-hidden">

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside className="w-64 bg-[#0f1117] flex flex-col flex-shrink-0 h-full">

        <div className="px-6 pt-7 pb-6">
          <Link to="/" className="flex items-center">
            <img src="/logo_white.svg" alt="Schema Genius" className="h-8 w-auto" />
          </Link>
        </div>

        <p className="px-6 text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">Menu</p>
        <nav className="px-3 space-y-0.5">
          <SideNavItem icon={<GridIcon/>}  label="Dashboard" active={view==='dashboard'} onClick={() => setView('dashboard')} />
          <SideNavItem icon={<UserIcon/>}  label="Profile"   active={view==='profile'}   onClick={() => setView('profile')}   />
          <SideNavItem
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            }
            label="Friends"
            badge={friendReqCount > 0 ? friendReqCount : null}
            active={view === 'friends'}
            onClick={() => setView('friends')}
          />
          <SideNavItem
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2}/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/>
              </svg>
            }
            label="Explore"
            active={view === 'explore'}
            onClick={() => setView('explore')}
          />
        </nav>

        <div className="mx-6 border-t border-white/8 my-3"/>
        <p className="px-6 text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2">General</p>
        <nav className="px-3 pb-4 space-y-0.5 flex-1">
          {user?.is_admin && (
            <SideNavItem
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              }
              label="Admin Panel"
              onClick={() => navigate('/admin')}
            />
          )}
          <SideNavItem icon={<LogoutIcon/>} label="Sign out" onClick={handleLogout} danger />
        </nav>

        {/* User card */}
        <div className="mx-4 mb-5 p-3.5 bg-white/5 border border-white/8 rounded-2xl flex items-center gap-3
                        cursor-pointer hover:bg-white/8 transition-colors"
             onClick={() => setView('profile')}>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-600/20 flex items-center justify-center
                          ring-2 ring-white/10 flex-shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover"
                     onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
              : null}
            <span className="text-sm font-bold text-blue-400"
                  style={{ display: user?.avatar_url ? 'none' : 'flex' }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* ════════════════ MAIN ════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* ── Top bar ── */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div>
            {view === 'dashboard' ? (
              <>
                <h1 className="text-lg font-bold text-gray-900">{getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
                <p className="text-xs text-gray-400 mt-0.5">Here's an overview of your schema projects</p>
              </>
            ) : view === 'friends' ? (
              <>
                <h1 className="text-lg font-bold text-gray-900">Your Network</h1>
                <p className="text-xs text-gray-400 mt-0.5">Connect with teammates to invite them to projects instantly</p>
              </>
            ) : view === 'explore' ? (
              <>
                <h1 className="text-lg font-bold text-gray-900">Explore</h1>
                <p className="text-xs text-gray-400 mt-0.5">Discover public schemas from the community</p>
              </>
            ) : (
              <>
                <h1 className="text-lg font-bold text-gray-900">Your Profile</h1>
                <p className="text-xs text-gray-400 mt-0.5">Manage your personal information</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {view === 'dashboard' && (
              <div className="relative">
                <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
                </svg>
                <input type="text" placeholder="Search projects…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-52
                             focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                             bg-gray-50 transition-all"/>
              </div>
            )}

            {/* Bell */}
            <div className="relative" ref={bellRef}>
              <button onClick={() => setShowBell(v => !v)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200
                           bg-white hover:bg-gray-50 text-gray-500 hover:text-blue-600 transition-all shadow-sm">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                {totalBellCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px]
                                   font-bold rounded-full flex items-center justify-center">
                    {totalBellCount > 9 ? '9+' : totalBellCount}
                  </span>
                )}
              </button>

              {showBell && (
                <div className="absolute right-0 mt-2 w-88 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                     style={{ width: '340px' }}>
                  {/* Tabs */}
                  <div className="flex border-b border-gray-100">
                    <button onClick={() => setBellTab('invitations')}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5
                        ${bellTab==='invitations' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600'}`}>
                      Invitations
                      {(invitations.length + friendRequestsBell.length) > 0 && (
                        <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                          {invitations.length + friendRequestsBell.length}
                        </span>
                      )}
                    </button>
                    <button onClick={() => { setBellTab('notifications'); markAllRead() }}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5
                        ${bellTab==='notifications' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600'}`}>
                      Notifications
                      {unreadCount > 0 && (
                        <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Invitations tab */}
                  {bellTab === 'invitations' && (
                    <>
                      {invitations.length === 0 && friendRequestsBell.length === 0
                        ? <div className="px-4 py-10 text-center text-sm text-gray-400">No pending invitations</div>
                        : <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                            {/* Project collaboration invitations */}
                            {invitations.map(inv => (
                              <div key={`inv-${inv.project_id}`} className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900 truncate">{inv.project_name}</p>
                                <p className="text-xs text-gray-400 mb-2.5">
                                  by {inv.owner?.name} · <span className="font-medium text-gray-600">{inv.role}</span>
                                </p>
                                <div className="flex gap-2">
                                  <button onClick={() => handleAccept(inv.project_id)}
                                    className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-lg font-medium transition-colors">
                                    Accept
                                  </button>
                                  <button onClick={() => handleDecline(inv.project_id)}
                                    className="flex-1 text-xs border border-gray-200 hover:bg-red-50 hover:border-red-200
                                               hover:text-red-500 text-gray-500 py-1.5 rounded-lg font-medium transition-colors">
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                            {/* BUG 5 FIX — friend requests in bell invitations panel */}
                            {friendRequestsBell.map(req => (
                              <div key={`fr-${req.friendship_id}`} className="px-4 py-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-base">🤝</span>
                                  <p className="text-sm font-medium text-gray-900 truncate">{req.name}</p>
                                </div>
                                <p className="text-xs text-gray-400 mb-2.5">Sent you a friend request</p>
                                <div className="flex gap-2">
                                  <button onClick={() => handleBellFriendAccept(req)}
                                    className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg font-medium transition-colors">
                                    Accept
                                  </button>
                                  <button onClick={() => handleBellFriendDecline(req)}
                                    className="flex-1 text-xs border border-gray-200 hover:bg-red-50 hover:border-red-200
                                               hover:text-red-500 text-gray-500 py-1.5 rounded-lg font-medium transition-colors">
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                      }
                    </>
                  )}

                  {/* Notifications tab */}
                  {bellTab === 'notifications' && (
                    <>
                      {notifications.length === 0
                        ? <div className="px-4 py-10 text-center text-sm text-gray-400">No notifications yet</div>
                        : <>
                            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                              {notifications.map(n => (
                                <div key={n.id}
                                  className={`px-4 py-3 flex items-start gap-3 ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                  {/* BUG 7 FIX — proper icon per notification type */}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm
                                    ${n.type === 'invitation_accepted'      ? 'bg-emerald-100' :
                                      n.type === 'project_starred'          ? 'bg-amber-100'   :
                                      n.type === 'project_liked'            ? 'bg-red-100'     :
                                      n.type === 'project_forked'           ? 'bg-violet-100'  :
                                      n.type === 'new_comment'              ? 'bg-blue-100'    :
                                      n.type === 'new_follower'             ? 'bg-teal-100'    :
                                      n.type === 'friend_request_received'  ? 'bg-pink-100'    :
                                      n.type === 'friend_request_accepted'  ? 'bg-emerald-100' :
                                      'bg-gray-100'}`}>
                                    {n.type === 'invitation_accepted'      ? '✓'  :
                                     n.type === 'project_starred'          ? '★'  :
                                     n.type === 'project_liked'            ? '♥'  :
                                     n.type === 'project_forked'           ? '⑂'  :
                                     n.type === 'new_comment'              ? '💬' :
                                     n.type === 'new_follower'             ? '👤' :
                                     n.type === 'friend_request_received'  ? '🤝' :
                                     n.type === 'friend_request_accepted'  ? '✓'  :
                                     '🔔'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {new Date(n.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                                    </p>
                                  </div>
                                  {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"/>}
                                </div>
                              ))}
                            </div>
                            <div className="px-4 py-2 border-t border-gray-100 flex justify-end">
                              <button onClick={clearNotifications}
                                className="text-[11px] text-gray-400 hover:text-red-500 transition-colors font-medium">
                                Clear all
                              </button>
                            </div>
                          </>
                      }
                    </>
                  )}
                </div>
              )}
            </div>

            {view === 'dashboard' && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                           px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all
                           hover:shadow-blue-500/30 hover:-translate-y-px active:translate-y-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                </svg>
                New Project
              </button>
            )}
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-8 py-7">

          {/* ════════ DASHBOARD VIEW ════════ */}
          {view === 'dashboard' && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <StatCard label="Total Projects" value={projects.length} sub="All time"         color="blue"    icon={<GridIcon/>}  />
                <StatCard label="My Projects"    value={owned}           sub="You own these"   color="violet"  icon={<UserIcon/>}  />
                <StatCard label="Shared With Me" value={shared}          sub="Collaborating"   color="emerald" icon={<ShareIcon/>} />
                <StatCard label="Invitations"    value={invitations.length}
                  sub={invitations.length > 0 ? 'Awaiting response' : 'All clear'}
                  color={invitations.length > 0 ? 'amber' : 'gray'} icon={<BellIcon/>} />
              </div>

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {search ? `Results for "${search}"` : 'All Projects'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filtered.length} project{filtered.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              </div>

              {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl"/>
                        <div className="flex-1">
                          <div className="h-3.5 bg-gray-100 rounded-lg w-3/4 mb-2"/>
                          <div className="h-2.5 bg-gray-50 rounded-lg w-1/2"/>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-50 rounded-lg w-full mb-2"/>
                      <div className="h-2.5 bg-gray-50 rounded-lg w-2/3"/>
                    </div>
                  ))}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1.5">
                    {search ? 'No projects match your search' : 'No projects yet'}
                  </h3>
                  <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                    {search ? 'Try a different keyword' : 'Create your first schema project and start designing your database visually'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowModal(true)}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                                 text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      </svg>
                      Create your first project
                    </button>
                  )}
                </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map(project => (
                    <ProjectCard key={project.id} project={project}
                      onOpen={() => navigate(`/projects/${project.id}/designer`)}
                      onDelete={() => handleDelete(project.id, project.name)}
                      onEdit={() => setEditingProject(project)}
                      activeCount={projectActiveUsers[project.id] || 0}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════ FRIENDS VIEW ════════ */}
          {view === 'friends' && (
            <div className="max-w-2xl mx-auto">

              {/* Search bar */}
              <div className="relative mb-5">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input type="text" placeholder="Search by name or email…"
                  value={friendSearch}
                  onChange={e => { setFriendSearch(e.target.value); if (e.target.value.length >= 2) setFriendsTab('search') }}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-white
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             placeholder:text-gray-400 shadow-sm"/>
                {friendSearching && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
                {[
                  { id: 'friends',  label: 'Friends',     count: friendsList.length },
                  { id: 'requests', label: 'Requests',    count: friendRequests.length, badge: friendRequests.length > 0 },
                  { id: 'search',   label: 'Find People', count: null },
                ].map(t => (
                  <button key={t.id} onClick={() => setFriendsTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all
                      ${friendsTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                    {t.count !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                        ${friendsTab === t.id
                          ? t.badge ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                          : t.badge ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Search tab ── */}
              {friendsTab === 'search' && (
                <div className="space-y-2">
                  {friendSearch.length < 2 && !friendSearchDone ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium text-sm">Find people to connect with</p>
                      <p className="text-xs text-gray-400 mt-1">Type a name or email address above</p>
                    </div>
                  ) : friendSearchDone && friendSearchRes.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium text-sm">No account found</p>
                      <p className="text-xs text-gray-400 mt-1">Nobody matches "<span className="font-medium">{friendSearch}</span>"</p>
                    </div>
                  ) : friendSearchRes.map(u => (
                    <FriendCard key={u.id} user={u} actionLoading={friendActionLoading}
                      onSend={handleFriendSend} onAccept={handleFriendAccept}
                      onDecline={handleFriendDecline} onUnfriend={handleFriendUnfriend} />
                  ))}
                </div>
              )}

              {/* ── Friends tab ── */}
              {friendsTab === 'friends' && (
                <div className="space-y-2">
                  {friendsList.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium text-sm">No friends yet</p>
                      <p className="text-xs text-gray-400 mt-1">Use the search bar above to find teammates</p>
                      <button onClick={() => setFriendsTab('search')}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">Find people →</button>
                    </div>
                  ) : friendsList.map(f => (
                    <FriendCard key={f.friendship_id}
                      user={{ ...f, friendship_status: 'friends', friendship_id: f.friendship_id }}
                      actionLoading={friendActionLoading}
                      onSend={handleFriendSend} onAccept={handleFriendAccept}
                      onDecline={handleFriendDecline} onUnfriend={handleFriendUnfriend} />
                  ))}
                </div>
              )}

              {/* ── Requests tab ── */}
              {friendsTab === 'requests' && (
                <div className="space-y-2">
                  {friendRequests.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium text-sm">No pending requests</p>
                      <p className="text-xs text-gray-400 mt-1">Friend requests will appear here</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                        {friendRequests.length} incoming request{friendRequests.length !== 1 ? 's' : ''}
                      </p>
                      {friendRequests.map(r => (
                        <FriendCard key={r.friendship_id}
                          user={{ ...r, friendship_status: 'request_received', friendship_id: r.friendship_id }}
                          actionLoading={friendActionLoading}
                          onSend={handleFriendSend} onAccept={handleFriendAccept}
                          onDecline={handleFriendDecline} onUnfriend={handleFriendUnfriend} />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Toast */}
              {friendToast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5
                                 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
                                 ${friendToast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
                  {friendToast.type === 'error'
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    : <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                  }
                  {friendToast.msg}
                </div>
              )}
            </div>
          )}

          {/* ════════ PROFILE VIEW ════════ */}
          {view === 'profile' && (
            <div className="max-w-2xl mx-auto">

              {/* Toast messages */}
              {profileSuccess && (
                <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm text-center flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  {profileSuccess}
                </div>
              )}
              {profileError && (
                <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-500 text-sm text-center">
                  {profileError}
                </div>
              )}

              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Cover */}
                <div className="h-28 bg-gradient-to-br from-blue-500 via-violet-500 to-purple-600 relative">
                  <div className="absolute inset-0 opacity-20"
                       style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
                </div>

                <div className="px-8 pb-7">
                  {/* Avatar row */}
                  <div className="flex items-end justify-between -mt-12 mb-5">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden
                                      bg-gray-100 flex items-center justify-center">
                        {avatarPreview
                          ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover"
                                 onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
                          : null}
                        <span className="text-3xl font-bold text-gray-400 w-full h-full flex items-center justify-center"
                              style={{ display: avatarPreview ? 'none' : 'flex' }}>
                          {(user?.name || 'U')[0].toUpperCase()}
                        </span>
                        {avatarLoading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                            <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <button onClick={() => fileRef.current.click()}
                        className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 rounded-full shadow-md
                                   flex items-center justify-center hover:bg-blue-500 transition-colors
                                   opacity-0 group-hover:opacity-100 border-2 border-white">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                      </button>
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                             className="hidden" onChange={onAvatarChange}/>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-gray-400 mb-2">JPG, PNG, GIF, WebP · max 2MB</p>
                      {editing ? (
                        <div className="flex gap-2">
                          <button onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500
                                       hover:bg-gray-50 transition-all">Cancel</button>
                          <button onClick={saveProfile} disabled={saving}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs text-white
                                       font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5">
                            {saving && <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>}
                            {saving ? 'Saving…' : 'Save changes'}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditing(true)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500
                                     hover:border-blue-300 hover:text-blue-600 transition-all flex items-center gap-1.5 ml-auto">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                          </svg>
                          Edit profile
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  {editing ? (
                    <input value={pName} onChange={e => setPName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xl font-bold
                                 text-gray-900 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                 focus:border-blue-400 bg-gray-50 transition-all"/>
                  ) : (
                    <h2 className="text-xl font-bold text-gray-900 mb-1">{user?.name}</h2>
                  )}

                  {/* User type chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editing ? USER_TYPES.map(t => (
                      <button key={t.value} type="button" onClick={() => setPUserType(t.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          border transition-all ${pUserType === t.value
                            ? 'border-blue-400 bg-blue-50 text-blue-600'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'}`}>
                        {t.emoji} {t.label}
                      </button>
                    )) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200
                                       rounded-full text-xs font-semibold text-blue-600">
                        {typeInfo.emoji} {typeInfo.label}
                      </span>
                    )}
                  </div>

                  {/* Headline */}
                  {editing ? (
                    <div className="mb-4">
                      <input value={pHeadline} onChange={e => setPHeadline(e.target.value)}
                        maxLength={120} placeholder="Short headline (e.g. Backend dev at Stripe)"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                                   focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                                   bg-gray-50 transition-all text-gray-700"/>
                      <p className="text-xs text-gray-400 text-right mt-1">{pHeadline.length}/120</p>
                    </div>
                  ) : (
                    user?.headline
                      ? <p className="text-sm text-gray-500 mb-4">{user.headline}</p>
                      : <p className="text-sm text-gray-400 italic mb-4">No headline yet</p>
                  )}

                  <div className="border-t border-gray-100 my-4"/>

                  {/* Bio */}
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">About</p>
                    {editing ? (
                      <div>
                        <textarea value={pBio} onChange={e => setPBio(e.target.value)}
                          rows={4} maxLength={1000} placeholder="Tell others about yourself..."
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none
                                     focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                                     bg-gray-50 transition-all text-gray-700"/>
                        <div className="flex items-center justify-between mt-1.5">
                          <button type="button" onClick={enhanceBio} disabled={!pBio.trim() || aiLoading}
                            className="flex items-center gap-1.5 text-xs text-violet-500 hover:text-violet-600
                                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                            {aiLoading
                              ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                              : '✨'}
                            {aiLoading ? 'Enhancing…' : 'Enhance with AI'}
                          </button>
                          <span className="text-xs text-gray-400">{pBio.length}/1000</span>
                        </div>
                      </div>
                    ) : (
                      user?.bio
                        ? <p className="text-sm text-gray-600 leading-relaxed">{user.bio}</p>
                        : <p className="text-sm text-gray-400 italic">No bio yet. Click "Edit profile" to add one.</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</p>
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ EXPLORE VIEW ════════ */}
          {view === 'explore' && <ExploreView />}
        </div>
      </div>

      {/* ── Modals ── */}
      {showModal && <CreateProjectModal onClose={() => setShowModal(false)} />}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleEditSave}
        />
      )}
      <ConfirmModal
        open={!!pendingDelete} variant="danger" title="Delete project?"
        message={`"${pendingDelete?.name}" and all its schema data will be permanently deleted. This cannot be undone.`}
        confirmText="Delete project" cancelText="Cancel"
        onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ── Sidebar nav item ──────────────────────────────────────────────
function SideNavItem({ icon, label, active, onClick, danger, badge }) {
  const base = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer`
  const cls  = active
    ? `${base} bg-blue-600 text-white shadow-md shadow-blue-900/30`
    : danger
      ? `${base} text-gray-500 hover:bg-red-500/10 hover:text-red-400`
      : `${base} text-gray-500 hover:bg-white/8 hover:text-gray-200`
  return (
    <button onClick={onClick} className={cls}>
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && (
        <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

// ── Friend card (used in Friends view) ───────────────────────────
function FriendCard({ user, actionLoading, onSend, onAccept, onDecline, onUnfriend }) {
  const { friendship_status: status, friendship_id: fid } = user
  const loading = actionLoading === user.id
  const statusBadge = {
    friends:          { label: 'Friends',          cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    request_sent:     { label: 'Request sent',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    request_received: { label: 'Wants to connect', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  }[status]

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100
                    hover:border-gray-200 hover:shadow-sm transition-all group">
      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center
                       font-bold text-white text-sm overflow-hidden
                       ${user.avatar_url ? '' : status === 'friends' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover"/>
          : (user.name || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
          {statusBadge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
        {user.headline && <p className="text-xs text-gray-500 truncate mt-0.5">{user.headline}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {loading ? (
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
        ) : status === 'none' ? (
          <button onClick={() => onSend(user)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg
                       bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Add
          </button>
        ) : status === 'request_sent' ? (
          <button onClick={() => onDecline(user, fid)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200
                       text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors">
            Cancel
          </button>
        ) : status === 'request_received' ? (
          <>
            <button onClick={() => onAccept(user, fid)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm">
              Accept
            </button>
            <button onClick={() => onDecline(user, fid)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200
                         text-gray-500 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors">
              Decline
            </button>
          </>
        ) : status === 'friends' ? (
          <button onClick={() => onUnfriend(user, fid)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200
                       text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50
                       transition-colors opacity-0 group-hover:opacity-100">
            Unfriend
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────
const statColors = {
  blue:    { bg: 'bg-blue-600',   icon: 'bg-blue-500',    text: 'text-white',       sub: 'text-blue-200',  num: 'text-white'    },
  violet:  { bg: 'bg-white',      icon: 'bg-violet-100',  text: 'text-violet-600',  sub: 'text-gray-400',  num: 'text-gray-900' },
  emerald: { bg: 'bg-white',      icon: 'bg-emerald-100', text: 'text-emerald-600', sub: 'text-gray-400',  num: 'text-gray-900' },
  amber:   { bg: 'bg-white',      icon: 'bg-amber-100',   text: 'text-amber-600',   sub: 'text-gray-400',  num: 'text-gray-900' },
  gray:    { bg: 'bg-white',      icon: 'bg-gray-100',    text: 'text-gray-500',    sub: 'text-gray-400',  num: 'text-gray-900' },
}
function StatCard({ label, value, sub, color, icon }) {
  const c = statColors[color]
  return (
    <div className={`${c.bg} rounded-2xl p-5 border border-gray-100 shadow-sm ${color==='blue' ? 'shadow-blue-200' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 ${c.icon} rounded-xl flex items-center justify-center`}>
          <span className={`w-4 h-4 ${c.text}`}>{icon}</span>
        </div>
        <svg className={`w-4 h-4 ${color==='blue' ? 'text-blue-300' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
        </svg>
      </div>
      <p className={`text-[11px] font-medium mb-1 ${color==='blue' ? 'text-blue-200' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${c.num}`}>{value}</p>
      <p className={`text-[11px] mt-1 ${c.sub} flex items-center gap-1`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${color==='blue' ? 'bg-blue-300' : 'bg-gray-300'}`}/>
        {sub}
      </p>
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────────
const PROJECT_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-cyan-500 to-blue-500',
  'from-fuchsia-500 to-pink-600',
]
function ProjectCard({ project, onOpen, onDelete, onEdit, activeCount = 0 }) {
  const date     = new Date(project.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
  const gradient = PROJECT_GRADIENTS[project.id % PROJECT_GRADIENTS.length]
  const initial  = (project.name || 'P')[0].toUpperCase()
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md
                    hover:border-blue-200/60 transition-all duration-200 group overflow-hidden flex flex-col">
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`}/>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md`}>
            <span className="text-white font-bold text-sm">{initial}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full
                               font-semibold border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
                {activeCount} active
              </span>
            )}
            {!project.is_owner && (
              <span className="text-[11px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-semibold border border-violet-100">
                Shared
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border
              ${project.visibility==='public' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
              {project.visibility}
            </span>
          </div>
        </div>
        <h3 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-blue-600 transition-colors">
          {project.name}
        </h3>
        <p className="text-gray-400 text-xs line-clamp-2 min-h-[2rem] leading-relaxed flex-1">
          {project.description || 'No description provided'}
        </p>
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            {date}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onOpen}
              className="flex items-center gap-1.5 text-xs bg-gray-900 hover:bg-blue-600 text-white
                         px-3 py-1.5 rounded-xl font-semibold transition-all duration-200">
              Open
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            {project.is_owner && (
              <>
                <button onClick={onEdit} title="Edit project"
                  className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={onDelete}
                  className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit project modal ────────────────────────────────────────────
function EditProjectModal({ project, onClose, onSave }) {
  const [name,        setName]        = useState(project.name || '')
  const [description, setDescription] = useState(project.description || '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      await onSave(project.id, trimmed, description.trim())
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
         style={{ background:'rgba(0,0,0,0.35)', backdropFilter:'blur(4px)' }}
         onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Project</h2>
            <p className="text-sm text-gray-400 mt-0.5">Update the name or description</p>
          </div>
          <button onClick={onClose}
            className="text-gray-300 hover:text-gray-500 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. E-Commerce Platform"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                         placeholder:text-gray-300 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="What does this schema model?"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                         placeholder:text-gray-300 transition-all"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700
                       border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white
                       rounded-xl transition-all shadow-sm shadow-blue-500/20 disabled:opacity-60
                       flex items-center gap-2">
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
            )}
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create project modal ──────────────────────────────────────────
function CreateProjectModal({ onClose }) {
  const { createProject } = useProjectStore()
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required'); return }
    setLoading(true); setError('')
    try {
      const project = await createProject({ name: name.trim(), description })
      onClose(); navigate(`/projects/${project.id}/designer`)
    } catch { setError('Failed to create project. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
         style={{ background:'rgba(0,0,0,0.35)', backdropFilter:'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Project</h2>
            <p className="text-sm text-gray-400 mt-0.5">Give your schema project a name</p>
          </div>
          <button onClick={onClose}
            className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100 transition-colors -mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-sm">{error}</div>}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project Name <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key==='Enter' && handleSubmit()}
              placeholder="e.g. Hospital Management System" autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"/>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What is this database for?" rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-all"/>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold
                         py-2.5 px-4 rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
              {loading
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg> Creating…</>
                : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────
function GridIcon() {
  return <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
  </svg>
}
function UserIcon() {
  return <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
  </svg>
}
function ShareIcon() {
  return <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
  </svg>
}
function BellIcon() {
  return <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
  </svg>
}
function LogoutIcon() {
  return <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
  </svg>
}
