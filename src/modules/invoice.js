// ═══════════════════════════════════════════════════════════════════
// INVOICE MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

window.initCreateInvoice = function() {
  window.lineItems = [];
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('invDate').value = today;
  document.getElementById('invCustomer').value = '';
  document.getElementById('invNotes').value = '';
  document.getElementById('discountPct').value = '0';
  document.getElementById('partSearch').value = '';
  window.renderLineItems();
  const prefix = 'PRINTEX-';
  document.getElementById('invNum').value = prefix + String(window.invoiceCounter).padStart(4,'0');
};

window.searchParts = function() {
  const q = (document.getElementById('partSearch')?.value || '').trim().toLowerCase();
  const list = document.getElementById('partAutocomplete');
  if (!list) return;
  if (!q) { list.style.display = 'none'; return; }

  const matches = window.parts.filter(p => {
    const pn = String(p.partNum || p.part_num || '').toLowerCase();
    const ds = String(p.desc || p.description || '').toLowerCase();
    const sp = String(p.supplier || '').toLowerCase();
    return pn.includes(q) || ds.includes(q) || sp.includes(q);
  }).slice(0, 10);

  if (!matches.length) { list.style.display = 'none'; return; }

  list.innerHTML = matches.map(p => {
    const pn = String(p.partNum || p.part_num || '');
    const ds = String(p.desc || p.description || '');
    const pr = Number(p.priceKsh || p.price_ksh || 0);
    const cat = p.category || 'G';
    const sid = String(p.id);
    
    let badgeHtml = '';
    let stockHtml = '';
    
    if (p.isService) {
      badgeHtml = `<span style="font-size:9px;background:var(--gold-dim, rgba(212,175,55,0.15));color:var(--gold,#d4af37);padding:2px 4px;border-radius:4px;margin-right:6px;font-weight:700">SERVICE</span>`;
      stockHtml = `<span style="color:var(--gold,#d4af37)">✓ Service available</span>`;
    } else {
      stockHtml = `<span style="${p.stock===0?'color:var(--danger)':p.stock<=5?'color:var(--warn)':'color:var(--success)'}">
        ${p.stock===0?'Out of stock':`${p.stock} in stock`}
      </span>`;
    }
    
    return `
    <div class="autocomplete-item" onclick="addLineItem('${sid}')" title="Click to add to invoice">
      <img src="${p.image || window.getCatImage(cat, p.id)}" class="autocomplete-thumb"
           onerror="this.src='${window.getCatImage(cat, p.id)}'"/>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:12px;color:var(--text);display:flex;align-items:center">${badgeHtml}${window.esc(pn)}</div>
        <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.esc(ds.slice(0,55))}</div>
        <div style="font-size:11px;margin-top:2px">
          <span style="color:var(--gold);font-weight:600">${window.formatPrice(pr)}</span>
          &nbsp;·&nbsp;
          ${stockHtml}
        </div>
      </div>
    </div>`;
  }).join('');
  list.style.display = 'block';
};

// Global click event to dismiss autocomplete
document.addEventListener('click', e => {
  if (!e.target.closest('#partSearch') && !e.target.closest('#partAutocomplete')) {
    const l = document.getElementById('partAutocomplete');
    if (l) l.style.display = 'none';
  }
});

window.addLineItem = function(partId) {
  const part = window.parts.find(p => String(p.id) === String(partId));
  if (!part) { window.showToast('Part not found — try refreshing the page', 'error'); return; }

  const pn = String(part.partNum || part.part_num || '');
  const ds = String(part.desc || part.description || '');
  const pr = Number(part.priceKsh || part.price_ksh || 0);

  if (!part.isService && part.stock === 0) {
    if (!confirm(`⚠️ "${pn}" is OUT OF STOCK.\nAdd it to the invoice anyway (quotation only)?`)) return;
  }

  window.lineItems.push({
    partId: part.id,
    partNum: pn,
    desc: ds,
    qty: 1,
    price: pr,
    isService: part.isService || false
  });
  
  const autocomplete = document.getElementById('partAutocomplete');
  if (autocomplete) autocomplete.style.display = 'none';
  const searchInput = document.getElementById('partSearch');
  if (searchInput) searchInput.value = '';

  window.renderLineItems();
};

window.renderLineItems = function() {
  const tbody = document.getElementById('lineItemBody');
  if (!tbody) return;
  
  if (!window.lineItems.length) {
    tbody.innerHTML = '<tr id="noItemsRow"><td colspan="5" style="text-align:center;color:var(--dim);padding:20px">No items added yet</td></tr>';
    window.calcTotals();
    return;
  }

  tbody.innerHTML = window.lineItems.map((item, idx) => {
    const total = item.qty * item.price;
    const badgeHtml = item.isService 
      ? `<span class="badge" style="font-size:9px;background:var(--gold-dim, rgba(212,175,55,0.15));color:var(--gold,#d4af37);padding:2px 4px;border-radius:4px;margin-right:6px;font-weight:700;display:inline-block;vertical-align:middle">SERVICE</span>`
      : '';
    return `
      <tr>
        <td>
          <div style="font-weight:600;color:var(--text);font-size:13px;display:flex;align-items:center">${badgeHtml}${window.esc(item.partNum)}</div>
          <div style="font-size:11px;color:var(--muted)">${window.esc(item.desc)}</div>
        </td>
        <td>
          <input type="number" class="input" value="${item.qty}" min="1" style="width:70px;padding:4px 8px;text-align:center" oninput="updateLineQty(${idx}, this.value)"/>
        </td>
        <td>
          <input type="number" class="input" value="${item.price}" min="0" style="width:100px;padding:4px 8px;text-align:right" oninput="updateLinePrice(${idx}, this.value)"/>
        </td>
        <td style="text-align:right;font-weight:600;color:var(--gold);vertical-align:middle">
          ${window.formatPrice(total)}
        </td>
        <td style="text-align:center;vertical-align:middle">
          <button class="btn btn-danger btn-xs" onclick="removeLineItem(${idx})" title="Remove item" style="padding:4px 8px"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  window.calcTotals();
};

window.updateLineQty = function(idx, val) {
  const qty = Number(val) || 1;
  if (window.lineItems[idx]) {
    window.lineItems[idx].qty = qty;
    window.calcTotals();
    const tbody = document.getElementById('lineItemBody');
    if (tbody && tbody.rows[idx]) {
      const cell = tbody.rows[idx].cells[3];
      if (cell) cell.textContent = window.formatPrice(qty * window.lineItems[idx].price);
    }
  }
};

window.updateLinePrice = function(idx, val) {
  const price = Number(val) || 0;
  if (window.lineItems[idx]) {
    window.lineItems[idx].price = price;
    window.calcTotals();
    const tbody = document.getElementById('lineItemBody');
    if (tbody && tbody.rows[idx]) {
      const cell = tbody.rows[idx].cells[3];
      if (cell) cell.textContent = window.formatPrice(window.lineItems[idx].qty * price);
    }
  }
};

window.removeLineItem = function(idx) {
  window.lineItems.splice(idx, 1);
  window.renderLineItems();
};

window.calcTotals = function() {
  const sub = window.lineItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const discPct = Number(document.getElementById('discountPct')?.value) || 0;
  const discVal = sub * (discPct / 100);
  const afterDisc = sub - discVal;
  const vat = afterDisc * 0.16;
  const grand = afterDisc + vat;

  const elSub = document.getElementById('totSubtotal');
  const elDisc = document.getElementById('totDiscount');
  const elAfter = document.getElementById('totAfterDisc');
  const elVat = document.getElementById('totVat');
  const elGrand = document.getElementById('totGrand');

  if (elSub) elSub.textContent = window.formatPrice(sub);
  if (elDisc) elDisc.textContent = '- ' + window.formatPrice(discVal);
  if (elAfter) elAfter.textContent = window.formatPrice(afterDisc);
  if (elVat) elVat.textContent = window.formatPrice(vat);
  if (elGrand) elGrand.textContent = window.formatPrice(grand);

  return { sub, discVal, afterDisc, vat, grand };
};

window.saveInvoice = async function(type = 'invoice') {
  if (!window.lineItems.length) return window.showToast('Add parts first', 'warn');
  const customer = document.getElementById('invCustomer').value.trim() || 'Walk-in Customer';
  
  if (type === 'invoice') {
    for (const item of window.lineItems) {
      if (item.isService) continue; // Skip stock validation for services
      const part = window.parts.find(p => String(p.id) === String(item.partId));
      if (part && part.stock < item.qty) {
        return window.showToast(`Not enough stock for ${item.partNum}!`, 'error');
      }
    }
  }

  const tots = window.calcTotals();
  const invRecord = {
    id: String(Date.now()),
    type: type, // 'invoice' or 'quotation'
    invoiceNumber: document.getElementById('invNum').value,
    timestamp: Date.now(),
    date: document.getElementById('invDate').value,
    customer: customer,
    notes: document.getElementById('invNotes').value,
    discountPct: Number(document.getElementById('discountPct').value),
    items: JSON.parse(JSON.stringify(window.lineItems)),
    subtotal: tots.sub,
    discountAmt: tots.discVal,
    vat: tots.vat,
    grand: tots.grand,
    paymentStatus: 'pending',
    paymentRef: null,
    paidAt: null
  };

  if (type === 'invoice') {
    for (const item of window.lineItems) {
      if (item.isService) continue; // Skip stock deduction for services
      const part = window.parts.find(p => String(p.id) === String(item.partId));
      if (part) {
        part.stock = Math.max(0, part.stock - item.qty);
        // Instant non-blocking local-first write!
        await window.dbPut('parts', part);
      }
    }
  }

  window.invoices.push(invRecord);
  await window.dbPut('invoices', invRecord);

  // Push to public_deliveries for Rider tracking asynchronously
  if (type === 'invoice' && window.fDb) {
    try {
      window.fDb.collection('public_deliveries').doc(String(invRecord.id)).set({
        invoiceNumber: invRecord.invoiceNumber,
        customer: invRecord.customer,
        grand: invRecord.grand,
        paymentStatus: invRecord.paymentStatus,
        deliveryStatus: 'pending',
        createdAt: Date.now()
      });
    } catch(e) { console.error("Sync error to public_deliveries", e); }
  }

  window.invoiceCounter++;
  await window.dbPut('settings', {key: 'invoiceCounter', value: window.invoiceCounter});

  await window.logActivity(`${type === 'invoice' ? 'Invoice' : 'Quotation'} created: ${invRecord.invoiceNumber} for ${customer} — KSH ${Math.round(tots.grand).toLocaleString()}`, type === 'invoice' ? 'invoice' : 'quotation');

  window.renderInvoiceList();
  window.renderQuotationList();
  if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
  if (typeof window.renderInventory === 'function') window.renderInventory();
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
  
  window.showToast(`${type === 'invoice' ? 'Invoice' : 'Quotation'} saved: ${invRecord.invoiceNumber}`, 'success');
  window.initCreateInvoice();
  
  if (type === 'quotation') {
    const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'quotations'"));
    window.showPage('quotations', navEl);
  } else {
    const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'invoices'"));
    window.showPage('invoices', navEl);
  }
};

window.undoLastInvoice = async function() {
  const invoiceOnly = window.invoices.filter(i => i.type === 'invoice');
  if (!invoiceOnly.length) return window.showToast('No invoices to undo — only invoices deduct stock', 'warn');

  const last = invoiceOnly[invoiceOnly.length - 1];
  if (!last) return window.showToast('No invoices found', 'warn');

  const confirmed = confirm(
    `Undo invoice ${last.invoiceNumber}?\n\nThis will:\n• Restore stock for ${last.items.length} item(s)\n• Remove the invoice record\n\nThis cannot be undone.`
  );
  if (!confirmed) return;

  try {
    let restoredCount = 0;
    for (const item of last.items) {
      if (item.isService) continue; // Skip restock for services
      const part = window.parts.find(p => String(p.id) === String(item.partId));
      if (part) {
        part.stock = part.stock + item.qty;
        // Instant non-blocking local-first write!
        await window.dbPut('parts', part);
        restoredCount++;
      }
    }

    const deleteId = typeof last.id === 'number' ? last.id : parseInt(last.id);
    if (!isNaN(deleteId)) {
      await window.dbDelete('invoices', deleteId);
    }

    const memIdx = window.invoices.findIndex(i => i.id === last.id || i.invoiceNumber === last.invoiceNumber);
    if (memIdx >= 0) window.invoices.splice(memIdx, 1);

    await window.logActivity(`Invoice undone: ${last.invoiceNumber} — ${restoredCount} part(s) restocked`, 'delete');
    
    if (typeof window.renderInventory === 'function') window.renderInventory();
    window.renderInvoiceList();
    window.renderQuotationList();
    if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    
    window.showToast(`✓ Invoice ${last.invoiceNumber} undone — stock restored for ${restoredCount} part(s)`, 'success');
  } catch(e) {
    console.error('Undo error:', e);
    window.showToast('Undo failed: ' + e.message, 'error');
  }
};

window.renderInvoiceList = function(filtered) {
  const allInvoices = window.invoices.filter(inv => inv.type === 'invoice');
  const list = filtered || allInvoices;
  
  // Calculate Invoice KPIs
  const totalInvoices = allInvoices.length;
  const totalRevenue = allInvoices.reduce((sum, inv) => sum + (inv.grand || 0), 0);
  const paidInvoices = allInvoices.filter(inv => inv.paymentStatus === 'paid');
  const paidRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.grand || 0), 0);
  const pendingRevenue = totalRevenue - paidRevenue;
  
  const kpiGrid = document.getElementById('invoiceKpiGrid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card" style="--kpi-color:var(--accent)">
        <div class="kpi-label">Finalized Invoices</div>
        <div class="kpi-value" style="color:var(--accent)">${totalInvoices}</div>
        <div class="kpi-sub">Confirmed sales orders</div>
        <i class="fa fa-file-invoice-dollar kpi-icon" style="color:var(--accent)"></i>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--gold)">
        <div class="kpi-label">Total Revenue</div>
        <div class="kpi-value" style="color:var(--gold)">${window.formatPrice(totalRevenue)}</div>
        <div class="kpi-sub">Cumulative finalized volume</div>
        <i class="fa fa-coins kpi-icon" style="color:var(--gold)"></i>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--success)">
        <div class="kpi-label">Paid Revenue</div>
        <div class="kpi-value" style="color:var(--success)">${window.formatPrice(paidRevenue)}</div>
        <div class="kpi-sub">${paidInvoices.length} fully paid invoices</div>
        <i class="fa fa-check-circle kpi-icon" style="color:var(--success)"></i>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--warn)">
        <div class="kpi-label">Pending Payment</div>
        <div class="kpi-value" style="color:var(--warn)">${window.formatPrice(pendingRevenue)}</div>
        <div class="kpi-sub">${totalInvoices - paidInvoices.length} invoices pending</div>
        <i class="fa fa-clock kpi-icon" style="color:var(--warn)"></i>
      </div>
    `;
  }

  const body = document.getElementById('invoiceListBody');
  if (!body) return;
  if (list.length === 0) {
    body.innerHTML = `<tr>
      <td colspan="9">
        <div class="empty-state-container" style="padding: 40px; text-align: center;">
          <img src="/public/empty_state.png" class="empty-state-img" alt="No invoices found" style="max-width: 160px; height: auto; animation: float 5s ease-in-out infinite;" />
          <h3 style="margin: 15px 0 5px; color: var(--accent); font-size: 1.25rem;">No Finalized Invoices</h3>
          <p style="color: var(--muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">There are no finalized invoices matching the criteria.</p>
        </div>
      </td>
    </tr>`;
    return;
  }
  body.innerHTML = [...list].reverse().map(inv => {
    const isPaid = inv.paymentStatus === 'paid';
    const payBtn = isPaid
      ? `<span class="mpesa-paid-badge"><i class="fa fa-check-circle"></i> M-PESA Paid</span>`
      : `<button class="btn btn-mpesa btn-xs" onclick="openMpesaModal('${inv.id}')" title="Pay this invoice via M-Pesa STK Push"><span class="mpesa-logo"><span>M</span>-PESA</span></button>`;
    return `
    <tr id="inv-row-${inv.id}" class="${isPaid ? 'paid-row' : ''}">
      <td><b style="font-family:var(--font-mono);color:var(--accent)">${window.esc(inv.invoiceNumber)}</b></td>
      <td style="font-size:12px">${inv.date}</td>
      <td style="font-size:13px">${window.esc(inv.customer)}</td>
      <td style="font-size:12px;color:var(--muted)">${inv.items.length} item(s)</td>
      <td><span class="price-ksh">${window.formatPrice(inv.subtotal)}</span></td>
      <td><span class="price-ksh">${window.formatPrice(inv.vat||0)}</span></td>
      <td><b class="price-ksh">${window.formatPrice(inv.grand)}</b></td>
      <td>
        <span class="badge ${isPaid ? 'badge-success' : 'badge-warn'}">${isPaid ? 'PAID' : 'PENDING'}</span>
      </td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-outline btn-xs" onclick="viewInvoice('${inv.id}')" title="View"><i class="fa fa-eye"></i> View</button>
          <button class="btn btn-primary btn-xs" onclick="viewAndPrint('${inv.id}')" title="Print (A4 format)"><i class="fa fa-print"></i> Print</button>
          <button class="btn btn-success btn-xs" onclick="downloadInvoicePDF('${inv.id}')" title="Download directly as PDF"><i class="fa fa-download"></i> PDF</button>
          ${payBtn}
          <button class="btn btn-danger btn-xs" onclick="deleteInvoice('${inv.id}')" title="Delete invoice"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

window.filterInvoiceList = function() {
  const q = document.getElementById('invListSearch').value.toLowerCase();
  const allInvoices = window.invoices.filter(inv => inv.type === 'invoice');
  window.renderInvoiceList(q ? allInvoices.filter(i=>i.invoiceNumber.toLowerCase().includes(q)||i.customer.toLowerCase().includes(q)) : undefined);
};

window.renderQuotationList = function(filtered) {
  const allQuotes = window.invoices.filter(inv => inv.type === 'quotation');
  const list = filtered || allQuotes;
  
  // Calculate Quotation KPIs
  const totalQuotes = allQuotes.length;
  const potentialRevenue = allQuotes.reduce((sum, inv) => sum + (inv.grand || 0), 0);
  const avgQuote = totalQuotes ? potentialRevenue / totalQuotes : 0;
  
  const kpiGrid = document.getElementById('quotationKpiGrid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card" style="--kpi-color:var(--cat-d)">
        <div class="kpi-label">Total Quotations</div>
        <div class="kpi-value" style="color:var(--cat-d)">${totalQuotes}</div>
        <div class="kpi-sub">Proforma estimates</div>
        <i class="fa fa-file-contract kpi-icon" style="color:var(--cat-d)"></i>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--gold)">
        <div class="kpi-label">Potential Revenue</div>
        <div class="kpi-value" style="color:var(--gold)">${window.formatPrice(potentialRevenue)}</div>
        <div class="kpi-sub">Total pipeline value</div>
        <i class="fa fa-chart-line kpi-icon" style="color:var(--gold)"></i>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--success)">
        <div class="kpi-label">Average Quotation</div>
        <div class="kpi-value" style="color:var(--success)">${window.formatPrice(avgQuote)}</div>
        <div class="kpi-sub">Mean proforma value</div>
        <i class="fa fa-calculator kpi-icon" style="color:var(--success)"></i>
      </div>
      <div class="kpi-card" style="--kpi-color:var(--warn)">
        <div class="kpi-label">Pending Conversion</div>
        <div class="kpi-value" style="color:var(--warn)">${totalQuotes}</div>
        <div class="kpi-sub">Awaiting client confirmation</div>
        <i class="fa fa-user-clock kpi-icon" style="color:var(--warn)"></i>
      </div>
    `;
  }

  const body = document.getElementById('quotationListBody');
  if (!body) return;
  if (list.length === 0) {
    body.innerHTML = `<tr>
      <td colspan="9">
        <div class="empty-state-container" style="padding: 40px; text-align: center;">
          <img src="/public/empty_state.png" class="empty-state-img" alt="No quotations found" style="max-width: 160px; height: auto; animation: float 5s ease-in-out infinite;" />
          <h3 style="margin: 15px 0 5px; color: var(--accent); font-size: 1.25rem;">No Proforma Quotations</h3>
          <p style="color: var(--muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">There are no proforma quotations matching the criteria.</p>
        </div>
      </td>
    </tr>`;
    return;
  }
  body.innerHTML = [...list].reverse().map(inv => {
    return `
    <tr id="inv-row-${inv.id}">
      <td><b style="font-family:var(--font-mono);color:var(--cat-d)">${window.esc(inv.invoiceNumber)}</b></td>
      <td style="font-size:12px">${inv.date}</td>
      <td style="font-size:13px">${window.esc(inv.customer)}</td>
      <td style="font-size:12px;color:var(--muted)">${inv.items.length} item(s)</td>
      <td><span class="price-ksh">${window.formatPrice(inv.subtotal)}</span></td>
      <td><span class="price-ksh">${window.formatPrice(inv.vat||0)}</span></td>
      <td><b class="price-ksh">${window.formatPrice(inv.grand)}</b></td>
      <td>
        <span class="badge badge-gold">PROFORMA</span>
      </td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-outline btn-xs" onclick="viewInvoice('${inv.id}')" title="View"><i class="fa fa-eye"></i> View</button>
          <button class="btn btn-primary btn-xs" onclick="viewAndPrint('${inv.id}')" title="Print (A4 format)"><i class="fa fa-print"></i> Print</button>
          <button class="btn btn-success btn-xs" onclick="downloadInvoicePDF('${inv.id}')" title="Download directly as PDF"><i class="fa fa-download"></i> PDF</button>
          <button class="btn btn-danger btn-xs" onclick="deleteInvoice('${inv.id}')" title="Delete quotation"><i class="fa fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

window.filterQuotationList = function() {
  const q = document.getElementById('quotListSearch').value.toLowerCase();
  const allQuotes = window.invoices.filter(inv => inv.type === 'quotation');
  window.renderQuotationList(q ? allQuotes.filter(i=>i.invoiceNumber.toLowerCase().includes(q)||i.customer.toLowerCase().includes(q)) : undefined);
};

window.deleteInvoice = async function(id) {
  if (!confirm('Delete this record?')) return;
  const inv = window.invoices.find(i=>String(i.id)===String(id));
  if (!inv) return;
  await window.dbDelete('invoices', inv.id);
  window.invoices = window.invoices.filter(i=>String(i.id)!==String(id));
  window.renderInvoiceList();
  window.renderQuotationList();
  if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
  window.showToast('Record deleted','warn');
};

window.openModal = function(id) {
  const el = document.getElementById(id);
  if(el) el.classList.add('open');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if(el) el.classList.remove('open');
};

window.buildInvoiceHTML = function(inv, forPrinting = false) {
  const fmtN = n => window.formatPrice(n);
  const typeText = inv.type === 'invoice' ? 'INVOICE' : 'QUOTATION';
  return `
  <div style="font-family:'DM Sans',sans-serif; color:#111; padding:30px; background:#fff; max-width:760px; margin:0 auto; box-sizing: border-box; position: relative;">
    
    <table style="width:100%; border-bottom:3px solid #003366; margin-bottom:20px; padding-bottom:16px; border-collapse:collapse; border-spacing:0;">
      <tr>
        <td style="vertical-align:top; text-align:left; padding-bottom:16px;">
          <div style="font-size:22px; font-weight:800; color:#003366; letter-spacing:0.05em">PRINTEX ENGINEERS LIMITED</div>
          <div style="font-size:12px; color:#555; margin-top:4px">P.O BOX 5800-00200, NAIROBI–KENYA</div>
          <div style="font-size:12px; color:#555">PIN: P051550104M</div>
        </td>
        <td style="vertical-align:top; text-align:right; padding-bottom:16px;">
          <div style="font-size:24px; font-weight:800; color:#003366">PROFORMA ${typeText}</div>
          <div style="font-size:13px; margin-top:4px"><b>${inv.invoiceNumber}</b></div>
          <div style="font-size:12px; color:#555">Date: ${inv.date}</div>
          ${inv.type === 'invoice' ? `<div id="qr-${inv.id}" style="margin-top: 15px; display: inline-block; padding: 4px; border: 1px solid #ccc; background: #fff;"></div><div style="font-size:9px; color:#666; margin-top:4px;">Scan to Track Delivery</div>` : ''}
        </td>
      </tr>
    </table>

    <div style="margin-bottom:20px">
      <div style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.06em">Bill To</div>
      <div style="font-size:16px; font-weight:600; margin-top:2px">${window.esc(inv.customer)}</div>
      ${inv.notes ? `<div style="font-size:12px; color:#666; margin-top:4px">${window.esc(inv.notes)}</div>` : ''}
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:20px; table-layout:fixed; word-break:break-word; overflow-wrap:break-word;">
      <thead>
        <tr style="background:#003366; color:#fff">
          <th style="width:6%; padding:10px 12px; text-align:left; font-size:12px">#</th>
          <th style="width:44%; padding:10px 12px; text-align:left; font-size:12px">Description</th>
          <th style="width:10%; padding:10px 12px; text-align:center; font-size:12px">Qty</th>
          <th style="width:20%; padding:10px 12px; text-align:right; font-size:12px">Unit Price</th>
          <th style="width:20%; padding:10px 12px; text-align:right; font-size:12px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${(inv.items || []).map((item, i) => `
          <tr style="background:${i % 2 === 0 ? '#f8f8f8' : '#fff'}">
            <td style="padding:10px 12px; font-size:12px; color:#888; border-bottom:1px solid #eee; word-break:break-word; overflow-wrap:break-word;">${i + 1}</td>
            <td style="padding:10px 12px; font-size:12px; border-bottom:1px solid #eee; word-break:break-word; overflow-wrap:break-word;">
              <b>${window.esc(item.partNum)}</b><br/>
              <span style="color:#666">${window.esc(item.desc)}</span>
            </td>
            <td style="padding:10px 12px; font-size:12px; text-align:center; border-bottom:1px solid #eee; word-break:break-word; overflow-wrap:break-word;">${item.qty}</td>
            <td style="padding:10px 12px; font-size:12px; text-align:right; border-bottom:1px solid #eee; word-break:break-word; overflow-wrap:break-word; white-space:nowrap;">${fmtN(item.price || 0)}</td>
            <td style="padding:10px 12px; font-size:12px; text-align:right; font-weight:600; border-bottom:1px solid #eee; word-break:break-word; overflow-wrap:break-word; white-space:nowrap;">${fmtN(item.qty * (item.price || 0))}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div style="margin-left: auto; width: 100%; max-width: 380px; margin-bottom: 24px; font-size: 13px; font-family: 'DM Sans', sans-serif; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; padding: 6px 12px; color: #666; box-sizing: border-box;">
        <span>Subtotal</span>
        <span style="font-weight: 600; white-space: nowrap; margin-left: 20px;">${fmtN(inv.subtotal)}</span>
      </div>
      ${inv.discountPct > 0 ? `
      <div style="display: flex; justify-content: space-between; padding: 6px 12px; color: #666; box-sizing: border-box;">
        <span>Discount (${inv.discountPct}%)</span>
        <span style="font-weight: 600; color: #e53e3e; white-space: nowrap; margin-left: 20px;">- ${fmtN(inv.discountAmt)}</span>
      </div>` : ''}
      <div style="display: flex; justify-content: space-between; padding: 6px 12px; color: #666; box-sizing: border-box;">
        <span>VAT (16%)</span>
        <span style="font-weight: 600; white-space: nowrap; margin-left: 20px;">${fmtN(inv.vat)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #003366; color: #fff; font-weight: 700; font-size: 14px; border-radius: 4px; margin-top: 4px; box-sizing: border-box; align-items: center;">
        <span>GRAND TOTAL</span>
        <span style="white-space: nowrap; margin-left: 20px;">${fmtN(inv.grand)}</span>
      </div>
    </div>

    <div style="border-top:1px solid #ddd; padding-top:16px; margin-bottom:24px">
      <div style="font-size:12px; color:#003366; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px">Payment Details</div>
      <div style="font-size:12px; line-height:1.8; color:#444">
        <b>Bank:</b> NCBA BANK KENYA PLC (LUNGA LUNGA BRANCH) &nbsp;|&nbsp; <b>Account:</b> 3026970037 &nbsp;|&nbsp; <b>SWIFT:</b> CBAFKENX<br/>
        <b>Paybill:</b> 880100 &nbsp;|&nbsp; <b>Account:</b> 051501 &nbsp;|&nbsp; <b>Till Number:</b> 4977712
      </div>
    </div>

    ${!forPrinting && inv.paymentStatus !== 'paid' && inv.type === 'invoice' 
      ? `<div style="text-align:center;margin:16px 0" class="no-print"><button class="btn btn-mpesa" onclick="closeModal('viewInvModal');openMpesaModal('${inv.id}')" style="font-size:13px;padding:10px 24px">📱 Pay via M-Pesa — ${window.formatPrice(inv.grand)}</button></div>` 
      : ''
    }

    <table style="width:100%; border-top:1px solid #ddd; margin-top:24px; padding-top:20px; border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top; width:50%; padding-right:20px; padding-top:20px;">
          <div style="font-size:12px; color:#666; margin-bottom:30px">Received By:</div>
          <div style="border-top:1px solid #333; width:80%; padding-top:6px; font-size:11px; color:#666">Name & Signature</div>
        </td>
        <td style="vertical-align:top; width:50%; padding-left:20px; padding-top:20px;">
          <div style="font-size:12px; color:#666; margin-bottom:30px">Authorized By:</div>
          <div style="border-top:1px solid #333; width:80%; padding-top:6px; font-size:11px; color:#666">Signature & Date</div>
        </td>
      </tr>
    </table>

  </div>`;
};

window.generateInvoiceQR = function(inv) {
  if (inv.type !== 'invoice') return;
  const qrDiv = document.getElementById(`qr-${inv.id}`);
  if (!qrDiv || typeof QRCode === 'undefined') return;

  qrDiv.innerHTML = ''; // clear any previous QR

  const token = `sec_${inv.id}`;

  // Always use the live production URL in production, avoid localhost QR codes
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocalhost
    ? window.location.origin
    : (window.location.origin.includes('vercel.app') || window.location.origin.includes('printex'))
        ? window.location.origin
        : 'https://printex.vercel.app';

  const deliveryUrl = `${baseUrl}/delivery/${inv.id}?token=${token}`;

  new QRCode(qrDiv, {
    text: deliveryUrl,
    width: 100,
    height: 100,
    colorDark: '#003366',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

window.viewInvoice = function(id) {
  try {
    const inv = window.invoices.find(i=>String(i.id)===String(id));
    if (!inv) { window.showToast('Invoice not found','error'); return; }
    const previewBody = document.getElementById('invoicePreviewBody');
    if (!previewBody) throw new Error('Preview container not found');
    previewBody.innerHTML = window.buildInvoiceHTML(inv);
    window.generateInvoiceQR(inv);
    window._bindModalButtons(id, inv);
    window.openModal('viewInvModal');
  } catch (err) {
    console.error(err);
    alert('Error viewing invoice: ' + err.stack);
  }
};

window._bindModalButtons = function(id, inv) {
  try {
    const delBtn = document.getElementById('modalDeleteBtn');
    if (delBtn) delBtn.onclick = () => { window.closeModal('viewInvModal'); window.deleteInvoice(id); };
    
    const pdfBtn = document.getElementById('modalPdfBtn');
    if (pdfBtn) pdfBtn.onclick = () => { window.downloadInvoicePDF(id); };
    
    const mpesaBtn = document.getElementById('modalMpesaBtn');
    if (mpesaBtn) {
      if (inv.type === 'invoice' && inv.paymentStatus !== 'paid') {
        mpesaBtn.style.display = 'inline-flex';
        mpesaBtn.onclick = () => { window.closeModal('viewInvModal'); window.openMpesaModal(id); };
      } else {
        mpesaBtn.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error binding modal buttons:', err);
  }
};

window.viewAndPrint = function(id) {
  try {
    const inv = window.invoices.find(i=>String(i.id)===String(id));
    if (!inv) { window.showToast('Invoice not found','error'); return; }
    const previewBody = document.getElementById('invoicePreviewBody');
    if (!previewBody) throw new Error('Preview container not found');
    previewBody.innerHTML = window.buildInvoiceHTML(inv);
    window.generateInvoiceQR(inv);
    window._bindModalButtons(id, inv);
    window.openModal('viewInvModal');
    setTimeout(() => window.printInvoice(), 400);
  } catch (err) {
    console.error(err);
    alert('Error preparing print: ' + err.stack);
  }
};

window.downloadInvoicePDF = function(id) {
  try {
    if (typeof html2pdf === 'undefined') {
      window.showToast('PDF generator is loading or blocked by your browser. Please try again.','error');
      return;
    }
    const inv = window.invoices.find(i=>String(i.id)===String(id));
    if (!inv) { window.showToast('Invoice not found','error'); return; }
    window.showToast('Generating PDF...','info');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = window.buildInvoiceHTML(inv);
    document.body.appendChild(tempDiv);
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '760px';
    const targetElement = tempDiv.firstElementChild;
    if (targetElement) {
      targetElement.style.width = '760px';
      targetElement.style.maxWidth = 'none';
    }
    const opt = {
      margin:       [0.3, 0.3, 0.3, 0.3],
      filename:     `${inv.invoiceNumber}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(targetElement || tempDiv).save().then(() => {
      document.body.removeChild(tempDiv);
      window.showToast('PDF downloaded: ' + inv.invoiceNumber,'success');
    }).catch(err => {
      if (tempDiv.parentNode) document.body.removeChild(tempDiv);
      window.showToast('PDF error: ' + err.message,'error');
    });
  } catch (err) {
    console.error(err);
    alert('Error generating PDF: ' + err.stack);
  }
};

window.printInvoice = function() {
  try {
    const body = document.getElementById('invoicePreviewBody').innerHTML;
    const printArea = document.getElementById('printInvoiceArea');
    if (printArea) {
      printArea.innerHTML = body;
    }
    setTimeout(() => {
      window.print();
    }, 100);
  } catch (err) {
    console.error(err);
    alert('Error printing: ' + err.message);
  }
};

// ── M-PESA PAYMENTS CLIENT INTEGRATION ────────────────────────────
let mpesaCurrentInvoiceId = null;
let mpesaPollTimer = null;
const MPESA_DEFAULT_SERVER = localStorage.getItem('printex_mpesa_server') || (window.PRINTEX_CONFIG && window.PRINTEX_CONFIG.apiBase) || 'http://localhost:3000';

window.getMpesaServerUrl = function() {
  const el = document.getElementById('mpesaServerUrl');
  const url = (el ? el.value.trim() : '') || MPESA_DEFAULT_SERVER;
  localStorage.setItem('printex_mpesa_server', url);
  return url.replace(/\/$/, '');
};

window.openMpesaModal = function(invoiceId) {
  const inv = window.invoices.find(i => i.id === invoiceId || String(i.id) === String(invoiceId));
  if (!inv) return window.showToast('Invoice not found', 'error');
  mpesaCurrentInvoiceId = inv.id;

  document.getElementById('mpesaInvNum').textContent = inv.invoiceNumber;
  document.getElementById('mpesaCustomer').textContent = inv.customer;
  document.getElementById('mpesaAmount').textContent = window.formatPrice(inv.grand);

  document.getElementById('mpesaPhone').value = '';
  document.getElementById('mpesaServerUrl').value = MPESA_DEFAULT_SERVER;
  
  const urlField = document.getElementById('mpesaUrlField');
  if (urlField) urlField.style.display = 'block';
  document.getElementById('mpesaStatusBox').style.display = 'none';
  document.getElementById('mpesaStatusBox').innerHTML = '';
  document.getElementById('mpesaPhoneField').style.display = 'block';
  document.getElementById('mpesaFooter').style.display = 'flex';
  document.getElementById('mpesaSendBtn').disabled = false;

  window.renderMpesaHistory(inv.id);
  window.openModal('mpesaModal');
};

window.closeMpesaModal = function() {
  if (mpesaPollTimer) { clearInterval(mpesaPollTimer); mpesaPollTimer = null; }
  window.closeModal('mpesaModal');
};

window.renderMpesaHistory = function(invoiceId) {
  const allPayments = JSON.parse(localStorage.getItem('printex_payments') || '[]');
  const invPayments = allPayments.filter(p => String(p.invoiceId) === String(invoiceId));
  const wrap = document.getElementById('mpesaPayHistoryWrap');
  const body = document.getElementById('mpesaPayHistory');
  if (!invPayments.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  body.innerHTML = invPayments.map(p => `
    <div class="payment-history-item">
      <div>
        <div style="font-weight:500">${p.phone}</div>
        <div style="color:var(--dim);font-size:11px">${new Date(p.ts).toLocaleString('en-KE')}</div>
      </div>
      <div style="text-align:right">
        <div style="color:var(--mpesa);font-weight:600">KSH ${p.amount.toLocaleString()}</div>
        <div style="font-size:11px">Ref: ${p.mpesaRef || '—'}</div>
      </div>
      <span class="badge ${p.status === 'success' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : 'badge-warn'}">${p.status}</span>
    </div>`).join('');
};

window.savePaymentRecord = function(record) {
  const all = JSON.parse(localStorage.getItem('printex_payments') || '[]');
  all.push(record);
  localStorage.setItem('printex_payments', JSON.stringify(all));
};

window.updatePaymentRecord = function(updated) {
  const all = JSON.parse(localStorage.getItem('printex_payments') || '[]');
  const idx = all.findIndex(p => p.checkoutId === updated.checkoutId);
  if (idx >= 0) all[idx] = updated;
  localStorage.setItem('printex_payments', JSON.stringify(all));
  window.renderMpesaHistory(mpesaCurrentInvoiceId);
};

window.validateMpesaPhone = function(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('7')) return '254' + digits;
  if (digits.length === 9 && digits.startsWith('1')) return '254' + digits; // support 01XX Safaricom prefix
  if (digits.length === 10 && (digits.startsWith('07') || digits.startsWith('01'))) return '254' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('254')) return digits;
  return null;
};

window.initiateMpesaPush = async function() {
  const inv = window.invoices.find(i => i.id === mpesaCurrentInvoiceId);
  if (!inv) return;

  const rawPhone = document.getElementById('mpesaPhone').value.trim();
  const phone = window.validateMpesaPhone(rawPhone);
  if (!phone) {
    return window.showMpesaStatus('error', '❌ Invalid phone number. Enter 9 digits e.g. 712345678 or 112345678');
  }

  const amount = Math.round(inv.grand);
  const serverUrl = window.getMpesaServerUrl();
  const accountRef = inv.invoiceNumber;

  const btn = document.getElementById('mpesaSendBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="mpesa-logo">Sending…</span>';

  document.getElementById('mpesaPhoneField').style.display = 'none';
  const urlFieldEl = document.getElementById('mpesaUrlField');
  if (urlFieldEl) urlFieldEl.style.display = 'none';
  document.getElementById('mpesaFooter').style.display = 'none';

  window.showMpesaStatus('waiting', `
    <div class="mpesa-spinner"></div>
    <div style="font-weight:600;color:var(--warn);font-size:14px">Sending STK Push…</div>
    <div style="font-size:12px;color:var(--muted);margin-top:6px">A payment prompt has been sent to <b style="color:var(--text)">+${phone}</b></div>
    <div style="font-size:11px;color:var(--dim);margin-top:4px">Ask customer to enter their M-Pesa PIN on their phone</div>
  `);

  try {
    const res = await fetch(`${serverUrl}/api/mpesa/stk-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, amount, invoiceId: accountRef, tillNumber: MPESA_TILL }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Server error ${res.status}`);
    }

    const data = await res.json();
    const checkoutId = data.CheckoutRequestID || data.checkoutRequestId;

    if (!checkoutId) throw new Error('No CheckoutRequestID from server');

    const payRecord = {
      invoiceId: mpesaCurrentInvoiceId, invoiceNumber: accountRef,
      phone: '+' + phone, amount, checkoutId, status: 'pending',
      ts: Date.now(), mpesaRef: null,
    };
    window.savePaymentRecord(payRecord);

    window.showMpesaStatus('waiting', `
      <div class="mpesa-spinner"></div>
      <div style="font-weight:600;color:var(--warn);font-size:14px">Waiting for Payment…</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">Request sent to <b style="color:var(--text)">+${phone}</b></div>
      <div style="font-size:11px;color:var(--dim);margin-top:4px">CheckoutID: ${checkoutId.slice(0,16)}…</div>
      <div style="margin-top:10px;font-size:11px;color:var(--dim)">Checking status every 5 seconds…</div>
    `);

    let attempts = 0;
    const maxAttempts = 24; // 2 minutes
    mpesaPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(mpesaPollTimer);
        window.showMpesaStatus('failed', `
          <div style="font-size:24px">⏰</div>
          <div style="font-weight:600;color:var(--danger);font-size:14px;margin-top:8px">Payment Timed Out</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">No confirmation received after 2 minutes.</div>
          <button class="btn btn-mpesa" style="margin-top:12px" onclick="retryMpesaPayment()">Try Again</button>
        `);
        return;
      }

      try {
        const statusRes = await fetch(`${serverUrl}/api/mpesa/status/${checkoutId}`);
        if (!statusRes.ok) return;
        const statusData = await statusRes.json();

        if (statusData.status === 'success') {
          clearInterval(mpesaPollTimer);
          await window.markInvoicePaid(mpesaCurrentInvoiceId, statusData.mpesaRef || checkoutId);
          payRecord.status = 'success'; payRecord.mpesaRef = statusData.mpesaRef;
          window.updatePaymentRecord(payRecord);
          window.showMpesaStatus('success', `
            <div style="font-size:36px">✅</div>
            <div style="font-weight:700;color:var(--mpesa);font-size:16px;margin-top:8px">Payment Received!</div>
            <div style="font-size:13px;color:var(--text);margin-top:6px">KSH ${amount.toLocaleString()} from +${phone}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">M-Pesa Ref: ${statusData.mpesaRef || '—'}</div>
            <button class="btn btn-success" style="margin-top:12px;width:100%;justify-content:center" onclick="closeMpesaModal()">Done</button>
          `);
        } else if (statusData.status === 'failed') {
          clearInterval(mpesaPollTimer);
          payRecord.status = 'failed'; window.updatePaymentRecord(payRecord);
          window.showMpesaStatus('failed', `
            <div style="font-size:24px">❌</div>
            <div style="font-weight:600;color:var(--danger);font-size:14px;margin-top:8px">Payment Failed</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px">${statusData.message || 'Customer cancelled or insufficient balance.'}</div>
            <button class="btn btn-mpesa" style="margin-top:12px" onclick="retryMpesaPayment()">Try Again</button>
          `);
        }
      } catch(e) { }
    }, 5000);

  } catch(e) {
    window.showMpesaStatus('failed', `
      <div style="font-size:24px">❌</div>
      <div style="font-weight:600;color:var(--danger);font-size:14px;margin-top:8px">Request Failed</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${e.message}</div>
      <div style="font-size:11px;color:var(--dim);margin-top:8px">Ensure backend server is running and configured.</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn btn-outline" onclick="retryMpesaPayment()">Try Again</button>
        <button class="btn btn-success" onclick="markMpesaPaidManually()" title="Mark as paid without confirmation">Mark Paid Manually</button>
      </div>
    `);
    btn.disabled = false;
    btn.innerHTML = '<span class="mpesa-logo">Send <span>M</span>-PESA Request</span>';
    document.getElementById('mpesaPhoneField').style.display = 'block';
    const urlFieldEl = document.getElementById('mpesaUrlField');
    if (urlFieldEl) urlFieldEl.style.display = 'block';
    document.getElementById('mpesaFooter').style.display = 'flex';
  }
};

window.showMpesaStatus = function(type, html) {
  const box = document.getElementById('mpesaStatusBox');
  if (box) {
    box.style.display = 'block';
    box.className = `mpesa-status-box ${type}`;
    box.innerHTML = html;
  }
};

window.retryMpesaPayment = function() {
  if (mpesaPollTimer) { clearInterval(mpesaPollTimer); mpesaPollTimer = null; }
  const inv = window.invoices.find(i => i.id === mpesaCurrentInvoiceId);
  if (inv) window.openMpesaModal(mpesaCurrentInvoiceId);
};

window.markInvoicePaid = async function(invoiceId, mpesaRef) {
  const inv = window.invoices.find(i => i.id === invoiceId || String(i.id) === String(invoiceId));
  if (!inv) return;
  inv.paymentStatus = 'paid';
  inv.paymentRef = mpesaRef;
  inv.paidAt = new Date().toISOString();
  await window.dbPut('invoices', inv);
  window.renderInvoiceList();
  await window.logActivity(`Invoice ${inv.invoiceNumber} paid via M-Pesa (Ref: ${mpesaRef})`, 'invoice');
  window.showToast(`Invoice ${inv.invoiceNumber} marked as PAID ✓`, 'success');
};

window.markMpesaPaidManually = async function() {
  const ref = `MANUAL-${Date.now()}`;
  await window.markInvoicePaid(mpesaCurrentInvoiceId, ref);
  window.showMpesaStatus('success', `
    <div style="font-size:36px">✅</div>
    <div style="font-weight:700;color:var(--mpesa);font-size:16px;margin-top:8px">Marked as Paid</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px">Invoice manually marked as paid (${ref})</div>
    <button class="btn btn-success" style="margin-top:12px;width:100%;justify-content:center" onclick="closeMpesaModal()">Done</button>
  `);
};

// ── PAYMENT METHODS DETAILS MODAL ────────────────────────────────
const PAYMENT_INFO = {
  mpesa: { 
    icon:'📱', title:'M-Pesa STK Push', color:'var(--mpesa)',
    fields:[{label:'Till Number (Buy Goods)', value:'4977712', copy:true},{label:'Business Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
    action:{label:'Send STK Push to Customer', fn:'promptMpesaQuick()'}, note:'Customer receives a prompt on their phone to enter their M-Pesa PIN.' 
  },
  paybill: { 
    icon:'🏦', title:'Lipa na M-Pesa Paybill', color:'var(--accent)',
    fields:[{label:'Paybill Number', value:'880100', copy:true},{label:'Account Number', value:'051501', copy:true},{label:'Account Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
    note:'Customer: M-Pesa → Lipa na M-Pesa → Pay Bill → enter Paybill then Account.' 
  },
  bank: { 
    icon:'🏛️', title:'Bank Transfer (NCBA)', color:'var(--gold)',
    fields:[{label:'Bank', value:'NCBA BANK KENYA PLC', copy:false},{label:'Branch', value:'LUNGA LUNGA', copy:false},{label:'Account Number', value:'3026970037', copy:true},{label:'SWIFT Code', value:'CBAFKENX', copy:true},{label:'Account Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
    note:'Allow 1–3 business days for clearance.' 
  },
  till: { 
    icon:'📲', title:'Buy Goods (Till Number)', color:'var(--success)',
    fields:[{label:'Till Number', value:'4977712', copy:true},{label:'Business Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
    note:'Customer: M-Pesa → Lipa na M-Pesa → Buy Goods → enter Till Number.' 
  },
};

let _currentPayTool = null;
window.openPayToolModal = function(type) {
  const info = PAYMENT_INFO[type];
  if (!info) return;
  _currentPayTool = type;
  document.getElementById('payToolModalTitle').textContent = info.title;
  document.getElementById('payToolShareBtn').style.display = 'flex';
  document.getElementById('payToolModalBody').innerHTML = `
    <div class="pay-modal-header">
      <div class="pay-modal-icon">${info.icon}</div>
      <div class="pay-modal-title" style="color:${info.color}">${info.title}</div>
    </div>
    ${info.fields.map(f => `
      <div class="pay-info-row">
        <div><div class="pay-info-label">${window.esc(f.label)}</div><div class="pay-info-value">${window.esc(f.value)}</div></div>
        ${f.copy ? `<button class="copy-btn" onclick="copyPayValue('${window.esc(f.value)}',this)" title="Copy ${f.label}"><i class="fa fa-copy"></i> Copy</button>` : ''}
      </div>`).join('')}
    ${info.action ? `<button class="btn btn-mpesa" style="width:100%;justify-content:center;margin-top:8px" onclick="${info.action.fn}"><span>📱</span> ${info.action.label}</button>` : ''}
    <div style="margin-top:12px;padding:10px 12px;background:var(--bg3);border-radius:var(--r);font-size:11px;color:var(--muted);line-height:1.6">ℹ️ ${info.note}</div>`;
  window.openModal('payToolModal');
  window.logActivity(`💳 Opened ${info.title} details`);
};

window.copyPayValue = function(value, btn) {
  navigator.clipboard.writeText(value).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = value; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  }).finally(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa fa-check"></i> Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
    window.showToast(`Copied: ${value}`, 'success');
  });
};

window.sharePaymentDetails = function() {
  const info = PAYMENT_INFO[_currentPayTool];
  if (!info) return;
  const text = `PRINTEX ENGINEERS LIMITED\n${info.title}\n\n${info.fields.map(f=>`${f.label}: ${f.value}`).join('\n')}\n\n${info.note}`;
  if (navigator.share) navigator.share({ title:'Printex Payment Details', text }).catch(()=>{});
  else navigator.clipboard.writeText(text).then(() => window.showToast('All details copied ✓', 'success'));
};

window.promptMpesaQuick = function() {
  window.closeModal('payToolModal');
  const unpaid = window.invoices.filter(i => i.type==='invoice' && i.paymentStatus !== 'paid');
  if (unpaid.length) window.openMpesaModal(unpaid[unpaid.length-1].id);
  else { 
    window.showToast('No unpaid invoices. Create one first.', 'warn'); 
    const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'createInvoice'"));
    window.showPage('createInvoice', navEl); 
  }
};

window.handleAIPaymentIntent = function(msg) {
  const l = (msg||'').toLowerCase();
  if (l.includes('mpesa')||l.includes('m-pesa')||l.includes('stk')) { window.openPayToolModal('mpesa'); return true; }
  if (l.includes('paybill')) { window.openPayToolModal('paybill'); return true; }
  if (l.includes('bank')||l.includes('ncba')||l.includes('transfer')) { window.openPayToolModal('bank'); return true; }
  if (l.includes('till')) { window.openPayToolModal('till'); return true; }
  return false;
};
