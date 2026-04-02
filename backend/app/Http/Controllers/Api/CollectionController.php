<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\CollectionItem;
use App\Models\Project;
use Illuminate\Http\Request;

class CollectionController extends Controller
{
    // GET /api/collections — list my collections
    public function index(Request $request)
    {
        $collections = Collection::where('user_id', $request->user()->id)
            ->withCount('items')
            ->latest()
            ->get()
            ->map(fn ($c) => $this->formatCollection($c));

        return response()->json($collections);
    }

    // POST /api/collections — create a collection
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:300',
            'is_public'   => 'boolean',
        ]);

        $collection = Collection::create([
            'user_id'     => $request->user()->id,
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_public'   => $validated['is_public'] ?? false,
        ]);

        $collection->loadCount('items');
        return response()->json($this->formatCollection($collection), 201);
    }

    // GET /api/collections/{id} — view a collection (auth required for private)
    public function show(Request $request, $id)
    {
        $collection = Collection::withCount('items')->findOrFail($id);

        if (!$collection->is_public && $collection->user_id !== $request->user()?->id) {
            return response()->json(['error' => 'This collection is private.'], 403);
        }

        // Load projects in this collection with explore stats
        $projects = $collection->projects()
            ->with(['owner', 'schema.currentVersion'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->paginate(20);

        $items = $projects->getCollection()->map(function ($p) {
            $schemaJson = $p->schema?->currentVersion?->schema_json;
            return [
                'id'          => $p->id,
                'name'        => $p->name,
                'description' => $p->description,
                'visibility'  => $p->visibility,
                'owner'       => ['id' => $p->owner->id, 'name' => $p->owner->name, 'avatar_url' => $p->owner->avatar_url],
                'stats'       => [
                    'stars'    => $p->stars_count,
                    'likes'    => $p->likes_count,
                    'forks'    => $p->forks_count,
                    'comments' => $p->comments_count,
                    'tables'   => is_array($schemaJson) ? count($schemaJson['nodes'] ?? []) : 0,
                    'edges'    => is_array($schemaJson) ? count($schemaJson['edges'] ?? []) : 0,
                ],
                'added_at'    => $p->pivot->created_at,
            ];
        });

        return response()->json(array_merge($this->formatCollection($collection), [
            'projects'      => $items,
            'projects_meta' => ['total' => $projects->total(), 'current_page' => $projects->currentPage()],
        ]));
    }

    // PUT /api/collections/{id} — update collection metadata
    public function update(Request $request, $id)
    {
        $collection = Collection::findOrFail($id);

        if ($collection->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:300',
            'is_public'   => 'boolean',
        ]);

        $collection->update($validated);
        $collection->loadCount('items');
        return response()->json($this->formatCollection($collection));
    }

    // DELETE /api/collections/{id}
    public function destroy(Request $request, $id)
    {
        $collection = Collection::findOrFail($id);

        if ($collection->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $collection->delete();
        return response()->json(['message' => 'Collection deleted.']);
    }

    // POST /api/collections/{id}/items — add a project to a collection
    public function addItem(Request $request, $id)
    {
        $collection = Collection::findOrFail($id);

        if ($collection->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $validated = $request->validate(['project_id' => 'required|exists:projects,id']);

        // Only public projects can be saved to collections
        $project = Project::findOrFail($validated['project_id']);
        if ($project->visibility !== 'public') {
            return response()->json(['error' => 'Only public projects can be added to collections.'], 422);
        }

        $already = CollectionItem::where('collection_id', $collection->id)
                                  ->where('project_id', $project->id)
                                  ->exists();
        if ($already) {
            return response()->json(['error' => 'Project already in this collection.'], 409);
        }

        CollectionItem::create(['collection_id' => $collection->id, 'project_id' => $project->id]);

        return response()->json(['message' => 'Project added to collection.'], 201);
    }

    // DELETE /api/collections/{id}/items/{projectId} — remove from collection
    public function removeItem(Request $request, $id, $projectId)
    {
        $collection = Collection::findOrFail($id);

        if ($collection->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        CollectionItem::where('collection_id', $collection->id)
                       ->where('project_id', $projectId)
                       ->delete();

        return response()->json(['message' => 'Project removed from collection.']);
    }

    private function formatCollection(Collection $collection): array
    {
        return [
            'id'          => $collection->id,
            'name'        => $collection->name,
            'description' => $collection->description,
            'is_public'   => $collection->is_public,
            'item_count'  => $collection->items_count ?? 0,
            'created_at'  => $collection->created_at,
            'updated_at'  => $collection->updated_at,
        ];
    }
}
