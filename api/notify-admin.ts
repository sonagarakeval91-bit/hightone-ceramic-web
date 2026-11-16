import nodemailer from 'nodemailer';

declare const process: { env: Record<string, string | undefined> };

type NotifyEventType = 'new_order' | 'edited_order' | 'inquiry' | 'quote' | 'dealer_kyc' | 'test';

interface NotifyRequestBody {
  eventType?: NotifyEventType;
  referenceId?: string;
  firmName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  location?: string;
  summaryPrimary?: string;
  summarySecondary?: string;
  notes?: string;
  source?: string;
  submittedAt?: string;
}

const VALID_EVENTS = new Set<NotifyEventType>([
  'new_order',
  'edited_order',
  'inquiry',
  'quote',
  'dealer_kyc',
  'test'
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(val: unknown, maxLen = 300): string {
  if (typeof val !== 'string') {
    if (typeof val === 'number') return String(val).slice(0, maxLen);
    return '';
  }
  return val.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function cleanMultilineText(val: unknown, maxLen = 1000): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function maskEmail(email: string): string {
  const list = email
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length === 0) return '***';
  return list
    .map((addr) => {
      const parts = addr.split('@');
      if (parts.length !== 2) return '***';
      const [local, domain] = parts;
      const prefix = local.slice(0, Math.min(3, local.length));
      return `${prefix}***@${domain}`;
    })
    .join(', ');
}

function sanitizeWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function isOriginAllowed(req: any): boolean {
  const originHeader = String(req?.headers?.origin || req?.headers?.referer || '').toLowerCase();
  if (!originHeader) return true;
  if (
    originHeader.includes('hightoneceramic.com') ||
    originHeader.includes('vercel.app') ||
    originHeader.includes('localhost') ||
    originHeader.includes('127.0.0.1') ||
    originHeader.includes('.run.app')
  ) {
    return true;
  }
  const appUrl = (process.env.APP_URL || '').toLowerCase();
  if (appUrl && originHeader.startsWith(appUrl)) return true;
  return false;
}

function getEventMeta(eventType: NotifyEventType) {
  switch (eventType) {
    case 'new_order':
      return {
        badge: 'NEW DEALER ORDER',
        subjectPrefix: 'New Dealer Order',
        accent: '#0F2E52',
        adminSectionLabel: 'Open Dealer Orders'
      };
    case 'edited_order':
      return {
        badge: 'DEALER ORDER EDITED',
        subjectPrefix: 'Order Edited',
        accent: '#B45309',
        adminSectionLabel: 'Review Updated Order'
      };
    case 'quote':
      return {
        badge: 'FACTORY QUOTE REQUEST',
        subjectPrefix: 'Quote Request',
        accent: '#0F2E52',
        adminSectionLabel: 'View Quote Inquiry'
      };
    case 'dealer_kyc':
      return {
        badge: 'NEW DEALER KYC APPLICATION',
        subjectPrefix: 'Dealer KYC Application',
        accent: '#047857',
        adminSectionLabel: 'Verify Dealer KYC'
      };
    case 'test':
      return {
        badge: 'TEST NOTIFICATION',
        subjectPrefix: 'Test Admin Alert',
        accent: '#1D4ED8',
        adminSectionLabel: 'Open Admin Panel'
      };
    case 'inquiry':
    default:
      return {
        badge: 'WHOLESALE INQUIRY',
        subjectPrefix: 'Wholesale Inquiry',
        accent: '#0F2E52',
        adminSectionLabel: 'View Wholesale Inquiry'
      };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const resendFrom = (process.env.RESEND_FROM || 'Hightone Ceramic Desk <onboarding@resend.dev>').trim();
  const recipient = (process.env.ADMIN_NOTIFY_EMAIL || smtpUser || 'hightoneceramic@gmail.com').trim();

  const hasSmtp = Boolean(smtpUser && smtpPass && recipient);
  const hasResend = Boolean(resendApiKey && recipient);
  const provider: 'smtp' | 'resend' | 'none' = hasSmtp ? 'smtp' : hasResend ? 'resend' : 'none';
  const isConfigured = provider !== 'none';

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: isConfigured,
      provider,
      hasResend,
      hasSmtp,
      hasUser: Boolean(smtpUser),
      hasPass: Boolean(smtpPass),
      recipientHint: isConfigured ? maskEmail(recipient) : undefined
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isOriginAllowed(req)) {
    return res.status(403).json({ ok: false, error: 'Origin not permitted' });
  }

  const rawBody: NotifyRequestBody =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};

  const eventType: NotifyEventType = VALID_EVENTS.has(rawBody.eventType as NotifyEventType)
    ? (rawBody.eventType as NotifyEventType)
    : 'inquiry';

  const referenceId = cleanText(rawBody.referenceId, 64) || `HTC-${Date.now().toString().slice(-6)}`;
  const firmName = cleanText(rawBody.firmName, 160) || 'Hightone Visitor';
  const contactPerson = cleanText(rawBody.contactPerson, 120);
  const phone = cleanText(rawBody.phone, 40);
  const email = cleanText(rawBody.email, 160);
  const location = cleanText(rawBody.location, 200);
  const summaryPrimary = cleanText(rawBody.summaryPrimary, 300);
  const summarySecondary = cleanText(rawBody.summarySecondary, 300);
  const notes = cleanMultilineText(rawBody.notes, 1000);
  const source = cleanText(rawBody.source, 120);
  const submittedAt =
    cleanText(rawBody.submittedAt, 80) ||
    new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

  if (!isConfigured) {
    return res.status(200).json({
      ok: false,
      configured: false,
      provider: 'none',
      message: 'Gmail SMTP credentials (SMTP_USER and SMTP_PASS) are not configured on Vercel yet.'
    });
  }

  const meta = getEventMeta(eventType);
  const subjectSuffix = summaryPrimary ? ` (${summaryPrimary})` : '';
  const subject = `[Hightone ${meta.subjectPrefix}] ${referenceId} — ${firmName}${subjectSuffix}`.slice(0, 220);

  const waDigits = phone ? sanitizeWhatsAppDigits(phone) : '';
  const waHref = waDigits.length >= 10 ? `https://wa.me/${waDigits}` : '';
  const adminUrl = 'https://hightoneceramic.com/admin';

  const detailRows: Array<[string, string]> = [
    ['Reference ID', referenceId],
    ['Firm / Showroom', firmName],
    ...(contactPerson ? [['Contact Person', contactPerson] as [string, string]] : []),
    ...(phone ? [['Phone / WhatsApp', phone] as [string, string]] : []),
    ...(email ? [['Email', email] as [string, string]] : []),
    ...(location ? [['Location', location] as [string, string]] : []),
    ...(summaryPrimary ? [['Details', summaryPrimary] as [string, string]] : []),
    ...(summarySecondary ? [['Summary', summarySecondary] as [string, string]] : []),
    ...(source ? [['Source', source] as [string, string]] : []),
    ['Submitted At', submittedAt]
  ];

  const htmlRows = detailRows
    .map(
      ([label, val]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:600;width:160px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:500;">${escapeHtml(val)}</td>
        </tr>`
    )
    .join('');

  const htmlNotes = notes
    ? `<div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
         <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Notes / Message</div>
         <div style="font-size:13px;color:#1e293b;white-space:pre-wrap;line-height:1.5;">${escapeHtml(notes)}</div>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="padding:18px 24px;background:${meta.accent};color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;opacity:0.85;">${escapeHtml(meta.badge)}</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(firmName)}</div>
    </div>
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;">${htmlRows}</table>
      ${htmlNotes}
      <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${adminUrl}" style="display:inline-block;padding:10px 18px;background:#0F2E52;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">${escapeHtml(meta.adminSectionLabel)}</a>
        ${
          waHref
            ? `<a href="${waHref}" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;margin-left:8px;">Message on WhatsApp</a>`
            : ''
        }
      </div>
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
      Hightone Ceramic Factory Desk · Automatic Admin Notification
    </div>
  </div>
</body>
</html>`;

  const text = [
    `${meta.badge}`,
    ...detailRows.map(([k, v]) => `${k}: ${v}`),
    ...(notes ? [`Notes: ${notes}`] : []),
    '',
    `Admin Panel: ${adminUrl}`,
    ...(waHref ? [`WhatsApp: ${waHref}`] : [])
  ].join('\n');

  try {
    if (provider === 'resend') {
      const resendPayload: Record<string, unknown> = {
        from: resendFrom,
        to: [recipient],
        subject,
        html,
        text
      };
      if (email && email.includes('@')) {
        resendPayload.reply_to = email;
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resendPayload)
      });

      const resendData = await resendRes.json().catch(() => ({}));
      if (!resendRes.ok) {
        const resendErr =
          typeof resendData?.message === 'string'
            ? resendData.message
            : `Resend API returned HTTP ${resendRes.status}`;
        console.error('Resend notification error:', resendErr);
        return res.status(200).json({
          ok: false,
          configured: true,
          provider: 'resend',
          message: `Resend delivery error: ${resendErr}`
        });
      }

      return res.status(200).json({
        ok: true,
        configured: true,
        provider: 'resend',
        message: `Email notification delivered via Resend to ${maskEmail(recipient)}.`
      });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    await transporter.sendMail({
      from: `"Hightone Ceramic Desk" <${smtpUser}>`,
      to: recipient,
      ...(email && email.includes('@') ? { replyTo: email } : {}),
      subject,
      text,
      html
    });

    return res.status(200).json({
      ok: true,
      configured: true,
      provider: 'smtp',
      message: `Email notification delivered to ${maskEmail(recipient)}.`
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Email delivery failed';
    console.error('Admin email notification error:', errMsg);
    return res.status(200).json({
      ok: false,
      configured: true,
      provider,
      message: `Email error (${provider}): ${errMsg}`
    });
  }
}
