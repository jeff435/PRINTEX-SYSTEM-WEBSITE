// ═══════════════════════════════════════════════════════════════════
// BUSINESS MODULE — Customers, Suppliers, Expenses, Employees, Categories, Purchases
// Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let customers = [];
  let suppliers = [];
  let expenses = [];
  let employees = [];
  let categories = [];
  let purchases = [];
  let attendance = [];
  let editingId = null;
  let editingStore = null;

  // ── KPI Helper ─────────────────────────────────────────────────────
  function renderKpiGrid(containerId, kpis) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = kpis.map(k => `
      <div class="kpi-card" style="--kpi-color:${k.color}">
        <div class="kpi-label"><i class="fa ${k.icon}" style="color:${k.color}"></i> ${k.label}</div>
        <div class="kpi-value" style="color:${k.color}">${k.value}</div>
        ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ''}
      </div>`).join('');
  }

  function fmtKsh(n) {
    return 'KSH ' + (Number(n) || 0).toLocaleString('en-KE');
  }

  // ── Generic Modal Helper ────────────────────────────────────────────
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.style.display = 'flex';
      // Trigger class for CSS transition opacity / pointer-events
      m.classList.add('open');
    }
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove('open');
      m.style.display = 'none';
    }
  }
  window.bizCloseModal = closeModal;

  // ── Load from IndexedDB ─────────────────────────────────────────────
  async function loadAll() {
    try {
      customers = (await window.dbGet('customers')) || [];
      suppliers = (await window.dbGet('suppliers')) || [];
      expenses = (await window.dbGet('expenses')) || [];
      employees = (await window.dbGet('employees')) || [];
      categories = (await window.dbGet('categories')) || [];
      purchases = (await window.dbGet('purchases')) || [];
      attendance = (await window.dbGet('attendance')) || [];
      // Keep global window arrays in sync so spreadsheet.js and analytics.js export functions work
      window.customers = customers.filter(c => !c._deleted);
      window.suppliers = suppliers.filter(s => !s._deleted);
      window.expenses = expenses.filter(e => !e._deleted);
      window.employees = employees.filter(e => !e._deleted);
      window.purchases = purchases.filter(p => !p._deleted);
      window.categories = categories.filter(c => !c._deleted);
      window.attendance = attendance.filter(a => !a._deleted);
      if (typeof window.populateCategorySelects === 'function') {
        window.populateCategorySelects();
      }
    } catch (e) {
      console.warn('[Business] Failed to load from IndexedDB:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════
  function renderCustomers() {
    const search = (document.getElementById('custSearch')?.value || '').toLowerCase();
    const filtered = customers.filter(c =>
      !c._deleted &&
      (c.name?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.toLowerCase().includes(search) ||
        c.company?.toLowerCase().includes(search))
    );

    renderKpiGrid('custKpiGrid', [
      { label: 'Total Customers', value: customers.filter(c => !c._deleted).length, icon: 'fa-users', color: 'var(--accent)', sub: 'All registered' },
      { label: 'With Email', value: customers.filter(c => !c._deleted && c.email).length, icon: 'fa-envelope', color: 'var(--success)', sub: 'Reachable' },
      { label: 'Companies', value: customers.filter(c => !c._deleted && c.company).length, icon: 'fa-building', color: 'var(--gold)', sub: 'Corporate accounts' }
    ]);

    const tbody = document.getElementById('custBody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-users" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No customers found.</td></tr>`;
      return;
    }
    const paged = window.paginateDataset('customers', filtered, renderCustomers);
    tbody.innerHTML = paged.map(c => `
      <tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.email) || '<span style="color:var(--dim)">—</span>'}</td>
        <td>${esc(c.phone) || '<span style="color:var(--dim)">—</span>'}</td>
        <td>${esc(c.company) || '<span style="color:var(--dim)">—</span>'}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.address) || '<span style="color:var(--dim)">—</span>'}</td>
        <td><span class="badge">${c.orderCount || 0}</span></td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="window.biz.editCustomer('${c.id}')"><i class="fa fa-edit"></i></button>
          <button class="btn btn-xs btn-danger" onclick="window.biz.deleteRecord('customers','${c.id}')"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function openCustomerModal(id) {
    editingId = id || null;
    editingStore = 'customers';
    const c = id ? customers.find(x => x.id === id) : {};
    const isEdit = !!c?.id;

    ensureModal('custModal', `
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-user-plus" style="color:var(--accent)"></i> ${isEdit ? 'Edit Customer' : 'Add Customer'}</div>
        <button class="modal-close" onclick="bizCloseModal('custModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row col2">
          <div class="field"><label>Full Name *</label><input class="input" id="bf_name" value="${esc(c?.name || '')}" placeholder="John Doe"/></div>
          <div class="field"><label>Company</label><input class="input" id="bf_company" value="${esc(c?.company || '')}" placeholder="ABC Ltd"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Email</label><input class="input" type="email" id="bf_email" value="${esc(c?.email || '')}" placeholder="john@example.com"/></div>
          <div class="field"><label>Phone</label><input class="input" id="bf_phone" value="${esc(c?.phone || '')}" placeholder="+254 700 000000"/></div>
        </div>
        <div class="field"><label>Address</label><textarea class="input" id="bf_address" rows="2" placeholder="Physical address">${esc(c?.address || '')}</textarea></div>
        <div class="field"><label>Notes</label><textarea class="input" id="bf_notes" rows="2" placeholder="Any extra notes...">${esc(c?.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="bizCloseModal('custModal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.biz.saveRecord('customers')"><i class="fa fa-save"></i> Save Customer</button>
      </div>`);
    openModal('custModal');
  }

  // ═══════════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════
  function renderSuppliers() {
    const search = (document.getElementById('supSearch')?.value || '').toLowerCase();
    const filtered = suppliers.filter(s =>
      !s._deleted &&
      (s.name?.toLowerCase().includes(search) ||
        s.contact?.toLowerCase().includes(search) ||
        s.products?.toLowerCase().includes(search))
    );

    renderKpiGrid('supKpiGrid', [
      { label: 'Total Suppliers', value: suppliers.filter(s => !s._deleted).length, icon: 'fa-industry', color: 'var(--accent)', sub: 'All registered' },
      { label: 'Active', value: suppliers.filter(s => !s._deleted && s.status !== 'inactive').length, icon: 'fa-check-circle', color: 'var(--success)', sub: 'Active suppliers' },
      { label: 'Avg Lead Time', value: (suppliers.filter(s => !s._deleted && s.leadDays).reduce((a, s) => a + (s.leadDays || 0), 0) / (suppliers.filter(s => !s._deleted && s.leadDays).length || 1)).toFixed(0) + 'd', icon: 'fa-clock', color: 'var(--gold)', sub: 'Average days' }
    ]);

    const tbody = document.getElementById('supBody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-industry" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No suppliers found.</td></tr>`;
      return;
    }
    const paged = window.paginateDataset('suppliers', filtered, renderSuppliers);
    tbody.innerHTML = paged.map(s => `
      <tr>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${esc(s.contact) || '<span style="color:var(--dim)">—</span>'}</td>
        <td>${esc(s.phone) || '<span style="color:var(--dim)">—</span>'}</td>
        <td>${esc(s.email) || '<span style="color:var(--dim)">—</span>'}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis">${esc(s.products) || '<span style="color:var(--dim)">—</span>'}</td>
        <td>${s.leadDays ? s.leadDays + 'd' : '<span style="color:var(--dim)">—</span>'}</td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="window.biz.editSupplier('${s.id}')"><i class="fa fa-edit"></i></button>
          <button class="btn btn-xs btn-danger" onclick="window.biz.deleteRecord('suppliers','${s.id}')"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function openSupplierModal(id) {
    editingId = id || null;
    editingStore = 'suppliers';
    const s = id ? suppliers.find(x => x.id === id) : {};

    ensureModal('supModal', `
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-industry" style="color:var(--accent)"></i> ${id ? 'Edit Supplier' : 'Add Supplier'}</div>
        <button class="modal-close" onclick="bizCloseModal('supModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row col2">
          <div class="field"><label>Supplier Name *</label><input class="input" id="bf_name" value="${esc(s?.name || '')}" placeholder="Heidelberg GmbH"/></div>
          <div class="field"><label>Contact Person</label><input class="input" id="bf_contact" value="${esc(s?.contact || '')}" placeholder="Jane Smith"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Phone</label><input class="input" id="bf_phone" value="${esc(s?.phone || '')}" placeholder="+49 6222 82 0"/></div>
          <div class="field"><label>Email</label><input class="input" type="email" id="bf_email" value="${esc(s?.email || '')}" placeholder="orders@supplier.com"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Products Supplied</label><input class="input" id="bf_products" value="${esc(s?.products || '')}" placeholder="Cylinders, Bearings..."/></div>
          <div class="field"><label>Lead Time (days)</label><input class="input" type="number" id="bf_leadDays" value="${s?.leadDays || ''}" placeholder="14"/></div>
        </div>
        <div class="field"><label>Address</label><textarea class="input" id="bf_address" rows="2">${esc(s?.address || '')}</textarea></div>
        <div class="field"><label>Notes</label><textarea class="input" id="bf_notes" rows="2">${esc(s?.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="bizCloseModal('supModal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.biz.saveRecord('suppliers')"><i class="fa fa-save"></i> Save Supplier</button>
      </div>`);
    openModal('supModal');
  }

  // ═══════════════════════════════════════════════════════════════════
  // EXPENSES
  // ═══════════════════════════════════════════════════════════════════
  function renderExpenses() {
    const search = (document.getElementById('expSearch')?.value || '').toLowerCase();
    const month = document.getElementById('expMonthFilter')?.value || '';
    const filtered = expenses.filter(e =>
      !e._deleted &&
      (e.description?.toLowerCase().includes(search) || e.category?.toLowerCase().includes(search)) &&
      (!month || (e.date || '').startsWith(month))
    );

    // Populate month filter
    const months = [...new Set(expenses.filter(e => !e._deleted && e.date).map(e => e.date.substring(0, 7)))].sort().reverse();
    const mf = document.getElementById('expMonthFilter');
    if (mf && mf.options.length <= 1) {
      months.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.textContent = m; mf.appendChild(opt); });
    }

    const total = filtered.reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const monthTotal = expenses.filter(e => !e._deleted && (e.date || '').startsWith(new Date().toISOString().substring(0, 7))).reduce((a, e) => a + (Number(e.amount) || 0), 0);

    renderKpiGrid('expKpiGrid', [
      { label: 'Total Expenses', value: fmtKsh(expenses.filter(e => !e._deleted).reduce((a, e) => a + (Number(e.amount) || 0), 0)), icon: 'fa-receipt', color: 'var(--danger)', sub: 'All time' },
      { label: 'This Month', value: fmtKsh(monthTotal), icon: 'fa-calendar', color: 'var(--warn)', sub: new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' }) },
      { label: 'Filtered Total', value: fmtKsh(total), icon: 'fa-filter', color: 'var(--accent)', sub: `${filtered.length} records` }
    ]);

    const tbody = document.getElementById('expBody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-receipt" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No expenses found.</td></tr>`;
      return;
    }
    const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const paged = window.paginateDataset('expenses', sorted, renderExpenses);
    tbody.innerHTML = paged.map(e => `
      <tr>
        <td style="font-family:var(--font-mono);font-size:12px">${esc(e.date) || '—'}</td>
        <td><strong>${esc(e.description)}</strong></td>
        <td><span class="badge badge-muted">${esc(e.category) || 'General'}</span></td>
        <td style="font-family:var(--font-mono);font-weight:600;color:var(--danger)">${fmtKsh(e.amount)}</td>
        <td>${esc(e.paymentMethod) || '—'}</td>
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--muted)">${esc(e.reference) || '—'}</td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="window.biz.editExpense('${e.id}')"><i class="fa fa-edit"></i></button>
          <button class="btn btn-xs btn-danger" onclick="window.biz.deleteRecord('expenses','${e.id}')"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function openExpenseModal(id) {
    editingId = id || null;
    editingStore = 'expenses';
    const e = id ? expenses.find(x => x.id === id) : {};
    const today = new Date().toISOString().split('T')[0];

    ensureModal('expModal', `
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-receipt" style="color:var(--danger)"></i> ${id ? 'Edit Expense' : 'Record Expense'}</div>
        <button class="modal-close" onclick="bizCloseModal('expModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row col2">
          <div class="field"><label>Date *</label><input class="input" type="date" id="bf_date" value="${e?.date || today}"/></div>
          <div class="field"><label>Amount (KSH) *</label><input class="input" type="number" id="bf_amount" value="${e?.amount || ''}" placeholder="0" min="0" step="0.01"/></div>
        </div>
        <div class="field"><label>Description *</label><input class="input" id="bf_description" value="${esc(e?.description || '')}" placeholder="Rent, fuel, salary, maintenance..."/></div>
        <div class="form-row col2">
          <div class="field"><label>Category</label>
            <select class="select" id="bf_category">
              ${['Rent', 'Utilities', 'Fuel', 'Salary', 'Maintenance', 'Parts & Supplies', 'Marketing', 'Transport', 'Software', 'Other'].map(cat => `<option value="${cat}" ${e?.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Payment Method</label>
            <select class="select" id="bf_paymentMethod">
              ${['Cash', 'M-PESA', 'Bank Transfer', 'Cheque', 'Card'].map(m => `<option value="${m}" ${e?.paymentMethod === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field"><label>Reference / Receipt #</label><input class="input" id="bf_reference" value="${esc(e?.reference || '')}" placeholder="REF-001 or receipt number"/></div>
        <div class="field"><label>Notes</label><textarea class="input" id="bf_notes" rows="2">${esc(e?.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="bizCloseModal('expModal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.biz.saveRecord('expenses')"><i class="fa fa-save"></i> Save Expense</button>
      </div>`);
    openModal('expModal');
  }

  // ═══════════════════════════════════════════════════════════════════
  // EMPLOYEES
  // ═══════════════════════════════════════════════════════════════════
  function renderEmployees() {
    const search = (document.getElementById('empSearch')?.value || '').toLowerCase();
    const filtered = employees.filter(e =>
      !e._deleted &&
      (e.name?.toLowerCase().includes(search) || e.role?.toLowerCase().includes(search))
    );

    const totalSalary = employees.filter(e => !e._deleted).reduce((a, e) => a + (Number(e.salary) || 0), 0);
    renderKpiGrid('empKpiGrid', [
      { label: 'Total Employees', value: employees.filter(e => !e._deleted).length, icon: 'fa-id-badge', color: 'var(--accent)', sub: 'All staff' },
      { label: 'Active', value: employees.filter(e => !e._deleted && e.status === 'active').length, icon: 'fa-user-check', color: 'var(--success)', sub: 'Currently working' },
      { label: 'Monthly Payroll', value: fmtKsh(totalSalary), icon: 'fa-money-bill', color: 'var(--gold)', sub: 'Total salaries' }
    ]);

    const tbody = document.getElementById('empBody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-id-badge" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No employees found.</td></tr>`;
      return;
    }
    const paged = window.paginateDataset('employees', filtered, renderEmployees);
    tbody.innerHTML = paged.map(e => `
      <tr>
        <td><strong>${esc(e.name)}</strong></td>
        <td><span class="badge badge-muted">${esc(e.role) || '—'}</span></td>
        <td>${esc(e.phone) || '—'}</td>
        <td>${esc(e.email) || '—'}</td>
        <td style="font-family:var(--font-mono);font-weight:600">${fmtKsh(e.salary)}</td>
        <td style="font-family:var(--font-mono);font-size:12px">${esc(e.startDate) || '—'}</td>
        <td><span class="badge ${e.status === 'active' ? 'badge-success' : 'badge-muted'}">${esc(e.status || 'active')}</span></td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="window.biz.editEmployee('${e.id}')" title="Edit Employee"><i class="fa fa-edit"></i></button>
          <button class="btn btn-xs btn-success" onclick="window.biz.payEmployeeSalary('${e.id}')" title="Record Salary Payment" style="background:#20c997;border-color:#20c997;color:#fff"><i class="fa fa-money-bill-wave"></i> Pay</button>
          <button class="btn btn-xs btn-danger" onclick="window.biz.deleteRecord('employees','${e.id}')" title="Delete Employee"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`).join('');
  }

  function openEmployeeModal(id) {
    editingId = id || null;
    editingStore = 'employees';
    const e = id ? employees.find(x => x.id === id) : {};
    const today = new Date().toISOString().split('T')[0];

    ensureModal('empModal', `
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-id-badge" style="color:var(--accent)"></i> ${id ? 'Edit Employee' : 'Add Employee'}</div>
        <button class="modal-close" onclick="bizCloseModal('empModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row col2">
          <div class="field"><label>Full Name *</label><input class="input" id="bf_name" value="${esc(e?.name || '')}" placeholder="Jane Doe"/></div>
          <div class="field"><label>Role / Title *</label><input class="input" id="bf_role" value="${esc(e?.role || '')}" placeholder="Technician, Manager..."/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Phone</label><input class="input" id="bf_phone" value="${esc(e?.phone || '')}" placeholder="+254 700 000000"/></div>
          <div class="field"><label>Email</label><input class="input" type="email" id="bf_email" value="${esc(e?.email || '')}" placeholder="employee@printex.co.ke"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Monthly Salary (KSH)</label><input class="input" type="number" id="bf_salary" value="${e?.salary || ''}" placeholder="0" min="0"/></div>
          <div class="field"><label>Start Date</label><input class="input" type="date" id="bf_startDate" value="${e?.startDate || today}"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>National ID</label><input class="input" id="bf_nationalId" value="${esc(e?.nationalId || '')}" placeholder="12345678"/></div>
          <div class="field"><label>Status</label>
            <select class="select" id="bf_status">
              <option value="active" ${e?.status === 'active' || !e?.status ? 'selected' : ''}>Active</option>
              <option value="inactive" ${e?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              <option value="on-leave" ${e?.status === 'on-leave' ? 'selected' : ''}>On Leave</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Notes</label><textarea class="input" id="bf_notes" rows="2">${esc(e?.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="bizCloseModal('empModal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.biz.saveRecord('employees')"><i class="fa fa-save"></i> Save Employee</button>
      </div>`);
    openModal('empModal');
  }

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════════
  function renderCategories() {
    const search = (document.getElementById('catMgmtSearch')?.value || '').toLowerCase();
    const filtered = categories.filter(c =>
      !c._deleted &&
      (c.name?.toLowerCase().includes(search) || c.description?.toLowerCase().includes(search))
    );

    const grid = document.getElementById('catMgmtGrid');
    if (!grid) return;
    if (!filtered.length) {
      grid.innerHTML = `<div style="text-align:center;color:var(--dim);padding:40px;grid-column:1/-1"><i class="fa fa-tags" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No categories found.</div>`;
      return;
    }
    grid.innerHTML = filtered.map(c => {
      const partCount = (window.parts || []).filter(p => !p._deleted && p.category === (c.code || c.name)).length;
      return `
      <div class="card" style="padding:16px;cursor:default">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:${c.color || 'var(--accent-glow)'};border:1px solid ${c.color || 'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:18px">${c.icon || '🏷️'}</div>
            <div>
              <div style="font-weight:700;font-size:14px">${esc(c.name)}</div>
              <div style="font-size:11px;color:var(--muted)">${partCount} parts</div>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs btn-outline" onclick="window.biz.editCategory('${c.id}')"><i class="fa fa-edit"></i></button>
            <button class="btn btn-xs btn-danger" onclick="window.biz.deleteRecord('categories','${c.id}')"><i class="fa fa-trash"></i></button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">${esc(c.description) || 'No description'}</div>
      </div>`;
    }).join('');
  }

  function openCategoryModal(id) {
    editingId = id || null;
    editingStore = 'categories';
    const c = id ? categories.find(x => x.id === id) : {};

    ensureModal('catMgmtModal', `
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-tags" style="color:var(--accent)"></i> ${id ? 'Edit Category' : 'Add Category'}</div>
        <button class="modal-close" onclick="bizCloseModal('catMgmtModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row col2">
          <div class="field"><label>Category Name *</label><input class="input" id="bf_name" value="${esc(c?.name || '')}" placeholder="e.g. Bearings & Gears"/></div>
          <div class="field"><label>Short Code</label><input class="input" id="bf_code" value="${esc(c?.code || '')}" placeholder="e.g. BRG" style="text-transform:uppercase"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Icon (emoji)</label><input class="input" id="bf_icon" value="${esc(c?.icon || '')}" placeholder="🔧" style="font-size:18px;text-align:center"/></div>
          <div class="field"><label>Color</label><input class="input" type="color" id="bf_color" value="${c?.color || '#00d4ff'}" style="padding:4px;height:38px"/></div>
        </div>
        <div class="field"><label>Description</label><textarea class="input" id="bf_description" rows="3" placeholder="What parts belong in this category?">${esc(c?.description || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="bizCloseModal('catMgmtModal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.biz.saveRecord('categories')"><i class="fa fa-save"></i> Save Category</button>
      </div>`);
    openModal('catMgmtModal');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PURCHASES
  // ═══════════════════════════════════════════════════════════════════
  function renderPurchases() {
    const search = (document.getElementById('purSearch')?.value || '').toLowerCase();
    const filtered = purchases.filter(p =>
      !p._deleted &&
      (p.poNumber?.toLowerCase().includes(search) ||
        p.supplier?.toLowerCase().includes(search))
    );

    const totalSpend = purchases.filter(p => !p._deleted).reduce((a, p) => a + (Number(p.total) || 0), 0);
    renderKpiGrid('purKpiGrid', [
      { label: 'Purchase Orders', value: purchases.filter(p => !p._deleted).length, icon: 'fa-cart-plus', color: 'var(--accent)', sub: 'Total POs' },
      { label: 'Total Spend', value: fmtKsh(totalSpend), icon: 'fa-money-bill', color: 'var(--danger)', sub: 'All purchases' },
      { label: 'Pending', value: purchases.filter(p => !p._deleted && p.status === 'pending').length, icon: 'fa-clock', color: 'var(--warn)', sub: 'Awaiting delivery' }
    ]);

    const tbody = document.getElementById('purBody');
    if (!tbody) return;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-cart-plus" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No purchase orders found.</td></tr>`;
      return;
    }
    const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const paged = window.paginateDataset('purchases', sorted, renderPurchases);
    tbody.innerHTML = paged.map(p => {
      const statusColor = p.status === 'received' ? 'var(--success)' : p.status === 'cancelled' ? 'var(--danger)' : 'var(--warn)';
      return `
      <tr>
        <td style="font-family:var(--font-mono);font-weight:600">${esc(p.poNumber) || '—'}</td>
        <td style="font-family:var(--font-mono);font-size:12px">${esc(p.date) || '—'}</td>
        <td>${esc(p.supplier) || '—'}</td>
        <td>${(p.items || []).length} item(s)</td>
        <td style="font-family:var(--font-mono);font-weight:600;color:var(--accent)">${fmtKsh(p.total)}</td>
        <td><span class="badge" style="background:${statusColor}1a;color:${statusColor};border:1px solid ${statusColor}">${esc(p.status || 'pending')}</span></td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="window.biz.editPurchase('${p.id}')"><i class="fa fa-edit"></i></button>
          <button class="btn btn-xs btn-danger" onclick="window.biz.deleteRecord('purchases','${p.id}')"><i class="fa fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('');
  }

  function openPurchaseModal(id) {
    editingId = id || null;
    editingStore = 'purchases';
    const p = id ? purchases.find(x => x.id === id) : {};
    const today = new Date().toISOString().split('T')[0];
    const supOptions = suppliers.filter(s => !s._deleted).map(s => `<option value="${esc(s.name)}" ${p?.supplier === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

    ensureModal('purModal', `
      <div class="modal-header">
        <div class="modal-title"><i class="fa fa-cart-plus" style="color:var(--accent)"></i> ${id ? 'Edit Purchase Order' : 'New Purchase Order'}</div>
        <button class="modal-close" onclick="bizCloseModal('purModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row col2">
          <div class="field"><label>PO Number</label><input class="input" id="bf_poNumber" value="${esc(p?.poNumber || 'PO-' + Date.now().toString().slice(-6))}" style="font-family:var(--font-mono)"/></div>
          <div class="field"><label>Date *</label><input class="input" type="date" id="bf_date" value="${p?.date || today}"/></div>
        </div>
        <div class="form-row col2">
          <div class="field"><label>Supplier *</label>
            <select class="select" id="bf_supplier">
              <option value="">— Select supplier —</option>
              ${supOptions}
              <option value="__other__">Other (type manually)</option>
            </select>
          </div>
          <div class="field"><label>Status</label>
            <select class="select" id="bf_status">
              <option value="pending" ${p?.status === 'pending' || !p?.status ? 'selected' : ''}>Pending</option>
              <option value="received" ${p?.status === 'received' ? 'selected' : ''}>Received</option>
              <option value="partial" ${p?.status === 'partial' ? 'selected' : ''}>Partial</option>
              <option value="cancelled" ${p?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="field"><label>Description / Items</label><textarea class="input" id="bf_description" rows="3" placeholder="List of items ordered...">${esc(p?.description || '')}</textarea></div>
        <div class="form-row col2">
          <div class="field"><label>Total Amount (KSH) *</label><input class="input" type="number" id="bf_total" value="${p?.total || ''}" placeholder="0" min="0" step="0.01"/></div>
          <div class="field"><label>Expected Delivery</label><input class="input" type="date" id="bf_expectedDate" value="${p?.expectedDate || ''}"/></div>
        </div>
        <div class="field"><label>Notes</label><textarea class="input" id="bf_notes" rows="2">${esc(p?.notes || '')}</textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="bizCloseModal('purModal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.biz.saveRecord('purchases')"><i class="fa fa-save"></i> Save Purchase Order</button>
      </div>`);
    openModal('purModal');
  }

  // ═══════════════════════════════════════════════════════════════════
  // SAVE / DELETE GENERIC
  // ═══════════════════════════════════════════════════════════════════
  function parsePurchaseItems(desc) {
    const lines = (desc || '').split('\n');
    const items = [];
    const allParts = window.parts || [];

    for (const line of lines) {
      if (!line.trim()) continue;

      let foundPart = null;
      let foundQty = 1;

      const tokens = line.split(/[\s,;:\-\*xX\(\)]+/).map(t => t.trim()).filter(Boolean);

      for (const token of tokens) {
        const part = allParts.find(p => p.partNum?.toLowerCase() === token.toLowerCase() || p.part_num?.toLowerCase() === token.toLowerCase());
        if (part) {
          foundPart = part;
          break;
        }
      }

      if (foundPart) {
        for (const token of tokens) {
          const num = parseInt(token);
          if (!isNaN(num) && num > 0 && token !== foundPart.partNum && token !== foundPart.part_num) {
            foundQty = num;
            break;
          }
        }
        items.push({ part: foundPart, qty: foundQty });
      }
    }
    return items;
  }

  async function payEmployeeSalary(employeeId) {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return window.showToast && window.showToast('Employee not found', 'error');

    const today = new Date().toISOString().split('T')[0];
    const expenseRecord = {
      id: 'exp_sal_' + emp.id + '_' + Date.now(),
      description: `Salary payment for ${emp.name} (${emp.role})`,
      amount: Number(emp.salary) || 0,
      date: today,
      category: 'Salary',
      paymentMethod: 'Bank Transfer',
      reference: `PAYROLL-${Date.now().toString().slice(-6)}`,
      notes: `Salary recorded via payroll page for employee ${emp.name}.`,
      updatedAt: Date.now()
    };

    try {
      await window.dbPut('expenses', expenseRecord);
      expenses.push(expenseRecord);
      window.showToast && window.showToast(`Salary of KSH ${emp.salary.toLocaleString()} recorded as Expense for ${emp.name}`, 'success');

      refreshPage('expenses');
      refreshPage('employees');
      window.syncData && window.syncData();
    } catch (e) {
      window.showToast && window.showToast('Salary record failed: ' + e.message, 'danger');
    }
  }

  async function saveRecord(store) {
    const record = gatherFields(store);
    if (!record) return;

    let oldPo = null;
    if (store === 'purchases' && editingId) {
      oldPo = purchases.find(p => p.id === editingId);
    }

    if (editingId) {
      record.id = editingId;
      const arr = getArr(store);
      const idx = arr.findIndex(x => x.id === editingId);
      if (idx !== -1) arr[idx] = { ...arr[idx], ...record };
      else arr.push(record);
    } else {
      record.id = store.substring(0, 3) + '_' + Date.now();
      getArr(store).push(record);
    }

    try {
      await window.dbPut(store, record);

      // Purchases received logic
      if (store === 'purchases' && record.status === 'received' && (!oldPo || oldPo.status !== 'received')) {
        // 1. Parse description and adjust stock
        const parsed = parsePurchaseItems(record.description);
        for (const item of parsed) {
          item.part.stock = (item.part.stock || 0) + item.qty;
          await window.dbPut('parts', item.part);
          if (window.logActivity) {
            await window.logActivity(`Received purchase parts: ${item.part.partNum} (+${item.qty})`, 'stock');
          }
        }

        // 2. Automatically log an Expense under "Parts & Supplies"
        const expenseRecord = {
          id: 'exp_po_' + record.id,
          description: `PO Receipt: ${record.poNumber} from ${record.supplier}`,
          amount: Number(record.total) || 0,
          date: record.date || new Date().toISOString().split('T')[0],
          category: 'Parts & Supplies',
          paymentMethod: 'Bank Transfer',
          reference: record.poNumber,
          notes: record.notes || 'Automatically recorded via PO status set to received.',
          updatedAt: Date.now()
        };
        await window.dbPut('expenses', expenseRecord);
        expenses.push(expenseRecord);

        // 3. Update supplier statistics
        const supplierObj = suppliers.find(s => s.name === record.supplier);
        if (supplierObj) {
          supplierObj.orderCount = (supplierObj.orderCount || 0) + 1;
          const poDate = new Date(record.date);
          const receivedDate = new Date();
          const daysDiff = Math.max(1, Math.round((receivedDate - poDate) / (1000 * 60 * 60 * 24)));
          supplierObj.leadDays = Math.round(((supplierObj.leadDays || 14) + daysDiff) / 2);
          await window.dbPut('suppliers', supplierObj);
        }

        if (typeof window.renderInventory === 'function') window.renderInventory();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
      }

      const modalId = { customers: 'custModal', suppliers: 'supModal', expenses: 'expModal', employees: 'empModal', categories: 'catMgmtModal', purchases: 'purModal' }[store];
      closeModal(modalId);
      // If categories changed, refresh global window.categories and update all dropdowns + charts
      if (store === 'categories') {
        categories = (await window.dbGet('categories')) || [];
        window.categories = categories.filter(c => !c._deleted);
        if (typeof window.populateCategorySelects === 'function') {
          window.populateCategorySelects(); // updates fCat, catFilter, any data-category-select, and inventory chart
        }
        // Also refresh inventory chart and dashboard KPIs
        if (typeof window.renderInventory === 'function') window.renderInventory();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
      }
      refreshPage(store);
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderReports === 'function') window.renderReports();
      window.showToast && window.showToast('✅ Saved successfully!', 'success');
      window.syncData && window.syncData();
    } catch (e) {
      console.error('[Business] Save failed:', e);
      window.showToast && window.showToast('❌ Save failed: ' + e.message, 'danger');
    }
  }

  async function deleteRecord(store, id) {
    const arr = getArr(store);
    const item = arr.find(x => x.id === id);
    // Build a friendly name for the confirmation dialog
    const itemName = item ? (item.name || item.description || item.poNumber || item.employee_name || id) : id;
    const storeLabel = store.charAt(0).toUpperCase() + store.slice(1, -1); // e.g. 'Categorie' → strip trailing 's' → 'Categori', adjust:
    const labelMap = { categories: 'Category', customers: 'Customer', suppliers: 'Supplier', expenses: 'Expense', employees: 'Employee', purchases: 'Purchase Order', attendance: 'Attendance Record' };
    const label = labelMap[store] || storeLabel;
    if (!confirm(`Delete ${label}:\n\n"${itemName}"\n\nThis cannot be undone. Continue?`)) return;
    if (!item) { window.showToast && window.showToast('Record not found.', 'warn'); return; }
    item._deleted = true;
    try {
      await window.dbPut(store, item);
      // If categories changed, refresh global window.categories and update all dropdowns + charts
      if (store === 'categories') {
        categories = (await window.dbGet('categories')) || [];
        window.categories = categories.filter(c => !c._deleted);
        if (typeof window.populateCategorySelects === 'function') {
          window.populateCategorySelects(); // updates fCat, catFilter, inventory chart
        }
        // Also refresh inventory chart and dashboard KPIs
        if (typeof window.renderInventory === 'function') window.renderInventory();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
      }
      refreshPage(store);
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      if (typeof window.renderReports === 'function') window.renderReports();
      window.showToast && window.showToast(`🗑️ ${label} deleted.`, 'success');
      window.syncData && window.syncData();
    } catch (e) {
      item._deleted = false; // rollback
      window.showToast && window.showToast('❌ Delete failed: ' + e.message, 'danger');
    }
  }

  // ── Field gathering per store ───────────────────────────────────────
  function gatherFields(store) {
    const modalId = { customers: 'custModal', suppliers: 'supModal', expenses: 'expModal', employees: 'empModal', categories: 'catMgmtModal', purchases: 'purModal' }[store];
    const m = document.getElementById(modalId);
    const g = id => { const el = m ? m.querySelector('#' + id) : null; return el ? el.value.trim() : ''; };
    const now = Date.now();

    if (store === 'customers') {
      const name = g('bf_name');
      if (!name) { window.showToast && window.showToast('Name is required', 'warn'); return null; }
      return { name, company: g('bf_company'), email: g('bf_email'), phone: g('bf_phone'), address: g('bf_address'), notes: g('bf_notes'), updatedAt: now };
    }
    if (store === 'suppliers') {
      const name = g('bf_name');
      if (!name) { window.showToast && window.showToast('Supplier name is required', 'warn'); return null; }
      return { name, contact: g('bf_contact'), phone: g('bf_phone'), email: g('bf_email'), products: g('bf_products'), leadDays: Number(g('bf_leadDays')) || null, address: g('bf_address'), notes: g('bf_notes'), updatedAt: now };
    }
    if (store === 'expenses') {
      const description = g('bf_description'); const amount = parseFloat(g('bf_amount'));
      if (!description || isNaN(amount)) { window.showToast && window.showToast('Description and amount are required', 'warn'); return null; }
      return { description, amount, date: g('bf_date'), category: g('bf_category'), paymentMethod: g('bf_paymentMethod'), reference: g('bf_reference'), notes: g('bf_notes'), updatedAt: now };
    }
    if (store === 'employees') {
      const name = g('bf_name'); const role = g('bf_role');
      if (!name) { window.showToast && window.showToast('Name is required', 'warn'); return null; }
      return { name, role, phone: g('bf_phone'), email: g('bf_email'), salary: Number(g('bf_salary')) || 0, startDate: g('bf_startDate'), nationalId: g('bf_nationalId'), status: g('bf_status') || 'active', notes: g('bf_notes'), updatedAt: now };
    }
    if (store === 'categories') {
      const name = g('bf_name');
      if (!name) { window.showToast && window.showToast('Name is required', 'warn'); return null; }
      return { name, code: g('bf_code').toUpperCase(), icon: g('bf_icon'), color: g('bf_color'), description: g('bf_description'), updatedAt: now };
    }
    if (store === 'purchases') {
      const total = parseFloat(g('bf_total'));
      if (isNaN(total)) { window.showToast && window.showToast('Amount is required', 'warn'); return null; }
      const sup = g('bf_supplier');
      return { poNumber: g('bf_poNumber'), date: g('bf_date'), supplier: sup === '__other__' ? '' : sup, status: g('bf_status') || 'pending', description: g('bf_description'), total, expectedDate: g('bf_expectedDate'), notes: g('bf_notes'), updatedAt: now };
    }
    return null;
  }

  // ── Attendance Roster Functions ─────────────────────────────────────
  function renderAttendance() {
    const search = (document.getElementById('attSearch')?.value || '').toLowerCase();
    const dateInput = document.getElementById('attDateFilter');
    let dateFilter = dateInput?.value;
    if (!dateFilter) {
      dateFilter = new Date().toISOString().split('T')[0];
      if (dateInput) dateInput.value = dateFilter;
    }

    const dailyRecords = attendance.filter(a => !a._deleted && a.date === dateFilter);
    const activeEmployees = employees.filter(e => !e._deleted && e.status === 'active');

    const roster = activeEmployees.map(emp => {
      const record = dailyRecords.find(a => a.employee_id === emp.id || a.employeeId === emp.id);
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        role: emp.role,
        status: record ? record.status : 'present',
        notes: record ? record.notes || '' : '',
        lastMarked: record ? new Date(record.updated_at || record.updatedAt || Date.now()).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : 'Never'
      };
    });

    const filteredRoster = roster.filter(r =>
      r.employeeName.toLowerCase().includes(search) ||
      r.role.toLowerCase().includes(search)
    );

    // Calculate stats
    const presentCount = roster.filter(r => r.status === 'present').length;
    const absentCount = roster.filter(r => r.status === 'absent').length;
    const lateCount = roster.filter(r => r.status === 'late' || r.status === 'on-leave').length;

    const elActive = document.getElementById('attKpiActive');
    const elPresent = document.getElementById('attKpiPresent');
    const elAbsent = document.getElementById('attKpiAbsent');
    const elLate = document.getElementById('attKpiLate');

    if (elActive) elActive.textContent = activeEmployees.length;
    if (elPresent) elPresent.textContent = presentCount;
    if (elAbsent) elAbsent.textContent = absentCount;
    if (elLate) elLate.textContent = lateCount;

    const tbody = document.getElementById('attBody');
    if (!tbody) return;

    if (!filteredRoster.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-calendar-check" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No employees in roster matching search.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredRoster.map(r => `
      <tr data-employee-id="${r.employeeId}">
        <td><strong>${esc(r.employeeName)}</strong></td>
        <td><span class="badge" style="background:var(--bg3);color:var(--muted)">${esc(r.role)}</span></td>
        <td>
          <select class="select select-sm status-select" style="width:130px;background:var(--bg3);border:1px solid var(--border2)" onchange="window.biz.markAttendance('${r.employeeId}', this.value)">
            <option value="present" ${r.status === 'present' ? 'selected' : ''}>✅ Present</option>
            <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>❌ Absent</option>
            <option value="late" ${r.status === 'late' ? 'selected' : ''}>⚠️ Late</option>
            <option value="on-leave" ${r.status === 'on-leave' ? 'selected' : ''}>🌴 On Leave</option>
          </select>
        </td>
        <td>
          <input class="input input-sm notes-input" style="max-width:300px" value="${esc(r.notes)}" placeholder="Add remarks..." onchange="window.biz.updateAttendanceNotes('${r.employeeId}', this.value)"/>
        </td>
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--muted)">${r.lastMarked}</td>
      </tr>
    `).join('');
  }

  async function markAttendance(employeeId, status) {
    const dateFilter = document.getElementById('attDateFilter')?.value || new Date().toISOString().split('T')[0];
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    let record = attendance.find(a => !a._deleted && (a.employee_id === employeeId || a.employeeId === employeeId) && a.date === dateFilter);
    if (!record) {
      record = {
        id: 'att_' + employeeId.replace('emp_', '') + '_' + dateFilter.replace(/\-/g, '') + '_' + Math.random().toString(36).substring(2, 6),
        employee_id: employeeId,
        employee_name: emp.name,
        date: dateFilter,
        status: status,
        notes: '',
        created_at: new Date().toISOString(),
        updated_at: Date.now()
      };
      attendance.push(record);
    } else {
      record.status = status;
      record.updated_at = Date.now();
    }

    try {
      await window.dbPut('attendance', record);
      renderAttendance();
      window.syncData && window.syncData();
    } catch (e) {
      console.error('Failed to mark attendance:', e);
    }
  }

  async function updateAttendanceNotes(employeeId, notes) {
    const dateFilter = document.getElementById('attDateFilter')?.value || new Date().toISOString().split('T')[0];
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    let record = attendance.find(a => !a._deleted && (a.employee_id === employeeId || a.employeeId === employeeId) && a.date === dateFilter);
    if (!record) {
      record = {
        id: 'att_' + employeeId.replace('emp_', '') + '_' + dateFilter.replace(/\-/g, '') + '_' + Math.random().toString(36).substring(2, 6),
        employee_id: employeeId,
        employee_name: emp.name,
        date: dateFilter,
        status: 'present',
        notes: notes,
        created_at: new Date().toISOString(),
        updated_at: Date.now()
      };
      attendance.push(record);
    } else {
      record.notes = notes;
      record.updated_at = Date.now();
    }

    try {
      await window.dbPut('attendance', record);
      renderAttendance();
      window.syncData && window.syncData();
    } catch (e) {
      console.error('Failed to update notes:', e);
    }
  }

  function saveDailyAttendance() {
    window.showToast && window.showToast('📋 Daily roster successfully locked and cloud synced!', 'success');
    window.syncData && window.syncData();
  }

  function exportAttendanceCSV() {
    const dateFilter = document.getElementById('attDateFilter')?.value || new Date().toISOString().split('T')[0];
    const rows = [['Employee', 'Role', 'Status', 'Notes', 'Date', 'Last Marked']];
    const activeEmployees = employees.filter(e => !e._deleted && e.status === 'active');
    const dailyRecords = attendance.filter(a => !a._deleted && a.date === dateFilter);
    activeEmployees.forEach(emp => {
      const record = dailyRecords.find(a => a.employee_id === emp.id || a.employeeId === emp.id);
      const status = record ? record.status : 'present';
      const notes = record ? record.notes || '' : '';
      const lastMarked = record ? new Date(record.updated_at || record.updatedAt || Date.now()).toLocaleTimeString() : 'Never';
      rows.push([emp.name, emp.role, status, notes, dateFilter, lastMarked]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `printex-attendance-${dateFilter}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportAttendanceExcel() {
    const dateFilter = document.getElementById('attDateFilter')?.value || new Date().toISOString().split('T')[0];
    const activeEmployees = employees.filter(e => !e._deleted && e.status === 'active');
    const dailyRecords = attendance.filter(a => !a._deleted && a.date === dateFilter);
    if (!activeEmployees.length) { window.showToast && window.showToast('No active employees to export', 'warn'); return; }
    const headers = ['Employee', 'Role', 'Status', 'Notes', 'Date', 'Last Marked'];
    const rows = activeEmployees.map(emp => {
      const record = dailyRecords.find(a => a.employee_id === emp.id || a.employeeId === emp.id);
      const status = record ? record.status : 'present';
      const notes = record ? record.notes || '' : '';
      const lastMarked = record ? new Date(record.updated_at || record.updatedAt || Date.now()).toLocaleTimeString() : 'Never';
      return [emp.name, emp.role, status, notes, dateFilter, lastMarked];
    });
    window.exportToExcel(headers, rows, 'Attendance', `Printex_Attendance_${dateFilter}.xlsx`);
  }

  window.exportAttendanceCSV = exportAttendanceCSV;
  window.exportAttendanceExcel = exportAttendanceExcel;
  window.printAttendanceTable = function () {
    window.printTable('page-attendance', 'Employee Daily Attendance Roster');
  };
  window.exportAttendancePDF = function () {
    window.exportToPDF('page-attendance', `Attendance_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ── User Management Functions ───────────────────────────────────────
  let userList = [];
  async function loadUsers() {
    if (!window.authenticatedFetch) return;
    try {
      const res = await window.authenticatedFetch('/api/users');
      if (res.ok) {
        userList = await res.json();
        renderUsers();
      } else {
        const errData = await res.json();
        console.warn('[Business] User list failed:', errData);
      }
    } catch (e) {
      console.warn('[Business] User list failed to fetch:', e);
    }
  }

  function renderUsers() {
    const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
    const filtered = userList.filter(u =>
      u.fullName?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );

    const tbody = document.getElementById('userBody');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--dim);padding:40px"><i class="fa fa-user-shield" style="font-size:32px;display:block;margin-bottom:10px;opacity:.3"></i>No registered users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(u => {
      const formattedDate = u.created_at ? new Date(u.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      const currentUserEmail = (window.fAuth && window.fAuth.currentUser) ? window.fAuth.currentUser.email : '';
      const isSelf = u.email?.toLowerCase() === currentUserEmail?.toLowerCase();

      return `
        <tr>
          <td><strong>${esc(u.fullName)}</strong> ${isSelf ? '<span class="badge" style="background:var(--accent-glow);color:var(--accent)">You</span>' : ''}</td>
          <td><span style="font-family:var(--font-mono)">${esc(u.email)}</span></td>
          <td>
            <select class="select select-sm" style="width:120px;background:var(--bg3);border:1px solid var(--border2)" onchange="window.biz.changeUserRole('${u.id}', this.value)" ${isSelf ? 'disabled' : ''}>
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>👤 User</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>⚙️ Admin</option>
            </select>
          </td>
          <td>${formattedDate}</td>
          <td>
            <button class="btn btn-xs btn-outline btn-danger" onclick="window.biz.deleteUser('${u.id}')" ${isSelf ? 'disabled' : ''}><i class="fa fa-trash"></i> Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function changeUserRole(userId, role) {
    if (!window.authenticatedFetch) return;
    try {
      const res = await window.authenticatedFetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: role })
      });
      if (res.ok) {
        window.showToast && window.showToast('User role updated successfully!', 'success');
        loadUsers();
      } else {
        const err = await res.json();
        window.showToast && window.showToast('Role update failed: ' + err.error, 'danger');
      }
    } catch (e) {
      window.showToast && window.showToast('Role update failed.', 'danger');
    }
  }

  async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    if (!window.authenticatedFetch) return;
    try {
      const res = await window.authenticatedFetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        window.showToast && window.showToast('User account deleted successfully.', 'success');
        loadUsers();
      } else {
        const err = await res.json();
        window.showToast && window.showToast('Deletion failed: ' + err.error, 'danger');
      }
    } catch (e) {
      window.showToast && window.showToast('Deletion failed.', 'danger');
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────
  function getArr(store) {
    return store === 'customers' ? customers : store === 'suppliers' ? suppliers : store === 'expenses' ? expenses : store === 'employees' ? employees : store === 'categories' ? categories : store === 'attendance' ? attendance : purchases;
  }

  function refreshPage(store) {
    const fn = { customers: renderCustomers, suppliers: renderSuppliers, expenses: renderExpenses, employees: renderEmployees, categories: renderCategories, purchases: renderPurchases, attendance: renderAttendance }[store];
    if (fn) fn();
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureModal(id, html) {
    let m = document.getElementById(id);
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-overlay';
      m.id = id;
      m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;align-items:center;justify-content:center;padding:20px';
      m.innerHTML = `<div class="modal" style="max-width:580px;width:100%">${html}</div>`;
      document.body.appendChild(m);
    } else {
      const inner = m.querySelector('.modal');
      if (inner) inner.innerHTML = html;
    }
  }

  function exportExpensesCSV() {
    const rows = [['Date', 'Description', 'Category', 'Amount (KSH)', 'Payment Method', 'Reference']];
    expenses.filter(e => !e._deleted).forEach(e => {
      rows.push([e.date || '', e.description || '', e.category || '', e.amount || 0, e.paymentMethod || '', e.reference || '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'printex-expenses.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCustomersExcel() {
    const data = customers.filter(c => !c._deleted);
    if (!data.length) { window.showToast && window.showToast('No customers to export', 'warn'); return; }
    const headers = ['Name', 'Company', 'Email', 'Phone', 'Address', 'Orders', 'Balance (KSH)', 'Notes'];
    const rows = data.map(c => [c.name || '', c.company || '', c.email || '', c.phone || '', c.address || '', c.orderCount || 0, c.balance || 0, c.notes || '']);
    window.exportToExcel(headers, rows, 'Customers', `Printex_Customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportSuppliersExcel() {
    const data = suppliers.filter(s => !s._deleted);
    if (!data.length) { window.showToast && window.showToast('No suppliers to export', 'warn'); return; }
    const headers = ['Name', 'Contact', 'Phone', 'Email', 'Products', 'Lead Days', 'Address', 'Notes'];
    const rows = data.map(s => [s.name || '', s.contact || '', s.phone || '', s.email || '', s.products || '', s.leadDays || '', s.address || '', s.notes || '']);
    window.exportToExcel(headers, rows, 'Suppliers', `Printex_Suppliers_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportExpensesExcel() {
    const data = expenses.filter(e => !e._deleted);
    if (!data.length) { window.showToast && window.showToast('No expenses to export', 'warn'); return; }
    const headers = ['Date', 'Description', 'Category', 'Amount (KSH)', 'Payment Method', 'Reference', 'Notes'];
    const rows = data.map(e => [e.date || '', e.description || '', e.category || '', e.amount || 0, e.paymentMethod || '', e.reference || '', e.notes || '']);
    window.exportToExcel(headers, rows, 'Expenses', `Printex_Expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportEmployeesExcel() {
    const data = employees.filter(e => !e._deleted);
    if (!data.length) { window.showToast && window.showToast('No employees to export', 'warn'); return; }
    const headers = ['Name', 'Role', 'Phone', 'Email', 'Salary (KSH)', 'Start Date', 'Status', 'National ID', 'Notes'];
    const rows = data.map(e => [e.name || '', e.role || '', e.phone || '', e.email || '', e.salary || 0, e.startDate || '', e.status || 'active', e.nationalId || '', e.notes || '']);
    window.exportToExcel(headers, rows, 'Employees', `Printex_Employees_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportPurchasesExcel() {
    const data = purchases.filter(p => !p._deleted);
    if (!data.length) { window.showToast && window.showToast('No purchases to export', 'warn'); return; }
    const headers = ['PO Number', 'Date', 'Supplier', 'Total (KSH)', 'Status', 'Expected Delivery', 'Description', 'Notes'];
    const rows = data.map(p => [p.poNumber || '', p.date || '', p.supplier || '', p.total || 0, p.status || 'pending', p.expectedDate || '', p.description || '', p.notes || '']);
    window.exportToExcel(headers, rows, 'Purchases', `Printex_Purchases_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // INIT + PUBLIC API
  // ═══════════════════════════════════════════════════════════════════
  async function init() {
    await loadAll();
  }

  // Explicit reload and render functions
  async function loadAndRender(store, renderFn) {
    await loadAll();
    renderFn();
  }

  // Expose public API
  window.biz = {
    init,
    // Customers
    filterCustomers: () => loadAndRender('customers', renderCustomers),
    openCustomerModal: () => openCustomerModal(),
    editCustomer: id => openCustomerModal(id),
    exportCustomersExcel,
    // Suppliers
    filterSuppliers: () => loadAndRender('suppliers', renderSuppliers),
    openSupplierModal: () => openSupplierModal(),
    editSupplier: id => openSupplierModal(id),
    exportSuppliersExcel,
    // Expenses
    filterExpenses: () => loadAndRender('expenses', renderExpenses),
    openExpenseModal: () => openExpenseModal(),
    editExpense: id => openExpenseModal(id),
    exportExpensesCSV,
    exportExpensesExcel,
    // Employees
    filterEmployees: () => loadAndRender('employees', renderEmployees),
    openEmployeeModal: () => openEmployeeModal(),
    editEmployee: id => openEmployeeModal(id),
    exportEmployeesExcel,
    payEmployeeSalary: id => payEmployeeSalary(id),
    // Categories
    filterCategories: () => loadAndRender('categories', renderCategories),
    openCategoryModal: () => openCategoryModal(),
    editCategory: id => openCategoryModal(id),
    refreshCategories: () => loadAndRender('categories', renderCategories),
    // Purchases
    filterPurchases: () => loadAndRender('purchases', renderPurchases),
    openPurchaseModal: () => openPurchaseModal(),
    editPurchase: id => openPurchaseModal(id),
    exportPurchasesExcel,
    // Attendance
    filterAttendance: () => { loadAll().then(renderAttendance); },
    renderAttendance,
    markAttendance,
    updateAttendanceNotes,
    saveDailyAttendance,
    exportAttendanceCSV,
    exportAttendanceExcel,
    // User Management
    filterUsers: () => renderUsers(),
    loadUsers,
    changeUserRole,
    deleteUser,
    // Common
    saveRecord,
    deleteRecord,
    parsePurchaseItems
  };

  // Auto-init once DB is ready
  const tryInit = () => {
    if (window.db) {
      init().then(() => console.log('[Business] Module ready.'));
    } else {
      setTimeout(tryInit, 200);
    }
  };
  tryInit();

})();
