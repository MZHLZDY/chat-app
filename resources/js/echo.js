import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

window.Echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    forceTLS: true,
    // explicitly enable transports for reliability
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/broadcasting/auth',
    auth: {
        headers: {
            'X-CSRF-TOKEN': csrf
        },
        // withCredentials is an option used internally when Echo performs the auth POST
        // We'll also set axios.defaults.withCredentials = true in frontend component
    }
});

export const echo = window.Echo;
