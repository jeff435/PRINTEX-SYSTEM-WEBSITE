// ═══════════════════════════════════════════════════════════════════
// ANALYTICS MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

window.renderReports = function() {
  const out = window.parts.filter(p => p.stock === 0);
  const low = window.parts.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const totalValue = window.parts.reduce((s,p) => s + (p.stock * (p.priceKsh || 0)), 0);
  const invTotal = window.invoices.filter(i => i.type === 'invoice').reduce((s,i) => s + i.grand, 0);

  const kpis = document.getElementById('reportKpis');
  if (kpis) {
    kpis.innerHTML = [
      {label:'Out of Stock',value:out.length,color:'var(--danger)'},
      {label:'Low Stock',value:low.length,color:'var(--warn)'},
      {label:'Total Invoiced',value:window.formatPrice(invTotal),color:'var(--gold)'},
    ].map(k => `<div class="report-stat"><div class="report-stat-num" style="color:${k.color}">${k.value}</div><div class="report-stat-label">${k.label}</div></div>`).join('');
  }

  const outStockBody = document.getElementById('outStockBody');
  if (outStockBody) {
    outStockBody.innerHTML = out.map(p => `
      <tr><td class="part-num">${window.esc(p.partNum)}</td><td class="part-desc" style="font-size:12px">${window.esc(p.desc.slice(0,60))}</td><td>${p.minStock}</td><td style="font-size:12px;color:var(--muted)">${window.esc(p.supplier||'')}</td></tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:14px">No out-of-stock items</td></tr>';
  }

  const lowStockBody = document.getElementById('lowStockBody');
  if (lowStockBody) {
    lowStockBody.innerHTML = low.map(p => `
      <tr><td class="part-num">${window.esc(p.partNum)}</td><td class="part-desc" style="font-size:12px">${window.esc(p.desc.slice(0,55))}</td><td class="stock-low">${p.stock}</td><td>${p.minStock}</td></tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:14px">No low-stock items</td></tr>';
  }

  const salesSummary = document.getElementById('salesSummary');
  if (salesSummary) {
    const invInvoices = window.invoices.filter(i => i.type === 'invoice');
    salesSummary.innerHTML = [
      {label:'Total Invoices',value:invInvoices.length},
      {label:'Total Quotations',value:window.invoices.filter(i => i.type === 'quotation').length},
      {label:'Total Revenue',value:window.formatPrice(invInvoices.reduce((s,i) => s + i.grand, 0))},
      {label:'Average Invoice',value:invInvoices.length ? window.formatPrice(invInvoices.reduce((s,i) => s + i.grand, 0) / invInvoices.length) : window.formatPrice(0)},
    ].map(k => `<div class="report-stat"><div class="report-stat-num" style="color:var(--accent)">${k.value}</div><div class="report-stat-label">${k.label}</div></div>`).join('');
  }
};

window.csvRow = function(arr) {
  return arr.map(v => {
    const s = String(v === null || v === undefined ? '' : v);
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(',');
};

window.downloadExcelCSV = function(rows, filename) {
  const BOM = '\uFEFF';
  const csv = BOM + rows.map(window.csvRow).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.showToast(`📊 Exported: ${a.download}`, 'success');
};

window.exportCSV = function() {
  const now = new Date().toLocaleDateString('en-KE').replace(/\//g,'-');
  const header = [
    'ID','SKU / Part Number','Category','Description',
    'Current Stock','Min Stock','Price (KSH)',
    'Supplier','Warehouse Location','Stock Status'
  ];
  const rows = [header, ...window.parts.map(p => {
    const pn = p.partNum || p.part_num || '';
    const ds = p.desc || p.description || '';
    const pr = Number(p.priceKsh || p.price_ksh || 0);
    const ms = p.minStock || p.min_stock || 1;
    const st = p.stock === 0 ? 'Out of Stock' : p.stock <= ms ? 'Low Stock' : 'In Stock';
    return [p.id, pn, p.category||'', ds, p.stock||0, ms, pr, p.supplier||'', p.location||'', st];
  })];
  window.downloadExcelCSV(rows, `Printex_Inventory_${now}.csv`);
};

window.exportReportCSV = function(type) {
  const now = new Date().toLocaleDateString('en-KE').replace(/\//g,'-');
  let rows, filename;

  if (type === 'out') {
    const data = window.parts.filter(p => (p.stock||0) === 0);
    rows = [
      ['SKU / Part Number','Description','Category','Min Stock Required','Supplier','Location'],
      ...data.map(p => [
        p.partNum||p.part_num||'', p.desc||p.description||'',
        p.category||'', p.minStock||p.min_stock||1,
        p.supplier||'', p.location||''
      ])
    ];
    filename = `Printex_OutOfStock_${now}.csv`;
    if (!data.length) { window.showToast('No out-of-stock items to export', 'warn'); return; }

  } else if (type === 'low') {
    const data = window.parts.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.minStock||p.min_stock||1));
    rows = [
      ['SKU / Part Number','Description','Category','Current Stock','Min Stock','Price (KSH)','Supplier'],
      ...data.map(p => [
        p.partNum||p.part_num||'', p.desc||p.description||'',
        p.category||'', p.stock||0, p.minStock||p.min_stock||1,
        Number(p.priceKsh||p.price_ksh||0), p.supplier||''
      ])
    ];
    filename = `Printex_LowStock_${now}.csv`;
    if (!data.length) { window.showToast('No low-stock items to export', 'warn'); return; }

  } else {
    rows = [
      ['Invoice Number','Date','Customer','No. of Items','Subtotal (KSH)','VAT (KSH)','Grand Total (KSH)','Type','Status'],
      ...window.invoices.map(i => [
        i.invoiceNumber||'', i.date||'', i.customer||'',
        (i.items||[]).length,
        Math.round(i.subtotal||0),
        Math.round(i.vat||0),
        Math.round(i.grand||0),
        i.type||'invoice',
        i.paymentStatus||i.status||'draft'
      ])
    ];
    filename = `Printex_Sales_${now}.csv`;
    if (!window.invoices.length) { window.showToast('No invoices to export', 'warn'); return; }
  }

  window.downloadExcelCSV(rows, filename);
};

window.exportReportExcel = function(type) {
  const now = new Date().toLocaleDateString('en-KE').replace(/\//g,'-');
  let headers, rows, sheetName, filename;

  if (type === 'out') {
    const data = window.parts.filter(p => (p.stock||0) === 0);
    if (!data.length) { window.showToast('No out-of-stock items to export', 'warn'); return; }
    headers = ['SKU / Part Number','Description','Category','Min Stock Required','Supplier','Location'];
    rows = data.map(p => [
      p.partNum||p.part_num||'', p.desc||p.description||'',
      p.category||'', p.minStock||p.min_stock||1,
      p.supplier||'', p.location||''
    ]);
    sheetName = 'Out of Stock';
    filename = `Printex_OutOfStock_${now}.xlsx`;
  } else if (type === 'low') {
    const data = window.parts.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.minStock||p.min_stock||1));
    if (!data.length) { window.showToast('No low-stock items to export', 'warn'); return; }
    headers = ['SKU / Part Number','Description','Category','Current Stock','Min Stock','Buying Price (KSH)','Selling Price (KSH)','Supplier'];
    rows = data.map(p => [
      p.partNum||p.part_num||'', p.desc||p.description||'',
      p.category||'', p.stock||0, p.minStock||p.min_stock||1,
      Number(p.buyingPrice||p.buying_price||0),
      Number(p.priceKsh||p.price_ksh||0), p.supplier||''
    ]);
    sheetName = 'Low Stock';
    filename = `Printex_LowStock_${now}.xlsx`;
  } else {
    if (!window.invoices.length) { window.showToast('No invoices to export', 'warn'); return; }
    headers = ['Invoice Number','Date','Customer','Items','Subtotal (KSH)','VAT (KSH)','Grand Total (KSH)','Type','Payment Status'];
    rows = window.invoices.map(i => [
      i.invoiceNumber||'', i.date||'', i.customer||'',
      (i.items||[]).length,
      Math.round(i.subtotal||0), Math.round(i.vat||0), Math.round(i.grand||0),
      i.type||'invoice', i.paymentStatus||i.status||'draft'
    ]);
    sheetName = 'Sales';
    filename = `Printex_Sales_${now}.xlsx`;
  }

  window.exportToExcel(headers, rows, sheetName, filename);
};

window.exportReportPDF = function(type) {
  const now = new Date().toLocaleDateString('en-KE').replace(/\//g,'-');
  let headers, rows, filename, title;

  if (type === 'out') {
    const data = window.parts.filter(p => (p.stock||0) === 0);
    if (!data.length) { window.showToast('No out-of-stock items to export', 'warn'); return; }
    title = 'Out of Stock Parts';
    headers = ['SKU / Part Number','Description','Category','Min Stock Required','Supplier','Location'];
    rows = data.map(p => [
      p.partNum||p.part_num||'', p.desc||p.description||'',
      p.category||'', p.minStock||p.min_stock||1,
      p.supplier||'', p.location||''
    ]);
    filename = `Printex_OutOfStock_${now}.pdf`;
  } else if (type === 'low') {
    const data = window.parts.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.minStock||p.min_stock||1));
    if (!data.length) { window.showToast('No low-stock items to export', 'warn'); return; }
    title = 'Low Stock Parts';
    headers = ['SKU / Part Number','Description','Category','Current Stock','Min Stock','Price (KSH)','Supplier'];
    rows = data.map(p => [
      p.partNum||p.part_num||'', p.desc||p.description||'',
      p.category||'', p.stock||0, p.minStock||p.min_stock||1,
      Number(p.priceKsh||p.price_ksh||0), p.supplier||''
    ]);
    filename = `Printex_LowStock_${now}.pdf`;
  } else {
    if (!window.invoices.length) { window.showToast('No invoices to export', 'warn'); return; }
    title = 'Invoice / Sales Summary';
    headers = ['Invoice Number','Date','Customer','No. of Items','Subtotal (KSH)','VAT (KSH)','Grand Total (KSH)','Type','Status'];
    rows = window.invoices.map(i => [
      i.invoiceNumber||'', i.date||'', i.customer||'',
      (i.items||[]).length,
      Math.round(i.subtotal||0),
      Math.round(i.vat||0),
      Math.round(i.grand||0),
      i.type||'invoice',
      i.paymentStatus||i.status||'draft'
    ]);
    filename = `Printex_Sales_${now}.pdf`;
  }

  window.exportTableToPDF(title, headers, rows, filename);
};

window.printReport = function(type) {
  let title, headers, rows;

  if (type === 'out') {
    const data = window.parts.filter(p => (p.stock||0) === 0);
    if (!data.length) { window.showToast('No out-of-stock items to print', 'warn'); return; }
    title = 'Out of Stock Parts';
    headers = ['SKU / Part Number','Description','Category','Min Stock','Supplier','Location'];
    rows = data.map(p => [
      p.partNum||p.part_num||'', p.desc||p.description||'',
      p.category||'', p.minStock||p.min_stock||1,
      p.supplier||'', p.location||''
    ]);
  } else if (type === 'low') {
    const data = window.parts.filter(p => (p.stock||0) > 0 && (p.stock||0) <= (p.minStock||p.min_stock||1));
    if (!data.length) { window.showToast('No low-stock items to print', 'warn'); return; }
    title = 'Low Stock Parts';
    headers = ['SKU / Part Number','Description','Category','Current Stock','Min Stock','Price (KSH)','Supplier'];
    rows = data.map(p => [
      p.partNum||p.part_num||'', p.desc||p.description||'',
      p.category||'', p.stock||0, p.minStock||p.min_stock||1,
      Number(p.priceKsh||p.price_ksh||0), p.supplier||''
    ]);
  } else {
    if (!window.invoices.length) { window.showToast('No invoices to print', 'warn'); return; }
    title = 'Invoice / Sales Summary';
    headers = ['Invoice Number','Date','Customer','Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Type', 'Status'];
    rows = window.invoices.map(i => [
      i.invoiceNumber||'', i.date||'', i.customer||'',
      Math.round(i.subtotal||0),
      Math.round(i.vat||0),
      Math.round(i.grand||0),
      i.type||'invoice',
      i.paymentStatus||i.status||'draft'
    ]);
  }

  window.printTableDataset(title, headers, rows);
};

window.downloadFile = function(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── COMPANY ANALYTICS & BI ────────────────────────────────────────
window.currentAnalyticsCompany = null;
window.companyMonthlyChart = null;
window.companyCatChart = null;

window.renderAnalytics = function() {
  const searchQ = (document.getElementById('analyticsSearch')?.value || '').toLowerCase().trim();
  const dateRange = document.getElementById('analyticsDateRange')?.value || 'all';
  const typeFilter = document.getElementById('analyticsTypeFilter')?.value || '';
  const sortBy = document.getElementById('analyticsSortBy')?.value || 'spend';

  const now = Date.now();
  const filteredInvoices = window.invoices.filter(inv => {
    if (typeFilter && inv.type !== typeFilter) return false;
    if (searchQ && !inv.customer?.toLowerCase().includes(searchQ)) return false;
    if (dateRange !== 'all') {
      const days = parseInt(dateRange) || 365;
      const invDate = inv.createdAt ? new Date(inv.createdAt).getTime() : new Date(inv.date).getTime();
      if (now - invDate > days * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const companyMap = {};
  filteredInvoices.forEach(inv => {
    const comp = inv.customer?.trim() || 'Unknown Company';
    if (!companyMap[comp]) {
      companyMap[comp] = {
        name: comp,
        totalSpend: 0,
        invoiceSpend: 0,
        quoteSpend: 0,
        invoiceCount: 0,
        lastPurchaseDate: inv.date || '',
        itemsMap: {},
        typeMap: { invoice: 0, quotation: 0 }
      };
    }

    const c = companyMap[comp];
    c.totalSpend += (inv.grand || 0);
    if (inv.type === 'quotation') {
      c.quoteSpend += (inv.grand || 0);
    } else {
      c.invoiceSpend += (inv.grand || 0);
    }
    c.invoiceCount += 1;
    c.typeMap[inv.type || 'invoice'] = (c.typeMap[inv.type || 'invoice'] || 0) + 1;
    if (inv.date && inv.date > c.lastPurchaseDate) {
      c.lastPurchaseDate = inv.date;
    }

    (inv.items || []).forEach(item => {
      const pn = item.partNum || 'Unknown SKU';
      if (!c.itemsMap[pn]) {
        c.itemsMap[pn] = { partNum: pn, desc: item.desc || '', qty: 0, spend: 0 };
      }
      c.itemsMap[pn].qty += (item.qty || 0);
      c.itemsMap[pn].spend += ((item.qty || 0) * (item.price || item.unitPrice || 0));
    });
  });

  let companies = Object.values(companyMap);

  const totalActiveCompanies = companies.length;
  const totalB2BRevenue = companies.reduce((sum, c) => sum + c.totalSpend, 0);
  const avgCompanySpend = totalActiveCompanies ? totalB2BRevenue / totalActiveCompanies : 0;
  
  let topClient = { name: '—', totalSpend: 0 };
  companies.forEach(c => {
    if (c.totalSpend > topClient.totalSpend) topClient = c;
  });

  companies.sort((a, b) => {
    if (sortBy === 'spend') return b.totalSpend - a.totalSpend;
    if (sortBy === 'count') return b.invoiceCount - a.invoiceCount;
    if (sortBy === 'avg') return (b.totalSpend / b.invoiceCount) - (a.totalSpend / a.invoiceCount);
    if (sortBy === 'recent') return b.lastPurchaseDate.localeCompare(a.lastPurchaseDate);
    return 0;
  });

  const kpiBar = document.getElementById('analyticsKPIBar');
  if (kpiBar) {
    kpiBar.innerHTML = `
      <div class="analytics-kpi" style="--kpi-accent:var(--accent)">
        <div class="analytics-kpi-label">Active Client Companies</div>
        <div class="analytics-kpi-val">${totalActiveCompanies}</div>
        <div style="font-size:11px;color:var(--muted)">Matching current filters</div>
        <i class="fa fa-building analytics-kpi-icon"></i>
      </div>
      <div class="analytics-kpi" style="--kpi-accent:var(--gold)">
        <div class="analytics-kpi-label">Total B2B Revenue</div>
        <div class="analytics-kpi-val">${window.formatPrice(totalB2BRevenue)}</div>
        <div style="font-size:11px;color:var(--muted)">Cumulative order volume</div>
        <i class="fa fa-coins analytics-kpi-icon"></i>
      </div>
      <div class="analytics-kpi" style="--kpi-accent:var(--success)">
        <div class="analytics-kpi-label">Average Client Value</div>
        <div class="analytics-kpi-val">${window.formatPrice(avgCompanySpend)}</div>
        <div style="font-size:11px;color:var(--muted)">Spend per company</div>
        <i class="fa fa-chart-pie analytics-kpi-icon"></i>
      </div>
      <div class="analytics-kpi" style="--kpi-accent:var(--cat-d)">
        <div class="analytics-kpi-label">Top Client Company</div>
        <div class="analytics-kpi-val" style="font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${window.esc(topClient.name)}">${window.esc(topClient.name)}</div>
        <div style="font-size:11px;color:var(--muted)">${window.formatPrice(topClient.totalSpend)}</div>
        <i class="fa fa-crown analytics-kpi-icon"></i>
      </div>
    `;
  }

  const grid = document.getElementById('analyticsGrid');
  if (!grid) return;

  if (companies.length === 0) {
    grid.innerHTML = `
      <div class="analytics-empty" style="grid-column:1/-1">
        <i class="fa fa-folder-open"></i>
        <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">No Company Records Found</div>
        <div style="font-size:13px;color:var(--muted);max-width:360px;margin:0 auto">No invoices match your selected search criteria or date filters.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = companies.map(c => {
    const itemsArr = Object.values(c.itemsMap).sort((a,b) => b.qty - a.qty);
    const top3 = itemsArr.slice(0, 3);
    const maxQty = top3[0]?.qty || 1;

    let insightHtml = '';
    if (c.totalSpend > 500000) {
      insightHtml = `<div class="analytics-insight" style="background:rgba(255,169,77,0.1);border-color:var(--gold);color:var(--gold)"><i class="fa fa-fire"></i> High-value VIP client with premium purchasing frequency.</div>`;
    } else if (c.typeMap.quotation > 0 && c.typeMap.invoice === 0) {
      insightHtml = `<div class="analytics-insight" style="background:rgba(116,192,252,0.1);border-color:var(--cat-d);color:var(--cat-d)"><i class="fa fa-lightbulb"></i> Proforma-heavy client (${c.typeMap.quotation} quotes). Follow up to convert to official invoices.</div>`;
    } else if (itemsArr.length > 0) {
      const topSku = itemsArr[0].partNum;
      insightHtml = `<div class="analytics-insight"><i class="fa fa-robot"></i> Primary demand for <b>${window.esc(topSku)}</b>. Recommend cross-selling compatibles.</div>`;
    } else {
      insightHtml = `<div class="analytics-insight"><i class="fa fa-chart-line"></i> Stable purchasing profile. Regular engagement recommended.</div>`;
    }

    return `
      <div class="analytics-card" onclick="openAnalyticsDetail('${window.esc(c.name)}')">
        <div class="analytics-card-header">
          <div class="analytics-avatar">${window.esc(c.name[0]?.toUpperCase() || 'C')}</div>
          <div style="min-width:0;flex:1">
            <div class="analytics-company" title="${window.esc(c.name)}">${window.esc(c.name)}</div>
            <div style="font-size:11px;color:var(--muted)">Last active: <b style="color:var(--text)">${c.lastPurchaseDate || 'N/A'}</b></div>
          </div>
          <i class="fa fa-chevron-right" style="color:var(--border2);font-size:12px"></i>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;padding:12px;background:var(--bg2);border-radius:var(--r);border:1px solid var(--border)">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:6px"><i class="fa fa-file-invoice-dollar"></i> Finalized Invoices</div>
            <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text)">${window.formatPrice(c.invoiceSpend)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.typeMap.invoice || 0} order(s) · Avg ${window.formatPrice(c.typeMap.invoice ? c.invoiceSpend / c.typeMap.invoice : 0)}</div>
          </div>
          <div style="border-left:1px solid var(--border);padding-left:12px">
            <div style="font-size:10px;font-weight:700;color:var(--cat-d);text-transform:uppercase;margin-bottom:6px"><i class="fa fa-file-contract"></i> Proforma Quotes</div>
            <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--text)">${window.formatPrice(c.quoteSpend)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.typeMap.quotation || 0} quote(s) · Avg ${window.formatPrice(c.typeMap.quotation ? c.quoteSpend / c.typeMap.quotation : 0)}</div>
          </div>
        </div>

        ${insightHtml}

        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;margin:12px 0 6px">Top Purchased Products</div>
        <div class="analytics-items-list">
          ${top3.map(item => {
            const pct = Math.round((item.qty / maxQty) * 100);
            return `
              <div class="analytics-item-row">
                <div class="analytics-item-name" title="${window.esc(item.partNum)} — ${window.esc(item.desc)}"><b>${window.esc(item.partNum)}</b> <span style="color:var(--muted)">${window.esc(item.desc)}</span></div>
                <div class="analytics-item-bar"><div class="analytics-item-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></div></div>
                <div class="analytics-item-qty">${item.qty} units</div>
              </div>
            `;
          }).join('') || '<div style="font-size:11px;color:var(--dim);font-style:italic">No item details available</div>'}
        </div>
      </div>
    `;
  }).join('');
};

window.filterAnalyticsSearch = function() {
  window.renderAnalytics();
};

window.exportAnalyticsCSV = function() {
  const searchQ = (document.getElementById('analyticsSearch')?.value || '').toLowerCase().trim();
  const dateRange = document.getElementById('analyticsDateRange')?.value || 'all';
  const typeFilter = document.getElementById('analyticsTypeFilter')?.value || '';

  const now = Date.now();
  const filteredInvoices = window.invoices.filter(inv => {
    if (typeFilter && inv.type !== typeFilter) return false;
    if (searchQ && !inv.customer?.toLowerCase().includes(searchQ)) return false;
    if (dateRange !== 'all') {
      const days = parseInt(dateRange) || 365;
      const invDate = inv.createdAt ? new Date(inv.createdAt).getTime() : new Date(inv.date).getTime();
      if (now - invDate > days * 24 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  const companyMap = {};
  filteredInvoices.forEach(inv => {
    const comp = inv.customer?.trim() || 'Unknown Company';
    if (!companyMap[comp]) {
      companyMap[comp] = { name: comp, totalSpend: 0, invoiceCount: 0, lastPurchaseDate: inv.date || '', itemsMap: {} };
    }
    const c = companyMap[comp];
    c.totalSpend += (inv.grand || 0);
    c.invoiceCount += 1;
    if (inv.date && inv.date > c.lastPurchaseDate) c.lastPurchaseDate = inv.date;
    (inv.items || []).forEach(item => {
      const pn = item.partNum || 'Unknown SKU';
      if (!c.itemsMap[pn]) c.itemsMap[pn] = { partNum: pn, desc: item.desc || '', qty: 0 };
      c.itemsMap[pn].qty += (item.qty || 0);
    });
  });

  let companies = Object.values(companyMap);
  companies.sort((a, b) => b.totalSpend - a.totalSpend);

  const header = ['Company Name', 'Total Spend (KSH)', 'Order/Quote Count', 'Avg Order Value (KSH)', 'Last Purchase Date', 'Top Purchased SKU', 'Top Purchased Qty'];
  const rows = [header, ...companies.map(c => {
    const avg = c.invoiceCount ? c.totalSpend / c.invoiceCount : 0;
    const itemsArr = Object.values(c.itemsMap).sort((a,b) => b.qty - a.qty);
    const topSku = itemsArr[0]?.partNum || '—';
    const topQty = itemsArr[0]?.qty || 0;
    return [c.name, Math.round(c.totalSpend), c.invoiceCount, Math.round(avg), c.lastPurchaseDate, topSku, topQty];
  })];

  const nowStr = new Date().toLocaleDateString('en-KE').replace(/\//g,'-');
  window.downloadExcelCSV(rows, `Printex_Company_Analytics_${nowStr}.csv`);
};

window.openAnalyticsDetail = function(companyName) {
  window.currentAnalyticsCompany = companyName;

  const compInvoices = window.invoices.filter(inv => inv.customer?.trim() === companyName);

  let totalSpend = 0;
  let totalQuoteSpend = 0;
  let totalSubtotal = 0;
  let totalVat = 0;
  let invoiceCount = 0;
  let quotationCount = 0;
  let paidCount = 0;
  let itemsMap = {};

  const monthlySpend = {};
  const monthLabels = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mLabel = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
    monthLabels.push(mLabel);
    monthlySpend[mLabel] = 0;
  }

  compInvoices.forEach(inv => {
    if (inv.type === 'quotation') {
      quotationCount++;
      totalQuoteSpend += (inv.grand || 0);
    } else {
      invoiceCount++;
      totalSpend += (inv.grand || 0);
      totalSubtotal += (inv.subtotal || 0);
      totalVat += (inv.vat || 0);
      if (inv.paymentStatus === 'paid') paidCount++;

      const invDate = inv.createdAt ? new Date(inv.createdAt) : new Date(inv.date);
      const mLabel = invDate.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
      if (monthlySpend[mLabel] !== undefined) {
        monthlySpend[mLabel] += (inv.grand || 0);
      }
    }

    (inv.items || []).forEach(item => {
      const pn = item.partNum || 'Unknown SKU';
      if (!itemsMap[pn]) {
        const matchedPart = window.parts.find(p => p.partNum === pn);
        itemsMap[pn] = {
          partNum: pn,
          desc: item.desc || '',
          category: matchedPart?.category || 'G',
          qty: 0,
          spend: 0,
          count: 0
        };
      }
      itemsMap[pn].qty += (item.qty || 0);
      itemsMap[pn].spend += ((item.qty || 0) * (item.price || item.unitPrice || 0));
      itemsMap[pn].count += 1;
    });
  });

  const avgOrder = invoiceCount ? totalSpend / invoiceCount : 0;
  const itemsArr = Object.values(itemsMap).sort((a,b) => b.qty - a.qty);
  const mostPurchased = itemsArr[0] || { partNum: '—', desc: 'No items', qty: 0, spend: 0 };
  const leastPurchased = itemsArr.length > 0 ? itemsArr[itemsArr.length - 1] : { partNum: '—', desc: 'No items', qty: 0, spend: 0 };

  // Build catSpend dynamically from all active categories
  const _activeCatsForSpend = (window.categories && window.categories.length > 0)
    ? window.categories.filter(c => !c._deleted)
    : (window.DEFAULT_CATEGORIES || []).filter(c => !c._deleted);
  const catSpend = {};
  _activeCatsForSpend.forEach(c => { catSpend[c.code || c.name] = 0; });
  itemsArr.forEach(item => {
    const key = item.category;
    if (catSpend[key] !== undefined) {
      catSpend[key] += item.spend;
    } else {
      // Unknown category — bucket into first available or ignore
      const firstKey = Object.keys(catSpend)[0];
      if (firstKey) catSpend[firstKey] += item.spend;
    }
  });

  document.getElementById('analyticsDetailTitle').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div class="analytics-avatar" style="width:42px;height:42px;font-size:18px">${window.esc(companyName[0]?.toUpperCase() || 'C')}</div>
      <div>
        <div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--text)">${window.esc(companyName)}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:500">Comprehensive Purchase Analytics & Client Profile</div>
      </div>
    </div>
  `;

  const body = document.getElementById('analyticsDetailBody');
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
      <div class="analytics-kpi" style="--kpi-accent:var(--accent);padding:12px 16px">
        <div class="analytics-kpi-label">Finalized Invoice Spend</div>
        <div class="analytics-kpi-val" style="font-size:20px">${window.formatPrice(totalSpend)}</div>
        <div style="font-size:11px;color:var(--muted)">Confirmed revenue</div>
      </div>
      <div class="analytics-kpi" style="--kpi-accent:var(--success);padding:12px 16px">
        <div class="analytics-kpi-label">Confirmed Orders</div>
        <div class="analytics-kpi-val" style="font-size:20px">${invoiceCount}</div>
        <div style="font-size:11px;color:${paidCount === invoiceCount && invoiceCount > 0 ? 'var(--success)' : 'var(--warn)'}">${paidCount} paid / ${invoiceCount - paidCount} pending</div>
      </div>
      <div class="analytics-kpi" style="--kpi-accent:var(--cat-d);padding:12px 16px">
        <div class="analytics-kpi-label">Potential Quotation Value</div>
        <div class="analytics-kpi-val" style="font-size:20px">${window.formatPrice(totalQuoteSpend)}</div>
        <div style="font-size:11px;color:var(--muted)">${quotationCount} proforma quote(s)</div>
      </div>
      <div class="analytics-kpi" style="--kpi-accent:var(--gold);padding:12px 16px">
        <div class="analytics-kpi-label">Avg Confirmed Order</div>
        <div class="analytics-kpi-val" style="font-size:20px">${window.formatPrice(avgOrder)}</div>
        <div style="font-size:11px;color:var(--muted)">Per finalized invoice</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px" class="analytics-modal-charts">
      <div class="card card-sm" style="height:260px;display:flex;flex-direction:column">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span><i class="fa fa-chart-line" style="color:var(--accent);margin-right:6px"></i> 12-Month Invoicing Velocity & Trend</span>
          <span style="font-size:10px;color:var(--muted)">Monthly spend (KSH)</span>
        </div>
        <div style="position:relative;flex:1;min-height:0">
          <canvas id="companyMonthlyCanvas"></canvas>
        </div>
      </div>

      <div class="card card-sm" style="height:260px;display:flex;flex-direction:column">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
          <span><i class="fa fa-chart-pie" style="color:var(--gold);margin-right:6px"></i> Category Share</span>
          <span style="font-size:10px;color:var(--muted)">By spend</span>
        </div>
        <div style="position:relative;flex:1;min-height:0">
          <canvas id="companyCatCanvas"></canvas>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div style="background:linear-gradient(135deg,rgba(0,230,118,0.1),rgba(0,230,118,0.02));border:1px solid var(--success);border-radius:var(--r);padding:14px 18px;display:flex;align-items:center;gap:14px">
        <div style="width:40px;height:40px;border-radius:10px;background:var(--success-dim);color:var(--success);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🔥</div>
        <div style="min-width:0;flex:1">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Most Purchased Product</div>
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${window.esc(mostPurchased.partNum)} — ${window.esc(mostPurchased.desc)}">${window.esc(mostPurchased.partNum)}</div>
          <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.esc(mostPurchased.desc)}</div>
          <div style="font-size:11px;color:var(--success);font-weight:600;margin-top:2px">${mostPurchased.qty} units total (${window.formatPrice(mostPurchased.spend)})</div>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,rgba(255,107,107,0.1),rgba(255,107,107,0.02));border:1px solid var(--danger);border-radius:var(--r);padding:14px 18px;display:flex;align-items:center;gap:14px">
        <div style="width:40px;height:40px;border-radius:10px;background:var(--danger-dim);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">❄️</div>
        <div style="min-width:0;flex:1">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Least Purchased Product</div>
          <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${window.esc(leastPurchased.partNum)} — ${window.esc(leastPurchased.desc)}">${window.esc(leastPurchased.partNum)}</div>
          <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${window.esc(leastPurchased.desc)}</div>
          <div style="font-size:11px;color:var(--danger);font-weight:600;margin-top:2px">${leastPurchased.qty} units total (${window.formatPrice(leastPurchased.spend)})</div>
        </div>
      </div>
    </div>

    <div class="card card-sm" style="padding:0;overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);background:var(--bg3);display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:13px;font-weight:700;color:var(--text)"><i class="fa fa-boxes-stacked" style="color:var(--accent);margin-right:6px"></i> Complete Product Purchase History</div>
        <div style="font-size:11px;color:var(--muted)">${itemsArr.length} unique products bought</div>
      </div>
      <div class="table-wrap" style="border:none;border-radius:0;max-height:300px;overflow-y:auto">
        <table style="min-width:600px">
          <thead>
            <tr>
              <th>SKU / Part Number</th>
              <th>Description</th>
              <th>Category</th>
              <th style="text-align:center">Order Freq</th>
              <th style="text-align:right">Total Qty</th>
              <th style="text-align:right">Total Spend (KSH)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsArr.map(item => `
              <tr>
                <td><b class="part-num" style="color:var(--text)">${window.esc(item.partNum)}</b></td>
                <td><div class="part-desc">${window.esc(item.desc)}</div></td>
                <td><span class="badge badge-cat-${item.category}">${item.category}</span></td>
                <td style="text-align:center"><span class="badge badge-muted">${item.count}x</span></td>
                <td style="text-align:right;font-weight:600">${item.qty}</td>
                <td style="text-align:right"><span class="price-ksh">${window.formatPrice(item.spend)}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:24px">No product purchase history available</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  window.openModal('analyticsDetailModal');

  setTimeout(() => {
    if (window.companyMonthlyChart) window.companyMonthlyChart.destroy();
    const ctxMonthly = document.getElementById('companyMonthlyCanvas')?.getContext('2d');
    if (ctxMonthly) {
      window.companyMonthlyChart = new Chart(ctxMonthly, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [{
            data: monthLabels.map(m => monthlySpend[m]),
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#7c3aed',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--muted)', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--muted)', font: { size: 10 }, callback: v => `${(v/1000).toFixed(0)}K` } }
          }
        }
      });
    }

    if (window.companyCatChart) window.companyCatChart.destroy();
    const ctxCat = document.getElementById('companyCatCanvas')?.getContext('2d');
    if (ctxCat) {
      const _dynCats = (window.categories && window.categories.length > 0)
        ? window.categories.filter(c => !c._deleted)
        : (window.DEFAULT_CATEGORIES || []).filter(c => !c._deleted);
      const catKeys = _dynCats.map(c => c.code || c.name);
      const catLabels = _dynCats.map(c => c.name ? c.name.split(' & ')[0].split(' ')[0] : (c.code || c.name));
      const catColors = _dynCats.map(c => c.color || window.CAT_COLORS[c.code] || '#888');
      const catData = catKeys.map(k => catSpend[k] || 0);

      window.companyCatChart = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: catData,
            backgroundColor: catColors,
            borderColor: 'var(--bg2)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'right', labels: { color: 'var(--muted)', font: { size: 10 }, boxWidth: 12 } }
          },
          cutout: '65%'
        }
      });
    }
  }, 200);
};

window.exportCompanyReport = function() {
  if (!window.currentAnalyticsCompany) return window.showToast('No company selected', 'warn');
  if (typeof html2pdf === 'undefined') {
    window.showToast('PDF generator is loading or blocked by your browser. Please try again.', 'error');
    return;
  }

  window.showToast('Generating Company Executive PDF Report...', 'info');

  const modalContent = document.getElementById('analyticsDetailModal')?.querySelector('.modal');
  if (!modalContent) return;

  const origMaxHeight = modalContent.style.maxHeight;
  const origOverflow = modalContent.style.overflow;
  const origBodyOverflow = document.getElementById('analyticsDetailBody').style.overflowY;
  const origTableMaxHeight = document.querySelector('#analyticsDetailBody .table-wrap').style.maxHeight;

  modalContent.style.maxHeight = 'none';
  modalContent.style.overflow = 'visible';
  document.getElementById('analyticsDetailBody').style.overflowY = 'visible';
  document.querySelector('#analyticsDetailBody .table-wrap').style.maxHeight = 'none';

  const opt = {
    margin: [0.4, 0.4, 0.4, 0.4],
    filename: `Printex_Executive_Report_${window.currentAnalyticsCompany.replace(/[^a-z0-9]/gi, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 820 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(modalContent).save().then(() => {
    modalContent.style.maxHeight = origMaxHeight;
    modalContent.style.overflow = origOverflow;
    document.getElementById('analyticsDetailBody').style.overflowY = origBodyOverflow;
    document.querySelector('#analyticsDetailBody .table-wrap').style.maxHeight = origTableMaxHeight;
    window.showToast(`PDF Report downloaded: ${opt.filename}`, 'success');
  }).catch(err => {
    modalContent.style.maxHeight = origMaxHeight;
    modalContent.style.overflow = origOverflow;
    document.getElementById('analyticsDetailBody').style.overflowY = origBodyOverflow;
    document.querySelector('#analyticsDetailBody .table-wrap').style.maxHeight = origTableMaxHeight;
    window.showToast('PDF error: ' + err.message, 'error');
  });
};
