const API = window.PrepGenieConfig?.API_BASE || "http://localhost:5000/api";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function ensureOwnerEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const existingOwner = normalizeEmail(localStorage.getItem("ownerEmail"));
  if (!existingOwner) {
    localStorage.setItem("ownerEmail", normalizedEmail);
  }
}

function getFieldValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function clearFieldValue(id) {
  const element = document.getElementById(id);
  if (element) element.value = "";
}

function setAuthMessage(message, isError = false) {
  const status = document.getElementById("authStatus");
  if (!status) {
    alert(message);
    return;
  }

  status.textContent = message;
  status.style.color = isError ? "#dc2626" : "#138a52";
}

function saveAuthSession(token, user) {
  window.PrepGenieAccess?.clearPreviewMode?.();
  localStorage.setItem("token", token);
  localStorage.setItem("currentUser", JSON.stringify(user));
}

function clearAuthSession() {
  window.PrepGenieAccess?.clearPreviewMode?.();
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
}

async function register() {
  const username = getFieldValue("ruser");
  const email = normalizeEmail(getFieldValue("remail"));
  const password = getFieldValue("rpass");

  if (!username || !email || !password) {
    setAuthMessage("Enter username, email, and password to create an account.", true);
    return;
  }

  if (username.length < 3) {
    setAuthMessage("Username must be at least 3 characters long.", true);
    return;
  }

  if (!isValidEmail(email)) {
    setAuthMessage("Enter a valid email address.", true);
    return;
  }

  if (password.length < 6) {
    setAuthMessage("Password must be at least 6 characters long.", true);
    return;
  }

  try {
    const data = await window.PrepGenieConfig.fetchApiJson("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    }, { timeoutMs: 7000 });

    ensureOwnerEmail(email);
    setAuthMessage("Account created successfully. You can login now.");
    const loginEmail = document.getElementById("email");
    if (loginEmail) loginEmail.value = email;
    clearFieldValue("ruser");
    clearFieldValue("remail");
    clearFieldValue("rpass");
  } catch (error) {
    console.error("Register request failed:", error);
    setAuthMessage(
      error?.status
        ? (error.message || "Registration failed.")
        : "Cannot reach the server. Make sure the backend is running on port 5000.",
      true
    );
  }
}

async function login() {
  const identifier = getFieldValue("email");
  const password = getFieldValue("password");

  if (!identifier || !password) {
    setAuthMessage("Enter your email or username and password to login.", true);
    return;
  }

  try {
    const data = await window.PrepGenieConfig.fetchApiJson("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, email: identifier, password })
    }, { timeoutMs: 7000 });

    if (!data.token) {
      setAuthMessage("Login failed.", true);
      return;
    }

    ensureOwnerEmail(data?.user?.email || identifier);
    clearAuthSession();
    saveAuthSession(data.token, data.user || { email: identifier });
    setAuthMessage("Login successful. Redirecting...");
    window.location = "dashboard.html";
  } catch (error) {
    console.error("Login request failed:", error);
    setAuthMessage(
      error?.status
        ? (error.message || "Login failed.")
        : "Cannot reach the server. Make sure the backend is running on port 5000.",
      true
    );
  }
}

window.logout = function logout() {
  clearAuthSession();
  window.location = "index.html";
};

window.addEventListener("DOMContentLoaded", () => {
  ["email", "password", "ruser", "remail", "rpass"].forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;

    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (id === "email" || id === "password") login();
      else register();
    });
  });
});
