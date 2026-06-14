function updateThemeButtons() {
  const isDark = document.body.classList.contains("dark");
  document.querySelectorAll("#themeBtn").forEach((button) => {
    button.textContent = isDark ? "Light Theme" : "Dark Theme";
    button.setAttribute("aria-pressed", String(isDark));
  });
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const mode = document.body.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem("theme", mode);
  updateThemeButtons();
}

function loadTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
  updateThemeButtons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadTheme);
} else {
  loadTheme();
}
