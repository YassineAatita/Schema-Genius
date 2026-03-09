<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Schema extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'name',
        'current_version_id',
    ];

    // The project this schema belongs to
    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    // All saved versions of this schema
    public function versions()
    {
        return $this->hasMany(SchemaVersion::class)->orderBy('version_number', 'desc');
    }

    // The current active version
    public function currentVersion()
    {
        return $this->belongsTo(SchemaVersion::class, 'current_version_id');
    }
}