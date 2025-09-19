<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class HiddenMessage extends Model
{
    use HasFactory;

    /**
     * Nama tabel yang digunakan oleh model.
     *
     * @var string
     */
    protected $table = 'hidden_messages';

    /**
     * Properti yang boleh diisi secara massal (mass assignable).
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'message_id',
        'message_type',
    ];

    /** 
     * Mendapatkan model induk (bisa ChatMessage atau GroupMessage).
     */
    public function message(): MorphTo
    {
        return $this->morphTo();
    }
}