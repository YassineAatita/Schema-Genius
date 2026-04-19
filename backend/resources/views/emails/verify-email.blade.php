<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Schema Genius account</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f1117;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 560px;
      margin: 40px auto;
      background-color: #161b27;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.08);
      overflow: hidden;
    }
    /* Header */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #1a2942 100%);
      padding: 36px 40px 32px;
      text-align: center;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .logo-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .logo-icon {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .logo-name {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .header-icon {
      width: 56px;
      height: 56px;
      background: rgba(59,130,246,0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 26px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.3px;
    }
    .header p {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.5;
    }
    /* Body */
    .body {
      padding: 36px 40px;
    }
    .body p {
      font-size: 15px;
      color: #cbd5e1;
      line-height: 1.65;
      margin-bottom: 24px;
    }
    /* CTA Button */
    .btn-wrap {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 36px;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      letter-spacing: 0.1px;
      box-shadow: 0 4px 20px rgba(37,99,235,0.35);
    }
    .btn:hover { opacity: 0.92; }
    /* Divider */
    .divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 28px 0;
    }
    /* Fallback link */
    .fallback {
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
      word-break: break-all;
    }
    .fallback a {
      color: #3b82f6;
      text-decoration: none;
    }
    /* Footer */
    .footer {
      background-color: #0f1117;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .footer p {
      font-size: 12px;
      color: #475569;
      line-height: 1.6;
    }
    .ignore-note {
      margin-top: 20px;
      padding: 14px 18px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <!-- Header -->
    <div class="header">
      <div class="logo-row">
        <div class="logo-icon">&#9889;</div>
        <span class="logo-name">Schema Genius</span>
      </div>
      <div class="header-icon">&#9993;</div>
      <h1>Verify your email address</h1>
      <p>One quick step before you start designing schemas</p>
    </div>

    <!-- Body -->
    <div class="body">
      <p>
        Thanks for signing up! To activate your account and start building
        beautiful database schemas, please verify your email address by
        clicking the button below.
      </p>

      <div class="btn-wrap">
        <a href="{{ $url }}" class="btn">Verify Email Address</a>
      </div>

      <p style="font-size: 14px; color: #64748b; text-align: center; margin-bottom: 0;">
        This link expires in <strong style="color: #94a3b8;">60 minutes</strong>.
      </p>

      <div class="divider"></div>

      <div class="fallback">
        <strong style="color: #94a3b8;">Button not working?</strong> Copy and paste this link into your browser:<br />
        <a href="{{ $url }}">{{ $url }}</a>
      </div>

      <div class="ignore-note">
        If you did not create a Schema Genius account, you can safely ignore this email.
        No account will be created without verification.
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        You're receiving this because an account was registered with this email address.<br />
        &copy; {{ date('Y') }} Schema Genius &mdash; Visual Database Schema Designer
      </p>
    </div>

  </div>
</body>
</html>
