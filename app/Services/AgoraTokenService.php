<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class AgoraTokenService
{
    public static function generateRtcToken($appId, $appCertificate, $channelName, $uid, $role, $expireTimeInSeconds = 3600)
    {
        // Untuk Testing Mode, return null (Agora SDK akan bekerja tanpa token)
        if (empty($appCertificate) || $appCertificate === 'YOUR_APP_CERTIFICATE') {
            return null;
        }

        // Jika menggunakan Secure Mode, implementasi token generation di sini
        // Untuk sekarang return null dulu untuk testing
        return null;
    }

    public static function generateToken($appId, $appCertificate, $channelName, $uid, $expireTime = 3600)
    {
        return self::generateRtcToken($appId, $appCertificate, $channelName, $uid, 'publisher', $expireTime);
    }
}