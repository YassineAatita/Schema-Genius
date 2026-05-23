import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'

/* ── User-type cards ── */
const USER_TYPES = [
  {
    value: 'student',
    label: 'Student',
    emoji: '🎓',
    desc: 'Learning databases & data modeling',
  },
  {
    value: 'developer',
    label: 'Developer',
    emoji: '💻',
    desc: 'Building apps & backend systems',
  },
  {
    value: 'designer',
    label: 'Designer',
    emoji: '🎨',
    desc: 'Focused on data architecture & UX',
  },
  {
    value: 'fullstack',
    label: 'Full-Stack',
    emoji: '⚡',
    desc: 'End-to-end from UI to database',
  },
  {
    value: 'other',
    label: 'Other',
    emoji: '🌐',
    desc: 'Something else entirely',
  },
]

/* ── Step indicator ── */
function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
              transition-all duration-300
              ${s < step ? 'bg-green-500 text-white' :
                s === step ? 'bg-[#c96b3a] text-white ring-4 ring-[#c96b3a]/30' :
                'bg-white/10 text-gray-500'}`}
          >
            {s < step ? '✓' : s}
          </div>
          {s < 3 && (
            <div className={`w-10 h-0.5 transition-all duration-300 ${s < step ? 'bg-green-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Input helper ── */
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}

const inputCls = `w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl
  text-sm text-white placeholder:text-gray-600
  focus:outline-none focus:ring-2 focus:ring-[#c96b3a]/30 focus:border-[#c96b3a]/40 transition-all`

/* ═══════════════════════════════════════════════════════════════ */
export default function RegisterPage() {
  const navigate = useNavigate()
  // setAuth is no longer called on register — user must verify email first
  // eslint-disable-next-line no-unused-vars
  const { setAuth } = useAuthStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  /* Step 1 */
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  /* Step 2 */
  const [userType, setUserType] = useState('developer')
  const [headline, setHeadline] = useState('')

  /* Step 3 */
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState(null)          // File object
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileRef = useRef()

  /* ── Validation per step ── */
  const [errors, setErrors] = useState({})

  function validateStep1() {
    const e = {}
    if (!name.trim() || name.trim().length < 2) e.name = 'At least 2 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email required'
    if (password.length < 8) e.password = 'At least 8 characters'
    if (password !== confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e = {}
    if (!userType) e.userType = 'Please pick a type'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => s + 1)
  }

  /* ── Avatar pick ── */
  const [avatarError, setAvatarError] = useState('')
  const ALLOWED = ['image/jpeg','image/png','image/jpg','image/gif','image/webp']

  function onAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setAvatarError('Only JPEG, PNG, GIF or WebP images are allowed')
      e.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(`File is too large (${(file.size/1024/1024).toFixed(1)}MB). Max is 2MB`)
      e.target.value = ''
      return
    }
    setAvatarError('')
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  /* ── AI bio enhance ── */
  async function enhanceBio() {
    if (!bio.trim()) return
    setAiLoading(true)
    try {
      const res = await api.post('/ai/enhance-bio', { bio, user_type: userType })
      setBio(res.data.bio)
    } catch {
      /* silent */
    } finally {
      setAiLoading(false)
    }
  }

  /* ── Final submit ── */
  async function submit() {
    setLoading(true)
    setServerError('')
    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        password_confirmation: confirm,
        user_type: userType,
        headline: headline || undefined,
        bio: bio || undefined,
      })

      // Backend no longer returns a token — user must verify email first.
      // Avatar upload is skipped here; user can set it from their profile after login.
      if (res.data.requires_verification) {
        navigate('/verify-email', { state: { email: res.data.email } })
        return
      }

      // Fallback (should not happen with email verification enabled)
      navigate('/login')
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.'
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  /* ═══ Render ═══ */
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0f0d0b' }}>

      {/* Top bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="flex items-center">
          <img src="/logo_white.svg" alt="Schema Genius" className="h-7 w-auto" />
        </Link>
        <Link to="/" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back to home
        </Link>
      </div>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">
              {step === 1 && 'Create your account'}
              {step === 2 && 'Who are you?'}
              {step === 3 && 'Build your profile'}
            </h1>
            <p className="text-sm text-gray-500">
              {step === 1 && 'Start designing database schemas visually — free'}
              {step === 2 && 'Help others understand your background'}
              {step === 3 && 'A little about yourself — others can see this'}
            </p>
          </div>

          <StepDots step={step} />

          {/* Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">

            {serverError && (
              <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {serverError}
              </div>
            )}

            {/* ── STEP 1: Account ── */}
            {step === 1 && (
              <div className="space-y-4">
                <Field label="Full Name" error={errors.name}>
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    type="text" placeholder="John Doe" className={inputCls}
                  />
                </Field>
                <Field label="Email Address" error={errors.email}>
                  <input
                    value={email} onChange={e => setEmail(e.target.value)}
                    type="email" placeholder="you@example.com" className={inputCls}
                  />
                </Field>
                <Field label="Password" error={errors.password}>
                  <div className="relative">
                    <input
                      value={password} onChange={e => setPassword(e.target.value)}
                      type={showPass ? 'text' : 'password'}
                      placeholder="Min. 8 characters" className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password" error={errors.confirm}>
                  <div className="relative">
                    <input
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password" className={inputCls + ' pr-10'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                <button onClick={next}
                  className="w-full bg-[#c96b3a] hover:bg-[#e8724a] text-white font-semibold py-2.5
                             rounded-xl text-sm transition-all shadow-lg shadow-[#c96b3a]/20 mt-2">
                  Continue →
                </button>
              </div>
            )}

            {/* ── STEP 2: User type ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3">
                  {USER_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setUserType(t.value)}
                      className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all
                        ${userType === t.value
                          ? 'border-[#c96b3a] bg-[#c96b3a]/12 ring-1 ring-[#c96b3a]/30'
                          : 'border-white/10 bg-white/3 hover:border-white/25 hover:bg-white/5'}`}
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{t.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all
                        ${userType === t.value ? 'border-[#c96b3a] bg-[#c96b3a]' : 'border-gray-600'}`}>
                        {userType === t.value && (
                          <div className="w-full h-full rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {errors.userType && <p className="text-xs text-red-400">{errors.userType}</p>}

                <Field label="Short headline (optional)" error={errors.headline}>
                  <input
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    type="text"
                    placeholder={`e.g. "CS student at MIT" or "Backend dev at Stripe"`}
                    maxLength={120}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-600 text-right">{headline.length}/120</p>
                </Field>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400
                               hover:border-white/25 hover:text-white transition-all">
                    ← Back
                  </button>
                  <button onClick={next}
                    className="flex-1 bg-[#c96b3a] hover:bg-[#e8724a] text-white font-semibold py-2.5
                               rounded-xl text-sm transition-all shadow-lg shadow-[#c96b3a]/20">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Profile ── */}
            {step === 3 && (
              <div className="space-y-5">

                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    <div
                      onClick={() => fileRef.current.click()}
                      className="w-20 h-20 rounded-full border-2 border-dashed border-white/20
                                 group-hover:border-[#c96b3a]/60 transition-all cursor-pointer overflow-hidden
                                 flex items-center justify-center bg-white/5"
                    >
                      {avatarPreview
                        ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                        : <svg className="w-8 h-8 text-gray-600 group-hover:text-[#e8724a] transition-colors"
                               fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                          </svg>
                      }
                    </div>
                    <div
                      onClick={() => fileRef.current.click()}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#c96b3a] rounded-full
                                 flex items-center justify-center cursor-pointer hover:bg-[#e8724a] transition-colors"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 4v16m8-8H4"/>
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {avatarPreview ? 'Click to change photo' : 'Upload profile photo (optional)'}
                  </p>
                  <p className="text-[11px] text-gray-600">JPG, PNG, GIF, WebP · max 2MB</p>
                  {avatarError && <p className="text-xs text-red-400 text-center">{avatarError}</p>}
                  <input
                    ref={fileRef} type="file" accept="image/*"
                    className="hidden" onChange={onAvatarChange}
                  />
                </div>

                {/* Bio */}
                <Field label="About you (optional)" error={errors.bio}>
                  <div className="relative">
                    <textarea
                      value={bio} onChange={e => setBio(e.target.value)}
                      rows={4} maxLength={1000}
                      placeholder="Tell others a bit about yourself, your experience, what you're working on..."
                      className={inputCls + ' resize-none'}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <button
                        type="button"
                        onClick={enhanceBio}
                        disabled={!bio.trim() || aiLoading}
                        className="flex items-center gap-1.5 text-xs text-[#e8724a]
                                   hover:text-[#f0a070] disabled:opacity-40 disabled:cursor-not-allowed
                                   transition-colors"
                      >
                        {aiLoading
                          ? <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                            </svg>
                        }
                        {aiLoading ? 'Enhancing…' : '✨ Enhance with AI'}
                      </button>
                      <span className="text-xs text-gray-600">{bio.length}/1000</span>
                    </div>
                  </div>
                </Field>

                {/* Summary */}
                <div className="p-3 bg-white/3 border border-white/8 rounded-xl text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-400 mb-2">Almost done! Creating account as:</p>
                  <p>📧 {email}</p>
                  <p>{USER_TYPES.find(t => t.value === userType)?.emoji} {USER_TYPES.find(t => t.value === userType)?.label}
                    {headline && <span className="text-gray-600"> · {headline}</span>}
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep(2)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400
                               hover:border-white/25 hover:text-white transition-all">
                    ← Back
                  </button>
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="flex-1 bg-[#c96b3a] hover:bg-[#e8724a] disabled:bg-[#c96b3a]/50
                               disabled:cursor-not-allowed text-white font-semibold py-2.5
                               rounded-xl text-sm transition-all shadow-lg shadow-[#c96b3a]/20
                               flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Creating…
                      </>
                    ) : 'Create Account 🚀'}
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <p className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-[#e8724a] hover:text-[#f0a070] font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
