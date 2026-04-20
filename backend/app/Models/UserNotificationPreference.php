<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserNotificationPreference extends Model
{
    protected $fillable = [
        'user_id',
        'starred_schema',
        'liked_schema',
        'forked_schema',
        'commented_schema',
        'friend_request_received',
        'friend_request_accepted',
        'collaboration_invited',
        'schema_of_the_week',
    ];

    protected function casts(): array
    {
        return [
            'starred_schema'          => 'boolean',
            'liked_schema'            => 'boolean',
            'forked_schema'           => 'boolean',
            'commented_schema'        => 'boolean',
            'friend_request_received' => 'boolean',
            'friend_request_accepted' => 'boolean',
            'collaboration_invited'   => 'boolean',
            'schema_of_the_week'      => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
