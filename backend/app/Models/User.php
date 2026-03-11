<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles;

    protected $fillable = [
        'name',
        'email',
        'password',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'is_active'         => 'boolean',
        ];
    }

    // A user owns many projects
    public function projects()
    {
        return $this->hasMany(Project::class, 'owner_id');
    }

    // Projects this user was invited to collaborate on
    public function collaboratingProjects()
    {
        return $this->belongsToMany(Project::class, 'project_collaborators')
                    ->withPivot('role', 'status', 'invited_at')
                    ->withTimestamps();
    }
}