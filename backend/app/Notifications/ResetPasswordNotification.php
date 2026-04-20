<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword as BaseResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends BaseResetPassword
{
    /**
     * Override the default mail message to use our branded Blade template.
     * $url is already customised to point at the frontend /reset-password page
     * (set via ResetPassword::createUrlUsing() in AuthController::forgotPassword).
     */
    protected function buildMailMessage($url)
    {
        return (new MailMessage)
            ->subject('Reset your Schema Genius password')
            ->view('emails.reset-password', ['url' => $url]);
    }
}
