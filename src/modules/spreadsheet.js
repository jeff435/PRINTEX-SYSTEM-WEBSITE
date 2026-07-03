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

})();
