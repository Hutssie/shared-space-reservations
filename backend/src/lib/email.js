import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io';
  const port = Number(process.env.MAILTRAP_PORT || 2525);
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS);
}

export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'SpaceBook <noreply@spacebook.local>';
  const transport = getTransporter();

  if (!transport) {
    console.warn('[Email] Mailtrap not configured — logging email instead of sending.');
    console.log('[Email]', { to, subject, text: text || html?.replace(/<[^>]+>/g, ' ').slice(0, 200) });
    return { logged: true };
  }

  const info = await transport.sendMail({ from, to, subject, html, text });
  console.log('[Email] Sent to Mailtrap:', to, info.messageId);
  return info;
}

export function getFrontendUrl() {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
}
