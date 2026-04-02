<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectStar extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'project_id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
