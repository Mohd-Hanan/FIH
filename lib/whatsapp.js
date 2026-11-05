import crypto from 'crypto';

/**
 * Verify Meta webhook signature.
 */
export function isValidSignature(rawBody, signatureHeader) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn('WHATSAPP_APP_SECRET not configured — skipping signature check for setup.');
    return true;
  }
  if (!signatureHeader) return false;
  try {
    const expected =
      'sha256=' +
      crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

/**
 * Send a WhatsApp text message to a recipient.
 * @param {string} to  – E.164 phone number, e.g. '+919800000000'
 * @param {string} text – message body
 */
export async function sendWhatsAppMessage(to, text) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in env vars');
    return;
  }

  const cleanTo = (to || '').replace(/\D/g, '');

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: cleanTo,
    type: 'text',
    text: { body: text },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const resText = await res.text();
    if (!res.ok) {
      console.error('[WhatsApp Send Error]', res.status, resText);
    } else {
      console.log('[WhatsApp Send Success]', resText);
    }
    return res;
  } catch (err) {
    console.error('Fetch error sending WhatsApp message:', err);
    return null;
  }
}

/**
 * Send a WhatsApp interactive list message.
 */
export async function sendWhatsAppInteractiveList(to, bodyText, buttonText, sections, headerText = null) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in env vars');
    return;
  }

  const cleanTo = (to || '').replace(/\D/g, '');
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const interactive = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonText,
      sections: sections
    }
  };

  if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }

  const body = {
    messaging_product: 'whatsapp',
    to: cleanTo,
    type: 'interactive',
    interactive: interactive
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const resText = await res.text();
    if (!res.ok) {
      console.error('Failed to send WhatsApp interactive list:', resText);
    }
    try {
      return JSON.parse(resText);
    } catch {
      return null;
    }
  } catch (err) {
    console.error('Fetch error sending interactive list:', err);
    return null;
  }
}
