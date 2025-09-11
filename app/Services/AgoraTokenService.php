<?php

namespace App\Services;

class AgoraTokenService
{
    public static function generateRtcToken($appId, $appCertificate, $channelName, $uid, $role, $expireTimeInSeconds = 3600)
{
    // Untuk Testing Mode (tanpa certificate), return null token
    if (empty($appCertificate)) {
        return null; // Agora SDK akan bekerja tanpa token di Testing Mode
    }

    // Original logic dengan certificate...
    $privileges = [
        '1' => $expireTimeInSeconds,
    ];

    if ($role === 'publisher') {
        $privileges['2'] = $expireTimeInSeconds;
    }

    $token = new TokenDecoded([
        'app_id' => $appId,
        'exp' => time() + $expireTimeInSeconds,
        'iat' => time(),
        'channel' => $channelName,
        'uid' => $uid
    ], $privileges);

    $tokenEncoded = $token->encode($appCertificate, 'HS256');
    
    return $tokenEncoded->toString();
}

    public static function generateToken($appId, $appCertificate, $channelName, $uid, $expireTime = 3600)
    {
        return self::generateRtcToken($appId, $appCertificate, $channelName, $uid, 'publisher', $expireTime);
    }
}
