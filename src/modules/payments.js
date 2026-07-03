// ═══════════════════════════════════════════════════════════════════
// PAYMENTS MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

window.mpesaCurrentInvoiceId = null;
window.mpesaPollTimer = null;
window.MPESA_TILL = '4977712';
window.MPESA_DEFAULT_SERVER = localStorage.getItem('printex_mpesa_server') || (window.PRINTEX_CONFIG && window.PRINTEX_CONFIG.apiBase) || 'http://localhost:3000';

window.getMpesaServerUrl = function() {
  const el = document.getElementById('mpesaServerUrl');
  const url = (el ? el.value.trim() : '') || window.MPESA_DEFAULT_SERVER;
  localStorage.setItem('printex_mpesa_server', url);
  return url.replace(/\/$/, '');
};

window.openMpesaModal = function(invoiceId) {
  const inv = window.invoices.find(i => i.id === invoiceId);
  if (!inv) return window.showToast('Invoice not found', 'error');
  window.mpesaCurrentInvoiceId = invoiceId;

  document.getElementById('mpesaInvNum').textContent = inv.invoiceNumber;
  document.getElementById('mpesaCustomer').textContent = inv.customer;
  document.getElementById('mpesaAmount').textContent = window.formatPrice(inv.grand);

  document.getElementById('mpesaPhone').value = '';
  document.getElementById('mpesaServerUrl').value = window.MPESA_DEFAULT_SERVER;
  
  const urlField = document.getElementById('mpesaUrlField');
  if (urlField) urlField.style.display = 'block';
  document.getElementById('mpesaStatusBox').style.display = 'none';
  document.getElementById('mpesaStatusBox').innerHTML = '';
  document.getElementById('mpesaPhoneField').style.display = 'block';
  document.getElementById('mpesaFooter').style.display = 'flex';
  document.getElementById('mpesaSendBtn').disabled = false;

  window.renderMpesaHistory(invoiceId);
  window.openModal('mpesaModal');
};

window.closeMpesaModal = function() {
  if (window.mpesaPollTimer) { clearInterval(window.mpesaPollTimer); window.mpesaPollTimer = null; }
  window.closeModal('mpesaModal');
};

window.renderMpesaHistory = function(invoiceId) {
  const allPayments = JSON.parse(localStorage.getItem('printex_payments') || '[]');
  const invPayments = allPayments.filter(p => p.invoiceId === invoiceId);
  const wrap = document.getElementById('mpesaPayHistoryWrap');
  const body = document.getElementById('mpesaPayHistory');
  if (!wrap || !body) return;
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

window.validateMpesaPhone = function(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('7')) return '254' + digits;
  if (digits.length === 10 && digits.startsWith('07')) return '254' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('254')) return digits;
  return null;
};

window.initiateMpesaPush = async function() {
  const inv = window.invoices.find(i => i.id === window.mpesaCurrentInvoiceId);
  if (!inv) return;

  const rawPhone = document.getElementById('mpesaPhone').value.trim();
  const phone = window.validateMpesaPhone(rawPhone);
  if (!phone) {
    return window.showMpesaStatus('error', '❌ Invalid phone number. Enter 9 digits e.g. 712345678');
  }

  const amount = Math.round(inv.grand);
  const serverUrl = window.getMpesaServerUrl();
  const accountRef = inv.invoiceNumber;

  const btn = document.getElementById('mpesaSendBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="mpesa-logo">Sending…</span>';
  }

  document.getElementById('mpesaPhoneField').style.display = 'none';
  document.getElementById('mpesaUrlField').style.display = 'none';
  document.getElementById('mpesaFooter').style.display = 'none';

  window.showMpesaStatus('waiting', `
    <div class="mpesa-spinner"></div>
    <div style="font-weight:600;color:var(--warn);font-size:14px">Sending STK Push…</div>
    <div style="font-size:12px;color:var(--muted);margin-top:6px">A payment prompt has been sent to <b style="color:var(--text)">+${phone}</b></div>
    <div style="font-size:11px;color:var(--dim);margin-top:4px">Ask customer to enter their M-Pesa PIN on their phone</div>
  `);

  try {
    const apiBase = window.getMpesaServerUrl();
    const res = await fetch(`${apiBase}/api/mpesa/stk-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, amount, invoiceId: accountRef, tillNumber: window.MPESA_TILL }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Server error ${res.status}`);
    }

    const data = await res.json();
    const checkoutId = data.CheckoutRequestID || data.checkoutRequestId;

    if (!checkoutId) throw new Error('No CheckoutRequestID from server');

    const payRecord = {
      invoiceId: window.mpesaCurrentInvoiceId, invoiceNumber: accountRef,
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
    window.mpesaPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(window.mpesaPollTimer);
        window.showMpesaStatus('failed', `
          <div style="font-size:24px">⏰</div>
          <div style="font-weight:600;color:var(--danger);font-size:14px;margin-top:8px">Payment Timed Out</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">No confirmation received after 2 minutes.</div>
          <button class="btn btn-mpesa" style="margin-top:12px" onclick="retryMpesaPayment()">Try Again</button>
        `);
        return;
      }

      try {
        const apiBase = window.getMpesaServerUrl();
        const statusRes = await fetch(`${apiBase}/api/mpesa/status/${checkoutId}`);
        if (!statusRes.ok) return;
        const statusData = await statusRes.json();

        if (statusData.status === 'success') {
          clearInterval(window.mpesaPollTimer);
          await window.markInvoicePaid(window.mpesaCurrentInvoiceId, statusData.mpesaRef || checkoutId);
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
          clearInterval(window.mpesaPollTimer);
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
      <div style="font-size:11px;color:var(--dim);margin-top:8px">Is your server running? Check the URL in the form.</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn btn-outline" onclick="retryMpesaPayment()">Try Again</button>
        <button class="btn btn-success" onclick="markMpesaPaidManually()" title="Mark as paid without confirmation">Mark Paid Manually</button>
      </div>
    `);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="mpesa-logo">Send <span>M</span>-PESA Request</span>';
    }
    document.getElementById('mpesaPhoneField').style.display = 'block';
    document.getElementById('mpesaUrlField').style.display = 'block';
    document.getElementById('mpesaFooter').style.display = 'flex';
  }
};

window.showMpesaStatus = function(type, html) {
  const box = document.getElementById('mpesaStatusBox');
  if (!box) return;
  box.style.display = 'block';
  box.className = `mpesa-status-box ${type}`;
  box.innerHTML = html;
};

window.retryMpesaPayment = function() {
  if (window.mpesaPollTimer) { clearInterval(window.mpesaPollTimer); window.mpesaPollTimer = null; }
  const inv = window.invoices.find(i => i.id === window.mpesaCurrentInvoiceId);
  if (inv) window.openMpesaModal(window.mpesaCurrentInvoiceId);
};

window.markInvoicePaid = async function(invoiceId, mpesaRef) {
  const inv = window.invoices.find(i => i.id === invoiceId || String(i.id) === String(invoiceId));
  if (!inv) return;

  if (inv.customerId && inv.paymentStatus !== 'paid') {
    const cust = await window.dbGet('customers', inv.customerId);
    if (cust) {
      cust.balance = Math.max(0, (cust.balance || 0) - inv.grand);
      await window.dbPut('customers', cust);
      if (window.biz && typeof window.biz.init === 'function') await window.biz.init();
    }
  }

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
  await window.markInvoicePaid(window.mpesaCurrentInvoiceId, ref);
  window.showMpesaStatus('success', `
    <div style="font-size:36px">✅</div>
    <div style="font-weight:700;color:var(--mpesa);font-size:16px;margin-top:8px">Marked as Paid</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px">Invoice manually marked as paid (${ref})</div>
    <button class="btn btn-success" style="margin-top:12px;width:100%;justify-content:center" onclick="closeMpesaModal()">Done</button>
  `);
};

window.updatePaymentRecord = function(updated) {
  const all = JSON.parse(localStorage.getItem('printex_payments') || '[]');
  const idx = all.findIndex(p => p.checkoutId === updated.checkoutId);
  if (idx >= 0) all[idx] = updated;
  localStorage.setItem('printex_payments', JSON.stringify(all));
  window.renderMpesaHistory(window.mpesaCurrentInvoiceId);
};

window.PAYMENT_INFO = {
  mpesa:   { icon:'📱', title:'M-Pesa STK Push',         color:'var(--mpesa)',
             fields:[{label:'Till Number (Buy Goods)', value:'4977712', copy:true},{label:'Business Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
             action:{label:'Send STK Push to Customer', fn:'promptMpesaQuick()'}, note:'Customer receives a prompt on their phone to enter their M-Pesa PIN.' },
  paybill: { icon:'🏦', title:'Lipa na M-Pesa Paybill',  color:'var(--accent)',
             fields:[{label:'Paybill Number', value:'880100', copy:true},{label:'Account Number', value:'051501', copy:true},{label:'Account Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
             note:'Customer: M-Pesa → Lipa na M-Pesa → Pay Bill → enter Paybill then Account.' },
  bank:    { icon:'🏛️', title:'Bank Transfer (NCBA)',     color:'var(--gold)',
             fields:[{label:'Bank', value:'NCBA BANK KENYA PLC', copy:false},{label:'Branch', value:'LUNGA LUNGA', copy:false},{label:'Account Number', value:'3026970037', copy:true},{label:'SWIFT Code', value:'CBAFKENX', copy:true},{label:'Account Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
             note:'Allow 1–3 business days for clearance.' },
  till:    { icon:'📲', title:'Buy Goods (Till Number)', color:'var(--success)',
             fields:[{label:'Till Number', value:'4977712', copy:true},{label:'Business Name', value:'PRINTEX ENGINEERS LTD', copy:false}],
             note:'Customer: M-Pesa → Lipa na M-Pesa → Buy Goods → enter Till Number.' },
};

window._currentPayTool = null;
window.openPayToolModal = function(type) {
  const info = window.PAYMENT_INFO[type];
  if (!info) return;
  window._currentPayTool = type;
  const titleEl = document.getElementById('payToolModalTitle');
  if (titleEl) titleEl.textContent = info.title;
  const shareBtn = document.getElementById('payToolShareBtn');
  if (shareBtn) shareBtn.style.display = 'flex';
  const bodyEl = document.getElementById('payToolModalBody');
  if (bodyEl) {
    bodyEl.innerHTML = `
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
  }
  window.openModal('payToolModal');
  if (typeof window.logAIAction === 'function') window.logAIAction(`💳 Opened ${info.title} details`);
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
  const info = window.PAYMENT_INFO[window._currentPayTool];
  if (!info) return;
  const text = `PRINTEX ENGINEERS LIMITED\n${info.title}\n\n${info.fields.map(f => `${f.label}: ${f.value}`).join('\n')}\n\n${info.note}`;
  if (navigator.share) navigator.share({ title:'Printex Payment Details', text }).catch(()=>{});
  else navigator.clipboard.writeText(text).then(() => window.showToast('All details copied ✓', 'success'));
};

window.promptMpesaQuick = function() {
  window.closeModal('payToolModal');
  const unpaid = window.invoices.filter(i => i.type === 'invoice' && !i.paymentStatus);
  if (unpaid.length) window.openMpesaModal(unpaid[unpaid.length-1].id);
  else {
    window.showToast('No unpaid invoices. Create one first.', 'warn');
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 4) window.showPage('createInvoice', navItems[4]);
  }
};

window.handleAIPaymentIntent = function(msg) {
  const l = (msg||'').toLowerCase();
  if (l.includes('mpesa') || l.includes('m-pesa') || l.includes('stk')) { window.openPayToolModal('mpesa'); return true; }
  if (l.includes('paybill')) { window.openPayToolModal('paybill'); return true; }
  if (l.includes('bank') || l.includes('ncba') || l.includes('transfer')) { window.openPayToolModal('bank'); return true; }
  if (l.includes('till')) { window.openPayToolModal('till'); return true; }
  return false;
};
