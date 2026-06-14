let nodemailer = null;

try {
  nodemailer = require("nodemailer");
} catch (_error) {
  nodemailer = null;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readMailConfig(defaultRecipient = "") {
  const port = Number(process.env.SUPPORT_SMTP_PORT || process.env.SMTP_PORT || 587);
  const secure = normalizeBool(process.env.SUPPORT_SMTP_SECURE, port === 465);
  const host = cleanText(process.env.SUPPORT_SMTP_HOST || process.env.SMTP_HOST);
  const user = cleanText(process.env.SUPPORT_SMTP_USER || process.env.SMTP_USER);
  const pass = cleanText(process.env.SUPPORT_SMTP_PASS || process.env.SMTP_PASS);
  const fromEmail = cleanText(process.env.SUPPORT_FROM_EMAIL || process.env.SMTP_FROM || user);
  const fromName = cleanText(process.env.SUPPORT_FROM_NAME || "PrepGenie Support");
  const toEmail = cleanText(process.env.SUPPORT_TO_EMAIL || process.env.OWNER_EMAIL || defaultRecipient);

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    toEmail
  };
}

function isMailerAvailable() {
  return Boolean(nodemailer);
}

function isMailConfigured(defaultRecipient = "") {
  const config = readMailConfig(defaultRecipient);
  return Boolean(
    nodemailer &&
    config.host &&
    config.port &&
    config.fromEmail &&
    config.toEmail
  );
}

function buildTextBody(payload, ownerName) {
  return [
    `PrepGenie support request for ${ownerName || "Owner"}`,
    "",
    `Name: ${cleanText(payload.name)}`,
    `Email: ${cleanText(payload.email)}`,
    `Subject: ${cleanText(payload.subject)}`,
    `Source: ${cleanText(payload.source) || "help-page"}`,
    `Submitted: ${cleanText(payload.createdAt) || new Date().toISOString()}`,
    "",
    "Message:",
    cleanText(payload.message)
  ].join("\n");
}

function buildHtmlBody(payload, ownerName) {
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#163424">
      <h2 style="margin:0 0 12px;color:#138a52">PrepGenie Support Request</h2>
      <p style="margin:0 0 16px">A new support request was submitted for ${escapeHtml(ownerName || "the owner")}.</p>
      <table style="border-collapse:collapse;width:100%;max-width:720px;background:#f8fbf8">
        <tr><td style="padding:10px;border:1px solid #d8e6dd"><strong>Name</strong></td><td style="padding:10px;border:1px solid #d8e6dd">${escapeHtml(payload.name)}</td></tr>
        <tr><td style="padding:10px;border:1px solid #d8e6dd"><strong>Email</strong></td><td style="padding:10px;border:1px solid #d8e6dd">${escapeHtml(payload.email)}</td></tr>
        <tr><td style="padding:10px;border:1px solid #d8e6dd"><strong>Subject</strong></td><td style="padding:10px;border:1px solid #d8e6dd">${escapeHtml(payload.subject)}</td></tr>
        <tr><td style="padding:10px;border:1px solid #d8e6dd"><strong>Source</strong></td><td style="padding:10px;border:1px solid #d8e6dd">${escapeHtml(payload.source || "help-page")}</td></tr>
        <tr><td style="padding:10px;border:1px solid #d8e6dd"><strong>Submitted</strong></td><td style="padding:10px;border:1px solid #d8e6dd">${escapeHtml(payload.createdAt || new Date().toISOString())}</td></tr>
        <tr><td style="padding:10px;border:1px solid #d8e6dd;vertical-align:top"><strong>Message</strong></td><td style="padding:10px;border:1px solid #d8e6dd;white-space:pre-wrap">${escapeHtml(payload.message)}</td></tr>
      </table>
    </div>
  `;
}

async function sendSupportEmail(payload, options = {}) {
  const config = readMailConfig(options.toEmail);

  if (!nodemailer) {
    return {
      delivered: false,
      configured: false,
      mode: "admin-inbox-only",
      reason: "mailer_missing"
    };
  }

  if (!config.host || !config.port || !config.fromEmail || !config.toEmail) {
    return {
      delivered: false,
      configured: false,
      mode: "admin-inbox-only",
      reason: "mail_not_configured"
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass
          }
        : undefined
    });

    const replyTo = cleanText(payload.email)
      ? cleanText(payload.name)
        ? `"${cleanText(payload.name)}" <${cleanText(payload.email)}>`
        : cleanText(payload.email)
      : undefined;

    await transporter.sendMail({
      from: config.fromName
        ? `"${config.fromName}" <${config.fromEmail}>`
        : config.fromEmail,
      to: config.toEmail,
      replyTo,
      subject: `[PrepGenie Support] ${cleanText(payload.subject) || "New support request"}`,
      text: buildTextBody(payload, options.ownerName),
      html: buildHtmlBody(payload, options.ownerName)
    });

    return {
      delivered: true,
      configured: true,
      mode: "email+admin-inbox",
      reason: "sent",
      to: config.toEmail
    };
  } catch (error) {
    return {
      delivered: false,
      configured: true,
      mode: "admin-inbox-only",
      reason: "send_failed",
      error: error.message
    };
  }
}

module.exports = {
  isMailerAvailable,
  isMailConfigured,
  sendSupportEmail
};
