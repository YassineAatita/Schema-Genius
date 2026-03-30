import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

/* ── Tiny hook: triggers once when element enters viewport ── */
function useInView(threshold = 0.15) {
  const ref  = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <div className="bg-[#080b11] text-white min-h-screen overflow-x-hidden">
      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(32px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes float    { 0%,100% { transform:translateY(0px) } 50% { transform:translateY(-14px) } }
        @keyframes pulse-ring { 0% { transform:scale(.9); opacity:.7 } 70% { transform:scale(1.15); opacity:0 } 100% { transform:scale(.9); opacity:0 } }
        @keyframes shimmer  { 0% { background-position:-400px 0 } 100% { background-position:400px 0 } }
        @keyframes spin-slow { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes gradient-shift { 0%,100% { background-position:0% 50% } 50% { background-position:100% 50% } }
        @keyframes blink    { 0%,100% { opacity:1 } 50% { opacity:0 } }

        .animate-fadeUp   { animation: fadeUp .7s ease forwards }
        .animate-fadeIn   { animation: fadeIn .9s ease forwards }
        .animate-float    { animation: float 5s ease-in-out infinite }
        .animate-spin-slow{ animation: spin-slow 18s linear infinite }
        .animate-gradient  { background-size:200% 200%; animation: gradient-shift 4s ease infinite }

        .delay-100 { animation-delay:.1s }
        .delay-200 { animation-delay:.2s }
        .delay-300 { animation-delay:.3s }
        .delay-400 { animation-delay:.4s }
        .delay-500 { animation-delay:.5s }
        .delay-600 { animation-delay:.6s }

        .opacity-0-init { opacity:0 }

        .hero-glow {
          background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,.35) 0%, transparent 70%);
        }
        .card-glow:hover {
          box-shadow: 0 0 0 1px rgba(59,130,246,.3), 0 20px 40px rgba(0,0,0,.4);
        }
        .text-gradient {
          background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .border-gradient {
          border: 1px solid transparent;
          background: linear-gradient(#0f1624,#0f1624) padding-box,
                      linear-gradient(135deg,#3b82f6,#7c3aed) border-box;
        }
        .grid-bg {
          background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>

      {/* ══════════════════ NAVBAR ══════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled ? 'bg-[#080b11]/95 backdrop-blur-xl border-b border-white/8 shadow-xl' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => scrollTo('hero')} className="flex items-center group">
            <img src="/logo_white.svg" alt="Schema Genius" className="h-8 w-auto" />
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {[['Features','features'],['How it works','how'],['About','about']].map(([label,id]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                {label}
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login"
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors font-medium">
              Sign in
            </Link>
            <Link to="/register"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold
                         rounded-xl transition-all shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60
                         hover:-translate-y-px">
              Get started free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(v => !v)} className="md:hidden p-2 text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#0f1624]/98 border-t border-white/8 px-6 py-4 space-y-2">
            {[['Features','features'],['How it works','how'],['About','about']].map(([label,id]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                {label}
              </button>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm text-center text-gray-300 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                Sign in
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 text-sm text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all">
                Get started free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════ HERO ══════════════════ */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center pt-20 grid-bg">
        {/* Glow */}
        <div className="hero-glow absolute inset-0 pointer-events-none"/>
        {/* Orbiting ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]
                        rounded-full border border-white/[0.04] animate-spin-slow pointer-events-none"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px]
                        rounded-full border border-blue-500/10 animate-spin-slow pointer-events-none"
             style={{ animationDirection:'reverse', animationDuration:'12s' }}/>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          {/* Badge */}
          <div className="opacity-0-init animate-fadeUp inline-flex items-center gap-2 px-4 py-1.5
                          bg-blue-600/10 border border-blue-500/20 rounded-full text-sm text-blue-400
                          font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>
            Visual database designer · AI-powered
          </div>

          {/* Headline */}
          <h1 className="opacity-0-init animate-fadeUp delay-100 text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            Design databases
            <br/>
            <span className="text-gradient">visually, instantly</span>
          </h1>

          {/* Subtitle */}
          <p className="opacity-0-init animate-fadeUp delay-200 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Schema Genius turns complex database design into a drag-and-drop experience.
            Build schemas, define relationships, and export production-ready SQL — all in your browser.
          </p>

          {/* CTA buttons */}
          <div className="opacity-0-init animate-fadeUp delay-300 flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold
                         rounded-2xl transition-all shadow-2xl shadow-blue-900/50 hover:shadow-blue-900/70
                         hover:-translate-y-1 text-base flex items-center justify-center gap-2">
              Start for free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </Link>
            <button onClick={() => scrollTo('how')}
              className="w-full sm:w-auto px-8 py-3.5 border border-white/10 hover:border-white/20 text-gray-300
                         hover:text-white font-semibold rounded-2xl transition-all hover:bg-white/5 text-base
                         flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              See how it works
            </button>
          </div>

          {/* Hero preview — animated schema mock */}
          <div className="opacity-0-init animate-fadeUp delay-400 animate-float relative max-w-3xl mx-auto">
            <div className="border-gradient rounded-2xl p-0.5 shadow-2xl">
              <div className="bg-[#0d1420] rounded-[14px] overflow-hidden">
                {/* Fake toolbar */}
                <div className="px-4 py-3 bg-[#0a1018] flex items-center gap-3 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70"/>
                    <div className="w-3 h-3 rounded-full bg-amber-500/70"/>
                    <div className="w-3 h-3 rounded-full bg-green-500/70"/>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-lg h-5 mx-8"/>
                  <div className="w-6 h-5 rounded bg-blue-600/50"/>
                </div>
                {/* Fake canvas */}
                <div className="relative h-52 overflow-hidden grid-bg">
                  {/* Table nodes */}
                  <SchemaPreviewTable title="users" x="8%" y="15%"
                    cols={['id','name','email','created_at']} color="blue"/>
                  <SchemaPreviewTable title="projects" x="52%" y="8%"
                    cols={['id','title','owner_id','status']} color="violet"/>
                  <SchemaPreviewTable title="schemas" x="52%" y="55%"
                    cols={['id','project_id','version']} color="emerald"/>
                  {/* SVG connector lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow:'visible' }}>
                    <line x1="28%" y1="32%" x2="52%" y2="22%" stroke="#3b82f6" strokeWidth="1.5"
                          strokeDasharray="4 3" opacity=".5"/>
                    <line x1="28%" y1="38%" x2="52%" y2="72%" stroke="#7c3aed" strokeWidth="1.5"
                          strokeDasharray="4 3" opacity=".5"/>
                  </svg>
                </div>
              </div>
            </div>
            {/* Glow under preview */}
            <div className="absolute -inset-4 bg-blue-600/10 blur-3xl rounded-3xl -z-10"/>
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section id="features" className="py-28 px-6">
        <SectionHeader
          label="Features"
          title={<>Everything you need to<br/><span className="text-gradient">design faster</span></>}
          sub="A complete toolkit for designing, validating, and exporting your database schemas."
        />

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-16">
          {[
            { icon: '🎨', title: 'Visual Designer', desc: 'Drag-and-drop tables on an infinite canvas. Add columns, types, constraints — all without writing SQL.', color: 'blue' },
            { icon: '🤖', title: 'AI Schema Generator', desc: 'Describe your app in plain English and let AI generate a complete schema with tables and relationships.', color: 'violet' },
            { icon: '⚡', title: 'Multi-DB SQL Export', desc: 'Export production-ready SQL for MySQL, PostgreSQL, or SQLite with one click.', color: 'emerald' },
            { icon: '🔗', title: 'Relationship Mapping', desc: 'Define 1:1, 1:N and M:N relationships visually. UML-style labels and FK constraints auto-generated.', color: 'orange' },
            { icon: '🕐', title: 'Version History', desc: 'Every save creates a new version. Browse history and restore any previous state instantly.', color: 'pink' },
            { icon: '👥', title: 'Team Collaboration', desc: 'Invite teammates as editors or viewers. Work together on the same schema in real-time.', color: 'cyan' },
          ].map((f, i) => (
            <AnimatedCard key={i} delay={i * 80}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl mb-5
                bg-${f.color}-500/10 border border-${f.color}-500/20`}>
                {f.icon}
              </div>
              <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </AnimatedCard>
          ))}
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="how" className="py-28 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none"/>
        <SectionHeader
          label="How it works"
          title={<>From idea to schema<br/><span className="text-gradient">in minutes</span></>}
          sub="Three simple steps to go from a blank page to a production-ready database."
        />

        <div className="max-w-4xl mx-auto mt-16 space-y-5">
          {[
            { step:'01', title:'Create a project', desc:'Sign up and create a project. Schema Genius sets up a blank canvas ready for you to start designing.', icon:'📁' },
            { step:'02', title:'Design your schema', desc:'Drop tables, add columns with types and constraints, and draw relationships between tables. Use AI to generate a full schema from a description.', icon:'✏️' },
            { step:'03', title:'Export & use', desc:'Validate your schema, then export SQL for MySQL, PostgreSQL, or SQLite. Copy it straight into your database migrations.', icon:'🚀' },
          ].map((s, i) => (
            <StepCard key={i} {...s} delay={i * 100} />
          ))}
        </div>
      </section>

      {/* ══════════════════ ABOUT ══════════════════ */}
      <section id="about" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Text */}
            <AboutReveal>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">About us</p>
              <h2 className="text-4xl font-black leading-tight mb-6">
                Built for developers<br/>
                <span className="text-gradient">who think visually</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-5">
                Schema Genius was born from a simple frustration: designing relational databases with
                SQL alone is slow and hard to communicate to a team. We believe a good tool should
                let you think about structure, not syntax.
              </p>
              <p className="text-gray-400 leading-relaxed mb-8">
                Whether you're a student learning data modeling, a freelancer spinning up a new project,
                or a team designing a complex microservices architecture — Schema Genius adapts to you.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[['MySQL','PostgreSQL','SQLite'].map((db,i) => (
                  <div key={i} className="text-center p-3 bg-white/3 rounded-xl border border-white/8">
                    <p className="text-xs font-semibold text-gray-300">{db}</p>
                  </div>
                ))]}
              </div>
            </AboutReveal>

            {/* Stats */}
            <AboutReveal delay={150}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { n: '3',    label: 'SQL dialects', sub:'MySQL · PG · SQLite' },
                  { n: 'AI',   label: 'Powered', sub:'llama-3.3-70b' },
                  { n: '∞',    label: 'Canvas size', sub:'Infinite workspace' },
                  { n: '100%', label: 'Browser-based', sub:'No installs needed' },
                ].map((s,i) => (
                  <div key={i} className="border-gradient rounded-2xl p-5">
                    <p className="text-3xl font-black text-gradient mb-1">{s.n}</p>
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
            </AboutReveal>
          </div>
        </div>
      </section>

      {/* ══════════════════ CTA BANNER ══════════════════ */}
      <section className="py-24 px-6">
        <CTABanner />
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="border-t border-white/8 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <img src="/logo_white.svg" alt="Schema Genius" className="h-6 w-auto" />
          </div>
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} Schema Genius · Built with ❤️
          </p>
          <div className="flex items-center gap-5">
            <Link to="/login"    className="text-xs text-gray-500 hover:text-white transition-colors">Sign in</Link>
            <Link to="/register" className="text-xs text-gray-500 hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────── */

function SectionHeader({ label, title, sub }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref} className="text-center max-w-2xl mx-auto">
      <p className={`text-xs font-bold text-blue-400 uppercase tracking-widest mb-3
        transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {label}
      </p>
      <h2 className={`text-4xl md:text-5xl font-black leading-tight mb-4 transition-all duration-700 delay-100
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {title}
      </h2>
      <p className={`text-gray-400 text-lg transition-all duration-700 delay-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {sub}
      </p>
    </div>
  )
}

function AnimatedCard({ children, delay = 0 }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref}
      className={`bg-[#0d1420] border border-white/6 rounded-2xl p-6 card-glow transition-all duration-700
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function StepCard({ step, title, desc, icon, delay = 0 }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref}
      className={`flex gap-6 p-6 bg-[#0d1420] border border-white/6 rounded-2xl card-glow
        transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="flex flex-col items-center gap-3 flex-shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/20
                        flex items-center justify-center text-xl">
          {icon}
        </div>
        <div className="w-px flex-1 bg-white/6 min-h-4"/>
      </div>
      <div className="pb-2">
        <p className="text-[11px] font-bold text-blue-400 tracking-widest mb-1">STEP {step}</p>
        <h3 className="font-bold text-white text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function AboutReveal({ children, delay = 0 }) {
  const [ref, visible] = useInView()
  return (
    <div ref={ref}
      className={`transition-all duration-800 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
      style={{ transitionDelay: `${delay}ms`, transitionDuration: '800ms' }}>
      {children}
    </div>
  )
}

function CTABanner() {
  const [ref, visible] = useInView()
  return (
    <div ref={ref}
      className={`max-w-4xl mx-auto border-gradient rounded-3xl p-px transition-all duration-700
        ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      <div className="bg-gradient-to-br from-[#0d1420] to-[#0a0f1a] rounded-[22px] p-12 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-violet-600/5 to-transparent pointer-events-none"/>
        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">Get started today</p>
        <h2 className="text-4xl md:text-5xl font-black mb-4">
          Your next database,<br/>
          <span className="text-gradient">designed in minutes</span>
        </h2>
        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
          Join developers and designers who use Schema Genius to ship better databases, faster.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register"
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl
                       transition-all shadow-2xl shadow-blue-900/60 hover:shadow-blue-900/80
                       hover:-translate-y-1 text-base">
            Create free account
          </Link>
          <Link to="/login"
            className="px-8 py-3.5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white
                       font-semibold rounded-2xl transition-all hover:bg-white/5 text-base">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

function SchemaPreviewTable({ title, x, y, cols, color }) {
  const colorMap = {
    blue:   'border-blue-500/40 bg-blue-500/5',
    violet: 'border-violet-500/40 bg-violet-500/5',
    emerald:'border-emerald-500/40 bg-emerald-500/5',
  }
  const headerMap = {
    blue:   'bg-blue-500/20 text-blue-300',
    violet: 'bg-violet-500/20 text-violet-300',
    emerald:'bg-emerald-500/20 text-emerald-300',
  }
  return (
    <div className={`absolute border rounded-xl overflow-hidden text-[9px] font-mono ${colorMap[color]}`}
         style={{ left: x, top: y, width: '110px' }}>
      <div className={`px-2 py-1.5 font-bold text-[10px] ${headerMap[color]}`}>{title}</div>
      {cols.map(c => (
        <div key={c} className="px-2 py-0.5 text-gray-500 border-t border-white/5 truncate">{c}</div>
      ))}
    </div>
  )
}
