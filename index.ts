// InfraMint — Email Notification Edge Function
// Uses Resend (free tier: 3,000 emails/month)
// Deploy: supabase functions deploy send-notification
// Set secret: supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "InfraMint <hello@inframint.io>";
const SITE_URL = "https://inframint.io";

// Minimal InfraMint email template
function emailTemplate(title: string, body: string, ctaText?: string, ctaUrl?: string): string {
  const ctaBlock = ctaText && ctaUrl
    ? `<div style="margin:2rem 0"><a href="${ctaUrl}" style="display:inline-block;padding:.875rem 2rem;background:#000;color:#fff;text-decoration:none;font-weight:600;font-size:.875rem;font-family:'Manrope',Helvetica,Arial,sans-serif">${ctaText}</a></div>`
    : '';
  
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background:#f7f7f7;font-family:'Manrope',Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:2rem">
  <!-- Logo -->
  <div style="margin-bottom:2rem">
    <span style="display:inline-block;width:3px;height:20px;background:#000;vertical-align:middle;margin-right:10px"></span>
    <span style="font-size:1.125rem;font-weight:600;color:#000;vertical-align:middle">Infra</span><span style="font-size:1.125rem;font-weight:200;color:#a3a3a3;vertical-align:middle">Mint</span>
  </div>
  <!-- Content -->
  <div style="background:#fff;padding:2rem;border:1px solid #e5e5e5">
    <h1 style="font-size:1.25rem;font-weight:600;margin:0 0 1rem;color:#000">${title}</h1>
    <div style="font-size:.9375rem;color:#525252;line-height:1.8;font-weight:300">${body}</div>
    ${ctaBlock}
  </div>
  <!-- Footer -->
  <div style="margin-top:1.5rem;font-size:.75rem;color:#a3a3a3;text-align:center">
    <a href="${SITE_URL}" style="color:#737373;text-decoration:none">inframint.io</a> · Art Marketplace for Emerging Artists
    <br>© 2026 InfraMint. All rights reserved.
  </div>
</div></body></html>`;
}

// Build email content based on event type
function buildEmail(event: string, data: Record<string, unknown>): { to: string; subject: string; html: string } | null {
  const orderNum = (data.order_number as string) || '';
  const artTitle = (data.artwork_title as string) || 'Artwork';
  const artistName = (data.artist_name as string) || 'Artist';
  const collectorName = (data.collector_name as string) || 'Collector';
  const artistEmail = data.artist_email as string;
  const collectorEmail = data.collector_email as string;
  const shippingCost = Number(data.shipping_cost || 0);
  const customsCost = Number(data.customs_cost || 0);
  const artPrice = Number(data.artwork_price || 0);
  const totalAmount = artPrice + shippingCost + customsCost;
  const trackingNumber = (data.tracking_number as string) || '';

  switch (event) {
    case 'order_placed':
      return {
        to: artistEmail,
        subject: `New Order: ${artTitle} — ${orderNum}`,
        html: emailTemplate(
          'You have a new order!',
          `<strong>${collectorName}</strong> just ordered <strong>${artTitle}</strong> for <strong>$${artPrice.toLocaleString()}</strong>.<br><br>` +
          `<strong>What to do next:</strong><br>` +
          `Go to your nearest post office with the artwork dimensions and weight. Get a real shipping quote to the buyer's address, then submit it in your dashboard.<br><br>` +
          `<strong>Shipping address:</strong><br>${(data.shipping_address as string || '').replace(/\n/g, '<br>')}`,
          'Go to My Orders →',
          `${SITE_URL}/artist-dashboard.html`
        ),
      };

    case 'quote_ready':
      return {
        to: collectorEmail,
        subject: `Shipping Quote Ready — ${artTitle}`,
        html: emailTemplate(
          'Your shipping quote is ready',
          `Great news! The artist has provided a shipping quote for <strong>${artTitle}</strong>.<br><br>` +
          `<strong>Artwork:</strong> $${artPrice.toLocaleString()}<br>` +
          `<strong>Shipping:</strong> $${shippingCost.toLocaleString()}<br>` +
          (customsCost > 0 ? `<strong>Customs/duties:</strong> $${customsCost.toLocaleString()}<br>` : '') +
          `<strong>Total:</strong> $${totalAmount.toLocaleString()}<br><br>` +
          `Review and approve the quote to proceed with payment.`,
          'Approve & Pay →',
          `${SITE_URL}/collector-dashboard.html`
        ),
      };

    case 'payment_confirmed':
      return {
        to: artistEmail,
        subject: `Payment Received — Ship ${artTitle} Now`,
        html: emailTemplate(
          'Payment confirmed — time to ship!',
          `<strong>${collectorName}</strong> has approved the shipping quote and paid <strong>$${totalAmount.toLocaleString()}</strong> for <strong>${artTitle}</strong>.<br><br>` +
          `Please package the artwork safely and ship it within 7 business days. Once shipped, enter the tracking number in your dashboard.`,
          'Enter Tracking Number →',
          `${SITE_URL}/artist-dashboard.html`
        ),
      };

    case 'artwork_shipped':
      return {
        to: collectorEmail,
        subject: `Your Artwork Has Shipped — ${artTitle}`,
        html: emailTemplate(
          'Your artwork is on its way!',
          `<strong>${artTitle}</strong> by ${artistName} has been shipped.<br><br>` +
          (trackingNumber ? `<strong>Tracking number:</strong> ${trackingNumber}<br><a href="https://www.google.com/search?q=track+package+${trackingNumber}" style="color:#000">Track your package →</a><br><br>` : '') +
          `Once you receive your artwork, please confirm delivery in your dashboard to release payment to the artist.`,
          'View My Orders →',
          `${SITE_URL}/collector-dashboard.html`
        ),
      };

    case 'delivery_reminder':
      return {
        to: collectorEmail,
        subject: `Reminder: Confirm Delivery — ${artTitle}`,
        html: emailTemplate(
          'Have you received your artwork?',
          `Just checking in — <strong>${artTitle}</strong> was shipped ${data.days_ago || 'several'} days ago.<br><br>` +
          `If you've received it, please confirm delivery so we can release payment to the artist. If you haven't received it yet, no action needed — we'll check back in a few days.<br><br>` +
          `If your artwork hasn't arrived within 14 days, please contact us at hello@inframint.io.`,
          'Confirm Delivery →',
          `${SITE_URL}/collector-dashboard.html`
        ),
      };

    case 'delivery_confirmed':
      return {
        to: artistEmail,
        subject: `Delivery Confirmed — ${artTitle}`,
        html: emailTemplate(
          'Delivery confirmed!',
          `<strong>${collectorName}</strong> has confirmed receiving <strong>${artTitle}</strong>.<br><br>` +
          `Your payout will be processed shortly. Thank you for being part of InfraMint!`,
          'View My Payouts →',
          `${SITE_URL}/artist-dashboard.html`
        ),
      };

    default:
      return null;
  }
}

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { event, data } = await req.json();
    
    if (!event || !data) {
      return new Response(JSON.stringify({ error: "Missing event or data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = buildEmail(event, data);
    
    if (!email) {
      return new Response(JSON.stringify({ error: "Unknown event type: " + event }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email.to],
        subject: email.subject,
        html: email.html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Email send failed", details: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
