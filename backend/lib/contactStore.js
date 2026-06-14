const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const contactsFile = path.join(dataDir, "contacts.local.json");

function ensureFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(contactsFile)) {
    fs.writeFileSync(contactsFile, "[]", "utf8");
  }
}

function readContacts() {
  ensureFile();
  try {
    const raw = fs.readFileSync(contactsFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeContacts(items) {
  ensureFile();
  fs.writeFileSync(contactsFile, JSON.stringify(items, null, 2), "utf8");
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function createContactMessage(payload) {
  const items = readContacts();
  const now = new Date().toISOString();
  const next = {
    _id: crypto.randomUUID(),
    name: cleanText(payload.name),
    email: normalizeEmail(payload.email),
    subject: cleanText(payload.subject),
    message: cleanText(payload.message),
    source: cleanText(payload.source) || "help-page",
    createdAt: now
  };

  items.push(next);
  writeContacts(items);
  return next;
}

function listContactMessages() {
  return readContacts()
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

module.exports = {
  createContactMessage,
  listContactMessages
};
