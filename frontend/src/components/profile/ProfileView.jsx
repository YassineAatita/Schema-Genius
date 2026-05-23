import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera, Sparkles, Check, User, Bell,
  Star, Heart, GitFork, MessageCircle,
  UserPlus, Users, Mail, Trophy,
} from 'lucide-react'
import api from '../../services/api'

// ── Constants ────────────────────────────────────────────────────────────────
const USER_TYPES = [
  { value: 'student',   label: 'Student',    emoji: '🎓' },
  { value: 'developer', label: 'Developer',  emoji: '💻' },
  { value: 'designer',  label: 'Designer',   emoji: '🎨' },
  { value: 'fullstack', label: 'Full-Stack', emoji: '⚡' },
  { value: 'other',     label: 'Other',      emoji: '🌐' },
]

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']

const NOTIF_SETTINGS = [
  {
    key:         'starred_schema',
    label:       'Someone stars my schema',
    description: 'Receive an email when your schema earns a star',
    icon:        <Star className="w-4 h-4"/>,
    color:       'bg-amber-50 text-amber-500',
  },
  {
    key:         'liked_schema',
    label:       'Someone likes my schema',
    description: 'Receive an email when someone likes your schema',
    icon:        <Heart className="w-4 h-4"/>,
    color:       'bg-red-50 text-red-500',
  },
  {
    key:         'forked_schema',
    label:       'Someone forks my schema',
    description: 'Receive an email when your schema is forked',
    icon:        <GitFork className="w-4 h-4"/>,
    color:       'bg-violet-50 text-violet-500',
  },
  {
    key:         'commented_schema',
    label:       'Someone comments on my schema',
    description: 'Receive an email on new comments',
    icon:        <MessageCircle className="w-4 h-4"/>,
    color:       'bg-blue-50 text-blue-500',
  },
  {
    key:         'friend_request_received',
    label:       'Friend request received',
    description: 'Get an email when someone sends you a friend request',
    icon:        <UserPlus className="w-4 h-4"/>,
    color:       'bg-teal-50 text-teal-500',
  },
  {
    key:         'friend_request_accepted',
    label:       'Friend request accepted',
    description: 'Get an email when your friend request is accepted',
    icon:        <Users className="w-4 h-4"/>,
    color:       'bg-emerald-50 text-emerald-600',
  },
  {
    key:         'collaboration_invited',
    label:       'Collaboration invitation received',
    description: 'Get an email when you are invited to a project',
    icon:        <Mail className="w-4 h-4"/>,
    color:       'bg-indigo-50 text-indigo-500',
  },
  {
    key:         'schema_of_the_week',
    label:       'Schema of the Week announcement',
    description: 'Weekly highlight of featured community schemas',
    icon:        <Trophy className="w-4 h-4"/>,
    color:       'bg-amber-50 text-amber-600',
  },
]

// ── Toggle switch — cream theme ───────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
                  border-2 border-transparent transition-colors duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-[#161413]/20 focus:ring-offset-1
                  disabled:cursor-not-allowed disabled:opacity-60
                  ${checked ? 'bg-[#161413]' : 'bg-[#d4c9b8]'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white
                    shadow ring-0 transition duration-200 ease-in-out
                    ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}

// ── Stat box — cream theme ────────────────────────────────────────────────────
function StatBox({ value, label }) {
  return (
    <div className="bg-[#f7f5f1] rounded-xl p-2.5 text-center border border-[#ebe6dd]">
      <p className="text-base font-bold text-[#161413] leading-none mb-0.5">
        {value ?? <span className="text-[#d4c9b8]">—</span>}
      </p>
      <p className="text-[9px] text-[#8c7b6e] font-medium leading-tight">{label}</p>
    </div>
  )
}

// ── Heatmap color ramp (cream → coral) ────────────────────────────────────────
function heatmapColor(count) {
  if (count === 0) return '#ebe6dd'
  if (count <= 2)  return '#fbd0bc'
  if (count <= 5)  return '#f4a98a'
  if (count <= 9)  return '#e87047'
  return '#c94e24'
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProfileView({ user, setUser, projects }) {
  const fileRef = useRef()

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('edit')

  // ── Edit-profile state ────────────────────────────────────────────────────
  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [aiLoading,     setAiLoading]     = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [flashMsg,      setFlashMsg]      = useState(null) // { text, type }
  const [pName,         setPName]         = useState('')
  const [pUserType,     setPUserType]     = useState('developer')
  const [pHeadline,     setPHeadline]     = useState('')
  const [pBio,          setPBio]          = useState('')
  const [avatarPreview, setAvatarPreview] = useState(null)

  // ── Profile stats ─────────────────────────────────────────────────────────
  const [profileStats, setProfileStats] = useState(null)

  // ── Activity heatmap (last 30 days) ──────────────────────────────────────
  const [heatmapData, setHeatmapData] = useState(null)

  // ── Notification prefs ────────────────────────────────────────────────────
  const [notifPrefs,  setNotifPrefs]  = useState(null)
  const [notifLoading,setNotifLoading]= useState(false)
  const [notifSaving, setNotifSaving] = useState(null)   // key currently being saved
  const [notifSaved,  setNotifSaved]  = useState(false)

  // ── Sync form with user object ────────────────────────────────────────────
  useEffect(() => {
    setPName(user?.name || '')
    setPUserType(user?.user_type || 'developer')
    setPHeadline(user?.headline || '')
    setPBio(user?.bio || '')
    setAvatarPreview(user?.avatar_url || null)
  }, [user])

  // ── Fetch follower / following / public-schema / stars / forks stats ─────
  useEffect(() => {
    if (!user?.id) return
    api.get(`/users/${user.id}`)
      .then(r => setProfileStats(r.data.stats))
      .catch(() => {})
  }, [user?.id])

  // ── Fetch activity heatmap ────────────────────────────────────────────────
  useEffect(() => {
    api.get('/profile/heatmap')
      .then(r => setHeatmapData(r.data))
      .catch(() => {})
  }, [])

  // ── Load notification prefs when tab opens (lazy, only once) ─────────────
  useEffect(() => {
    if (tab !== 'notifications' || notifPrefs !== null) return
    setNotifLoading(true)
    api.get('/profile/notification-preferences')
      .then(r => setNotifPrefs(r.data))
      .catch(() => {})
      .finally(() => setNotifLoading(false))
  }, [tab])  // intentionally excludes notifPrefs to avoid re-fetching

  // ── Flash helper ──────────────────────────────────────────────────────────
  function flash(text, type = 'success') {
    setFlashMsg({ text, type })
    setTimeout(() => setFlashMsg(null), 3000)
  }

  // ── Avatar upload ─────────────────────────────────────────────────────────
  async function onAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      flash('Only JPEG, PNG, GIF, or WebP images are allowed', 'error')
      e.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      flash(`Image must be under 2 MB (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB)`, 'error')
      e.target.value = ''
      return
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
    } catch {
      flash('Upload failed. Please try again.', 'error')
    } finally {
      setAvatarLoading(false)
      e.target.value = ''
    }
  }

  // ── AI bio enhancement ────────────────────────────────────────────────────
  async function enhanceBio() {
    if (!pBio.trim()) return
    setAiLoading(true)
    try {
      const res = await api.post('/ai/enhance-bio', { bio: pBio, user_type: pUserType })
      setPBio(res.data.bio)
    } catch {
      flash('AI enhancement failed', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function saveProfile() {
    setSaving(true)
    try {
      await api.put('/profile', { name: pName, user_type: pUserType, headline: pHeadline, bio: pBio })
      const me = await api.get('/auth/me')
      setUser(me.data)
      setEditing(false)
      flash('Profile saved!')
    } catch (err) {
      flash(err.response?.data?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setPName(user?.name || '')
    setPUserType(user?.user_type || 'developer')
    setPHeadline(user?.headline || '')
    setPBio(user?.bio || '')
    setAvatarPreview(user?.avatar_url || null)
    setEditing(false)
  }

  // ── Notification toggle ───────────────────────────────────────────────────
  async function handleNotifToggle(key, newValue) {
    setNotifSaving(key)
    try {
      const res = await api.put('/profile/notification-preferences', { [key]: newValue })
      setNotifPrefs(res.data)
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 2000)
    } catch {}
    setNotifSaving(null)
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const typeInfo      = USER_TYPES.find(t => t.value === (user?.user_type || pUserType)) || USER_TYPES[1]
  const totalProjects = projects?.length ?? 0

  // Heatmap: array of [date, count] pairs in chronological order
  const heatmapDays  = heatmapData ? Object.entries(heatmapData) : []
  const activeDays   = heatmapDays.filter(([, c]) => c > 0).length

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 max-w-5xl mx-auto">

      {/* ══════════════════ LEFT: User card ══════════════════ */}
      <div>
        <div className="bg-white rounded-2xl border border-[#ebe6dd] shadow-sm overflow-hidden sticky top-6">

          {/* ── Decorative banner — cream dot grid with schema-like lines ── */}
          <div className="h-24 relative overflow-hidden" style={{ background: '#e8e0d4' }}>
            <svg width="100%" height="100%" className="absolute inset-0" aria-hidden="true">
              {/* Repeating dot grid */}
              <defs>
                <pattern id="profile-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                  <circle cx="9" cy="9" r="1" fill="#b8a898" opacity="0.55"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#profile-dots)"/>
              {/* Schema-like table boxes and connecting lines */}
              <rect x="14"  y="8"  width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.35"/>
              <rect x="88"  y="8"  width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.35"/>
              <rect x="162" y="8"  width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.35"/>
              <rect x="236" y="8"  width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.35"/>
              <rect x="51"  y="36" width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.3"/>
              <rect x="125" y="36" width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.3"/>
              <rect x="199" y="36" width="38" height="20" rx="4" fill="none" stroke="#b8a898" strokeWidth="0.9" opacity="0.3"/>
              {/* Connectors */}
              <line x1="52"  y1="18" x2="88"  y2="18" stroke="#b8a898" strokeWidth="0.8" opacity="0.3"/>
              <line x1="126" y1="18" x2="162" y2="18" stroke="#b8a898" strokeWidth="0.8" opacity="0.3"/>
              <line x1="200" y1="18" x2="236" y2="18" stroke="#b8a898" strokeWidth="0.8" opacity="0.3"/>
              <line x1="33"  y1="28" x2="70"  y2="36" stroke="#b8a898" strokeWidth="0.8" opacity="0.25"/>
              <line x1="107" y1="28" x2="144" y2="36" stroke="#b8a898" strokeWidth="0.8" opacity="0.25"/>
              <line x1="181" y1="28" x2="218" y2="36" stroke="#b8a898" strokeWidth="0.8" opacity="0.25"/>
              {/* Field lines inside boxes */}
              <line x1="20"  y1="15" x2="46"  y2="15" stroke="#b8a898" strokeWidth="0.6" opacity="0.4"/>
              <line x1="94"  y1="15" x2="120" y2="15" stroke="#b8a898" strokeWidth="0.6" opacity="0.4"/>
              <line x1="168" y1="15" x2="194" y2="15" stroke="#b8a898" strokeWidth="0.6" opacity="0.4"/>
            </svg>
          </div>

          <div className="px-5 pb-5">

            {/* Avatar row */}
            <div className="flex items-end justify-between -mt-10 mb-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-md overflow-hidden
                                bg-[#ebe6dd] flex items-center justify-center relative">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover"/>
                    : <span className="text-3xl font-bold text-[#8c7b6e]">
                        {(user?.name || 'U')[0].toUpperCase()}
                      </span>
                  }
                  {avatarLoading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    </div>
                  )}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#161413] hover:bg-[#3d3633] rounded-full
                             flex items-center justify-center shadow-md border-2 border-white
                             opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-3 h-3 text-white"/>
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                       className="hidden" onChange={onAvatarChange}/>
              </div>
              <p className="text-[10px] text-[#8c7b6e] pb-1">JPG · PNG · max 2 MB</p>
            </div>

            {/* Name */}
            <h2 className="text-lg font-bold text-[#161413] mb-1.5">{user?.name}</h2>

            {/* User-type badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                             bg-[#f0ebe3] text-[#5a4a3f] border border-[#ebe6dd] mb-2">
              {typeInfo.emoji} {typeInfo.label}
            </span>

            {/* Headline */}
            {user?.headline && (
              <p className="text-sm text-[#5a4a3f] leading-relaxed mt-1.5">{user.headline}</p>
            )}

            {/* Email */}
            <p className="text-xs text-[#8c7b6e] flex items-center gap-1.5 mt-3 mb-4">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span className="truncate">{user?.email}</span>
            </p>

            {/* ── Stats grid — 3 columns × 2 rows ── */}
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              <StatBox value={totalProjects}                label="Projects"  />
              <StatBox value={profileStats?.public_schemas} label="Public"    />
              <StatBox value={profileStats?.total_stars}    label="Stars"     />
              <StatBox value={profileStats?.total_forks}    label="Forks"     />
              <StatBox value={profileStats?.followers}      label="Followers" />
              <StatBox value={profileStats?.following}      label="Following" />
            </div>

            {/* ── Activity heatmap — 30 days ── */}
            {heatmapData && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold text-[#8c7b6e] uppercase tracking-wider">
                    Last 30 days
                  </p>
                  <p className="text-[10px] text-[#8c7b6e]">
                    {activeDays} active day{activeDays !== 1 ? 's' : ''}
                  </p>
                </div>
                {/* 30 colored squares in one row */}
                <div
                  className="grid gap-[2px]"
                  style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}
                >
                  {heatmapDays.map(([date, count]) => (
                    <div
                      key={date}
                      title={`${date}: ${count} action${count !== 1 ? 's' : ''}`}
                      style={{ backgroundColor: heatmapColor(count) }}
                      className="aspect-square rounded-[2px] cursor-default"
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-1.5 mt-1.5 justify-end">
                  <span className="text-[9px] text-[#8c7b6e]">Less</span>
                  {['#ebe6dd', '#fbd0bc', '#f4a98a', '#e87047', '#c94e24'].map(c => (
                    <div key={c} className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: c }}/>
                  ))}
                  <span className="text-[9px] text-[#8c7b6e]">More</span>
                </div>
              </div>
            )}

            {/* Public profile link */}
            {user?.id && (
              <Link to={`/u/${user.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#ebe6dd]
                           text-xs font-semibold text-[#5a4a3f] hover:border-[#d4c9b8] hover:text-[#161413]
                           hover:bg-[#f0ebe3] transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                View public profile
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════ RIGHT: Tabbed content ══════════════════ */}
      <div className="bg-white rounded-2xl border border-[#ebe6dd] shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-[#ebe6dd] px-6 pt-5 gap-1">
          <button onClick={() => setTab('edit')}
            className={`flex items-center gap-2 px-1 pb-3 mr-5 text-sm font-semibold border-b-2 -mb-px
                        transition-colors
              ${tab === 'edit'
                ? 'text-[#161413] border-[#161413]'
                : 'text-[#8c7b6e] border-transparent hover:text-[#5a4a3f] hover:border-[#d4c9b8]'}`}>
            <User className="w-4 h-4"/>
            Edit Profile
          </button>
          <button onClick={() => setTab('notifications')}
            className={`flex items-center gap-2 px-1 pb-3 text-sm font-semibold border-b-2 -mb-px
                        transition-colors
              ${tab === 'notifications'
                ? 'text-[#161413] border-[#161413]'
                : 'text-[#8c7b6e] border-transparent hover:text-[#5a4a3f] hover:border-[#d4c9b8]'}`}>
            <Bell className="w-4 h-4"/>
            Notification Settings
          </button>
        </div>

        <div className="p-6">

          {/* ──────── Tab 1: Edit Profile ──────── */}
          {tab === 'edit' && (
            <div>

              {/* Flash banner */}
              {flashMsg && (
                <div className={`mb-5 flex items-center gap-2 px-4 py-3 rounded-xl text-sm
                  ${flashMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border border-red-200 text-red-600'}`}>
                  {flashMsg.type === 'success'
                    ? <Check className="w-4 h-4 flex-shrink-0"/>
                    : <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                  }
                  {flashMsg.text}
                </div>
              )}

              <div className="space-y-5">

                {/* ── Name ── */}
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3f] uppercase tracking-wider mb-1.5">
                    Name
                  </label>
                  {editing ? (
                    <input value={pName} onChange={e => setPName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-2.5 border border-[#ebe6dd] rounded-xl text-sm text-[#161413]
                                 bg-[#f7f5f1] focus:outline-none focus:ring-2 focus:ring-[#161413]/10
                                 focus:border-[#d4c9b8] transition-all"/>
                  ) : (
                    <div className="px-4 py-2.5 bg-[#f7f5f1] border border-[#ebe6dd] rounded-xl text-sm text-[#161413]">
                      {user?.name || <span className="text-[#8c7b6e] italic">Not set</span>}
                    </div>
                  )}
                </div>

                {/* ── Role ── */}
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3f] uppercase tracking-wider mb-1.5">
                    Role
                  </label>
                  {editing ? (
                    <div className="flex flex-wrap gap-2">
                      {USER_TYPES.map(t => (
                        <button key={t.value} type="button" onClick={() => setPUserType(t.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            border transition-all
                            ${pUserType === t.value
                              ? 'border-[#161413] bg-[#161413] text-white'
                              : 'border-[#ebe6dd] text-[#5a4a3f] hover:border-[#d4c9b8] hover:text-[#161413]'}`}>
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 bg-[#f7f5f1] border border-[#ebe6dd] rounded-xl text-sm text-[#161413]">
                      {typeInfo.emoji} {typeInfo.label}
                    </div>
                  )}
                </div>

                {/* ── Headline ── */}
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3f] uppercase tracking-wider mb-1.5">
                    Headline
                  </label>
                  {editing ? (
                    <div>
                      <input value={pHeadline} onChange={e => setPHeadline(e.target.value)}
                        maxLength={120} placeholder="e.g. Backend dev at Stripe"
                        className="w-full px-4 py-2.5 border border-[#ebe6dd] rounded-xl text-sm
                                   bg-[#f7f5f1] focus:outline-none focus:ring-2 focus:ring-[#161413]/10
                                   focus:border-[#d4c9b8] transition-all text-[#161413]"/>
                      <p className="text-xs text-[#8c7b6e] text-right mt-1">{pHeadline.length}/120</p>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 bg-[#f7f5f1] border border-[#ebe6dd] rounded-xl text-sm text-[#161413]">
                      {user?.headline || <span className="text-[#8c7b6e] italic">No headline yet</span>}
                    </div>
                  )}
                </div>

                {/* ── Bio ── */}
                <div>
                  <label className="block text-xs font-semibold text-[#5a4a3f] uppercase tracking-wider mb-1.5">
                    Bio
                  </label>
                  {editing ? (
                    <div>
                      <textarea value={pBio} onChange={e => setPBio(e.target.value)}
                        rows={5} maxLength={1000} placeholder="Tell others about yourself…"
                        className="w-full px-4 py-2.5 border border-[#ebe6dd] rounded-xl text-sm resize-none
                                   bg-[#f7f5f1] focus:outline-none focus:ring-2 focus:ring-[#161413]/10
                                   focus:border-[#d4c9b8] transition-all text-[#161413] leading-relaxed"/>
                      <div className="flex items-center justify-between mt-1.5">
                        <button type="button" onClick={enhanceBio}
                          disabled={!pBio.trim() || aiLoading}
                          className="flex items-center gap-1.5 text-xs font-medium text-violet-500
                                     hover:text-violet-600 disabled:opacity-40 disabled:cursor-not-allowed
                                     transition-colors">
                          {aiLoading
                            ? <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"/>
                            : <Sparkles className="w-3.5 h-3.5"/>
                          }
                          {aiLoading ? 'Enhancing…' : 'Enhance with AI'}
                        </button>
                        <span className="text-xs text-[#8c7b6e]">{pBio.length}/1000</span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 bg-[#f7f5f1] border border-[#ebe6dd] rounded-xl text-sm text-[#161413]
                                    leading-relaxed whitespace-pre-wrap min-h-[80px]">
                      {user?.bio || <span className="text-[#8c7b6e] italic">No bio yet</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center justify-end gap-3 mt-7 pt-5 border-t border-[#ebe6dd]">
                {editing ? (
                  <>
                    <button onClick={cancelEdit}
                      className="px-4 py-2 rounded-xl border border-[#ebe6dd] text-sm font-medium
                                 text-[#5a4a3f] hover:bg-[#f0ebe3] transition-colors">
                      Cancel
                    </button>
                    <button onClick={saveProfile} disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#161413] hover:bg-[#3d3633]
                                 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                      {saving && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      )}
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl border border-[#ebe6dd]
                               text-sm font-semibold text-[#5a4a3f] hover:border-[#d4c9b8] hover:text-[#161413]
                               hover:bg-[#f0ebe3] transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    Edit profile
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ──────── Tab 2: Notification Settings ──────── */}
          {tab === 'notifications' && (
            <div>

              {/* Header row */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-[#161413]">Email Notifications</h3>
                  <p className="text-xs text-[#8c7b6e] mt-0.5">
                    Choose which emails you want to receive. All notifications are off by default.
                  </p>
                </div>
                {notifSaved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold
                                   bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100
                                   animate-pulse">
                    <Check className="w-3 h-3"/>
                    Saved
                  </span>
                )}
              </div>

              {/* Loading skeleton */}
              {notifLoading ? (
                <div className="space-y-1 divide-y divide-[#f0ebe3] animate-pulse">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div key={i} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#f0ebe3] rounded-lg flex-shrink-0"/>
                        <div>
                          <div className="h-3.5 bg-[#f0ebe3] rounded-lg w-44 mb-1.5"/>
                          <div className="h-2.5 bg-[#f7f5f1] rounded-lg w-56"/>
                        </div>
                      </div>
                      <div className="w-9 h-5 bg-[#f0ebe3] rounded-full flex-shrink-0"/>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[#f0ebe3]">
                  {NOTIF_SETTINGS.map(setting => {
                    const isChecked = notifPrefs?.[setting.key] ?? false
                    const isSaving  = notifSaving === setting.key

                    return (
                      <div key={setting.key}
                           className="flex items-center justify-between py-4 gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                                          flex-shrink-0 ${setting.color}`}>
                            {setting.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#161413]">{setting.label}</p>
                            <p className="text-xs text-[#8c7b6e] mt-0.5 leading-relaxed">
                              {setting.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center justify-center w-9">
                          {isSaving ? (
                            <div className="w-4 h-4 border-2 border-[#161413] border-t-transparent
                                            rounded-full animate-spin"/>
                          ) : (
                            <Toggle
                              checked={isChecked}
                              disabled={notifSaving !== null}
                              onChange={() => handleNotifToggle(setting.key, !isChecked)}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <p className="text-xs text-[#8c7b6e] mt-5 pt-4 border-t border-[#f0ebe3] leading-relaxed">
                Changes are saved automatically when you toggle. Disabling an email type
                takes effect immediately for all future notifications.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
