// ═══════════════════════════════════════════════════════════════════
// INVENTORY MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

// ── DEFAULT_PARTS is loaded from bulk_import.js (308 parts, IDs 129-436) ──
// DO NOT redefine window.DEFAULT_PARTS here — it causes conflicts.
// window.DEFAULT_PARTS is set by bulk_import.js via window.printexBulkImportData

// Legacy line removed: the fake inline DEFAULT_PARTS (IDs 1-128 + duplicates) was overriding the real data.
// (Removed: legacy inline parts data that conflicted with bulk_import.js)

window.CAT_COLORS = {A:'#ff6b6b',B:'#ffa94d',C:'#69db7c',D:'#74c0fc',E:'#da77f2',F:'#f783ac',G:'#63e6be',J:'#ff922b',K:'#20c997',L:'#fcc419'};
window.CAT_ICONS = {
  A:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
  B:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z',
  C:'M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.92c.04-.36.07-.73.07-1.08s-.03-.71-.07-1.08l2.32-1.81c.21-.16.27-.44.13-.67l-2.2-3.81a.5.5 0 00-.61-.22l-2.74 1.1c-.57-.44-1.18-.81-1.86-1.08L14.21 3.5c-.04-.26-.27-.5-.54-.5h-4.4c-.27 0-.5.24-.54.5l-.41 2.93c-.68.27-1.3.64-1.87 1.08l-2.73-1.1a.5.5 0 00-.62.22L1.9 9.44a.5.5 0 00.13.67l2.32 1.81c-.04.37-.07.74-.07 1.08s.03.71.07 1.08L2.03 15.9a.5.5 0 00-.13.67l2.2 3.81c.12.22.39.3.62.22l2.73-1.1c.57.44 1.19.81 1.87 1.09l.41 2.92c.04.26.27.49.54.49h4.4c.27 0 .5-.23.54-.49l.41-2.92c.68-.28 1.29-.65 1.86-1.09l2.74 1.1c.23.08.49 0 .61-.22l2.2-3.81a.5.5 0 00-.13-.67l-2.32-1.81z',
  D:'M17 8C8 10 5.9 16.17 3.82 21H6c.44-1 .89-2 1.5-3H20c-.33-2.67-1.5-5-5-8 0 0 0-2-4-2-2.5 0-4 1-4 1',
  E:'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z',
  F:'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48l2.03 1.58C4.84 11.36 4.8 11.69 4.8 12s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  G:'M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.1 15.9 0 13.36 0c-1.46 0-2.35.75-3.36 1.83C9 .75 8.1 0 6.64 0 4.1 0 2 2.1 2 4.64c0 .48.1.92.18 1.36H0v14h20V6zm-9.5 12H2V8h8.5v10zm7.5 0h-5.5V8H18v10z',
  J:'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z',
  K:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z',
  L:'M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.1 15.9 0 13.36 0c-1.46 0-2.35.75-3.36 1.83C9 .75 8.1 0 6.64 0 4.1 0 2 2.1 2 4.64c0 .48.1.92.18 1.36H0v14h20V6zm-9.5 12H2V8h8.5v10zm7.5 0h-5.5V8H18v10z'
};

window.getCatImage = function(cat, partId) {
  const categoryObj = (window.categories || []).find(c => (c.code || c.name) === cat);
  const color = categoryObj?.color || window.CAT_COLORS[cat] || '#888';
  const icon = categoryObj?.icon || window.CAT_ICONS[cat] || '🏷️';
  
  let innerHtml = '';
  if (typeof icon === 'string' && icon.startsWith('M')) {
    innerHtml = `<path d="${icon}" fill="${color}" transform="translate(2,2) scale(0.83)"/>`;
  } else {
    innerHtml = `<text x="12" y="15" font-size="12" text-anchor="middle" dominant-baseline="middle">${icon}</text>`;
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="44" height="44"><rect width="24" height="24" rx="6" fill="${color}22" stroke="${color}" stroke-width="1"/><g>${innerHtml}</g></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

window.stockStatus = function(p) {
  if (p.stock===0) return {label:'Out of Stock',cls:'badge-danger'};
  if (p.stock<=p.minStock) return {label:'Low Stock',cls:'badge-warn'};
  return {label:'In Stock',cls:'badge-success'};
};

window.renderInventory = function(filtered) {
  // Exclude service items from inventory — they have their own Services page
  const physicalParts = (window.parts || []).filter(p => !p.isService);
  const list = filtered || physicalParts;
  const body = document.getElementById('invBody');
  if (!body) return;
  const lowCount = physicalParts.filter(p => p.stock > 0 && p.stock <= (p.minStock || 1)).length;
  const badge = document.getElementById('lowBadge');
  if (badge) badge.textContent = lowCount;

  if (list.length === 0) {
    body.innerHTML = `<tr>
      <td colspan="11">
        <div class="empty-state-container" style="padding: 40px; text-align: center;">
          <img src="/public/empty_state.png" class="empty-state-img" alt="No parts found" style="max-width: 160px; height: auto; animation: float 5s ease-in-out infinite;" />
          <h3 style="margin: 15px 0 5px; color: var(--accent); font-size: 1.25rem;">No Parts Found</h3>
          <p style="color: var(--muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">Try adjusting your filters, searching for something else, or creating a new part.</p>
        </div>
      </td>
    </tr>`;
    return;
  }

  const pagedList = window.paginateDataset('inventory', list, window.renderInventory);

  body.innerHTML = pagedList.map(p => {
    const st = window.stockStatus(p);
    const pn = String(p.partNum || p.part_num || '—');
    const ds = String(p.desc || p.description || '—');
    const pr = Number(p.priceKsh || p.price_ksh || 0);
    const cat = p.category || 'G';
    const img = p.image || window.getCatImage(cat, p.id);
    const sid = String(p.id);
    
    const catObj = (window.categories || []).find(c => (c.code || c.name) === cat);
    const catColor = catObj?.color || window.CAT_COLORS[cat] || '#888888';
    const catStyle = `background:${catColor}26;color:${catColor};border:1px solid ${catColor}40;`;

    return `<tr>
      <td><img src="${img}" class="part-thumb" onerror="this.src='${window.getCatImage(cat,p.id)}'" loading="lazy"/></td>
      <td><div class="part-num">${window.esc(pn)}</div></td>
      <td><div class="part-desc">${window.esc(ds)}</div></td>
      <td><span class="badge" style="${catStyle}">${cat}</span></td>
      <td>
        <div class="stock-ctrl">
          <button class="stock-btn" onclick="adjustStock('${sid}',-1)" title="Reduce stock by 1">−</button>
          <span class="stock-num ${p.stock===0?'stock-out':p.stock<=(p.minStock||1)?'stock-low':''}">${p.stock}</span>
          <button class="stock-btn" onclick="adjustStock('${sid}',1)"  title="Add 1 to stock">+</button>
        </div>
      </td>
      <td style="color:var(--muted);font-size:12px">${p.minStock||1}</td>
      <td><span class="price-ksh">${window.formatPrice(pr)}</span></td>
      <td style="font-size:12px;color:var(--muted)">${window.esc(p.supplier||'')}</td>
      <td style="font-size:11px;color:var(--dim)">${window.esc(p.location||'')}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-xs" onclick="openEditPart('${sid}')" title="Edit this part"><i class="fa fa-edit"></i></button>
          <button class="btn btn-danger btn-xs"  onclick="deletePart('${sid}')"   title="Delete this part"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

window.filterInventory = function() {
  const q = (document.getElementById('invSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('catFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';
  // Only show physical parts in inventory (not services)
  let f = (window.parts || []).filter(p => !p.isService);
  if (q) f = f.filter(p => {
    const pn = String(p.partNum||p.part_num||'').toLowerCase();
    const ds = String(p.desc||p.description||'').toLowerCase();
    const sp = String(p.supplier||'').toLowerCase();
    return pn.includes(q) || ds.includes(q) || sp.includes(q);
  });
  if (cat) f = f.filter(p => p.category === cat);
  if (status==='out') f = f.filter(p => p.stock === 0);
  else if (status==='low') f = f.filter(p => p.stock > 0 && p.stock <= (p.minStock||1));
  else if (status==='ok') f = f.filter(p => p.stock > (p.minStock||1));
  window.renderInventory(f);
};

window.adjustStock = async function(id, delta) {
  const part = window.parts.find(p => String(p.id) === String(id));
  if (!part) { window.showToast('Part not found', 'error'); return; }
  const newStock = Math.max(0, (part.stock||0) + delta);
  part.stock = newStock;
  // Debounce Firestore write for rapid +/- clicks to prevent concurrent writes
  if (typeof window.debouncedDbPut === 'function') {
    window.debouncedDbPut('parts', part, 300);
  } else {
    try { await window.dbPut('parts', part); } catch {}
  }
  const pn = part.partNum || part.part_num || String(id);
  window.logActivity(`Stock ${delta>0?'increased':'decreased'} for ${pn} → ${newStock}`, 'stock');
  window.filterInventory();
  window.showToast(`Stock updated: ${pn} → ${newStock}`, 'success');
};

window.openAddPart = function() {
  // Ensure category dropdown is populated from current window.categories
  if (typeof window.populateCategorySelects === 'function') window.populateCategorySelects();
  document.getElementById('partModalTitle').textContent = 'Add New Part';
  document.getElementById('editPartId').value = '';
  ['fPartNum','fDesc','fSupplier','fPriceKsh','fLocation','fBuyingPrice'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const fCat = document.getElementById('fCat');
  if (fCat && fCat.options.length > 0) fCat.selectedIndex = 0;
  document.getElementById('fStock').value = '0';
  document.getElementById('fMinStock').value = '1';
  document.getElementById('fImage').value = '';
  document.getElementById('imgPreview').style.display = 'none';
  openModal('partModal');
};

window.openEditPart = function(id) {
  const p = window.parts.find(x => String(x.id) === String(id));
  if (!p) { window.showToast('Part not found — try refreshing', 'error'); return; }
  // Ensure category dropdown is populated before setting the value
  if (typeof window.populateCategorySelects === 'function') window.populateCategorySelects();
  document.getElementById('partModalTitle').textContent = 'Edit Part';
  document.getElementById('editPartId').value = String(p.id);
  document.getElementById('fPartNum').value = p.partNum || p.part_num || '';
  document.getElementById('fCat').value = p.category || 'G';
  document.getElementById('fDesc').value = p.desc || p.description || '';
  document.getElementById('fStock').value = p.stock ?? 0;
  document.getElementById('fMinStock').value = p.minStock || p.min_stock || 1;
  document.getElementById('fSupplier').value = p.supplier || '';
  document.getElementById('fPriceKsh').value = p.priceKsh || p.price_ksh || '';
  const buyingPriceEl = document.getElementById('fBuyingPrice');
  if (buyingPriceEl) buyingPriceEl.value = p.buyingPrice || p.buying_price || '';
  document.getElementById('fLocation').value = p.location || '';
  const prev = document.getElementById('imgPreview');
  prev.src = p.image || window.getCatImage(p.category||'G', p.id);
  prev.style.display = 'block';
  openModal('partModal');
};

window.previewImage = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('imgPreview');
    prev.src = e.target.result;
    prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.savePart = async function() {
  const partNum = document.getElementById('fPartNum').value.trim();
  const desc = document.getElementById('fDesc').value.trim();
  if (!partNum) return window.showToast('Part number / SKU is required', 'error');
  if (!desc) return window.showToast('Description is required', 'error');

  const editIdRaw = document.getElementById('editPartId').value;
  const editId = editIdRaw || null;
  const imgFile = document.getElementById('fImage').files[0];

  const saveBtn = document.querySelector('#partModal .btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving…'; }

  const doSave = async (imgData) => {
    try {
      const bPrice = parseFloat(document.getElementById('fBuyingPrice')?.value) || 0;
      const payload = {
        partNum,
        desc,
        category: document.getElementById('fCat').value,
        stock: parseInt(document.getElementById('fStock').value) || 0,
        minStock: parseInt(document.getElementById('fMinStock').value) || 1,
        supplier: document.getElementById('fSupplier').value.trim(),
        priceKsh: parseFloat(document.getElementById('fPriceKsh').value) || 0,
        buyingPrice: bPrice,
        buying_price: bPrice,
        location: document.getElementById('fLocation').value.trim(),
        image: imgData,
      };

      if (editId) {
        if (!imgData) {
          const old = window.parts.find(p => String(p.id) === String(editId));
          if (old) payload.image = old.image || null;
        }
        payload.id = String(editId);
        const saved = await window.dbPut('parts', payload);
        payload.id = payload.id || saved;
        const idx = window.parts.findIndex(p => String(p.id) === String(editId));
        if (idx >= 0) window.parts[idx] = payload; else window.parts.push(payload);
        await window.logActivity(`Part updated: ${partNum}`, 'part');
        window.showToast(`✅ Part updated: ${partNum}`, 'success');
      } else {
        const newId = await window.dbPut('parts', payload);
        payload.id = newId;
        window.parts.push(payload);
        await window.logActivity(`Part added: ${partNum}`, 'part');
        window.showToast(`✅ Part added: ${partNum}`, 'success');
      }

      closeModal('partModal');
      window.filterInventory();
      window.renderDashboard();
    } catch(e) {
      window.showToast('Save failed: ' + e.message, 'error');
      console.error('savePart error:', e);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa fa-save"></i> Save Part'; }
    }
  };

  if (imgFile && typeof firebase !== 'undefined') {
    const storageRef = firebase.storage().ref();
    const user = firebase.auth().currentUser;
    const fileRef = storageRef.child(`users/${user ? user.uid : 'anon'}/parts/${Date.now()}_${imgFile.name}`);
    fileRef.put(imgFile).then(snapshot => {
      return snapshot.ref.getDownloadURL();
    }).then(url => {
      doSave(url);
    }).catch(err => {
      console.warn("Storage upload failed, falling back to local base64:", err);
      const reader = new FileReader();
      reader.onload = e => doSave(e.target.result);
      reader.readAsDataURL(imgFile);
    });
  } else {
    doSave(null);
  }
};

window.deletePart = async function(id) {
  const p = window.parts.find(x => String(x.id) === String(id));
  const pn = p ? (p.partNum || p.part_num || 'this part') : 'this part';
  if (!confirm(`⚠️ Delete "${pn}"?\n\nThis cannot be undone.`)) return;
  try {
    await window.dbDelete('parts', String(id));
    window.parts = window.parts.filter(x => String(x.id) !== String(id));
    await window.logActivity(`Part deleted: ${pn}`, 'delete');
    window.filterInventory();
    window.renderDashboard();
    window.showToast(`🗑️ Deleted: ${pn}`, 'warn');
  } catch(e) {
    window.showToast('Delete failed: ' + e.message, 'error');
  }
};

window.runStockAlertCheck = function() {
  const critical = window.parts.filter(p => p.stock === 0);
  const low = window.parts.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const msgs = [];
  if (critical.length) msgs.push(`🚫 **${critical.length} items out of stock:** ${critical.slice(0,5).map(p=>p.partNum).join(', ')}${critical.length>5?`…+${critical.length-5} more`:''}`);
  if (low.length) msgs.push(`⚠️ **${low.length} items low:** ${low.slice(0,5).map(p=>`${p.partNum}(${p.stock})`).join(', ')}${low.length>5?`…+${low.length-5} more`:''}`);
  return msgs.join('\n');
};

window.updateBottomNavBadge = function() {
  const lc = window.parts.filter(p => (p.stock || 0) === 0).length + window.parts.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 1)).length;
  const bb = document.getElementById('bnavLowBadge');
  if (bb) { bb.style.display = lc > 0 ? 'block' : 'none'; bb.textContent = lc; }
};

window.renderDashboard = function() {
  const physicalParts = window.parts.filter(p => !p.isService);
  const activeServices = window.parts.filter(p => p.isService);
  const totalValue = physicalParts.reduce((s,p) => s+(p.stock*(p.priceKsh||0)),0);
  const lowCount = physicalParts.filter(p=>p.stock>0&&p.stock<=p.minStock).length;
  const outCount = physicalParts.filter(p=>p.stock===0).length;
  const kpis = [
    {label:'Total Parts',value:physicalParts.length,sub:`${physicalParts.filter(p=>p.stock>0).length} in stock`,color:'var(--accent)',icon:'fa-boxes-stacked',kpiColor:'var(--accent)'},
    {label:'Total Stock Value',value:window.formatPrice(totalValue),sub:'Based on cost prices',color:'var(--gold)',icon:'fa-coins',kpiColor:'var(--gold)'},
    {label:'Low Stock Items',value:lowCount,sub:'Need reorder soon',color:'var(--warn)',icon:'fa-triangle-exclamation',kpiColor:'var(--warn)'},
    {label:'Out of Stock',value:outCount,sub:'Immediate action needed',color:'var(--danger)',icon:'fa-ban',kpiColor:'var(--danger)'},
    {label:'Active Services',value:activeServices.length,sub:'Industrial & engineering',color:'var(--gold)',icon:'fa-screwdriver-wrench',kpiColor:'var(--gold)',clickable:true}
  ];
  // Smooth value animator helper
  if (!window.animateValue) {
    window.animateValue = function(obj, start, end, duration, isMonetary) {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = Math.floor(start + progress * (end - start));
        if (isMonetary) {
          obj.innerHTML = window.formatPrice ? window.formatPrice(currentVal) : 'Ksh ' + currentVal.toLocaleString();
        } else {
          obj.innerHTML = currentVal.toLocaleString();
        }
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          if (isMonetary) {
            obj.innerHTML = window.formatPrice ? window.formatPrice(end) : 'Ksh ' + end.toLocaleString();
          } else {
            obj.innerHTML = end.toLocaleString();
          }
        }
      };
      window.requestAnimationFrame(step);
    };
  }

  const grid = document.getElementById('kpiGrid');
  if (grid) {
    grid.innerHTML = kpis.map((k, idx)=>`
      <div class="kpi-card fade-in-up stagger-${idx+1}" style="--kpi-color:${k.kpiColor}; ${k.clickable ? 'cursor:pointer' : ''}" ${k.clickable ? `onclick="window.showPage('services')"` : ''}>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" id="kpi-val-${idx}" style="color:${k.color}">0</div>
        <div class="kpi-sub">${k.sub}</div>
        <i class="fa ${k.icon} kpi-icon" style="color:${k.color}"></i>
      </div>`).join('');

    setTimeout(() => {
      kpis.forEach((k, idx) => {
        const el = document.getElementById(`kpi-val-${idx}`);
        if (!el) return;
        
        let numericValue = 0;
        let isMonetary = false;
        
        if (typeof k.value === 'number') {
          numericValue = k.value;
        } else if (typeof k.value === 'string') {
          if (k.value.indexOf('Ksh') !== -1 || k.value.indexOf('$') !== -1) {
            numericValue = parseFloat(k.value.replace(/[^0-9\.]/g, '')) || 0;
            isMonetary = true;
          } else {
            numericValue = parseFloat(k.value) || 0;
          }
        }
        
        if (numericValue > 0) {
          window.animateValue(el, 0, numericValue, 800, isMonetary);
        } else {
          el.innerHTML = k.value;
        }
      });
    }, 50);
  }

  // Use dynamic categories from DB; fall back to DEFAULT_CATEGORIES if not yet loaded
  const activeCats = (window.categories && window.categories.length > 0)
    ? window.categories.filter(c => !c._deleted)
    : (window.DEFAULT_CATEGORIES || []).filter(c => !c._deleted);
  const cats = activeCats.map(c => c.code || c.name);
  const catLabels = activeCats.map(c => c.name ? c.name.split(' & ')[0].split(' ')[0] : (c.code || c.name));
  const catStock = cats.map(code => physicalParts.filter(p => p.category === code).reduce((s,p) => s+p.stock, 0));
  const catColors = activeCats.map(c => c.color || window.CAT_COLORS[c.code] || '#888');

  const canvas1 = document.getElementById('catChart');
  if (canvas1) {
    if (window.catChart) window.catChart.destroy();
    const ctx1 = canvas1.getContext('2d');
    window.catChart = new Chart(ctx1, {
      type:'bar',
      data:{ labels:catLabels, datasets:[{data:catStock, backgroundColor:catColors.map(c=>c+'88'), borderColor:catColors, borderWidth:1.5, borderRadius:6}]},
      options:{
        responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{
          x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'var(--muted)',font:{size:10}}},
          y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'var(--muted)',font:{size:10}}}
        }
      }
    });
  }

  const canvas2 = document.getElementById('trendChart');
  if (canvas2) {
    if (window.trendChart) window.trendChart.destroy();
    const ctx2 = canvas2.getContext('2d');
    const now = Date.now();
    const trendData = [0.88,0.91,0.94,0.97,0.99,1.0].map(f => Math.round(totalValue*f));
    const trendLabels = [5,4,3,2,1,0].map(d => {
      const date = new Date(now - d*24*60*60*1000);
      return date.toLocaleDateString('en-KE',{month:'short',day:'numeric'});
    });
    window.trendChart = new Chart(ctx2, {
      type:'line',
      data:{
        labels:trendLabels,
        datasets:[{
          data:trendData, borderColor:'var(--accent)', backgroundColor:'rgba(0,212,255,0.08)',
          fill:true, tension:0.4, pointRadius:3, pointBackgroundColor:'var(--accent)'
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{
          x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'var(--muted)',font:{size:10}}},
          y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'var(--muted)',font:{size:10},callback:v=>`${(v/1000).toFixed(0)}K`}}
        }
      }
    });
  }

  const lsl = document.getElementById('lowStockList');
  if (lsl) {
    const lowParts = physicalParts.filter(p=>p.stock<=p.minStock).slice(0,6);
    lsl.innerHTML = lowParts.length ? lowParts.map(p=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <img src="${p.image||window.getCatImage(p.category,p.id)}" style="width:32px;height:32px;border-radius:6px;object-fit:cover" onerror="this.src='${window.getCatImage(p.category,p.id)}'"/>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.esc(p.partNum)}</div>
          <div style="font-size:11px;color:var(--muted)">${window.esc(p.desc.slice(0,50))}…</div>
        </div>
        <span class="badge ${p.stock===0?'badge-danger':'badge-warn'}">${p.stock}</span>
      </div>`).join('') : '<div style="color:var(--dim);text-align:center;padding:16px;font-size:13px">All stock levels healthy ✓</div>';
  }

  const af = document.getElementById('activityFeed');
  if (af) {
    const recent = [...window.activityLog].reverse().slice(0,5);
    af.innerHTML = recent.length ? recent.map(a=>`
      <div class="activity-item">
        <div class="activity-dot" style="background:${a.type==='stock'?'var(--accent)':a.type==='invoice'?'var(--gold)':a.type==='quotation'?'var(--cat-d)':a.type==='delivery'?'var(--cat-e)':a.type==='delete'?'var(--danger)':'var(--success)'}"></div>
        <div>
          <div class="activity-text">${window.esc(a.text)}</div>
          <div class="activity-time">${new Date(a.ts).toLocaleString('en-KE')}</div>
        </div>
      </div>`).join('') : '<div style="color:var(--dim);font-size:12px;padding:10px 0">No activity yet</div>';
  }
};
