<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiGeneration extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'user_id',
        'prompt',
        'response_json',
        'applied',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'response_json' => 'array',
            'applied'       => 'boolean',
            'created_at'    => 'datetime',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}