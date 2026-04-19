<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

class VerifyEmailNotification extends VerifyEmail
{
    /**
     * Override the default mail message to use our branded Blade template.
     * $url is the signed verification URL pointing to GET /api/auth/email/verify/{id}/{hash}
     */
    protected function buildMailMessage($url)
    {
        return (new MailMessage)
            ->subject('Verify your Schema Genius account')
            ->view('emails.verify-email', ['url' => $url]);
    }
}
