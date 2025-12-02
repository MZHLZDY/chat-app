import { computed } from 'vue';

export function useCallEventFormatter() {
    /**
     * Format durasi panggilan menjadi teks yang ramah
     */
    const formatCallDuration = (seconds: number | null | undefined): string => {
        if (!seconds || seconds <= 0) return '';
        
        if (seconds < 60) {
            return `${seconds} dtk`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes < 60) {
            if (remainingSeconds > 0) {
                return `${minutes} mnt ${remainingSeconds} dtk`;
            }
            return `${minutes} mnt`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes > 0) {
            return `${hours} jam ${remainingMinutes} mnt`;
        }
        return `${hours} jam`;
    };

    /**
     * Format teks pesan panggilan berdasarkan status
     * Sama persis dengan CallEvent.php di backend
     */
    const formatCallEventText = (
        status: string, 
        callType: 'voice' | 'video' = 'voice', 
        duration: number | null = null, 
        reason: string | null = null
    ): string => {
        const text = callType === 'video' ? 'Panggilan Video' : 'Panggilan Suara';

        switch (status) {
            case 'calling':
                return `${text} • Memanggil`;
                
            case 'accepted':
                return `${text} • Diterima`;
                
            case 'rejected':
                if (reason) {
                    return `${text} • Ditolak - ${reason}`;
                }
                return `${text} • Ditolak`;
                
            case 'cancelled':
                return `${text} • Dibatalkan`;
                
            case 'missed':
                return `${text} • Tak terjawab`;
                
            case 'ended':
                if (duration && duration > 0) {
                    const durationText = formatCallDuration(duration);
                    return `${text} • ${durationText}`;
                }
                return `${text} • Selesai`;
                
            default:
                return `${text} • Selesai`;
        }
    };

    /**
     * Parse teks pesan panggilan untuk mendapatkan komponennya
     * Berguna untuk debugging atau menampilkan komponen terpisah
     */
    const parseCallEventText = (text: string) => {
        const parts = text.split(' • ');
        const callType = parts[0].includes('Video') ? 'video' : 'voice';
        const statusText = parts[1] || '';
        
        let status = 'unknown';
        let duration = null;
        let reason = null;
        
        if (statusText.includes('Memanggil')) status = 'calling';
        else if (statusText.includes('Diterima')) status = 'accepted';
        else if (statusText.includes('Ditolak')) {
            status = 'rejected';
            const reasonMatch = statusText.match(/Ditolak - (.+)/);
            if (reasonMatch) reason = reasonMatch[1];
        }
        else if (statusText.includes('Tak terjawab')) status = 'missed';
        else if (statusText.includes('dtk') || statusText.includes('mnt') || statusText.includes('jam')) {
            status = 'ended';
            // Ekstrak durasi dari teks
            const durationMatch = statusText.match(/(\d+)\s*(dtk|mnt|jam)/);
            if (durationMatch) {
                // Convert ke detik (sederhana)
                const value = parseInt(durationMatch[1]);
                const unit = durationMatch[2];
                
                if (unit === 'dtk') duration = value;
                else if (unit === 'mnt') duration = value * 60;
                else if (unit === 'jam') duration = value * 3600;
            }
        }
        
        return { callType, status, duration, reason, originalText: text };
    };

    /**
     * Format untuk display di UI (bisa dengan icon atau styling)
     */
    const formatForDisplay = (
        status: string, 
        callType: 'voice' | 'video' = 'voice', 
        duration: number | null = null, 
        reason: string | null = null
    ) => {
        const text = formatCallEventText(status, callType, duration, reason);
        
        return {
            text,
            icon: callType === 'video' ? 'video' : 'phone',
            color: getStatusColor(status),
            duration: duration ? formatCallDuration(duration) : null
        };
    };

    /**
     * Warna berdasarkan status (untuk UI)
     */
    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'calling': return 'text-blue-500';
            case 'accepted': return 'text-green-500';
            case 'rejected': return 'text-red-500';
            case 'missed': return 'text-yellow-500';
            case 'ended': return 'text-gray-500';
            default: return 'text-gray-500';
        }
    };

    /**
     * Computed untuk live duration (saat panggilan berlangsung)
     */
    const useLiveDuration = (startTime: number | null) => {
        return computed(() => {
            if (!startTime) return '00:00';
            
            const now = Date.now();
            const seconds = Math.floor((now - startTime) / 1000);
            
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        });
    };

    return {
        formatCallDuration,
        formatCallEventText,
        parseCallEventText,
        formatForDisplay,
        getStatusColor,
        useLiveDuration
    };
}

// Export juga sebagai fungsi standalone untuk digunakan di non-composition context
export const formatCallEventText = (
    status: string, 
    callType: 'voice' | 'video' = 'voice', 
    duration: number | null = null, 
    reason: string | null = null
) => {
    const formatter = useCallEventFormatter();
    return formatter.formatCallEventText(status, callType, duration, reason);
};

export const formatCallDuration = (seconds: number | null | undefined): string => {
    const formatter = useCallEventFormatter();
    return formatter.formatCallDuration(seconds);
};