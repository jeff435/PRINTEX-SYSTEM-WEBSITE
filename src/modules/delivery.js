// ═══════════════════════════════════════════════════════════════════
// DELIVERY ROUTE MODULE - Printex Business Platform
// Production-ready: uses relative /api/ URLs, handles Firebase gracefully
// ═══════════════════════════════════════════════════════════════════

window.initDeliveryView = async function(deliveryId) {
  const container = document.getElementById('deliveryContent');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Use centralized config — never localhost in production
  const API_BASE = (window.PRINTEX_CONFIG && window.PRINTEX_CONFIG.apiBase) || '';

  const statuses = [
    { id: 'pending',    label: 'Preparing',  icon: 'fa-box',           color: '#4a9eff' },
    { id: 'dispatched', label: 'In Route',   icon: 'fa-truck',         color: '#f59e0b' },
    { id: 'arrived',    label: 'Arrived',    icon: 'fa-map-marker-alt',color: '#a855f7' },
    { id: 'delivered',  label: 'Delivered',  icon: 'fa-check-circle',  color: '#22c55e' }
  ];

  let currentData = null;
  let unsubscribe = null;

  // ── Show loading spinner ──────────────────────────────────────────
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;text-align:center;padding:40px 20px;">
      <div style="width:48px;height:48px;border:3px solid rgba(74,158,255,0.2);border-top-color:#4a9eff;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <div style="color:#4a9eff;font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500;">Loading Delivery…</div>
      <div style="color:#666;font-size:13px;">Ref: ${String(deliveryId)}</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>`;

  // ── Render the full delivery UI ───────────────────────────────────
  const renderDeliveryUI = (data) => {
    if (!data) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:#ef4444;font-family:'DM Sans',sans-serif;">
        <i class="fa fa-exclamation-triangle" style="font-size:40px;margin-bottom:16px;"></i>
        <h2>Delivery Not Found</h2>
        <p style="color:#888;margin-top:8px;">No delivery record found for this QR code.</p>
      </div>`;
      return;
    }

    const currentStatusIdx = statuses.findIndex(s => s.id === (data.deliveryStatus || 'pending'));

    const timelineHtml = statuses.map((s, i) => {
      const isPast    = i <= currentStatusIdx;
      const isCurrent = i === currentStatusIdx;
      const dotColor  = isCurrent ? s.color : (isPast ? '#22c55e' : '#1a3350');
      const lineColor = i < currentStatusIdx ? '#22c55e' : '#1a3350';

      return `
        <div style="display:flex;align-items:flex-start;margin-bottom:8px;position:relative;"
             ${token ? `onclick="window._updateStatus('${s.id}')" style="cursor:pointer;display:flex;align-items:flex-start;margin-bottom:8px;position:relative;"` : ''}>
          <div style="display:flex;flex-direction:column;align-items:center;margin-right:16px;">
            <div style="width:40px;height:40px;border-radius:50%;background:${dotColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.3s;">
              <i class="fa ${s.icon}" style="color:#fff;font-size:16px;"></i>
            </div>
            ${i < statuses.length - 1 ? `<div style="width:2px;height:32px;background:${lineColor};margin-top:4px;transition:background 0.3s;"></div>` : ''}
          </div>
          <div style="padding-top:8px;flex:1;">
            <div style="font-family:'DM Sans',sans-serif;font-size:15px;font-weight:${isCurrent?'700':'500'};color:${isPast?'#e2e8f0':'#475569'};">${s.label}</div>
            ${isCurrent ? `<div style="font-size:11px;color:${s.color};margin-top:2px;font-weight:600;">● Current Status</div>` : ''}
          </div>
          ${token && !isCurrent && !isPast ? `<div style="font-size:11px;color:#4a9eff;padding-top:10px;padding-right:4px;">Tap to set</div>` : ''}
        </div>`;
    }).join('');

    const isPaid = data.paymentStatus === 'paid';
    const invoiceNum = data.invoiceNumber || String(deliveryId);
    const customer   = data.customer || 'Unknown Customer';
    const grand      = Number(data.grand || 0).toLocaleString('en-KE', {minimumFractionDigits:2});

    container.innerHTML = `
      <div style="font-family:'DM Sans',sans-serif;max-width:480px;margin:0 auto;">

        <!-- Header Brand -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1a3350;">
          <div style="background:linear-gradient(135deg,#003366,#004e99);padding:8px 14px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:0.05em;color:#fff;">PRINTEX</div>
          <div style="color:#64748b;font-size:13px;">Delivery Tracking</div>
        </div>

        <!-- Invoice Card -->
        <div style="background:#112236;border:1px solid #24527a;border-radius:12px;padding:20px;margin-bottom:16px;border-top:3px solid #4a9eff;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Invoice Reference</div>
          <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#e2e8f0;margin-bottom:16px;">${invoiceNum}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Customer</div>
              <div style="font-size:14px;font-weight:600;color:#cbd5e1;">${customer}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Amount</div>
              <div style="font-size:18px;font-weight:700;color:#fbbf24;">KSH ${grand}</div>
            </div>
          </div>
        </div>

        <!-- Status Timeline -->
        <div style="background:#112236;border:1px solid #24527a;border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:20px;">Delivery Progress</div>
          ${timelineHtml}
          ${token ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #1a3350;font-size:11px;color:#4a9eff;text-align:center;">🚴 Rider Mode — tap a step to update status</div>` : ''}
        </div>

        <!-- Payment Status -->
        <div style="background:#112236;border:1px solid #24527a;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Payment Status</div>
          ${isPaid
            ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(34,197,94,0.15);color:#22c55e;padding:10px 24px;border-radius:999px;font-weight:700;font-size:14px;border:1px solid rgba(34,197,94,0.3);">
                 <i class="fa fa-check-circle"></i> PAID VIA M-PESA
               </div>
               ${data.paymentRef ? `<div style="margin-top:8px;font-size:11px;color:#64748b;">Receipt: ${data.paymentRef}</div>` : ''}`
            : `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(251,191,36,0.1);color:#fbbf24;padding:10px 24px;border-radius:999px;font-weight:700;font-size:14px;border:1px solid rgba(251,191,36,0.3);margin-bottom:16px;">
                 <i class="fa fa-clock"></i> PAYMENT PENDING
               </div>
               ${!token ? `
               <div style="margin-top:12px;">
                 <button onclick="window._triggerMpesa()" style="width:100%;background:linear-gradient(135deg,#00a651,#007a3d);color:#fff;border:none;border-radius:10px;padding:14px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;font-family:'DM Sans',sans-serif;">
                   <span style="background:#fff;color:#00a651;border-radius:4px;padding:2px 6px;font-weight:900;font-size:13px;">M</span>
                   Pay via M-PESA — KSH ${grand}
                 </button>
               </div>` : ''}
              `
          }
        </div>

        <div style="text-align:center;font-size:11px;color:#334155;padding:8px;">
          Powered by Printex Engineers Limited
        </div>
      </div>`;
  };

  // ── Firebase listener with retry ─────────────────────────────────
  let retries = 0;
  const startListener = () => {
    if (window.fDb) {
      try {
        unsubscribe = window.fDb
          .collection('public_deliveries')
          .doc(String(deliveryId))
          .onSnapshot(
            (doc) => {
              if (doc.exists) {
                currentData = doc.data();
                renderDeliveryUI(currentData);
              } else {
                // Try REST fallback
                fetchFromAPI();
              }
            },
            (err) => {
              console.warn('Firestore listener error, falling back to REST:', err);
              fetchFromAPI();
            }
          );
        return true;
      } catch(e) {
        console.warn('Firebase not ready, retrying…', e);
      }
    }
    if (retries < 30) { retries++; setTimeout(startListener, 300); }
    else fetchFromAPI();
    return false;
  };

  // ── REST API fallback (when Firebase client is unavailable) ───────
  const fetchFromAPI = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/delivery/${encodeURIComponent(deliveryId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) { currentData = json.data; renderDeliveryUI(currentData); return; }
      }
      renderDeliveryUI(null);
    } catch(e) {
      console.error('REST fetch failed:', e);
      renderDeliveryUI(null);
    }
  };

  startListener();

  // ── Rider Status Update ───────────────────────────────────────────
  window._updateStatus = async (status) => {
    if (!token) return;
    const label = statuses.find(s => s.id === status)?.label || status;
    if (!confirm(`Update delivery status to "${label}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/delivery/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, status, token })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Update failed');
      // Firebase listener will auto-refresh the UI
    } catch(e) {
      alert('Failed to update status: ' + e.message);
    }
  };

  // ── Customer M-Pesa trigger ───────────────────────────────────────
  window._triggerMpesa = () => {
    let phone = prompt('Enter your Safaricom number (e.g. 0712 345 678):');
    if (!phone) return;
    phone = phone.trim().replace(/\s/g, '');
    if (!phone) return;

    const amount = currentData?.grand || 0;
    fetch(`${API_BASE}/api/mpesa/stk-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, amount, invoiceId: deliveryId })
    })
    .then(r => r.json())
    .then(d => {
      if (d.ResponseCode === '0' || d.ResponseCode === 0) {
        alert('✅ M-Pesa prompt sent! Check your phone and enter your PIN.');
      } else {
        alert('M-Pesa error: ' + (d.errorMessage || d.ResponseDescription || JSON.stringify(d)));
      }
    })
    .catch(e => alert('Network error: ' + e.message));
  };

  // Cleanup on navigation
  window.addEventListener('beforeunload', () => { if (unsubscribe) unsubscribe(); });
};
