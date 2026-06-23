const crypto = require("crypto");
const https = require("https");

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

let cachedKeys = new Map();
let cacheExpiresAt = 0;

function createAuthError(message, code = "GOOGLE_AUTH_INVALID") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getExpectedClientIds() {
  const values = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_IDS
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (!values.length) {
    throw createAuthError("Google Sign-In is not configured.", "GOOGLE_AUTH_CONFIG");
  }

  return values;
}

function decodeBase64Url(value) {
  const input = String(value || "");
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + padding, "base64");
}

function parseJsonPart(value, label) {
  try {
    return JSON.parse(decodeBase64Url(value).toString("utf8"));
  } catch (_error) {
    throw createAuthError(`Invalid Google ID token ${label}.`);
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(createAuthError("Unable to download Google public keys.", "GOOGLE_AUTH_NETWORK"));
            return;
          }

          try {
            resolve({
              headers: response.headers,
              data: JSON.parse(body)
            });
          } catch (_error) {
            reject(createAuthError("Google public keys response was invalid.", "GOOGLE_AUTH_NETWORK"));
          }
        });
      })
      .on("error", () => {
        reject(createAuthError("Unable to reach Google token verification service.", "GOOGLE_AUTH_NETWORK"));
      });
  });
}

function getCacheMaxAgeMs(headers = {}) {
  const cacheControl = String(headers["cache-control"] || "");
  const match = cacheControl.match(/max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : 3600;
  return Math.max(60, seconds) * 1000;
}

async function getGoogleKeys(forceRefresh = false) {
  if (!forceRefresh && cachedKeys.size && Date.now() < cacheExpiresAt) {
    return cachedKeys;
  }

  const response = await fetchJson(GOOGLE_CERTS_URL);
  const keys = Array.isArray(response.data.keys) ? response.data.keys : [];

  cachedKeys = new Map(keys.filter((key) => key.kid).map((key) => [key.kid, key]));
  cacheExpiresAt = Date.now() + getCacheMaxAgeMs(response.headers);
  return cachedKeys;
}

async function getSigningKey(kid) {
  let keys = await getGoogleKeys(false);

  if (!keys.has(kid)) {
    keys = await getGoogleKeys(true);
  }

  const key = keys.get(kid);
  if (!key) {
    throw createAuthError("Google ID token signing key was not found.");
  }

  return key;
}

function verifySignature(idToken, jwk) {
  const parts = idToken.split(".");
  const signedContent = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });

  return crypto.verify("RSA-SHA256", signedContent, publicKey, signature);
}

async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || "").trim();
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw createAuthError("Google ID token is required.");
  }

  const header = parseJsonPart(parts[0], "header");
  const payload = parseJsonPart(parts[1], "payload");

  if (header.alg !== "RS256" || !header.kid) {
    throw createAuthError("Google ID token uses an unsupported signature.");
  }

  const signingKey = await getSigningKey(header.kid);
  if (!verifySignature(token, signingKey)) {
    throw createAuthError("Google ID token signature is invalid.");
  }

  const clientIds = getExpectedClientIds();
  if (!clientIds.includes(payload.aud)) {
    throw createAuthError("Google ID token was issued for a different client.");
  }

  if (!GOOGLE_ISSUERS.has(payload.iss)) {
    throw createAuthError("Google ID token issuer is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || Number(payload.exp) <= now) {
    throw createAuthError("Google ID token has expired.");
  }

  if (payload.nbf && Number(payload.nbf) > now) {
    throw createAuthError("Google ID token is not active yet.");
  }

  if (!payload.sub || !payload.email) {
    throw createAuthError("Google ID token is missing profile details.");
  }

  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw createAuthError("Google email is not verified.");
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.email).trim(),
    avatarUrl: String(payload.picture || "").trim()
  };
}

module.exports = {
  verifyGoogleIdToken
};
