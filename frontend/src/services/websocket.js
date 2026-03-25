import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_REVERB_APP_KEY || 'sg-local-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || '127.0.0.1',
    wsPort: parseInt(import.meta.env.VITE_REVERB_PORT) || 8080,
    wssPort: parseInt(import.meta.env.VITE_REVERB_PORT) || 8080,
    forceTLS: false,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    cluster: 'mt1',   // required by pusher-js validation even when wsHost overrides it

    // ── Channel authentication ──────────────────────────────────────────────
    // authorizer is called fresh on every channel join, so it always reads the
    // current token from localStorage — even though Echo is created at module
    // load time (before the user has logged in).  Using the static `auth.headers`
    // object would snapshot an empty token and cause 401 on every auth request.
    authorizer: (channel) => ({
        authorize(socketId, callback) {
            const token = localStorage.getItem('token') || '';
            fetch('http://127.0.0.1:8000/broadcasting/auth', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Accept':        'application/json',
                    'Authorization': 'Bearer ' + token,
                },
                body: JSON.stringify({
                    socket_id:    socketId,
                    channel_name: channel.name,
                }),
            })
            .then(res => {
                if (!res.ok) throw new Error('auth ' + res.status);
                return res.json();
            })
            .then(data  => callback(false, data))
            .catch(err  => callback(true,  err));
        },
    }),
});

window.Echo.connector.pusher.connection.bind('state_change', (states) => {
    console.log('[Reverb] connection:', states.previous, '→', states.current);
});

export default window.Echo;

export function joinProjectChannel(projectId) {
    return window.Echo.join(`project.${projectId}`)
}

export function leaveProjectChannel(projectId) {
    window.Echo.leave(`project.${projectId}`)
}

export function destroyEcho() {
    window.Echo.disconnect()
}

// Tell Vite's HMR to accept updates to this module.
// Without this, changes to websocket.js don't hot-reload — Vite falls back
// to keeping the old module in memory, so the browser sees stale config.
if (import.meta.hot) {
    import.meta.hot.accept(() => {
        // On hot update, disconnect the old Echo instance so the new one
        // (created at module top) takes over cleanly.
        try { window.Echo?.disconnect() } catch {}
    })
}
