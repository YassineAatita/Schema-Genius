<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectCollaborator extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'user_id',
        'role',
        'invited_at',
    ];

    protected function casts(): array
    {
        return [
            'invited_at' => 'datetime',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}