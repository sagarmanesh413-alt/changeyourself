/* ChangeYourself — auth UI: nav login button + sign-in modal.
   Owns the #loginBtn on every page (the old placeholder toast in
   main.js and the mock-test app is gone). Carries its own CSS so
   the modal works on the mock-test app too, which does not load
   styles.css. Never throws; if Supabase cannot load, the modal says so
   and the site keeps working signed-out. */
(function () {
  "use strict";
  if (window.__CYAuthLoaded) return;
  window.__CYAuthLoaded = true;

  var GOOGLE_LABEL = "Continue with Google";

  /* ---------- Injected CSS (modal + user menu) ---------- */
  var css = [
    ".auth-back{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.65);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}",
    ".auth-back[hidden]{display:none;}",
    ".auth-modal{position:relative;width:min(420px,100%);padding:28px;border-radius:20px;background:#111111;border:1px solid rgba(255,255,255,.14);color:#ffffff;box-shadow:0 20px 60px rgba(0,0,0,.6);text-align:left;}",
    ".auth-modal h2{font-size:22px;font-weight:700;margin:0 0 8px;}",
    ".auth-modal p{color:#a1a1aa;font-size:15px;margin:0 0 18px;}",
    ".auth-modal p b{color:#ffffff;}",
    ".auth-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:transparent;color:#ffffff;font-size:18px;line-height:1;cursor:pointer;}",
    ".auth-close:hover{background:rgba(255,255,255,.1);}",
    ".auth-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:#ffffff;color:#000000;font-size:15px;font-weight:700;cursor:pointer;}",
    ".auth-google:hover{background:#ececec;}",
    ".auth-google:disabled{opacity:.6;cursor:wait;}",
    ".auth-sep{display:flex;align-items:center;gap:12px;margin:20px 0;color:#71717a;font-size:13px;}",
    ".auth-sep::before,.auth-sep::after{content:\"\";flex:1;height:1px;background:rgba(255,255,255,.14);}",
    ".auth-modal label{display:block;font-size:14px;font-weight:600;margin-bottom:6px;}",
    ".auth-modal input{width:100%;padding:12px 14px;margin-bottom:14px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#ffffff;font:inherit;font-size:15px;}",
    ".auth-modal input::placeholder{color:#a1a1aa;}",
    ".auth-modal input:focus{outline:2px solid #7c3aed;outline-offset:1px;}",
    ".auth-modal .btn{width:100%;justify-content:center;}",
    ".auth-modal .btn:disabled{opacity:.6;cursor:wait;}",
    ".auth-msg{min-height:20px;margin:14px 0 0;color:#f87171;font-size:14px;text-align:center;}",
    ".auth-msg.ok{color:#4ade80;}",
    ".auth-link{display:block;margin:12px auto 0;padding:0;background:none;border:none;color:#a78bfa;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-decoration:underline;}",
    ".auth-menu{position:absolute;top:calc(100% + 10px);right:8px;z-index:70;min-width:190px;padding:6px;border-radius:14px;background:#111111;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 40px rgba(0,0,0,.55);}",
    ".auth-menu[hidden]{display:none;}",
    ".auth-menu a,.auth-menu button{display:flex;width:100%;padding:10px 12px;border:none;border-radius:9px;background:none;color:#ffffff;font:inherit;font-size:14px;font-weight:600;text-align:left;text-decoration:none;cursor:pointer;}",
    ".auth-menu a:hover,.auth-menu button:hover{background:rgba(255,255,255,.1);}",
    ".auth-menu .auth-menu-email{display:block;padding:10px 12px;color:#a1a1aa;font-size:13px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:4px;word-break:break-all;}",
    "html[data-theme=\"light\"] .auth-modal{background:#ffffff;border-color:rgba(0,0,0,.12);color:#111111;box-shadow:0 20px 60px rgba(0,0,0,.25);}",
    "html[data-theme=\"light\"] .auth-modal p{color:#52525b;}",
    "html[data-theme=\"light\"] .auth-modal p b{color:#111111;}",
    "html[data-theme=\"light\"] .auth-close{border-color:rgba(0,0,0,.25);color:#111111;}",
    "html[data-theme=\"light\"] .auth-close:hover{background:rgba(0,0,0,.06);}",
    "html[data-theme=\"light\"] .auth-google{border-color:rgba(0,0,0,.2);}",
    "html[data-theme=\"light\"] .auth-sep{color:#71717a;}",
    "html[data-theme=\"light\"] .auth-sep::before,html[data-theme=\"light\"] .auth-sep::after{background:rgba(0,0,0,.12);}",
    "html[data-theme=\"light\"] .auth-modal input{border-color:rgba(0,0,0,.2);background:rgba(0,0,0,.04);color:#111111;}",
    "html[data-theme=\"light\"] .auth-modal input::placeholder{color:#71717a;}",
    "html[data-theme=\"light\"] .auth-menu{background:#ffffff;border-color:rgba(0,0,0,.12);box-shadow:0 16px 40px rgba(0,0,0,.2);}",
    "html[data-theme=\"light\"] .auth-menu a,html[data-theme=\"light\"] .auth-menu button{color:#111111;}",
    "html[data-theme=\"light\"] .auth-menu a:hover,html[data-theme=\"light\"] .auth-menu button:hover{background:rgba(0,0,0,.06);}",
    "html[data-theme=\"light\"] .auth-menu .auth-menu-email{color:#52525b;border-bottom-color:rgba(0,0,0,.1);}"
  ].join("\n");
  try {
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  } catch (e) {}

  var currentUser = null;

  function $(id) { return document.getElementById(id); }
  function showToast(msg) {
    var t = $("toast") || $("cyToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 4000);
  }
  /* The name the user saved in their profile wins over the Google
     account name — Google's name can be an email-like handle
     (e.g. "changexecosystem") while the profile says "MANESH". */
  function displayName(user, profileName) {
    if (!user) return "";
    if (profileName) return String(profileName).split(" ")[0];
    var md = user.user_metadata || {};
    var name = md.full_name || md.name || "";
    if (name) return String(name).split(" ")[0];
    var email = user.email || "";
    return email ? email.split("@")[0] : "Account";
  }

  /* ---------- Modal ---------- */
  function buildModal() {
    if ($("authBack")) return;
    var back = document.createElement("div");
    back.className = "auth-back";
    back.id = "authBack";
    back.hidden = true;
    back.innerHTML =
      '<div class="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in">' +
        '<button class="auth-close" id="authClose" type="button" aria-label="Close">\u00d7</button>' +
        '<h2>Sign in to ChangeYourself</h2>' +
        '<p>Your mock-test history, quiz rounds and profile are saved to your account.</p>' +
        '<button class="auth-google" id="authGoogle" type="button">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"/><path fill="#EA4335" d="M12 4.76c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76z"/></svg>' +
          '<span>' + GOOGLE_LABEL + '</span>' +
        '</button>' +
        '<div class="auth-sep"><span>or use email</span></div>' +
        '<div id="authOtpStep1">' +
          '<label for="authEmail">Email</label>' +
          '<input type="email" id="authEmail" placeholder="you@example.com" autocomplete="email">' +
          '<button class="btn btn-dark" id="authSendCode" type="button">Send sign-in code</button>' +
        '</div>' +
        '<div id="authOtpStep2" hidden>' +
          '<p>We sent a 6-digit code to <b id="authEmailEcho"></b>.</p>' +
          '<label for="authCode">Code</label>' +
          '<input type="text" id="authCode" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code">' +
          '<button class="btn btn-dark" id="authVerify" type="button">Verify and sign in</button>' +
          '<button class="auth-link" id="authBackToEmail" type="button">Use a different email</button>' +
        '</div>' +
        '<p class="auth-msg" id="authMsg" role="status"></p>' +
      '</div>';
    document.body.appendChild(back);
    back.addEventListener("click", function (e) { if (e.target === back) closeModal(); });
    $("authClose").addEventListener("click", closeModal);
    $("authGoogle").addEventListener("click", onGoogle);
    $("authSendCode").addEventListener("click", onSendCode);
    $("authVerify").addEventListener("click", onVerify);
    $("authBackToEmail").addEventListener("click", function () {
      $("authOtpStep2").hidden = true;
      $("authOtpStep1").hidden = false;
      setMsg("");
    });
    $("authEmail").addEventListener("keydown", function (e) { if (e.key === "Enter") onSendCode(); });
    $("authCode").addEventListener("keydown", function (e) { if (e.key === "Enter") onVerify(); });
  }
  function setMsg(text, ok) {
    var m = $("authMsg");
    if (!m) return;
    m.textContent = text || "";
    m.className = "auth-msg" + (ok ? " ok" : "");
  }
  function openModal() {
    buildModal();
    var back = $("authBack");
    if (!back) return;
    back.hidden = false;
    setMsg("");
    var g = $("authGoogle");
    if (g) { g.disabled = false; g.querySelector("span").textContent = GOOGLE_LABEL; }
  }
  function closeModal() {
    var back = $("authBack");
    if (back) back.hidden = true;
  }
  function needSupa() {
    if (!window.CYSupa) {
      setMsg("Sign-in could not load — check your connection and reload the page.");
      return false;
    }
    return true;
  }
  function onGoogle() {
    if (!needSupa()) return;
    var g = $("authGoogle");
    g.disabled = true;
    g.querySelector("span").textContent = "Redirecting to Google…";
    setMsg("");
    window.CYSupa.signInWithGoogle().then(function (r) {
      if (!r.ok) {
        g.disabled = false;
        g.querySelector("span").textContent = GOOGLE_LABEL;
        setMsg(r.error || "Google sign-in failed. Try again.");
      }
      /* On success the browser leaves for Google — nothing more to do. */
    });
  }
  /* F-16: 60-second resend cooldown after a code is sent (modal session
     only — no persistence). The button stays disabled with a countdown
     label so the OTP endpoint cannot be spammed from the UI. */
  var sendCooldownTimer = null;
  function startSendCooldown(btn) {
    var left = 60;
    btn.disabled = true;
    btn.textContent = "Resend code in " + left + "s";
    if (sendCooldownTimer) clearInterval(sendCooldownTimer);
    sendCooldownTimer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(sendCooldownTimer);
        sendCooldownTimer = null;
        btn.disabled = false;
        btn.textContent = "Send sign-in code";
        return;
      }
      btn.textContent = "Resend code in " + left + "s";
    }, 1000);
  }
  function onSendCode() {
    if (!needSupa()) return;
    var email = ($("authEmail").value || "").trim();
    if (!email || email.indexOf("@") < 1) { setMsg("Enter a valid email address."); return; }
    var btn = $("authSendCode");
    btn.disabled = true;
    setMsg("");
    window.CYSupa.sendOtp(email).then(function (r) {
      if (!r.ok) { btn.disabled = false; setMsg(r.error || "Could not send the code. Try again."); return; }
      $("authEmailEcho").textContent = email;
      $("authOtpStep1").hidden = true;
      $("authOtpStep2").hidden = false;
      setMsg("Code sent. Check your inbox.", true);
      var code = $("authCode");
      if (code) code.focus();
      startSendCooldown(btn);
    });
  }
  function onVerify() {
    if (!needSupa()) return;
    var email = ($("authEmailEcho").textContent || "").trim();
    var code = ($("authCode").value || "").trim();
    if (code.length !== 6) { setMsg("Enter the 6-digit code from your email."); return; }
    var btn = $("authVerify");
    btn.disabled = true;
    setMsg("");
    window.CYSupa.verifyOtp(email, code).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { setMsg(r.error || "That code did not work. Try again."); return; }
      closeModal();
      showToast("Signed in. Welcome back.");
      refreshNav(true);
    });
  }

  /* ---------- Nav: signed-in state + menu ---------- */
  function buildMenu(btn, user) {
    var nav = btn.closest("nav");
    if (!nav) return null;
    var old = nav.querySelector(".auth-menu");
    if (old) old.parentNode.removeChild(old);
    var menu = document.createElement("div");
    menu.className = "auth-menu";
    menu.id = "authMenu";
    menu.hidden = true;
    var emailEl = document.createElement("span");
    emailEl.className = "auth-menu-email";
    emailEl.textContent = user.email || "";
    menu.appendChild(emailEl);
    var dash = document.createElement("a");
    dash.href = "/dashboard/";
    dash.textContent = "Dashboard";
    menu.appendChild(dash);
    var out = document.createElement("button");
    out.type = "button";
    out.textContent = "Sign out";
    out.addEventListener("click", function () {
      if (window.CYSupa) {
        window.CYSupa.signOut().then(function () { window.location.reload(); });
      } else {
        window.location.reload();
      }
    });
    menu.appendChild(out);
    nav.appendChild(menu);
    return menu;
  }
  function paintNav(user, profileName) {
    var btn = $("loginBtn");
    if (!btn) return;
    if (!user) {
      btn.textContent = "Login";
      btn.onclick = function () { openModal(); };
      var old = document.querySelector(".auth-menu");
      if (old) old.parentNode.removeChild(old);
      return;
    }
    btn.textContent = displayName(user, profileName) + " \u25be";
    var menu = buildMenu(btn, user);
    btn.onclick = function (e) {
      e.stopPropagation();
      if (menu) menu.hidden = !menu.hidden;
    };
  }
  function refreshNav(reloadPage) {
    if (!window.CYSupa) { paintNav(null); return; }
    window.CYSupa.getUser().then(function (user) {
      currentUser = user;
      paintNav(user);
      /* Paint first with the Google name, then re-paint with the saved
         profile name when it arrives — never block the nav on it. */
      try {
        if (user && typeof window.CYSupa.getProfile === "function") {
          window.CYSupa.getProfile(user.id).then(function (p) {
            var name = (p && p.full_name) || "";
            if (name) paintNav(user, name);
          });
        }
      } catch (e) {}
      if (reloadPage && user && window.location.pathname.indexOf("/dashboard") === 0) {
        window.location.reload();
      }
    });
  }

  function init() {
    buildModal();
    /* Close the user menu on outside click / Escape. */
    document.addEventListener("click", function (e) {
      var menu = $("authMenu");
      if (menu && !menu.hidden) {
        var btn = $("loginBtn");
        if (btn && !btn.contains(e.target) && !menu.contains(e.target)) menu.hidden = true;
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal();
        var menu = $("authMenu");
        if (menu) menu.hidden = true;
      }
    });
    /* Signed-out by default until the session check returns. */
    paintNav(null);
    refreshNav(false);
    /* Open the modal when a page links here for sign-in (?auth=1). */
    try {
      if (window.location.search.indexOf("auth=1") !== -1) openModal();
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.CYAuth = {
    openModal: openModal,
    closeModal: closeModal,
    refresh: function () { refreshNav(false); },
    getUser: function () { return currentUser; }
  };
})();
