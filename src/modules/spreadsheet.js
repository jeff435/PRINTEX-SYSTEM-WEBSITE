// ═══════════════════════════════════════════════════════════════════
// SPREADSHEET ENGINE MODULE - Printex Business Platform
// Provides: pagination, column sorting, Excel/XLSX export, print
// ═══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const state = {};
  const renderRegistry = {};

  function getTableState(key) {
    if (!state[key]) {
      const savedPageSize = localStorage.getItem(`printex_sheet_size_${key}`);
      state[key] = {
        currentPage: 1,
        pageSize: savedPageSize ? parseInt(savedPageSize) : 10,
        sortField: localStorage.getItem(`printex_sheet_sort_${key}`) || null,
        sortOrder: localStorage.getItem(`printex_sheet_order_${key}`) || 'asc'
      };
    }
    return state[key];
  }

  function sortDataset(list, sortField, sortOrder) {
    if (!sortField) return list;
    return [...list].sort((a, b) => {
      let valA = a[sortField], valB = b[sortField];
      if (valA == null) valA = '';
      if (valB == null) valB = '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function getContainerId(key) {
    return {
      inventory: 'invTable',
      invoices: 'invoiceListTable',
      quotations: 'quotationListTable',
      customers: 'custBody',
      suppliers: 'supBody',
      expenses: 'expBody',
      purchases: 'purBody',
      employees: 'empBody'
    }[key];
  }

  function injectPaginationUI(key, totalEntries) {
    const ts = getTableState(key);
    const containerId = getContainerId(key);
    const element = document.getElementById(containerId);
    if (!element) return;

    const tableWrap = element.tagName === 'TABLE'
      ? element.parentElement
      : element.closest('.table-wrap') || element.parentElement;
    if (!tableWrap) return;

    let ctrl = tableWrap.nextElementSibling;
    if (!ctrl || !ctrl.classList.contains('pagination-controls')) {
      ctrl = document.createElement('div');
      ctrl.className = 'pagination-controls';
      ctrl.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);flex-wrap:wrap;gap:10px;';
      tableWrap.after(ctrl);
    }

    const startIdx = totalEntries === 0 ? 0 : (ts.currentPage - 1) * ts.pageSize + 1;
    const endIdx = Math.min(totalEntries, ts.currentPage * ts.pageSize);
    const totalPages = Math.ceil(totalEntries / ts.pageSize) || 1;

    ctrl.innerHTML = `
      <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:10px;">
        <span>Showing <strong>${startIdx}–${endIdx}</strong> of <strong>${totalEntries}</strong></span>
        <select class="select" style="width:75px;padding:2px 6px;height:24px;font-size:11px;" onchange="window._sheetPageSize('${key}',this.value)">
          ${[5, 10, 25, 50, 100].map(sz => `<option value="${sz}" ${sz === ts.pageSize ? 'selected' : ''}>${sz}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn btn-outline btn-xs" ${ts.currentPage <= 1 ? 'disabled style="opacity:.3;cursor:not-allowed"' : ''} onclick="window._sheetPage('${key}',${ts.currentPage - 1})"><i class="fa fa-chevron-left"></i></button>
        <span style="font-size:12px;color:var(--text);font-family:var(--font-mono);font-weight:600;">${ts.currentPage} / ${totalPages}</span>
        <button class="btn btn-outline btn-xs" ${ts.currentPage >= totalPages ? 'disabled style="opacity:.3;cursor:not-allowed"' : ''} onclick="window._sheetPage('${key}',${ts.currentPage + 1})"><i class="fa fa-chevron-right"></i></button>
      </div>`;
  }

  function attachSortHeaders(key) {
    const containerId = getContainerId(key);
    const element = document.getElementById(containerId);
    if (!element) return;
    const table = element.tagName === 'TABLE' ? element : element.closest('table');
    if (!table) return;
    const ts = getTableState(key);

    table.querySelectorAll('thead th').forEach(th => {
      let field = th.getAttribute('data-sort');
      if (!field) {
        const txt = th.textContent.trim().toLowerCase();
        if (txt.includes('sku') || txt.includes('part')) field = 'partNum';
        else if (txt.includes('name') || txt.includes('customer') || txt.includes('supplier')) field = 'name';
        else if (txt.includes('desc')) field = 'desc';
        else if (txt.includes('stock') && !txt.includes('min')) field = 'stock';
        else if (txt.includes('price') || txt.includes('amount') || txt.includes('total') || txt.includes('grand') || txt.includes('salary')) field = 'priceKsh';
        else if (txt.includes('date')) field = 'date';
        else if (txt.includes('role')) field = 'role';
        else if (txt.includes('cat')) field = 'category';
        if (field) th.setAttribute('data-sort', field);
      }
      if (!field) return;

      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';

      let iconHtml = '<i class="fa fa-sort" style="margin-left:4px;opacity:.25;font-size:10px"></i>';
      if (ts.sortField === field) {
        iconHtml = ts.sortOrder === 'asc'
          ? '<i class="fa fa-sort-up" style="margin-left:4px;color:var(--accent);font-size:11px"></i>'
          : '<i class="fa fa-sort-down" style="margin-left:4px;color:var(--accent);font-size:11px"></i>';
      }
      let span = th.querySelector('.sort-icon');
      if (!span) { span = document.createElement('span'); span.className = 'sort-icon'; th.appendChild(span); }
      span.innerHTML = iconHtml;

      th.onclick = () => {
        if (ts.sortField === field) {
          ts.sortOrder = ts.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          ts.sortField = field;
          ts.sortOrder = 'asc';
        }
        localStorage.setItem(`printex_sheet_sort_${key}`, ts.sortField);
        localStorage.setItem(`printex_sheet_order_${key}`, ts.sortOrder);
        const fn = renderRegistry[key];
        if (typeof fn === 'function') fn();
      };
    });
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * paginateDataset(key, fullList, renderFn)
   *   - key:       string table identifier (e.g. 'inventory')
   *   - fullList:  the entire filtered array
   *   - renderFn:  the function to call on page/sort change (pass actual fn ref)
   * Returns the paged slice that should be rendered.
   */
  window.paginateDataset = function(key, list, renderFn) {
    if (typeof renderFn === 'function') renderRegistry[key] = renderFn;

    const ts = getTableState(key);

    // Map generic field names to actual record properties
    let sf = ts.sortField;
    if (sf === 'priceKsh') {
      if (key === 'invoices' || key === 'quotations') sf = 'grand';
      else if (key === 'purchases') sf = 'total';
      else if (key === 'expenses') sf = 'amount';
      else if (key === 'employees') sf = 'salary';
    }

    const sorted = sortDataset(list, sf, ts.sortOrder);
    const totalPages = Math.ceil(sorted.length / ts.pageSize) || 1;
    if (ts.currentPage > totalPages) ts.currentPage = totalPages;
    const start = (ts.currentPage - 1) * ts.pageSize;

    setTimeout(() => {
      attachSortHeaders(key);
      injectPaginationUI(key, list.length);
    }, 60);

    return sorted.slice(start, start + ts.pageSize);
  };

  window._sheetPage = function(key, page) {
    const ts = getTableState(key);
    ts.currentPage = Math.max(1, page);
    const fn = renderRegistry[key];
    if (typeof fn === 'function') fn();
  };

  window._sheetPageSize = function(key, size) {
    const ts = getTableState(key);
    ts.pageSize = parseInt(size) || 10;
    ts.currentPage = 1;
    localStorage.setItem(`printex_sheet_size_${key}`, size);
    const fn = renderRegistry[key];
    if (typeof fn === 'function') fn();
  };

  // ── Excel / XLSX export ─────────────────────────────────────────

  window.exportToExcel = function(headers, rows, sheetName, filename) {
    if (typeof XLSX === 'undefined') {
      window.showToast('Excel library still loading — please retry.', 'warn');
      return;
    }
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(String(h).length + 4, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
    XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
    window.showToast(`📊 Excel exported: ${filename}`, 'success');
  };

  // ── Print helper ────────────────────────────────────────────────

  window.printTableDataset = function(title, headers, rows) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Printex — ${title}</title>
      <style>body{font-family:'DM Sans',sans-serif;padding:24px;color:#333}
      h2{margin-bottom:2px}.sub{font-size:12px;color:#666;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{background:#f5f5f5;font-size:11px;text-transform:uppercase;font-weight:bold;border:1px solid #ddd;padding:8px 10px;text-align:left}
      td{border:1px solid #ddd;padding:8px 10px;font-size:12px}</style></head>
      <body><h2>Printex Engineers Limited — ${title}</h2>
      <div class="sub">Generated ${new Date().toLocaleString('en-KE')}</div>
      <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <script>window.print()<\/script></body></html>`);
    win.document.close();
  };

  window.exportTableToPDF = function(title, headers, rows, filename) {
    if (typeof html2pdf === 'undefined') {
      window.showToast('PDF library still loading — please retry.', 'warn');
      return;
    }
    const container = document.createElement('div');
    container.style.cssText = 'font-family:"Segoe UI",sans-serif;padding:24px;color:#333;background:#fff;';
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3b82f6;padding-bottom:12px;margin-bottom:16px;">
        <div>
          <h2 style="margin:0;font-size:22px;color:#1e3a8a;">Printex Engineers Limited</h2>
          <div style="font-size:12px;color:#666;margin-top:2px;">Business & Inventory Management Platform</div>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0;font-size:16px;color:#475569;">${title}</h3>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Generated: ${new Date().toLocaleString('en-KE')}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;">
        <thead>
          <tr style="background:#f1f5f9;color:#1e293b;border-bottom:1.5px solid #cbd5e1;">
            ${headers.map(h => `<th style="border:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-weight:700;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9;">${r.map(c => `<td style="border:1px solid #e2e8f0;padding:7px 10px;color:#334155;">${c !== null && c !== undefined ? c : ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
    
    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    
    window.showToast('Generating PDF Report...', 'info');
    html2pdf().set(opt).from(container).save().then(() => {
      window.showToast(`PDF downloaded: ${filename}`, 'success');
    }).catch(err => {
      window.showToast('PDF error: ' + err.message, 'error');
    });
  };

  window.exportToPDF = function(elementId, filename) {
    if (typeof html2pdf === 'undefined') {
      window.showToast('PDF library still loading — please retry.', 'warn');
      return;
    }
    const element = document.getElementById(elementId);
    if (!element) {
      window.showToast('Target element for PDF export not found', 'error');
      return;
    }
    const opt = {
      margin: [0.4, 0.4, 0.4, 0.4],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    window.showToast('Generating PDF Report...', 'info');
    html2pdf().set(opt).from(element).save().then(() => {
      window.showToast(`PDF downloaded: ${filename}`, 'success');
    }).catch(err => {
      window.showToast('PDF error: ' + err.message, 'error');
    });
  };

  // --- Page-specific export & print triggers ---
  window.exportInventoryExcel = function() {
    const data = (window.parts || []).filter(p => !p.isService);
    const headers = ['SKU / Part Number', 'Category', 'Description', 'Current Stock', 'Min Stock', 'Price (KSH)', 'Supplier', 'Location'];
    const rows = data.map(p => [p.partNum||'', p.category||'', p.desc||'', p.stock||0, p.minStock||0, p.priceKsh||0, p.supplier||'', p.location||'']);
    window.exportToExcel(headers, rows, 'Inventory', `Printex_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  window.exportInventoryPDF = function() {
    const data = (window.parts || []).filter(p => !p.isService);
    const headers = ['SKU / Part Number', 'Category', 'Description', 'Stock', 'Min', 'Price (KSH)', 'Supplier', 'Location'];
    const rows = data.map(p => [p.partNum||'', p.category||'', p.desc||'', p.stock||0, p.minStock||0, p.priceKsh||0, p.supplier||'', p.location||'']);
    window.exportTableToPDF('Inventory Report', headers, rows, `Printex_Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.printInventoryTable = function() {
    const data = (window.parts || []).filter(p => !p.isService);
    const headers = ['SKU / Part Number', 'Category', 'Description', 'Stock', 'Min', 'Price (KSH)', 'Supplier', 'Location'];
    const rows = data.map(p => [p.partNum||'', p.category||'', p.desc||'', p.stock||0, p.minStock||0, p.priceKsh||0, p.supplier||'', p.location||'']);
    window.printTableDataset('Inventory Report', headers, rows);
  };

  window.exportInvoicesExcel = function() {
    const data = (window.invoices || []).filter(i => i.type === 'invoice');
    const headers = ['Invoice Number', 'Date', 'Customer', 'Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Payment Status', 'Delivery Status'];
    const rows = data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft', i.deliveryStatus||'pending']);
    window.exportToExcel(headers, rows, 'Invoices', `Printex_Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  window.exportInvoicesCSV = function() {
    const data = (window.invoices || []).filter(i => i.type === 'invoice');
    const headers = ['Invoice Number', 'Date', 'Customer', 'Subtotal', 'VAT', 'Grand Total', 'Payment Status', 'Delivery Status'];
    const rows = [headers, ...data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft', i.deliveryStatus||'pending'])];
    window.downloadExcelCSV(rows, `Printex_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
  };

  window.exportInvoicesPDF = function() {
    const data = (window.invoices || []).filter(i => i.type === 'invoice');
    const headers = ['Invoice Number', 'Date', 'Customer', 'Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Payment Status'];
    const rows = data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft']);
    window.exportTableToPDF('Sales Invoices Report', headers, rows, `Printex_Invoices_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.printInvoicesTable = function() {
    const data = (window.invoices || []).filter(i => i.type === 'invoice');
    const headers = ['Invoice Number', 'Date', 'Customer', 'Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Payment Status'];
    const rows = data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft']);
    window.printTableDataset('Sales Invoices Report', headers, rows);
  };

  window.exportQuotationsExcel = function() {
    const data = (window.invoices || []).filter(i => i.type === 'quotation');
    const headers = ['Quotation Number', 'Date', 'Customer', 'Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Status'];
    const rows = data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft']);
    window.exportToExcel(headers, rows, 'Quotations', `Printex_Quotations_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  window.exportQuotationsCSV = function() {
    const data = (window.invoices || []).filter(i => i.type === 'quotation');
    const headers = ['Quotation Number', 'Date', 'Customer', 'Subtotal', 'VAT', 'Grand Total', 'Status'];
    const rows = [headers, ...data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft'])];
    window.downloadExcelCSV(rows, `Printex_Quotations_${new Date().toISOString().split('T')[0]}.csv`);
  };

  window.exportQuotationsPDF = function() {
    const data = (window.invoices || []).filter(i => i.type === 'quotation');
    const headers = ['Quotation Number', 'Date', 'Customer', 'Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Status'];
    const rows = data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft']);
    window.exportTableToPDF('Proforma Quotations Report', headers, rows, `Printex_Quotations_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.printQuotationsTable = function() {
    const data = (window.invoices || []).filter(i => i.type === 'quotation');
    const headers = ['Quotation Number', 'Date', 'Customer', 'Subtotal (KSH)', 'VAT (KSH)', 'Grand Total (KSH)', 'Status'];
    const rows = data.map(i => [i.invoiceNumber||'', i.date||'', i.customer||'', i.subtotal||0, i.vat||0, i.grand||0, i.paymentStatus||'draft']);
    window.printTableDataset('Proforma Quotations Report', headers, rows);
  };

  window.exportCustomersCSV = function() {
    const data = (window.customers || []).filter(c => !c._deleted);
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Address', 'Orders', 'Balance (KSH)', 'Notes'];
    const rows = [headers, ...data.map(c => [c.name||'', c.company||'', c.email||'', c.phone||'', c.address||'', c.orderCount||0, c.balance||0, c.notes||''])];
    window.downloadExcelCSV(rows, `Printex_Customers_${new Date().toISOString().split('T')[0]}.csv`);
  };

  window.exportCustomersPDF = function() {
    const data = (window.customers || []).filter(c => !c._deleted);
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Address', 'Orders', 'Balance (KSH)'];
    const rows = data.map(c => [c.name||'', c.company||'', c.email||'', c.phone||'', c.address||'', c.orderCount||0, c.balance||0]);
    window.exportTableToPDF('Customers Report', headers, rows, `Printex_Customers_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.exportSuppliersCSV = function() {
    const data = (window.suppliers || []).filter(s => !s._deleted);
    const headers = ['Name', 'Contact', 'Phone', 'Email', 'Products', 'Lead Days', 'Address', 'Notes'];
    const rows = [headers, ...data.map(s => [s.name||'', s.contact||'', s.phone||'', s.email||'', s.products||'', s.leadDays||'', s.address||'', s.notes||''])];
    window.downloadExcelCSV(rows, `Printex_Suppliers_${new Date().toISOString().split('T')[0]}.csv`);
  };

  window.exportSuppliersPDF = function() {
    const data = (window.suppliers || []).filter(s => !s._deleted);
    const headers = ['Name', 'Contact', 'Phone', 'Email', 'Products', 'Lead Days', 'Address'];
    const rows = data.map(s => [s.name||'', s.contact||'', s.phone||'', s.email||'', s.products||'', s.leadDays||'', s.address||'']);
    window.exportTableToPDF('Suppliers Report', headers, rows, `Printex_Suppliers_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.exportExpensesPDF = function() {
    const data = (window.expenses || []).filter(e => !e._deleted);
    const headers = ['Date', 'Description', 'Category', 'Amount (KSH)', 'Payment Method', 'Reference'];
    const rows = data.map(e => [e.date||'', e.description||'', e.category||'', e.amount||0, e.paymentMethod||'', e.reference||'']);
    window.exportTableToPDF('Expenses Report', headers, rows, `Printex_Expenses_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.exportEmployeesPDF = function() {
    const data = (window.employees || []).filter(e => !e._deleted);
    const headers = ['Name', 'Role', 'Phone', 'Email', 'Salary (KSH)', 'Start Date', 'Status'];
    const rows = data.map(e => [e.name||'', e.role||'', e.phone||'', e.email||'', e.salary||0, e.startDate||'', e.status||'active']);
    window.exportTableToPDF('Employees Report', headers, rows, `Printex_Employees_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  window.exportPurchasesCSV = function() {
    const data = (window.purchases || []).filter(p => !p._deleted);
    const headers = ['PO Number', 'Date', 'Supplier', 'Total (KSH)', 'Status', 'Expected Delivery', 'Description'];
    const rows = [headers, ...data.map(p => [p.poNumber||'', p.date||'', p.supplier||'', p.total||0, p.status||'pending', p.expectedDate||'', p.description||''])];
    window.downloadExcelCSV(rows, `Printex_Purchases_${new Date().toISOString().split('T')[0]}.csv`);
  };


  window.exportPurchasesPDF = function() {
    const data = (window.purchases || []).filter(p => !p._deleted);
    const headers = ['PO Number', 'Date', 'Supplier', 'Total (KSH)', 'Status', 'Expected Delivery'];
    const rows = data.map(p => [p.poNumber||'', p.date||'', p.supplier||'', p.total||0, p.status||'pending', p.expectedDate||'']);
    window.exportTableToPDF('Purchase Orders Report', headers, rows, `Printex_Purchases_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ── Inventory CSV alias ──────────────────────────────────────────
  window.exportInventoryCSV = function() {
    if (typeof window.exportCSV === 'function') { window.exportCSV(); return; }
    const data = (window.parts || []).filter(p => !p.isService);
    const headers = ['SKU / Part Number', 'Category', 'Description', 'Current Stock', 'Min Stock', 'Price (KSH)', 'Supplier', 'Location'];
    const rows = [headers, ...data.map(p => [p.partNum||'', p.category||'', p.desc||'', p.stock||0, p.minStock||0, p.priceKsh||0, p.supplier||'', p.location||''])];
    window.downloadExcelCSV(rows, `Printex_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ── Print functions for all business pages ──────────────────────
  window.printCustomersTable = function() {
    const data = (window.customers || []).filter(c => !c._deleted);
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Address', 'Orders', 'Balance (KSH)'];
    const rows = data.map(c => [c.name||'', c.company||'', c.email||'', c.phone||'', c.address||'', c.orderCount||0, c.balance||0]);
    window.printTableDataset('Customers Report', headers, rows);
  };

  window.printSuppliersTable = function() {
    const data = (window.suppliers || []).filter(s => !s._deleted);
    const headers = ['Name', 'Contact', 'Phone', 'Email', 'Products', 'Lead Time (days)', 'Address'];
    const rows = data.map(s => [s.name||'', s.contact||'', s.phone||'', s.email||'', s.products||'', s.leadDays||'', s.address||'']);
    window.printTableDataset('Suppliers Report', headers, rows);
  };

  window.printExpensesTable = function() {
    const data = (window.expenses || []).filter(e => !e._deleted);
    const headers = ['Date', 'Description', 'Category', 'Amount (KSH)', 'Payment Method', 'Reference'];
    const rows = data.map(e => [e.date||'', e.description||'', e.category||'', e.amount||0, e.paymentMethod||'', e.reference||'']);
    window.printTableDataset('Expenses Report', headers, rows);
  };

  window.printEmployeesTable = function() {
    const data = (window.employees || []).filter(e => !e._deleted);
    const headers = ['Name', 'Role', 'Phone', 'Email', 'Salary (KSH)', 'Start Date', 'Status'];
    const rows = data.map(e => [e.name||'', e.role||'', e.phone||'', e.email||'', e.salary||0, e.startDate||'', e.status||'active']);
    window.printTableDataset('Employees Report', headers, rows);
  };

  window.printPurchasesTable = function() {
    const data = (window.purchases || []).filter(p => !p._deleted);
    const headers = ['PO Number', 'Date', 'Supplier', 'Total (KSH)', 'Status', 'Expected Delivery'];
    const rows = data.map(p => [p.poNumber||'', p.date||'', p.supplier||'', p.total||0, p.status||'pending', p.expectedDate||'']);
    window.printTableDataset('Purchase Orders Report', headers, rows);
  };

  // ── Suppliers Excel (global alias for HTML button) ───────────────
  window.exportSuppliersExcel = function() {
    if (window.biz && typeof window.biz.exportSuppliersExcel === 'function') {
      window.biz.exportSuppliersExcel(); return;
    }
    const data = (window.suppliers || []).filter(s => !s._deleted);
    const headers = ['Name', 'Contact', 'Phone', 'Email', 'Products', 'Lead Days', 'Address', 'Notes'];
    const rows = data.map(s => [s.name||'', s.contact||'', s.phone||'', s.email||'', s.products||'', s.leadDays||'', s.address||'', s.notes||'']);
    window.exportToExcel(headers, rows, 'Suppliers', `Printex_Suppliers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Expenses Excel (global alias for HTML button) ─────────────────
  window.exportExpensesExcel = function() {
    if (window.biz && typeof window.biz.exportExpensesExcel === 'function') {
      window.biz.exportExpensesExcel(); return;
    }
    const data = (window.expenses || []).filter(e => !e._deleted);
    const headers = ['Date', 'Description', 'Category', 'Amount (KSH)', 'Payment Method', 'Reference', 'Notes'];
    const rows = data.map(e => [e.date||'', e.description||'', e.category||'', e.amount||0, e.paymentMethod||'', e.reference||'', e.notes||'']);
    window.exportToExcel(headers, rows, 'Expenses', `Printex_Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Employees Excel (global alias for HTML button) ───────────────
  window.exportEmployeesExcel = function() {
    if (window.biz && typeof window.biz.exportEmployeesExcel === 'function') {
      window.biz.exportEmployeesExcel(); return;
    }
    const data = (window.employees || []).filter(e => !e._deleted);
    const headers = ['Name', 'Role', 'Phone', 'Email', 'Salary (KSH)', 'Start Date', 'Status', 'Notes'];
    const rows = data.map(e => [e.name||'', e.role||'', e.phone||'', e.email||'', e.salary||0, e.startDate||'', e.status||'active', e.notes||'']);
    window.exportToExcel(headers, rows, 'Employees', `Printex_Employees_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Customers Excel (global alias for HTML button) ───────────────
  window.exportCustomersExcel = function() {
    if (window.biz && typeof window.biz.exportCustomersExcel === 'function') {
      window.biz.exportCustomersExcel(); return;
    }
    const data = (window.customers || []).filter(c => !c._deleted);
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Address', 'Orders', 'Balance (KSH)', 'Notes'];
    const rows = data.map(c => [c.name||'', c.company||'', c.email||'', c.phone||'', c.address||'', c.orderCount||0, c.balance||0, c.notes||'']);
    window.exportToExcel(headers, rows, 'Customers', `Printex_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Purchases Excel (global alias for HTML button) ───────────────
  window.exportPurchasesExcel = function() {
    if (window.biz && typeof window.biz.exportPurchasesExcel === 'function') {
      window.biz.exportPurchasesExcel(); return;
    }
    const data = (window.purchases || []).filter(p => !p._deleted);
    const headers = ['PO Number', 'Date', 'Supplier', 'Total (KSH)', 'Status', 'Expected Delivery', 'Description'];
    const rows = data.map(p => [p.poNumber||'', p.date||'', p.supplier||'', p.total||0, p.status||'pending', p.expectedDate||'', p.description||'']);
    window.exportToExcel(headers, rows, 'Purchases', `Printex_Purchases_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Expenses CSV (global alias) ──────────────────────────────────
  window.exportExpensesCSV = function() {
    const data = (window.expenses || []).filter(e => !e._deleted);
    const headers = ['Date', 'Description', 'Category', 'Amount (KSH)', 'Payment Method', 'Reference'];
    const rows = [headers, ...data.map(e => [e.date||'', e.description||'', e.category||'', e.amount||0, e.paymentMethod||'', e.reference||''])];
    window.downloadExcelCSV(rows, `Printex_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ── Employees CSV (global alias) ─────────────────────────────────
  window.exportEmployeesCSV = function() {
    const data = (window.employees || []).filter(e => !e._deleted);
    const headers = ['Name', 'Role', 'Phone', 'Email', 'Salary (KSH)', 'Start Date', 'Status'];
    const rows = [headers, ...data.map(e => [e.name||'', e.role||'', e.phone||'', e.email||'', e.salary||0, e.startDate||'', e.status||'active'])];
    window.downloadExcelCSV(rows, `Printex_Employees_${new Date().toISOString().split('T')[0]}.csv`);
  };

})();
