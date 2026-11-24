/* ChangeYourself — shared Supabase client.
   Loaded on every page that needs auth (injected by main.js on the small
   pages; explicit <script> tags on the mock-test app, quiz and dashboard).
   The Supabase JS client is loaded from the CDN lazily — only when
   something first needs it — so it never blocks page render. If the CDN
   is unreachable, every method below degrades silently (returns
   { ok: false }) and the site keeps working signed-out.
   Uses the publishable key (sb_publishable_...), NOT the legacy anon key
   (the dashboard warns legacy keys retire in early 2027). RLS on every
   table means the key alone can only ever read a user's own rows. */
(function () {
  "use strict";

  var SUPABASE_URL = "https://smwxlqawarlxtotyzcng.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Y7aiInKmSasJ3_LB8PWB3A_kx-irDn2";
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  /* ---------- Guarded storage shim ----------
     Same pattern as the rest of the site: localStorage when it works,
     an in-memory object when it doesn't (some phone webviews throw).
     Supabase needs getItem/setItem/removeItem; never call localStorage
     directly. */
  var mem = {};
  var lsOK = false;
  try {
    window.localStorage.setItem("__cy_probe__", "1");
    window.localStorage.removeItem("__cy_probe__");
    lsOK = true;
  } catch (e) { lsOK = false; }
  var store = {
    getItem: function (k) {
      if (lsOK) {
        try { var v = window.localStorage.getItem(k); if (v !== null) return v; } catch (e) {}
      }
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem: function (k, v) {
      mem[k] = String(v);
      if (lsOK) { try { window.localStorage.setItem(k, v); } catch (e) {} }
    },
    removeItem: function (k) {
      delete mem[k];
      if (lsOK) { try { window.localStorage.removeItem(k); } catch (e) {} }
    }
  };

  /* ---------- Lazy client ----------
     The client is created on first use. The promise is shared, so
     parallel callers all wait on the same load. */
  var clientPromise = null;
  function makeClient() {
    try {
      if (!window.supabase || !window.supabase.createClient) return null;
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          storage: store,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } catch (e) { return null; }
  }
  function loadClient() {
    if (clientPromise) return clientPromise;
    clientPromise = new Promise(function (resolve) {
      if (window.supabase && window.supabase.createClient) { resolve(makeClient()); return; }
      var done = false;
      function finish() { if (done) return; done = true; resolve(makeClient()); }
      try {
        var s = document.createElement("script");
        s.src = CDN;
        s.async = true;
        s.onload = finish;
        s.onerror = finish;
        document.head.appendChild(s);
      } catch (e) { finish(); return; }
      /* Never hang the page on a slow or blocked CDN. */
      setTimeout(finish, 8000);
    });
    return clientPromise;
  }

  function fail(err) { return { ok: false, error: err ? String(err.message || err) : "unknown error" }; }

  var api = {
    /* Promise that resolves to the client, or null if it could not load. */
    ready: loadClient(),

    /* Session / user — null when signed out or when auth is unavailable. */
    getSession: function () {
      return loadClient().then(function (c) {
        if (!c) return null;
        return c.auth.getSession().then(function (r) {
          if (r.error) return null;
          return r.data.session || null;
        }).catch(function () { return null; });
      });
    },
    getUser: function () {
      return api.getSession().then(function (s) { return s ? s.user : null; });
    },

    /* ---------- Sign-in ---------- */
    signInWithGoogle: function () {
      return loadClient().then(function (c) {
        if (!c) return fail("Sign-in could not load — check your connection and try again.");
        return c.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin + "/dashboard/" }
        }).then(function (r) {
          return r.error ? fail(r.error) : { ok: true };
        }).catch(fail);
      });
    },
    sendOtp: function (email) {
      return loadClient().then(function (c) {
        if (!c) return fail("Sign-in could not load — check your connection and try again.");
        return c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } })
          .then(function (r) { return r.error ? fail(r.error) : { ok: true }; })
          .catch(fail);
      });
    },
    verifyOtp: function (email, code) {
      return loadClient().then(function (c) {
        if (!c) return fail("Sign-in could not load — check your connection and try again.");
        return c.auth.verifyOtp({ email: email, token: code, type: "email" })
          .then(function (r) { return r.error ? fail(r.error) : { ok: true, user: r.data.user || null }; })
          .catch(fail);
      });
    },
    signOut: function () {
      return loadClient().then(function (c) {
        if (!c) return { ok: true };
        return c.auth.signOut().then(function () { return { ok: true }; }).catch(function () { return { ok: true }; });
      });
    },

    /* ---------- Profile ----------
       The profiles row is created automatically on signup by a trigger.
       Reads fall back to null (caller uses the auth user as fallback). */
    getProfile: function (userId) {
      return loadClient().then(function (c) {
        if (!c) return null;
        return c.from("profiles").select("*").eq("id", userId).maybeSingle()
          .then(function (r) { return r.error ? null : (r.data || null); })
          .catch(function () { return null; });
      });
    },
    /* Upsert: creates the row if the trigger has not (yet) made one. */
    updateProfile: function (userId, email, fields) {
      return loadClient().then(function (c) {
        if (!c) return fail("Could not reach the server — check your connection and try again.");
        var row = { id: userId, email: email };
        Object.keys(fields).forEach(function (k) { row[k] = fields[k]; });
        return c.from("profiles").upsert(row, { onConflict: "id" }).select().single()
          .then(function (r) { return r.error ? fail(r.error) : { ok: true, data: r.data }; })
          .catch(fail);
      });
    },

    /* ---------- Plan ---------- */
    getEntitlement: function (userId) {
      return loadClient().then(function (c) {
        if (!c) return null;
        return c.from("entitlements").select("*")
          .eq("user_id", userId).eq("product", "mocktests").eq("status", "active")
          .maybeSingle()
          .then(function (r) { return r.error ? null : (r.data || null); })
          .catch(function () { return null; });
      });
    },

    /* ---------- Attempts ----------
       Fire-and-forget: callers never await this for UI. A failed insert
       (offline, not signed in, RLS) is swallowed — it must never break
       a results screen. */
    recordAttempt: function (row) {
      return api.getSession().then(function (s) {
        if (!s || !s.user) return { ok: false, skipped: "signed-out" };
        return loadClient().then(function (c) {
          if (!c) return { ok: false, skipped: "no-client" };
          var r = {
            user_id: s.user.id,
            kind: row.kind,
            subject: row.subject,
            set_number: row.set_number === undefined ? null : row.set_number,
            score: row.score,
            total: row.total,
            correct: row.correct || 0,
            wrong: row.wrong || 0,
            skipped: row.skipped || 0,
            duration_seconds: row.duration_seconds === undefined ? null : row.duration_seconds
          };
          return c.from("test_attempts").insert(r)
            .then(function (res) { return res.error ? { ok: false, error: res.error.message } : { ok: true }; })
            .catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
        });
      }).catch(function () { return { ok: false, skipped: "error" }; });
    },
    fetchAttempts: function (userId) {
      return loadClient().then(function (c) {
        if (!c) return [];
        return c.from("test_attempts").select("*")
          .eq("user_id", userId).order("completed_at", { ascending: false }).limit(200)
          .then(function (r) { return r.error ? [] : (r.data || []); })
          .catch(function () { return []; });
      });
    }
  };

  window.CYSupa = api;
})();
