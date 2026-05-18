<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeaturedSchema extends Model
{
    public $timestamps = false;

    protected $fillable = ['project_id', 'featured_by', 'week_of', 'note', 'is_visible'];

    protected function casts(): array
    {
        return [
            'week_of'    => 'date',
            'created_at' => 'datetime',
            'is_visible' => 'boolean',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function featuredByUser()
    {
        return $this->belongsTo(User::class, 'featured_by');
    }
}
