function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getAdminEmail() {
  return normalizeEmail(
    process.env.ADMIN_EMAIL ||
    process.env.OWNER_EMAIL ||
    "hasiniappikatla11@gmail.com"
  );
}

function isAdminEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email) && email === getAdminEmail();
}

function requireAdmin(req, res, next) {
  if (isAdminEmail(req.user && req.user.email)) {
    next();
    return;
  }

  res.status(403).json({ message: "Admin access required" });
}

module.exports = requireAdmin;
module.exports.getAdminEmail = getAdminEmail;
module.exports.isAdminEmail = isAdminEmail;
