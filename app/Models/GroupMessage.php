<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\HiddenMessage;

class GroupMessage extends Model
{
    use HasFactory, SoftDeletes;
    protected $fillable = ['group_id','sender_id','message', 'type', 'file_path', 'file_name', 'file_mime_type', 'file_size'];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
    
    public function hiddenForUsers()
    {
        return $this->morphMany(HiddenMessage::class, 'message');
    }
}
