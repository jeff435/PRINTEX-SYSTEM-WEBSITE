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

// New business variables
window.categories = [];
window.customers = [];
window.suppliers = [];
window.expenses = [];
window.employees = [];
window.purchases = [];
window.attendance = [];

window.DEFAULT_CATEGORIES = [
  { name: 'Valves & Pneumatic Parts', code: 'A', icon: '🔧', color: '#ff6b6b' },
  { name: 'Bellows & Autoplate Parts', code: 'B', icon: '📁', color: '#ffa94d' },
  { name: 'Bearings & Gears', code: 'C', icon: '⚙️', color: '#69db7c' },
  { name: 'Cam Followers', code: 'D', icon: '⛓️', color: '#74c0fc' },
  { name: 'Grippers & Separators', code: 'E', icon: '✂️', color: '#da77f2' },
  { name: 'Heidelberg Parts', code: 'F', icon: '🖨️', color: '#f783ac' },
  { name: 'Sensors & Electronics', code: 'G', icon: '🔌', color: '#63e6be' },
  { name: 'Motors & Belts', code: 'J', icon: '🎡', color: '#ff922b' },
  { name: 'Cylinders', code: 'K', icon: '🛢️', color: '#20c997' },
  { name: 'Consumables', code: 'L', icon: '📦', color: '#fcc419' }
].map(cat => ({
  ...cat,
  id: 'cat_' + cat.code.toLowerCase(),
  partCount: 0,
  _seen: true,
  _deleted: false,
  _flagged: false,
  _draft: false,
  _modSeq: 0,
  _synced: false,
  _lastUpdated: Date.now()
}));

window.db = null;
window.tabSessionId = 'tab_' + Math.random().toString(36).substring(2, 9);

// ── INDEXEDDB SETUP ──────────────────────────────────────────────
window.openDB = function() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('PrintexDB', 6);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('parts')) d.createObjectStore('parts', {keyPath:'id'});
      if (!d.objectStoreNames.contains('invoices')) d.createObjectStore('invoices', {keyPath:'id'});
      if (!d.objectStoreNames.contains('submissions')) d.createObjectStore('submissions', {keyPath:'id'});
      if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', {keyPath:'key'});
      if (!d.objectStoreNames.contains('activity')) d.createObjectStore('activity', {keyPath:'id'});
      // v5: New business stores
      if (!d.objectStoreNames.contains('categories')) d.createObjectStore('categories', {keyPath:'id'});
      if (!d.objectStoreNames.contains('customers')) d.createObjectStore('customers', {keyPath:'id'});
      if (!d.objectStoreNames.contains('suppliers')) d.createObjectStore('suppliers', {keyPath:'id'});
      if (!d.objectStoreNames.contains('expenses')) d.createObjectStore('expenses', {keyPath:'id'});
      if (!d.objectStoreNames.contains('employees')) d.createObjectStore('employees', {keyPath:'id'});
      if (!d.objectStoreNames.contains('purchases')) d.createObjectStore('purchases', {keyPath:'id'});
      // v6: Attendance store
      if (!d.objectStoreNames.contains('attendance')) d.createObjectStore('attendance', {keyPath:'id'});
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
      if (store === 'categories') return resolve(filterDeleted(window.DEFAULT_CATEGORIES || []));
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
        
        window.categories = await window.dbGet('categories') || [];
        window.customers = await window.dbGet('customers') || [];
        window.suppliers = await window.dbGet('suppliers') || [];
        window.expenses = await window.dbGet('expenses') || [];
        window.employees = await window.dbGet('employees') || [];
        window.purchases = await window.dbGet('purchases') || [];
        window.attendance = await window.dbGet('attendance') || [];
        
        const settingsArr = await window.dbGet('settings') || [];
        window.settings = {};
        settingsArr.forEach(s => window.settings[s.key] = s.value);
        window.invoiceCounter = (await window.dbGet('settings','invoiceCounter'))?.value || 1;

        if (typeof window.populateCategorySelects === 'function') window.populateCategorySelects();
        if (typeof window.applySettings === 'function') window.applySettings();
        if (typeof window.renderInventory === 'function') window.renderInventory();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.renderInvoiceList === 'function') window.renderInvoiceList();
        if (typeof window.renderReports === 'function') window.renderReports();
        if (typeof window.renderLineItems === 'function') window.renderLineItems();
        if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
        if (typeof window.renderFreelancePage === 'function') window.renderFreelancePage();
        
        if (window.biz && typeof window.biz.init === 'function') {
          await window.biz.init();
          const currentActivePage = document.querySelector('.page.active')?.id?.replace('page-', '');
          if (currentActivePage && ['customers', 'suppliers', 'expenses', 'employees', 'categories', 'purchases', 'attendance'].includes(currentActivePage)) {
            if (currentActivePage === 'attendance' && typeof window.biz.filterAttendance === 'function') {
              window.biz.filterAttendance();
            } else {
              const renderFnName = 'filter' + currentActivePage.charAt(0).toUpperCase() + currentActivePage.slice(1);
              if (typeof window.biz[renderFnName] === 'function') {
                window.biz[renderFnName]();
              }
            }
          }
        }
        
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
  } else if (store === 'categories') {
    if (!value.id) value.id = 'cat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'customers') {
    if (!value.id) value.id = 'cust_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'suppliers') {
    if (!value.id) value.id = 'sup_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'expenses') {
    if (!value.id) value.id = 'exp_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'employees') {
    if (!value.id) value.id = 'emp_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'purchases') {
    if (!value.id) value.id = 'pur_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
  } else if (store === 'attendance') {
    if (!value.id) value.id = 'att_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    else value.id = String(value.id);
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
    const partsSnap = await window.fDb.collection(`users/${userId}/parts`).limit(310).get();
    if (partsSnap.size < 300) {
      console.log('[Firestore Sync] Firestore collection has incomplete parts data (' + partsSnap.size + '/308). Will seed default parts.');
      needsReseed = true;
    } else {
      console.log('[Firestore Sync] Firestore has existing default parts data. Skipping reseed, updating version key.');
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
    const isParts = (store === 'parts');
    const firestorePhysical = isParts ? firestoreData.filter(p => !p.isService) : firestoreData;
    const isFirestoreEmpty = firestorePhysical.length === 0;

    if (isFirestoreEmpty && window.db) {
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
      const activeLocalPhysical = isParts ? activeLocal.filter(p => !p.isService) : activeLocal;

      if (activeLocalPhysical.length > 0) {
        console.log(`[Firebase] Firestore '${store}' has no physical items – found ${activeLocalPhysical.length} local records. Migrating to cloud...`);
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
      
      // Firestore AND local IndexedDB are both empty (or have no physical parts)
      if (store === 'parts') {
        // CRITICAL: Never leave parts empty — always fall back to DEFAULT_PARTS
        if (typeof window.DEFAULT_PARTS !== 'undefined' && window.DEFAULT_PARTS.length > 0) {
          console.log('[updateAndRender] Both Firestore and IndexedDB empty for parts. Loading DEFAULT_PARTS (' + window.DEFAULT_PARTS.length + ' items).');
          const defParts = window.DEFAULT_PARTS.map(dp => ({ ...dp, id: String(dp.id) }));
          const services = firestoreData.filter(p => p.isService);
          window.parts = [...defParts, ...services];
          // Seed to IndexedDB + Firestore in background
          if (typeof window.seedDefaultParts === 'function') {
            window.seedDefaultParts().catch(e => console.error('[updateAndRender] Background seed failed:', e));
          }
        }
        if (typeof window.renderInventory === 'function') window.renderInventory();
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
          // Safeguard: do not delete local parts if seeding is active, or if the server snapshot has fewer than 300 parts (incomplete snapshot)
          const isSeedingOrIncomplete = (store === 'parts' && firestoreData.length > 0 && firestoreData.length < 300);
          if (!window._isSeeding && !isSeedingOrIncomplete && firestoreData.length >= localData.length) {
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
    } else if (['customers', 'suppliers', 'expenses', 'employees', 'categories', 'purchases', 'attendance'].includes(store)) {
      window[store] = mergedData;
      
      // Special logic for categories: update dynamic select options across the app
      if (store === 'categories') {
        const activeCats = mergedData.filter(c => !c._deleted);
        if (activeCats.length === 0) {
          // Trigger default categories seeding in background
          window.seedDefaultCategories(userId).catch(e => console.error('[updateAndRender] Default categories seeding failed:', e));
        } else {
          window.categories = activeCats;
          if (typeof window.populateCategorySelects === 'function') {
            window.populateCategorySelects();
          }
          // Refresh inventory chart so stock-by-category bar is up to date
          if (typeof window.renderInventory === 'function') window.renderInventory();
        }
      }
      
      // Let the business module reload state if initialized
      if (window.biz && typeof window.biz.init === 'function') {
        window.biz.init().then(() => {
          // If current active page is the updated store, refresh it
          const currentActivePage = document.querySelector('.page.active')?.id?.replace('page-', '');
          if (currentActivePage === store) {
            // attendance uses filterAttendance, users uses loadUsers — handle both
            if (store === 'attendance' && typeof window.biz.filterAttendance === 'function') {
              window.biz.filterAttendance();
            } else {
              const renderFnName = 'filter' + store.charAt(0).toUpperCase() + store.slice(1);
              if (typeof window.biz[renderFnName] === 'function') {
                window.biz[renderFnName]();
              }
            }
          }
        });
      }
    }

    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    if (typeof window.renderReports === 'function') window.renderReports();
    if (typeof window.updateBottomNavBadge === 'function') window.updateBottomNavBadge();

    // SQLite local persistence: push incoming Cloud sync updates to local SQLite database
    if (navigator.onLine && firestoreData.length > 0 && typeof window.authenticatedFetch === 'function') {
      const payload = {};
      payload[store] = firestoreData;
      window.authenticatedFetch('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).catch(err => console.warn(`[Sync] Failed to push incoming ${store} updates to SQLite:`, err));
    }

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
    migrateOwnerId('submissions'),
    migrateOwnerId('customers'),
    migrateOwnerId('suppliers'),
    migrateOwnerId('expenses'),
    migrateOwnerId('employees'),
    migrateOwnerId('categories'),
    migrateOwnerId('purchases'),
    migrateOwnerId('attendance')
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

  // 6. Listen to customers
  const customersUnsub = window.fDb.collection(`users/${userId}/customers`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('customers', docs);
  }, err => {
    console.error("Customers sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(customersUnsub);

  // 7. Listen to suppliers
  const suppliersUnsub = window.fDb.collection(`users/${userId}/suppliers`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('suppliers', docs);
  }, err => {
    console.error("Suppliers sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(suppliersUnsub);

  // 8. Listen to expenses
  const expensesUnsub = window.fDb.collection(`users/${userId}/expenses`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('expenses', docs);
  }, err => {
    console.error("Expenses sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(expensesUnsub);

  // 9. Listen to employees
  const employeesUnsub = window.fDb.collection(`users/${userId}/employees`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('employees', docs);
  }, err => {
    console.error("Employees sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(employeesUnsub);

  // 10. Listen to categories
  const categoriesUnsub = window.fDb.collection(`users/${userId}/categories`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('categories', docs);
  }, err => {
    console.error("Categories sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(categoriesUnsub);

  // 11. Listen to purchases
  const purchasesUnsub = window.fDb.collection(`users/${userId}/purchases`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('purchases', docs);
  }, err => {
    console.error("Purchases sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(purchasesUnsub);

  // 12. Listen to attendance
  const attendanceUnsub = window.fDb.collection(`users/${userId}/attendance`).onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      d.id = doc.id;
      docs.push(d);
    });
    updateAndRender('attendance', docs);
  }, err => {
    console.error("Attendance sync error:", err);
    window.updateSyncStatus('offline');
  });
  firestoreListeners.push(attendanceUnsub);
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

// ── SHARED AUTH TOKEN HELPER ─────────────────────────────────
// Central helper used by ALL sync calls. Always returns a fresh Firebase ID token.
// Caches for up to 55 minutes to avoid redundant network calls.
window._cachedToken = null;
window._cachedTokenExpiry = 0;

window.getAuthToken = async function(force = false) {
  const user = window.fAuth ? window.fAuth.currentUser : null;
  if (!user) {
    throw new Error('[Auth] No Firebase user is currently signed in. Cannot get auth token.');
  }
  const now = Date.now();
  // Serve cached token if it has more than 2 minutes of remaining life
  if (!force && window._cachedToken && now < window._cachedTokenExpiry - 120000) {
    return window._cachedToken;
  }
  try {
    const token = await user.getIdToken(true); // force refresh from Firebase
    window._cachedToken = token;
    window._cachedTokenExpiry = now + 55 * 60 * 1000; // 55 minutes
    localStorage.setItem('token', token);
    console.log('[Auth] Firebase ID token refreshed and cached.');
    return token;
  } catch (err) {
    console.error('[Auth] getIdToken(true) failed:', err);
    // If force-refresh fails but we have a cached token, use it as last resort
    if (window._cachedToken) {
      console.warn('[Auth] Using cached token as fallback after refresh failure.');
      return window._cachedToken;
    }
    throw err;
  }
};

// Proactive token refresh — runs every 55 min so the token never expires mid-session
window._tokenRefreshTimer = null;
window.startTokenRefreshTimer = function() {
  if (window._tokenRefreshTimer) clearInterval(window._tokenRefreshTimer);
  window._tokenRefreshTimer = setInterval(async () => {
    if (window.fAuth && window.fAuth.currentUser) {
      try {
        await window.getAuthToken();
        console.log('[Auth] Proactive token refresh succeeded.');
      } catch (e) {
        console.warn('[Auth] Proactive token refresh failed:', e);
      }
    }
  }, 55 * 60 * 1000); // every 55 minutes
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

      // Fetch Firebase ID Token — force refresh on login
      try {
        const token = await user.getIdToken(true);
        window._cachedToken = token;
        window._cachedTokenExpiry = Date.now() + 55 * 60 * 1000;
        localStorage.setItem('token', token);
        console.log("[Firebase Auth] ID token obtained and cached on login.");
      } catch (tokenErr) {
        console.error("[Firebase Auth] Failed to get ID token:", tokenErr);
      }

      // Start proactive token refresh timer (refreshes every 55 min)
      window.startTokenRefreshTimer();
      
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
    const serverEmail = email.includes('@') ? email : (email === 'admin' ? 'printexengineers@gmail.com' : email);
    const passToUse = (email === 'admin' && pass === 'admin123') ? 'admin123' : pass;
    
    if (window.fAuth) {
      await window.fAuth.signInWithEmailAndPassword(serverEmail, passToUse).catch(async (authErr) => {
        if (authErr.code === 'auth/user-not-found' && serverEmail === 'printexengineers@gmail.com') {
          console.log("[Firebase Auth] Creating default admin account in Firebase...");
          await window.fAuth.createUserWithEmailAndPassword('printexengineers@gmail.com', 'admin123');
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
      const stores = ['parts', 'invoices', 'activity', 'settings', 'submissions', 'customers', 'suppliers', 'expenses', 'employees', 'categories', 'purchases'];
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
      const stores = ['parts', 'invoices', 'activity', 'settings', 'submissions', 'customers', 'suppliers', 'expenses', 'employees', 'categories', 'purchases'];
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
      window.customers = [];
      window.suppliers = [];
      window.expenses = [];
      window.employees = [];
      window.categories = [];
      window.purchases = [];
      
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

  // Ensure category dropdowns (fCat, catFilter) are populated on startup
  // Use window.categories if already loaded, otherwise load from DB
  const _populateCats = () => {
    if (window.categories && window.categories.length > 0) {
      if (typeof window.populateCategorySelects === 'function') window.populateCategorySelects();
    } else {
      // Load categories from IndexedDB and populate
      window.dbGet('categories').then(cats => {
        window.categories = (cats || []).filter(c => !c._deleted);
        if (window.categories.length === 0) {
          // Fall back to DEFAULT_CATEGORIES
          window.categories = (window.DEFAULT_CATEGORIES || []).filter(c => !c._deleted);
        }
        if (typeof window.populateCategorySelects === 'function') window.populateCategorySelects();
      }).catch(() => {
        window.categories = (window.DEFAULT_CATEGORIES || []).filter(c => !c._deleted);
        if (typeof window.populateCategorySelects === 'function') window.populateCategorySelects();
      });
    }
  };
  _populateCats();

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
  settings:'Settings',
  customers:'Customers Directory',
  suppliers:'Suppliers Registry',
  expenses:'Company Expenses',
  purchases:'Purchase Orders',
  employees:'Employee Management',
  categories:'Product Categories'
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
  
  // Business records pages rendering triggers
  if (id==='customers' && window.biz && typeof window.biz.filterCustomers === 'function') window.biz.filterCustomers();
  if (id==='suppliers' && window.biz && typeof window.biz.filterSuppliers === 'function') window.biz.filterSuppliers();
  if (id==='expenses' && window.biz && typeof window.biz.filterExpenses === 'function') window.biz.filterExpenses();
  if (id==='purchases' && window.biz && typeof window.biz.filterPurchases === 'function') window.biz.filterPurchases();
  if (id==='employees' && window.biz && typeof window.biz.filterEmployees === 'function') window.biz.filterEmployees();
  if (id==='categories' && window.biz && typeof window.biz.filterCategories === 'function') window.biz.filterCategories();
  if (id==='attendance' && window.biz && typeof window.biz.filterAttendance === 'function') window.biz.filterAttendance();
  if (id==='users' && window.biz && typeof window.biz.loadUsers === 'function') window.biz.loadUsers();
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
  
  window._isSeeding = true;
  try {
    const user = window.fAuth ? window.fAuth.currentUser : null;
    const userId = user ? user.uid : null;
    
    console.log('[seedDefaultParts] Starting seed of ' + window.DEFAULT_PARTS.length + ' default parts (merge mode)...');
    
    // 1. Read existing parts to avoid overwriting user updates or deleting custom parts
    let existingParts = [];
    if (window.db) {
      existingParts = await new Promise((resolve) => {
        const tx = window.db.transaction('parts', 'readonly');
        const req = tx.objectStore('parts').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }

    const existingPartsMap = new Map(existingParts.map(p => [String(p.id), p]));

    // 2. Write default parts to Firestore using set({merge:true})
    if (userId && window.fDb) {
      const BATCH_LIMIT = 400;
      for (let i = 0; i < window.DEFAULT_PARTS.length; i += BATCH_LIMIT) {
        const chunk = window.DEFAULT_PARTS.slice(i, i + BATCH_LIMIT);
        const writeBatch = window.fDb.batch();
        for (const dp of chunk) {
          const partId = String(dp.id);
          const existing = existingPartsMap.get(partId);
          const part = { 
            ...dp, 
            image: existing ? existing.image : null,
            stock: existing ? existing.stock : dp.stock,
            minStock: existing ? existing.minStock : dp.minStock,
            priceKsh: existing ? (existing.priceKsh || existing.price) : dp.priceKsh,
            ownerId: userId, 
            _synced: true, 
            _lastUpdated: Date.now() 
          };
          part.id = partId;
          const docRef = window.fDb.collection(`users/${userId}/parts`).doc(part.id);
          writeBatch.set(docRef, part, { merge: true });
        }
        try {
          await writeBatch.commit();
        } catch(err) {
          console.error('[seedDefaultParts] Firestore batch commit failed:', err);
        }
      }
    }
    
    // 3. Write default parts to IndexedDB
    if (window.db) {
      await new Promise((resolve, reject) => {
        const tx = window.db.transaction('parts', 'readwrite');
        const os = tx.objectStore('parts');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        
        for (const dp of window.DEFAULT_PARTS) {
          const partId = String(dp.id);
          const existing = existingPartsMap.get(partId);
          const part = { 
            ...dp, 
            image: existing ? existing.image : null,
            stock: existing ? existing.stock : dp.stock,
            minStock: existing ? existing.minStock : dp.minStock,
            priceKsh: existing ? (existing.priceKsh || existing.price) : dp.priceKsh
          };
          if (userId) {
            part.ownerId = userId;
            part._synced = true;
            part._lastUpdated = Date.now();
          }
          part.id = partId;
          os.put(part);
        }
      });
    }
    
    // 4. Update memory with all parts from IndexedDB (defaults + custom parts)
    const allParts = await window.dbGet('parts') || [];
    window.parts = allParts;
    
    // 5. Update local storage version keys
    const PARTS_VERSION = 'v4_august2025_308parts';
    localStorage.setItem('printex_parts_version_local', PARTS_VERSION);
    if (userId) {
      localStorage.setItem('printex_parts_version_' + userId, PARTS_VERSION);
    }
    localStorage.setItem('printex_parts_version', PARTS_VERSION);
    
    console.log('[seedDefaultParts] ✅ Complete: ' + window.parts.length + ' parts loaded (including custom parts).');
  } finally {
    window._isSeeding = false;
  }
};

window.populateCategorySelects = function() {
  const cats = (window.categories || []).filter(c => !c._deleted);
  const optionsHtml = cats.map(c =>
    `<option value="${window.esc(c.code || c.name)}">${window.esc(c.code || c.name)} – ${window.esc(c.name)}</option>`
  ).join('') || '<option value="">No categories defined</option>';

  // 1. Update fCat (Part Modal dropdown)
  const fCatSelect = document.getElementById('fCat');
  if (fCatSelect) {
    const prev = fCatSelect.value;
    fCatSelect.innerHTML = optionsHtml;
    if (prev) fCatSelect.value = prev; // restore selection if still valid
  }

  // 2. Update catFilter (Inventory page filter dropdown)
  const catFilterSelect = document.getElementById('catFilter');
  if (catFilterSelect) {
    const currentValue = catFilterSelect.value;
    catFilterSelect.innerHTML = '<option value="">All Categories</option>' + optionsHtml;
    catFilterSelect.value = currentValue; // restore selected value
  }

  // 3. Update any other selects with data-category-select attribute
  document.querySelectorAll('[data-category-select]').forEach(sel => {
    const prev = sel.value;
    sel.innerHTML = '<option value="">All Categories</option>' + optionsHtml;
    if (prev) sel.value = prev;
  });

  // 4. Refresh inventory chart so stock-by-category bar reflects new categories
  const invPage = document.getElementById('page-inventory');
  if (invPage && invPage.classList.contains('active') && typeof window.renderInventory === 'function') {
    window.renderInventory();
  }
};

window.seedDefaultCategories = async function(userId) {
  const defaultCats = [
    { name: 'Valves & Pneumatic Parts', code: 'A', icon: '🔧', color: '#ff6b6b' },
    { name: 'Bellows & Autoplate Parts', code: 'B', icon: '📁', color: '#ffa94d' },
    { name: 'Bearings & Gears', code: 'C', icon: '⚙️', color: '#69db7c' },
    { name: 'Cam Followers', code: 'D', icon: '⛓️', color: '#74c0fc' },
    { name: 'Grippers & Separators', code: 'E', icon: '✂️', color: '#da77f2' },
    { name: 'Heidelberg Parts', code: 'F', icon: '🖨️', color: '#f783ac' },
    { name: 'Sensors & Electronics', code: 'G', icon: '🔌', color: '#63e6be' },
    { name: 'Motors & Belts', code: 'J', icon: '🎡', color: '#ff922b' },
    { name: 'Cylinders', code: 'K', icon: '🛢️', color: '#20c997' },
    { name: 'Consumables', code: 'L', icon: '📦', color: '#fcc419' }
  ];

  console.log('[seedDefaultCategories] Seeding default categories (merge mode)...');

  // Read current categories from IndexedDB first
  let existingCats = [];
  try {
    existingCats = await window.dbGet('categories', undefined, true) || [];
  } catch (e) {
    console.warn('[seedDefaultCategories] Failed to read existing categories:', e);
  }

  const existingCodes = new Set(existingCats.map(c => String(c.code).toUpperCase()));
  const existingIds = new Set(existingCats.map(c => String(c.id)));

  // Filter defaultCats to only ones that are missing
  const missingCats = defaultCats.filter(cat => 
    !existingCodes.has(cat.code.toUpperCase()) && 
    !existingIds.has('cat_' + cat.code.toLowerCase())
  );

  if (missingCats.length === 0) {
    console.log('[seedDefaultCategories] No missing default categories to seed.');
    return;
  }

  // Write missing to IndexedDB
  if (window.db) {
    await new Promise((resolve, reject) => {
      const tx = window.db.transaction('categories', 'readwrite');
      const os = tx.objectStore('categories');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const cat of missingCats) {
        const item = { 
          ...cat, 
          id: 'cat_' + cat.code.toLowerCase(), 
          partCount: 0,
          _seen: true,
          _deleted: false,
          _flagged: false,
          _draft: false,
          _modSeq: 0,
          _synced: false,
          _lastUpdated: Date.now()
        };
        if (userId) {
          item.ownerId = userId;
          item._synced = true;
        }
        os.put(item);
      }
    });
  }

  // Write missing to Firestore
  if (userId && window.fDb) {
    const writeBatch = window.fDb.batch();
    for (const cat of missingCats) {
      const item = { 
        ...cat, 
        id: 'cat_' + cat.code.toLowerCase(), 
        partCount: 0,
        _seen: true,
        _deleted: false,
        _flagged: false,
        _draft: false,
        _modSeq: 0,
        _synced: true,
        ownerId: userId,
        _lastUpdated: Date.now()
      };
      const docRef = window.fDb.collection(`users/${userId}/categories`).doc(item.id);
      writeBatch.set(docRef, item, { merge: true });
    }
    await writeBatch.commit();
  }

  // Load into window
  const allCats = await window.dbGet('categories');
  window.categories = allCats || [];
  if (typeof window.populateCategorySelects === 'function') {
    window.populateCategorySelects();
  }
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

// ── GLOBAL SEARCH IMPLEMENTATION ────────────────────────────────────
window.showGlobalSearchDropdown = function() {
  const dropdown = document.getElementById('globalSearchDropdown');
  if (dropdown) dropdown.style.display = 'block';
};

window.hideGlobalSearchDropdown = function() {
  const dropdown = document.getElementById('globalSearchDropdown');
  if (dropdown) dropdown.style.display = 'none';
};

window.handleGlobalSearch = function(query) {
  const dropdown = document.getElementById('globalSearchDropdown');
  if (!dropdown) return;
  
  query = (query || '').trim().toLowerCase();
  if (!query) {
    dropdown.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--muted);text-align:center">Type to search across Printex...</div>';
    return;
  }

  const results = [];

  // 1. Search Parts
  const parts = window.parts || [];
  parts.forEach(p => {
    const partNum = p.partNum || p.part_num || '';
    const desc = p.desc || p.description || '';
    const supplier = p.supplier || '';
    const location = p.location || '';
    if (partNum.toLowerCase().includes(query) ||
        desc.toLowerCase().includes(query) ||
        supplier.toLowerCase().includes(query) ||
        location.toLowerCase().includes(query)) {
      results.push({
        type: 'Inventory',
        title: partNum,
        subtitle: `${desc} (${location || 'No Location'}) - Stock: ${p.stock}`,
        icon: 'fa-boxes-stacked',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'inventory'"));
          window.showPage('inventory', navEl);
          const searchInput = document.getElementById('invSearch');
          if (searchInput) {
            searchInput.value = partNum;
            window.filterInventory();
          }
        }
      });
    }
  });

  // 2. Search Categories
  const categories = window.categories || [];
  categories.forEach(c => {
    const name = c.name || '';
    const code = c.code || '';
    const description = c.description || '';
    if (name.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)) {
      results.push({
        type: 'Category',
        title: `[${code}] ${name}`,
        subtitle: description || 'Category System',
        icon: 'fa-tags',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'categories'"));
          window.showPage('categories', navEl);
          const searchInput = document.getElementById('catMgmtSearch');
          if (searchInput) {
            searchInput.value = name;
            if (window.biz && window.biz.filterCategories) window.biz.filterCategories();
          }
        }
      });
    }
  });

  // 3. Search Customers
  const customers = window.customers || [];
  customers.forEach(c => {
    const name = c.name || '';
    const company = c.company || '';
    const email = c.email || '';
    const phone = c.phone || '';
    if (name.toLowerCase().includes(query) ||
        company.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query)) {
      results.push({
        type: 'Customer',
        title: name,
        subtitle: `${company || 'Private Customer'} | Phone: ${phone || '-'}`,
        icon: 'fa-user',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'customers'"));
          window.showPage('customers', navEl);
          const searchInput = document.getElementById('custSearch');
          if (searchInput) {
            searchInput.value = name;
            if (window.biz && window.biz.filterCustomers) window.biz.filterCustomers();
          }
        }
      });
    }
  });

  // 4. Search Suppliers
  const suppliers = window.suppliers || [];
  suppliers.forEach(s => {
    const name = s.name || '';
    const contact = s.contact || '';
    const email = s.email || '';
    const phone = s.phone || '';
    if (name.toLowerCase().includes(query) ||
        contact.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query)) {
      results.push({
        type: 'Supplier',
        title: name,
        subtitle: `Contact: ${contact || '-'} | Phone: ${phone || '-'}`,
        icon: 'fa-truck-field',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'suppliers'"));
          window.showPage('suppliers', navEl);
          const searchInput = document.getElementById('supSearch');
          if (searchInput) {
            searchInput.value = name;
            if (window.biz && window.biz.filterSuppliers) window.biz.filterSuppliers();
          }
        }
      });
    }
  });

  // 5. Search Employees
  const employees = window.employees || [];
  employees.forEach(e => {
    const name = e.name || '';
    const role = e.role || '';
    const phone = e.phone || '';
    const email = e.email || '';
    const nationalId = e.nationalId || '';
    if (name.toLowerCase().includes(query) ||
        role.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        nationalId.toLowerCase().includes(query)) {
      results.push({
        type: 'Employee',
        title: name,
        subtitle: `Role: ${role} | Status: ${e.status}`,
        icon: 'fa-id-badge',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'employees'"));
          window.showPage('employees', navEl);
          const searchInput = document.getElementById('empSearch');
          if (searchInput) {
            searchInput.value = name;
            if (window.biz && window.biz.filterEmployees) window.biz.filterEmployees();
          }
        }
      });
    }
  });

  // 6. Search Purchases
  const purchases = window.purchases || [];
  purchases.forEach(p => {
    const poNumber = p.poNumber || '';
    const supplier = p.supplier || '';
    const notes = p.notes || '';
    const description = p.description || '';
    if (poNumber.toLowerCase().includes(query) ||
        supplier.toLowerCase().includes(query) ||
        notes.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)) {
      results.push({
        type: 'Purchase Order',
        title: poNumber,
        subtitle: `Supplier: ${supplier} | KSH ${p.total.toLocaleString()} | ${p.status}`,
        icon: 'fa-cart-shopping',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'purchases'"));
          window.showPage('purchases', navEl);
          const searchInput = document.getElementById('purSearch');
          if (searchInput) {
            searchInput.value = poNumber;
            if (window.biz && window.biz.filterPurchases) window.biz.filterPurchases();
          }
        }
      });
    }
  });

  // 7. Search Expenses
  const expenses = window.expenses || [];
  expenses.forEach(e => {
    const description = e.description || '';
    const category = e.category || '';
    const reference = e.reference || '';
    const notes = e.notes || '';
    if (description.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query) ||
        reference.toLowerCase().includes(query) ||
        notes.toLowerCase().includes(query)) {
      results.push({
        type: 'Expense',
        title: description,
        subtitle: `KSH ${e.amount.toLocaleString()} | Category: ${category} | ${e.date}`,
        icon: 'fa-receipt',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'expenses'"));
          window.showPage('expenses', navEl);
          const searchInput = document.getElementById('expSearch');
          if (searchInput) {
            searchInput.value = description;
            if (window.biz && window.biz.filterExpenses) window.biz.filterExpenses();
          }
        }
      });
    }
  });

  // 8. Search Reports
  const reportTitles = [
    { title: 'Inventory Valuation Report', keywords: ['valuation', 'stock value', 'inventory value', 'parts value', 'categories value'], tab: 'inventory' },
    { title: 'Financial Income Statement / Revenue Report', keywords: ['revenue', 'sales', 'profit', 'income', 'projections'], tab: 'sales' },
    { title: 'Expense Breakdown Report', keywords: ['expenses', 'cashflow', 'payments', 'spending'], tab: 'expenses' },
    { title: 'Supplier Lead Time Statistics', keywords: ['suppliers', 'lead time', 'performance', 'purchase cycles'], tab: 'suppliers' },
    { title: 'Employee Payroll & Attendance Summary', keywords: ['payroll', 'attendance', 'salaries', 'work days'], tab: 'employees' }
  ];
  reportTitles.forEach(rep => {
    if (rep.title.toLowerCase().includes(query) || rep.keywords.some(k => k.includes(query))) {
      results.push({
        type: 'Report Module',
        title: rep.title,
        subtitle: `Jump to Reports page → ${rep.title}`,
        icon: 'fa-chart-line',
        action: () => {
          const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'reports'"));
          window.showPage('reports', navEl);
          const tabBtn = Array.from(document.querySelectorAll('.report-tab-btn')).find(b => b.textContent.toLowerCase().includes(rep.tab) || b.getAttribute('onclick')?.includes(rep.tab));
          if (tabBtn) tabBtn.click();
        }
      });
    }
  });

  if (results.length === 0) {
    dropdown.innerHTML = '<div style="padding:15px;font-size:12px;color:var(--muted);text-align:center">No matches found for "' + window.esc(query) + '"</div>';
    return;
  }

  // Render search results HTML beautifully
  dropdown.innerHTML = results.map((res, index) => {
    const callbackName = 'gSearchCallback_' + index;
    window[callbackName] = () => {
      res.action();
      window.hideGlobalSearchDropdown();
      const input = document.getElementById('globalSearchInput');
      if (input) input.value = '';
    };
    return `
      <div onclick="window.${callbackName}()" 
           onmouseenter="this.style.background='var(--bg3)'" 
           onmouseleave="this.style.background='transparent'" 
           style="display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:var(--r);cursor:pointer;margin-bottom:2px;transition:background 0.15s">
        <div style="background:var(--bg3);width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--accent)">
          <i class="fa ${res.icon}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--text);display:flex;align-items:center;justify-content:space-between">
            <span>${window.esc(res.title)}</span>
            <span style="font-size:9px;background:var(--accent)1a;color:var(--accent);padding:2px 6px;border-radius:4px;font-weight:600">${res.type}</span>
          </div>
          <div style="font-size:10px;color:var(--muted);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${window.esc(res.subtitle)}</div>
        </div>
      </div>
    `;
  }).join('');
};
