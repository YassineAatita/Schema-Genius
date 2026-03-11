import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [subState, setSubState] = useState('idle') // idle | success | error

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated])

  const handleSubscribe = (e) => {
    e.preventDefault()
    if (!email.includes('@')) { setSubState('error'); return }
    // TODO: wire to backend newsletter endpoint
    setSubState('success')
    setEmail('')
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">

      {/* ── Nav ── */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur sticky top-0 z-50 bg-[#0f1117]/90">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
            </svg>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Schema Genius</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login"
            className="text-sm text-gray-400 hover:text-white font-medium transition-colors">
            Sign in
          </Link>
          <Link to="/register"
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold
                       px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/30">
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="flex-1">
        <div className="relative overflow-hidden">

          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]
                            bg-blue-600/10 rounded-full blur-[120px]"/>
          </div>

          <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">

            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20
                            text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block animate-pulse"/>
              Now in early access — free to use
            </div>

            <h1 className="text-6xl font-extrabold leading-tight mb-6 tracking-tight">
              Design databases{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                visually
              </span>
              ,<br/>export SQL instantly
            </h1>

            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Schema Genius is a drag-and-drop database schema designer.
              Build your tables, define relationships, and export production-ready SQL —
              no tool expertise required.
            </p>

            <div className="flex items-center justify-center gap-3 mb-16">
              <Link to="/register"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold
                           px-7 py-3.5 rounded-xl transition-all shadow-xl shadow-blue-900/40 text-sm">
                Start designing for free →
              </Link>
              <Link to="/login"
                className="text-sm text-gray-400 hover:text-white font-medium
                           px-7 py-3.5 rounded-xl border border-white/10 hover:border-white/20
                           transition-all backdrop-blur">
                Sign in
              </Link>
            </div>

            {/* ── Mock canvas preview ── */}
            <div className="relative mx-auto max-w-3xl rounded-2xl border border-white/10
                            bg-[#161b27] shadow-2xl shadow-black/60 overflow-hidden">

              {/* Browser chrome */}
              <div className="bg-[#1e2435] px-4 py-3 flex items-center gap-2 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70"/>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70"/>
                  <div className="w-3 h-3 rounded-full bg-green-500/70"/>
                </div>
                <div className="flex-1 mx-4 bg-[#0f1117] rounded-md px-3 py-1 text-xs
                                text-gray-500 text-center">
                  localhost:5173/projects/1/designer
                </div>
              </div>

              {/* Canvas mock */}
              <div className="relative h-64 bg-[#161b27] overflow-hidden select-none">
                {/* Grid dots */}
                <div className="absolute inset-0"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #ffffff0d 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}/>

                {/* Table: users */}
                <div className="absolute top-8 left-10 w-44 bg-[#1e2435] border border-white/10
                                rounded-xl overflow-hidden shadow-xl text-left">
                  <div className="bg-blue-600/20 border-b border-blue-500/20 px-3 py-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400"/>
                    <span className="text-xs font-bold text-blue-300">users</span>
                  </div>
                  {['id · BIGINT · PK', 'name · VARCHAR', 'email · VARCHAR', 'created_at · TIMESTAMP'].map(col => (
                    <div key={col} className="px-3 py-1.5 text-xs text-gray-400 border-b border-white/5 last:border-0">
                      {col}
                    </div>
                  ))}
                </div>

                {/* Table: orders */}
                <div className="absolute top-8 right-10 w-44 bg-[#1e2435] border border-white/10
                                rounded-xl overflow-hidden shadow-xl text-left">
                  <div className="bg-purple-600/20 border-b border-purple-500/20 px-3 py-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400"/>
                    <span className="text-xs font-bold text-purple-300">orders</span>
                  </div>
                  {['id · BIGINT · PK', 'user_id · BIGINT · FK', 'total · DECIMAL', 'status · VARCHAR'].map(col => (
                    <div key={col} className="px-3 py-1.5 text-xs text-gray-400 border-b border-white/5 last:border-0">
                      {col}
                    </div>
                  ))}
                </div>

                {/* Connector line */}
                <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                  <defs>
                    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill="#6B7280"/>
                    </marker>
                  </defs>
                  <line x1="218" y1="52" x2="310" y2="52"
                    stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 3"
                    markerEnd="url(#arr)"/>
                  <rect x="238" y="42" width="36" height="18" rx="4" fill="#1e2435" stroke="#374151" strokeWidth="1"/>
                  <text x="256" y="55" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="600">1:N</text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="border-y border-white/10 bg-white/5">
          <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-3 gap-6 text-center">
            {[
              { value: '5 min',  label: 'to your first schema' },
              { value: '1-click', label: 'SQL export' },
              { value: '100%',   label: 'free during early access' },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-2xl font-extrabold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Features ── */}
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-center text-xs font-bold text-gray-600 uppercase tracking-widest mb-12">
            Everything you need
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                color: 'blue',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012
                       2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/>
                ),
                title: 'Visual Canvas',
                desc: 'Drag tables, draw relationships, and rearrange your schema layout with a fully interactive canvas.',
              },
              {
                color: 'purple',
                icon: (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.828 14.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.1 1.1"/>
                  </>
                ),
                title: 'UML Relationships',
                desc: '1:1, 1:N, M:M with named role labels on each side — standard UML named associations.',
              },
              {
                color: 'green',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                ),
                title: 'SQL Export',
                desc: 'Generate a ready-to-run SQL migration file from your schema with one click.',
              },
              {
                color: 'amber',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0
                       012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0
                       012 2v2M7 7h10"/>
                ),
                title: 'Projects',
                desc: 'Organize your schemas into separate projects. Every save is versioned automatically.',
              },
              {
                color: 'rose',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                ),
                title: 'Schema Validation',
                desc: 'Catch missing primary keys, duplicate names, and broken foreign key references before export.',
              },
              {
                color: 'cyan',
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"/>
                ),
                title: 'AI Generation',
                desc: 'Describe your app in plain English and let AI generate the initial schema for you. Coming soon.',
              },
            ].map(f => {
              const colors = {
                blue:   { bg: 'bg-blue-500/10',   icon: 'text-blue-400',   border: 'border-blue-500/20' },
                purple: { bg: 'bg-purple-500/10',  icon: 'text-purple-400', border: 'border-purple-500/20' },
                green:  { bg: 'bg-green-500/10',   icon: 'text-green-400',  border: 'border-green-500/20' },
                amber:  { bg: 'bg-amber-500/10',   icon: 'text-amber-400',  border: 'border-amber-500/20' },
                rose:   { bg: 'bg-rose-500/10',    icon: 'text-rose-400',   border: 'border-rose-500/20' },
                cyan:   { bg: 'bg-cyan-500/10',    icon: 'text-cyan-400',   border: 'border-cyan-500/20' },
              }[f.color]
              return (
                <div key={f.title}
                  className={`rounded-2xl border ${colors.border} ${colors.bg} p-6`}>
                  <div className={`w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center mb-4`}>
                    <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {f.icon}
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Early access signup ── */}
        <div className="border-t border-white/10 bg-white/5">
          <div className="max-w-xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Stay in the loop</h2>
            <p className="text-gray-500 text-sm mb-8">
              Get notified when new features ship — AI generation, collaboration, and more.
            </p>

            {subState === 'success' ? (
              <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20
                              text-green-400 text-sm font-medium px-5 py-3 rounded-xl">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
                You're on the list — thanks!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSubState('idle') }}
                  placeholder="your@email.com"
                  className={`flex-1 bg-white/5 border ${subState === 'error' ? 'border-red-500/50' : 'border-white/10'}
                             rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600
                             focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all`}
                />
                <button type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                             px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                  Notify me
                </button>
              </form>
            )}
            {subState === 'error' && (
              <p className="text-xs text-red-400 mt-2">Please enter a valid email address.</p>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 px-6 py-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7h16"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-400">Schema Genius</span>
        </div>
        <p className="text-xs text-gray-700">
          © {new Date().getFullYear()} Schema Genius · Built with React & Laravel
        </p>
      </footer>
    </div>
  )
}
