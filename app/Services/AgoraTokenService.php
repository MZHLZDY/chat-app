<?php

namespace App\Services;

class AgoraTokenService
{
    public static function generateToken($appId, $appCertificate, $channelName, $uid, $expireTime = 3600)
    {
        $version = "006";
        $expire = time() + $expireTime;
        $salt = rand(1, 99999999);
        
        // Generate signature
        $signature = hash('sha256', $appId . $channelName . $uid . $expire . $salt . $appCertificate);
        
        return $version . $appId . $channelName . $uid . $expire . $salt . $signature;
    }

    public static function generateRtcToken($appId, $appCertificate, $channelName, $uid, $role = 'publisher', $expireTime = 3600)
    {
        $version = "006";
        $expire = time() + $expireTime;
        $salt = rand(1, 99999999);
        
        // Privileges
        $privileges = [
            'join_channel' => 1,
            'publish_audio_stream' => $role === 'publisher' ? 1 : 0,
            'publish_video_stream' => $role === 'publisher' ? 1 : 0,
            'publish_data_stream' => $role === 'publisher' ? 1 : 0
        ];
        
        // Generate signature dengan privileges
        $privilegeString = implode('', array_values($privileges));
        $signature = hash('sha256', $appId . $channelName . $uid . $expire . $salt . $privilegeString . $appCertificate);
        
        return $version . $appId . $channelName . $uid . $expire . $salt . $privilegeString . $signature;
    }
}