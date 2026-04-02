<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectFork extends Model
{
    public $timestamps = false;

    protected $fillable = ['original_project_id', 'forked_project_id', 'user_id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    // The project that was forked (the parent)
    public function originalProject()
    {
        return $this->belongsTo(Project::class, 'original_project_id');
    }

    // The new project created as the fork (the child)
    public function forkedProject()
    {
        return $this->belongsTo(Project::class, 'forked_project_id');
    }

    // Who performed the fork
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
