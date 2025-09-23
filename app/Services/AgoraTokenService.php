<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class AgoraTokenService
{
    public static function generateRtcToken($appId, $appCertificate, $channelName, $uid, $role, $expireTimeInSeconds = 3600)
{
    // Fungsi ini akan mengembalikan null HANYA jika certificate tidak di-set di .env
    // Ini memungkinkan mode testing jika Anda sengaja mengosongkan certificate
    if (empty($appCertificate) || $appCertificate === 'YOUR_APP_CERTIFICATE') {
        Log::warning('Agora App Certificate is not set. Running in testing mode (token is null).');
        return null;
    }

    // Logika pembuatan token yang sebenarnya, yang sebelumnya tidak pernah berjalan
    // (Jika Anda sudah punya library/helper, gunakan itu. Jika tidak, Anda perlu implementasi)
    // Untuk contoh ini, saya akan asumsikan Anda ingin menggunakan helper token builder.
    // Jika Anda belum install, jalankan: composer require agora-io/token-sdk-php
    
    // Ganti dengan implementasi token builder Anda yang sesungguhnya.
    // Kode di bawah ini adalah contoh jika Anda menggunakan library resmi Agora.
    // Pastikan Anda sudah `use RtcTokenBuilder;` di atas file.
    
    // return \App\Services\RtcTokenBuilder::buildTokenWithUid($appId, $appCertificate, $channelName, $uid, \App\Services\RtcTokenBuilder::RolePublisher, $expireTimeInSeconds);
    
    // Untuk saat ini, kita akan aktifkan kode yang sudah Anda tulis di bawah.
    return self::buildTokenWithUid($appId, $appCertificate, $channelName, $uid, $role, $expireTimeInSeconds);
}

    /**
     * Build token untuk production (akan digunakan nanti)
     */
    private static function buildTokenWithUid($appId, $appCertificate, $channelName, $uid, $role, $expireTimeInSeconds)
    {
        $expireTimeInSeconds = $expireTimeInSeconds > 0 ? $expireTimeInSeconds : 3600;
        $currentTime = time();
        $privilegeExpiredTs = $currentTime + $expireTimeInSeconds;

        $token = [
            "app_id" => $appId,
            "expire" => $privilegeExpiredTs,
            "issue_ts" => $currentTime,
            "salt" => rand(1, 99999999),
            "services" => [
                "rtc" => [
                    "channel_name" => $channelName,
                    "uid" => (string)$uid,
                    "privileges" => [
                        "JoinChannel" => $privilegeExpiredTs,
                        "PublishAudioStream" => $role === 'publisher' ? $privilegeExpiredTs : 0,
                        "PublishVideoStream" => $role === 'publisher' ? $privilegeExpiredTs : 0,
                        "PublishDataStream" => $role === 'publisher' ? $privilegeExpiredTs : 0,
                    ]
                ]
            ]
        ];

        $encodedToken = json_encode($token);
        $signature = hash_hmac('sha256', $encodedToken, $appCertificate, true);
        
        return base64_encode($encodedToken . '.' . base64_encode($signature));
    }

    public static function generateToken($appId, $appCertificate, $channelName, $uid, $expireTime = 3600)
    {
        return self::generateRtcToken($appId, $appCertificate, $channelName, $uid, 'publisher', $expireTime);
    }
}