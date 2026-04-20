<?php

namespace App\Services;

use App\Mail\NotificationMail;
use App\Models\User;
use App\Models\UserNotificationPreference;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Single entry-point for every preference-gated notification email.
 *
 * Usage (inside a controller try/catch block):
 *   NotificationMailer::send($recipientUserId, 'project_starred', [
 *       'actor_name'   => $user->name,
 *       'project_name' => $project->name,
 *       'project_id'   => $project->id,
 *   ]);
 *
 * The method is fully silent — it catches all exceptions and only logs
 * a warning, so a mail failure can NEVER break the primary HTTP action.
 */
class NotificationMailer
{
    /**
     * Maps each notification type to the boolean column in
     * the user_notification_preferences table.
     */
    private static array $prefMap = [
        'project_starred'          => 'starred_schema',
        'project_liked'            => 'liked_schema',
        'project_forked'           => 'forked_schema',
        'new_comment'              => 'commented_schema',
        'friend_request_received'  => 'friend_request_received',
        'friend_request_accepted'  => 'friend_request_accepted',
        'collaboration_invited'    => 'collaboration_invited',
        'schema_of_the_week'       => 'schema_of_the_week',
    ];

    /**
     * Check the recipient's email preference, then dispatch the branded email.
     *
     * @param  int    $recipientId  user_id of the person who receives the email
     * @param  string $type         one of the keys in $prefMap above
     * @param  array  $data         contextual data for the email template
     */
    public static function send(int $recipientId, string $type, array $data = []): void
    {
        try {
            // Unknown type — nothing to send
            $prefKey = self::$prefMap[$type] ?? null;
            if (!$prefKey) return;

            // Preference row may not exist yet (user never opened the settings tab).
            // Default is opted-out, so treat missing row as disabled.
            $prefs = UserNotificationPreference::where('user_id', $recipientId)->first();
            if (!$prefs || !$prefs->$prefKey) return;

            $recipient = User::find($recipientId);
            if (!$recipient || !$recipient->email) return;

            Mail::to($recipient->email)
                ->send(new NotificationMail($type, $data, $recipient));

        } catch (\Throwable $e) {
            Log::warning(
                "NotificationMailer: failed to send '{$type}' email to user {$recipientId}: "
                . $e->getMessage()
            );
        }
    }
}
