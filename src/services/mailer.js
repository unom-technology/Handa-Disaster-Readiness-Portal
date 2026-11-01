'use strict';

// API #6 - Email delivery via Nodemailer (SMTP).
// If no SMTP credentials are configured, we auto-create a free Ethereal test
// inbox so email "just works" during development/demos. Ethereal captures the
// message and returns a preview URL (logged + saved) instead of really sending.

const nodemailer = require('nodemailer');
const config = require('../config');

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (config.mail.host && config.mail.user) {
      // Real SMTP (e.g. Gmail App Password, SendGrid SMTP, Mailgun SMTP).
      return {
        transporter: nodemailer.createTransport({
          host: config.mail.host,
          port: config.mail.port,
          secure: config.mail.port === 465,
          auth: { user: config.mail.user, pass: config.mail.pass },
        }),
        mode: 'smtp',
      };
    }

    // Fallback: free Ethereal test account (no signup, no key).
    const testAccount = await nodemailer.createTestAccount();
    console.log(
      `[mail] Using Ethereal test inbox. Login at https://ethereal.email ` +
        `(user: ${testAccount.user})`
    );
    return {
      transporter: nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      }),
      mode: 'ethereal',
    };
  })();

  return transporterPromise;
}

// Send one email. Returns { previewUrl } when using Ethereal.
async function sendMail({ to, subject, text, html }) {
  const { transporter, mode } = await getTransporter();
  const info = await transporter.sendMail({
    from: config.mail.from,
    to,
    subject,
    text,
    html: html || `<p>${(text || '').replace(/\n/g, '<br>')}</p>`,
  });
  const previewUrl = mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) console.log(`[mail] Preview: ${previewUrl}`);
  return { messageId: info.messageId, previewUrl, mode };
}

// Broadcast an alert to many recipients. Recipients go in BCC so they don't see
// each other's addresses; the whole thing is one SMTP message.
async function broadcast({ recipients, subject, text }) {
  if (!recipients.length) return { recipientsCount: 0, previewUrl: null };
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
      <h2 style="color:#b91c1c;margin:0 0 8px">🚨 ${subject}</h2>
      <p style="white-space:pre-line;font-size:15px;line-height:1.5">${text}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
      <p style="color:#6b7280;font-size:12px">
        Sent by Handa - Community Disaster Readiness Portal. Stay safe.
      </p>
    </div>`;

  const { transporter, mode } = await getTransporter();
  const info = await transporter.sendMail({
    from: config.mail.from,
    to: config.mail.from, // sender in To:, real recipients hidden in BCC
    bcc: recipients,
    subject: `[Handa Alert] ${subject}`,
    text,
    html,
  });
  const previewUrl = mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) console.log(`[mail] Broadcast preview: ${previewUrl}`);
  return { recipientsCount: recipients.length, previewUrl };
}

module.exports = { sendMail, broadcast };
