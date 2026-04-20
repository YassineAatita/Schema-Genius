<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your Schema Genius password</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 560px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    /* ── Brand bar ── */
    .brand-bar {
      background-color: #1a1f2e;
      padding: 18px 40px;
    }
    .brand-bar a {
      text-decoration: none;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.2px;
    }
    /* ── Hero ── */
    .hero {
      padding: 40px 40px 32px;
      border-bottom: 1px solid #f1f5f9;
    }
    .hero-label {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .hero h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.4px;
      line-height: 1.25;
      margin-bottom: 12px;
    }
    .hero p {
      font-size: 15px;
      color: #475569;
      line-height: 1.6;
    }
    /* ── Body ── */
    .body {
      padding: 32px 40px;
    }
    .body p {
      font-size: 15px;
      color: #334155;
      line-height: 1.65;
      margin-bottom: 28px;
    }
    /* ── CTA Button ── */
    .btn-wrap {
      margin: 0 0 28px;
    }
    .btn {
      display: inline-block;
      padding: 13px 28px;
      background-color: #1d4ed8;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      letter-spacing: 0.1px;
    }
    /* ── Expiry note ── */
    .expiry-note {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 0;
    }
    /* ── Divider ── */
    .divider {
      height: 1px;
      background-color: #f1f5f9;
      margin: 28px 0;
    }
    /* ── Fallback ── */
    .fallback {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
      word-break: break-all;
    }
    .fallback strong {
      color: #64748b;
    }
    .fallback a {
      color: #1d4ed8;
      text-decoration: underline;
    }
    /* ── Ignore note ── */
    .ignore-note {
      margin-top: 20px;
      padding: 14px 16px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    /* ── Footer ── */
    .footer {
      background-color: #f8fafc;
      padding: 20px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Brand bar -->
    <div class="brand-bar">
      <span class="brand-name">Schema Genius</span>
    </div>

    <!-- Hero -->
    <div class="hero">
      <span class="hero-label">Password Reset</span>
      <h1>Reset your password</h1>
      <p>We received a request to reset the password for your account.</p>
    </div>

    <!-- Body -->
    <div class="body">
      <p>
        Click the button below to choose a new password. This link is valid for
        <strong>60 minutes</strong>. If you did not request a password reset,
        you can safely ignore this email — your password will not be changed.
      </p>

      <div class="btn-wrap">
        <a href="{{ $url }}" class="btn">Reset Password</a>
      </div>

      <p class="expiry-note">
        This link expires in 60 minutes. After that you will need to request a new one.
      </p>

      <div class="divider"></div>

      <div class="fallback">
        <strong>Button not working?</strong> Copy and paste the link below into your browser:<br /><br />
        <a href="{{ $url }}">{{ $url }}</a>
      </div>

      <div class="ignore-note">
        If you did not request a password reset, no action is required. Your account and
        password remain unchanged.
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        You received this email because a password reset was requested for your account.<br />
        &copy; {{ date('Y') }} Schema Genius &mdash; Visual Database Schema Designer
      </p>
    </div>

  </div>
</body>
</html>
