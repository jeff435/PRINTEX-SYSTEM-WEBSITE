// ═══════════════════════════════════════════════════════════════════
// CLOUD SYNCHRONIZATION MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════


window.isSyncing = false;


window.dbPutNoSync = function(store, value) {
  return new Promise(function(res, rej) {
    if (!window.db) return rej(new Error('Database not initialized'));
    var tx = window.db.transaction(store, 'readwrite');
    var req = tx.objectStore(store).put(value);
    req.onsuccess = function() { res(req.result); };
    req.onerror = function() { rej(req.error); };
  });
};

window.updateSyncStatus = function(status) {
  var dot = document.querySelector('.sync-dot');
  if (!dot) return;
  if (status === 'syncing') {
    dot.style.background = 'var(--warn)';
    dot.setAttribute('title', 'Syncing data to cloud...');
  } else if (status === 'synced') {
    dot.style.background = 'var(--success)';
    dot.setAttribute('title', 'All data synced with cloud database ✓');
  } else if (status === 'offline') {
    dot.style.background = 'var(--danger)';
    dot.setAttribute('title', 'Offline - changes will sync when connection returns');
  }
};

window.syncData = async function() {
  if (window.isSyncing) return;
  var token = localStorage.getItem('token');
  if (!token || !window.db) return;

  window.isSyncing = true;
  window.updateSyncStatus('syncing');

  try {
    var lastSyncTime = parseInt(localStorage.getItem('printex_last_sync') || '0');
    var currentSyncTime = Date.now();

    var localParts = await window.dbGet('parts') || [];
    var unsyncedParts = localParts.filter(function(p) { return !p._synced; });

    var localInvoices = await window.dbGet('invoices') || [];
    var unsyncedInvoices = localInvoices.filter(function(i) { return !i._synced; });

    var localSubmissions = await window.dbGet('submissions') || [];
    var unsyncedSubmissions = localSubmissions.filter(function(s) { return !s._synced; });

    var localActivity = await window.dbGet('activity') || [];
    var unsyncedActivity = localActivity.filter(function(a) { return !a._synced; });

    var localSettings = await window.dbGet('settings') || [];
    var unsyncedSettings = localSettings.filter(function(s) { return !s._synced; });

    if (unsyncedParts.length || unsyncedInvoices.length || unsyncedSubmissions.length || unsyncedActivity.length || unsyncedSettings.length) {
      console.log('[Sync] Pushing unsynced items: parts=' + unsyncedParts.length + ', invoices=' + unsyncedInvoices.length + ', submissions=' + unsyncedSubmissions.length);
      var pushRes = await fetch('/api/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          parts: unsyncedParts,
          invoices: unsyncedInvoices,
          submissions: unsyncedSubmissions,
          activity: unsyncedActivity,
          settings: unsyncedSettings
        })
      });

      if (!pushRes.ok) throw new Error('Push failed: ' + pushRes.status);

      for (var i = 0; i < unsyncedParts.length; i++) {
        var p = unsyncedParts[i]; p._synced = true; await window.dbPutNoSync('parts', p);
      }
      for (var i = 0; i < unsyncedInvoices.length; i++) {
        var inv = unsyncedInvoices[i]; inv._synced = true; await window.dbPutNoSync('invoices', inv);
      }
      for (var i = 0; i < unsyncedSubmissions.length; i++) {
        var sub = unsyncedSubmissions[i]; sub._synced = true; await window.dbPutNoSync('submissions', sub);
      }
      for (var i = 0; i < unsyncedActivity.length; i++) {
        var act = unsyncedActivity[i]; act._synced = true; await window.dbPutNoSync('activity', act);
      }
      for (var i = 0; i < unsyncedSettings.length; i++) {
        var s = unsyncedSettings[i]; s._synced = true; await window.dbPutNoSync('settings', s);
      }
    }

    console.log('[Sync] Pulling updates since ' + lastSyncTime);
    var pullRes = await fetch('/api/sync/pull', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ lastSyncTimestamp: lastSyncTime })
    });

    if (!pullRes.ok) throw new Error('Pull failed: ' + pullRes.status);

    var serverData = await pullRes.json();
    var hasNewData = false;

    if (serverData.parts && serverData.parts.length) {
      for (var i = 0; i < serverData.parts.length; i++) {
        var sp = serverData.parts[i];
        sp.stock = parseInt(sp.stock) || 0;
        sp.minStock = parseInt(sp.minStock) || 0;
        sp.priceKsh = parseFloat(sp.priceKsh || sp.price) || 0;
        sp._synced = true;
        await window.dbPutNoSync('parts', sp);
        hasNewData = true;
      }
    }

    if (serverData.invoices && serverData.invoices.length) {
      for (var i = 0; i < serverData.invoices.length; i++) {
        var sinv = serverData.invoices[i];
        sinv._synced = true;
        if (typeof sinv.items === 'string') {
          try { sinv.items = JSON.parse(sinv.items); } catch(e) {}
        }
        await window.dbPutNoSync('invoices', sinv);
        hasNewData = true;
      }
    }

    if (serverData.settings && serverData.settings.length) {
      for (var i = 0; i < serverData.settings.length; i++) {
        var sset = serverData.settings[i];
        sset._synced = true;
        if (typeof sset.value === 'string') {
          try { sset.value = JSON.parse(sset.value); } catch(e) {}
        }
        await window.dbPutNoSync('settings', sset);
        hasNewData = true;
      }
    }

    if (serverData.activity && serverData.activity.length) {
      for (var i = 0; i < serverData.activity.length; i++) {
        var sact = serverData.activity[i];
        sact._synced = true;
        await window.dbPutNoSync('activity', sact);
        hasNewData = true;
      }
    }

    if (serverData.submissions && serverData.submissions.length) {
      for (var i = 0; i < serverData.submissions.length; i++) {
        var ssub = serverData.submissions[i];
        ssub._synced = true;
        await window.dbPutNoSync('submissions', ssub);
        hasNewData = true;
      }
    }

    localStorage.setItem('printex_last_sync', String(currentSyncTime));
    window.updateSyncStatus('synced');

    if (hasNewData) {
      window.parts = await window.dbGet('parts') || [];
      window.invoices = await window.dbGet('invoices') || [];
      window.submissions = await window.dbGet('submissions') || [];
      window.activityLog = await window.dbGet('activity') || [];

      var settingsArr = await window.dbGet('settings') || [];
      window.settings = {};
      settingsArr.forEach(function(s) { window.settings[s.key] = s.value; });
      window.invoiceCounter = (await window.dbGet('settings','invoiceCounter'))?.value || 1;

      if (typeof window.applySettings === 'function') window.applySettings();
      if (typeof window.renderInventory === 'function') window.renderInventory();
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
      if (typeof window.renderReports === 'function') window.renderReports();
      if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
      if (typeof window.renderFreelancePage === 'function') window.renderFreelancePage();

      window.showToast('🔄 Real-time data synchronized successfully!', 'success');
    }
  } catch(err) {
    console.error('[Sync] Sync failure:', err);
    window.updateSyncStatus('offline');
  } finally {
    window.isSyncing = false;
  }
};

window.syncTimeout = null;
window.triggerDelayedSync = function() {
  if (window.syncTimeout) clearTimeout(window.syncTimeout);
  window.syncTimeout = setTimeout(function() {
    window.syncData();
  }, 1500);
};

// Deprecated periodic sync polling; real-time sync is handled via Firestore listeners.

window.triggerManualSync = async function() {
  if (!navigator.onLine) {
    window.showToast('📶 Internet offline. Changes will save locally.', 'warn');
    window.updateSyncStatus('offline');
    return;
  }

  const user = window.fAuth ? window.fAuth.currentUser : null;
  if (!user || !window.fDb) {
    window.updateSyncStatus('offline');
    window.showToast('⚠️ Cloud Sync unavailable. Using local-only mode.', 'warn');
    return;
  }

  window.updateSyncStatus('syncing');
  window.showToast('🔄 Synchronizing Google Cloud inventory...', 'info');

  try {
    // Await full sync completion including any reseeding before updating status
    await window.initializeFirestoreListeners(user.uid);
    
    window.updateSyncStatus('synced');
    window.showToast('☁️ Cloud synchronization complete across all devices!', 'success');
  } catch(e) {
    console.error('[Manual Sync] Failure:', e);
    window.updateSyncStatus('offline');
    window.showToast('❌ Sync failure: ' + e.message, 'error');
  }
};

window.initApp = async function() {
  try {
    await window.openDB();
    console.log('[InitApp] IndexedDB opened successfully.');
  } catch(e) {
    console.error('[InitApp] IndexedDB failed to open:', e);
  }

  // ── VERSION-BASED FORCE RESET ──
  // When DEFAULT_PARTS count changes (new parts added), force-reseed the database
  const PARTS_VERSION = 'v3_436parts';
  const currentVersion = localStorage.getItem('printex_parts_version_local');

  if (currentVersion !== PARTS_VERSION && typeof window.DEFAULT_PARTS !== 'undefined' && window.dbPut) {
    console.log('[InitApp] Local parts version changed! Force-reseeding IndexedDB with', window.DEFAULT_PARTS.length, 'parts...');
    try {
      // Clear old parts from IndexedDB
      if (typeof window.dbClear === 'function') {
        await window.dbClear('parts');
      }

      // Seed ALL default parts into the database
      window.parts = [];
      for (const dp of window.DEFAULT_PARTS) {
        const part = { ...dp, image: null };
        await window.dbPut('parts', part);
        window.parts.push(part);
      }

      localStorage.setItem('printex_parts_version_local', PARTS_VERSION);
      console.log('[InitApp] Successfully seeded IndexedDB with', window.parts.length, 'parts!');

      if (typeof window.showToast === 'function') {
        window.showToast('✅ Inventory updated: ' + window.parts.length + ' spare parts loaded!', 'success');
      }
    } catch(e) {
      console.error('[InitApp] Force-reseed failed:', e);
    }
  } else {
    // Normal load from database
    try {
      const savedParts = await window.dbGet('parts') || [];
      if (savedParts.length >= 400) {
        window.parts = savedParts;
      } else if (typeof window.DEFAULT_PARTS !== 'undefined' && window.DEFAULT_PARTS.length > 0) {
        // Version key said DB was populated but IndexedDB is empty/incomplete.
        // This happens when the browser wipes IndexedDB (storage pressure, private mode, etc.).
        // Self-heal: reseed now so the user never sees zero parts.
        console.log('[InitApp] Version key present but parts count < 400 (' + savedParts.length + '). Self-healing reseed...');
        try {
          window.parts = [];
          for (const dp of window.DEFAULT_PARTS) {
            const part = { ...dp, image: null };
            await window.dbPut('parts', part);
            window.parts.push(part);
          }
          localStorage.setItem('printex_parts_version_local', PARTS_VERSION);
          console.log('[InitApp] Self-heal complete: ' + window.parts.length + ' parts loaded.');
          if (typeof window.showToast === 'function') {
            window.showToast('✅ Inventory restored: ' + window.parts.length + ' parts loaded!', 'success');
          }
        } catch(reseedErr) {
          console.error('[InitApp] Self-heal reseed failed:', reseedErr);
          // Fallback: at least show parts from memory even if IDB write failed
          window.parts = window.DEFAULT_PARTS.map(dp => ({ ...dp, image: null }));
        }
      } else if (savedParts.length > 0) {
        window.parts = savedParts;
      }
    } catch(e) {
      console.warn('[InitApp] Could not load parts:', e);
    }
  }

  // Load other data normally
  try {
    const savedInvoices = await window.dbGet('invoices') || [];
    const savedSubmissions = await window.dbGet('submissions') || [];
    const savedActivity = await window.dbGet('activity') || [];
    const savedSettings = await window.dbGet('settings') || [];

    if (savedInvoices.length > 0) window.invoices = savedInvoices;
    if (savedSubmissions.length > 0) window.submissions = savedSubmissions;
    if (savedActivity.length > 0) window.activityLog = savedActivity;
    if (savedSettings.length > 0) {
      window.settings = {};
      savedSettings.forEach(s => window.settings[s.key] = s.value);
      window.invoiceCounter = (await window.dbGet('settings','invoiceCounter'))?.value || 1;
    }

    console.log('[InitApp] Loaded: ' + window.parts.length + ' parts, ' + window.invoices.length + ' invoices, ' + window.submissions.length + ' submissions');
  } catch(e) {
    console.warn('[InitApp] Could not pre-load data:', e);
  }

  if (typeof window.applySettings === 'function') {
    try { window.applySettings(); } catch(e) {}
  }

  if (typeof window.checkLogin === 'function') {
    try { window.checkLogin(); } catch(e) {}
  }

  // Render everything
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  if (typeof window.filterInventory === 'function') window.filterInventory();
  if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();
};


