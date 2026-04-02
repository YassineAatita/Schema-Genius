<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchemaComment extends Model
{
    protected $fillable = ['project_id', 'user_id', 'parent_id', 'content'];

    // Replies to this comment (one level deep)
    public function replies()
    {
        return $this->hasMany(SchemaComment::class, 'parent_id')->with('author')->latest();
    }

    // The parent comment (null for top-level comments)
    public function parent()
    {
        return $this->belongsTo(SchemaComment::class, 'parent_id');
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
