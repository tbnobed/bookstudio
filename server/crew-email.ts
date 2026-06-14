import { sendEmail } from "./services/emailService";
import type { Booking } from "@shared/schema";

function getApplicationUrl(): string {
  if (process.env.APP_DOMAIN) return process.env.APP_DOMAIN;
  return `http://localhost:${process.env.PORT || 5000}`;
}

function formatRate(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface InviteEmailParams {
  to: string;
  crewName: string;
  positionName: string;
  booking: Booking;
  rateType: "day" | "half-day";
  rateCents: number;
  token: string;
  producerName: string;
  studioNames: string[];
}

export async function sendCrewInviteEmail(p: InviteEmailParams): Promise<boolean> {
  const origin = getApplicationUrl();
  const acceptUrl = `${origin}/crew/respond/${p.token}?action=accept`;
  const declineUrl = `${origin}/crew/respond/${p.token}?action=decline`;
  const detailUrl = `${origin}/crew/respond/${p.token}`;
  const senderEmail = process.env.SENDGRID_VERIFIED_SENDER || "noreply@bookstud.io";

  const start = new Date(p.booking.start);
  const end = new Date(p.booking.end);
  const tz = process.env.FACILITY_TIMEZONE || process.env.TZ || "America/Chicago";
  const dateStr = start.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz });
  const timeStr = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;
  const rateLabel = p.rateType === "half-day" ? "Half-day rate" : "Day rate";

  const text = `
Hi ${p.crewName},

${p.producerName} would like to book you for the following production:

  Position: ${p.positionName}
  Production: ${p.booking.title}
  Date: ${dateStr}
  Time: ${timeStr}
  Studio: ${p.studioNames.join(", ") || "TBD"}
  ${rateLabel}: ${formatRate(p.rateCents)}

Please confirm or decline this booking:

  Accept:  ${acceptUrl}
  Decline: ${declineUrl}

Or view the full details: ${detailUrl}

Thank you,
BookStud.io
`;

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:32px;text-align:center;">
    <h1 style="color:#fff;font-size:24px;margin:0;">Crew Booking Request</h1>
  </td></tr>
  <tr><td style="padding:32px 24px;color:#1f2937;">
    <p style="font-size:16px;margin:0 0 16px;">Hi <strong>${p.crewName}</strong>,</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">${p.producerName} would like to book you for the following production. Please confirm or decline as soon as you can.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:0;margin:0 0 24px;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;"><strong>Position:</strong> ${p.positionName}</td></tr>
      <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;"><strong>Production:</strong> ${p.booking.title}</td></tr>
      <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;"><strong>Date:</strong> ${dateStr}</td></tr>
      <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;"><strong>Time:</strong> ${timeStr}</td></tr>
      <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;"><strong>Studio:</strong> ${p.studioNames.join(", ") || "TBD"}</td></tr>
      <tr><td style="padding:16px 20px;"><strong>${rateLabel}:</strong> ${formatRate(p.rateCents)}</td></tr>
    </table>
    <div style="text-align:center;margin:32px 0;">
      <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;margin:4px;">✓ Accept</a>
      <a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;margin:4px;">✗ Decline</a>
    </div>
    <p style="text-align:center;font-size:14px;color:#6b7280;margin:0;">Or <a href="${detailUrl}" style="color:#2563eb;">view full details</a></p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;color:#6b7280;font-size:13px;">Sent by BookStud.io &copy; ${new Date().getFullYear()}</td></tr>
</table></td></tr></table></body></html>`;

  try {
    return await sendEmail({
      to: p.to, from: senderEmail,
      subject: `Crew Request: ${p.positionName} on ${dateStr} — ${p.booking.title}`,
      text, html,
    });
  } catch (err) {
    console.error("Failed to send crew invite email:", err);
    return false;
  }
}

interface ResponseNotifyParams {
  to: string;                // producer email
  producerName: string;
  crewName: string;
  positionName: string;
  bookingTitle: string;
  bookingId: number;
  status: "confirmed" | "declined";
  declineReason?: string;
}

export async function sendCrewResponseNotification(p: ResponseNotifyParams): Promise<boolean> {
  const origin = getApplicationUrl();
  const senderEmail = process.env.SENDGRID_VERIFIED_SENDER || "noreply@bookstud.io";
  const verb = p.status === "confirmed" ? "accepted" : "declined";
  const color = p.status === "confirmed" ? "#16a34a" : "#dc2626";
  const reasonBlock = p.declineReason
    ? `<p style="margin:16px 0;padding:12px;background:#fef2f2;border-left:4px solid #dc2626;"><strong>Reason:</strong> ${p.declineReason}</p>`
    : "";

  const text = `Hi ${p.producerName},

${p.crewName} has ${verb} the ${p.positionName} role on "${p.bookingTitle}".${p.declineReason ? `\n\nReason: ${p.declineReason}` : ""}

View booking: ${origin}/calendar?bookingId=${p.bookingId}
`;

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;">
<table width="600" align="center" style="background:#fff;border-radius:8px;padding:32px;">
  <tr><td>
    <h2 style="color:${color};margin:0 0 16px;">${p.crewName} ${verb} the booking</h2>
    <p>Hi ${p.producerName},</p>
    <p><strong>${p.crewName}</strong> has <strong style="color:${color};">${verb}</strong> the <strong>${p.positionName}</strong> role on <em>${p.bookingTitle}</em>.</p>
    ${reasonBlock}
    <p style="margin-top:24px;"><a href="${origin}/calendar?bookingId=${p.bookingId}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;">View booking</a></p>
  </td></tr>
</table></body></html>`;

  try {
    return await sendEmail({
      to: p.to, from: senderEmail,
      subject: `${p.crewName} ${verb} ${p.positionName} — ${p.bookingTitle}`,
      text, html,
    });
  } catch (err) {
    console.error("Failed to send crew response notification:", err);
    return false;
  }
}
