<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Notifications\Notifiable;
use App\Notifications\VerifyEmailNotification;
use App\Models\ChatMessage;
use Laravel\Sanctum\HasApiTokens;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasPushSubscriptions, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone_number',
        'profile_photo_path',
        'background_image_path',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */

    protected $appends = [
    'profile_photo_url'
    ];
    
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     * 
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_seen' => 'datetime'
        ];
    }

    public function sentMessages()
    {
        return $this->hasMany(ChatMessage::class, 'sender_id');
    }

    public function receivedMessages()
    {
        return $this->hasMany(ChatMessage::class, 'receiver_id');
    }
    
    public function groups()
    {
        return $this->belongsToMany(Group::class, 'group_user', 'user_id', 'group_id');
    }

    public function latestMessageSent()
    {
        return $this->hasOne(ChatMessage::class, 'sender_id')->latest();
    }

    public function latestMessageReceived()
    {
        return $this->hasOne(ChatMessage::class, 'receiver_id')->latest();
    }

    public function sendEmailVerificationNotification()
    {
        $this->notify(new VerifyEmailNotification);
    }

    public function getChatPartnersAttribute()
    {
        $sentTo = $this->sentMessages()->distinct()->pluck('receiver_id');
        $receivedFrom = $this->receivedMessages()->distinct()->pluck('sender_id');
        $partnerIds = $sentTo->merge($receivedFrom)->unique();
        
        return User::whereIn('id', $partnerIds)->get();
    }

    public function getProfilePhotoUrlAttribute()
    {
        if ($this->profile_photo_path) {
            return asset('storage/' . $this->profile_photo_path) . '?v=' . $this->updated_at->timestamp;
        }
        return 'https://ui-avatars.com/api/?name=' . urlencode($this->name) . '&color=7F9CF5&background=EBF4FF';
    }

    public function getBackgroundImageUrlAttribute()
    {
        if ($this->background_image_path) {
            return asset('storage/' . $this->background_image_path) . '?v=' . $this->updated_at->timestamp;
        }
        return 'https://via.placeholder.com/1000x400.png/EBF4FF?text=';
    }
}