<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\HiddenMessage;

class ChatMessage extends Model
{
    use HasFactory, SoftDeletes;
    protected $fillable = ["sender_id", "receiver_id", "message"];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, "sender_id");
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, "receiver_id");
    }

    public function hiddenForUsers()
    {
        return $this->morphMany(HiddenMessage::class, 'message');
    }

    public function parentMessage()
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }
}
