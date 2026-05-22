import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import useProjectStore from '../store/useProjectStore'
import api from '../services/api'
import ConfirmModal from '../components/ui/ConfirmModal'
import ExploreView from '../components/explore/ExploreView'
import ProfileView from '../components/profile/ProfileView'
import '../services/websocket'   // ensure window.Echo is initialised

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const { projects, loading, fetchProjects, deleteProject, updateProject } = useProjectStore()

  // ── View state — persist to sessionStorage so browser refresh stays on same tab ──
  const [view, setViewRaw] = useState(() => sessionStorage.getItem('dashboard_view') || 'dashboard')
  const [contentVisible, setContentVisible] = useState(true)

  const setView = (v) => {
    if (v === view) return
    sessionStorage.setItem('dashboard_view', v)
    setContentVisible(false)
    setTimeout(() => {
      setViewRaw(v)
      setContentVisible(true)
    }, 130)
  }

  // ── Projects state ────────────────────────────────────────────
  const [showModal,      setShowModal]      = useState(false)
  const [search,         setSearch]         = useState('')
  const [pendingDelete,  setPendingDelete]  = useState(null)
  const [editingProject, setEditingProject] = useState(null)
  const [invitations,        setInvitations]        = useState([])
  const [friendRequestsBell, setFriendRequestsBell] = useState([])
  const [notifications,      setNotifications]      = useState([])
  const [bellTab,            setBellTab]            = useState('invitations')
  const [showBell,           setShowBell]           = useState(false)
  const [friendReqCount,     setFriendReqCount]     = useState(0)
  const bellRef = useRef(null)

  // ── Active-users-per-project (presence badge) ─────────────────
  const [projectActiveUsers, setProjectActiveUsers] = useState({})

  // ── Friends view state ────────────────────────────────────────
  const [friendsList,         setFriendsList]         = useState([])
  const [friendRequests,      setFriendRequests]      = useState([])
  const [friendsLoaded,       setFriendsLoaded]       = useState(false)
  const [friendsTab,          setFriendsTab]          = useState('friends')
  const [friendSearch,        setFriendSearch]        = useState('')
  const [friendSearchRes,     setFriendSearchRes]     = useState([])
  const [friendSearching,     setFriendSearching]     = useState(false)
  const [friendSearchDone,    setFriendSearchDone]    = useState(false)
  const [friendActionLoading, setFriendActionLoading] = useState(null)
  const [friendToast,         setFriendToast]         = useState(null)
  const friendSearchTimer = useRef(null)

  // ── Dashboard filter / sort / view mode ──────────────────────
  const [filterTab, setFilterTab] = useState('all')   // all | mine | shared | public
  const [sortBy,    setSortBy]    = useState('updated') // updated | created | name
  const [viewMode,  setViewMode]  = useState('grid')  // grid | list
  const [activity,        setActivity]        = useState([])
  const [activityLoading, setActivityLoading] = useState(true)

  // ── Bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => { logout(); navigate('/login') })
    fetchProjects()
    fetchInvitations()
    fetchNotifications()
    api.get('/friends/requests').then(r => setFriendReqCount(r.data.length)).catch(() => {})
    api.get('/activity').then(r => { setActivity(r.data || []); setActivityLoading(false) }).catch(() => setActivityLoading(false))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Bell outside-click handler
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Invitations ───────────────────────────────────────────────
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

  const handleBellFriendAccept = async (req) => {
    try {
      await api.post(`/friends/${req.friendship_id}/accept`)
      setFriendRequestsBell(prev => prev.filter(r => r.friendship_id !== req.friendship_id))
      setFriendReqCount(c => Math.max(0, c - 1))
      setFriendsList(prev => [{
        friendship_id: req.friendship_id,
        id: req.id, name: req.name, email: req.email,
        avatar_url: req.avatar_url, headline: req.headline,
      }, ...prev])
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
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.notifications || [])
    } catch {}
  }
  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }
  const clearNotifications = async () => {
    await api.delete('/notifications/clear')
    setNotifications([])
  }

  // Approve / decline an access request straight from the notification bell
  const handleApproveRequest = async (notification) => {
    const { project_id, actor_id } = notification.data || {}
    if (!project_id || !actor_id) return
    try {
      await api.post(`/projects/${project_id}/access-requests/${actor_id}/approve`)
      // Remove this notification from the list immediately
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
    } catch {}
  }
  const handleDeclineRequest = async (notification) => {
    const { project_id, actor_id } = notification.data || {}
    if (!project_id || !actor_id) return
    try {
      await api.post(`/projects/${project_id}/access-requests/${actor_id}/decline`)
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
    } catch {}
  }

  const unreadCount    = notifications.filter(n => !n.read).length
  const totalBellCount = invitations.length + friendRequestsBell.length + unreadCount

  // ── Friends helpers ────────────────────────────────────────────
  const loadFriendsData = async () => {
    if (friendsLoaded) return
    const [fl, rq] = await Promise.all([
      api.get('/friends'), api.get('/friends/requests'),
    ]).catch(() => [{ data: [] }, { data: [] }])
    setFriendsList(fl?.data || [])
    setFriendRequests(rq?.data || [])
    setFriendReqCount((rq?.data || []).length)
    setFriendsLoaded(true)
  }

  useEffect(() => {
    if (view === 'friends') loadFriendsData()
  }, [view])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bell polling — keep invitations & notifications live ──────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInvitations()
      fetchNotifications()
    }, 20000)
    return () => clearInterval(interval)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active-user badges (polling) ──────────────────────────────
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await api.get('/projects/active-counts')
        setProjectActiveUsers(res.data)
      } catch {}
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 10000)
    return () => clearInterval(interval)
  }, [])

  // ── Friend search debounce ─────────────────────────────────────
  useEffect(() => {
    clearTimeout(friendSearchTimer.current)
    if (friendSearch.trim().length < 2) {
      setFriendSearchRes([]); setFriendSearchDone(false); return
    }
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
    setFriendSearchRes(prev =>
      prev.map(u => u.id === userId ? { ...u, friendship_status: status, friendship_id: fid } : u)
    )
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
      setFriendRequestsBell(prev => prev.filter(r => r.friendship_id !== fid))
      setFriendsList(prev => [{
        friendship_id: fid, id: target.id, name: target.name,
        email: target.email, avatar_url: target.avatar_url, headline: target.headline,
      }, ...prev])
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
      setFriendRequestsBell(prev => prev.filter(r => r.friendship_id !== fid))
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
  const handleDelete   = (id, name) => setPendingDelete({ id, name })
  const confirmDelete  = async () => { await deleteProject(pendingDelete.id); setPendingDelete(null) }
  const handleEditSave = async (id, name, description) => {
    await updateProject(id, { name, description })
    setEditingProject(null)
  }
  let filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  if (filterTab === 'mine')   filtered = filtered.filter(p => p.is_owner)
  if (filterTab === 'shared') filtered = filtered.filter(p => !p.is_owner)
  if (filterTab === 'public') filtered = filtered.filter(p => p.visibility === 'public')
  if (sortBy === 'name')    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  if (sortBy === 'created') filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const owned  = projects.filter(p => p.is_owner).length
  const shared = projects.filter(p => !p.is_owner).length

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#f7f5f1] overflow-hidden">

      {/* ════════════════ TOP NAVIGATION ════════════════ */}
      <TopNav
        view={view}
        setView={setView}
        user={user}
        navigate={navigate}
        handleLogout={handleLogout}
        friendReqCount={friendReqCount}
        bellRef={bellRef}
        showBell={showBell}
        setShowBell={setShowBell}
        bellTab={bellTab}
        setBellTab={setBellTab}
        totalBellCount={totalBellCount}
        unreadCount={unreadCount}
        invitations={invitations}
        friendRequestsBell={friendRequestsBell}
        notifications={notifications}
        handleAccept={handleAccept}
        handleDecline={handleDecline}
        handleBellFriendAccept={handleBellFriendAccept}
        handleBellFriendDecline={handleBellFriendDecline}
        markAllRead={markAllRead}
        clearNotifications={clearNotifications}
        handleApproveRequest={handleApproveRequest}
        handleDeclineRequest={handleDeclineRequest}
      />

      {/* ════════════════ SECTION SUB-HEADER ════════════════ */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 shadow-sm">
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

        {view === 'dashboard' && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input type="text" placeholder="Search…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl w-32 sm:w-44 md:w-52
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                           bg-gray-50 transition-all"/>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
                         px-3 sm:px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all
                         hover:shadow-blue-500/30 hover:-translate-y-px active:translate-y-0 whitespace-nowrap">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              <span className="hidden xs:inline sm:inline">New Project</span>
            </button>
          </div>
        )}
      </header>

      {/* ════════════════ CONTENT AREA ════════════════ */}
      <div
        className="flex-1 overflow-y-auto px-6 md:px-8 py-7 bg-[#f7f5f1]"
        style={{ opacity: contentVisible ? 1 : 0, transition: 'opacity 0.13s ease' }}
      >

        {/* ════════ DASHBOARD VIEW ════════ */}
        {view === 'dashboard' && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Projects" value={projects.length} sub="All time"         color="blue"    icon={<GridIcon/>}  />
              <StatCard label="My Projects"    value={owned}           sub="You own these"    color="violet"  icon={<UserIcon/>}  />
              <StatCard label="Shared With Me" value={shared}          sub="Collaborating"    color="emerald" icon={<ShareIcon/>} />
              <StatCard label="Invitations"    value={invitations.length}
                sub={invitations.length > 0 ? 'Awaiting response' : 'All clear'}
                color={invitations.length > 0 ? 'amber' : 'gray'} icon={<BellIcon/>} />
            </div>

            {/* ── Two-column layout: projects left, activity sidebar right ── */}
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">

            {/* ── Filter bar ── */}
            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              {/* Tabs */}
              <div className="flex bg-[#ebe6dd]/60 rounded-xl p-1 gap-0.5">
                {[
                  { id: 'all',    label: 'All'    },
                  { id: 'mine',   label: 'Mine'   },
                  { id: 'shared', label: 'Shared' },
                  { id: 'public', label: 'Public' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setFilterTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                      ${filterTab === tab.id
                        ? 'bg-white text-[#161413] shadow-sm'
                        : 'text-gray-500 hover:text-[#161413]'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="text-xs border border-[#ebe6dd] rounded-xl px-3 py-2 bg-white text-gray-600
                           focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300
                           cursor-pointer shadow-sm">
                <option value="updated">Last updated</option>
                <option value="created">Newest first</option>
                <option value="name">Name A–Z</option>
              </select>

              {/* Result count */}
              <span className="text-xs text-gray-400 hidden sm:block">
                {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                {search ? ` for "${search}"` : ''}
              </span>

              {/* Grid / List toggle */}
              <div className="ml-auto flex gap-1 bg-[#ebe6dd]/60 rounded-xl p-1">
                <button onClick={() => setViewMode('grid')} title="Grid view"
                  className={`p-1.5 rounded-lg transition-all
                    ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#161413]' : 'text-gray-400 hover:text-gray-600'}`}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                  </svg>
                </button>
                <button onClick={() => setViewMode('list')} title="List view"
                  className={`p-1.5 rounded-lg transition-all
                    ${viewMode === 'list' ? 'bg-white shadow-sm text-[#161413]' : 'text-gray-400 hover:text-gray-600'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Loading skeleton ── */}
            {loading && (
              <div className={viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-2'}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-[#ebe6dd] animate-pulse shadow-sm overflow-hidden">
                    {viewMode === 'grid' && <div className="h-28 bg-gray-100"/>}
                    <div className={`p-4 ${viewMode === 'list' ? 'flex items-center gap-4' : ''}`}>
                      {viewMode === 'list' && <div className="w-10 h-10 bg-gray-100 rounded-xl flex-shrink-0"/>}
                      <div className="flex-1">
                        <div className="h-3.5 bg-gray-100 rounded-lg w-3/4 mb-2"/>
                        <div className="h-2.5 bg-gray-50 rounded-lg w-1/2"/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── True empty state (no projects at all) ── */}
            {!loading && projects.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#ebe6dd] shadow-sm p-16 text-center">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-[#161413] mb-1.5">No projects yet</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                  Create your first schema project and start designing your database visually
                </p>
                <button onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 bg-[#161413] hover:bg-orange-600 text-white
                             text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                  </svg>
                  Create your first project
                </button>
              </div>
            )}

            {/* ── Project grid ── */}
            {!loading && projects.length > 0 && viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* "Start new schema" dashed card — always first */}
                <button onClick={() => setShowModal(true)}
                  className="bg-white rounded-2xl border-2 border-dashed border-[#d4c9b8]
                             hover:border-orange-300 hover:bg-orange-50/30 transition-all duration-200
                             flex flex-col items-center justify-center min-h-[224px] group shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100
                                  flex items-center justify-center mb-3
                                  group-hover:bg-orange-100 group-hover:scale-110 transition-all">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-400 group-hover:text-orange-600 transition-colors">
                    Start new schema
                  </p>
                  <p className="text-xs text-gray-300 mt-1">Design your database</p>
                </button>

                {filtered.length === 0 && (
                  <div className="col-span-full text-center py-10">
                    <p className="text-sm text-gray-400">No projects match this filter.</p>
                  </div>
                )}

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

            {/* ── Project list ── */}
            {!loading && projects.length > 0 && viewMode === 'list' && (
              <div className="space-y-2">
                {filtered.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400">No projects match this filter.</p>
                  </div>
                )}
                {filtered.map(project => (
                  <ProjectListItem key={project.id} project={project}
                    onOpen={() => navigate(`/projects/${project.id}/designer`)}
                    onDelete={() => handleDelete(project.id, project.name)}
                    onEdit={() => setEditingProject(project)}
                    activeCount={projectActiveUsers[project.id] || 0}
                  />
                ))}
              </div>
            )}
              </div>{/* end left column */}

              {/* ── Activity sidebar (hidden below lg) ── */}
              <div className="hidden lg:block w-64 xl:w-72 flex-shrink-0 sticky top-0 self-start">
                <ActivitySidebar activity={activity} activityLoading={activityLoading} />
              </div>
            </div>{/* end two-column layout */}
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
          <ProfileView user={user} setUser={setUser} projects={projects} />
        )}

        {/* ════════ EXPLORE VIEW ════════ */}
        {view === 'explore' && <ExploreView />}
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

// ════════════════════════════════════════════════════════════════
// TOP NAVIGATION BAR
// ════════════════════════════════════════════════════════════════
function TopNav({
  view, setView, user, navigate, handleLogout, friendReqCount,
  bellRef, showBell, setShowBell, bellTab, setBellTab,
  totalBellCount, unreadCount,
  invitations, friendRequestsBell, notifications,
  handleAccept, handleDecline,
  handleBellFriendAccept, handleBellFriendDecline,
  markAllRead, clearNotifications,
  handleApproveRequest, handleDeclineRequest,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef  = useRef(null)
  const mobileRef  = useRef(null)

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
      if (mobileRef.current && !mobileRef.current.contains(e.target)) setMobileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navLinks = [
    { id: 'dashboard', label: 'Projects' },
    { id: 'explore',   label: 'Explore'  },
    { id: 'friends',   label: 'Friends', badge: friendReqCount > 0 ? friendReqCount : null },
    { id: 'profile',   label: 'Profile'  },
  ]

  const handleNavClick = (id) => {
    setView(id)
    setMobileOpen(false)
  }

  return (
    <nav className="bg-white border-b border-gray-200 flex-shrink-0 z-40" ref={mobileRef}>
      <div className="px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center flex-shrink-0 mr-6">
          <img src="/logo_black.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>

        {/* ── Desktop nav links ── */}
        <div className="hidden md:flex items-center h-full flex-1">
          {navLinks.map(link => (
            <button key={link.id} onClick={() => handleNavClick(link.id)}
              className={`relative h-16 flex items-center gap-2 px-4 text-sm font-medium transition-colors
                ${view === link.id
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-800'}`}>
              {link.label}
              {link.badge != null && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
              {/* Active underline indicator */}
              {view === link.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Right side: bell + avatar + hamburger ── */}
        <div className="flex items-center gap-1.5">

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
              <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                   style={{ width: 'min(340px, calc(100vw - 1rem))' }}>
                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                  <button onClick={() => setBellTab('invitations')}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5
                      ${bellTab === 'invitations' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600'}`}>
                    Invitations
                    {(invitations.length + friendRequestsBell.length) > 0 && (
                      <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                        {invitations.length + friendRequestsBell.length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setBellTab('notifications'); markAllRead() }}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5
                      ${bellTab === 'notifications' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-600'}`}>
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
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm
                                  ${n.type === 'invitation_accepted'      ? 'bg-emerald-100' :
                                    n.type === 'project_starred'          ? 'bg-amber-100'   :
                                    n.type === 'project_liked'            ? 'bg-red-100'     :
                                    n.type === 'project_forked'           ? 'bg-violet-100'  :
                                    n.type === 'new_comment'              ? 'bg-blue-100'    :
                                    n.type === 'new_follower'             ? 'bg-teal-100'    :
                                    n.type === 'friend_request_received'  ? 'bg-pink-100'    :
                                    n.type === 'friend_request_accepted'  ? 'bg-emerald-100' :
                                    n.type === 'access_requested'         ? 'bg-violet-100'  :
                                    n.type === 'access_request_approved'  ? 'bg-emerald-100' :
                                    n.type === 'access_request_declined'  ? 'bg-red-100'     :
                                    'bg-gray-100'}`}>
                                  {n.type === 'invitation_accepted'      ? '✓'  :
                                   n.type === 'project_starred'          ? '★'  :
                                   n.type === 'project_liked'            ? '♥'  :
                                   n.type === 'project_forked'           ? '⑂'  :
                                   n.type === 'new_comment'              ? '💬' :
                                   n.type === 'new_follower'             ? '👤' :
                                   n.type === 'friend_request_received'  ? '🤝' :
                                   n.type === 'friend_request_accepted'  ? '✓'  :
                                   n.type === 'access_requested'         ? '🔑' :
                                   n.type === 'access_request_approved'  ? '✓'  :
                                   n.type === 'access_request_declined'  ? '✕'  :
                                   '🔔'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    {new Date(n.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                                  </p>
                                  {/* Accept / Decline buttons for access requests */}
                                  {n.type === 'access_requested' && (
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={() => handleApproveRequest(n)}
                                        className="flex-1 py-1 text-[11px] font-semibold rounded-lg
                                                   bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleDeclineRequest(n)}
                                        className="flex-1 py-1 text-[11px] font-semibold rounded-lg
                                                   bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
                                        Decline
                                      </button>
                                    </div>
                                  )}
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

          {/* Avatar dropdown */}
          <div className="relative" ref={avatarRef}>
            <button onClick={() => setAvatarOpen(v => !v)}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-all">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-600/10 flex items-center justify-center
                              ring-2 ring-gray-200 flex-shrink-0">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover"
                         onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                  : null}
                <span className="text-xs font-bold text-blue-600"
                      style={{ display: user?.avatar_url ? 'none' : 'flex' }}>
                  {(user?.name || 'U')[0].toUpperCase()}
                </span>
              </div>
              {/* Name (hidden on small screens) */}
              <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                {user?.name?.split(' ')[0]}
              </span>
              {/* Chevron */}
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${avatarOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {avatarOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                </div>
                {/* View Profile */}
                <button onClick={() => { setAvatarOpen(false); setView('profile') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700
                             hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  View Profile
                </button>
                {/* Admin Panel — only for admins */}
                {user?.is_admin && (
                  <button onClick={() => { setAvatarOpen(false); navigate('/admin') }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700
                               hover:bg-gray-50 transition-colors text-left">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    Admin Panel
                  </button>
                )}
                <div className="border-t border-gray-100 my-1"/>
                {/* Sign out */}
                <button onClick={() => { setAvatarOpen(false); handleLogout() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500
                             hover:bg-red-50 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Hamburger (mobile only) */}
          <button onClick={() => setMobileOpen(v => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl
                       hover:bg-gray-100 text-gray-500 transition-all ml-1">
            {mobileOpen
              ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            }
          </button>
        </div>
      </div>

      {/* ── Mobile slide-down menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {navLinks.map(link => (
            <button key={link.id} onClick={() => handleNavClick(link.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                ${view === link.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 hover:bg-gray-100'}`}>
              {link.label}
              {link.badge != null && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${view === link.id ? 'bg-white/25 text-white' : 'bg-red-500 text-white'}`}>
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </button>
          ))}
          {user?.is_admin && (
            <button onClick={() => { navigate('/admin'); setMobileOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                         text-gray-600 hover:bg-gray-100 transition-all">
              Admin Panel
            </button>
          )}
        </div>
      )}
    </nav>
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
  blue:    { bg: 'bg-white', icon: 'bg-blue-100',    text: 'text-blue-600',    sub: 'text-gray-400', num: 'text-gray-900' },
  violet:  { bg: 'bg-white', icon: 'bg-violet-100',  text: 'text-violet-600',  sub: 'text-gray-400', num: 'text-gray-900' },
  emerald: { bg: 'bg-white', icon: 'bg-emerald-100', text: 'text-emerald-600', sub: 'text-gray-400', num: 'text-gray-900' },
  amber:   { bg: 'bg-white', icon: 'bg-amber-100',   text: 'text-amber-600',   sub: 'text-gray-400', num: 'text-gray-900' },
  gray:    { bg: 'bg-white', icon: 'bg-gray-100',    text: 'text-gray-500',    sub: 'text-gray-400', num: 'text-gray-900' },
}
function StatCard({ label, value, sub, color, icon }) {
  const c = statColors[color]
  return (
    <div className={`${c.bg} rounded-2xl p-5 border border-[#ebe6dd] shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 ${c.icon} rounded-xl flex items-center justify-center`}>
          <span className={`w-4 h-4 ${c.text}`}>{icon}</span>
        </div>
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
        </svg>
      </div>
      <p className="text-[11px] font-medium mb-1 text-gray-500">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${c.num}`}>{value}</p>
      <p className={`text-[11px] mt-1 ${c.sub} flex items-center gap-1`}>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300"/>
        {sub}
      </p>
    </div>
  )
}

// ── Mini SVG schema preview ───────────────────────────────────────
const SVG_PALETTE = {
  blue:    { bg: '#eff6ff', rect: '#dbeafe', hdr: '#93c5fd', text: '#1d4ed8', stroke: '#3b82f6', dot: '#bfdbfe' },
  violet:  { bg: '#f5f3ff', rect: '#ede9fe', hdr: '#c4b5fd', text: '#6d28d9', stroke: '#8b5cf6', dot: '#ddd6fe' },
  emerald: { bg: '#ecfdf5', rect: '#d1fae5', hdr: '#6ee7b7', text: '#065f46', stroke: '#10b981', dot: '#a7f3d0' },
  orange:  { bg: '#fff7ed', rect: '#ffedd5', hdr: '#fdba74', text: '#9a3412', stroke: '#f97316', dot: '#fed7aa' },
  cyan:    { bg: '#ecfeff', rect: '#cffafe', hdr: '#67e8f9', text: '#164e63', stroke: '#06b6d4', dot: '#a5f3fc' },
  rose:    { bg: '#fff1f2', rect: '#ffe4e6', hdr: '#fda4af', text: '#9f1239', stroke: '#f43f5e', dot: '#fecdd3' },
}
const _SVG_TABLES = ['users','orders','products','categories','posts','tags','roles','sessions','payments','reviews','items','events']
const _SVG_FIELDS = ['id','name','email','type','status','created_at','amount','user_id','title','price','slug','uuid']
const _SVG_LAYOUTS = [
  [{x:6, y:14},{x:82,y:10},{x:44,y:56}],
  [{x:4, y:8 },{x:70,y:4 },{x:70,y:54}],
  [{x:8, y:4 },{x:82,y:22},{x:22,y:56}],
  [{x:4, y:10},{x:68,y:8 },{x:36,y:56}],
  [{x:10,y:6 },{x:80,y:6 },{x:44,y:56}],
  [{x:6, y:8 },{x:74,y:20},{x:6, y:54},{x:74,y:54}],
]
function SchemaPreviewSVG({ projectId, colorId, thumbnailNodes = [] }) {
  const c      = SVG_PALETTE[colorId] || SVG_PALETTE.blue
  const layout = _SVG_LAYOUTS[projectId % _SVG_LAYOUTS.length]
  const pid    = `dp${projectId}`
  const W = 56, H = 33
  return (
    <svg viewBox="0 0 160 100" width="100%" height="100%"
         style={{ position: 'absolute', inset: 0, background: c.bg }}>
      <defs>
        <pattern id={pid} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill={c.dot} fillOpacity="0.8"/>
        </pattern>
      </defs>
      <rect width="160" height="100" fill={`url(#${pid})`}/>
      {/* connector line */}
      {layout.length >= 2 && (
        <line x1={layout[0].x + W} y1={layout[0].y + 11}
              x2={layout[1].x}     y2={layout[1].y + 11}
              stroke={c.stroke} strokeOpacity="0.4" strokeWidth="1.2" strokeDasharray="4,3"/>
      )}
      {layout.map((pos, i) => {
        const name = thumbnailNodes[i] || _SVG_TABLES[(projectId * 3 + i * 7) % _SVG_TABLES.length]
        const f1   = _SVG_FIELDS[(projectId + i * 4)     % _SVG_FIELDS.length]
        const f2   = _SVG_FIELDS[(projectId + i * 4 + 3) % _SVG_FIELDS.length]
        return (
          <g key={i}>
            <rect x={pos.x} y={pos.y} width={W} height={H} rx="3"
                  fill={c.rect} stroke={c.stroke} strokeOpacity="0.45" strokeWidth="0.8"/>
            <rect x={pos.x} y={pos.y} width={W} height="10" rx="3" fill={c.hdr} fillOpacity="0.75"/>
            <rect x={pos.x} y={pos.y + 7} width={W} height="3" fill={c.hdr} fillOpacity="0.75"/>
            <text x={pos.x + 4} y={pos.y + 7.5} fontSize="5.5" fontWeight="700" fill={c.text}>{name}</text>
            <text x={pos.x + 4} y={pos.y + 18}  fontSize="4"   fill={c.text} fillOpacity="0.7">· {f1}</text>
            <text x={pos.x + 4} y={pos.y + 25}  fontSize="4"   fill={c.text} fillOpacity="0.7">· {f2}</text>
            <text x={pos.x + 4} y={pos.y + 31}  fontSize="3.5" fill={c.text} fillOpacity="0.4">···</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Project card (grid) ───────────────────────────────────────────
const CARD_COLORS = [
  { bg: 'bg-blue-50',    id: 'blue'    },
  { bg: 'bg-violet-50',  id: 'violet'  },
  { bg: 'bg-emerald-50', id: 'emerald' },
  { bg: 'bg-orange-50',  id: 'orange'  },
  { bg: 'bg-cyan-50',    id: 'cyan'    },
  { bg: 'bg-rose-50',    id: 'rose'    },
]
function ProjectCard({ project, onOpen, onDelete, onEdit, activeCount = 0 }) {
  const card = CARD_COLORS[project.id % CARD_COLORS.length]
  const date = new Date(project.updated_at || project.created_at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className="bg-white rounded-2xl border border-[#ebe6dd] shadow-sm hover:shadow-md
                    hover:border-[#d4c9b8] transition-all duration-200 group overflow-hidden flex flex-col">
      {/* SVG mini-canvas preview */}
      <div className={`h-28 ${card.bg} relative overflow-hidden flex-shrink-0`}>
        <SchemaPreviewSVG projectId={project.id} colorId={card.id} thumbnailNodes={project.thumbnail_nodes || []} />
        <div className="absolute top-2 right-2 flex gap-1 flex-wrap justify-end">
          {activeCount > 0 && (
            <span className="text-[10px] bg-white/90 text-emerald-700 px-2 py-0.5 rounded-full
                             font-semibold border border-emerald-200 flex items-center gap-1 backdrop-blur-sm shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
              {activeCount}
            </span>
          )}
          {!project.is_owner && (
            <span className="text-[10px] bg-white/90 text-violet-600 px-2 py-0.5 rounded-full font-semibold shadow-sm">
              Shared
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white/90 shadow-sm
            ${project.visibility === 'public' ? 'text-emerald-600' : 'text-gray-500'}`}>
            {project.visibility}
          </span>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-bold text-[#161413] text-sm mb-1 truncate group-hover:text-orange-600 transition-colors">
          {project.name}
        </h3>
        <p className="text-gray-400 text-xs line-clamp-2 min-h-[2rem] leading-relaxed flex-1">
          {project.description || 'No description provided'}
        </p>
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#ebe6dd]">
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {date}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onOpen}
              className="flex items-center gap-1.5 text-xs bg-[#161413] hover:bg-[#3d3633] text-white
                         px-3 py-1.5 rounded-xl font-semibold transition-all duration-200">
              Open
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            {project.is_owner && (
              <>
                <button onClick={onEdit} title="Edit project"
                  className="p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
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

// ── Project list item (list view) ─────────────────────────────────
function ProjectListItem({ project, onOpen, onDelete, onEdit, activeCount = 0 }) {
  const card = CARD_COLORS[project.id % CARD_COLORS.length]
  const date = new Date(project.updated_at || project.created_at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className="bg-white rounded-xl border border-[#ebe6dd] shadow-sm hover:shadow-md hover:border-[#d4c9b8]
                    transition-all group flex items-center gap-4 p-4">
      <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center flex-shrink-0 border border-[#ebe6dd]`}>
        <span className="text-sm font-bold text-gray-600">{(project.name || 'P')[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-[#161413] text-sm truncate group-hover:text-orange-600 transition-colors">
            {project.name}
          </h3>
          {!project.is_owner && (
            <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-semibold border border-violet-100">
              Shared
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border
            ${project.visibility === 'public' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
            {project.visibility}
          </span>
          {activeCount > 0 && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
              {activeCount} active
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">
          {project.description || 'No description'} · {date}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onOpen}
          className="flex items-center gap-1.5 text-xs bg-[#161413] hover:bg-[#3d3633] text-white
                     px-3 py-1.5 rounded-xl font-semibold transition-all">
          Open
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
        {project.is_owner && (
          <>
            <button onClick={onEdit} title="Edit"
              className="p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
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
  )
}

// ── Activity sidebar helpers ──────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)     return 'just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ACTIVITY_DOTS = {
  saved_version:        'bg-blue-400',
  invited_collaborator: 'bg-purple-400',
  posted_comment:       'bg-sky-400',
  forked_schema:        'bg-orange-400',
}

function getActivityLabel(item) {
  const first   = item.user?.name?.split(' ')[0] || 'Someone'
  const project = item.project?.name ? `"${item.project.name}"` : 'a project'
  return {
    saved_version:        <><strong>{first}</strong> saved a version of <strong>{project}</strong></>,
    invited_collaborator: <><strong>{first}</strong> invited {item.metadata?.invitee_name || 'someone'} to <strong>{project}</strong></>,
    posted_comment:       <><strong>{first}</strong> commented on <strong>{project}</strong></>,
    forked_schema:        <><strong>{first}</strong> forked <strong>{project}</strong></>,
  }[item.action] || <><strong>{first}</strong> acted on <strong>{project}</strong></>
}

function ActivitySidebar({ activity = [], activityLoading = false }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ebe6dd] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe6dd]">
        <p className="text-[11px] font-bold text-[#161413] uppercase tracking-widest">Recent Activity</p>
        <span className="text-[11px] text-gray-400 font-medium">Latest</span>
      </div>
      <div className="divide-y divide-[#ebe6dd]">
        {activityLoading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="px-4 py-3 flex items-start gap-2.5 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0 mt-1.5"/>
              <div className="flex-1">
                <div className="h-2.5 bg-gray-100 rounded w-4/5 mb-1.5"/>
                <div className="h-2 bg-gray-50 rounded w-1/3"/>
              </div>
            </div>
          ))
        ) : activity.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-400">No recent activity yet</p>
          </div>
        ) : (
          activity.slice(0, 10).map(item => (
            <ActivitySidebarItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  )
}

function ActivitySidebarItem({ item }) {
  const dot = ACTIVITY_DOTS[item.action] || 'bg-gray-300'
  return (
    <div className="px-4 py-3 flex items-start gap-2.5 hover:bg-[#f7f5f1] transition-colors">
      <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 mt-[5px]`}/>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#161413] leading-snug">{getActivityLabel(item)}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(item.created_at)}</p>
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
         style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
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
              autoFocus type="text" value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100} placeholder="e.g. E-Commerce Platform"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                         placeholder:text-gray-300 transition-all"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Description <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} maxLength={500} placeholder="What does this schema model?"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400
                         placeholder:text-gray-300 transition-all"/>
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
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
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
         style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g. Hospital Management System" autoFocus
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"/>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
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
