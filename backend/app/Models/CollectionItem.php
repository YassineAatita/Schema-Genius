<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CollectionItem extends Model
{
    public $timestamps = false;

    protected $fillable = ['collection_id', 'project_id'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function collection()
    {
        return $this->belongsTo(Collection::class);
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
