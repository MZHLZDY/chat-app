import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

// Function untuk get CSRF token dengan fallback
const getCsrfToken = () => {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
};

// Function untuk handle auth error
const handleAuthError = (error, channelName) => {
    console.error(`❌ Authorization failed for channel: ${channelName}`, error);
    
    if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        // Log khusus untuk 403 errors
        if (error.response.status === 403) {
            console.error('🚫 403 Forbidden - Check channel authorization logic');
        }
    }
    
    return error;
};

const echo = new Echo({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
    wsHost: window.location.hostname,
    wsPort: 6001,
    wssPort: 6001,
    forceTLS: false, // Ubah ke false untuk development
    enabledTransports: ['ws', 'wss'],
    
    // Konfigurasi authorization yang lebih robust
    authorizer: (channel, options) => {
        return {
            authorize: (socketId, callback) => {
                console.log(`🔐 Attempting to authorize channel: ${channel.name}`);
                
                axios.post('/broadcasting/auth', {
                    socket_id: socketId,
                    channel_name: channel.name
                }, {
                    headers: {
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                })
                .then(response => {
                    console.log(`✅ Authorized successfully for: ${channel.name}`);
                    callback(false, response.data);
                })
                .catch(error => {
                    const handledError = handleAuthError(error, channel.name);
                    callback(true, handledError);
                });
            }
        };
    }
});

// Debug connection events
echo.connector.pusher.connection.bind('connected', () => {
    console.log('✅ Pusher connected successfully');
    console.log('Socket ID:', echo.connector.pusher.connection.socket_id);
});

echo.connector.pusher.connection.bind('error', (error) => {
    console.error('❌ Pusher connection error:', error);
});

echo.connector.pusher.connection.bind('disconnected', () => {
    console.log('🔌 Pusher disconnected');
});

// Export both default and named export
export default echo;
export { echo };