<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Models\ChatMessage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone_number'
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
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

    public function getChatPartnersAttribute()
    {
        $sentTo = $this->sentMessages()->distinct()->pluck('receiver_id');
        $receivedFrom = $this->receivedMessages()->distinct()->pluck('sender_id');
        $partnerIds = $sentTo->merge($receivedFrom)->unique();
        
        return User::whereIn('id', $partnerIds)->get();
    }
}