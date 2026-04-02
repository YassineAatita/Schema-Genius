<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Collection extends Model
{
    protected $fillable = ['user_id', 'name', 'description', 'is_public'];

    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Projects saved in this collection (through pivot)
    public function projects()
    {
        return $this->belongsToMany(Project::class, 'collection_items')
                    ->withPivot('created_at')
                    ->orderByPivot('created_at', 'desc');
    }

    // Raw pivot records (useful for counts)
    public function items()
    {
        return $this->hasMany(CollectionItem::class);
    }
}
