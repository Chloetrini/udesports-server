// EMAIL TEMPLATES — UDESport (table-based for email client support)

// ---- shared brand colors ----
const GREEN = '#22c55e'
const DARK = '#0f172a'

// INVITE EMAIL — sent when a Super Admin invites a new admin
export const inviteEmailTemplate = (
  name: string,
  invitedBy: string,
  inviteUrl: string,
  role: string
): { subject: string; html: string } => ({
  subject: "You've been invited to UDESport Management",
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Admin Invitation</title>
      <style>
        body { margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, sans-serif; }
        .wrapper { width:100%; background-color:#f3f4f6; padding:40px 0; }
        .container { max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; }
        .header { background-color:${DARK}; padding:32px 24px; text-align:center; }
        .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:700; }
        .header p { color:${GREEN}; margin:8px 0 0; font-size:13px; }
        .body { padding:32px 24px; }
        .body h2 { color:${DARK}; margin:0 0 16px; font-size:20px; }
        .body p { color:#444545; font-size:14px; line-height:1.7; margin:0 0 20px; }
        .role-badge { display:inline-block; background:#dcfce7; color:#166534; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:700; }
        .btn-wrap { text-align:center; padding:8px 0 24px; }
        .btn { display:inline-block; background-color:${GREEN}; color:#ffffff; text-decoration:none; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700; }
        .note { color:#75928B; font-size:12px; line-height:1.6; margin:0 0 8px; }
        .link-box { margin-top:20px; padding:14px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb; }
        .link-box p { color:#75928B; font-size:11px; margin:0 0 6px; }
        .link-box a { color:${GREEN}; font-size:11px; word-break:break-all; }
        .footer { background:#f9fafb; padding:20px 24px; text-align:center; border-top:1px solid #e5e7eb; }
        .footer p { color:#75928B; font-size:11px; margin:0; }
        @media only screen and (max-width:600px) {
          .container { width:100% !important; border-radius:0 !important; }
          .body { padding:24px 16px !important; }
          .header { padding:24px 16px !important; }
          .btn { padding:12px 24px !important; font-size:14px !important; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h1>UDESport Management</h1>
            <p>Sports Management Dashboard</p>
          </div>
          <div class="body">
            <h2>You've been invited, ${name}!</h2>
            <p>${invitedBy} has invited you to join the UDESport admin dashboard with the role of <span class="role-badge">${role}</span>.</p>
            <p>Click the button below to set your password and activate your account.</p>
            <div class="btn-wrap">
              <a href="${inviteUrl}" class="btn">Set My Password</a>
            </div>
            <p class="note">This invite link expires in <strong>24 hours</strong>.</p>
            <p class="note">If you weren't expecting this invitation, you can ignore this email.</p>
            <div class="link-box">
              <p>Or copy and paste this link:</p>
              <a href="${inviteUrl}">${inviteUrl}</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} UDESport Management Ltd. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
})

// PASSWORD RESET EMAIL
export const passwordResetEmailTemplate = (
  name: string,
  code: string
): { subject: string; html: string } => ({
  subject: 'Your UDESport Password Reset Code',
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="width:100%;background:#f3f4f6;padding:40px 0;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#0f172a;padding:32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">UDESport Management</h1>
            <p style="color:#22c55e;margin:8px 0 0;font-size:13px;">Sports Management Dashboard</p>
          </div>
          <div style="padding:32px 24px;text-align:center;">
            <h2 style="color:#0f172a;margin:0 0 16px;font-size:20px;">Password Reset Code</h2>
            <p style="color:#444;font-size:14px;line-height:1.7;margin:0 0 24px;">Hi <strong>${name}</strong>, use the code below to reset your password.</p>
            <div style="display:inline-block;background:#dcfce7;color:#166534;font-size:36px;font-weight:700;letter-spacing:12px;padding:16px 28px;border-radius:10px;">${code}</div>
            <p style="color:#75928B;font-size:12px;margin:24px 0 0;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="color:#75928B;font-size:12px;margin:8px 0 0;">If you didn't request this, ignore this email.</p>
          </div>
          <div style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#75928B;font-size:11px;margin:0;">© ${new Date().getFullYear()} UDESport Management Ltd.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
})

// NEWSLETTER NOTIFICATION EMAIL — sent to every subscriber when a News
// article or Quick Update is published.
export const newsletterNotificationTemplate = (
  kind: 'News' | 'Quick Update',
  headline: string,
  category: string,
  url: string,
  unsubscribeUrl: string
): { subject: string; html: string } => ({
  subject: kind === 'News' ? `New on UDESport: ${headline}` : `UDESport Quick Update: ${headline}`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${kind === 'News' ? 'New Article' : 'Quick Update'}</title>
    </head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="width:100%;background:#f3f4f6;padding:40px 0;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:${DARK};padding:32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">UDESport</h1>
            <p style="color:${GREEN};margin:8px 0 0;font-size:13px;">${kind === 'News' ? 'News & Transfers' : 'Quick Update'}</p>
          </div>
          <div style="padding:32px 24px;">
            <span style="display:inline-block;background:#dcfce7;color:#166534;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;margin-bottom:16px;">${category}</span>
            <h2 style="color:${DARK};margin:0 0 16px;font-size:20px;line-height:1.4;">${headline}</h2>
            <p style="color:#444545;font-size:14px;line-height:1.7;margin:0 0 24px;">${
              kind === 'News'
                ? 'A new article just went live on UDESport. Read the full story on our site.'
                : 'A new quick update just went live on UDESport.'
            }</p>
            <div style="text-align:center;padding:8px 0 8px;">
              <a href="${url}" style="display:inline-block;background-color:${GREEN};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">${
                kind === 'News' ? 'Read the Article' : 'View on UDESport'
              }</a>
            </div>
          </div>
          <div style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="color:#75928B;font-size:11px;margin:0 0 8px;">© ${new Date().getFullYear()} UDESport Management Ltd. All rights reserved.</p>
            <p style="color:#75928B;font-size:11px;margin:0;">You're receiving this because you subscribed to UDESport updates. <a href="${unsubscribeUrl}" style="color:#75928B;text-decoration:underline;">Unsubscribe</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
})
