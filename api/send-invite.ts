import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const { email, name, appUrl } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const displayName = typeof name === 'string' && name.trim() ? name.trim() : email;
  const registerUrl = `${appUrl || 'https://k12net-dashboard.vercel.app'}/register?email=${encodeURIComponent(email)}&name=${encodeURIComponent(displayName)}`;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'K12net Dashboard <onboarding@resend.dev>';

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Invitation — K12net Dashboard',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9f9fd;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;border:1px solid #e6e7ef;overflow:hidden;">
    <div style="padding:32px 32px 0;text-align:center;">
      <div style="display:inline-block;padding:12px;background:#f0f0ff;border-radius:10px;margin-bottom:16px;">
        <span style="font-size:28px;">📚</span>
      </div>
      <h1 style="margin:0 0 8px;font-size:22px;color:#06072d;">K12net Dashboard</h1>
      <p style="margin:0;font-size:14px;color:#8392a5;">Plateforme de gestion scolaire</p>
    </div>
    <div style="padding:24px 32px 32px;">
      <p style="font-size:15px;color:#575d78;line-height:1.6;">
        Bonjour <strong>${displayName}</strong>,
      </p>
      <p style="font-size:15px;color:#575d78;line-height:1.6;">
        Vous avez été invité(e) à rejoindre <strong>K12net Dashboard</strong>. 
        Cliquez sur le bouton ci-dessous pour créer votre compte.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${registerUrl}" 
           style="display:inline-block;padding:12px 32px;background:#5556fd;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          Créer mon compte
        </a>
      </div>
      <p style="font-size:12px;color:#8392a5;line-height:1.5;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
        <a href="${registerUrl}" style="color:#5556fd;word-break:break-all;">${registerUrl}</a>
      </p>
    </div>
    <div style="padding:16px 32px;background:#f9f9fd;border-top:1px solid #e6e7ef;text-align:center;">
      <p style="margin:0;font-size:11px;color:#8392a5;">
        Cet email a été envoyé automatiquement. Si vous n'êtes pas à l'origine de cette invitation, ignorez ce message.
      </p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Send invite error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
