<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeaturedSchema;
use App\Models\Project;
use Illuminate\Http\Request;

class FeaturedSchemaController extends Controller
{
    // Endpoints:
    //   GET   /api/admin/featured/current     → current()
    //   PATCH /api/admin/featured/visibility  → toggleVisibility()
    //   POST  /api/admin/featured             → store()
    //   GET   /api/admin/featured/history     → history()
    // All methods are restricted to users with the 'admin' Spatie role.

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

    // GET /api/admin/featured/current — current week's featured schema (admin only)
    // Returns null if nothing has been set (manually or auto-picked) for this week yet.
    public function current(Request $request)
    {
        if (!$request->user()->hasRole('admin')) {
            return response()->json(['error' => 'Admin access required.'], 403);
        }

        $weekStart = now()->startOfWeek(\Carbon\Carbon::MONDAY)->toDateString();

        $featured = FeaturedSchema::with(['project', 'featuredByUser'])
            ->where('week_of', $weekStart)
            ->first();

        if (!$featured) {
            return response()->json(null);
        }

        return response()->json([
            'id'           => $featured->id,
            'project_id'   => $featured->project_id,
            'project_name' => $featured->project?->name,
            'week_of'      => $featured->week_of,
            'note'         => $featured->note,
            'is_visible'   => (bool) ($featured->is_visible ?? true),
            'featured_by'  => $featured->featuredByUser?->name,
            'auto_selected'=> $featured->featured_by === null,
        ]);
    }

    // PATCH /api/admin/featured/visibility — show/hide the current week's banner (admin only)
    public function toggleVisibility(Request $request)
    {
        if (!$request->user()->hasRole('admin')) {
            return response()->json(['error' => 'Admin access required.'], 403);
        }

        $validated = $request->validate([
            'is_visible' => 'required|boolean',
        ]);

        $weekStart = now()->startOfWeek(\Carbon\Carbon::MONDAY)->toDateString();

        $featured = FeaturedSchema::where('week_of', $weekStart)->first();

        if (!$featured) {
            return response()->json(['error' => 'No featured schema set for this week.'], 404);
        }

        $featured->is_visible = $validated['is_visible'];
        $featured->save();

        return response()->json([
            'id'         => $featured->id,
            'is_visible' => (bool) $featured->is_visible,
            'week_of'    => $featured->week_of,
        ]);
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
