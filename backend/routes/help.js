const router = require("express").Router();
const contactStore = require("../lib/contactStore");
const mailer = require("../lib/mailer");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function getOwner() {
  return {
    name: cleanText(process.env.OWNER_NAME || "Hasini Appikatla"),
    email: normalizeEmail(process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || "hasiniappikatla11@gmail.com"),
    contact: cleanText(process.env.OWNER_CONTACT || "Email support and admin inbox")
  };
}

router.get("/owner", (_req, res) => {
  const owner = getOwner();
  res.json({
    ...owner,
    emailDeliveryEnabled: mailer.isMailConfigured(owner.email),
    mailerAvailable: mailer.isMailerAvailable()
  });
});

router.post("/contact", async (req, res) => {
  const owner = getOwner();
  const name = cleanText(req.body.name);
  const email = normalizeEmail(req.body.email);
  const subject = cleanText(req.body.subject);
  const message = cleanText(req.body.message);

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: "Name, email, subject, and message are required." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Enter a valid sender email address." });
  }

  const saved = contactStore.createContactMessage({
    name,
    email,
    subject,
    message,
    source: "help-page"
  });
  const delivery = await mailer.sendSupportEmail(saved, {
    toEmail: owner.email,
    ownerName: owner.name
  });

  let responseMessage = "Your support request was saved to the admin inbox.";
  if (delivery.delivered) {
    responseMessage = "Your support request was saved and emailed to the owner successfully.";
  } else if (delivery.reason === "send_failed") {
    responseMessage = "Your support request was saved to the admin inbox, but email delivery failed right now.";
  } else if (delivery.reason === "mail_not_configured" || delivery.reason === "mailer_missing") {
    responseMessage = "Your support request was saved to the admin inbox. Email delivery is not configured on the server yet.";
  }

  res.status(201).json({
    message: responseMessage,
    item: saved,
    delivery
  });
});

router.get("/messages", auth, requireAdmin, (_req, res) => {
  res.json(contactStore.listContactMessages());
});

module.exports = router;
