// ═══════════════════════════════════════════════════════════════════
// SMART RIDER QR WORKFLOW SYSTEM
// ═══════════════════════════════════════════════════════════════════

// Dynamic CSS Injection
const injectDeliveryStyles = () => {
  if (document.getElementById('delivery-styles')) return;
  const style = document.createElement('style');
  style.id = 'delivery-styles';
  style.textContent = `
    .del-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .del-card { background: var(--card-bg, var(--bg2)); border: 1px solid var(--border2); border-radius: 12px; padding: 18px; transition: all 0.2s ease; position: relative; overflow: hidden; }
    .del-card:hover { border-color: var(--accent); box-shadow: 0 6px 20px rgba(0,0,0,0.15); transform: translateY(-2px); }
    
    .del-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 20px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .del-tab { padding: 10px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--muted); border: 1px solid transparent; transition: all 0.2s; white-space: nowrap; background: rgba(255,255,255,0.02); }
    .del-tab.active { background: var(--accent); color: #000; border-color: var(--accent); box-shadow: 0 0 15px var(--accent-glow); }
    
    .del-status { padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .st-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .st-received { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .st-route { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); }
    .st-arrived { background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4); }
    .st-delivered { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
    .st-approved { background: rgba(16, 185, 129, 0.25); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.5); font-weight: 900; }
    .st-cancelled { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }

    .del-big-btn { width: 100%; padding: 18px; font-size: 16px; font-weight: 800; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; border: none; cursor: pointer; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px; }
    .del-big-btn.primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #000; box-shadow: 0 4px 15px var(--accent-glow); }
    .del-big-btn.primary:active { transform: scale(0.98); }
    .del-big-btn.outline { background: transparent; color: var(--accent); border: 2px solid var(--accent); }
    
    .del-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 8px; }
    .del-meta i { width: 16px; text-align: center; color: var(--dim); }

    .timeline-item { padding-left: 20px; position: relative; margin-bottom: 15px; }
    .timeline-item::before { content:''; position:absolute; left:4px; top:4px; bottom:-15px; width:2px; background:var(--border2); }
    .timeline-item:last-child::before { display:none; }
    .timeline-dot { position:absolute; left:0; top:4px; width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
    .timeline-time { font-size:11px; color:var(--dim); font-weight:600; margin-bottom:2px; }
    .timeline-content { font-size:13px; color:var(--text); }

    #qr-reader { width: 100%; max-width: 500px; margin: 0 auto; border: 2px dashed var(--border2); border-radius: 12px; overflow: hidden; background: #000; }
  `;
  document.head.appendChild(style);
};

window.currentDeliveryTab = window.currentDeliveryTab || 'active';
let html5QrcodeScanner = null;

const getDeliveryStatusClass = (st) => {
  const s = (st||'').toLowerCase();
  if (s.includes('pending')) return 'st-pending';
  if (s.includes('received')) return 'st-received';
  if (s.includes('route')) return 'st-route';
  if (s.includes('arrive')) return 'st-arrived';
  if (s.includes('final approved')) return 'st-approved';
  if (s.includes('deliver') || s.includes('customer')) return 'st-delivered';
  return 'st-cancelled';
};

// Auto-boot if QR scanned via phone camera URL param or dynamic route
setTimeout(() => {
  const urlParams = new URLSearchParams(window.location.search);
  let qrParam = urlParams.get('delivery_qr');
  const token = urlParams.get('token');

  if (window.location.pathname.startsWith('/delivery/')) {
    qrParam = window.location.pathname.replace('/delivery/', '').split('/')[0];
  }

  if (qrParam && typeof window.showPage === 'function') {
    window.showPage('freelance');
    setTimeout(() => {
      window.processQRScan(qrParam, token);
      // Clean URL without reloading
      // window.history.replaceState({}, document.title, window.location.pathname);
    }, 1000); // give time for DB load
  }
}, 500);

// Main Render
window.renderFreelancePage = function() {
  injectDeliveryStyles();
  const content = document.getElementById('page-freelance');
  if (!content) return;

  const deliveries = window.submissions || [];

  try {
    content.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <div>
          <h2 style="margin:0; font-size:24px; display:flex; align-items:center; gap:10px;">
            <i class="fa fa-motorcycle" style="color:var(--accent)"></i> Rider Workflow
          </h2>
          <div style="font-size:12px; color:var(--muted); margin-top:4px;">Smart QR-based realtime dispatch system</div>
        </div>
      </div>

      <div class="del-tabs">
        <div class="del-tab ${window.currentDeliveryTab==='active'?'active':''}" onclick="window.switchDeliveryTab('active')"><i class="fa fa-route"></i> Active Deliveries</div>
        <div class="del-tab ${window.currentDeliveryTab==='new'?'active':''}" onclick="window.switchDeliveryTab('new')"><i class="fa fa-plus"></i> New Dispatch</div>
        <div class="del-tab ${window.currentDeliveryTab==='history'?'active':''}" onclick="window.switchDeliveryTab('history')"><i class="fa fa-history"></i> History & Proofs</div>
      </div>

      <div id="delivery-content">
        ${window.currentDeliveryTab === 'active' ? renderActiveDeliveries(deliveries) : ''}
        ${window.currentDeliveryTab === 'new' ? renderNewDeliveryForm() : ''}
        ${window.currentDeliveryTab === 'history' ? renderDeliveryHistory(deliveries) : ''}
      </div>
    `;

  } catch(e) {
    console.error('Delivery render error:', e);
    content.innerHTML = `<div class="card" style="color:var(--danger)">Render Error: ${e.message}</div>`;
  }
};

window.switchDeliveryTab = function(tab) {
  window.currentDeliveryTab = tab;
  window.renderFreelancePage();
};

const renderActiveDeliveries = (all) => {
  const active = all.filter(d => d.status !== 'FINAL APPROVED' && d.status !== 'Cancelled');
  if (active.length === 0) return `<div class="card" style="text-align:center; padding:40px; color:var(--muted)"><i class="fa fa-box-open" style="font-size:40px; margin-bottom:15px; opacity:0.5"></i><br>No active deliveries right now.</div>`;

  return `
    <div class="del-grid">
      ${active.map(d => `
        <div class="del-card" onclick="window.openDeliveryModal('${d.id}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div style="font-size:16px; font-weight:800; color:var(--text)">${d.customer || 'Unknown'}</div>
            <span class="del-status ${getDeliveryStatusClass(d.status)}">${d.status}</span>
          </div>
          
          <div class="del-meta"><i class="fa fa-map-marker-alt"></i> <b>${d.location || 'No location'}</b></div>
          <div class="del-meta"><i class="fa fa-phone"></i> ${d.phone || 'No phone'}</div>
          ${d.invoice_linked ? `<div class="del-meta"><i class="fa fa-file-invoice"></i> INV: <b style="color:var(--accent)">${d.invoice_linked}</b></div>` : ''}
          <div class="del-meta"><i class="fa fa-motorcycle"></i> Rider: <b>${d.rider_name || 'Unassigned'}</b></div>
          
          <div style="margin-top:15px; padding-top:12px; border-top:1px solid var(--border2); font-size:11px; color:var(--dim); display:flex; justify-content:space-between; align-items:center;">
            <span>ID: ${d.id.substring(d.id.length-6)}</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="margin-right:4px;">${new Date(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              ${(!d.status.includes('Delivered') && d.status !== 'FINAL APPROVED') ? `<button onclick="event.stopPropagation(); window.fastUpdateDelivery('${d.id}', 'Customer Received Package')" style="background:rgba(34, 197, 94, 0.1); border:1px solid rgba(34, 197, 94, 0.3); color:#4ade80; border-radius:4px; padding:3px 8px; cursor:pointer;" title="Mark as Delivered"><i class="fa fa-check"></i> Delivered</button>` : ''}
              ${(d.status.includes('Delivered') || d.status.includes('Arrived')) && d.status !== 'FINAL APPROVED' ? `<button onclick="event.stopPropagation(); window.fastUpdateDelivery('${d.id}', 'FINAL APPROVED')" style="background:rgba(16, 185, 129, 0.2); border:1px solid rgba(16, 185, 129, 0.5); color:#10b981; font-weight:bold; border-radius:4px; padding:3px 8px; cursor:pointer;" title="Confirm & Approve"><i class="fa fa-check-double"></i> Approve</button>` : ''}
              <button onclick="event.stopPropagation(); window.deleteDelivery('${d.id}')" style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); color:var(--danger); border-radius:4px; padding:3px 6px; cursor:pointer;" title="Delete Delivery"><i class="fa fa-trash"></i></button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

const renderDeliveryHistory = (all) => {
  const hist = all.filter(d => d.status === 'FINAL APPROVED' || d.status === 'Cancelled').sort((a,b)=>b.updated_at - a.updated_at);
  if (hist.length === 0) return `<div class="card" style="text-align:center; padding:40px; color:var(--muted)">No delivery history found.</div>`;

  return `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${hist.map(d => `
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="window.openDeliveryModal('${d.id}')">
          <div>
            <div style="font-weight:700; font-size:15px;">${d.customer}</div>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;"><i class="fa fa-file-invoice"></i> ${d.invoice_linked||'No Invoice'} • <i class="fa fa-motorcycle"></i> ${d.rider_name||'None'}</div>
          </div>
          <div style="text-align:right">
            <span class="del-status ${getDeliveryStatusClass(d.status)}">${d.status}</span>
            <div style="font-size:11px; color:var(--dim); margin-top:6px;">${new Date(d.updated_at).toLocaleDateString()}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

const renderNewDeliveryForm = () => {
  return `
    <div class="card" style="max-width:600px; margin:0 auto;">
      <h3 style="margin-top:0; border-bottom:1px solid var(--border2); padding-bottom:10px; margin-bottom:15px;">Dispatch New Delivery</h3>
      
      <div class="field" style="margin-bottom:15px;">
        <label>Link to Invoice <span style="color:var(--accent)">(Highly Recommended)</span></label>
        <select class="select" id="dfInvoice" onchange="window.autoFillDeliveryForm(this.value)">
          <option value="">-- Select Invoice --</option>
          ${(window.invoices||[]).filter(i=>i.type==='invoice').sort((a,b)=>b.timestamp-a.timestamp).map(i => {
            const isToday = new Date(i.timestamp).toDateString() === new Date().toDateString();
            const dateStr = isToday ? 'TODAY' : new Date(i.timestamp).toLocaleDateString();
            return `<option value="${i.id}">${i.id} - ${i.customer} [${dateStr}]</option>`;
          }).join('')}
        </select>
      </div>

      <div class="form-row col2">
        <div class="field"><label>Customer Name *</label><input class="input" id="dfCustomer" placeholder="John Doe"/></div>
        <div class="field"><label>Phone Number *</label><input class="input" id="dfPhone" placeholder="0712..."/></div>
      </div>

      <div class="field"><label>Delivery Destination *</label><input class="input" id="dfLocation" placeholder="Full Address / Building"/></div>

      <div class="form-row col2">
        <div class="field"><label>Assigned Rider</label><input class="input" id="dfRider" placeholder="Rider Name"/></div>
        <div class="field"><label>Items Description</label><input class="input" id="dfItems" placeholder="e.g. 2x Valves, 1x Gear"/></div>
      </div>

      <div class="field"><label>Rider Notes</label><textarea class="textarea" id="dfNotes" rows="2" placeholder="Gate codes, delivery urgency, who to ask for..."></textarea></div>

      <button class="del-big-btn primary" style="margin-top:20px;" onclick="window.submitDelivery()"><i class="fa fa-motorcycle"></i> Create Dispatch</button>
    </div>
  `;
};

window.autoFillDeliveryForm = function(invId) {
  if (!invId) return;
  const inv = window.invoices.find(i => String(i.id) === String(invId));
  if (!inv) return;

  const cInp = document.getElementById('dfCustomer');
  const lInp = document.getElementById('dfLocation');
  const iInp = document.getElementById('dfItems');
  
  if (cInp && !cInp.value) cInp.value = inv.customer || '';
  if (lInp && !lInp.value) lInp.value = inv.customerAddress || '';
  
  if (iInp && !iInp.value) {
    const items = inv.items || [];
    iInp.value = items.map(x => `${x.qty}x ${x.desc}`).join(', ');
  }
};

window.submitDelivery = async function() {
  const customer = document.getElementById('dfCustomer')?.value.trim();
  const phone = document.getElementById('dfPhone')?.value.trim();
  const location = document.getElementById('dfLocation')?.value.trim();
  const rider = document.getElementById('dfRider')?.value.trim();
  const items = document.getElementById('dfItems')?.value.trim();
  const notes = document.getElementById('dfNotes')?.value.trim();
  const invoice = document.getElementById('dfInvoice')?.value;

  if (!customer || !phone || !location) return window.showToast('Customer, Phone, and Location are required', 'warn');

  const id = 'DEL-' + Date.now();
  const qrToken = btoa(id + '-' + Date.now()); 

  const delivery = {
    id,
    customer,
    phone,
    location,
    rider_name: rider,
    items_desc: items,
    notes,
    invoice_linked: invoice,
    status: 'Pending',
    qr_token: qrToken,
    history: JSON.stringify([{ action: 'Delivery created', time: Date.now() }]),
    created_at: Date.now(),
    updated_at: Date.now()
  };

  try {
    await window.dbPut('submissions', delivery);
    window.submissions.push(delivery);
    window.showToast('Delivery Dispatched!', 'success');
    if (typeof window.triggerSyncBroadcast === 'function') window.triggerSyncBroadcast('submissions');
    
    // Automatically generate printable rider doc on dispatch
    window.printRiderDocument(delivery.id);
    
    window.switchDeliveryTab('active');
  } catch(e) {
    window.showToast('Failed to save delivery: ' + e.message, 'error');
  }
};

window.processQRScan = function(qrData, token = null) {
  let targetId = qrData;
  // Handle URL or raw token
  if (qrData.includes('delivery_qr=')) {
    const urlParams = new URLSearchParams(qrData.split('?')[1]);
    targetId = urlParams.get('delivery_qr') || targetId;
  }
  
  if (targetId.startsWith('PRINTEX-DEL-')) {
    targetId = targetId.replace('PRINTEX-DEL-', '').split('-TOKEN-')[0];
  }

  const delivery = window.submissions.find(d => 
    d.id === targetId || 
    d.qr_token === qrData || 
    d.qr_token === token ||
    (d.invoice_linked && qrData.includes(d.invoice_linked))
  );
  
  if (!delivery) {
    window.showToast('Invalid QR Code. No delivery found.', 'error');
    return;
  }

  // Open the interactive rider delivery workflow
  window.openDeliveryModal(delivery.id, true);
};

window.openDeliveryModal = function(id, isRiderWorkflow = false) {
  const d = window.submissions.find(s => s.id === id);
  if (!d) return;

  const hist = JSON.parse(d.history || '[]');

  let modal = document.getElementById('flTaskModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flTaskModal';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';

  const isApproved = d.status === 'FINAL APPROVED';
  const isDelivered = d.status.includes('Delivered') || d.status.includes('Customer Received') || isApproved;
  const isEnRoute = d.status.includes('Route') || isDelivered;
  const isPickedUp = d.status.includes('Received') || isEnRoute || isDelivered;
  const isArrivedOrDelivered = d.status.includes('Arrived') || isDelivered;

  modal.innerHTML = `
    <div class="modal" style="max-width:550px; width:100%; padding:0; background:#f3f4f6; overflow:hidden; border-radius:24px;">
      
      <!-- Top Header -->
      <div style="background:#000; padding:24px; text-align:center; position:relative;">
        <button onclick="document.getElementById('flTaskModal').style.display='none'" style="position:absolute; right:15px; top:15px; background:transparent; border:none; color:#fff; width:30px; height:30px; font-size:20px; cursor:pointer;">✕</button>
        <h1 style="color:#fff; font-size:24px; margin:0; font-weight:800;">Rider Delivery Tracking</h1>
        <p style="color:#9ca3af; font-size:14px; margin:4px 0 0 0;">Live Package Status Updates</p>
      </div>

      <div style="padding:24px; max-height:75vh; overflow-y:auto;">
        
        <h2 style="font-size:20px; font-weight:800; color:#1f2937; margin:0 0 20px 0;">Delivery Progress</h2>

        <!-- Tracking Steps -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          
          <!-- Step 1 -->
          <div style="display:flex; align-items:flex-start; gap:16px;">
            <div style="width:48px; height:48px; min-width:48px; border-radius:50%; background:${isPickedUp ? '#000' : '#e5e7eb'}; color:${isPickedUp ? '#fff' : '#9ca3af'}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">1</div>
            <div style="background:#fff; padding:16px; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:100%; border:1px solid ${isPickedUp ? '#d1d5db' : '#f3f4f6'}; opacity:${isPickedUp ? '1' : '0.5'}">
              <h3 style="margin:0 0 4px 0; font-size:16px; color:#1f2937;">Package Has Left</h3>
              <p style="margin:0; font-size:13px; color:#4b5563;">The rider has collected the package from the warehouse or store.</p>
            </div>
          </div>

          <!-- Step 2 -->
          <div style="display:flex; align-items:flex-start; gap:16px;">
            <div style="width:48px; height:48px; min-width:48px; border-radius:50%; background:${isEnRoute || isDelivered ? '#eab308' : '#e5e7eb'}; color:${isEnRoute || isDelivered ? '#fff' : '#9ca3af'}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">2</div>
            <div style="background:${isEnRoute && !isDelivered ? '#fefce8' : '#fff'}; padding:16px; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:100%; border:1px solid ${isEnRoute || isDelivered ? '#fde047' : '#f3f4f6'}; opacity:${isEnRoute || isDelivered ? '1' : '0.5'}">
              <h3 style="margin:0 0 4px 0; font-size:16px; color:#1f2937;">Package Is On The Way</h3>
              <p style="margin:0; font-size:13px; color:#4b5563;">The rider is currently transporting the package to the customer.</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div style="display:flex; align-items:flex-start; gap:16px;">
            <div style="width:48px; height:48px; min-width:48px; border-radius:50%; background:${isDelivered ? '#16a34a' : '#e5e7eb'}; color:${isDelivered ? '#fff' : '#9ca3af'}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">3</div>
            <div style="background:${isDelivered ? '#f0fdf4' : '#fff'}; padding:16px; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1); width:100%; border:1px solid ${isDelivered ? '#86efac' : '#f3f4f6'}; opacity:${isDelivered ? '1' : '0.5'}">
              <h3 style="margin:0 0 4px 0; font-size:16px; color:#1f2937;">Package Delivered</h3>
              <p style="margin:0; font-size:13px; color:#4b5563;">The customer has successfully received the package.</p>
            </div>
          </div>

        </div>

        <!-- Rider Info Card -->
        <div style="margin-top:30px; background:#111827; color:#fff; padding:24px; border-radius:20px; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
          <h3 style="font-size:18px; font-weight:800; margin:0 0 16px 0;">Rider Information</h3>
          <div style="display:flex; flex-direction:column; gap:10px; font-size:14px; color:#d1d5db;">
            <div style="display:flex; justify-content:space-between;"><span style="color:#fff; font-weight:600;">Rider Name:</span> <span>${d.rider_name || 'System Auto-Assign'}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:#fff; font-weight:600;">Customer:</span> <span>${d.customer}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:#fff; font-weight:600;">Phone:</span> <span>${d.phone}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:#fff; font-weight:600;">Invoice Linked:</span> <span>${d.invoice_linked || 'N/A'}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:#fff; font-weight:600;">Delivery Status:</span> <span style="color:var(--accent);">${d.status}</span></div>
          </div>
        </div>

        <!-- Interactive Rider Status Buttons -->
        ${!isApproved ? `
          <div style="margin-top:20px;">
            <div style="font-size:12px; color:#6b7280; margin-bottom:10px; text-transform:uppercase; font-weight:700; text-align:center;">Rider Actions</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <button class="del-big-btn" onclick="window.fastUpdateDelivery('${d.id}', 'Package Received')" style="padding:12px; font-size:13px; background:#fff; color:#000; border:1px solid #ccc;"><i class="fa fa-hand-holding-box"></i> Picked Up</button>
              <button class="del-big-btn" onclick="window.fastUpdateDelivery('${d.id}', 'In Route')" style="padding:12px; font-size:13px; background:#fff; color:#000; border:1px solid #ccc;"><i class="fa fa-motorcycle"></i> In Route</button>
              <button class="del-big-btn" onclick="window.fastUpdateDelivery('${d.id}', 'Arrived')" style="padding:12px; font-size:13px; background:#fff; color:#000; border:1px solid #ccc;"><i class="fa fa-map-pin"></i> Arrived</button>
              <button class="del-big-btn" onclick="window.fastUpdateDelivery('${d.id}', 'Customer Received Package')" style="padding:12px; font-size:13px; background:#16a34a; color:#fff; border:none;"><i class="fa fa-check-circle"></i> Completed</button>
            </div>
            
            ${(!isRiderWorkflow && isArrivedOrDelivered) ? `
              <div style="margin-top:20px; border-top:2px dashed #d1d5db; padding-top:20px;">
                <div style="font-size:12px; color:#10b981; margin-bottom:10px; text-transform:uppercase; font-weight:800; text-align:center;"><i class="fa fa-shield-check"></i> Admin Approval Required</div>
                <button class="del-big-btn" onclick="window.fastUpdateDelivery('${d.id}', 'FINAL APPROVED')" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; padding:16px; font-size:16px; text-transform:uppercase; letter-spacing:1px; box-shadow:0 4px 15px rgba(16, 185, 129, 0.4);"><i class="fa fa-check-double"></i> Confirm Delivery & Approve</button>
              </div>
            ` : ''}

            ${!isRiderWorkflow ? `<div style="margin-top:15px; text-align:center;"><button onclick="window.deleteDelivery('${d.id}')" style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:12px; transition:all 0.2s;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'"><i class="fa fa-trash"></i> Delete Delivery</button></div>` : ''}
          </div>
        ` : ''}

        <!-- Document Generation -->
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
          ${isDelivered ? `
            <button class="del-big-btn" style="background:#fff; color:#b91c1c; border:1px solid #fca5a5;" onclick="window.generateProofOfDelivery('${d.id}')">
              <i class="fa fa-file-pdf"></i> Download Proof of Delivery
            </button>
          ` : `
            <button class="del-big-btn" style="background:#fff; color:#000; border:1px solid #d1d5db;" onclick="window.printRiderDocument('${d.id}')">
              <i class="fa fa-print"></i> Print Rider Dispatch Document
            </button>
          `}
        </div>

      </div>
    </div>
  `;
};

window.fastUpdateDelivery = async function(id, status) {
  const d = window.submissions.find(s => s.id === id);
  if (!d) return;

  if (d.status === status) return window.showToast('Status already set to ' + status, 'warn');

  const hist = JSON.parse(d.history || '[]');
  hist.push({ action: `Status updated to ${status}`, time: Date.now() });

  d.status = status;
  d.history = JSON.stringify(hist);
  d.updated_at = Date.now();

  try {
    await window.dbPut('submissions', d);
    if (typeof window.triggerSyncBroadcast === 'function') window.triggerSyncBroadcast('submissions');
    
    if (status === 'FINAL APPROVED') {
      window.showToast('✅ Delivery Finalized and Approved!', 'success');
      if (typeof window.logActivity === 'function') {
        window.logActivity(`✅ ${d.customer} delivery final approval completed by admin.`, 'success');
        
        // Finalize inventory deduction logic moved here
        if (!d.inventory_finalized && d.invoice_linked) {
          d.inventory_finalized = true;
          d.approved_by = localStorage.getItem('printex_username') || 'Admin';
          window.logActivity(`Inventory delivery finalized and archived for invoice ${d.invoice_linked}`, 'delivery');
          await window.dbPut('submissions', d);
        }
      }
    } else if (status.includes('Delivered') || status.includes('Customer Received')) {
      window.showToast('🎉 Delivery Completed successfully!', 'success');
      if (typeof window.logActivity === 'function') {
        window.logActivity(`🎉 ${d.customer} package delivered by rider. Awaiting admin approval.`, 'success');
      }
    } else {
      window.showToast(`Status updated: ${status}`, 'success');
    }

    // Refresh modal UI
    window.openDeliveryModal(d.id, true);
    if (window.currentDeliveryTab !== 'scanner') window.renderFreelancePage();

  } catch(e) {
    window.showToast('Failed to update: ' + e.message, 'error');
  }
};

window.deleteDelivery = async function(id) {
  if (!confirm('Are you sure you want to completely remove this active delivery? This action cannot be undone.')) return;
  const idx = window.submissions.findIndex(s => s.id === id);
  if (idx > -1) {
    try {
      await window.dbDelete('submissions', id);
      window.submissions.splice(idx, 1);
      window.showToast('Delivery deleted safely.', 'success');
      if (typeof window.triggerSyncBroadcast === 'function') window.triggerSyncBroadcast('submissions');
      const modal = document.getElementById('flTaskModal');
      if (modal) modal.style.display = 'none';
      if (window.currentDeliveryTab !== 'scanner') window.renderFreelancePage();
    } catch(e) {
      window.showToast('Failed to delete delivery: ' + e.message, 'error');
    }
  }
};

window.printRiderDocument = function(id) {
  const d = window.submissions.find(s => s.id === id);
  if (!d) return;
  
  const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? window.location.origin 
    : 'https://printex.vercel.app';
  const qrUrl = `${baseUrl}/delivery/${d.id}?token=${d.qr_token}`;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Rider Dispatch Document - ${d.customer}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #000; padding: 40px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
          .label { font-size: 12px; color: #666; text-transform: uppercase; }
          .val { font-size: 16px; font-weight: bold; }
          .qr-box { text-align: center; margin-top: 40px; border: 2px dashed #ccc; padding: 20px; display: inline-block; }
          .sig-box { margin-top: 60px; display: flex; justify-content: space-between; }
          .sig-line { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 14px; }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <div class="header">
          <div class="title">RIDER DISPATCH DOCUMENT</div>
          <div style="font-size:14px; margin-top:5px;">PRINTEX ENGINEERS LTD</div>
        </div>

        <div class="row">
          <div><div class="label">Customer</div><div class="val">${d.customer}</div></div>
          <div style="text-align:right"><div class="label">Date Generated</div><div class="val">${new Date().toLocaleDateString()}</div></div>
        </div>
        <div class="row">
          <div><div class="label">Destination</div><div class="val">${d.location}</div></div>
          <div style="text-align:right"><div class="label">Phone</div><div class="val">${d.phone}</div></div>
        </div>
        <div class="row">
          <div><div class="label">Assigned Rider</div><div class="val">${d.rider_name || 'N/A'}</div></div>
          <div style="text-align:right"><div class="label">Linked Invoice</div><div class="val">${d.invoice_linked || 'N/A'}</div></div>
        </div>
        
        <div style="margin-top:20px;">
          <div class="label">Package Items</div>
          <div style="font-size:16px; margin-top:5px; border:1px solid #000; padding:15px; min-height:60px;">${d.items_desc || 'No specific items listed.'}</div>
        </div>

        ${d.notes ? `<div style="margin-top:20px;"><div class="label">Special Delivery Notes</div><div style="font-size:14px; font-style:italic; margin-top:5px;">${d.notes}</div></div>` : ''}

        <div style="text-align:center;">
          <div class="qr-box">
            <div id="qrcode"></div>
            <div style="font-size:11px; margin-top:10px;">SCAN FOR REALTIME WORKFLOW</div>
          </div>
        </div>

        <div class="sig-box">
          <div class="sig-line">Dispatch Officer Signature</div>
          <div class="sig-line">Rider Signature</div>
        </div>

        <script>
          new QRCode(document.getElementById("qrcode"), {
            text: "${qrUrl}",
            width: 150,
            height: 150
          });
          setTimeout(() => { window.print(); }, 1000);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

window.generateProofOfDelivery = function(id) {
  const d = window.submissions.find(s => s.id === id);
  if (!d) return;

  const hist = JSON.parse(d.history || '[]');
  const completionTime = new Date(d.updated_at).toLocaleString();

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Proof of Delivery - ${d.customer}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #000; padding: 40px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 4px double #000; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 26px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
          .badge { display:inline-block; padding:8px 16px; background:#e8f5e9; color:#2e7d32; border:2px solid #2e7d32; border-radius:20px; font-weight:bold; font-size:18px; margin-top:10px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 15px; }
          .label { font-size: 12px; color: #666; text-transform: uppercase; font-weight:bold; }
          .val { font-size: 16px; }
          .timeline { margin-top:30px; border-top:1px solid #ccc; padding-top:20px; }
          .sig-box { margin-top: 60px; display: flex; justify-content: space-between; }
          .sig-line { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PROOF OF DELIVERY</div>
          <div style="font-size:14px; margin-top:5px;">PRINTEX ENGINEERS LTD</div>
          <div class="badge">${d.status === 'FINAL APPROVED' ? 'OFFICIALLY APPROVED & COMPLETED' : 'SUCCESSFULLY DELIVERED'}</div>
        </div>

        <div class="row">
          <div><div class="label">Customer</div><div class="val">${d.customer}</div></div>
          <div style="text-align:right"><div class="label">Completion Date</div><div class="val">${completionTime}</div></div>
        </div>
        <div class="row">
          <div><div class="label">Delivered To</div><div class="val">${d.location}</div></div>
          <div style="text-align:right"><div class="label">Invoice Linked</div><div class="val">${d.invoice_linked || 'N/A'}</div></div>
        </div>
        <div class="row">
          <div><div class="label">Delivered By</div><div class="val">${d.rider_name || 'System Rider'}</div></div>
          <div style="text-align:right"><div class="label">Tracking ID</div><div class="val">${d.id}</div></div>
        </div>
        
        ${d.status === 'FINAL APPROVED' ? `
        <div class="row" style="margin-top:15px; background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px;">
          <div><div class="label" style="color:#16a34a;">Approved By</div><div class="val" style="font-weight:bold;">${d.approved_by || 'Admin'}</div></div>
          <div style="text-align:right"><div class="label" style="color:#16a34a;">Final Approval Status</div><div class="val" style="font-weight:bold; color:#16a34a;">VERIFIED</div></div>
        </div>` : ''}
        
        <div style="margin-top:20px;">
          <div class="label">Items Delivered</div>
          <div style="font-size:16px; margin-top:5px; border:1px solid #000; padding:15px; background:#fafafa;">${d.items_desc || 'No specific items listed.'}</div>
        </div>

        <div class="timeline">
          <div class="label" style="margin-bottom:15px; font-size:14px;">Electronic Tracking Log</div>
          ${hist.map(h => `
            <div style="margin-bottom:10px; font-size:13px;">
              <span style="display:inline-block; width:150px; color:#555;">${new Date(h.time).toLocaleString()}</span>
              <b>${h.action}</b>
            </div>
          `).join('')}
        </div>

        <div class="sig-box">
          <div class="sig-line">Rider Confirmation<br><span style="font-size:10px; color:#666;">(Electronically Signed)</span></div>
          <div class="sig-line">Customer / Receiver Signature<br><br></div>
        </div>

        <script>setTimeout(() => { window.print(); }, 500);</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// Auto-inject QR rendering into invoices (Patching existing invoice generation safely)
const originalBuildInvoiceHTML = window.buildInvoiceHTML;
if (originalBuildInvoiceHTML && !window.qrPatchApplied) {
  window.qrPatchApplied = true;
  window.buildInvoiceHTML = function(inv, isProforma) {
    let html = originalBuildInvoiceHTML(inv, isProforma);
    const linkedDel = (window.submissions||[]).find(s => s.invoice_linked === inv.id);
    
    if (linkedDel && inv.type === 'invoice') {
      const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? window.location.origin 
        : 'https://printex.vercel.app';
      const fullUrl = `${baseUrl}/delivery/${linkedDel.id}?token=${linkedDel.qr_token}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fullUrl)}`;
      
      const qrPlaceholder = `
      <div style="margin-top:30px; text-align:center; padding-top:20px; border-top:1px dashed #ccc; page-break-inside:avoid;">
        <div style="font-size:12px; font-weight:bold; color:#000; margin-bottom:5px;">LIVE RIDER TRACKING</div>
        <div style="display:inline-block; padding:10px; border:2px solid #000; border-radius:8px;">
          <img src="${qrImageUrl}" alt="Tracking QR Code" style="width:120px; height:120px; display:block;" />
        </div>
        <div style="font-size:10px; color:#666; margin-top:5px;">Scan with mobile camera</div>
      </div>`;
      
      const lastDivIndex = html.lastIndexOf('</div>');
      if (lastDivIndex !== -1) {
        html = html.substring(0, lastDivIndex) + qrPlaceholder + '\n  </div>';
      }
    }
    return html;
  };
}
