/* ChangeYourself — shared site JS (Home, About, Pricing only).
   The mock-tests app at /changexed/mock-tests/ is a standalone file and does not load this. */
(function () {
  "use strict";

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
