<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // GET /api/notifications
    public function index(Request $request)
    {
        $notifications = Notification::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn($n) => [
                'id'         => $n->id,
                'type'       => $n->type,
                'title'      => $n->title,
                'message'    => $n->message,
                'data'       => $n->data,
                'read'       => !is_null($n->read_at),
                'created_at' => $n->created_at,
            ]);

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => Notification::where('user_id', $request->user()->id)->unread()->count(),
        ]);
    }

    // POST /api/notifications/{id}/read
    public function markRead(Request $request, $id)
    {
        $notification = Notification::where('user_id', $request->user()->id)->findOrFail($id);
        $notification->update(['read_at' => now()]);
        return response()->json(['message' => 'Marked as read.']);
    }

    // POST /api/notifications/read-all
    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return response()->json(['message' => 'All marked as read.']);
    }

    // DELETE /api/notifications/clear
    public function clear(Request $request)
    {
        Notification::where('user_id', $request->user()->id)->delete();
        return response()->json(['message' => 'Notifications cleared.']);
    }
}
