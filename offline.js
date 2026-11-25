/* ChangeYourself offline engine (2026-11-25) — IndexedDB + service worker.
 *
 * What it does:
 *  - Downloads mock-test packages (questions WITHOUT answer keys or
 *    explanations — the server strips them in get_offline_package, and the
 *    download is rejected server-side unless the signed-in user is entitled
 *    to that subject/set).
 *  - Stores packages and attempt answers in IndexedDB (packages +
 *    attempts stores). Attempts autosave while you take a test offline.
 *  - Syncs pending attempts when you are back online: the answers go to
 *    submit_offline_mock_attempt, which checks the package version, then
 *    grades with the existing server-side grading. Idempotent via the
 *    client key — a retry never creates a duplicate attempt.
 *
 * Honesty rules built in:
 *  - An offline attempt is NEVER shown as a verified score. Until the
 *    server grades it, the result screen says "pending sync".
 *  - Offline attempts do NOT affect rankings until verified (the
 *    leaderboard only reads server-verified attempts).
 *  - A package whose version no longer matches the server bank is rejected
 *    at sync ("package outdated") — never graded against different
 *    questions. The attempt record is kept and shown, never silently
 *    discarded.
 *  - The exam timer re-anchors to the device clock (see timeLeft in the
 *    mock app): if the clock jumps, the exam still ends at its scheduled
 *    time. Offline timing is therefore practice timing, not proctored.
 *
 * Storage: guarded — if IndexedDB is unavailable (some webviews), every
 * method rejects with a clear message and the app falls back to online-only.
 */
(function () {
  var DB_NAME = 'cy-offline-v1';
  var DB_VERSION = 1;
  var PKG_STORE = 'packages';
  var ATTEMPT_STORE = 'attempts';

  function supported() {
    try { return !!(window.indexedDB && window.IDBKeyRange); } catch (e) { return false; }
  }
  function isOnline() {
    try { return navigator.onLine !== false; } catch (e) { return true; }
  }
  function uuid() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) {}
    return 'k-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
  }
  function pkgId(subject, setNumber) { return subject + ':' + setNumber; }

  /* --- IndexedDB helpers (promise-wrapped) --- */
  var dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!supported()) { reject(new Error('Offline storage is not available on this device or browser.')); return; }
      var req;
      try { req = window.indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(PKG_STORE)) db.createObjectStore(PKG_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(ATTEMPT_STORE)) db.createObjectStore(ATTEMPT_STORE, { keyPath: 'client_key' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open offline storage.')); };
      req.onblocked = function () { reject(new Error('Offline storage is blocked — close other tabs using this site and try again.')); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }
  function tx(store, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = db.transaction(store, mode); } catch (e) { reject(e); return; }
        var s = t.objectStore(store);
        var out;
        try { out = fn(s); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error || new Error('Offline storage failed.')); };
        t.onabort = function () { reject(t.error || new Error('Offline storage was aborted.')); };
      });
    });
  }
  function put(store, value) {
    return tx(store, 'readwrite', function (s) { s.put(value); return value; });
  }
  function get(store, key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error('Offline storage read failed.')); };
      });
    });
  }
  function all(store) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error || new Error('Offline storage read failed.')); };
      });
    });
  }
  function del(store, key) {
    return tx(store, 'readwrite', function (s) { s.delete(key); });
  }

  /* --- Packages --- */
  var downloadCancelled = false;
  function cancelDownload() { downloadCancelled = true; }

  function downloadPackage(subject, setNumber) {
    downloadCancelled = false;
    if (!window.CYSupa || !window.CYSupa.getOfflinePackage) {
      return Promise.reject(new Error('Offline downloads need the app to be online and signed in.'));
    }
    return window.CYSupa.getSession().then(function (session) {
      if (!session || !session.user) throw new Error('Sign in to download a test for offline use.');
      return window.CYSupa.getOfflinePackage(subject, setNumber);
    }).then(function (res) {
      if (!res || !res.ok) {
        if (res && res.signInRequired) throw new Error('Sign in to download a test for offline use.');
        if (res && res.notEntitled) throw new Error('This test is part of the paid plan — unlock it first, then download it.');
        throw new Error((res && res.error) || 'Could not download this test.');
      }
      if (downloadCancelled) throw new Error('Download cancelled.');
      var p = res.package;
      var now = Date.now();
      var row = {
        id: pkgId(subject, setNumber),
        subject: subject, set_number: setNumber,
        total_q: p.total_q, time_min: p.time_min, p1_count: p.p1_count,
        package_version: p.package_version, package_md5: p.package_md5,
        expires_days: p.expires_days || 30,
        questions: p.questions || [],
        downloaded_at: now,
        expires_at: now + (p.expires_days || 30) * 86400 * 1000,
        size_bytes: 0
      };
      try { row.size_bytes = new Blob([JSON.stringify(row.questions)]).size; } catch (e) {
        try { row.size_bytes = JSON.stringify(row.questions).length; } catch (e2) { row.size_bytes = 0; }
      }
      return put(PKG_STORE, row).then(function () { return row; });
    });
  }
  function getPackage(subject, setNumber) { return get(PKG_STORE, pkgId(subject, setNumber)); }
  function listPackages() {
    return all(PKG_STORE).then(function (rows) {
      return rows.map(function (r) {
        return { id: r.id, subject: r.subject, set_number: r.set_number, total_q: r.total_q,
          time_min: r.time_min, package_version: r.package_version, package_md5: r.package_md5,
          downloaded_at: r.downloaded_at, expires_at: r.expires_at, size_bytes: r.size_bytes };
      }).sort(function (a, b) { return b.downloaded_at - a.downloaded_at; });
    });
  }
  function removePackage(subject, setNumber) { return del(PKG_STORE, pkgId(subject, setNumber)); }
  function packageExpired(pkg) {
    if (!pkg) return true;
    return Date.now() > (pkg.expires_at || 0);
  }

  /* --- Attempts --- */
  function saveAttempt(attempt) {
    var now = Date.now();
    var row = {
      client_key: attempt.client_key,
      subject: attempt.subject, set_number: attempt.set_number,
      package_version: attempt.package_version, package_md5: attempt.package_md5,
      answers: attempt.answers || [], marked: attempt.marked || [],
      started_at: attempt.started_at || now,
      duration_seconds: attempt.duration_seconds || 0,
      status: attempt.status || 'in-progress',
      fail_reason: attempt.fail_reason || null,
      server_result: attempt.server_result || null,
      created_at: attempt.created_at || now, updated_at: now
    };
    return put(ATTEMPT_STORE, row);
  }
  function getAttempt(clientKey) { return get(ATTEMPT_STORE, clientKey); }
  function listAttempts() {
    return all(ATTEMPT_STORE).then(function (rows) {
      return rows.sort(function (a, b) { return b.updated_at - a.updated_at; });
    });
  }
  function listPendingAttempts() {
    return listAttempts().then(function (rows) {
      return rows.filter(function (r) { return r.status === 'pending' || r.status === 'in-progress'; });
    });
  }
  function setAttemptStatus(clientKey, status, extra) {
    return getAttempt(clientKey).then(function (a) {
      if (!a) return null;
      a.status = status;
      if (extra) for (var k in extra) a[k] = extra[k];
      return saveAttempt(a);
    });
  }
  function markSynced(clientKey, serverResult) {
    return setAttemptStatus(clientKey, 'synced', { server_result: serverResult || null });
  }
  function markFailed(clientKey, reason) {
    return setAttemptStatus(clientKey, 'failed', { fail_reason: reason || 'Sync failed.' });
  }
  function removeAttempt(clientKey) { return del(ATTEMPT_STORE, clientKey); }

  /* Sync: upload pending attempts oldest-first. Idempotent — the same
     client key can be retried safely; the server returns the stored
     result instead of recording a duplicate. Terminal failures
     (outdated package, entitlement lost) are marked failed and KEPT
     visible, never silently discarded. Retryable failures (offline,
     sign-in needed, server error) stay pending. */
  function syncPendingAttempts() {
    if (!isOnline()) {
      return listPendingAttempts().then(function (p) {
        return { ok: false, error: 'You are offline — attempts will sync when you are back online.', synced: 0, failed: 0, stillPending: p.length };
      });
    }
    if (!window.CYSupa || !window.CYSupa.submitOfflineMockAttempt) {
      return Promise.resolve({ ok: false, error: 'Sync is unavailable right now.', synced: 0, failed: 0, stillPending: 0 });
    }
    return listPendingAttempts().then(function (pending) {
      pending.sort(function (a, b) { return a.created_at - b.created_at; });
      var synced = 0, failed = 0;
      var chain = Promise.resolve();
      pending.forEach(function (a) {
        chain = chain.then(function () {
          return setAttemptStatus(a.client_key, 'syncing').then(function () {
            return window.CYSupa.submitOfflineMockAttempt(
              a.subject, a.set_number, a.answers, a.duration_seconds, a.client_key, a.package_md5
            );
          }).then(function (res) {
            if (res && res.ok) { synced++; return markSynced(a.client_key, res.result); }
            if (res && res.outdated) { failed++; return markFailed(a.client_key, 'This package is outdated — the question bank changed. Redownload the test and retake it.'); }
            if (res && res.notEntitled) { failed++; return markFailed(a.client_key, 'Access to this subject was removed — this attempt cannot be verified.'); }
            /* sign-in required, network error, server error: retryable — stay pending. */
            return setAttemptStatus(a.client_key, 'pending');
          }).catch(function () {
            return setAttemptStatus(a.client_key, 'pending');
          });
        });
      });
      return chain.then(function () {
        return listPendingAttempts().then(function (still) {
          return { ok: true, synced: synced, failed: failed, stillPending: still.length };
        });
      });
    });
  }

  /* --- Storage usage --- */
  function storageUsage() {
    return listPackages().then(function (pkgs) {
      var bytes = 0;
      pkgs.forEach(function (p) { bytes += p.size_bytes || 0; });
      var est = { used: null, quota: null };
      if (navigator.storage && navigator.storage.estimate) {
        return navigator.storage.estimate().then(function (e) {
          return { used: e.usage || null, quota: e.quota || null, packagesBytes: bytes, packages: pkgs.length };
        }).catch(function () { return { used: null, quota: null, packagesBytes: bytes, packages: pkgs.length }; });
      }
      return { used: null, quota: null, packagesBytes: bytes, packages: pkgs.length };
    });
  }

  /* --- Service worker (app shell only — never question data) --- */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(false);
    try {
      return navigator.serviceWorker.register('/sw.js').then(function () { return true; })
        .catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  window.CYOffline = {
    supported: supported, isOnline: isOnline, uuid: uuid,
    registerServiceWorker: registerServiceWorker,
    downloadPackage: downloadPackage, cancelDownload: cancelDownload,
    getPackage: getPackage, listPackages: listPackages,
    removePackage: removePackage, packageExpired: packageExpired,
    saveAttempt: saveAttempt, getAttempt: getAttempt,
    listAttempts: listAttempts, listPendingAttempts: listPendingAttempts,
    markSynced: markSynced, markFailed: markFailed, removeAttempt: removeAttempt,
    syncPendingAttempts: syncPendingAttempts, storageUsage: storageUsage
  };
})();
