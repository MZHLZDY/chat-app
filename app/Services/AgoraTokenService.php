<?php

namespace App\Services;

class AgoraTokenService
{
    public static function generateRtcToken($appId, $appCertificate, $channelName, $uid, $role = 'publisher', $expireTime = 3600)
    {
        $version = "007";
        $expireTimestamp = time() + $expireTime;
        $salt = rand(1, 99999999);
        
        // Privileges sesuai dokumentasi Agora terbaru
        $privileges = [
            'join_channel' => 1,
            'publish_audio_stream' => ($role === 'publisher') ? 1 : 0,
            'publish_video_stream' => ($role === 'publisher') ? 1 : 0,
            'publish_data_stream' => ($role === 'publisher') ? 1 : 0
        ];
        
        // Generate signature dengan format yang benar
        $message = implode('', [
            $appId,
            $channelName,
            (string)$uid,
            (string)$expireTimestamp,
            (string)$salt,
            json_encode($privileges, JSON_UNESCAPED_SLASHES)
        ]);
        
        $signature = hash_hmac('sha256', $message, $appCertificate);
        
        // Build token dalam format yang sederhana dan efektif
        $tokenData = [
            'app_id' => $appId,
            'channel' => $channelName,
            'uid' => $uid,
            'expire' => $expireTimestamp,
            'salt' => $salt,
            'privileges' => $privileges,
            'signature' => $signature
        ];
        
        return base64_encode(json_encode($tokenData));
    }

    public static function generateToken($appId, $appCertificate, $channelName, $uid, $expireTime = 3600)
    {
        return self::generateRtcToken($appId, $appCertificate, $channelName, $uid, 'publisher', $expireTime);
    }
}