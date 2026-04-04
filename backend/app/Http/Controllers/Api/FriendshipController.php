<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class FriendshipController extends Controller
{
    // ── Private helpers ────────────────────────────────────────────

    private function getFriendship(int $authId, int $otherId): ?Friendship
    {
        return Friendship::where(function ($q) use ($authId, $otherId) {
            $q->where('requester_id', $authId)->where('receiver_id', $otherId);
        })->orWhere(function ($q) use ($authId, $otherId) {
            $q->where('requester_id', $otherId)->where('receiver_id', $authId);
        })->first();
    }

    private function formatUser(User $user, int $authId): array
    {
        if ($user->id === $authId) {
            return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email,
                    'avatar_url' => $user->avatar_url, 'headline' => $user->headline,
                    'friendship_status' => 'self', 'friendship_id' => null];
        }

        $f = $this->getFriendship($authId, $user->id);

        if (!$f) {
            $status = 'none'; $fid = null;
        } elseif ($f->status === 'accepted') {
            $status = 'friends'; $fid = $f->id;
        } elseif ($f->requester_id === $authId) {
            $status = 'request_sent'; $fid = $f->id;
        } else {
            $status = 'request_received'; $fid = $f->id;
        }

        return [
            'id'                => $user->id,
            'name'              => $user->name,
            'email'             => $user->email,
            'avatar_url'        => $user->avatar_url,
            'headline'          => $user->headline ?? null,
            'friendship_status' => $status,
            'friendship_id'     => $fid,
        ];
    }

    // ── GET /api/users/search?q= ───────────────────────────────────
    public function search(Request $request)
    {
        $q    = trim($request->query('q', ''));
        $auth = $request->user();

        if (strlen($q) < 2) {
            return response()->json([]);
        }

        $users = User::where('id', '!=', $auth->id)
            ->where(function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%")
                      ->orWhere('email', 'like', "%{$q}%");
            })
            ->limit(10)
            ->get();

        return response()->json(
            $users->map(fn($u) => $this->formatUser($u, $auth->id))
        );
    }

    // ── GET /api/friends ───────────────────────────────────────────
    public function index(Request $request)
    {
        $auth = $request->user();

        $friendships = Friendship::where('status', 'accepted')
            ->where(function ($q) use ($auth) {
                $q->where('requester_id', $auth->id)
                  ->orWhere('receiver_id', $auth->id);
            })
            ->with(['requester', 'receiver'])
            ->latest()
            ->get();

        return response()->json(
            $friendships->map(function ($f) use ($auth) {
                $friend = $f->requester_id === $auth->id ? $f->receiver : $f->requester;
                return [
                    'friendship_id' => $f->id,
                    'id'            => $friend->id,
                    'name'          => $friend->name,
                    'email'         => $friend->email,
                    'avatar_url'    => $friend->avatar_url,
                    'headline'      => $friend->headline ?? null,
                    'since'         => $f->updated_at,
                ];
            })
        );
    }

    // ── GET /api/friends/requests ──────────────────────────────────
    public function requests(Request $request)
    {
        $auth    = $request->user();
        $pending = Friendship::where('receiver_id', $auth->id)
            ->where('status', 'pending')
            ->with('requester')
            ->latest()
            ->get();

        return response()->json(
            $pending->map(fn($f) => [
                'friendship_id' => $f->id,
                'id'            => $f->requester->id,
                'name'          => $f->requester->name,
                'email'         => $f->requester->email,
                'avatar_url'    => $f->requester->avatar_url,
                'headline'      => $f->requester->headline ?? null,
                'sent_at'       => $f->created_at,
            ])
        );
    }

    // ── GET /api/friends/sent ──────────────────────────────────────
    public function sent(Request $request)
    {
        $auth = $request->user();
        $sent = Friendship::where('requester_id', $auth->id)
            ->where('status', 'pending')
            ->with('receiver')
            ->latest()
            ->get();

        return response()->json(
            $sent->map(fn($f) => [
                'friendship_id' => $f->id,
                'id'            => $f->receiver->id,
                'name'          => $f->receiver->name,
                'email'         => $f->receiver->email,
                'avatar_url'    => $f->receiver->avatar_url,
                'headline'      => $f->receiver->headline ?? null,
                'sent_at'       => $f->created_at,
            ])
        );
    }

    // ── POST /api/friends  { user_id } ────────────────────────────
    public function store(Request $request)
    {
        $request->validate(['user_id' => 'required|integer|exists:users,id']);

        $auth   = $request->user();
        $target = (int) $request->user_id;

        if ($target === $auth->id) {
            return response()->json(['message' => 'You cannot add yourself.'], 422);
        }

        $existing = $this->getFriendship($auth->id, $target);
        if ($existing) {
            $msg = match ($existing->status) {
                'accepted' => 'You are already friends.',
                'pending'  => $existing->requester_id === $auth->id
                    ? 'Friend request already sent.'
                    : 'This person already sent you a request — check your requests.',
                default    => 'A friendship record already exists.',
            };
            return response()->json(['message' => $msg], 422);
        }

        $f        = Friendship::create(['requester_id' => $auth->id, 'receiver_id' => $target, 'status' => 'pending']);
        $receiver = User::find($target);

        // BUG 6 FIX — notify the receiver so the bell shows friend requests too
        try {
            Notification::create([
                'user_id' => $target,
                'type'    => 'friend_request_received',
                'title'   => 'New friend request',
                'message' => "{$auth->name} sent you a friend request.",
                'data'    => [
                    'friendship_id' => $f->id,
                    'actor_id'      => $auth->id,
                    'actor_name'    => $auth->name,
                    'actor_avatar'  => $auth->avatar_url,
                ],
            ]);
        } catch (\Throwable $e) {}

        return response()->json([
            'friendship_id'     => $f->id,
            'id'                => $receiver->id,
            'name'              => $receiver->name,
            'email'             => $receiver->email,
            'avatar_url'        => $receiver->avatar_url,
            'friendship_status' => 'request_sent',
        ], 201);
    }

    // ── POST /api/friends/{id}/accept ─────────────────────────────
    public function accept(Request $request, $id)
    {
        $auth = $request->user();
        $f    = Friendship::findOrFail($id);

        if ($f->receiver_id !== $auth->id) {
            return response()->json(['message' => 'Not authorised.'], 403);
        }
        if ($f->status !== 'pending') {
            return response()->json(['message' => 'Request is not pending.'], 422);
        }

        $f->update(['status' => 'accepted']);

        // BUG 6 FIX — notify the requester that their request was accepted
        try {
            $requester = User::find($f->requester_id);
            Notification::create([
                'user_id' => $f->requester_id,
                'type'    => 'friend_request_accepted',
                'title'   => 'Friend request accepted',
                'message' => "{$auth->name} accepted your friend request.",
                'data'    => [
                    'friendship_id' => $f->id,
                    'actor_id'      => $auth->id,
                    'actor_name'    => $auth->name,
                    'actor_avatar'  => $auth->avatar_url,
                ],
            ]);
        } catch (\Throwable $e) {}

        return response()->json(['message' => 'Friend request accepted!']);
    }

    // ── POST /api/friends/{id}/decline ────────────────────────────
    // Receiver declines OR requester cancels their own request
    public function decline(Request $request, $id)
    {
        $auth = $request->user();
        $f    = Friendship::findOrFail($id);

        if ($f->receiver_id !== $auth->id && $f->requester_id !== $auth->id) {
            return response()->json(['message' => 'Not authorised.'], 403);
        }

        $f->delete();
        return response()->json(['message' => 'Request removed.']);
    }

    // ── DELETE /api/friends/{id} ──────────────────────────────────
    public function destroy(Request $request, $id)
    {
        $auth = $request->user();
        $f    = Friendship::findOrFail($id);

        if ($f->requester_id !== $auth->id && $f->receiver_id !== $auth->id) {
            return response()->json(['message' => 'Not authorised.'], 403);
        }

        $f->delete();
        return response()->json(['message' => 'Unfriended.']);
    }
}
