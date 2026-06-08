// ═══════════════════════════════════════════════════════════════════
// PROFESSIONAL SERVICES MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

// Standard Seed Services related to industrial, machinery, engineering and printing press repair
window.PROFESSIONAL_SERVICES = [
  { id: 'srv_custom_001', partNum: 'SRV-CUSTOM-01', desc: 'Custom Engineering / Press Repair Service', priceKsh: 0, category: 'Services', isService: true, stock: Infinity }
];

// Injects premium Services page styles dynamically
const injectServicesCSS = () => {
  if (document.getElementById('services-custom-styles')) return;
  const style = document.createElement('style');
  style.id = 'services-custom-styles';
  style.textContent = `
    .services-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 10px;
    }
    .service-card {
      background: var(--card-bg, rgba(30, 30, 40, 0.6));
      border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      border-radius: var(--r, 12px);
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: var(--shadow-sm);
    }
    .service-card:hover {
      transform: translateY(-4px);
      border-color: var(--gold, #d4af37);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    }
    .service-card::before {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 40px; height: 40px;
      background: linear-gradient(135deg, transparent 50%, var(--gold-dim, rgba(212, 175, 55, 0.1)) 50%);
      opacity: 0.8;
    }
    .service-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--gold-dim, rgba(212, 175, 55, 0.15));
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      color: var(--gold, #d4af37);
      font-size: 18px;
    }
    .service-category-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: var(--gold-dim, rgba(212, 175, 55, 0.1));
      color: var(--gold, #d4af37);
      padding: 3px 8px;
      border-radius: 4px;
      width: fit-content;
      margin-bottom: 8px;
    }
    .service-title {
      font-weight: 700;
      font-size: 15px;
      color: var(--text, #fff);
      margin: 0 0 6px 0;
      line-height: 1.3;
    }
    .service-sku {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--muted, #888);
      margin-bottom: 10px;
    }
    .service-desc {
      font-size: 12px;
      color: var(--muted, #ccc);
      line-height: 1.5;
      margin: 0 0 16px 0;
      flex-grow: 1;
    }
    .service-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border2, rgba(255, 255, 255, 0.05));
      padding-top: 14px;
      margin-top: 4px;
    }
    .service-price-label {
      font-size: 10px;
      color: var(--muted, #888);
      margin-bottom: 2px;
    }
    .service-price-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--gold, #d4af37);
    }
    .service-actions {
      display: flex;
      gap: 6px;
    }
    .service-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .service-modal-card {
      background: var(--modal-bg, #1a1a24);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      border-radius: var(--r, 12px);
      width: 100%;
      max-width: 480px;
      padding: 24px;
      box-shadow: var(--shadow-lg);
    }
  `;
  document.head.appendChild(style);
};

// Check and seed professional services
window.checkAndSeedServices = async function() {
  console.log("[Services] Checking if professional services are loaded in database...");
  
  if (!window.parts) window.parts = [];

  // Cleanup: remove old pre-seeded services (ids starting with 'srv_' but not 'srv_custom_001')
  const toDelete = window.parts.filter(p => p.isService === true && String(p.id).startsWith('srv_') && String(p.id) !== 'srv_custom_001');
  if (toDelete.length > 0) {
    console.log(`[Services] Cleaning up ${toDelete.length} legacy services...`);
    for (const s of toDelete) {
      window.parts = window.parts.filter(p => String(p.id) !== String(s.id));
      try {
        await window.dbDelete('parts', String(s.id));
      } catch (e) {
        console.error(`[Services] Failed to delete legacy service ${s.id}:`, e);
      }
    }
  }

  const existingServicesCount = window.parts.filter(p => p.isService === true).length;
  console.log(`[Services] Currently found ${existingServicesCount} services in local parts array.`);

  if (existingServicesCount === 0) {
    console.log("[Services] No services found. Auto-seeding custom engineering service...");
    
    let seedCount = 0;
    for (const service of window.PROFESSIONAL_SERVICES) {
      const matchIdx = window.parts.findIndex(p => String(p.id) === String(service.id) || String(p.partNum) === String(service.partNum));
      if (matchIdx < 0) {
        window.parts.push(service);
        try {
          await window.dbPut('parts', service);
          seedCount++;
        } catch (e) {
          console.error(`[Services] Error seeding ${service.partNum}:`, e);
        }
      }
    }
    console.log(`[Services] Successfully seeded ${seedCount} professional services locally & synced to cloud in background.`);
    if (typeof window.renderInventory === 'function') window.renderInventory();
  }
};

// Returns a suitable FontAwesome icon based on service properties
const getServiceIcon = (category, title) => {
  const t = title.toLowerCase();
  const c = category.toLowerCase();
  if (t.includes('printer') || t.includes('heidelberg') || t.includes('press')) return 'fa-print';
  if (t.includes('motor') || t.includes('conveyor')) return 'fa-gear';
  if (t.includes('calibration') || t.includes('roller')) return 'fa-sliders';
  if (t.includes('electrical') || t.includes('wire') || t.includes('sensor')) return 'fa-bolt';
  if (t.includes('pneumatic') || t.includes('hydraulic')) return 'fa-wind';
  if (t.includes('weld') || t.includes('fabrication')) return 'fa-fire';
  if (t.includes('delivery') || t.includes('rider') || t.includes('logistics')) return 'fa-motorcycle';
  if (t.includes('cleaning') || t.includes('wash')) return 'fa-soap';
  if (t.includes('diagnostics') || t.includes('inspection')) return 'fa-wrench';
  return 'fa-screwdriver-wrench';
};

// Renders the Services main tab
window.renderServicesPage = function(filteredList) {
  injectServicesCSS();
  const container = document.getElementById('page-services');
  if (!container) return;

  const allServices = (window.parts || []).filter(p => p.isService === true);
  const servicesList = filteredList || allServices;

  // Calculate KPIs
  const totalCount = allServices.length;
  
  // Completed Service counts from invoices (where item isService is true)
  let serviceRevenue = 0;
  let serviceInvoiceCount = 0;
  let activeRiderDeliveries = 0;

  if (window.invoices) {
    window.invoices.filter(i => i.type === 'invoice').forEach(inv => {
      const items = inv.items || [];
      const hasService = items.some(it => it.isService === true || String(it.partId).startsWith('srv_') || String(it.partNum).startsWith('SRV-'));
      if (hasService) {
        serviceInvoiceCount++;
        // Accumulate revenue from service line items specifically
        items.forEach(it => {
          if (it.isService === true || String(it.partId).startsWith('srv_') || String(it.partNum).startsWith('SRV-')) {
            serviceRevenue += (it.qty * it.price);
          }
        });
      }
    });
  }

  if (window.submissions) {
    activeRiderDeliveries = window.submissions.filter(s => s.status !== 'Delivered' && s.status !== 'Approved' && (String(s.items_desc).toLowerCase().includes('srv') || String(s.items_desc).toLowerCase().includes('service'))).length;
  }

  let html = `
    <div class="services-container">
      <!-- Services KPIs -->
      <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 8px;">
        <div class="kpi-card" style="--kpi-color: var(--gold)">
          <div class="kpi-label">Active Catalog Services</div>
          <div class="kpi-value" style="color:var(--gold)">${totalCount}</div>
          <div class="kpi-sub">Pre-defined services database</div>
          <i class="fa fa-screwdriver-wrench kpi-icon" style="color:var(--gold)"></i>
        </div>
        <div class="kpi-card" style="--kpi-color: var(--accent)">
          <div class="kpi-label">Cumulative Service Revenue</div>
          <div class="kpi-value" style="color:var(--accent)">${window.formatPrice(serviceRevenue)}</div>
          <div class="kpi-sub">Service line items billed</div>
          <i class="fa fa-coins kpi-icon" style="color:var(--accent)"></i>
        </div>
        <div class="kpi-card" style="--kpi-color: var(--success)">
          <div class="kpi-label">Service Invoices Billed</div>
          <div class="kpi-value" style="color:var(--success)">${serviceInvoiceCount}</div>
          <div class="kpi-sub">Invoices including services</div>
          <i class="fa fa-file-invoice-dollar kpi-icon" style="color:var(--success)"></i>
        </div>
        <div class="kpi-card" style="--kpi-color: var(--warn)">
          <div class="kpi-label">Active Dispatches</div>
          <div class="kpi-value" style="color:var(--warn)">${activeRiderDeliveries}</div>
          <div class="kpi-sub">Pending rider service dispatches</div>
          <i class="fa fa-motorcycle kpi-icon" style="color:var(--warn)"></i>
        </div>
      </div>

      <!-- Controls & Search -->
      <div class="section-controls">
        <div style="display:flex; gap:10px; flex-grow:1; flex-wrap:wrap">
          <div class="search-wrap" style="max-width:320px; flex-grow:1">
            <i class="fa fa-search"></i>
            <input class="search-input" id="serviceSearchInp" placeholder="Search services..." oninput="window.filterServicesList()"/>
          </div>
          <select class="select" id="serviceCategoryFilter" style="width:180px" onchange="window.filterServicesList()">
            <option value="">-- All Categories --</option>
            <option value="Services">Services (Main)</option>
            <option value="Diagnostics">Diagnostics</option>
            <option value="Calibration">Calibration</option>
            <option value="Installation">Installation</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Repair">Repair</option>
          </select>
        </div>
        <div style="display:flex; gap:8px">
          <button class="btn btn-primary btn-sm" onclick="window.openAddServiceModal()"><i class="fa fa-plus"></i> Add Custom Service</button>
          <button class="btn btn-outline btn-sm" onclick="window.checkAndSeedServices()"><i class="fa fa-arrows-rotate"></i> Reset/Seed Catalog</button>
        </div>
      </div>

      <!-- Services Grid -->
      <div class="services-grid">
  `;

  if (servicesList.length === 0) {
    html += `
      </div>
      <div class="card" style="text-align:center; padding:50px; color:var(--muted); grid-column:1/-1">
        <i class="fa fa-screwdriver-wrench" style="font-size:40px; margin-bottom:12px; color:var(--dim)"></i>
        <h3>No services found matching filters</h3>
        <p style="font-size:13px; max-width:400px; margin:0 auto; color:var(--dim)">
          Create a new service above or click "Reset/Seed Catalog" to reload the default Printex engineering service list.
        </p>
      </div>
    `;
  } else {
    html += servicesList.map(s => {
      const icon = getServiceIcon(s.category || 'Services', s.desc || s.partNum);
      const pr = Number(s.priceKsh || 0);
      return `
        <div class="service-card" id="service-card-${s.id}">
          <div>
            <div class="service-category-badge">${window.esc(s.category || 'Services')}</div>
            <div class="service-icon-wrap"><i class="fa ${icon}"></i></div>
            <h4 class="service-title">${window.esc(s.partNum)}</h4>
            <div class="service-sku">${s.id}</div>
            <p class="service-desc">${window.esc(s.desc)}</p>
          </div>
          <div>
            <div class="service-footer">
              <div>
                <div class="service-price-label">Flexible Estimate</div>
                <div class="service-price-value">${pr > 0 ? window.formatPrice(pr) : 'Custom Price'}</div>
              </div>
              <div class="service-actions">
                <button class="btn btn-gold btn-xs" onclick="window.createInvoiceForService('${s.id}')" title="Generate quotation/invoice with this service pre-filled"><i class="fa fa-file-invoice"></i> Bill</button>
                <button class="btn btn-outline btn-xs" onclick="window.dispatchRiderForService('${s.id}')" title="Dispatch rider to customer for this service"><i class="fa fa-motorcycle"></i> Dispatch</button>
                <button class="btn btn-danger btn-xs" onclick="window.deleteService('${s.id}')" title="Delete service"><i class="fa fa-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  html += `
    </div>

    <!-- Modal for adding service -->
    <div class="service-modal-overlay" id="addServiceModal" onclick="if(event.target===this) window.closeAddServiceModal()">
      <div class="service-modal-card">
        <h3 style="margin-top:0; border-bottom:1px solid var(--border2); padding-bottom:10px; margin-bottom:16px;">Add Custom Professional Service</h3>
        <form onsubmit="window.saveNewCustomService(event)">
          <div class="field" style="margin-bottom:12px">
            <label>Service Title/Code *</label>
            <input class="input" id="csTitle" placeholder="e.g. Heidelberg Cylinder Alignment (SRV-HDBG-02)" required/>
          </div>
          <div class="form-row col2" style="margin-bottom:12px">
            <div class="field">
              <label>Category *</label>
              <select class="select" id="csCategory" required>
                <option value="Services">Services (General)</option>
                <option value="Diagnostics">Diagnostics</option>
                <option value="Calibration">Calibration</option>
                <option value="Installation">Installation</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Repair">Repair</option>
              </select>
            </div>
            <div class="field">
              <label>Estimated Base Price (Ksh)</label>
              <input class="input" type="number" id="csPrice" placeholder="e.g. 15000" min="0"/>
            </div>
          </div>
          <div class="field" style="margin-bottom:20px">
            <label>Detailed Service Description *</label>
            <textarea class="input" id="csDesc" rows="3" placeholder="Provide full scope of service works, labor, tooling included..." required></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn btn-outline" type="button" onclick="window.closeAddServiceModal()">Cancel</button>
            <button class="btn btn-success" type="submit"><i class="fa fa-save"></i> Save Service</button>
          </div>
        </form>
      </div>
    </div>
  `;

  container.innerHTML = html;
};

// Filters services dynamically
window.filterServicesList = function() {
  const q = (document.getElementById('serviceSearchInp')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('serviceCategoryFilter')?.value || '';
  const allServices = (window.parts || []).filter(p => p.isService === true);

  const filtered = allServices.filter(s => {
    const pn = String(s.partNum || '').toLowerCase();
    const ds = String(s.desc || '').toLowerCase();
    const sc = String(s.category || '').toLowerCase();
    
    const matchesQuery = pn.includes(q) || ds.includes(q);
    const matchesCat = !cat || sc === cat.toLowerCase();
    return matchesQuery && matchesCat;
  });

  window.renderServicesPage(filtered);
};

// Modal open/close helpers
window.openAddServiceModal = function() {
  const m = document.getElementById('addServiceModal');
  if (m) m.style.display = 'flex';
};

window.closeAddServiceModal = function() {
  const m = document.getElementById('addServiceModal');
  if (m) m.style.display = 'none';
};

// Saves new custom service
window.saveNewCustomService = async function(event) {
  event.preventDefault();
  const title = document.getElementById('csTitle').value.trim();
  const category = document.getElementById('csCategory').value;
  const price = Number(document.getElementById('csPrice').value) || 0;
  const desc = document.getElementById('csDesc').value.trim();

  const id = 'srv_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  const newService = {
    id,
    partNum: title,
    desc,
    priceKsh: price,
    category,
    isService: true,
    stock: Infinity // Services always have infinite stock/always available
  };

  console.log("[Services] Adding new custom service:", newService);

  if (!window.parts) window.parts = [];
  window.parts.push(newService);

  try {
    await window.dbPut('parts', newService);
    window.showToast(`Service "${title}" added successfully!`, 'success');
    window.closeAddServiceModal();
    window.renderServicesPage();
    if (typeof window.renderInventory === 'function') window.renderInventory();
    
    await window.logActivity(`New service added to catalog: ${title} — Ksh ${price.toLocaleString()}`, 'success');
  } catch(e) {
    console.error("[Services] Failed to save custom service:", e);
    window.showToast("Failed to save service: " + e.message, "error");
  }
};

// Deletes service
window.deleteService = async function(id) {
  const service = window.parts.find(p => String(p.id) === String(id));
  if (!service) return;

  if (!confirm(`Are you sure you want to delete service "${service.partNum}"?`)) return;

  try {
    // Delete from memory
    const idx = window.parts.findIndex(p => String(p.id) === String(id));
    if (idx >= 0) window.parts.splice(idx, 1);

    // Delete from databases
    await window.dbDelete('parts', id);

    window.showToast(`Service deleted successfully`, 'success');
    window.renderServicesPage();
    if (typeof window.renderInventory === 'function') window.renderInventory();

    await window.logActivity(`Service removed from catalog: ${service.partNum}`, 'delete');
  } catch (e) {
    console.error("[Services] Failed to delete service:", e);
    window.showToast("Failed to delete service: " + e.message, "error");
  }
};

// Pre-fill invoice with the service and direct to Billing/Invoice tab
window.createInvoiceForService = function(id) {
  const service = window.parts.find(p => String(p.id) === String(id));
  if (!service) return window.showToast('Service not found', 'error');

  // Initialize invoice items if empty or not done
  if (typeof window.initCreateInvoice === 'function') {
    window.initCreateInvoice();
  }

  // Pre-add service to line items with customizable price
  window.lineItems.push({
    partId: service.id,
    partNum: service.partNum,
    desc: service.desc,
    qty: 1,
    price: service.priceKsh || 0,
    isService: true
  });

  window.renderLineItems();
  window.showToast(`✓ Pre-filled Service "${service.partNum}" in Invoice builder. You can customize the price now.`, 'success');

  // Navigate to createInvoice page
  const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'createInvoice'"));
  window.showPage('createInvoice', navEl);
};

// Pre-fill rider delivery form with service dispatch
window.dispatchRiderForService = function(id) {
  const service = window.parts.find(p => String(p.id) === String(id));
  if (!service) return window.showToast('Service not found', 'error');

  // Direct to deliveries tab
  const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes("'freelance'"));
  window.showPage('freelance', navEl);

  // Switch to Dispatch Tab if exists in freelance page
  if (typeof window.switchDeliveryTab === 'function') {
    window.switchDeliveryTab('new');
  }

  // Auto-populate delivery form with service info
  setTimeout(() => {
    const custInp = document.getElementById('dfCustomer');
    const itemsInp = document.getElementById('dfItems');
    const notesInp = document.getElementById('dfNotes');
    
    if (custInp) custInp.focus();
    if (itemsInp) itemsInp.value = `1x Service Dispatch: ${service.partNum}`;
    if (notesInp) notesInp.value = `Assigned task: ${service.desc}`;
    
    window.showToast(`✓ Pre-filled Dispatch Form with "${service.partNum}". Enter customer details to submit.`, 'success');
  }, 100);
};
