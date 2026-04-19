<?php

namespace App\Models;

use Illuminate\Auth\MustVerifyEmail as MustVerifyEmailTrait;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use App\Models\AiGeneration;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, MustVerifyEmailTrait;

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

    // Expose is_admin on every serialised User so the frontend can gate admin UI
    // without a separate API call. Uses Spatie's hasRole() under the hood.
    protected $appends = ['is_admin'];

    public function getIsAdminAttribute(): bool
    {
        return $this->hasRole('admin');
    }

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

    // Use our custom branded verification email instead of Laravel's default
    public function sendEmailVerificationNotification()
    {
        $this->notify(new \App\Notifications\VerifyEmailNotification());
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

    // Friendships where this user sent the request
    public function sentFriendRequests()
    {
        return $this->hasMany(Friendship::class, 'requester_id');
    }

    // Friendships where this user received the request
    public function receivedFriendRequests()
    {
        return $this->hasMany(Friendship::class, 'receiver_id');
    }

    // ── Explore / Community relationships ─────────────────────────────────────

    // Users this user follows
    public function following()
    {
        return $this->hasMany(UserFollow::class, 'follower_id');
    }

    public function followingUsers()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id')
                    ->withPivot('created_at');
    }

    // Users who follow this user
    public function followers()
    {
        return $this->hasMany(UserFollow::class, 'following_id');
    }

    public function followerUsers()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'following_id', 'follower_id')
                    ->withPivot('created_at');
    }

    // Projects this user has starred
    public function stars()
    {
        return $this->hasMany(ProjectStar::class);
    }

    public function starredProjects()
    {
        return $this->belongsToMany(Project::class, 'project_stars')->withPivot('created_at');
    }

    // Projects this user has liked
    public function likes()
    {
        return $this->hasMany(ProjectLike::class);
    }

    public function likedProjects()
    {
        return $this->belongsToMany(Project::class, 'project_likes')->withPivot('created_at');
    }

    // Forks this user has created
    public function forks()
    {
        return $this->hasMany(ProjectFork::class);
    }

    // Comments this user has written on public schemas
    public function schemaComments()
    {
        return $this->hasMany(SchemaComment::class);
    }

    // Named collections this user has curated
    public function collections()
    {
        return $this->hasMany(Collection::class);
    }

    // AI generations this user has requested
    public function aiGenerations()
    {
        return $this->hasMany(AiGeneration::class);
    }
}