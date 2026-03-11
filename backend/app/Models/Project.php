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
}