<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Group extends Model
{
    protected $fillable = ['name','owner_id'];

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'group_user');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(GroupMessage::class);
    }

    public function latestMessage()
    {
        // Ambil satu pesan (hasOne) dan urutkan berdasarkan yang paling baru (latest()).
        return $this->hasOne(GroupMessage::class)->latest();
    }

}
