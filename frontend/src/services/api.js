import axios from 'axios'

// API base URL is configured via VITE_API_URL (set as a Docker build ARG in production,
// or in frontend/.env for local development without Docker).
//
// The value must NOT include a trailing /api — this file appends it automatically.
//
//   Development : VITE_API_URL=http://localhost:8000   → baseURL = http://localhost:8000/api
//   Production  : VITE_API_URL=/                       → baseURL = /api  (same-origin, Nginx routes it)
//
// The .replace() strips any trailing slash so both "http://host" and "/" work correctly.
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '') + '/api',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Automatically attach token to every request if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If server returns 401 (unauthorized), log the user out automatically.
// If the user HAD a token (thought they were authenticated) when the 401
// arrived, it means the session was terminated externally — most likely
// because the account was signed in from another browser.  Store a reason
// so LoginPage can surface the right message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      sessionStorage.removeItem('dashboard_view')
      if (hadToken) {
        sessionStorage.setItem('logout_reason', 'session_conflict')
      }
      window.location.replace('/login')
    }
    return Promise.reject(error)
  }
)

export default api