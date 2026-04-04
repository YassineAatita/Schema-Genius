<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\SchemaComment;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    // GET /api/projects/{id}/comments — public, guests allowed
    public function index($id)
    {
        $project = Project::where('visibility', 'public')->findOrFail($id);

        // Return top-level comments with their replies and authors eagerly loaded
        $comments = SchemaComment::where('project_id', $project->id)
            ->whereNull('parent_id')
            ->with(['author', 'replies.author'])
            ->latest()
            ->paginate(30);

        $items = $comments->getCollection()->map(fn ($c) => $this->formatComment($c));

        return response()->json([
            'data'  => $items,
            'total' => $comments->total(),
        ]);
    }

    // POST /api/projects/{id}/comments — auth required
    public function store(Request $request, $id)
    {
        $project = Project::where('visibility', 'public')->findOrFail($id);
        $user    = $request->user();

        $validated = $request->validate([
            'content'   => 'required|string|max:2000',
            'parent_id' => 'nullable|exists:schema_comments,id',
        ]);

        // Validate parent belongs to same project
        if ($validated['parent_id'] ?? null) {
            $parent = SchemaComment::findOrFail($validated['parent_id']);
            if ($parent->project_id !== $project->id) {
                return response()->json(['error' => 'Parent comment does not belong to this project.'], 422);
            }
            // Only one level of nesting allowed (replies cannot have replies)
            if ($parent->parent_id !== null) {
                return response()->json(['error' => 'Nested replies beyond one level are not allowed.'], 422);
            }
        }

        $comment = SchemaComment::create([
            'project_id' => $project->id,
            'user_id'    => $user->id,
            'parent_id'  => $validated['parent_id'] ?? null,
            'content'    => $validated['content'],
        ]);

        $comment->load('author');

        // BUG 4 FIX — straight ASCII quotes, wrapped in try/catch so a notification
        // failure never causes a 500 and discards the successfully saved comment.
        if ($project->owner_id !== $user->id) {
            try {
                Notification::create([
                    'user_id' => $project->owner_id,
                    'type'    => 'new_comment',
                    'title'   => 'New comment on your schema',
                    'message' => "{$user->name} commented on \"{$project->name}\".",
                    'data'    => [
                        'project_id' => $project->id,
                        'comment_id' => $comment->id,
                        'actor_id'   => $user->id,
                        'actor_name' => $user->name,
                    ],
                ]);
            } catch (\Throwable $e) {
                // Notification failure must not fail the comment action
            }
        }

        return response()->json($this->formatComment($comment), 201);
    }

    // PUT /api/comments/{id} — edit own comment
    public function update(Request $request, $id)
    {
        $comment = SchemaComment::findOrFail($id);
        $user    = $request->user();

        if ($comment->user_id !== $user->id) {
            return response()->json(['error' => 'You can only edit your own comments.'], 403);
        }

        $validated = $request->validate(['content' => 'required|string|max:2000']);
        $comment->update(['content' => $validated['content']]);
        $comment->load('author');

        return response()->json($this->formatComment($comment));
    }

    // DELETE /api/comments/{id} — delete own comment (or project owner can delete any)
    public function destroy(Request $request, $id)
    {
        $comment = SchemaComment::findOrFail($id);
        $user    = $request->user();

        $isProjectOwner = $comment->project->owner_id === $user->id;
        if ($comment->user_id !== $user->id && !$isProjectOwner) {
            return response()->json(['error' => 'You do not have permission to delete this comment.'], 403);
        }

        $comment->delete(); // replies cascade via DB FK

        return response()->json(['message' => 'Comment deleted.']);
    }

    private function formatComment(SchemaComment $comment): array
    {
        return [
            'id'         => $comment->id,
            'content'    => $comment->content,
            'parent_id'  => $comment->parent_id,
            'created_at' => $comment->created_at,
            'updated_at' => $comment->updated_at,
            'author'     => [
                'id'         => $comment->author->id,
                'name'       => $comment->author->name,
                'avatar_url' => $comment->author->avatar_url,
            ],
            'replies'    => ($comment->relationLoaded('replies'))
                ? $comment->replies->map(fn ($r) => $this->formatComment($r))->values()
                : [],
        ];
    }
}
