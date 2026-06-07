import { getFrontendUrl } from './email.js';

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1e3a5f; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 20px; font-weight: 800; margin-bottom: 24px;">SPACE<span style="color: #7eb8d4;">BOOK</span></p>
  ${bodyHtml}
  <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">If you did not request this, you can ignore this email.</p>
</body>
</html>`;
}

export function verificationEmail({ name, verifyLink }) {
  const subject = 'Verify your SpaceBook account';
  const html = layout(
    subject,
    `<h1 style="font-size: 22px; margin-bottom: 12px;">Welcome${name ? `, ${name}` : ''}!</h1>
     <p>Thanks for signing up. Click the button below to verify your email and activate your account.</p>
     <p style="margin: 28px 0;">
       <a href="${verifyLink}" style="display: inline-block; background: #1e3a5f; color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700;">Verify email</a>
     </p>
     <p style="font-size: 13px; color: #64748b;">Or copy this link: ${verifyLink}</p>
     <p style="font-size: 13px; color: #64748b;">This link expires in 24 hours.</p>`
  );
  const text = `Verify your SpaceBook account: ${verifyLink}`;
  return { subject, html, text };
}

export function passwordResetEmail({ resetLink }) {
  const subject = 'Reset your SpaceBook password';
  const html = layout(
    subject,
    `<h1 style="font-size: 22px; margin-bottom: 12px;">Reset your password</h1>
     <p>We received a request to reset your password. Click below to choose a new one.</p>
     <p style="margin: 28px 0;">
       <a href="${resetLink}" style="display: inline-block; background: #1e3a5f; color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700;">Reset password</a>
     </p>
     <p style="font-size: 13px; color: #64748b;">Or copy this link: ${resetLink}</p>
     <p style="font-size: 13px; color: #64748b;">This link expires in 1 hour.</p>`
  );
  const text = `Reset your password: ${resetLink}`;
  return { subject, html, text };
}

export function newsletterWelcomeEmail() {
  const baseUrl = getFrontendUrl();
  const subject = 'Thanks for subscribing to SpaceBook';
  const html = layout(
    subject,
    `<h1 style="font-size: 22px; margin-bottom: 12px;">You're on the list!</h1>
     <p>Thanks for subscribing. We'll keep you posted about new unique spaces and exclusive offers.</p>
     <p style="margin: 28px 0;">
       <a href="${baseUrl}/find" style="display: inline-block; background: #1e3a5f; color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700;">Explore spaces</a>
     </p>`
  );
  const text = `Thanks for subscribing to SpaceBook updates. Explore spaces at ${baseUrl}/find`;
  return { subject, html, text };
}
