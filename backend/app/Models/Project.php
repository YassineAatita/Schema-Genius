<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'owner_id',
        'name',
        'description',
        'visibility',
    ];

    // The user who created this project
    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    // The schema that belongs to this project
    public function schema()
    {
        return $this->hasOne(Schema::class);
    }

    // Collaborators invited to this project
    public function collaborators()
    {
        return $this->belongsToMany(User::class, 'project_collaborators')
                    ->withPivot('role', 'status', 'invited_at')
                    ->withTimestamps();
    }

    // Raw pivot records for collaborators
    public function projectCollaborators()
    {
        return $this->hasMany(ProjectCollaborator::class);
    }

    // AI generations for this project
    public function aiGenerations()
    {
        return $this->hasMany(AiGeneration::class);
    }

    // ── Explore / Community relationships ─────────────────────────────────────

    // Users who starred this project
    public function stars()
    {
        return $this->hasMany(ProjectStar::class);
    }

    public function starredByUsers()
    {
        return $this->belongsToMany(User::class, 'project_stars')->withPivot('created_at');
    }

    // Users who liked this project
    public function likes()
    {
        return $this->hasMany(ProjectLike::class);
    }

    public function likedByUsers()
    {
        return $this->belongsToMany(User::class, 'project_likes')->withPivot('created_at');
    }

    // Forks created from this project (children in the Schema DNA tree)
    public function forks()
    {
        return $this->hasMany(ProjectFork::class, 'original_project_id');
    }

    // The fork record that links THIS project back to its parent (null if not a fork)
    public function forkOrigin()
    {
        return $this->hasOne(ProjectFork::class, 'forked_project_id');
    }

    // Comments on this project
    public function comments()
    {
        return $this->hasMany(SchemaComment::class);
    }

    // Collections that include this project
    public function collections()
    {
        return $this->belongsToMany(Collection::class, 'collection_items')->withPivot('created_at');
    }

    // Featured schema record (if any)
    public function featuredSchema()
    {
        return $this->hasOne(FeaturedSchema::class);
    }
}