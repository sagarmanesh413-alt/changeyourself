/* ChangeYourself — shared site JS (Home, About, Pricing only).
   The mock-tests app at /changexed/mock-tests/ is a standalone file and does not load this. */
(function () {
  "use strict";

  /* ---------- Guarded storage shim ----------
     Plain localStorage throws in some phone webviews (and in private
     mode), which used to break the whole script. Every access goes
     through this shim: localStorage when it works, an in-memory
     object when it doesn't. Never call localStorage directly. */
  var memStore = {};
  var storageOK = false;
  try {
    window.localStorage.setItem("__cy_probe__", "1");
    window.localStorage.removeItem("__cy_probe__");
    storageOK = true;
  } catch (e) { storageOK = false; }
  var store = {
    get: function (key) {
      if (storageOK) {
        try { return window.localStorage.getItem(key); } catch (e) { /* fall through */ }
      }
      return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null;
    },
    set: function (key, value) {
      if (storageOK) {
        try { window.localStorage.setItem(key, value); return; } catch (e) { /* fall through */ }
      }
      memStore[key] = value;
    }
  };

  /* ---------- Theme toggle ----------
     Default theme is dark. The saved choice ("cy-theme": "light" |
     "dark") is applied pre-paint by the inline script in <head>;
     this just wires the toggle button and keeps it in sync. */
  var THEME_KEY = "cy-theme";
  var SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var themeToggle = document.getElementById("themeToggle");
  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "light" ? "light" : "dark";
  }
  function paintToggle(theme) {
    if (!themeToggle) return;
    /* The icon shows the theme the button will switch TO. */
    themeToggle.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  function setTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    store.set(THEME_KEY, theme);
    paintToggle(theme);
  }
  if (themeToggle) {
    /* Sync with whatever the pre-paint script applied (or the default). */
    paintToggle(currentTheme());
    themeToggle.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  /* ---------- Toast ---------- */
  var toast = document.getElementById("toast");
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 4000);
  }

  /* Login is a placeholder for now. */
  var loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", function () {
      showToast("Login is coming soon — the mock tests are free for now.");
    });
  }

  /* Any element marked data-soon shows a toast instead of navigating. */
  var soonEls = document.querySelectorAll("[data-soon]");
  for (var i = 0; i < soonEls.length; i++) {
    soonEls[i].addEventListener("click", function (ev) {
      ev.preventDefault();
      showToast(this.getAttribute("data-soon") || "Coming soon.");
    });
  }

  /* ---------- Rotating hero word ---------- */
  var rot = document.getElementById("rotWord");
  if (rot) {
    var words = ["empowering", "transformative", "innovative", "life-changing", "career-defining"];
    var idx = 0;
    setInterval(function () {
      rot.classList.add("fading");
      setTimeout(function () {
        idx = (idx + 1) % words.length;
        rot.textContent = words[idx];
        rot.classList.remove("fading");
      }, 350);
    }, 2400);
  }
})();
