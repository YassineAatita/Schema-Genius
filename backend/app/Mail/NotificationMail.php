<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Generic notification Mailable.
 *
 * Accepts a notification type + data array and computes all view variables
 * (accent colour, headline, body text, CTA) in the constructor so the Blade
 * template stays logic-free.
 */
class NotificationMail extends Mailable
{
    // ── Computed view variables (public so Blade can access them) ──────────────
    public string $accentColor;
    public string $heroLabel;
    public string $headline;
    public string $bodyText;   // may contain safe HTML (<strong>, &ldquo; etc.)
    public string $ctaText;
    public string $ctaUrl;
    public string $preferencesUrl;

    public function __construct(
        public readonly string $notifType,
        public readonly array  $notifData,
        public readonly object $recipient,
    ) {
        $this->computeContent();
    }

    public function envelope(): Envelope
    {
        $subjects = [
            'project_starred'          => 'Someone starred your schema',
            'project_liked'            => 'Someone liked your schema',
            'project_forked'           => 'Someone forked your schema',
            'new_comment'              => 'New comment on your schema',
            'friend_request_received'  => 'You have a new friend request',
            'friend_request_accepted'  => 'Your friend request was accepted',
            'collaboration_invited'    => 'You have been invited to collaborate',
            'schema_of_the_week'       => 'Your schema is Schema of the Week!',
        ];

        return new Envelope(
            subject: $subjects[$this->notifType] ?? 'New notification from Schema Genius',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.notification');
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function computeContent(): void
    {
        $frontend   = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
        $actor      = e($this->notifData['actor_name']   ?? 'Someone');
        $project    = e($this->notifData['project_name'] ?? 'your schema');
        $pid        = $this->notifData['project_id']     ?? null;
        $role       = e($this->notifData['role']         ?? 'collaborator');

        $projectUrl  = $pid ? "{$frontend}/explore/projects/{$pid}" : "{$frontend}/dashboard";
        $dashboardUrl = "{$frontend}/dashboard";

        $this->preferencesUrl = "{$frontend}/dashboard";

        switch ($this->notifType) {

            case 'project_starred':
                $this->accentColor = '#f59e0b';
                $this->heroLabel   = 'New Star';
                $this->headline    = "{$actor} starred your schema";
                $this->bodyText    = "<strong>{$actor}</strong> starred your schema <strong>&ldquo;{$project}&rdquo;</strong>. Your work is getting noticed!";
                $this->ctaText     = 'View Schema';
                $this->ctaUrl      = $projectUrl;
                break;

            case 'project_liked':
                $this->accentColor = '#ec4899';
                $this->heroLabel   = 'New Like';
                $this->headline    = "{$actor} liked your schema";
                $this->bodyText    = "<strong>{$actor}</strong> liked your schema <strong>&ldquo;{$project}&rdquo;</strong>.";
                $this->ctaText     = 'View Schema';
                $this->ctaUrl      = $projectUrl;
                break;

            case 'project_forked':
                $this->accentColor = '#8b5cf6';
                $this->heroLabel   = 'New Fork';
                $this->headline    = "{$actor} forked your schema";
                $this->bodyText    = "<strong>{$actor}</strong> forked your schema <strong>&ldquo;{$project}&rdquo;</strong> into their workspace.";
                $this->ctaText     = 'View Schema';
                $this->ctaUrl      = $projectUrl;
                break;

            case 'new_comment':
                $this->accentColor = '#3b82f6';
                $this->heroLabel   = 'New Comment';
                $this->headline    = "{$actor} commented on your schema";
                $this->bodyText    = "<strong>{$actor}</strong> left a comment on your schema <strong>&ldquo;{$project}&rdquo;</strong>.";
                $this->ctaText     = 'Read Comment';
                $this->ctaUrl      = $projectUrl;
                break;

            case 'friend_request_received':
                $this->accentColor = '#10b981';
                $this->heroLabel   = 'Friend Request';
                $this->headline    = "{$actor} sent you a friend request";
                $this->bodyText    = "<strong>{$actor}</strong> wants to connect with you on Schema Genius. Accept their request to collaborate and share schemas.";
                $this->ctaText     = 'View Request';
                $this->ctaUrl      = $dashboardUrl;
                break;

            case 'friend_request_accepted':
                $this->accentColor = '#10b981';
                $this->heroLabel   = 'New Connection';
                $this->headline    = "{$actor} accepted your friend request";
                $this->bodyText    = "You and <strong>{$actor}</strong> are now connected on Schema Genius. You can now invite each other to collaborate on projects.";
                $this->ctaText     = 'View Friends';
                $this->ctaUrl      = $dashboardUrl;
                break;

            case 'collaboration_invited':
                $this->accentColor = '#6366f1';
                $this->heroLabel   = 'Collaboration Invite';
                $this->headline    = 'You have been invited to collaborate';
                $this->bodyText    = "<strong>{$actor}</strong> has invited you to collaborate on the schema project <strong>&ldquo;{$project}&rdquo;</strong> as a <strong>{$role}</strong>.";
                $this->ctaText     = 'View Invitation';
                $this->ctaUrl      = $dashboardUrl;
                break;

            case 'schema_of_the_week':
                $this->accentColor = '#f59e0b';
                $this->heroLabel   = 'Schema of the Week';
                $this->headline    = 'Your schema has been featured!';
                $this->bodyText    = "Congratulations! Your schema <strong>&ldquo;{$project}&rdquo;</strong> has been selected as the Schema of the Week by our team. It is now featured on the Explore page for the entire Schema Genius community to discover.";
                $this->ctaText     = 'View Featured Schema';
                $this->ctaUrl      = $projectUrl;
                break;

            default:
                $this->accentColor = '#1d4ed8';
                $this->heroLabel   = 'Notification';
                $this->headline    = 'You have a new notification';
                $this->bodyText    = 'You have received a new notification on Schema Genius.';
                $this->ctaText     = 'Open App';
                $this->ctaUrl      = $dashboardUrl;
        }
    }
}
