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
  /* F-12: the Supabase JS library is bundled locally (supabase-js.min.js,
     v2.45.4, sha256 96277ec00e19df476d7396a8a2586b41ed1033dcf680f5aa79b0c556059792b8)
     so no third-party script runs in the auth path and no CDN outage can
     break sign-in. The CDN is only a fallback if the local file fails. */
  var LOCAL_LIB = "/supabase-js.min.js";
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";

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
        s.src = LOCAL_LIB;
        s.async = true;
        s.onload = finish;
        s.onerror = function () {
          /* Local file failed (e.g. an old deploy) — fall back to the pinned CDN. */
          try {
            var c = document.createElement("script");
            c.src = CDN;
            c.async = true;
            c.onload = finish;
            c.onerror = finish;
            document.head.appendChild(c);
          } catch (e2) { finish(); }
        };
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
    /* Upsert: creates the row if the trigger has not (yet) made one.
       F-29: whitelist the columns — the caller cannot set id, email, or any
       other column by passing extra keys (mass assignment). */
    updateProfile: function (userId, email, fields) {
      return loadClient().then(function (c) {
        if (!c) return fail("Could not reach the server — check your connection and try again.");
        var ALLOWED = ["full_name", "date_of_birth", "qualification", "employment_status", "phone", "city", "target_subject"];
        var row = { id: userId, email: email };
        ALLOWED.forEach(function (k) {
          if (fields && Object.prototype.hasOwnProperty.call(fields, k)) row[k] = fields[k];
        });
        return c.from("profiles").upsert(row, { onConflict: "id" }).select().single()
          .then(function (r) { return r.error ? fail(r.error) : { ok: true, data: r.data }; })
          .catch(fail);
      });
    },

    /* ---------- Plan (per-subject, F-06) ----------
       The product is 'mocktests:<subject>' (e.g. 'mocktests:psychology'),
       one entitlement per subject at ₹249. The old single product
       'mocktests' no longer exists. */
    getEntitlement: function (userId, subject) {
      if (!subject) return Promise.resolve(null);
      return loadClient().then(function (c) {
        if (!c) return null;
        return c.from("entitlements").select("*")
          .eq("user_id", userId).eq("product", "mocktests:" + subject).eq("status", "active")
          .maybeSingle()
          .then(function (r) { return r.error ? null : (r.data || null); })
          .catch(function () { return null; });
      });
    },
    /* All active entitlements for the user (drives the dashboard plan card,
       which lists exactly which subjects are unlocked). */
    getEntitlements: function (userId) {
      return loadClient().then(function (c) {
        if (!c) return [];
        return c.from("entitlements").select("*")
          .eq("user_id", userId).eq("status", "active")
          .then(function (r) { return r.error ? [] : (r.data || []); })
          .catch(function () { return []; });
      });
    },

    /* ---------- Questions (server-side, F-01) ----------
       Fetches ONE set from the server (get_question_set) WITHOUT the answer
       keys. The server enforces the free/paid rule. Returns
       { ok, questions } or { ok:false, notEntitled:true } / { ok:false, error }. */
    getQuestionSet: function (subject, setNumber) {
      return loadClient().then(function (c) {
        if (!c) return { ok: false, error: "no-client" };
        return c.rpc("get_question_set", { p_subject: subject, p_set_number: setNumber })
          .then(function (r) {
            if (r.error) {
              var msg = String(r.error.message || "");
              if (/not entitled/i.test(msg)) return { ok: false, notEntitled: true };
              return { ok: false, error: msg };
            }
            return { ok: true, questions: r.data || [] };
          })
          .catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
      });
    },

    /* ---------- Server-side grading (F-03) ----------
       The browser never grades and never inserts a score. Answers go to
       submit_mock_attempt, which grades against the server-held keys,
       records a trusted attempt, and returns the score + the full review.
       A per-exam client key makes re-submission idempotent. */
    _clientKey: function () {
      try {
        if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
      } catch (e) {}
      return "k-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
    },
    submitMockAttempt: function (subject, setNumber, answers, durationSeconds, clientKey) {
      return loadClient().then(function (c) {
        if (!c) return { ok: false, error: "no-client" };
        return c.rpc("submit_mock_attempt", {
          p_subject: subject, p_set_number: setNumber,
          p_answers: answers, p_duration_seconds: durationSeconds,
          p_client_key: clientKey || api._clientKey()
        }).then(function (r) {
          if (r.error) return { ok: false, error: String(r.error.message || r.error) };
          return { ok: true, result: r.data };
        }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
      });
    },
    /* Quiz rounds: the client sends the DATA indices of the round questions
       and the chosen answers; the server grades against the stored
       most-probable set and records a trusted attempt. */
    submitQuizAttempt: function (mode, indices, chosen, durationSeconds, clientKey) {
      return loadClient().then(function (c) {
        if (!c) return { ok: false, error: "no-client" };
        return c.rpc("submit_quiz_attempt", {
          p_mode: mode, p_indices: indices, p_chosen: chosen,
          p_duration_seconds: durationSeconds,
          p_client_key: clientKey || api._clientKey()
        }).then(function (r) {
          if (r.error) return { ok: false, error: String(r.error.message || r.error) };
          return { ok: true, result: r.data };
        }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
      });
    },

    /* ---------- Account deletion (F-15) ----------
       Deletes the caller's own account server-side (delete_own_account).
       The client never deletes auth.users. */
    deleteAccount: function () {
      return loadClient().then(function (c) {
        if (!c) return fail("Could not reach the server — check your connection and try again.");
        return c.rpc("delete_own_account", {})
          .then(function (r) { return r.error ? fail(r.error) : { ok: true }; })
          .catch(fail);
      });
    },

    /* ---------- Attempts (read) ----------
       F-28: paginate so the dashboard sees the FULL history, not just the
       most recent 200 rows. Pages of 200, up to 2000 rows total (a safety
       cap so a very heavy user cannot stall the dashboard). */
    fetchAttempts: function (userId) {
      return loadClient().then(function (c) {
        if (!c) return [];
        var all = [];
        function page(from) {
          return c.from("test_attempts").select("*")
            .eq("user_id", userId).order("completed_at", { ascending: false })
            .range(from, from + 199)
            .then(function (r) {
              if (r.error || !r.data || r.data.length === 0) return all;
              all = all.concat(r.data);
              if (r.data.length < 200 || all.length >= 2000) return all;
              return page(from + 200);
            })
            .catch(function () { return all; });
        }
        return page(0);
      });
    }
  };

  window.CYSupa = api;
})();
