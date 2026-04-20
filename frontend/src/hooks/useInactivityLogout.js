import { useEffect, useRef } from 'react'
import useAuthStore from '../store/useAuthStore'

// Automatically logs the user out after TIMEOUT_MS of no mouse, keyboard,
// click, scroll, or touch activity.  Should be mounted once at the app level.
const TIMEOUT_MS = 25 * 60 * 1000 // 25 minutes

export default function useInactivityLogout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const logout          = useAuthStore(s => s.logout)
  const timerRef        = useRef(null)

  useEffect(() => {
    // Only arm the timer when the user is authenticated
    if (!isAuthenticated) return

    const fireLogout = () => {
      sessionStorage.setItem('logout_reason', 'inactivity')
      // logout() already clears token + sessionStorage dashboard_view
      logout()
      window.location.replace('/login')
    }

    const resetTimer = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fireLogout, TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))

    // Arm immediately on mount (or when auth state becomes true)
    resetTimer()

    return () => {
      clearTimeout(timerRef.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [isAuthenticated]) // re-arm when auth state changes
}
