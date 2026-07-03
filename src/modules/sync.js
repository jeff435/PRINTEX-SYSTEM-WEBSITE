// ═══════════════════════════════════════════════════════════════════
// CLOUD SYNCHRONIZATION MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════


window.isSyncing = false;

// Helper to perform fetch requests authenticated by Firebase ID tokens, with a single-retry on 401.
window.authenticatedFetch = authenticatedFetch;
async function authenticatedFetch(url, options = {}) {
  let token;
  try {
    if (typeof window.getAuthToken === 'function') {
      token = await window.getAuthToken();
    } else {
      token = localStorage.getItem('token');
    }
  } catch (err) {
    console.error('[Sync] Cannot fetch, failed to get token:', err);
    throw err;
  }

  const makeHeaders = (tok) => {
    return Object.assign({}, options.headers || {}, {
      'Content-Type': 'application/json',
      'Authorization': tok ? 'Bearer ' + tok : ''
    });
  };

  const reqOptions = Object.assign({}, options, {
    headers: makeHeaders(token)
  });

  let res = await fetch(url, reqOptions);

  if (res.status === 401) {
    console.warn(`[Sync] Request to ${url} returned 401. Retrying with force-refreshed token...`);
    try {
      if (typeof window.getAuthToken === 'function') {
        token = await window.getAuthToken(true); // Force refresh
      } else if (window.fAuth && window.fAuth.currentUser) {
        token = await window.fAuth.currentUser.getIdToken(true);
        localStorage.setItem('token', token);
      }
      const retryOptions = Object.assign({}, options, {
        headers: makeHeaders(token)
      });
      res = await fetch(url, retryOptions);
    } catch (retryErr) {
      console.error('[Sync] Retry fetch failed after token refresh:', retryErr);
      throw retryErr;
    }
  }

  return res;
}

// Helper for Last-Write-Wins conflict resolution between local IndexedDB and incoming server data
async function resolveConflictAndSave(store, serverItem) {
  var id = store === 'settings' ? (serverItem.key || serverItem.id) : serverItem.id;
  if (!id) return false;

  var localItem;
  try {
    localItem = await window.dbGet(store, id, true);
  } catch (e) {
    console.warn(`[Sync] Failed to fetch local item ${store}/${id}:`, e);
  }

  if (!localItem) {
    await window.dbPutNoSync(store, serverItem);
    return true;
  }

  // If local item is marked as synced, we overwrite it safely
  if (localItem._synced) {
    await window.dbPutNoSync(store, serverItem);
    return true;
  }

  // If local item is unsynced, compare timestamps (Last-Write-Wins)
  var serverTime = parseInt(serverItem.updated_at || serverItem.updatedAt) || 0;
  var localTime = parseInt(localItem.updated_at || localItem.updatedAt) || 0;

  if (serverTime > localTime) {
    console.log(`[Sync] Conflict resolved (Server wins): Overwriting local unsynced edits for ${store}/${id} (server: ${serverTime}, local: ${localTime})`);
    await window.dbPutNoSync(store, serverItem);
    return true;
  } else {
    console.log(`[Sync] Conflict resolved (Local wins): Keeping local unsynced edits for ${store}/${id} (server: ${serverTime}, local: ${localTime})`);
    return false;
  }
}


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

window.getMailboxState = function(store) {
  var defaults = {
    parts: { name: 'INBOX.parts', uidValidity: 20260608, highestModSeq: 0, lastSync: 0 },
    invoices: { name: 'INBOX.invoices', uidValidity: 20260608, highestModSeq: 0, lastSync: 0 },
    settings: { name: 'INBOX.settings', uidValidity: 20260608, highestModSeq: 0, lastSync: 0 },
    activity: { name: 'INBOX.activity', uidValidity: 20260608, highestModSeq: 0, lastSync: 0 },
    submissions: { name: 'INBOX.submissions', uidValidity: 20260608, highestModSeq: 0, lastSync: 0 }
  };
  var stored = localStorage.getItem('printex_mailbox_' + store);
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  return defaults[store] || { name: 'INBOX.' + store, uidValidity: 20260608, highestModSeq: 0, lastSync: 0 };
};

window.saveMailboxState = function(store, state) {
  localStorage.setItem('printex_mailbox_' + store, JSON.stringify(state));
};

window.toggleSyncPanel = function(e) {
  if (e) e.stopPropagation();
  var panel = document.getElementById('syncStatusPanel');
  if (panel) {
    panel.classList.toggle('active');
  }
};

window.updateSyncPanelUI = async function() {
  var lastSyncText = 'Never';
  var lastSyncTime = 0;
  var stores = ['parts', 'invoices', 'settings', 'activity', 'submissions', 'categories', 'customers', 'suppliers', 'expenses', 'employees', 'purchases'];
  var counts = {};
  
  for (var i = 0; i < stores.length; i++) {
    var store = stores[i];
    var state = window.getMailboxState(store);
    if (state.lastSync > lastSyncTime) {
      lastSyncTime = state.lastSync;
    }
    
    if (typeof window.getMailboxStatus === 'function') {
      counts[store] = await window.getMailboxStatus(store);
    } else {
      counts[store] = { total: 0, unseen: 0, flagged: 0, deleted: 0 };
    }
  }
  
  if (lastSyncTime > 0) {
    lastSyncText = new Date(lastSyncTime).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  var panel = document.getElementById('syncStatusPanel');
  if (panel) {
    var html = `
      <div class="sync-status-header">
        <span>🔄 IMAP Sync Status</span>
        <button class="btn btn-xs" onclick="window.toggleSyncPanel(event)" style="background:transparent;border:none;color:var(--muted);padding:0;cursor:pointer"><i class="fa fa-times"></i></button>
      </div>
      <div class="sync-status-list" style="margin-top:8px">
    `;
    
    stores.forEach(function(store) {
      var state = window.getMailboxState(store);
      var count = counts[store];
      html += `
        <div class="sync-mailbox-row" style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px">
          <span class="sync-mailbox-name" style="font-family:var(--font-mono);color:var(--muted)">${state.name}</span>
          <span class="sync-mailbox-badge" style="background:var(--bg3);padding:2px 6px;border-radius:4px;font-weight:bold" title="Total / Unseen / Flagged / Deleted">
            ${count.total} <span style="color:var(--dim)">|</span> 
            <span style="color:${count.unseen > 0 ? 'var(--warn)' : 'var(--muted)'}">${count.unseen}</span> <span style="color:var(--dim)">|</span>
            <span style="color:${count.flagged > 0 ? 'var(--gold)' : 'var(--muted)'}">${count.flagged}</span> <span style="color:var(--dim)">|</span>
            <span style="color:${count.deleted > 0 ? 'var(--danger)' : 'var(--muted)'}">${count.deleted}</span>
          </span>
        </div>
      `;
    });
    
    html += `
      </div>
      <div class="sync-status-footer" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--dim)">
        <span>Last: ${lastSyncText}</span>
        <button class="btn btn-xs" onclick="window.triggerManualSync(); window.toggleSyncPanel(event);" style="padding:2px 8px;font-size:9px;background:var(--accent-glow);color:var(--accent);border:1px solid rgba(0,212,255,0.2);border-radius:4px;cursor:pointer">Sync Now</button>
      </div>
    `;
    panel.innerHTML = html;
  }
};

window.syncData = async function() {
  if (window.isSyncing) return;
  if (!window.db) return;

  // Ensure user is signed in before trying to sync
  if (!window.fAuth || !window.fAuth.currentUser) {
    console.log('[Sync] Skipped: No Firebase user signed in.');
    window.updateSyncStatus('offline');
    return;
  }

  window.isSyncing = true;
  window.updateSyncStatus('syncing');

  try {
    var stores = ['parts', 'invoices', 'settings', 'activity', 'submissions', 'categories', 'customers', 'suppliers', 'expenses', 'employees', 'purchases'];
    var currentSyncTime = Date.now();

    // 1. EXPUNGE (deleted items sync & hard delete)
    for (var s = 0; s < stores.length; s++) {
      var store = stores[s];
      var localData = await window.dbGet(store, undefined, true) || [];
      var softDeleted = localData.filter(function(x) { return x._deleted; });
      
      for (var i = 0; i < softDeleted.length; i++) {
        var record = softDeleted[i];
        var recordId = store === 'settings' ? (record.key || record.id) : record.id;
        try {
          console.log('[Sync] Expunging deleted item: ' + store + '/' + recordId);
          var delRes = await authenticatedFetch('/api/sync/delete', {
            method: 'POST',
            body: JSON.stringify({ store: store, id: recordId })
          });
          if (delRes.ok) {
            await new Promise(function(resolve, reject) {
              var tx = window.db.transaction(store, 'readwrite');
              var req = tx.objectStore(store).delete(recordId);
              req.onsuccess = function() { resolve(); };
              req.onerror = function() { reject(req.error); };
            });
          }
        } catch(e) {
          console.warn('[Sync] Failed to expunge record on server:', e);
        }
      }
    }

    // 2. PUSH (unsynced items)
    var localParts = await window.dbGet('parts') || [];
    var unsyncedParts = localParts.filter(function(p) { return !p._synced && !p._deleted; });

    var localInvoices = await window.dbGet('invoices') || [];
    var unsyncedInvoices = localInvoices.filter(function(i) { return !i._synced && !i._deleted; });

    var localSubmissions = await window.dbGet('submissions') || [];
    var unsyncedSubmissions = localSubmissions.filter(function(s) { return !s._synced && !s._deleted; });

    var localActivity = await window.dbGet('activity') || [];
    var unsyncedActivity = localActivity.filter(function(a) { return !a._synced && !a._deleted; });

    var localSettings = await window.dbGet('settings') || [];
    var unsyncedSettings = localSettings.filter(function(s) { return !s._synced && !s._deleted; });

    var localCategories = await window.dbGet('categories') || [];
    var unsyncedCategories = localCategories.filter(function(x) { return !x._synced && !x._deleted; });
    var localCustomers = await window.dbGet('customers') || [];
    var unsyncedCustomers = localCustomers.filter(function(x) { return !x._synced && !x._deleted; });
    var localSuppliers = await window.dbGet('suppliers') || [];
    var unsyncedSuppliers = localSuppliers.filter(function(x) { return !x._synced && !x._deleted; });
    var localExpenses = await window.dbGet('expenses') || [];
    var unsyncedExpenses = localExpenses.filter(function(x) { return !x._synced && !x._deleted; });
    var localEmployees = await window.dbGet('employees') || [];
    var unsyncedEmployees = localEmployees.filter(function(x) { return !x._synced && !x._deleted; });
    var localPurchases = await window.dbGet('purchases') || [];
    var unsyncedPurchases = localPurchases.filter(function(x) { return !x._synced && !x._deleted; });

    var totalUnsynced = unsyncedParts.length + unsyncedInvoices.length + unsyncedSubmissions.length + unsyncedActivity.length + unsyncedSettings.length + unsyncedCategories.length + unsyncedCustomers.length + unsyncedSuppliers.length + unsyncedExpenses.length + unsyncedEmployees.length + unsyncedPurchases.length;
    if (totalUnsynced > 0) {
      console.log('[Sync] Pushing ' + totalUnsynced + ' unsynced items across all stores.');
      var pushRes = await authenticatedFetch('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          parts: unsyncedParts,
          invoices: unsyncedInvoices,
          submissions: unsyncedSubmissions,
          activity: unsyncedActivity,
          settings: unsyncedSettings,
          categories: unsyncedCategories,
          customers: unsyncedCustomers,
          suppliers: unsyncedSuppliers,
          expenses: unsyncedExpenses,
          employees: unsyncedEmployees,
          purchases: unsyncedPurchases
        })
      });

      if (!pushRes.ok) throw new Error('Push failed: ' + pushRes.status);

      var markSynced = async function(storeN, arr) {
        for (var i = 0; i < arr.length; i++) {
          arr[i]._synced = true;
          await window.dbPutNoSync(storeN, arr[i]);
        }
      };
      await markSynced('parts', unsyncedParts);
      await markSynced('invoices', unsyncedInvoices);
      await markSynced('submissions', unsyncedSubmissions);
      await markSynced('activity', unsyncedActivity);
      await markSynced('settings', unsyncedSettings);
      await markSynced('categories', unsyncedCategories);
      await markSynced('customers', unsyncedCustomers);
      await markSynced('suppliers', unsyncedSuppliers);
      await markSynced('expenses', unsyncedExpenses);
      await markSynced('employees', unsyncedEmployees);
      await markSynced('purchases', unsyncedPurchases);
    }

    // 3. PULL (Delta pull with UIDVALIDITY checks)
    var lastSyncTime = Infinity;
    stores.forEach(function(store) {
      var state = window.getMailboxState(store);
      if (state.lastSync < lastSyncTime) {
        lastSyncTime = state.lastSync;
      }
    });
    if (lastSyncTime === Infinity) lastSyncTime = 0;

    console.log('[Sync] Pulling updates since ' + lastSyncTime);
    var pullRes = await authenticatedFetch('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ lastSyncTimestamp: lastSyncTime })
    });

    if (!pullRes.ok) throw new Error('Pull failed: ' + pullRes.status);

    var serverData = await pullRes.json();
    var hasNewData = false;

    // Check UIDVALIDITY mismatch
    if (serverData.uidValidity) {
      for (var s = 0; s < stores.length; s++) {
        var store = stores[s];
        var state = window.getMailboxState(store);
        var serverValidity = serverData.uidValidity[store];
        if (state.uidValidity !== serverValidity) {
          console.warn('[Sync] Mailbox UIDVALIDITY mismatch for ' + store + ': local=' + state.uidValidity + ', server=' + serverValidity + '. Resetting!');
          state.uidValidity = serverValidity;
          state.lastSync = 0;
          state.highestModSeq = 0;
          window.saveMailboxState(store, state);
          
          if (store !== 'parts') {
            var tx = window.db.transaction(store, 'readwrite');
            tx.objectStore(store).clear();
          }
          hasNewData = true;
        }
      }
    }

    if (serverData.parts && serverData.parts.length) {
      for (var i = 0; i < serverData.parts.length; i++) {
        var sp = serverData.parts[i];
        sp.stock = parseInt(sp.stock) || 0;
        sp.minStock = parseInt(sp.minStock) || 0;
        sp.priceKsh = parseFloat(sp.priceKsh || sp.price) || 0;
        sp._synced = true;
        sp._deleted = sp._deleted || false;
        if (await resolveConflictAndSave('parts', sp)) {
          hasNewData = true;
        }
      }
    }

    if (serverData.invoices && serverData.invoices.length) {
      for (var i = 0; i < serverData.invoices.length; i++) {
        var sinv = serverData.invoices[i];
        sinv._synced = true;
        sinv._deleted = sinv._deleted || false;
        if (typeof sinv.items === 'string') {
          try { sinv.items = JSON.parse(sinv.items); } catch(e) {}
        }
        if (await resolveConflictAndSave('invoices', sinv)) {
          hasNewData = true;
        }
      }
    }

    if (serverData.settings && serverData.settings.length) {
      for (var i = 0; i < serverData.settings.length; i++) {
        var sset = serverData.settings[i];
        sset._synced = true;
        sset._deleted = sset._deleted || false;
        if (typeof sset.value === 'string') {
          try { sset.value = JSON.parse(sset.value); } catch(e) {}
        }
        if (await resolveConflictAndSave('settings', sset)) {
          hasNewData = true;
        }
      }
    }

    if (serverData.activity && serverData.activity.length) {
      for (var i = 0; i < serverData.activity.length; i++) {
        var sact = serverData.activity[i];
        sact._synced = true;
        sact._deleted = sact._deleted || false;
        if (await resolveConflictAndSave('activity', sact)) {
          hasNewData = true;
        }
      }
    }

    if (serverData.submissions && serverData.submissions.length) {
      for (var i = 0; i < serverData.submissions.length; i++) {
        var ssub = serverData.submissions[i];
        ssub._synced = true;
        ssub._deleted = ssub._deleted || false;
        if (await resolveConflictAndSave('submissions', ssub)) {
          hasNewData = true;
        }
      }
    }

    // Pull new business stores (categories, customers, suppliers, expenses, employees, purchases)
    var newStores = ['categories', 'customers', 'suppliers', 'expenses', 'employees', 'purchases'];
    for (var ns = 0; ns < newStores.length; ns++) {
      var nsName = newStores[ns];
      if (serverData[nsName] && serverData[nsName].length) {
        for (var ni = 0; ni < serverData[nsName].length; ni++) {
          var nsItem = serverData[nsName][ni];
          nsItem._synced = true;
          nsItem._deleted = nsItem._deleted || false;
          if (await resolveConflictAndSave(nsName, nsItem)) {
            hasNewData = true;
          }
        }
      }
    }

    // Save sync state
    stores.forEach(function(store) {
      var state = window.getMailboxState(store);
      state.lastSync = currentSyncTime;
      window.saveMailboxState(store, state);
    });

    window.updateSyncStatus('synced');
    await window.updateSyncPanelUI();

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

window.syncHeartbeatTimer = null;
window.syncHeartbeatDelay = 15000;
window.syncFailureCount = 0;

window.startSyncHeartbeat = function() {
  if (window.syncHeartbeatTimer) clearTimeout(window.syncHeartbeatTimer);
  
  window.syncHeartbeatTimer = setTimeout(async function runHeartbeat() {
    try {
      if (navigator.onLine && window.db) {
        await window.syncData();
        window.syncFailureCount = 0;
        window.syncHeartbeatDelay = 15000;
      }
    } catch(e) {
      window.syncFailureCount++;
      window.syncHeartbeatDelay = Math.min(300000, window.syncHeartbeatDelay * 2);
      console.warn(`[Sync Heartbeat] Sync failed. Retrying in ${window.syncHeartbeatDelay / 1000}s. Error:`, e);
    }
    window.syncHeartbeatTimer = setTimeout(runHeartbeat, window.syncHeartbeatDelay);
  }, window.syncHeartbeatDelay);
};

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
    await window.initializeFirestoreListeners(user.uid);
    await window.syncData();
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

  try {
    const savedParts = await window.dbGet('parts') || [];
    const physicalParts = savedParts.filter(p => !p.isService);
    if (physicalParts.length > 0) {
      window.parts = savedParts;
    } else {
      console.log('[InitApp] No physical parts found in IndexedDB. Seeding defaults...');
      if (typeof window.seedDefaultParts === 'function') {
        await window.seedDefaultParts();
      } else {
        window.parts = window.DEFAULT_PARTS || [];
      }
    }
  } catch(e) {
    console.warn('[InitApp] Could not load parts:', e);
    window.parts = window.DEFAULT_PARTS || [];
  }

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

  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  if (typeof window.filterInventory === 'function') window.filterInventory();
  if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();

  if (typeof window.checkAndSeedServices === 'function') {
    try {
      await window.checkAndSeedServices();
    } catch(e) {
      console.error('[InitApp] Seeding professional services failed:', e);
    }
  }
  window.startSyncHeartbeat();
  window.updateSyncPanelUI();
};
