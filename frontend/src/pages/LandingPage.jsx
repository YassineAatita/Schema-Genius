import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

/* ═══════════════════════════════════════════════════════════════
   SVG ICON PATHS  (Heroicons outline, single <path> per icon)
═══════════════════════════════════════════════════════════════ */
const P = {
  sparkle:    'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  code:       'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  star:       'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  download:   'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  users:      'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  check:      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  fire:       'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
  clock:      'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  document:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  cart:       'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  cloud:      'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  chat:       'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  briefcase:  'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  calendar:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  plusCircle: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  clipboard:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  bookmark:   'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  home:       'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  location:   'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  lock:       'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  newspaper:  'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  archive:    'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12',
  building:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  pencil:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  photo:      'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  refresh:    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  lightbulb:  'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  folder:     'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  share:      'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  heart:      'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  eye:        'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  globe:      'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  collection: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  userAdd:    'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  xCircle:    'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  arrow:      'M9 5l7 7-7 7',
}

/* Tiny inline SVG icon */
function Ico({ name, size = 16, color = 'currentColor', sw = 1.8 }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"
         strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} style={{ flexShrink: 0 }}>
      <path d={P[name]}/>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════════ */
const ACTIVITIES = [
  { user: 'Yassine A.', action: 'generated a schema with AI',    iconKey: 'sparkle' },
  { user: 'Fatima Z.',  action: 'forked the E-Commerce template', iconKey: 'code'    },
  { user: 'Ahmed K.',   action: 'starred Blog Platform schema',   iconKey: 'star'    },
  { user: 'Sara M.',    action: 'exported MySQL migrations',      iconKey: 'download'},
  { user: 'Omar B.',    action: 'invited a collaborator',         iconKey: 'users'   },
  { user: 'Leila H.',   action: 'validated schema — 0 errors',   iconKey: 'check'   },
  { user: 'Karim R.',   action: 'ran AI Roast on schema',         iconKey: 'fire'    },
  { user: 'Nadia S.',   action: 'restored a previous version',    iconKey: 'clock'   },
]

const TEMPLATES = [
  { name: 'Blog Platform',       tables: 4, iconKey: 'document',   col: '#c96b3a' },
  { name: 'E-Commerce Store',    tables: 5, iconKey: 'cart',       col: '#a85530' },
  { name: 'SaaS Platform',       tables: 5, iconKey: 'cloud',      col: '#c96b3a' },
  { name: 'Social Network',      tables: 6, iconKey: 'chat',       col: '#f59e0b' },
  { name: 'Job Board',           tables: 6, iconKey: 'briefcase',  col: '#10b981' },
  { name: 'Booking System',      tables: 6, iconKey: 'calendar',   col: '#ef4444' },
  { name: 'Hospital & Clinic',   tables: 6, iconKey: 'plusCircle', col: '#a85530' },
  { name: 'School & University', tables: 7, iconKey: 'clipboard',  col: '#f59e0b' },
  { name: 'Library Management',  tables: 7, iconKey: 'bookmark',   col: '#c96b3a' },
  { name: 'Real Estate',         tables: 7, iconKey: 'home',       col: '#10b981' },
  { name: 'Food Delivery',       tables: 8, iconKey: 'location',   col: '#ef4444' },
  { name: 'Auth & Roles',        tables: 7, iconKey: 'lock',       col: '#a85530' },
  { name: 'CMS',                 tables: 9, iconKey: 'newspaper',  col: '#c96b3a' },
  { name: 'Inventory',           tables: 7, iconKey: 'archive',    col: '#f59e0b' },
  { name: 'Multi-tenant SaaS',   tables: 8, iconKey: 'building',   col: '#10b981' },
]

const FEATURES = [
  {
    icon: <Ico name="collection" size={20}/>,
    title: 'Visual Canvas',
    desc:  'Drag-and-drop classes on an infinite canvas. Add attributes, types, and constraints — no SQL needed.',
    accent: '#c96b3a',
  },
  {
    icon: <Ico name="sparkle" size={20}/>,
    title: 'AI Generation',
    desc:  'Describe your app in plain English and AI generates a complete class diagram with classes and relationships.',
    accent: '#a85530',
  },
  {
    icon: <Ico name="users" size={20}/>,
    title: 'Real-time Collaboration',
    desc:  'Invite teammates as editors or viewers. Live cursors, instant canvas sync, and avatar stack.',
    accent: '#10b981',
  },
  {
    icon: <Ico name="download" size={20}/>,
    title: 'SQL Export',
    desc:  'Export production-ready SQL for MySQL, PostgreSQL, or SQLite with FK constraints and indexes.',
    accent: '#f59e0b',
  },
  {
    icon: <Ico name="clock" size={20}/>,
    title: 'Version History',
    desc:  'Every save creates a new version. Compare diffs side-by-side and restore any past state instantly.',
    accent: '#ef4444',
  },
  {
    icon: <Ico name="archive" size={20}/>,
    title: '15 Templates',
    desc:  'Jump-start any project with pre-built templates for e-commerce, blogs, SaaS, hospitals, and more.',
    accent: '#06b6d4',
  },
]

const TERMINAL_SCRIPT = [
  { delay: 400,  type: 'prompt',   text: '> Describe: "food delivery app with drivers"' },
  { delay: 1100, type: 'thinking', text: '  Connecting to Groq AI...' },
  { delay: 2300, type: 'ok',       text: '  Created  restaurants  (8 columns)' },
  { delay: 2800, type: 'ok',       text: '  Created  menus         (6 columns)' },
  { delay: 3300, type: 'ok',       text: '  Created  orders        (9 columns)' },
  { delay: 3800, type: 'ok',       text: '  Created  drivers       (7 columns)' },
  { delay: 4300, type: 'ok',       text: '  Created  deliveries    (8 columns)' },
  { delay: 4900, type: 'ok',       text: '  Mapped   5 relationships' },
  { delay: 5500, type: 'success',  text: '  Schema is ready on canvas.' },
]

const CSS = `
  html { scroll-behavior: smooth; }

  @keyframes sgBlob1 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(50px,-40px) scale(1.06); }
    66%      { transform: translate(-30px,50px) scale(0.94); }
  }
  @keyframes sgBlob2 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(-60px,30px) scale(0.94); }
    66%      { transform: translate(35px,-50px) scale(1.06); }
  }
  @keyframes sgBlob3 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(25px,60px) scale(1.04); }
  }
  @keyframes sgWordIn {
    from { opacity:0; transform:translateY(22px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes sgFadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes sgScaleIn {
    from { opacity:0; transform:scale(.88); }
    to   { opacity:1; transform:scale(1); }
  }
  @keyframes sgSlideUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes sgTermLine {
    from { opacity:0; transform:translateX(-10px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes sgAutoScroll {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes sgDotGrid {
    0%,100% { opacity:.55; }
    50%      { opacity:.35; }
  }
  @keyframes sgGradShift {
    0%,100% { background-position:0% 50%; }
    50%      { background-position:100% 50%; }
  }
  @keyframes sgBlink {
    0%,100% { opacity:1; }
    50%      { opacity:0; }
  }
  .sg-dot-grid {
    background-image: radial-gradient(circle, rgba(201,107,58,.18) 1px, transparent 1px);
    background-size: 28px 28px;
    animation: sgDotGrid 6s ease-in-out infinite;
  }
  .sg-light-grid {
    background-image: radial-gradient(circle, rgba(201,107,58,.1) 1px, transparent 1px);
    background-size: 26px 26px;
  }
  .sg-feat-card {
    transition: transform .28s ease, box-shadow .28s ease;
  }
  .sg-feat-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 50px rgba(201,107,58,.16), 0 4px 20px rgba(0,0,0,.05);
  }
  .sg-feat-card:hover .sg-icon {
    animation: sgSlideUp .4s ease both;
  }
  .sg-cta-bg {
    background: linear-gradient(135deg, #7a2e12 0%, #c96b3a 50%, #e8724a 100%);
    background-size: 200% 200%;
    animation: sgGradShift 6s ease infinite;
  }
  .sg-stats-bg {
    background: linear-gradient(135deg, #faf8f4 0%, #f5efe8 50%, #faf8f4 100%);
  }
`

/* ═══════════════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════════════ */
function useInView(threshold = 0.12) {
  const ref = useRef(null)
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

/* ═══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

function Reveal({ children, delay = 0, dir = 'up', className = '' }) {
  const [ref, visible] = useInView()
  const tx = { up: 'translateY(28px)', left: 'translateX(-28px)', right: 'translateX(28px)', none: 'none' }
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : tx[dir],
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

function SectionHead({ badge, title, sub, light = false }) {
  const [ref, vis] = useInView()
  return (
    <div ref={ref} style={{ textAlign: 'center', maxWidth: '660px', margin: '0 auto' }}>
      <span style={{
        display: 'inline-block', marginBottom: '16px',
        background: light ? 'rgba(201,107,58,.1)' : 'rgba(255,255,255,.08)',
        border: `1px solid ${light ? 'rgba(201,107,58,.25)' : 'rgba(255,255,255,.12)'}`,
        color: '#c96b3a', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '4px 14px', borderRadius: '999px',
        opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(14px)',
        transition: 'opacity .6s ease, transform .6s ease',
      }}>{badge}</span>
      <h2 style={{
        fontSize: 'clamp(1.9rem, 3.8vw, 2.8rem)', fontWeight: 900,
        lineHeight: 1.15, marginBottom: '14px',
        color: light ? '#161413' : 'white',
        opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(18px)',
        transition: 'opacity .65s ease 80ms, transform .65s ease 80ms',
      }}>{title}</h2>
      {sub && (
        <p style={{
          fontSize: '1.05rem', lineHeight: 1.65,
          color: light ? '#5a4a3f' : 'rgba(245,225,200,.65)',
          opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(14px)',
          transition: 'opacity .65s ease 140ms, transform .65s ease 140ms',
        }}>{sub}</p>
      )}
    </div>
  )
}

function CountUp({ target, suffix = '' }) {
  const [n, setN]             = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect() } },
      { threshold: 0.4 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  useEffect(() => {
    if (!started) return
    let c = 0
    const inc = target / 60
    const t = setInterval(() => {
      c += inc
      if (c >= target) { setN(target); clearInterval(t) }
      else setN(Math.floor(c))
    }, 18)
    return () => clearInterval(t)
  }, [started, target])
  return <span ref={ref}>{n}{suffix}</span>
}

function ActivityItem({ item }) {
  return (
    <div style={{
      animation: 'sgSlideUp .38s cubic-bezier(.2,.8,.3,1) both',
      background: 'rgba(255,255,255,.07)', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,.09)',
      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
    }}>
      <span style={{ color: '#e8b98a', flexShrink: 0, display: 'flex' }}>
        <Ico name={item.iconKey} size={13} color="#e8b98a" sw={2}/>
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'white' }}>{item.user} </span>
        <span style={{ fontSize: '11px', color: 'rgba(232,185,138,.6)' }}>{item.action}</span>
      </div>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.22)', flexShrink: 0 }}>now</span>
    </div>
  )
}

function ActivityFeed() {
  const [items, setItems] = useState([
    { ...ACTIVITIES[0], id: 0 },
    { ...ACTIVITIES[1], id: 1 },
    { ...ACTIVITIES[2], id: 2 },
  ])
  const nextRef = useRef(3)
  const idRef   = useRef(20)
  useEffect(() => {
    const iv = setInterval(() => {
      const a = ACTIVITIES[nextRef.current % ACTIVITIES.length]
      nextRef.current++
      setItems(prev => {
        const updated = [...prev, { ...a, id: idRef.current++ }]
        return updated.length > 4 ? updated.slice(-4) : updated
      })
    }, 2300)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
      {items.map(item => <ActivityItem key={item.id} item={item}/>)}
    </div>
  )
}

function MiniTable({ title, cols, x, y, accent }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: '100px',
      borderRadius: '8px', overflow: 'hidden',
      border: `1px solid ${accent}40`, background: `${accent}0a`, fontFamily: 'monospace',
    }}>
      <div style={{ padding: '4px 8px', background: `${accent}22`,
                    fontSize: '9px', fontWeight: 700, color: accent }}>
        {title}
      </div>
      {cols.map(c => (
        <div key={c} style={{ padding: '2px 8px', fontSize: '8px',
                               color: 'rgba(148,163,184,.7)',
                               borderTop: '1px solid rgba(255,255,255,.04)' }}>
          {c}
        </div>
      ))}
    </div>
  )
}

function TypewriterTerminal() {
  const [lines, setLines] = useState([])
  const [ref, vis]        = useInView(0.25)
  const startedRef        = useRef(false)
  useEffect(() => {
    if (!vis || startedRef.current) return
    startedRef.current = true
    TERMINAL_SCRIPT.forEach(item => {
      setTimeout(() => setLines(prev => [...prev, item]), item.delay)
    })
  }, [vis])
  return (
    <div ref={ref} style={{
      background: '#0f0a06', borderRadius: '16px',
      border: '1px solid rgba(255,255,255,.1)',
      overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 16px', background: '#1a0f07',
                    borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        {['rgba(239,68,68,.7)','rgba(245,158,11,.7)','rgba(16,185,129,.7)'].map((bg,i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: bg }}/>
        ))}
        <span style={{ marginLeft: 8, fontSize: '11px', color: 'rgba(148,163,184,.5)', fontFamily: 'monospace' }}>
          schema-genius — AI Generator
        </span>
      </div>
      <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12.5px',
                    lineHeight: 1.8, minHeight: '240px' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ animation: 'sgTermLine .3s ease both' }}>
            {line.type === 'prompt'   && <span style={{ color: '#c96b3a' }}>{line.text}</span>}
            {line.type === 'thinking' && <span style={{ color: '#fbbf24' }}>{line.text}</span>}
            {line.type === 'ok'       && <span style={{ color: 'rgba(148,163,184,.8)' }}>{line.text}</span>}
            {line.type === 'success'  && <span style={{ color: '#34d399', fontWeight: 700 }}>{line.text}</span>}
          </div>
        ))}
        {lines.length > 0 && lines.length < TERMINAL_SCRIPT.length && (
          <span style={{ display: 'inline-block', width: '8px', height: '14px',
                         background: '#c96b3a', marginLeft: '2px', verticalAlign: 'middle',
                         animation: 'sgBlink .9s step-end infinite' }}/>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SECTION COMPONENTS
═══════════════════════════════════════════════════════════════ */

function HeroSection({ scrollTo }) {
  const W1 = ['Design', 'databases']
  const W2 = ['visually,', 'with']
  const BD = 200

  return (
    <section id="hero" style={{ background: '#1a1410', position: 'relative',
                                 minHeight: '100vh', overflow: 'hidden',
                                 display: 'flex', alignItems: 'center', paddingTop: '80px' }}>
      <div className="sg-dot-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}/>

      {/* Blobs */}
      <div style={{ position:'absolute', width:640, height:640, borderRadius:'50%',
                    background:'radial-gradient(circle, rgba(201,107,58,.22) 0%, transparent 70%)',
                    top:-160, left:-180, filter:'blur(48px)', pointerEvents:'none',
                    animation:'sgBlob1 12s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', width:520, height:520, borderRadius:'50%',
                    background:'radial-gradient(circle, rgba(168,85,48,.18) 0%, transparent 70%)',
                    top:60, right:-120, filter:'blur(56px)', pointerEvents:'none',
                    animation:'sgBlob2 10s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', width:420, height:420, borderRadius:'50%',
                    background:'radial-gradient(circle, rgba(232,114,74,.13) 0%, transparent 70%)',
                    bottom:-40, left:'42%', filter:'blur(64px)', pointerEvents:'none',
                    animation:'sgBlob3 14s ease-in-out infinite' }}/>

      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'60px 24px',
                    width:'100%', position:'relative', zIndex:1,
                    display:'grid', gridTemplateColumns:'1fr 1fr', gap:'64px', alignItems:'center' }}
           className="hero-grid">

        {/* Left */}
        <div>
          <div style={{ opacity:0, animation:`sgFadeIn .6s ease .1s forwards`,
                        display:'inline-flex', alignItems:'center', gap:'8px',
                        background:'rgba(201,107,58,.12)', border:'1px solid rgba(201,107,58,.25)',
                        borderRadius:'999px', padding:'5px 14px', marginBottom:'28px' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#c96b3a',
                           display:'inline-block', animation:'sgBlink 1.4s step-end infinite' }}/>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#e8b98a',
                           letterSpacing:'.06em', textTransform:'uppercase' }}>
              Visual database designer · AI-powered
            </span>
          </div>

          <h1 style={{ fontWeight:900, lineHeight:1.1, marginBottom:'20px',
                       fontSize:'clamp(2.4rem,5vw,3.8rem)', letterSpacing:'-.02em' }}>
            <span style={{ display:'block' }}>
              {W1.map((w, i) => (
                <span key={w} style={{ display:'inline-block', marginRight:'.28em', opacity:0,
                                       animation:`sgWordIn .55s ease ${BD + i*100}ms forwards`,
                                       color:'white' }}>{w}</span>
              ))}
            </span>
            <span style={{ display:'block' }}>
              {W2.map((w, i) => (
                <span key={w} style={{ display:'inline-block', marginRight:'.28em', opacity:0,
                                       animation:`sgWordIn .55s ease ${BD+(W1.length+i)*100}ms forwards`,
                                       color:'white' }}>{w}</span>
              ))}
              <span style={{ display:'inline-block', marginRight:'.28em', opacity:0,
                             animation:`sgWordIn .55s ease ${BD+(W1.length+W2.length)*100}ms forwards`,
                             background:'linear-gradient(135deg,#c96b3a 0%,#a85530 100%)',
                             WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                             backgroundClip:'text' }}>AI</span>
            </span>
          </h1>

          <p style={{ opacity:0, animation:`sgFadeIn .7s ease ${BD+700}ms forwards`,
                      fontSize:'1.1rem', lineHeight:1.7, color:'rgba(245,225,200,.65)',
                      marginBottom:'36px', maxWidth:'500px' }}>
            Schema Genius turns complex database design into a drag-and-drop experience.
            Build schemas, define relationships, and export SQL — all in your browser.
          </p>

          <div style={{ opacity:0, animation:`sgScaleIn .6s cubic-bezier(.2,.8,.3,1) ${BD+900}ms forwards`,
                        display:'flex', gap:'14px', flexWrap:'wrap' }}>
            <Link to="/register" style={{
              display:'inline-flex', alignItems:'center', gap:'8px',
              padding:'13px 28px', background:'#c96b3a', color:'white',
              fontWeight:700, fontSize:'15px', borderRadius:'14px', textDecoration:'none',
              boxShadow:'0 8px 30px rgba(201,107,58,.4)', transition:'all .2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='#e8724a'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 14px 40px rgba(201,107,58,.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background='#c96b3a'; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 8px 30px rgba(201,107,58,.4)' }}>
              Get Started free
              <Ico name="arrow" size={15} color="white" sw={2.5}/>
            </Link>
            <button onClick={() => scrollTo('how')} style={{
              display:'inline-flex', alignItems:'center', gap:'8px',
              padding:'13px 28px', background:'rgba(255,255,255,.06)',
              color:'rgba(255,255,255,.8)', fontWeight:600, fontSize:'15px',
              borderRadius:'14px', border:'1px solid rgba(255,255,255,.12)',
              cursor:'pointer', transition:'all .2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,.22)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.borderColor='rgba(255,255,255,.12)' }}>
              <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Watch Demo
            </button>
          </div>
        </div>

        {/* Right — mockup */}
        <div style={{ opacity:0, animation:`sgFadeIn .9s ease ${BD+600}ms forwards` }}>
          <div style={{ borderRadius:'16px', overflow:'hidden',
                        border:'1px solid rgba(255,255,255,.12)',
                        boxShadow:'0 40px 100px rgba(0,0,0,.5), 0 0 0 1px rgba(201,107,58,.12)',
                        background:'rgba(255,255,255,.03)' }}>
            {/* Chrome */}
            <div style={{ padding:'10px 16px', background:'rgba(26,16,8,.9)',
                          borderBottom:'1px solid rgba(255,255,255,.07)',
                          display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ display:'flex', gap:'5px' }}>
                {['rgba(239,68,68,.7)','rgba(245,158,11,.7)','rgba(16,185,129,.7)'].map((bg,i) => (
                  <div key={i} style={{ width:10, height:10, borderRadius:'50%', background:bg }}/>
                ))}
              </div>
              <div style={{ flex:1, background:'rgba(255,255,255,.06)', borderRadius:'6px',
                            height:'20px', margin:'0 24px', display:'flex', alignItems:'center', padding:'0 10px' }}>
                <span style={{ fontSize:'10px', color:'rgba(148,163,184,.5)', fontFamily:'monospace' }}>
                  schema-genius.com/designer
                </span>
              </div>
            </div>
            {/* Canvas */}
            <div className="sg-dot-grid" style={{ position:'relative', height:'190px',
                                                   background:'rgba(20,8,4,.95)', overflow:'hidden' }}>
              <MiniTable title="users"    cols={['id','name','email','role']}       x="6%"  y="12%" accent="#c96b3a"/>
              <MiniTable title="projects" cols={['id','title','owner_id','status']} x="48%" y="8%"  accent="#a85530"/>
              <MiniTable title="schemas"  cols={['id','project_id','version']}      x="50%" y="56%" accent="#10b981"/>
              <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                            overflow:'visible', pointerEvents:'none' }}>
                <line x1="26%" y1="30%" x2="48%" y2="20%" stroke="#c96b3a" strokeWidth="1.5"
                      strokeDasharray="4 3" opacity=".45"/>
                <line x1="26%" y1="36%" x2="50%" y2="67%" stroke="#a85530" strokeWidth="1.5"
                      strokeDasharray="4 3" opacity=".45"/>
              </svg>
            </div>
          </div>
          {/* Activity feed */}
          <div style={{ marginTop:'14px', borderRadius:'14px',
                        border:'1px solid rgba(255,255,255,.1)',
                        background:'rgba(255,255,255,.04)', overflow:'hidden' }}>
            <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,.07)',
                          display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80',
                             display:'inline-block', animation:'sgBlink 1.8s step-end infinite' }}/>
              <span style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,.6)',
                             letterSpacing:'.05em', textTransform:'uppercase' }}>
                Live Activity
              </span>
            </div>
            <div style={{ padding:'10px 12px' }}>
              <ActivityFeed/>
            </div>
          </div>
        </div>
      </div>

      <style>{`@media(max-width:768px){.hero-grid{grid-template-columns:1fr!important;gap:40px!important;}}`}</style>
    </section>
  )
}

/* ── Features ────────────────────────────────────────────── */
function FeaturesSection() {
  return (
    <section id="features" style={{ background:'#faf8f4', padding:'96px 24px', position:'relative' }}>
      <div className="sg-light-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }}/>
      <div style={{ maxWidth:'1100px', margin:'0 auto', position:'relative' }}>
        <SectionHead
          badge="Features"
          title={<>Everything you need to <span style={{ background:'linear-gradient(135deg,#c96b3a,#a85530)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>design faster</span></>}
          sub="A complete toolkit for designing, validating, and exporting your database schemas."
          light
        />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px', marginTop:'60px' }}
             className="feat-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={i} delay={i * 90} className="sg-feat-card">
              <div style={{ background:'white', borderRadius:'18px', padding:'28px',
                            border:'1px solid #ebe6dd', boxShadow:'0 2px 12px rgba(201,107,58,.06)',
                            height:'100%' }}>
                <div className="sg-icon" style={{ width:'44px', height:'44px', borderRadius:'12px',
                              background:`${f.accent}14`, border:`1px solid ${f.accent}28`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              color:f.accent, marginBottom:'18px' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight:800, fontSize:'15px', color:'#161413', marginBottom:'8px' }}>{f.title}</h3>
                <p style={{ fontSize:'13.5px', color:'#5a4a3f', lineHeight:1.65 }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
      <style>{`
        @media(max-width:900px){.feat-grid{grid-template-columns:repeat(2,1fr)!important;}}
        @media(max-width:560px){.feat-grid{grid-template-columns:1fr!important;}}
      `}</style>
    </section>
  )
}

/* ── AI Showcase ─────────────────────────────────────────── */
function AISection() {
  const BULLETS = [
    { name:'pencil',   title:'Text to Schema',   desc:'Describe in plain English — full schema generated in seconds' },
    { name:'photo',    title:'Image to Schema',  desc:'Upload an ER diagram photo; AI parses it into nodes and edges' },
    { name:'refresh',  title:'Iterative AI',     desc:'Ask AI to add or improve classes on your existing schema' },
    { name:'fire',     title:'Roast My Schema',  desc:'Get brutal but helpful critique from a senior DBA AI' },
    { name:'lightbulb',title:'AI Suggestions',   desc:'Let AI spot missing classes and improve your data model' },
  ]
  return (
    <section id="ai" style={{ background:'#1a1410', padding:'96px 24px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%',
                    background:'radial-gradient(circle, rgba(168,85,48,.18) 0%, transparent 70%)',
                    top:-100, right:-100, filter:'blur(60px)', pointerEvents:'none' }}/>
      <div style={{ maxWidth:'1100px', margin:'0 auto', position:'relative',
                    display:'grid', gridTemplateColumns:'1fr 1fr', gap:'72px', alignItems:'center' }}
           className="ai-grid">
        <div>
          <Reveal>
            <span style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                           color:'#c96b3a', background:'rgba(201,107,58,.1)', border:'1px solid rgba(201,107,58,.22)',
                           borderRadius:'999px', padding:'4px 14px', display:'inline-block', marginBottom:'20px' }}>
              AI Features
            </span>
            <h2 style={{ fontWeight:900, fontSize:'clamp(2rem,4vw,2.8rem)', lineHeight:1.15,
                         color:'white', marginBottom:'20px' }}>
              Your AI co-designer<br/>
              <span style={{ background:'linear-gradient(135deg,#c96b3a,#a85530)',
                             WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                             backgroundClip:'text' }}>does the heavy lifting</span>
            </h2>
            <p style={{ fontSize:'1rem', lineHeight:1.7, color:'rgba(245,225,200,.6)', marginBottom:'36px' }}>
              Powered by Groq — the fastest inference on the planet.
              Go from a blank canvas to a production-quality schema in under 10 seconds.
            </p>
          </Reveal>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {BULLETS.map((b, i) => (
              <Reveal key={i} delay={i * 80} dir="left">
                <div style={{ display:'flex', gap:'14px', alignItems:'flex-start',
                              background:'rgba(255,255,255,.04)', borderRadius:'12px',
                              padding:'14px 16px', border:'1px solid rgba(255,255,255,.07)' }}>
                  <span style={{ color:'#c96b3a', marginTop:'1px', flexShrink:0 }}>
                    <Ico name={b.name} size={18} color="#c96b3a"/>
                  </span>
                  <div>
                    <p style={{ fontWeight:700, fontSize:'13.5px', color:'white', marginBottom:'2px' }}>{b.title}</p>
                    <p style={{ fontSize:'12.5px', color:'rgba(148,163,184,.65)', lineHeight:1.5 }}>{b.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={100} dir="right">
          <TypewriterTerminal/>
        </Reveal>
      </div>
      <style>{`@media(max-width:860px){.ai-grid{grid-template-columns:1fr!important;gap:48px!important;}}`}</style>
    </section>
  )
}

/* ── Stats ───────────────────────────────────────────────── */
function StatsSection() {
  const STATS = [
    { target:40, suffix:'+', label:'Features',      sub:'All in one canvas' },
    { target:15, suffix:'',  label:'Templates',     sub:'Ready to use' },
    { target:3,  suffix:'',  label:'SQL Dialects',  sub:'MySQL · PG · SQLite' },
    { target:80, suffix:'+', label:'API Endpoints', sub:'Full REST API' },
  ]
  return (
    <section className="sg-stats-bg" style={{ padding:'80px 24px' }}>
      <div style={{ maxWidth:'900px', margin:'0 auto',
                    display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'32px' }}
           className="stats-grid">
        {STATS.map((s, i) => (
          <Reveal key={i} delay={i * 80}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'clamp(2.8rem,5vw,3.6rem)', fontWeight:900, lineHeight:1,
                            color:'#c96b3a', textShadow:'0 0 40px rgba(201,107,58,.3)', marginBottom:'8px' }}>
                <CountUp target={s.target} suffix={s.suffix}/>
              </div>
              <p style={{ fontWeight:800, fontSize:'15px', color:'#161413', marginBottom:'3px' }}>{s.label}</p>
              <p style={{ fontSize:'12.5px', color:'#8c7b6e' }}>{s.sub}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <style>{`@media(max-width:640px){.stats-grid{grid-template-columns:repeat(2,1fr)!important;}}`}</style>
    </section>
  )
}

/* ── How it works ────────────────────────────────────────── */
function HowItWorksSection() {
  const STEPS = [
    { n:'01', title:'Create a project',
      desc:'Sign up and create a project. Schema Genius opens a blank canvas ready for your first table.',
      iconName:'folder', dir:'left' },
    { n:'02', title:'Design or generate with AI',
      desc:'Drag tables, add columns, draw FK relationships — or describe your app to AI and watch it build the schema automatically.',
      iconName:'sparkle', dir:'right' },
    { n:'03', title:'Collaborate, validate and export',
      desc:'Invite teammates, run the schema validator, then export production-ready SQL for your chosen database engine.',
      iconName:'share', dir:'left' },
  ]
  return (
    <section id="how" style={{ background:'#faf8f4', padding:'96px 24px' }}>
      <div style={{ maxWidth:'800px', margin:'0 auto' }}>
        <SectionHead
          badge="How it works"
          title={<>From idea to schema <span style={{ background:'linear-gradient(135deg,#c96b3a,#a85530)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>in minutes</span></>}
          sub="Three simple steps to go from a blank page to a production-ready database."
          light
        />
        <div style={{ marginTop:'64px', display:'flex', flexDirection:'column', gap:'20px' }}>
          {STEPS.map((s, i) => (
            <Reveal key={i} delay={i * 100} dir={s.dir}>
              <div style={{ display:'flex', gap:'20px', alignItems:'flex-start',
                            background:'white', borderRadius:'18px', padding:'24px 28px',
                            border:'1px solid #ebe6dd', boxShadow:'0 2px 16px rgba(201,107,58,.07)' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', flexShrink:0 }}>
                  <div style={{ width:'52px', height:'52px', borderRadius:'14px',
                                background:'linear-gradient(135deg,rgba(201,107,58,.12),rgba(168,85,48,.12))',
                                border:'1px solid rgba(201,107,58,.2)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                color:'#c96b3a' }}>
                    <Ico name={s.iconName} size={22} color="#c96b3a"/>
                  </div>
                  <span style={{ fontSize:'11px', fontWeight:800, color:'#c96b3a', letterSpacing:'.08em' }}>
                    STEP {s.n}
                  </span>
                </div>
                <div>
                  <h3 style={{ fontWeight:800, fontSize:'17px', color:'#161413', marginBottom:'8px' }}>{s.title}</h3>
                  <p style={{ fontSize:'14px', color:'#5a4a3f', lineHeight:1.65 }}>{s.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Comparison ──────────────────────────────────────────── */
function ComparisonSection() {
  const OTHERS = [
    'Complex setup and steep learning curve',
    'Desktop-only, no browser support',
    'Expensive licensing or subscriptions',
    'No AI assistance of any kind',
    'No real-time collaboration',
    'Manual SQL writing required',
  ]
  const OURS = [
    'Drag-and-drop in under 30 seconds',
    '100% browser-based, nothing to install',
    'Free forever, no credit card required',
    'AI generates schemas from plain text',
    'Real-time team collaboration built-in',
    'One-click SQL export for any dialect',
  ]
  return (
    <section style={{ background:'#faf8f4', padding:'96px 24px' }}>
      <div style={{ maxWidth:'900px', margin:'0 auto' }}>
        <SectionHead
          badge="Why Schema Genius"
          title={<>Built for developers, <span style={{ background:'linear-gradient(135deg,#c96b3a,#a85530)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>not enterprise architects</span></>}
          light
        />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px', marginTop:'56px' }}
             className="cmp-grid">
          <Reveal dir="left">
            <div style={{ borderRadius:'18px', overflow:'hidden', border:'1px solid #fee2e2', background:'#fff8f8' }}>
              <div style={{ padding:'16px 20px', background:'#fef2f2', borderBottom:'1px solid #fecaca',
                            display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ color:'#ef4444', display:'flex' }}><Ico name="xCircle" size={20} color="#ef4444"/></span>
                <span style={{ fontWeight:800, fontSize:'14px', color:'#991b1b' }}>Other Tools</span>
              </div>
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'10px' }}>
                {OTHERS.map((o, i) => (
                  <div key={i} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                    <span style={{ color:'#ef4444', fontWeight:700, flexShrink:0, marginTop:'1px', lineHeight:1 }}>
                      <Ico name="xCircle" size={14} color="#ef4444" sw={2}/>
                    </span>
                    <span style={{ fontSize:'13.5px', color:'#8c7b6e', lineHeight:1.4 }}>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal dir="right" delay={80}>
            <div style={{ borderRadius:'18px', overflow:'hidden', border:'1px solid #d4c9b8', background:'#faf8f4',
                          boxShadow:'0 4px 24px rgba(201,107,58,.12)' }}>
              <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#f5ede0,#ede5d8)',
                            borderBottom:'1px solid #d4c9b8', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ color:'#c96b3a', display:'flex' }}><Ico name="check" size={20} color="#c96b3a"/></span>
                <span style={{ fontWeight:800, fontSize:'14px', color:'#1a1008' }}>Schema Genius</span>
              </div>
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'10px' }}>
                {OURS.map((o, i) => (
                  <div key={i} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                    <span style={{ color:'#10b981', flexShrink:0, marginTop:'1px', lineHeight:1 }}>
                      <Ico name="check" size={14} color="#10b981" sw={2.5}/>
                    </span>
                    <span style={{ fontSize:'13.5px', color:'#374151', lineHeight:1.4 }}>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
      <style>{`@media(max-width:640px){.cmp-grid{grid-template-columns:1fr!important;}}`}</style>
    </section>
  )
}

/* ── Community ───────────────────────────────────────────── */
function MockSchemaCard({ name, author, initials, avatarColor, tables, dialect, stars, forks, comments }) {
  return (
    <div style={{ background:'white', borderRadius:'14px', padding:'16px 18px',
                  border:'1px solid #ebe6dd', boxShadow:'0 2px 12px rgba(201,107,58,.07)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'white', fontSize:'11px', fontWeight:800, flexShrink:0 }}>
            {initials}
          </div>
          <div>
            <p style={{ fontSize:'12px', fontWeight:700, color:'#161413', lineHeight:1.2 }}>{author}</p>
            <p style={{ fontSize:'11px', color:'#9ca3af', lineHeight:1.2 }}>{tables} classes · {dialect}</p>
          </div>
        </div>
        <button style={{ fontSize:'11px', fontWeight:600, color:'#c96b3a',
                         background:'rgba(201,107,58,.08)', border:'1px solid rgba(201,107,58,.2)',
                         borderRadius:'8px', padding:'4px 10px', cursor:'pointer',
                         display:'flex', alignItems:'center', gap:'5px' }}>
          <Ico name="star" size={11} color="#c96b3a" sw={2}/>
          Star
        </button>
      </div>
      <h4 style={{ fontSize:'14px', fontWeight:800, color:'#161413', marginBottom:'12px' }}>{name}</h4>
      <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
        {[
          { iconName:'star',     val:stars    },
          { iconName:'code',     val:forks    },
          { iconName:'chat',     val:comments },
        ].map(({ iconName, val }) => (
          <div key={iconName} style={{ display:'flex', alignItems:'center', gap:'4px',
                                       fontSize:'12px', color:'#9ca3af', fontWeight:600 }}>
            <Ico name={iconName} size={12} color="#9ca3af" sw={2}/>
            {val}
          </div>
        ))}
      </div>
    </div>
  )
}

function CommunitySection() {
  const COMMUNITY_FEATURES = [
    { name:'globe',      title:'Public Gallery',    desc:'Browse schemas from developers worldwide, filterable by tag and dialect' },
    { name:'star',       title:'Stars and Likes',   desc:'Bookmark schemas you find useful and show appreciation to creators' },
    { name:'code',       title:'Fork Any Schema',   desc:'Clone any public schema into your own project and customize it' },
    { name:'chat',       title:'Comments',          desc:'Discuss design decisions, ask questions, and give feedback' },
    { name:'collection', title:'Collections',       desc:'Curate personal lists of your favourite schemas for easy reference' },
    { name:'userAdd',    title:'Follow Developers', desc:'Follow creators and see their new schemas in your Network feed' },
  ]
  const CARDS = [
    { name:'E-Commerce Database',  author:'Yassine Aatita', initials:'YA', avatarColor:'#c96b3a', tables:5, dialect:'MySQL',      stars:24, forks:8,  comments:12 },
    { name:'Social Network Schema',author:'Fatima Z.',      initials:'FZ', avatarColor:'#a85530', tables:6, dialect:'PostgreSQL', stars:18, forks:5,  comments:7  },
    { name:'SaaS Platform',        author:'Ahmed K.',       initials:'AK', avatarColor:'#10b981', tables:5, dialect:'MySQL',      stars:31, forks:12, comments:9  },
  ]
  return (
    <section id="community" style={{ background:'#faf8f4', padding:'96px 24px', position:'relative' }}>
      <div className="sg-light-grid" style={{ position:'absolute', inset:0, pointerEvents:'none' }}/>
      <div style={{ maxWidth:'1100px', margin:'0 auto', position:'relative' }}>
        <SectionHead
          badge="Community"
          title={<>Share your schemas, <span style={{ background:'linear-gradient(135deg,#c96b3a,#a85530)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>learn from others</span></>}
          sub="A public gallery where developers share database designs, give feedback, and build on each other's work."
          light
        />

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'72px',
                      alignItems:'start', marginTop:'64px' }}
             className="comm-grid">

          {/* Left: feature list */}
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}
                 className="comm-feat-grid">
              {COMMUNITY_FEATURES.map((f, i) => (
                <Reveal key={i} delay={i * 70}>
                  <div style={{ background:'white', borderRadius:'14px', padding:'16px',
                                border:'1px solid #ebe6dd',
                                boxShadow:'0 2px 10px rgba(201,107,58,.05)' }}>
                    <span style={{ color:'#c96b3a', display:'flex', marginBottom:'10px' }}>
                      <Ico name={f.name} size={18} color="#c96b3a"/>
                    </span>
                    <p style={{ fontWeight:700, fontSize:'13px', color:'#161413', marginBottom:'4px' }}>{f.title}</p>
                    <p style={{ fontSize:'12px', color:'#8c7b6e', lineHeight:1.5 }}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={400}>
              <div style={{ marginTop:'28px', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                <Link to="/register" style={{
                  display:'inline-flex', alignItems:'center', gap:'8px',
                  padding:'11px 22px', background:'#c96b3a', color:'white',
                  fontWeight:700, fontSize:'14px', borderRadius:'12px', textDecoration:'none',
                  boxShadow:'0 4px 20px rgba(201,107,58,.3)', transition:'all .2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='#e8724a'; e.currentTarget.style.transform='translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background='#c96b3a'; e.currentTarget.style.transform='' }}>
                  Join the community
                  <Ico name="arrow" size={14} color="white" sw={2.5}/>
                </Link>
                <Link to="/register" style={{
                  display:'inline-flex', alignItems:'center', gap:'8px',
                  padding:'11px 22px', background:'transparent', color:'#c96b3a',
                  fontWeight:600, fontSize:'14px', borderRadius:'12px', textDecoration:'none',
                  border:'1px solid #d4c9b8', transition:'all .2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(201,107,58,.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent' }}>
                  <Ico name="eye" size={14} color="#c96b3a"/>
                  Browse gallery
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Right: mock schema cards */}
          <div>
            <div style={{ background:'white', borderRadius:'18px', padding:'20px',
                          border:'1px solid #ebe6dd',
                          boxShadow:'0 8px 40px rgba(201,107,58,.1)' }}>
              {/* Gallery header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ color:'#c96b3a', display:'flex' }}><Ico name="globe" size={16} color="#c96b3a"/></span>
                  <span style={{ fontWeight:800, fontSize:'14px', color:'#161413' }}>Public Gallery</span>
                </div>
                <Link to="/register" style={{ display:'inline-flex', alignItems:'center', gap:'4px',
                                               fontSize:'12px', fontWeight:600, color:'#c96b3a',
                                               textDecoration:'none' }}>
                  Browse all
                  <Ico name="arrow" size={12} color="#c96b3a" sw={2.5}/>
                </Link>
              </div>

              {/* Search bar (decorative) */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px',
                            background:'#faf8f4', border:'1px solid #ebe6dd', borderRadius:'10px',
                            padding:'8px 12px' }}>
                <Ico name="eye" size={14} color="#9ca3af"/>
                <span style={{ fontSize:'12px', color:'#9ca3af' }}>Search schemas, templates, tags...</span>
              </div>

              {/* Cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {CARDS.map((card, i) => (
                  <Reveal key={i} delay={i * 100}>
                    <MockSchemaCard {...card}/>
                  </Reveal>
                ))}
              </div>

              {/* Footer row */}
              <div style={{ marginTop:'16px', paddingTop:'14px', borderTop:'1px solid #f0ebe3',
                            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'12px', color:'#9ca3af' }}>3 of 240+ public schemas</span>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80',
                                 display:'inline-block', animation:'sgBlink 2s step-end infinite' }}/>
                  <span style={{ fontSize:'11px', color:'#9ca3af' }}>12 online now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media(max-width:900px){.comm-grid{grid-template-columns:1fr!important;gap:48px!important;}}
        @media(max-width:540px){.comm-feat-grid{grid-template-columns:1fr!important;}}
      `}</style>
    </section>
  )
}

/* ── Templates ───────────────────────────────────────────── */
function TemplatesSection() {
  const ALL = [...TEMPLATES, ...TEMPLATES]
  const trackRef = useRef(null)
  return (
    <section id="templates" style={{ background:'#1a1410', padding:'96px 0', overflow:'hidden' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 24px' }}>
        <SectionHead
          badge="Templates"
          title={<>15 ready-made templates <span style={{ background:'linear-gradient(135deg,#c96b3a,#a85530)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>to jump-start any project</span></>}
          sub="Pick a template, customise it to your needs, and export SQL — done in minutes."
        />
      </div>
      <div style={{ marginTop:'56px', overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'80px', zIndex:2, pointerEvents:'none',
                      background:'linear-gradient(to right, #1a1410, transparent)' }}/>
        <div style={{ position:'absolute', right:0, top:0, bottom:0, width:'80px', zIndex:2, pointerEvents:'none',
                      background:'linear-gradient(to left, #1a1410, transparent)' }}/>
        <div ref={trackRef}
          style={{ display:'flex', gap:'16px', width:'max-content',
                   animation:'sgAutoScroll 36s linear infinite', padding:'8px 0' }}
          onMouseEnter={() => { if (trackRef.current) trackRef.current.style.animationPlayState='paused' }}
          onMouseLeave={() => { if (trackRef.current) trackRef.current.style.animationPlayState='running' }}>
          {ALL.map((t, i) => (
            <div key={i} style={{ flexShrink:0, width:'200px', borderRadius:'14px', padding:'18px 20px',
                                  background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
                                  cursor:'default', transition:'transform .2s ease, background .2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.transform='translateY(-4px)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.transform='' }}>
              <span style={{ color:t.col, display:'flex', marginBottom:'12px' }}>
                <Ico name={t.iconKey} size={26} color={t.col}/>
              </span>
              <p style={{ fontWeight:700, fontSize:'13.5px', color:'white', marginBottom:'5px' }}>{t.name}</p>
              <p style={{ fontSize:'11.5px', color:t.col, fontWeight:600 }}>{t.tables} classes</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign:'center', marginTop:'48px', padding:'0 24px' }}>
        <Reveal>
          <Link to="/register" style={{
            display:'inline-flex', alignItems:'center', gap:'8px',
            padding:'12px 28px', background:'rgba(201,107,58,.15)',
            color:'#e8b98a', fontWeight:600, fontSize:'14px',
            borderRadius:'12px', textDecoration:'none',
            border:'1px solid rgba(201,107,58,.25)', transition:'all .2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(201,107,58,.25)'; e.currentTarget.style.transform='translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(201,107,58,.15)'; e.currentTarget.style.transform='' }}>
            Browse all templates
            <Ico name="arrow" size={13} color="#e8b98a" sw={2.5}/>
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/* ── CTA ─────────────────────────────────────────────────── */
function CTASection() {
  const [ref, vis] = useInView(0.2)
  return (
    <section className="sg-cta-bg" style={{ padding:'100px 24px', position:'relative', overflow:'hidden' }}>
      <div ref={ref} style={{
        maxWidth:'680px', margin:'0 auto', textAlign:'center', position:'relative',
        opacity:vis ? 1 : 0, transform:vis ? 'none' : 'translateY(32px)',
        transition:'opacity .7s ease, transform .7s ease',
      }}>
        <span style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                       color:'rgba(255,255,255,.7)', background:'rgba(255,255,255,.12)',
                       border:'1px solid rgba(255,255,255,.2)', borderRadius:'999px',
                       padding:'4px 14px', display:'inline-block', marginBottom:'24px' }}>
          Get started today
        </span>
        <h2 style={{ fontWeight:900, fontSize:'clamp(2.2rem,5vw,3.4rem)', lineHeight:1.12,
                     color:'white', marginBottom:'16px' }}>
          Start designing your<br/>database today
        </h2>
        <p style={{ fontSize:'1.1rem', color:'rgba(255,255,255,.75)', marginBottom:'40px' }}>
          Free forever. No credit card required.
        </p>
        <Link to="/register" style={{
          display:'inline-flex', alignItems:'center', gap:'10px',
          padding:'15px 36px', background:'white', color:'#1a1008',
          fontWeight:800, fontSize:'16px', borderRadius:'16px', textDecoration:'none',
          boxShadow:'0 8px 40px rgba(0,0,0,.25)', transition:'all .2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow='0 16px 50px rgba(0,0,0,.3)' }}
        onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 8px 40px rgba(0,0,0,.25)' }}>
          Get Started — it&apos;s free
          <Ico name="arrow" size={17} color="#1a1008" sw={2.5}/>
        </Link>
      </div>
    </section>
  )
}

/* ── Footer ──────────────────────────────────────────────── */
function FooterSection() {
  return (
    <footer style={{ background:'#0a0705', borderTop:'1px solid rgba(255,255,255,.07)', padding:'56px 24px 40px' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'48px', marginBottom:'48px' }}
             className="footer-grid">
          <div>
            <img src="/logo_white.svg" alt="Schema Genius" style={{ height:'28px', marginBottom:'14px' }}/>
            <p style={{ fontSize:'13.5px', color:'rgba(148,163,184,.6)', lineHeight:1.65, maxWidth:'300px' }}>
              Visual database schema designer — AI-powered and real-time collaborative.
              Built for developers who think visually.
            </p>
          </div>
          <div>
            <p style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                        color:'rgba(148,163,184,.4)', marginBottom:'16px' }}>
              Product
            </p>
            {[['Features','features'],['Templates','templates'],['Community','community'],['How it works','how']].map(([label, id]) => (
              <button key={label}
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior:'smooth' })}
                style={{ display:'block', fontSize:'13.5px', color:'rgba(148,163,184,.6)',
                         background:'none', border:'none', cursor:'pointer',
                         padding:'4px 0', transition:'color .15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color='white'}
                onMouseLeave={e => e.currentTarget.style.color='rgba(148,163,184,.6)'}>
                {label}
              </button>
            ))}
          </div>
          <div>
            <p style={{ fontSize:'11px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase',
                        color:'rgba(148,163,184,.4)', marginBottom:'16px' }}>
              Account
            </p>
            {[['Sign in','/login'],['Register','/register'],['Dashboard','/dashboard']].map(([label, to]) => (
              <Link key={label} to={to} style={{ display:'block', fontSize:'13.5px',
                                                  color:'rgba(148,163,184,.6)', textDecoration:'none',
                                                  padding:'4px 0', transition:'color .15s ease' }}
                onMouseEnter={e => e.currentTarget.style.color='white'}
                onMouseLeave={e => e.currentTarget.style.color='rgba(148,163,184,.6)'}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', paddingTop:'28px',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      flexWrap:'wrap', gap:'12px' }}>
          <p style={{ fontSize:'12px', color:'rgba(148,163,184,.35)' }}>
            &copy; {new Date().getFullYear()} Schema Genius &middot;{' '}
            <span style={{ color:'rgba(148,163,184,.5)' }}>Yassine Aatita &amp; Fatima Zahra Aknioune</span>
          </p>
          <p style={{ fontSize:'12px', color:'rgba(148,163,184,.35)', fontStyle:'italic' }}>
            With gratitude to Dr. Ahmed Zellou, for his invaluable guidance.
          </p>
        </div>
      </div>
      <style>{`@media(max-width:700px){.footer-grid{grid-template-columns:1fr!important;gap:32px!important;}}`}</style>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate  = useNavigate()
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const NAV = [['Features','features'],['Templates','templates'],['Community','community']]

  return (
    <div style={{ overflowX: 'hidden' }}>
      <style>{CSS}</style>

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:50, transition:'all .3s ease',
        background: scrolled ? 'rgba(250,248,244,.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(201,107,58,.12)' : '1px solid transparent',
        boxShadow: scrolled ? '0 2px 20px rgba(201,107,58,.08)' : 'none',
      }}>
        <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 24px',
                      height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={() => scrollTo('hero')}
            style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <img src="/logo_white.svg" alt="Schema Genius" style={{
              height:'28px',
              filter: scrolled ? 'brightness(0) saturate(100%)' : 'none',
              transition:'filter .3s ease',
            }}/>
          </button>

          <div style={{ display:'flex', gap:'4px' }} className="nav-desktop">
            {NAV.map(([label, id]) => (
              <button key={label} onClick={() => scrollTo(id)} style={{
                padding:'8px 16px', fontSize:'14px', fontWeight:500,
                borderRadius:'10px', background:'none', border:'none', cursor:'pointer',
                color: scrolled ? '#374151' : 'rgba(255,255,255,.75)',
                transition:'all .15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color=scrolled?'#c96b3a':'white'; e.currentTarget.style.background=scrolled?'rgba(201,107,58,.08)':'rgba(255,255,255,.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color=scrolled?'#374151':'rgba(255,255,255,.75)'; e.currentTarget.style.background='none' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:'10px', alignItems:'center' }} className="nav-desktop">
            <Link to="/login" style={{
              padding:'8px 16px', fontSize:'14px', fontWeight:500,
              color: scrolled ? '#374151' : 'rgba(255,255,255,.75)',
              textDecoration:'none', transition:'color .15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.color=scrolled?'#c96b3a':'white'}
            onMouseLeave={e => e.currentTarget.style.color=scrolled?'#374151':'rgba(255,255,255,.75)'}>
              Sign in
            </Link>
            <Link to="/register" style={{
              padding:'9px 20px', background:'#c96b3a', color:'white',
              fontSize:'14px', fontWeight:700, borderRadius:'12px',
              textDecoration:'none', transition:'all .15s ease',
              boxShadow:'0 4px 14px rgba(201,107,58,.35)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='#e8724a'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background='#c96b3a'; e.currentTarget.style.transform='' }}>
              Get Started
            </Link>
          </div>

          <button onClick={() => setMenuOpen(v => !v)} className="nav-mobile" style={{
            background:'none', border:'none', cursor:'pointer', padding:'8px',
            color: scrolled ? '#374151' : 'rgba(255,255,255,.8)',
          }}>
            <svg style={{ width:20, height:20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              }
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div style={{
            padding:'16px 20px 20px',
            background: scrolled ? 'rgba(250,248,244,.98)' : 'rgba(26,16,8,.98)',
            borderTop: `1px solid ${scrolled ? 'rgba(201,107,58,.12)' : 'rgba(255,255,255,.08)'}`,
          }}>
            {NAV.map(([label, id]) => (
              <button key={label} onClick={() => scrollTo(id)} style={{
                display:'block', width:'100%', textAlign:'left',
                padding:'11px 12px', fontSize:'14px', fontWeight:500,
                background:'none', border:'none', cursor:'pointer', borderRadius:'10px',
                color: scrolled ? '#374151' : 'rgba(209,213,219,1)',
              }}>{label}</button>
            ))}
            <div style={{ marginTop:'12px', borderTop:`1px solid ${scrolled?'#ebe6dd':'rgba(255,255,255,.08)'}`, paddingTop:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{
                display:'block', textAlign:'center', padding:'11px', fontSize:'14px', fontWeight:600,
                borderRadius:'12px', border:`1px solid ${scrolled?'#d4c9b8':'rgba(255,255,255,.12)'}`,
                color: scrolled ? '#374151' : 'rgba(209,213,219,1)',
                textDecoration:'none', background:'transparent',
              }}>Sign in</Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} style={{
                display:'block', textAlign:'center', padding:'11px', fontSize:'14px', fontWeight:700,
                borderRadius:'12px', background:'#c96b3a', color:'white', textDecoration:'none',
              }}>Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── SECTIONS ──────────────────────────────────────────────── */}
      <HeroSection    scrollTo={scrollTo}/>
      <FeaturesSection/>
      <AISection/>
      <StatsSection/>
      <HowItWorksSection/>
      <ComparisonSection/>
      <CommunitySection/>
      <TemplatesSection/>
      <CTASection/>
      <FooterSection/>

      <style>{`
        .nav-desktop { display: flex !important; }
        .nav-mobile  { display: none  !important; }
        @media (max-width: 768px) {
          .nav-desktop { display: none  !important; }
          .nav-mobile  { display: flex  !important; }
        }
      `}</style>
    </div>
  )
}
