import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import api from './services/api'
import useInactivityLogout from './hooks/useInactivityLogout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import EmailVerifiedPage from './pages/EmailVerifiedPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import DesignerPage from './pages/DesignerPage'
import AdminPage from './pages/AdminPage'
import PublicProfilePage from './pages/PublicProfilePage'
import SharedSchemaPage from './pages/SharedSchemaPage'
import NotFoundPage from './pages/NotFoundPage'

// Protects routes that require login.
// Also ensures `user` is populated after a hard page refresh — the token
// survives in localStorage but the Zustand store resets to { user: null }.
// Without fetching /auth/me here, isOwner / canEdit compute wrong on the
// designer page until the user visits the dashboard first.
function PrivateRoute({ children }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !user) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { logout(); navigate('/login', { replace: true }) })
    }
  }, [isAuthenticated])   // eslint-disable-line react-hooks/exhaustive-deps

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// Protects the /admin route — must be authenticated AND have the admin role.
// Handles the hard-refresh case where user is null until /auth/me returns.
function AdminRoute({ children }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && !user) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { logout(); navigate('/login', { replace: true }) })
    }
  }, [isAuthenticated])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user) return null  // still loading user from /auth/me — render nothing briefly
  if (!user.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

// ── FIX 2: 25-minute inactivity auto-logout ──────────────────────────────────
// Renders nothing; just arms the inactivity timer when authenticated.
function InactivityMonitor() {
  useInactivityLogout()
  return null
}

// ── FIX 3: single-session enforcement ────────────────────────────────────────
// Polls /auth/me every 60 s while authenticated.  If the token was revoked
// (another browser logged in — the backend deletes all tokens on login),
// the 401 interceptor in api.js will detect it, store 'session_conflict' in
// sessionStorage, and redirect to /login with the appropriate message.
function SessionMonitor() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => {
      api.get('/auth/me').catch(() => {})  // 401 interceptor handles the redirect
    }, 60_000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <InactivityMonitor />
      <SessionMonitor />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/s/:projectId" element={<SharedSchemaPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/email-verified" element={<EmailVerifiedPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={
          <PrivateRoute><DashboardPage /></PrivateRoute>
        } />
        <Route path="/projects/:projectId/designer" element={
          <PrivateRoute><DesignerPage /></PrivateRoute>
        } />
        <Route path="/u/:userId" element={
          <PrivateRoute><PublicProfilePage /></PrivateRoute>
        } />
        {/* Admin panel — admin role required */}
        <Route path="/admin" element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />

        {/* /profile and /friends redirect to dashboard (tabs inside dashboard) */}
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="/friends" element={<Navigate to="/dashboard" replace />} />

        {/* Catch-all — must be last */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
