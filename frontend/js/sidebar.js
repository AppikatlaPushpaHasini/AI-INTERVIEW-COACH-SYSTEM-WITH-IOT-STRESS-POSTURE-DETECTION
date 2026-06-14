(function initPrepGenieSidebar() {
  const STORAGE_KEY = "prepgenieSidebarMode";
  const BREAKPOINT = 980;

  function createToggleButton(className, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.innerHTML = "<span></span><span></span><span></span>";
    return button;
  }

  function getStoredMode() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "collapsed" ? "collapsed" : "expanded";
    } catch (_error) {
      return "expanded";
    }
  }

  function setStoredMode(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode === "collapsed" ? "collapsed" : "expanded");
    } catch (_error) {
      // Ignore storage failures and keep the UI usable.
    }
  }

  function init() {
    const body = document.body;
    const sidebar = document.querySelector(".sidebar");
    if (!body || !sidebar) return;

    body.classList.add("has-app-sidebar");

    const sidebarMain = sidebar.querySelector(".sidebar-main") || sidebar.firstElementChild || sidebar;
    let topbar = sidebar.querySelector(".sidebar-topbar");

    if (!topbar) {
      topbar = document.createElement("div");
      topbar.className = "sidebar-topbar";
      topbar.innerHTML = '<div class="sidebar-section-label">Workspace</div>';
      sidebarMain.insertBefore(topbar, sidebarMain.firstChild || null);
    }

    let toggle = sidebar.querySelector(".sidebar-toggle");
    if (!toggle) {
      toggle = createToggleButton("sidebar-toggle", "Toggle sidebar");
      topbar.appendChild(toggle);
    }

    let mobileLaunch = document.querySelector(".sidebar-mobile-launch");
    if (!mobileLaunch) {
      mobileLaunch = createToggleButton("sidebar-mobile-launch", "Open sidebar");
      body.appendChild(mobileLaunch);
    }

    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("button");
      overlay.type = "button";
      overlay.className = "sidebar-overlay";
      overlay.setAttribute("aria-label", "Close sidebar");
      body.appendChild(overlay);
    }

    function isMobile() {
      return window.innerWidth <= BREAKPOINT;
    }

    function closeMobile() {
      body.classList.remove("sidebar-mobile-open");
      syncToggleLabels();
    }

    function openMobile() {
      body.classList.add("sidebar-mobile-open");
      syncToggleLabels();
    }

    function setCollapsed(nextCollapsed) {
      setStoredMode(nextCollapsed ? "collapsed" : "expanded");
      if (!isMobile()) {
        body.classList.toggle("sidebar-collapsed", nextCollapsed);
      }
      syncToggleLabels();
    }

    function applyStoredMode() {
      if (isMobile()) {
        body.classList.remove("sidebar-collapsed");
      } else {
        body.classList.toggle("sidebar-collapsed", getStoredMode() === "collapsed");
        body.classList.remove("sidebar-mobile-open");
      }
      syncToggleLabels();
    }

    function syncToggleLabels() {
      const collapsed = body.classList.contains("sidebar-collapsed");
      const mobileOpen = body.classList.contains("sidebar-mobile-open");
      const desktopLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
      const mobileLabel = mobileOpen ? "Close sidebar" : "Open sidebar";
      const label = isMobile() ? mobileLabel : desktopLabel;

      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("title", label);
      mobileLaunch.setAttribute("aria-label", mobileLabel);
      mobileLaunch.setAttribute("title", mobileLabel);
    }

    function toggleSidebar() {
      if (isMobile()) {
        if (body.classList.contains("sidebar-mobile-open")) {
          closeMobile();
        } else {
          openMobile();
        }
        return;
      }

      setCollapsed(!body.classList.contains("sidebar-collapsed"));
    }

    toggle.addEventListener("click", toggleSidebar);
    mobileLaunch.addEventListener("click", toggleSidebar);
    overlay.addEventListener("click", closeMobile);

    sidebar.querySelectorAll(".sidebar-group button, .sidebar-foot button").forEach((button) => {
      if (button === toggle) return;
      button.addEventListener("click", () => {
        if (isMobile()) {
          closeMobile();
        }
      });
    });

    window.addEventListener("resize", applyStoredMode);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && body.classList.contains("sidebar-mobile-open")) {
        closeMobile();
      }
    });

    applyStoredMode();

    window.PrepGenieSidebar = {
      toggle: toggleSidebar,
      open: openMobile,
      close: closeMobile,
      collapse() {
        setCollapsed(true);
      },
      expand() {
        setCollapsed(false);
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
