<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{ $headline }}</title>
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
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.2px;
    }
    /* ── Accent strip (type-specific colour) ── */
    .accent-strip {
      height: 4px;
      background-color: {{ $accentColor }};
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
      color: {{ $accentColor }};
      margin-bottom: 12px;
    }
    .hero h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
      line-height: 1.3;
    }
    /* ── Body ── */
    .body {
      padding: 32px 40px;
    }
    .body p {
      font-size: 15px;
      color: #334155;
      line-height: 1.7;
      margin-bottom: 28px;
    }
    /* ── CTA Button ── */
    .btn-wrap {
      margin: 0 0 32px;
    }
    .btn {
      display: inline-block;
      padding: 13px 28px;
      background-color: {{ $accentColor }};
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      letter-spacing: 0.1px;
    }
    /* ── Divider ── */
    .divider {
      height: 1px;
      background-color: #f1f5f9;
      margin: 0 0 28px;
    }
    /* ── Footer ── */
    .footer {
      background-color: #f8fafc;
      padding: 20px 40px;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.7;
      text-align: center;
    }
    .footer a {
      color: #64748b;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Brand bar -->
    <div class="brand-bar">
      <span class="brand-name">Schema Genius</span>
    </div>

    <!-- Accent strip -->
    <div class="accent-strip"></div>

    <!-- Hero -->
    <div class="hero">
      <span class="hero-label">{{ $heroLabel }}</span>
      <h1>{{ $headline }}</h1>
    </div>

    <!-- Body -->
    <div class="body">

      <p>Hi {{ $recipient->name }},</p>

      <p>{!! $bodyText !!}</p>

      <div class="btn-wrap">
        <a href="{{ $ctaUrl }}" class="btn">{{ $ctaText }}</a>
      </div>

      <div class="divider"></div>

      <p style="font-size:13px; color:#94a3b8; margin-bottom:0;">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="{{ $ctaUrl }}" style="color:#64748b; word-break:break-all;">{{ $ctaUrl }}</a>
      </p>

    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        You received this email because you have this notification type enabled in your preferences.<br />
        <a href="{{ $preferencesUrl }}">Update your email preferences</a> in your profile settings.<br /><br />
        &copy; {{ date('Y') }} Schema Genius &mdash; Visual Database Schema Designer
      </p>
    </div>

  </div>
</body>
</html>
