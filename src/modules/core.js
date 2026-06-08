// ═══════════════════════════════════════════════════════════════════
// CORE SYSTEM MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════


// Initialize Firebase Config from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBl7ibytagjUQUctJA_umM2gQ5Z5WoPWlg",
  authDomain: "gen-lang-client-0648830639.firebaseapp.com",
  projectId: "gen-lang-client-0648830639",
  storageBucket: "gen-lang-client-0648830639.firebasestorage.app",
  messagingSenderId: "374291148055",
  appId: "1:374291148055:web:b0b1c12fd10b75f5129b52"
};

function isPlaceholderConfig(config) {
  if (!config || !config.apiKey) return true;
  const key = config.apiKey;
  return key === "" || 
         key.includes("YOUR_") || 
         key.includes("<YOUR") || 
         key.includes("placeholder") || 
         key.startsWith("AIzaSy...Placeholder") || 
         config.projectId === "YOUR_PROJECT_ID" ||
         config.projectId === "";
}

const firebaseDisabled = isPlaceholderConfig(firebaseConfig);

if (!firebaseDisabled && typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.fAuth = (!firebaseDisabled && typeof firebase !== 'undefined') ? firebase.auth() : null;
window.fDb = null;

if (!firebaseDisabled && typeof firebase !== 'undefined') {
  try {
    // Try named database instance first
    window.fDb = firebase.app().firestore("ai-studio-17572275-a7ee-4258-9b42-e6c17c3694d8");
  } catch (e) {
    console.warn("[Firebase] Could not initialize named Firestore database. Falling back to default instance...", e);
    try {
      window.fDb = firebase.firestore();
    } catch (err) {
      console.error("[Firebase] Firestore initialization failed:", err);
    }
  }
}

if (window.fDb) {
  // Enable Firestore offline persistence for simpler and bulletproof multi-device offline sync
  window.fDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn("Firestore persistence enable failed:", err.code);
  });
}

// Global variables shared across modules
window.parts = [];
window.invoices = [];
window.submissions = [];
window.settings = {};
window.activityLog = [];
window.lineItems = [];
window.invoiceCounter = 1;
window.catChart = null;
window.trendChart = null;
window.currentTheme = 'dark';
window.currentUser = null;

window.db = null;
window.tabSessionId = 'tab_' + Math.random().toString(36).substring(2, 9);

// ── INDEXEDDB SETUP ──────────────────────────────────────────────
window.openDB = function() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('PrintexDB', 4);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('parts')) d.createObjectStore('parts', {keyPath:'id'});
      if (!d.objectStoreNames.contains('invoices')) d.createObjectStore('invoices', {keyPath:'id'});
      if (!d.objectStoreNames.contains('submissions')) d.createObjectStore('submissions', {keyPath:'id'});
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', {keyPath:'key'});
      if (!d.objectStoreNames.contains('activity')) d.createObjectStore('activity', {keyPath:'id'});
    };
    req.onsuccess = e => { window.db = e.target.result; res(window.db); };
    req.onerror = () => rej(req.error);
  });
};

window.dbGet = function(store, key, includeDeleted) {
  return new Promise((resolve, reject) => {
    const filterDeleted = (res) => {
      if (includeDeleted) return res;
      if (Array.isArray(res)) {
        return res.filter(x => !x._deleted);
      }
      if (res && res._deleted) return null;
      return res;
    };

    const handleFallback = () => {
      try {
        const localData = localStorage.getItem('printex_fallback_' + store);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (key !== undefined) {
            const item = parsed.find(x => String(store === 'settings' ? x.key : x.id) === String(key));
            return resolve(filterDeleted(item || null));
          }
          return resolve(filterDeleted(parsed));
        }
      } catch (err) {
        console.warn(`[dbGet Fallback] LocalStorage fallback read failed for store ${store}:`, err);
      }
      if (key !== undefined) return resolve(null);
      if (store === 'parts') return resolve(filterDeleted(window.DEFAULT_PARTS || []));
      return resolve([]);
    };

    if (!window.db) {
      window.openDB().then(db => {
        const tx = db.transaction(store, 'readonly');
        const req = key !== undefined ? tx.objectStore(store).get(key) : tx.objectStore(store).getAll();
        req.onsuccess = () => {
          if (key === undefined && (!req.result || req.result.length === 0)) {
            handleFallback();
          } else if (key !== undefined && !req.result) {
            handleFallback();
          } else {
            resolve(filterDeleted(req.result));
          }
        };
        req.onerror = () => handleFallback();
      }).catch(() => handleFallback());
      return;
    }

    try {
      const tx = window.db.transaction(store, 'readonly');
      const req = key !== undefined ? tx.objectStore(store).get(key) : tx.objectStore(store).getAll();
      req.onsuccess = () => {
        if (key === undefined && (!req.result || req.result.length === 0)) {
          handleFallback();
        } else if (key !== undefined && !req.result) {
          handleFallback();
        } else {
          resolve(filterDeleted(req.result));
        }
      };
      req.onerror = () => handleFallback();
    } catch (e) {
      handleFallback();
    }
  });
};

window.triggerSyncBroadcast = function(store) {
  localStorage.setItem('printex_db_sync', JSON.stringify({
    store: store,
    timestamp: Date.now(),
    senderId: window.tabSessionId
  }));
};

// Real-time tab/device synchronization listener
window.addEventListener('storage', async (e) => {
  if (e.key === 'printex_db_sync' && e.newValue) {
    try {
      const syncData = JSON.parse(e.newValue);
      if (syncData.senderId !== window.tabSessionId) {
        console.log(`[Sync] Real-time database update detected from another tab/device. Store: ${syncData.store}`);
        
        window.parts = await window.dbGet('parts') || [];
        window.invoices = await window.dbGet('invoices') || [];
        window.submissions = await window.dbGet('submissions') || [];
        window.activityLog = await window.dbGet('activity') || [];
        
        const settingsArr = await window.dbGet('settings') || [];
        window.settings = {};
        settingsArr.forEach(s => window.settings[s.key] = s.value);
        window.invoiceCounter = (await window.dbGet('settings','invoiceCounter'))?.value || 1;

        if (typeof window.applySettings === 'function') window.applySettings();
        if (typeof window.renderInventory === 'function') window.renderInventory();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
        if (typeof window.renderReports === 'function') window.renderReports();
        if (typeof window.renderLineItems === 'function') window.renderLineItems();
        if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if (typeof window.renderFreelancePage === 'function') window.renderFreelancePage();
        
        window.showToast('🔄 Real-time data synchronized across Printex organization!', 'success');
      }
    } catch(err) {
      console.error('[Sync] Real-time synchronization error:', err);
    }
  }
});
window.dbPut = function(store, value) {
  if (store === 'parts') {
    if (!value.id) value.id = 'prt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'invoices') {
    if (!value.id) value.id = 'inv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'activity') {
    if (!value.id) value.id = 'act_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'submissions') {
    if (!value.id) value.id = 'del_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'settings') {
    if (!value.key) value.key = String(value.id);
  }

  // IMAP-style flags
  value._seen = value._seen !== undefined ? value._seen : true;
  value._deleted = value._deleted !== undefined ? value._deleted : false;
  value._flagged = value._flagged !== undefined ? value._flagged : false;
  value._draft = value._draft !== undefined ? value._draft : false;
  value._modSeq = value._modSeq || 0;

  value._synced = false;
  value._lastUpdated = Date.now();

  const user = window.fAuth ? window.fAuth.currentUser : null;
  if (user && window.fDb) {
    value.ownerId = user.uid; // Always inject ownerId
    const docId = store === 'settings' ? String(value.key) : String(value.id);
    const docRef = window.fDb.collection(`users/${user.uid}/${store}`).doc(docId);
    
    const cleanedValue = Object.assign({}, value);
    cleanedValue._synced = true; // Synced once written/listened from Firestore
    if (store === 'invoices' && Array.isArray(cleanedValue.items)) {
      cleanedValue.items = JSON.stringify(cleanedValue.items);
    }
    
    window.updateSyncStatus('syncing');
    docRef.set(cleanedValue, { merge: true }).then(() => {
      window.updateSyncStatus('synced');
    }).catch(err => {
      console.warn("[Firestore] Offline save queued:", err);
      window.updateSyncStatus('offline');
    });
  }

  // Backup to localStorage fallback asynchronously to never block the main thread
  setTimeout(async () => {
    try {
      if (window.db) {
        const tx = window.db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            localStorage.setItem('printex_fallback_' + store, JSON.stringify(req.result));
          }
        };
      }
    } catch (e) {
      console.warn(`[dbPut Fallback Update] Failed to update localStorage fallback for ${store}:`, e);
    }
  }, 100);

  return new Promise((res, rej) => {
    if (!window.db) return res(store === 'settings' ? value.key : value.id);
    const tx = window.db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => {
      window.triggerSyncBroadcast(store);
      res(req.result);
    };
    req.onerror = () => rej(req.error);
  });
};

window.dbDelete = function(store, key) {
  const user = window.fAuth ? window.fAuth.currentUser : null;
  if (user && window.fDb) {
    const docRef = window.fDb.collection(`users/${user.uid}/${store}`).doc(String(key));
    window.updateSyncStatus('syncing');
    docRef.delete().then(() => {
      window.updateSyncStatus('synced');
    }).catch(err => {
      console.warn("[Firestore] Offline delete queued:", err);
      window.updateSyncStatus('offline');
    });
  }

  // Backup to localStorage fallback asynchronously
  setTimeout(async () => {
    try {
      if (window.db) {
        const tx = window.db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => {
          if (req.result) {
            localStorage.setItem('printex_fallback_' + store, JSON.stringify(req.result));
          }
        };
      }
    } catch (e) {
      console.warn(`[dbDelete Fallback Update] Failed to update localStorage fallback for ${store}:`, e);
    }
  }, 100);

  return new Promise(async (res, rej) => {
    if (!window.db) return res();
    try {
      const record = await new Promise((resolve) => {
        const tx = window.db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (record) {
        record._deleted = true;
        record._synced = false;
        record._lastUpdated = Date.now();
        
        const tx = window.db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(record);
        req.onsuccess = () => {
          window.triggerSyncBroadcast(store);
          if (typeof window.triggerDelayedSync === 'function') {
            window.triggerDelayedSync();
          }
          res();
        };
        req.onerror = () => rej(req.error);
      } else {
        res();
      }
    } catch (e) {
      rej(e);
    }
  });
};

window.dbFlagRecord = async function(store, id, flag, value) {
  try {
    const record = await new Promise((resolve, reject) => {
      if (!window.db) return reject(new Error('IndexedDB not initialized'));
      const tx = window.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (record) {
      record[flag] = value;
      record._synced = false;
      record._lastUpdated = Date.now();
      await window.dbPut(store, record);
      return true;
    }
  } catch(e) {
    console.error(`[dbFlagRecord] Failed to flag record in ${store}/${id}:`, e);
  }
  return false;
};

window.getMailboxStatus = async function(store) {
  try {
    const records = await new Promise((resolve) => {
      if (!window.db) return resolve([]);
      const tx = window.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const total = records.filter(r => !r._deleted).length;
    const unseen = records.filter(r => !r._seen && !r._deleted).length;
    const flagged = records.filter(r => r._flagged && !r._deleted).length;
    const deleted = records.filter(r => r._deleted).length;

    return { total, unseen, flagged, deleted };
  } catch(e) {
    console.error(`[getMailboxStatus] Error for ${store}:`, e);
    return { total: 0, unseen: 0, flagged: 0, deleted: 0 };
  }
};

window.dbClear = function(store) {
  const user = window.fAuth ? window.fAuth.currentUser : null;
  let firestorePromise = Promise.resolve();
  
  if (user && window.fDb) {
    firestorePromise = window.fDb.collection(`users/${user.uid}/${store}`).get().then(async (snapshot) => {
      if (snapshot.size === 0) return;
      let batch = window.fDb.batch();
      let count = 0;
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = window.fDb.batch();
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      console.log(`[Firestore] Collection ${store} cleared successfully for user ${user.uid}`);
    }).catch(err => {
      console.warn(`[Firestore] Clear collection ${store} failed:`, err);
    });
  }

  const idbPromise = new Promise((res, rej) => {
    if (!window.db) return res();
    const tx = window.db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => {
      window.triggerSyncBroadcast(store);
      res();
    };
    req.onerror = () => rej(req.error);
  });

  return Promise.all([firestorePromise, idbPromise]);
};

// ── DEBOUNCED DB PUT FOR RAPID WRITES ────────────────────────────
const _dbPutTimers = {};
window.debouncedDbPut = function(store, value, delayMs = 300) {
  const key = store + ':' + (store === 'settings' ? String(value.key) : String(value.id));
  if (_dbPutTimers[key]) clearTimeout(_dbPutTimers[key]);
  _dbPutTimers[key] = setTimeout(() => {
    delete _dbPutTimers[key];
    window.dbPut(store, value);
  }, delayMs);
};

// ── SYNC STATUS DOTS ──────────────────────────────────────────────
window.updateSyncStatus = function(status) {
  const dot = document.querySelector('.sync-dot');
  const icon = document.getElementById('syncIcon');
  const text = document.getElementById('syncText');
  const indicator = document.getElementById('syncIndicator');

  if (status === 'syncing') {
    if (dot) {
      dot.style.background = 'var(--gold)';
      dot.style.display = 'block';
    }
    if (icon) {
      icon.className = 'fa fa-spinner fa-spin';
      icon.style.color = 'var(--gold)';
    }
    if (text) {
      text.textContent = 'Syncing...';
      text.style.color = 'var(--gold)';
    }
    if (indicator) {
      indicator.setAttribute('title', 'Syncing data to Firebase Firestore...');
    }
  } else if (status === 'synced') {
    if (dot) {
      dot.style.background = 'var(--success)';
      dot.style.display = 'block';
    }
    if (icon) {
      icon.className = 'fa fa-cloud';
      icon.style.color = 'var(--success)';
    }
    if (text) {
      text.textContent = 'Synced';
      text.style.color = 'var(--text)';
    }
    if (indicator) {
      indicator.setAttribute('title', 'All data synced with Firebase Cloud Firestore ✓');
    }
  } else if (status === 'offline') {
    if (dot) {
      dot.style.background = 'var(--danger)';
      dot.style.display = 'block';
    }
    if (icon) {
      icon.className = 'fa fa-cloud-slash';
      icon.style.color = 'var(--danger)';
    }
    if (text) {
      text.textContent = 'Offline';
      text.style.color = 'var(--danger)';
    }
    if (indicator) {
      indicator.setAttribute('title', 'Offline - changes saved to local cache');
    }
  }
};

// ── FIRESTORE SYNCHRONIZATION LISTENERS ──────────────────────────
let firestoreListeners = [];
window.initializeFirestoreListeners = async function(userId) {
  if (!window.fDb) return;
  
  // Wait until DEFAULT_PARTS is loaded to avoid race conditions with seeding
  if (typeof window.DEFAULT_PARTS === 'undefined') {
    console.log('[Firestore Sync] window.DEFAULT_PARTS is not ready yet. Retrying listener initialization in 100ms...');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(window.initializeFirestoreListeners(userId));
      }, 100);
    });
  }
  
  // Clear any existing active listeners to avoid duplicates
  firestoreListeners.forEach(unsub => unsub());
  firestoreListeners = [];
  
  window.updateSyncStatus('syncing');

  // ── VERSION-BASED FIRESTORE RESET FOR THIS USER ──
  const PARTS_VERSION = 'v4_august2025_308parts';
  const userVersionKey = 'printex_parts_version_' + userId;

  let needsReseed = false;
  try {
    const partsSnap = await window.fDb.collection(`users/${userId}/parts`).doc('129').get();
    if (!partsSnap.exists) {
      console.log('[Firestore Sync] First default part (ID 129) is missing in Firestore for user ' + userId + '. Will seed default parts.');
      needsReseed = true;
    } else {
      localStorage.setItem(userVersionKey, PARTS_VERSION);
    }
  } catch (e) {
    console.warn("Could not check Firestore parts:", e);
  }

  if (needsReseed && typeof window.DEFAULT_PARTS !== 'undefined') {
    const expectedPartsCount = window.DEFAULT_PARTS.length;
    console.log('[Firestore Sync] Version mismatch/missing or incomplete database for user ' + userId + '. Force-reseeding Firestore and IndexedDB...');
    if (typeof window.showToast === 'function') {
      window.showToast(`🔄 Seeding cloud database with all ${expectedPartsCount} parts...`, 'info');
    }
    try {
      await window.seedDefaultParts();
      if (typeof window.showToast === 'function') {
        window.showToast(`✅ Database successfully updated with all ${expectedPartsCount} parts!`, 'success');
      }
    } catch(err) {
      console.error('[Firestore Sync] Force-reseed failed:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('❌ Seeding database failed. Using offline cache.', 'error');
      }
    }
  }

  const updateAndRender = async (store, firestoreData) => {
    if (!window.db) {
      try { await window.openDB(); } catch(e) { console.warn('[DB] openDB failed:', e); }
    }

    // SAFE MIGRATION: If Firestore empty but local IndexedDB has data, migrate local → cloud
    if (firestoreData.length === 0 && window.db) {
      let localData = [];
      try {
        await new Promise((resolve) => {
          const tx = window.db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => { localData = req.result || []; resolve(); };
          req.onerror = () => resolve();
        });
      } catch(e) {}

      // Filter to non-deleted items for local data
      const activeLocal = localData.filter(x => !x._deleted);

      if (activeLocal.length > 0) {
        console.log(`[Firebase] Firestore '${store}' empty – found ${activeLocal.length} local records. Migrating to cloud...`);
        const migrationKey = `printex_migrated_${store}_${userId}`;
        if (!localStorage.getItem(migrationKey)) {
          try {
            const BATCH_LIMIT = 499;
            let totalMigrated = 0;

            for (let i = 0; i < activeLocal.length; i += BATCH_LIMIT) {
              const chunk = activeLocal.slice(i, i + BATCH_LIMIT);
              const batch = window.fDb.batch();
              let batchCount = 0;

              for (const item of chunk) {
                const docId = store === 'settings' ? String(item.key || item.id) : String(item.id);
                if (!docId || docId === 'undefined') continue;
                const cleanItem = Object.assign({}, item);
                if (store === 'invoices' && Array.isArray(cleanItem.items)) {
                  cleanItem.items = JSON.stringify(cleanItem.items);
                }
                cleanItem._synced = true;
                cleanItem._migratedAt = Date.now();
                cleanItem.ownerId = userId;
                const docRef = window.fDb.collection(`users/${userId}/${store}`).doc(docId);
                batch.set(docRef, cleanItem, { merge: true });
                batchCount++;
              }

              if (batchCount > 0) {
                await batch.commit();
                totalMigrated += batchCount;
                console.log(`[Firebase] Batch committed: ${batchCount} ${store} docs`);
              }
            }

            if (totalMigrated > 0) {
              localStorage.setItem(migrationKey, 'done');
              console.log(`[Firebase] ✅ Migrated ${totalMigrated} ${store} records to Firestore`);
              if (typeof window.showToast === 'function') window.showToast(`☁️ ${totalMigrated} ${store} records migrated to cloud`, 'success');
            }
          } catch(e) {
            console.warn('[Firebase] Batch migration failed:', e);
          }
        }
        // Still update memory with local data so parts are visible immediately
        if (store === 'parts') {
          window.parts = activeLocal;
          if (typeof window.renderInventory === 'function') window.renderInventory();
        } else if (store === 'invoices') {
          window.invoices = activeLocal;
          if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
        } else if (store === 'activity') {
          window.activityLog = activeLocal;
        } else if (store === 'settings') {
          window.settings = {};
          activeLocal.forEach(s => window.settings[s.key] = s.value);
          if (typeof window.applySettings === 'function') window.applySettings();
        } else if (store === 'submissions') {
          window.submissions = activeLocal;
          if (typeof window.renderFreelancePage === 'function') window.renderFreelancePage();
        }
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.renderReports === 'function') window.renderReports();
        if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();
        window.updateSyncStatus('synced');
        return;
      }
      
      // Firestore AND local IndexedDB are both empty
      if (store === 'parts') {
        // CRITICAL: Never leave parts empty — always fall back to DEFAULT_PARTS
        if (typeof window.DEFAULT_PARTS !== 'undefined' && window.DEFAULT_PARTS.length > 0) {
          console.log('[updateAndRender] Both Firestore and IndexedDB empty for parts. Loading DEFAULT_PARTS (' + window.DEFAULT_PARTS.length + ' items).');
          window.parts = window.DEFAULT_PARTS.map(dp => ({ ...dp, id: String(dp.id) }));
          // Seed to IndexedDB + Firestore in background
          if (typeof window.seedDefaultParts === 'function') {
            window.seedDefaultParts().catch(e => console.error('[updateAndRender] Background seed failed:', e));
          }
        }
        if (typeof window.renderInventory === 'function') window.renderInventory();
      } else if (store !== 'parts') {
        // Clear IndexedDB for non-parts stores
        try {
          const tx = window.db.transaction(store, 'readwrite');
          tx.objectStore(store).clear();
        } catch(e) {}
      }

      if (store === 'invoices') { window.invoices = []; if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList(); }
      else if (store === 'activity') { window.activityLog = []; }
      else if (store === 'settings') { window.settings = {}; }
      else if (store === 'submissions') { window.submissions = []; if (typeof window.renderFreelancePage === 'function') window.renderFreelancePage(); }
      
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderReports === 'function') window.renderReports();
      if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();
      window.updateSyncStatus('synced');
      return;
    }

    // Merge into local IndexedDB using a smart self-correcting merge engine
    if (window.db && firestoreData.length > 0) {
      try {
        // Read current local items from IndexedDB
        let localData = [];
        await new Promise((resolve) => {
          const tx = window.db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => { localData = req.result || []; resolve(); };
          req.onerror = () => resolve();
        });

        // Await the write transaction to ensure all changes are committed before reading back
        await new Promise((resolve, reject) => {
          const tx = window.db.transaction(store, 'readwrite');
          const os = tx.objectStore(store);

          // Map Firestore data by ID
          const firestoreMap = new Map();
          for (const item of firestoreData) {
            const itemId = store === 'settings' ? String(item.key || item.id) : String(item.id);
            firestoreMap.set(itemId, item);
          }

          // 1. Identify which local items to delete or keep
          for (const localItem of localData) {
            const localId = store === 'settings' ? String(localItem.key || localItem.id) : String(localItem.id);
            
            if (!firestoreMap.has(localId)) {
              // Item exists locally but is not in Firestore snapshot
              if (localItem._synced === true) {
                // It was previously synced, meaning it has been deleted on the server. Remove it locally.
                os.delete(localId);
              }
              // If _synced is false, it's a newly added local item that hasn't synced yet. Keep it!
            }
          }

          // 2. Put/update all Firestore items locally and mark them as synced, but respect newer local unsynced changes
          for (const item of firestoreData) {
            const itemId = store === 'settings' ? String(item.key || item.id) : String(item.id);
            const localItem = localData.find(l => (store === 'settings' ? String(l.key || l.id) : String(l.id)) === itemId);
            if (localItem && localItem._synced === false && (localItem._lastUpdated || 0) > (item._lastUpdated || 0)) {
              console.log(`[Sync Merge] Keeping local changes for ${store}/${itemId} (local newer: ${localItem._lastUpdated} > ${item._lastUpdated})`);
              continue;
            }
            const cleanItem = { ...item, _synced: true };
            os.put(cleanItem);
          }

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch(e) { console.warn('[DB] IndexedDB smart merge error:', e); }
    }

    // Re-populate global memory arrays from local IndexedDB (merged source-of-truth)
    let mergedData = firestoreData;
    if (window.db) {
      try {
        await new Promise((resolve) => {
          const tx = window.db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => { mergedData = req.result || []; resolve(); };
          req.onerror = () => resolve();
        });
      } catch (e) {
        console.warn('[DB] Failed to read merged data from IndexedDB:', e);
      }
    }

    if (store === 'parts') {
      // SAFETY: Never set window.parts to empty if we have DEFAULT_PARTS available
      if (mergedData.length === 0 && typeof window.DEFAULT_PARTS !== 'undefined' && window.DEFAULT_PARTS.length > 0) {
        console.warn('[updateAndRender] Merged data for parts is empty. Keeping existing window.parts (' + window.parts.length + ' items).');
      } else {
        window.parts = mergedData;
      }
      if (typeof window.renderInventory === 'function') window.renderInventory();
    } else if (store === 'invoices') {
      window.invoices = mergedData;
      if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
    } else if (store === 'activity') {
      window.activityLog = mergedData;
    } else if (store === 'settings') {
      window.settings = {};
      mergedData.forEach(s => window.settings[s.key] = s.value);
      if (window.settings.invoiceCounter) {
        window.invoiceCounter = parseInt(window.settings.invoiceCounter) || 1;
      }
      if (typeof window.applySettings === 'function') window.applySettings();
    } else if (store === 'submissions') {
      window.submissions = mergedData;
      if (typeof window.renderFreelancePage === 'function') window.renderFreelancePage();
    }

    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.renderReports === 'function') window.renderReports();
    if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();
    window.updateSyncStatus('synced');
  };

  // Safe OwnerId migration in background
  const migrateOwnerId = async (storeName) => {
    try {
      const snapshot = await window.fDb.collection(`users/${userId}/${storeName}`).get();
      let batch = window.fDb.batch();
      let count = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.ownerId) {
          batch.set(doc.ref, { ownerId: userId }, { merge: true });
          count++;
          if (count >= 400) {
            batch.commit();
            batch = window.fDb.batch();
            count = 0;
          }
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(`[Migration] Migrated ${count} legacy ${storeName} documents to include ownerId = ${userId}`);
      }
    } catch(err) {
      console.warn(`[Migration] Failed to migrate ${storeName}:`, err);
    }
  };

  // Run legacy ownerId migration in parallel in the background
  Promise.all([
    migrateOwnerId('parts'),
    migrateOwnerId('invoices'),
    migrateOwnerId('settings'),
    migrateOwnerId('activity'),
    migrateOwnerId('submissions')
  ]).then(() => {
    console.log('[Migration] All ownerId background migrations completed.');
  }).catch(e => {
    console.warn('[Migration] Error during background migrations:', e);
  });

  // 1. Listen to inventory (parts)
  const partsUnsub = window.fDb.collection(`users/${userId}/parts`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('parts', docs);
  }, err => {
    console.error("Parts sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(partsUnsub);

  // 2. Listen to invoices
  const invoicesUnsub = window.fDb.collection(`users/${userId}/invoices`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      if (typeof d.items === 'string') {
        try { d.items = JSON.parse(d.items); } catch(e) {}
      }
      docs.push(d);
    });
    updateAndRender('invoices', docs);
  }, err => {
    console.error("Invoices sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(invoicesUnsub);

  // 3. Listen to activity logs
  const activityUnsub = window.fDb.collection(`users/${userId}/activity`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('activity', docs);
  }, err => {
    console.error("Activity sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(activityUnsub);

  // 4. Listen to settings
  const settingsUnsub = window.fDb.collection(`users/${userId}/settings`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.key = doc.id;
      docs.push(d);
    });
    updateAndRender('settings', docs);
  }, err => {
    console.error("Settings sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(settingsUnsub);

  // 5. Listen to freelance submissions (Rider workflow)
  const submissionsUnsub = window.fDb.collection(`users/${userId}/submissions`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('submissions', docs);
  }, err => {
    console.error("Submissions sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(submissionsUnsub);
};

// Spinner helpers
window.showSpinner = function() {
  const el = document.getElementById('spinnerOverlay');
  if (el) el.classList.remove('hidden');
};
window.hideSpinner = function() {
  const el = document.getElementById('spinnerOverlay');
  if (el) el.classList.add('hidden');
};

// Migration runner placeholder (will be defined in migration.js)
window.runMigration = async function(userId) {
  // If already migrated, skip
  if (localStorage.getItem('printex_migrated')) return;
  // Ensure IndexedDB is open
  if (!window.db) await window.openDB();
  const stores = ['parts', 'invoices', 'activity', 'settings', 'submissions'];
  for (const store of stores) {
    const data = await window.dbGet(store);
    if (!data) continue;
    for (const item of data) {
      // Use existing dbPut which syncs to Firestore
      await window.dbPut(store, item);
    }
  }
  localStorage.setItem('printex_migrated', 'true');
  console.log('[Migration] IndexedDB data migrated to Firestore');
};

// ── AUTHENTICATION AND PERSISTENCE ───────────────────────────────
if (window.fAuth) {
  window.fAuth.getRedirectResult().then((result) => {
    if (result && result.user) {
      console.log("[Firebase Auth] Google redirect sign-in successful:", result.user.email);
    }
  }).catch((err) => {
    console.error("[Firebase Auth] Google redirect sign-in failed:", err);
    if (typeof window.showAuthError === 'function') {
      window.showAuthError("Google Sign-In failed: " + err.message);
    }
  });

  window.fAuth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log("[Firebase Auth] User logged in:", user.email);
      window.currentUser = {
        id: user.uid,
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        picture: user.photoURL,
        provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'email'
      };
      
      // Save session
      window.saveSession(window.currentUser, true);

      // Fetch Firebase ID Token and save to localStorage for Express REST Sync API
      try {
        const token = await user.getIdToken(true);
        localStorage.setItem('token', token);
        console.log("[Firebase Auth] Saved ID token to localStorage");
      } catch (tokenErr) {
        console.error("[Firebase Auth] Failed to get ID token:", tokenErr);
      }
      
      // Initialize Firestore collections real-time listener
      window.initializeFirestoreListeners(user.uid);
      
      // Check if migration is needed (on first sign-in)
      const migrationKey = `printex_migrated_check_${user.uid}`;
      if (!localStorage.getItem(migrationKey)) {
        setTimeout(async () => {
          // If we have local data in IndexedDB, trigger the custom interactive migration modal
          if (!window.db) await window.openDB();
          const hasLocalData = (await window.dbGet('parts')).length > 0 || (await window.dbGet('invoices')).length > 0;
          if (hasLocalData) {
            window.pendingMigrationUid = user.uid;
            // Highlight merge option as active by default
            window.selectMigrationOption('merge');
            const migModal = document.getElementById('migrationModal');
            if (migModal) migModal.style.display = 'flex';
          } else {
            localStorage.setItem(migrationKey, 'done');
          }
        }, 1000);
      }
      
      // Show App
      window.showApp();
    } else {
      console.log("[Firebase Auth] No user logged in.");
      window.currentUser = null;
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  }, (err) => {
    console.error("[Firebase Auth] Auth state change error:", err);
    if (err.code === 'auth/unauthorized-domain') {
      const banner = document.getElementById('domainWarningBanner');
      if (banner) {
        banner.style.display = 'flex';
        const hostnameEl = document.getElementById('currentDomainLabel');
        if (hostnameEl) hostnameEl.textContent = window.location.hostname;
      }
    }
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  });
} else {
  // Local fallback mode
  console.log("[Auth] Running in local fallback mode.");
  setTimeout(() => {
    if (typeof firebaseDisabled !== 'undefined' && firebaseDisabled) {
      const fallbackBanner = document.getElementById('firebaseFallbackBanner');
      if (fallbackBanner) fallbackBanner.style.display = 'flex';
    }
    const session = window.getSession();
    if (session && session.isLoggedIn) {
      window.currentUser = session;
      window.showApp();
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  }, 100);
}


window.doLogin = async function() {
  window.clearAuthMessages();
  const email = (document.getElementById('loginEmail')?.value || '').trim();
  const pass = document.getElementById('loginPass')?.value || '';
  if (!email || !pass) return window.showAuthError('Please enter email and password');
  window.setBtnLoading('btnSignIn', true, '<i class="fa fa-spinner fa-spin"></i> Signing in...');
  try {
    const serverEmail = email.includes('@') ? email : (email === 'admin' ? 'admin@printex.com' : email);
    const passToUse = (email === 'admin' && pass === 'admin123') ? 'admin123' : pass;
    
    if (window.fAuth) {
      await window.fAuth.signInWithEmailAndPassword(serverEmail, passToUse).catch(async (authErr) => {
        if (authErr.code === 'auth/user-not-found' && serverEmail === 'admin@printex.com') {
          console.log("[Firebase Auth] Creating default admin account in Firebase...");
          await window.fAuth.createUserWithEmailAndPassword('admin@printex.com', 'admin123');
          if (window.fAuth.currentUser) {
            await window.fAuth.currentUser.updateProfile({ displayName: 'Admin User' });
          }
        } else {
          throw authErr;
        }
      });
      window.showAuthSuccess('Welcome back!');
    } else {
      throw new Error("Authentication module not loaded");
    }
  } catch(err) {
    window.showAuthError(err.message);
  } finally {
    window.setBtnLoading('btnSignIn', false, '<i class="fa fa-sign-in-alt"></i> Sign In');
  }
};

window.doGoogleLogin = async function() {
  if (!window.fAuth) return window.showAuthError('Auth module missing');
  window.clearAuthMessages();
  window.setBtnLoading('btnGoogleSignIn', true, '<i class="fa fa-spinner fa-spin"></i> Connecting...');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      await window.fAuth.signInWithRedirect(provider);
    } else {
      await window.fAuth.signInWithPopup(provider);
      window.showAuthSuccess('Successfully logged in with Google!');
    }
  } catch(err) {
    if (err.code === 'auth/unauthorized-domain') {
      const domain = window.location.hostname;
      window.showAuthError(`
        <div style="text-align:left;line-height:1.6;font-size:12px;margin-top:4px">
          <span style="font-weight:700;color:#f87171;font-size:13px"><i class="fa fa-exclamation-triangle"></i> Domain Not Authorized</span><br/>
          The domain <strong>${domain}</strong> needs to be whitelisted in Firebase Console.<br/><br/>
          <strong>How to resolve in 1 minute:</strong><br/>
          1. Open the <a href="https://console.firebase.google.com/" target="_blank" style="color:var(--accent);text-decoration:underline;font-weight:600">Firebase Console</a>.<br/>
          2. Select project: <code>gen-lang-client-0648830639</code>.<br/>
          3. Go to <strong>Authentication</strong> > <strong>Settings</strong> > <strong>Authorized domains</strong>.<br/>
          4. Click <strong>Add domain</strong> and enter: <code>${domain}</code> and save.
        </div>
      `);
    } else {
      window.showAuthError(err.message);
    }
  } finally {
    window.setBtnLoading('btnGoogleSignIn', false, 'Sign In with Google');
  }
};

window.doSignup = async function() {
  if (!window.fAuth) return window.showAuthError('Auth module missing');
  window.clearAuthMessages();
  const fullName = (document.getElementById('signupName')?.value || '').trim();
  const email = (document.getElementById('signupEmail')?.value || '').trim().toLowerCase();
  const pass = document.getElementById('signupPass')?.value || '';
  const pass2 = document.getElementById('signupPass2')?.value || '';
  if (!fullName || !email || !pass) return window.showAuthError('Please fill all fields');
  if (pass.length < 6) return window.showAuthError('Password must be at least 6 characters');
  if (pass !== pass2) return window.showAuthError('Passwords do not match');
  window.setBtnLoading('btnCreateAccount', true, '<i class="fa fa-spinner fa-spin"></i> Creating account...');
  try {
    const userCredential = await window.fAuth.createUserWithEmailAndPassword(email, pass);
    await userCredential.user.updateProfile({ displayName: fullName });
    window.showAuthSuccess('Account created! Welcome, ' + fullName);
  } catch(err) {
    window.showAuthError(err.message);
  } finally {
    window.setBtnLoading('btnCreateAccount', false, '<i class="fa fa-user-plus"></i> Create Account');
  }
};

window.doQuickLogin = function() {
  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPass');
  if (emailEl) emailEl.value = 'admin';
  if (passEl) passEl.value = 'admin123';
  window.doLogin();
};

window.showForgot = async function() {
  if (!window.fAuth) return window.showAuthError('Auth module missing');
  const email = document.getElementById('loginEmail')?.value.trim();
  if (!email) {
    window.showAuthError('Please enter your email address to reset password.');
    return;
  }
  try {
    await window.fAuth.sendPasswordResetEmail(email);
    window.showAuthSuccess('Password reset email sent to ' + email);
  } catch (err) {
    window.showAuthError(err.message);
  }
};

// ── INTERACTIVE MIGRATION MODAL HANDLERS ─────────────────────────
window.selectedMigrationOption = 'merge'; // default
window.pendingMigrationUid = null;

window.selectMigrationOption = function(option) {
  window.selectedMigrationOption = option;
  document.querySelectorAll('.mig-option').forEach(el => {
    el.style.background = 'var(--bg3)';
    el.style.border = '1px solid var(--border2)';
  });
  const activeEl = document.getElementById('migOpt' + option.charAt(0).toUpperCase() + option.slice(1));
  if (activeEl) {
    activeEl.style.background = 'var(--accent-glow)';
    activeEl.style.border = '1px solid var(--accent)';
  }
};

window.executeSelectedMigration = async function() {
  const uid = window.pendingMigrationUid;
  if (!uid) {
    document.getElementById('migrationModal').style.display = 'none';
    return;
  }
  
  window.setBtnLoading('btnConfirmMigration', true, '<i class="fa fa-spinner fa-spin"></i> Processing...');
  
  try {
    const option = window.selectedMigrationOption;
    console.log(`[Migration] Executing migration choice '${option}' for user ${uid}`);
    
    if (option === 'merge') {
      // Run local-to-cloud migration
      if (!window.db) await window.openDB();
      const stores = ['parts', 'invoices', 'activity', 'settings', 'submissions'];
      let totalMigrated = 0;
      
      for (const store of stores) {
        let localData = [];
        try {
          localData = await window.dbGet(store) || [];
        } catch(e) {}
        
        if (localData.length > 0) {
          const BATCH_LIMIT = 499;
          for (let i = 0; i < localData.length; i += BATCH_LIMIT) {
            const chunk = localData.slice(i, i + BATCH_LIMIT);
            const batch = window.fDb.batch();
            let batchCount = 0;
            
            for (const item of chunk) {
              const docId = store === 'settings' ? String(item.key || item.id) : String(item.id);
              if (!docId || docId === 'undefined') continue;
              const cleanItem = Object.assign({}, item);
              if (store === 'invoices' && Array.isArray(cleanItem.items)) {
                cleanItem.items = JSON.stringify(cleanItem.items);
              }
              cleanItem._synced = true;
              cleanItem._migratedAt = Date.now();
              cleanItem.ownerId = uid;
              const docRef = window.fDb.collection(`users/${uid}/${store}`).doc(docId);
              batch.set(docRef, cleanItem, { merge: true });
              batchCount++;
            }
            if (batchCount > 0) {
              await batch.commit();
              totalMigrated += batchCount;
            }
          }
        }
      }
      window.showToast(`☁️ Successfully uploaded ${totalMigrated} items to Cloud!`, 'success');
      
    } else if (option === 'overwrite') {
      // Clear IndexedDB stores completely and rely solely on Firestore
      if (!window.db) await window.openDB();
      const stores = ['parts', 'invoices', 'activity', 'settings', 'submissions'];
      for (const store of stores) {
        try {
          const tx = window.db.transaction(store, 'readwrite');
          tx.objectStore(store).clear();
        } catch(e) {}
      }
      // Reset memory arrays
      window.parts = [];
      window.invoices = [];
      window.submissions = [];
      window.settings = {};
      window.activityLog = [];
      
      window.showToast('🧹 Local cache cleared. Loading clean cloud data...', 'success');
      
    } else if (option === 'skip') {
      window.showToast('Skip cloud migration. Local cache preserved.', 'info');
    }
    
    // Set migration marker so we don't ask again
    localStorage.setItem(`printex_migrated_check_${uid}`, 'done');
    localStorage.setItem('printex_migrated', 'true');
    
    // Close modal
    document.getElementById('migrationModal').style.display = 'none';
    
    // Re-initialize Firestore snapshot listeners to pull/synchronize
    window.initializeFirestoreListeners(uid);
    
  } catch(err) {
    console.error('[Migration] Execution failed:', err);
    window.showToast('Migration failed: ' + err.message, 'error');
  } finally {
    window.setBtnLoading('btnConfirmMigration', false, '<i class="fa fa-check"></i> Continue');
  }
};

window.doLogout = async function() {
  if (window.fAuth) {
    try {
      await window.fAuth.signOut();
    } catch(err) {
      console.error("Logout failed:", err);
    }
  }
  localStorage.removeItem('token');
  sessionStorage.removeItem('printex_session');
  localStorage.removeItem('printex_remember');
  window.currentUser = null;
  location.reload();
};

window.checkLogin = function() {
  // Session check stub
};

window.switchTab = function(tab) {
  const isLogin = (tab === 'login');
  document.getElementById('panelLogin').style.display  = isLogin ? 'block' : 'none';
  document.getElementById('panelSignup').style.display = isLogin ? 'none'  : 'block';
  const lb = document.getElementById('tabLoginBtn');
  const sb = document.getElementById('tabSignupBtn');
  if (lb) { lb.style.background = isLogin ? 'var(--accent)' : 'transparent'; lb.style.color = isLogin ? '#fff' : 'var(--muted)'; }
  if (sb) { sb.style.background = isLogin ? 'transparent' : 'var(--accent)'; sb.style.color = isLogin ? 'var(--muted)' : '#fff'; }
  window.clearAuthMessages();
};

window.showAuthError = function(msg) {
  const el = document.getElementById('authError');
  if (el) { el.innerHTML = '⚠️ ' + msg; el.style.display = 'block'; }
  const ok = document.getElementById('authSuccess');
  if (ok) ok.style.display = 'none';
};

window.showAuthSuccess = function(msg) {
  const el = document.getElementById('authSuccess');
  if (el) { el.innerHTML = '✅ ' + msg; el.style.display = 'block'; }
  const err = document.getElementById('authError');
  if (err) err.style.display = 'none';
};

window.clearAuthMessages = function() {
  const e = document.getElementById('authError');
  const s = document.getElementById('authSuccess');
  if (e) e.style.display = 'none';
  if (s) s.style.display = 'none';
};

window.setBtnLoading = function(id, loading, html) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.75' : '1';
  if (html !== undefined) btn.innerHTML = html;
};

window.togglePwd = function(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  const icon = btn?.querySelector('i');
  if (icon) icon.className = show ? 'fa fa-eye-slash' : 'fa fa-eye';
};

window.saveSession = function(user, remember) {
  const session = { isLoggedIn: true, id: user.id, name: user.fullName || user.name, email: user.email, role: user.role || 'user', provider: user.provider, picture: user.picture };
  sessionStorage.setItem('printex_session', JSON.stringify(session));
  if (remember) localStorage.setItem('printex_remember', JSON.stringify(session));
};

window.getSession = function() {
  try {
    const s = sessionStorage.getItem('printex_session');
    if (s) return JSON.parse(s);
    const r = localStorage.getItem('printex_remember');
    if (r) return JSON.parse(r);
  } catch {}
  return null;
};

window.showApp = function() {
  // Hide login screen and display main app UI
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  // Update sidebar user info
  window.updateSidebarUser();

  // Apply UI settings and render components.
  if (typeof window.applySettings === 'function') window.applySettings();
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  if (typeof window.renderInventory === 'function') window.renderInventory();
  if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
  if (typeof window.renderReports === 'function') window.renderReports();
  if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
  if (typeof window.initCreateInvoice === 'function') window.initCreateInvoice();
  if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();

  // Load saved API key into AI panel if applicable.
  if (typeof window.getAIKey === 'function') {
    const saved = window.getAIKey();
    const ki = document.getElementById('aiKeyInput');
    if (ki && saved) ki.value = saved;
    const si = document.getElementById('settingsApiKey');
    if (si && saved) si.value = saved;
    if (saved && typeof window.updateAIStatus === 'function') window.updateAIStatus(true);
  }
};

window.updateSidebarUser = function() {
  if (!window.currentUser) return;
  const nameEl = document.getElementById('sidebarName');
  const roleEl = document.getElementById('sidebarRole');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (nameEl) nameEl.textContent = window.currentUser.name || window.currentUser.email || 'User';
  if (roleEl) roleEl.textContent = window.currentUser.role || (window.currentUser.provider === 'google' ? 'Google Account' : 'User');
  if (avatarEl) {
    if (window.currentUser.picture) {
      avatarEl.innerHTML = `<img src="${window.currentUser.picture}" style="width:32px;height:32px;border-radius:50%;object-fit:cover"/>`;
      avatarEl.style.background = 'none';
      avatarEl.style.padding = '0';
    } else {
      avatarEl.textContent = (window.currentUser.name || window.currentUser.email || 'U')[0].toUpperCase();
    }
  }
};

// ── NAVIGATION AND APP LAYOUT ─────────────────────────────────────
const pageTitles = {
  dashboard:'Dashboard',
  inventory:'Inventory',
  services:'Professional Services',
  invoices:'Invoices (Finalized)',
  quotations:'Quotations (Potential)',
  createInvoice:'New Invoice / Quote',
  freelance:'Freelance Submissions',
  reports:'Reports',
  analytics:'Company Analytics',
  ai:'AI Assistant',
  settings:'Settings'
};

window.showPage = function(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-'+id);
  if (pg) { pg.classList.add('active'); pg.classList.add('fade-in'); setTimeout(()=>pg.classList.remove('fade-in'),400); }
  
  let targetNav = navEl;
  if (!targetNav) {
    targetNav = Array.from(document.querySelectorAll('.nav-item')).find(el => {
      const oc = el.getAttribute('onclick');
      return oc && oc.includes(`'${id}'`);
    });
  }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (targetNav) targetNav.classList.add('active');
  
  document.getElementById('pageTitleBar').textContent = pageTitles[id] || id;
  window.closeSidebar();
  
  if (id==='dashboard' && typeof window.renderDashboard === 'function') window.renderDashboard();
  if (id==='invoices' && typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
  if (id==='quotations' && typeof window.renderQuotationList === 'function') window.renderQuotationList();
  if (id==='reports' && typeof window.renderReports === 'function') window.renderReports();
  if (id==='analytics' && typeof window.renderAnalytics === 'function') window.renderAnalytics();
  if (id==='createInvoice' && typeof window.initCreateInvoice === 'function') window.initCreateInvoice();
  if (id==='freelance' && typeof window.renderFreelancePage === 'function') window.renderFreelancePage();
  if (id==='services' && typeof window.renderServicesPage === 'function') window.renderServicesPage();
};

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const overlay = document.getElementById('sidebarOverlay');
  const isMobile = window.innerWidth <= 767;

  if (isMobile) {
    // Mobile: slide-in/out with overlay
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  } else {
    // Desktop: collapse/expand sidebar
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
      main.classList.add('expanded');
      main.style.marginLeft = '0';
    } else {
      main.classList.remove('expanded');
      main.style.marginLeft = '230px';
    }
  }
};

window.closeSidebar = function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display='none';
};

// ── CURRENCY HELPERS ──────────────────────────────────────────────
window.getCurrencySymbol = function() {
  const curr = window.settings.currency || 'KSH';
  if (curr === 'USD') return '$';
  return 'Ksh';
};

window.formatPrice = function(amountKsh, displayPrefix = true) {
  const curr = window.settings.currency || 'KSH';
  if (curr === 'USD') {
    const usdAmount = amountKsh / 130.0;
    const val = Math.round(usdAmount * 100) / 100;
    return displayPrefix ? `$ ${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : val;
  }
  const val = Math.round(amountKsh);
  return displayPrefix ? `Ksh ${val.toLocaleString()}` : val;
};

// ── SETTINGS MANAGEMENT ───────────────────────────────────────────
window.applySettings = function() {
  window.currentTheme = window.settings.theme||'dark';
  document.documentElement.setAttribute('data-theme', window.currentTheme);
  const dt = document.getElementById('darkToggle');
  if (dt) dt.classList.toggle('on', window.currentTheme==='dark');
  if (document.getElementById('vatSetting')) document.getElementById('vatSetting').value = window.settings.vat||16;
  if (document.getElementById('currSetting')) document.getElementById('currSetting').value = window.settings.currency||'KSH';
  if (document.getElementById('pinSetting')) document.getElementById('pinSetting').value = window.settings.pin||'P051550104M';

  // Dynamic currency headers
  const symbol = window.getCurrencySymbol();
  const thPrice = document.querySelector('#invTable th:nth-child(7)');
  if (thPrice) thPrice.textContent = `Price (${symbol})`;
  const thUnit = document.querySelector('#lineItemTable th:nth-child(3)');
  if (thUnit) thUnit.textContent = `Unit Price (${symbol})`;
  const thTotal = document.querySelector('#lineItemTable th:nth-child(4)');
  if (thTotal) thTotal.textContent = `Total (${symbol})`;
};

window.saveSetting = async function(key, val) {
  window.settings[key]=val;
  await window.dbPut('settings',{key,value:val});
  window.applySettings();
  if (key === 'currency') {
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
    if (typeof window.renderReports === 'function') window.renderReports();
    if (typeof window.renderLineItems === 'function') window.renderLineItems();
    if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
  }
};

window.toggleTheme = function() {
  window.currentTheme = window.currentTheme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme', window.currentTheme);
  const dt = document.getElementById('darkToggle');
  if (dt) dt.classList.toggle('on', window.currentTheme==='dark');
  window.saveSetting('theme', window.currentTheme);
};

window.resetToDefault = async function() {
  const expectedPartsCount = window.DEFAULT_PARTS ? window.DEFAULT_PARTS.length : 308;
  if (!confirm(`Reset all inventory to default ${expectedPartsCount} parts? Your custom parts will be lost.`)) return;
  window.showSpinner();
  try {
    await window.seedDefaultParts();
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    window.showToast(`Inventory reset to default ${expectedPartsCount} parts`, 'success');
  } catch (e) {
    console.error('Reset to default failed:', e);
    window.showToast('Reset failed: ' + e.message, 'error');
  } finally {
    window.hideSpinner();
  }
};

window.clearAllData = async function() {
  if (!confirm('Delete ALL data including invoices? This cannot be undone.')) return;
  window.showSpinner();
  try {
    await window.dbClear('parts'); 
    await window.dbClear('invoices'); 
    await window.dbClear('activity'); 
    await window.dbClear('settings');
    window.parts=[]; window.invoices=[]; window.activityLog=[]; window.settings={};
    await window.seedDefaultParts();
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
    window.showToast('All data cleared and reset', 'warn');
  } catch (e) {
    console.error('Clear all data failed:', e);
    window.showToast('Clear failed: ' + e.message, 'error');
  } finally {
    window.hideSpinner();
  }
};

window.seedDefaultParts = async function() {
  if (typeof window.DEFAULT_PARTS === 'undefined') return;
  
  const user = window.fAuth ? window.fAuth.currentUser : null;
  const userId = user ? user.uid : null;
  
  console.log('[seedDefaultParts] Starting seed of ' + window.DEFAULT_PARTS.length + ' default parts...');
  
  // 1. Clear IndexedDB parts store directly (safe, local-only, no race condition)
  if (window.db) {
    await new Promise((resolve, reject) => {
      const tx = window.db.transaction('parts', 'readwrite');
      const req = tx.objectStore('parts').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    console.log('[seedDefaultParts] Cleared IndexedDB parts store.');
  }
  
  // 2. Write ALL default parts to Firestore using set() (full overwrite per doc).
  //    CRITICAL FIX: We skip clearing the Firestore collection first to eliminate
  //    the race condition where batch deletes and batch writes overlap while
  //    snapshot listeners are active, causing the UI to see an intermediate
  //    incomplete collection (e.g. 282 instead of expected parts).
  //    Since every default part has a fixed, unique ID, set() will create or
  //    fully overwrite each document without needing to delete first.
  if (userId && window.fDb) {
    const BATCH_LIMIT = 400;
    let totalWritten = 0;
    for (let i = 0; i < window.DEFAULT_PARTS.length; i += BATCH_LIMIT) {
      const chunk = window.DEFAULT_PARTS.slice(i, i + BATCH_LIMIT);
      const writeBatch = window.fDb.batch();
      for (const dp of chunk) {
        const part = { ...dp, image: null, ownerId: userId, _synced: true, _lastUpdated: Date.now() };
        part.id = String(part.id);
        const docRef = window.fDb.collection(`users/${userId}/parts`).doc(part.id);
        writeBatch.set(docRef, part);
      }
      try {
        await writeBatch.commit();
        totalWritten += chunk.length;
        console.log('[seedDefaultParts] Firestore batch ' + (Math.floor(i / BATCH_LIMIT) + 1) + ' committed: ' + chunk.length + ' parts');
      } catch(err) {
        console.error('[seedDefaultParts] Firestore batch commit failed:', err);
      }
    }
    console.log('[seedDefaultParts] Wrote ' + totalWritten + '/' + window.DEFAULT_PARTS.length + ' parts to Firestore');
  }
  
  // 3. Write to IndexedDB in a single transaction
  if (window.db) {
    await new Promise((resolve, reject) => {
      const tx = window.db.transaction('parts', 'readwrite');
      const os = tx.objectStore('parts');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      for (const dp of window.DEFAULT_PARTS) {
        const part = { ...dp, image: null };
        if (userId) {
          part.ownerId = userId;
          part._synced = true;
          part._lastUpdated = Date.now();
        }
        part.id = String(part.id);
        os.put(part);
      }
    });
    console.log('[seedDefaultParts] Wrote ' + window.DEFAULT_PARTS.length + ' parts to IndexedDB');
  }
  
  // 4. Update memory
  window.parts = window.DEFAULT_PARTS.map(dp => {
    const part = { ...dp, image: null };
    if (userId) {
      part.ownerId = userId;
      part._synced = true;
      part._lastUpdated = Date.now();
    }
    part.id = String(part.id);
    return part;
  });
  
  // 5. Update local storage version keys
  const PARTS_VERSION = 'v4_august2025_308parts';
  localStorage.setItem('printex_parts_version_local', PARTS_VERSION);
  if (userId) {
    localStorage.setItem('printex_parts_version_' + userId, PARTS_VERSION);
  }
  localStorage.setItem('printex_parts_version', PARTS_VERSION);
  
  console.log('[seedDefaultParts] ✅ Complete: ' + window.parts.length + ' parts seeded successfully.');
};

// ── UTILITY HELPERS ───────────────────────────────────────────────
window.esc = function(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
};

window.downloadFile = function(content, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content],{type:mime}));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

window.exportBackup = function() {
  const backup = { 
    exportDate:new Date().toISOString(), 
    parts:window.parts.map(p=>({...p,image:p.image?'[BASE64]':null})), 
    invoices:window.invoices, 
    settings:window.settings, 
    version:2 
  };
  window.downloadFile(JSON.stringify(backup,null,2),'printex_backup.json','application/json');
  window.showToast('Backup exported','success');
};

window.importBackup = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.parts) {
      await window.dbClear('parts');
      for (const p of data.parts) await window.dbPut('parts', p);
      window.parts = await window.dbGet('parts');
    }
    if (data.invoices) {
      await window.dbClear('invoices');
      for (const inv of data.invoices) await window.dbPut('invoices', inv);
      window.invoices = await window.dbGet('invoices');
    }
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
    window.showToast(`Backup imported: ${window.parts.length} parts, ${window.invoices.length} invoices`,'success');
  } catch(e) {
    window.showToast('Import failed: '+e.message,'error');
  }
};

window.showToast = function(msg, type='success') {
  const zone = document.getElementById('toastZone');
  if (!zone) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = {success:'fa-check-circle',error:'fa-exclamation-circle',warn:'fa-triangle-exclamation'};
  t.innerHTML = `<i class="fa ${icons[type]||'fa-info-circle'}" style="color:var(--${type==='success'?'success':type==='error'?'danger':'warn'})"></i>${msg}`;
  zone.appendChild(t);
  setTimeout(()=>t.remove(), 3500);
};

window.logActivity = async function(text, type='info') {
  const entry = { text, type, ts: Date.now() };
  const id = await window.dbPut('activity', entry);
  entry.id = id;
  window.activityLog.push(entry);
};

// Enter key support on login screen
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const ls = document.getElementById('loginScreen');
  if (!ls || ls.style.display === 'none' || ls.style.display === '') return;
  const signupVisible = document.getElementById('panelSignup')?.style.display !== 'none';
  if (signupVisible) {
    if (typeof window.doSignup === 'function') window.doSignup();
  } else {
    if (typeof window.doLogin === 'function') window.doLogin();
  }
});

// Stubs to prevent reference errors from old code
window.initFirebase = () => false;
window.loadFirebaseSettingsFields = () => {};
window.saveFirebaseConfig = () => { window.showToast('Firebase auth uses built-in config', 'info'); };
window.clearFirebaseConfig = () => { window.showToast('Firebase auth uses built-in config', 'info'); };

// Setup background sync stub variables
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

// Handle HMR/websocket silently
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason === 'WebSocket closed without opened.' || 
      (event.reason && event.reason.message === 'WebSocket closed without opened.')) {
    event.preventDefault();
  }
});
window.addEventListener('error', (event) => {
  if (event.message === 'WebSocket closed without opened.') {
    event.preventDefault();
  }
});

// ── AUTOMATIC ONLINE/OFFLINE NETWORK DETECTION ──────────────────
window.addEventListener('online', () => {
  console.log('[Network] Device is back online.');
  window.updateSyncStatus('syncing');
  const user = window.fAuth ? window.fAuth.currentUser : null;
  if (user && window.fDb) {
    // Re-attach Firestore listeners to pull any queued changes
    window.initializeFirestoreListeners(user.uid);
    setTimeout(() => {
      window.updateSyncStatus('synced');
      window.showToast('☁️ Back online — cloud sync resumed!', 'success');
    }, 1500);
  } else {
    window.updateSyncStatus('synced');
  }
});

window.addEventListener('offline', () => {
  console.log('[Network] Device went offline.');
  window.updateSyncStatus('offline');
  window.showToast('📶 Offline — changes saved locally and will sync when reconnected.', 'warn');
});

// Set initial sync badge state on page load
if (!navigator.onLine) {
  window.updateSyncStatus('offline');
} else if (window.fDb) {
  window.updateSyncStatus('synced');
}
