<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
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
        'user_type',
        'headline',
        'bio',
        'avatar_url',
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

    // Return avatar_url as a full API URL (bypasses storage symlink issues)
    // Uses basename() to handle both old "/storage/avatars/file.jpg" and new "file.jpg" formats
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(fn ($value) => $value ? url('/api/avatars/' . basename($value)) : null);
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