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

  /* ---------- Motion: scroll reveal, hero parallax ----------
     Transform/opacity only. All of it is skipped when the user
     prefers reduced motion. The "js" class gates the reveal hidden
     state in CSS, so content is never stuck invisible if this
     script fails to load. */
  document.documentElement.classList.add("js");
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var finePointer = false;
  try { finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) {}
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); };
  }

  /* Reveal-on-scroll: fade + rise, staggered within a grid. */
  var revealTargets = document.querySelectorAll(
    ".card-dark, .tier, .addon, .mock-band, .stat," +
    " .section > .container > h2, .section > .container > .section-sub," +
    " .section > .container > p, .section > .container > .btn," +
    " .mission, .faq-item, .faq h2, .tl-item, .page-head h1, .page-head p," +
    " .page-head .by-changexed, .quiz-note"
  );
  function revealNow(el) {
    el.classList.add("visible");
    el.style.transitionDelay = "";
  }
  if (reduceMotion || !("IntersectionObserver" in window)) {
    for (var ri = 0; ri < revealTargets.length; ri++) {
      revealTargets[ri].classList.add("reveal");
      revealNow(revealTargets[ri]);
    }
  } else {
    var io = new IntersectionObserver(function (entries) {
      for (var ei = 0; ei < entries.length; ei++) {
        var entry = entries[ei];
        if (!entry.isIntersecting) continue;
        var el = entry.target;
        io.unobserve(el);
        var sibs = el.parentNode ? el.parentNode.children : [];
        var idx = 0;
        for (var k = 0; k < sibs.length; k++) { if (sibs[k] === el) { idx = k; break; } }
        var delay = Math.min(idx, 5) * 80;
        if (delay) {
          el.style.transitionDelay = delay + "ms";
          (function (elm) {
            setTimeout(function () { elm.style.transitionDelay = ""; }, 900);
          })(el);
        }
        el.classList.add("visible");
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    for (var oi = 0; oi < revealTargets.length; oi++) {
      revealTargets[oi].classList.add("reveal");
      io.observe(revealTargets[oi]);
    }
  }

  /* Hero parallax: background layers move slower than the content.
     Passive scroll listener + rAF, transform only, clamped so the
     content moves at most ~33px. Only runs while a hero is on
     screen, so it costs nothing elsewhere. */
  var heroes = document.querySelectorAll(".hero");
  if (heroes.length && !reduceMotion) {
    var ticking = false;
    function updateParallax() {
      ticking = false;
      for (var hi = 0; hi < heroes.length; hi++) {
        var h = heroes[hi];
        var rect = h.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          if (h.style.getPropertyValue("--hero-px")) h.style.setProperty("--hero-px", "0px");
          continue;
        }
        var px = Math.max(0, Math.min(220, -rect.top));
        h.style.setProperty("--hero-px", Math.round(px) + "px");
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateParallax); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateParallax();
  }
})();
