<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeaturedSchema;
use App\Models\Project;
use Illuminate\Http\Request;

class FeaturedSchemaController extends Controller
{
    // POST /api/admin/featured — set/replace the featured schema for a given week
    // Restricted to users with the 'admin' Spatie role.
    public function store(Request $request)
    {
        if (!$request->user()->hasRole('admin')) {
            return response()->json(['error' => 'Admin access required.'], 403);
        }

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'week_of'    => 'required|date_format:Y-m-d', // should be a Monday
            'note'       => 'nullable|string|max:500',
        ]);

        // Ensure the project is public before featuring it
        $project = Project::findOrFail($validated['project_id']);
        if ($project->visibility !== 'public') {
            return response()->json(['error' => 'Only public projects can be featured.'], 422);
        }

        // Upsert: one featured project per week
        $featured = FeaturedSchema::updateOrCreate(
            ['week_of' => $validated['week_of']],
            [
                'project_id'  => $validated['project_id'],
                'featured_by' => $request->user()->id,
                'note'        => $validated['note'] ?? null,
            ]
        );

        return response()->json($featured, 201);
    }

    // GET /api/admin/featured/history — past featured schemas (admin only)
    public function history(Request $request)
    {
        if (!$request->user()->hasRole('admin')) {
            return response()->json(['error' => 'Admin access required.'], 403);
        }

        $history = FeaturedSchema::with(['project.owner', 'featuredByUser'])
            ->orderBy('week_of', 'desc')
            ->paginate(20);

        return response()->json($history);
    }
}
