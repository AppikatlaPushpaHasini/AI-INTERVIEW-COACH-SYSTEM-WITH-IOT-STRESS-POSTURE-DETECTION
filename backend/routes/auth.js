const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const store = require("../lib/runtimeStore");
const { isAdminEmail } = require("../middleware/admin");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function serializeUser(user) {
  return {
    id: user._id || user.id,
    username: user.username,
    email: user.email,
    isAdmin: isAdminEmail(user.email)
  };
}

router.post("/register", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email, and password are required." });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters long." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const existingUser = await store.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const existingUsername = await store.findUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ message: "This username is already taken." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await store.createUser({ username, email, password: hashed });

    res.status(201).json({
      message: "Registered successfully.",
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("Register error:", error);

    if (error && error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || "";
      return res.status(409).json({
        message: duplicateField === "username"
          ? "This username is already taken."
          : "An account with this email already exists."
      });
    }

    if (error && error.name === "ValidationError") {
      const firstMessage = Object.values(error.errors || {})[0]?.message;
      return res.status(400).json({ message: firstMessage || "Invalid registration details." });
    }

    res.status(500).json({ message: "Unable to create account right now." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const identifier = String(req.body.email || req.body.identifier || "").trim();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email or username and password are required." });
    }

    const normalizedIdentifier = isValidEmail(identifier)
      ? normalizeEmail(identifier)
      : normalizeUsername(identifier);

    if (!normalizedIdentifier) {
      return res.status(400).json({ message: "Enter a valid email or username." });
    }

    const user = await store.findUserByCredential(normalizedIdentifier);
    if (!user) {
      return res.status(400).json({ message: "User not found with that email or username." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: "Wrong password." });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, isAdmin: isAdminEmail(user.email) },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Unable to login right now." });
  }
});

module.exports = router;
