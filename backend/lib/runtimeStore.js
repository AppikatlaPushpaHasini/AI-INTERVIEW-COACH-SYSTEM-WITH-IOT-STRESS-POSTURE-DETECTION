const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const History = require("../models/History");

const dataDir = path.join(__dirname, "..", "data");
const usersFile = path.join(dataDir, "users.local.json");
const historyFile = path.join(dataDir, "history.local.json");

function ensureFile(filePath) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
  }
}

function readArray(filePath) {
  ensureFile(filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeArray(filePath, items) {
  ensureFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}

function writeArrayIfChanged(filePath, currentItems, nextItems) {
  if (JSON.stringify(currentItems) === JSON.stringify(nextItems)) {
    return false;
  }

  writeArray(filePath, nextItems);
  return true;
}

function dedupeSessions(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const sessionKey = String(item && item.sessionId ? item.sessionId : item && item._id ? item._id : "").trim();
    const fallbackKey = JSON.stringify([
      item?.userEmail || "",
      item?.username || "",
      item?.round || "",
      item?.question || "",
      item?.answer || "",
      item?.date || ""
    ]);
    const key = sessionKey || fallbackKey;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function isMongoAvailable() {
  return mongoose.connection.readyState === 1;
}

function getStorageMode() {
  return isMongoAvailable() ? "mongo" : "file";
}

function cleanObject(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined)
  );
}

async function findUserByEmail(email) {
  if (isMongoAvailable()) {
    return User.findOne({ email }).lean();
  }

  const users = readArray(usersFile);
  return users.find((user) => String(user.email || "").toLowerCase() === String(email || "").toLowerCase()) || null;
}

async function findUserByGoogleId(googleId) {
  const normalizedGoogleId = String(googleId || "").trim();
  if (!normalizedGoogleId) return null;

  if (isMongoAvailable()) {
    return User.findOne({ googleId: normalizedGoogleId }).lean();
  }

  const users = readArray(usersFile);
  return users.find((user) => String(user.googleId || "").trim() === normalizedGoogleId) || null;
}

async function findUserByUsername(username) {
  const normalizedUsername = String(username || "").trim().toLowerCase();

  if (isMongoAvailable()) {
    return User.findOne({ username: new RegExp(`^${normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
  }

  const users = readArray(usersFile);
  return users.find((user) => String(user.username || "").trim().toLowerCase() === normalizedUsername) || null;
}

async function findUserByCredential(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return null;

  const byEmail = await findUserByEmail(value);
  if (byEmail) return byEmail;

  return findUserByUsername(value);
}

async function createUser(payload) {
  if (isMongoAvailable()) {
    const user = new User(payload);
    await user.save();
    return user.toObject();
  }

  const users = readArray(usersFile);
  const now = new Date().toISOString();
  const user = cleanObject({
    _id: crypto.randomUUID(),
    username: payload.username,
    email: payload.email,
    authProvider: payload.authProvider || (payload.password ? "password" : "google"),
    googleId: payload.googleId,
    avatarUrl: payload.avatarUrl,
    password: payload.password,
    createdAt: now,
    updatedAt: now
  });
  users.push(user);
  writeArray(usersFile, users);
  return { ...user };
}

async function updateUserById(id, updates) {
  const userId = String(id || "").trim();
  if (!userId) return null;

  const cleanUpdates = cleanObject(updates);
  if (!Object.keys(cleanUpdates).length) {
    return null;
  }

  if (isMongoAvailable()) {
    return User.findByIdAndUpdate(
      userId,
      { $set: cleanUpdates },
      { new: true, runValidators: true }
    ).lean();
  }

  const users = readArray(usersFile);
  const userIndex = users.findIndex((user) => String(user._id || user.id || "") === userId);

  if (userIndex === -1) {
    return null;
  }

  const updatedUser = {
    ...users[userIndex],
    ...cleanUpdates,
    updatedAt: new Date().toISOString()
  };

  users[userIndex] = updatedUser;
  writeArray(usersFile, users);
  return { ...updatedUser };
}

async function listUsers() {
  if (isMongoAvailable()) {
    return User.find({}, { password: 0 }).sort({ createdAt: -1, _id: -1 }).lean();
  }

  return readArray(usersFile)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map(({ password, ...user }) => user);
}

async function createHistory(payload) {
  if (isMongoAvailable()) {
    const existing = await History.findOne({ sessionId: payload.sessionId }).lean();
    if (existing) {
      return existing;
    }

    const session = await History.create(payload);
    return session.toObject();
  }

  const storedSessions = readArray(historyFile);
  const sessions = dedupeSessions(storedSessions);
  const existing = sessions.find((item) => String(item.sessionId || "") === String(payload.sessionId || ""));
  if (existing) {
    writeArrayIfChanged(historyFile, storedSessions, sessions);
    return existing;
  }

  const now = new Date().toISOString();
  const session = {
    _id: crypto.randomUUID(),
    ...payload,
    date: payload.date || now,
    createdAt: now,
    updatedAt: now
  };
  sessions.push(session);
  writeArrayIfChanged(historyFile, storedSessions, dedupeSessions(sessions));
  return session;
}

async function listHistory(order = "asc") {
  if (isMongoAvailable()) {
    const sort = order === "desc" ? { date: -1, _id: -1 } : { date: 1, _id: 1 };
    return History.find({}).sort(sort).lean();
  }

  const storedSessions = readArray(historyFile);
  const sessions = dedupeSessions(storedSessions).slice();
  writeArrayIfChanged(historyFile, storedSessions, sessions);
  sessions.sort((a, b) => {
    const delta = new Date(a.date || 0) - new Date(b.date || 0);
    return order === "desc" ? -delta : delta;
  });
  return sessions;
}

module.exports = {
  getStorageMode,
  findUserByEmail,
  findUserByGoogleId,
  findUserByUsername,
  findUserByCredential,
  createUser,
  updateUserById,
  listUsers,
  createHistory,
  listHistory
};
