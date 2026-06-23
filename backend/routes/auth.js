const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const store = require("../lib/runtimeStore");
const { isAdminEmail } = require("../middleware/admin");
const { verifyGoogleIdToken } = require("../lib/googleIdToken");

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
    id: getUserId(user),
    username: user.username,
    email: user.email,
    authProvider: user.authProvider || (user.googleId ? "google" : "password"),
    avatarUrl: user.avatarUrl || "",
    isAdmin: isAdminEmail(user.email)
  };
}

function getUserId(user) {
  return String((user && (user._id || user.id)) || "");
}

function signAuthToken(user) {
  return jwt.sign(
    { id: getUserId(user), email: user.email, isAdmin: isAdminEmail(user.email) },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );
}

function getGoogleClientId() {
  const clientIds = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_IDS
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return clientIds[0] || "";
}

function createUsernameBase(name, email) {
  const emailName = String(email || "").split("@")[0];
  const source = String(name || emailName || "googleuser")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const sanitized = source.toLowerCase().replace(/[^a-z0-9_-]+/g, "").slice(0, 40);

  if (sanitized.length >= 3) {
    return sanitized;
  }

  return `googleuser${sanitized}`.slice(0, 40);
}

async function createAvailableUsername(profile) {
  const base = createUsernameBase(profile.name, profile.email);
  let username = base;
  let attempt = 0;

  while (await store.findUserByUsername(username)) {
    attempt += 1;
    const suffix = String(attempt);
    username = `${base.slice(0, 50 - suffix.length)}${suffix}`;
  }

  return username;
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
    const user = await store.createUser({ username, email, password: hashed, authProvider: "password" });

    res.status(201).json({
      message: "Registered successfully.",
      token: signAuthToken(user),
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

    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google Sign-In. Continue with Google instead." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: "Wrong password." });
    }

    const token = signAuthToken(user);

    res.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Unable to login right now." });
  }
});

router.get("/google/config", (_req, res) => {
  const clientId = getGoogleClientId();
  res.json({
    enabled: Boolean(clientId),
    clientId
  });
});

router.post("/google", async (req, res) => {
  try {
    const credential = req.body.credential || req.body.idToken;
    const mode = ["login", "register"].includes(req.body.mode) ? req.body.mode : "continue";
    const profile = await verifyGoogleIdToken(credential);

    let user = await store.findUserByGoogleId(profile.googleId);
    if (!user) {
      user = await store.findUserByEmail(profile.email);
    }

    if (!user && mode === "login") {
      return res.status(404).json({
        message: "No account found for this Google account. Please register with Google first."
      });
    }

    if (user) {
      const updates = {
        authProvider: "google",
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl || user.avatarUrl
      };

      user = await store.updateUserById(getUserId(user), updates) || { ...user, ...updates };
    } else {
      user = await store.createUser({
        username: await createAvailableUsername(profile),
        email: profile.email,
        authProvider: "google",
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl
      });
    }

    res.json({
      token: signAuthToken(user),
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("Google login error:", error);

    const status = error?.code === "GOOGLE_AUTH_CONFIG"
      ? 503
      : error?.code === "GOOGLE_AUTH_NETWORK"
        ? 502
        : 401;

    res.status(status).json({ message: error?.message || "Google login failed." });
  }
});

module.exports = router;
