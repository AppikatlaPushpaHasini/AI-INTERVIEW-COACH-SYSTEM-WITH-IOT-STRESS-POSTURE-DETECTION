function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ensureOwnerEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const existingOwner = normalizeEmail(localStorage.getItem("ownerEmail"));
  if (!existingOwner) {
    localStorage.setItem("ownerEmail", normalizedEmail);
  }
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

function getFormValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

function setFormLoading(form, isLoading) {
  form.querySelectorAll("button").forEach((button) => {
    button.disabled = isLoading;
  });
}

function completeAuth(data, fallbackMessage = "Login successful. Opening dashboard...") {
  if (!data?.token) {
    setAuthMessage("Authentication succeeded, but no session token was returned.", true);
    return false;
  }

  ensureOwnerEmail(data?.user?.email);
  clearAuthSession();
  saveAuthSession(data.token, data.user || {});
  setAuthMessage(fallbackMessage);
  window.location = "dashboard.html";
  return true;
}

async function loginWithPassword(identifier, password) {
  return window.PrepGenieConfig.fetchApiJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, email: identifier, password })
  }, { timeoutMs: 10000, includeAuth: false });
}

async function handlePasswordLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const identifier = getFormValue(form, "identifier");
  const password = getFormValue(form, "password");

  if (!identifier || !password) {
    setAuthMessage("Email or username and password are required.", true);
    return;
  }

  setFormLoading(form, true);
  setAuthMessage("Checking your account...");

  try {
    const data = await loginWithPassword(identifier, password);
    completeAuth(data);
  } catch (error) {
    console.error("Password login failed:", error);
    setAuthMessage(
      error?.status
        ? (error.message || "Login failed.")
        : "Cannot reach the server. Make sure the backend is running on port 5000.",
      true
    );
  } finally {
    setFormLoading(form, false);
  }
}

async function handlePasswordRegister(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const username = getFormValue(form, "username");
  const email = getFormValue(form, "email");
  const password = getFormValue(form, "password");

  if (!username || !email || !password) {
    setAuthMessage("Username, email, and password are required.", true);
    return;
  }

  setFormLoading(form, true);
  setAuthMessage("Creating your account...");

  try {
    let data = await window.PrepGenieConfig.fetchApiJson("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    }, { timeoutMs: 10000, includeAuth: false });

    if (!data?.token) {
      data = await loginWithPassword(email, password);
    }

    completeAuth(data, "Account created. Opening dashboard...");
  } catch (error) {
    console.error("Password registration failed:", error);
    setAuthMessage(
      error?.status
        ? (error.message || "Registration failed.")
        : "Cannot reach the server. Make sure the backend is running on port 5000.",
      true
    );
  } finally {
    setFormLoading(form, false);
  }
}

function initPasswordAuth() {
  document.getElementById("passwordLoginForm")?.addEventListener("submit", handlePasswordLogin);
  document.getElementById("passwordRegisterForm")?.addEventListener("submit", handlePasswordRegister);
}

window.logout = function logout() {
  clearAuthSession();
  window.location = "index.html";
};

window.addEventListener("DOMContentLoaded", () => {
  initPasswordAuth();
});
