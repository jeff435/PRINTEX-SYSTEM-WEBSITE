// ═══════════════════════════════════════════════════════════════════
// AI INTELLIGENCE MODULE - Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

window.aiHistory = [];
window.aiFileData = null;
window.aiActionLogArr = [];
window.aiAlertTimer = null;
window._aiKeyMemory = '';
window._geminiKeyMemory = '';
window.aiActiveModel = 'mock'; // 'gemini' | 'claude' | 'mock'

// ── GEMINI KEY MANAGEMENT ────────────────────────────────────────────
window.getGeminiKey = function() {
  return window._geminiKeyMemory || localStorage.getItem('printex_gemini_key') || '';
};
window.saveGeminiKeyDirect = function(key) {
  window._geminiKeyMemory = key;
  localStorage.setItem('printex_gemini_key', key);
};
window.clearGeminiKey = function() {
  window._geminiKeyMemory = '';
  localStorage.removeItem('printex_gemini_key');
  const el = document.getElementById('geminiKeyInput');
  if (el) el.value = '';
  window.updateAIStatus(false);
  window.showToast('Gemini key cleared', 'warn');
};
window.saveAndVerifyGeminiKey = async function() {
  const el = document.getElementById('geminiKeyInput');
  const key = el ? el.value.trim() : '';
  if (!key) return window.showToast('Enter a Gemini API key first', 'warn');
  const btn = document.getElementById('saveGeminiKeyBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }
  try {
    const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 5 } })
    });
    if (!testRes.ok && testRes.status !== 429) {
      const d = await testRes.json();
      throw new Error(d.error?.message || `HTTP ${testRes.status}`);
    }
    window.saveGeminiKeyDirect(key);
    window.aiActiveModel = 'gemini';
    window.updateAIStatus(true);
    window.showToast('✅ Gemini key verified & saved!', 'success');
  } catch(e) {
    window.showToast('❌ Gemini key error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save & Verify'; }
  }
};

window.getAIKey = function() {
  return window._aiKeyMemory || localStorage.getItem('printex_ai_key') || '';
};

window.onAIKeyInput = function(val) {
  const msg = document.getElementById('keyValidationMsg');
  if (!msg) return;
  if (!val) { msg.style.display = 'none'; return; }
  msg.style.display = 'flex';
  if (val.startsWith('sk-ant-') && val.length > 20) {
    msg.innerHTML = `<i class="fa fa-check-circle" style="color:var(--success)"></i><span style="color:var(--success)">Format looks valid</span>`;
  } else {
    msg.innerHTML = `<i class="fa fa-times-circle" style="color:var(--warn)"></i><span style="color:var(--warn)">Key should start with sk-ant-</span>`;
  }
};

window.toggleKeyVisibility = function() {
  const inp = document.getElementById('aiKeyInput');
  const icon = document.getElementById('keyEyeIcon');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (icon) icon.className = 'fa fa-eye-slash';
  } else {
    inp.type = 'password';
    if (icon) icon.className = 'fa fa-eye';
  }
};

window.saveAIKey = async function() {
  const inp = document.getElementById('aiKeyInput');
  const key = inp ? inp.value.trim() : '';

  if (!key) return window.setKeyStatus('invalid', '❌ Please enter an API key');
  if (!key.startsWith('sk-ant-')) return window.setKeyStatus('invalid', '❌ Key must start with sk-ant-');
  if (key.length < 40) return window.setKeyStatus('invalid', '❌ Key looks too short — check it again');

  const btn = document.getElementById('saveKeyBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:5px"></span> Verifying...'; }
  window.setKeyStatus('testing', '⏳ Testing connection with Anthropic...');

  try {
    const testRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    const data = await testRes.json();

    if (!testRes.ok) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${testRes.status}`;
      if (testRes.status === 401) throw new Error('Invalid API key — authentication failed');
      if (testRes.status === 429) throw new Error('Rate limited — but key is valid! Saving anyway.');
      throw new Error(errMsg);
    }

    window._aiKeyMemory = key;
    localStorage.setItem('printex_ai_key', key);
    const settEl = document.getElementById('settingsApiKey');
    if (settEl) settEl.value = key;

    window.setKeyStatus('valid', '✅ Key verified & saved — AI is ready!');
    window.updateAIStatus(true);
    window.showToast('Claude API key saved and verified ✓', 'success');
    window.renderAIContext();

  } catch(e) {
    if (e.message.includes('Rate limited') || e.message.includes('rate')) {
      window._aiKeyMemory = key;
      localStorage.setItem('printex_ai_key', key);
      window.setKeyStatus('valid', '✅ Key saved (rate limited but valid)');
      window.updateAIStatus(true);
      window.showToast('API key saved — rate limited but will work', 'warn');
    } else {
      window.setKeyStatus('invalid', `❌ ${e.message}`);
      window.updateAIStatus(false);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save & Verify'; }
  }
};

window.setKeyStatus = function(type, msg) {
  const row = document.getElementById('keyStatusRow');
  if (!row) return;
  row.style.display = 'block';
  row.className = '';
  row.style.cssText = `display:block;padding:8px 10px;border-radius:var(--r);font-size:11px;margin-bottom:8px;border:1px solid`;
  if (type === 'valid') { row.style.background = 'var(--success-dim)'; row.style.borderColor = 'var(--success)'; row.style.color = 'var(--success)'; }
  else if (type === 'invalid') { row.style.background = 'var(--danger-dim)'; row.style.borderColor = 'var(--danger)'; row.style.color = 'var(--danger)'; }
  else { row.style.background = 'var(--warn-dim)'; row.style.borderColor = 'var(--warn)'; row.style.color = 'var(--warn)'; }
  row.textContent = msg;
};

window.clearAIKey = function() {
  window._aiKeyMemory = '';
  localStorage.removeItem('printex_ai_key');
  const inp = document.getElementById('aiKeyInput');
  if (inp) inp.value = '';
  const settEl = document.getElementById('settingsApiKey');
  if (settEl) settEl.value = '';
  const valMsg = document.getElementById('keyValidationMsg');
  if (valMsg) valMsg.style.display = 'none';
  const statRow = document.getElementById('keyStatusRow');
  if (statRow) statRow.style.display = 'none';
  window.updateAIStatus(false);
  window.showToast('API key cleared', 'warn');
};

window.saveAIKeyFromSettings = function() {
  const key = (document.getElementById('settingsApiKey')?.value || '').trim();
  if (!key) return;
  const inp = document.getElementById('aiKeyInput');
  if (inp) inp.value = key;
  window.saveAIKey();
};

window.testAIKey = async function() {
  const key = window.getAIKey();
  if (!key) return window.showToast('No API key set. Enter it in the AI Assistant panel.', 'warn');
  window.setKeyStatus('testing', '⏳ Testing...');
  try {
    const r = await window.callClaude([{role:'user',content:'Reply: OK'}], 'Reply only OK', 10);
    if (r) { window.setKeyStatus('valid', '✅ Connection confirmed!'); window.updateAIStatus(true); window.showToast('API key is working ✓', 'success'); }
    else { window.setKeyStatus('invalid', '⚠️ Unexpected response'); }
  } catch(e) {
    if (e.message.includes('rate') || e.message.includes('429')) {
      window.setKeyStatus('valid', '✅ Key valid (rate limited)'); window.updateAIStatus(true);
    } else {
      window.setKeyStatus('invalid', `❌ ${e.message}`); window.updateAIStatus(false);
    }
  }
};

window.updateAIStatus = function(online) {
  const dot = document.getElementById('aiDot');
  const txt = document.getElementById('aiStatus');
  if (!dot || !txt) return;
  const key = window.getAIKey();
  const color = (online || !key) ? 'var(--success)' : 'var(--dim)';
  const label = key ? (online ? 'Online' : 'Offline — verify API key') : 'Online (Simulated Claude AI Active)';
  dot.style.background = color;
  txt.innerHTML = `<span id="aiDot" style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;transition:background 0.3s"></span> ${label}`;
};

window.simulateClaudeMockResponse = async function(messages) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  const userMsg = messages[messages.length - 1]?.content || '';
  const text = (typeof userMsg === 'string') ? userMsg : (userMsg.find(c => c.type === 'text')?.text || '');
  const query = text.toLowerCase().trim();

  if (query.includes('show reports') || query.includes('view report') || query.includes('go to reports') || query.includes('report page')) {
    return `I have navigated to the **Reports & Business Analytics** view for you. Here you can see your real-time stock status breakdown, categorised asset counts, monthly invoicing trends, and low-stock parts reports.
    \`\`\`json-action
    {
      "action": "navigate_to",
      "data": { "page": "reports" }
    }
    \`\`\``;
  }
  if (query.includes('show invoice') || query.includes('go to invoices') || query.includes('view invoices') || query.includes('invoice list')) {
    return `I have opened your **Invoices & Quotations** dashboard. You can search parts, process payments, print PDF copies, or manage existing invoices from here.
    \`\`\`json-action
    {
      "action": "navigate_to",
      "data": { "page": "invoices" }
    }
    \`\`\``;
  }
  if (query.includes('new invoice') || query.includes('create invoice') || query.includes('create quotation') || query.includes('go to new invoice')) {
    return `Opening the **Invoice Creator** tool. You can search parts by keyword/SKU, insert quantities, apply customizable discount percentages, and save immediately as a PDF quotation or invoice.
    \`\`\`json-action
    {
      "action": "navigate_to",
      "data": { "page": "new-invoice" }
    }
    \`\`\``;
  }
  if (query.includes('go to inventory') || query.includes('show inventory') || query.includes('view parts') || query.includes('part list') || query.includes('inventory page')) {
    return `Navigating to your **Parts Inventory** control panel. Here you can view existing stock status, adjust item quantities on-the-fly, edit descriptions, or add new parts.
    \`\`\`json-action
    {
      "action": "navigate_to",
      "data": { "page": "inventory" }
    }
    \`\`\``;
  }
  if (query.includes('freelance') || query.includes('task submission') || query.includes('submit task') || query.includes('reviewer board')) {
    return `Opening the **Freelance Submissions** dashboard. Here you can submit new freelance task details, view review status in real-time, or manage reviewer feedback.
    \`\`\`json-action
    {
      "action": "navigate_to",
      "data": { "page": "freelance" }
    }
    \`\`\``;
  }
  if (query.includes('go to settings') || query.includes('show settings') || query.includes('view settings')) {
    return `Opening **System Settings**. Here you can change default VAT tax rates, switch currency display (Ksh / USD), edit company Tax PIN, configure custom keys, or adjust themes.
    \`\`\`json-action
    {
      "action": "navigate_to",
      "data": { "page": "settings" }
    }
    \`\`\``;
  }

  if (query.includes('add part') || query.includes('create part') || query.includes('new part')) {
    const skuMatch = text.match(/sku[-:\s]+([a-z0-9-]+)/i) || text.match(/part[-:\s]+([a-z0-9-]+)/i) || [null, 'SKU-' + Math.floor(100 + Math.random() * 900)];
    const descMatch = text.match(/desc(?:ription)?[-:\s]+([^,.]+)/i) || [null, 'New Mechanical Part'];
    const stockMatch = text.match(/stock[-:\s]+(\d+)/i) || text.match(/qty[-:\s]+(\d+)/i) || [null, '15'];
    const priceMatch = text.match(/price[-:\s]+(\d+)/i) || text.match(/ksh[-:\s]+(\d+)/i) || text.match(/cost[-:\s]+(\d+)/i) || [null, '3200'];
    
    const sku = skuMatch[1].toUpperCase().trim();
    const desc = descMatch[1].trim();
    const stock = parseInt(stockMatch[1]) || 15;
    const price = parseFloat(priceMatch[1]) || 3200;
    
    return `Absolutely! I have added the new part **${sku}** (${desc}) to the database with **${stock}** in initial stock and a unit price of **${window.formatPrice(price)}**.

    \`\`\`json-action
    {
      "action": "add_part",
      "data": {
        "partNum": "${sku}",
        "desc": "${desc}",
        "category": "G",
        "stock": ${stock},
        "minStock": 2,
        "priceKsh": ${price},
        "supplier": "Printex AI Supplier",
        "location": "Aisle AI-2"
      }
    }
    \`\`\``;
  }

  if (query.includes('update stock') || query.includes('change stock') || query.includes('adjust stock') || query.includes('set stock')) {
    const stockMatch = text.match(/(?:to|at|is)\s+(\d+)/i) || text.match(/stock\s+(\d+)/i) || text.match(/(\d+)\s+items/i);
    const num = stockMatch ? parseInt(stockMatch[1]) : 20;

    let matchedPart = null;
    for (const p of window.parts) {
      if (query.includes(p.partNum.toLowerCase()) || query.includes(String(p.id).toLowerCase())) {
        matchedPart = p;
        break;
      }
    }

    if (matchedPart) {
      return `Stock level successfully updated! I have adjusted the quantity of **${matchedPart.partNum}** to **${num}** in the database.

      \`\`\`json-action
      {
        "action": "update_stock",
        "data": {
          "partNum": "${matchedPart.partNum}",
          "stock": ${num}
        }
      }
      \`\`\``;
    } else {
      const partNum = window.parts.length ? window.parts[0].partNum : 'SKU-001';
      return `I identified your request to update stock to **${num}**, but I couldn't match any existing SKU or ID in your message. 

Please verify your SKU code. Here is a simulated stock adjustment for **${partNum}**:
      \`\`\`json-action
      {
        "action": "update_stock",
        "data": {
          "partNum": "${partNum}",
          "stock": ${num}
        }
      }
      \`\`\``;
    }
  }

  if (query.includes('how many') || query.includes('total parts') || query.includes('inventory status') || query.includes('count') || query.includes('statistics')) {
    const totalParts = window.parts.length;
    const totalStock = window.parts.reduce((s, p) => s + p.stock, 0);
    const lowStock = window.parts.filter(p => p.stock > 0 && p.stock <= (p.minStock || 1)).length;
    const outOfStock = window.parts.filter(p => p.stock === 0).length;
    const totalValue = window.parts.reduce((s, p) => s + (p.stock * (p.priceKsh || 0)), 0);

    return `Here is your dynamic **Printex Engineers** live inventory status:
*   **Total Cataloged SKUs:** ${totalParts}
*   **Total Items in Stock:** ${totalStock} units
*   **Low Stock Alerts:** ${lowStock} items currently low
*   **Out of Stock Alerts:** ${outOfStock} items empty
*   **Current Inventory Valuation:** **${window.formatPrice(totalValue)}**

Let me know if you would like me to navigate to the **Reports** page to view dynamic charts or help you adjust stock levels!`;
  }

  if (query.includes('revenue') || query.includes('sales') || query.includes('total invoiced') || query.includes('average invoice')) {
    const invInvoices = window.invoices.filter(i => i.type === 'invoice');
    const totalRevenue = invInvoices.reduce((s, i) => s + i.grand, 0);
    const avgInvoice = invInvoices.length ? (totalRevenue / invInvoices.length) : 0;
    
    return `📊 **Printex Invoicing & Sales Analytics Summary:**
*   **Total Created Documents:** ${window.invoices.length} (Invoices & Quotations)
*   **Total Invoices:** ${invInvoices.length}
*   **Gross Dynamic Revenue:** **${window.formatPrice(totalRevenue)}**
*   **Average Billing Amount:** **${window.formatPrice(avgInvoice)}**

You can view complete breakdowns or trigger customer M-Pesa push payments inside the **Invoices** view!`;
  }

  if (query.includes('mpesa') || query.includes('payment') || query.includes('paybill') || query.includes('bank') || query.includes('stk')) {
    return `💳 **Official Bank & Checkout Payment Channels:**
*   **M-Pesa Business Paybill:** \`880100\`
*   **M-Pesa Billing Account No:** \`051501\`
*   **M-Pesa Buy Goods Till:** \`4977712\`
*   **NCBA Bank Kenya:** Account No \`3026970037\` (Lunga Lunga Branch, SWIFT: CBAFKENX)

To initiate an dynamic STK Push payment, go to the **Invoices** view, click the **M-Pesa Checkout** icon, input the customer phone number, and trigger push notifications.
    \`\`\`json-action
    {
      "action": "open_payment_tool",
      "data": { "tool": "mpesa" }
    }
    \`\`\``;
  }

  return `🤖 Greetings! I am your **Printex Claude AI Assistant**. 

I am currently running in **Simulated Offline Mode** (no Claude API key required). I have live access to your local database and can help you manage inventory, query sales statistics, update stocks, or navigate screens instantly in your browser!

**Try typing some of these contextual instructions:**
*   *"What is our current inventory status?"* (fetches live SQLite metrics)
*   *"Add part SKU-VALVE-002, description SM52 Air Valve, stock 20, price 4500"* (triggers real database injection)
*   *"Set stock level of ${window.parts[0]?.partNum || 'SKU-001'} to 60"* (adjusts real stock)
*   *"Go to Invoices page"* or *"Open Reports"* (triggers live page switches)
*   *"What is our total billing revenue?"* (compiles real invoice records)

To unlock the full advanced cognitive skills of Claude 3.5, you can save your Anthropic Claude API Key in the **Settings** panel.`;
};

window.callClaude = async function(messages, system = '', maxTokens = 1500) {
  const key = window.getAIKey();
  if (!key) {
    return await window.simulateClaudeMockResponse(messages);
  }

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });
  } catch(networkErr) {
    throw new Error('Network error — check your internet connection. (' + networkErr.message + ')');
  }

  let data;
  try { data = await res.json(); } catch { throw new Error(`Server returned invalid response (HTTP ${res.status})`); }

  if (!res.ok) {
    const msg = data?.error?.message || data?.error?.type || '';
    if (res.status === 401) {
      window.updateAIStatus(false);
      throw new Error('Invalid API key. Go to console.anthropic.com, copy your key, and paste it in the API Key field.');
    }
    if (res.status === 429) throw new Error('Rate limit reached — please wait 30 seconds and try again.');
    if (res.status === 400) throw new Error('Bad request: ' + msg);
    if (res.status === 529 || res.status === 503) throw new Error('Anthropic servers are overloaded — try again in a moment.');
    throw new Error(msg || `API error (HTTP ${res.status})`);
  }

  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude — please try again.');
  return text;
};

// ── GEMINI API CALL ───────────────────────────────────────────────────
window.callGemini = async function(messages, system = '', maxTokens = 1500) {
  const key = window.getGeminiKey();
  if (!key) throw new Error('No Gemini API key');

  // Convert message format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.find(c => c.type === 'text')?.text || '' : '') }]
  }));

  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.error?.message || `Gemini error ${res.status}`;
    if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(msg);
    if (res.status === 429) throw new Error('Gemini rate limited');
    throw new Error(msg);
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  window.aiActiveModel = 'gemini';
  return text;
};

// ── MASTER AI ORCHESTRATOR (Gemini → Claude → SmartMock) ─────────────
window.callAI = async function(messages, system = '', maxTokens = 1500) {
  // 1. Try Gemini
  if (window.getGeminiKey()) {
    try {
      const r = await window.callGemini(messages, system, maxTokens);
      window.aiActiveModel = 'gemini';
      return r;
    } catch(e) {
      if (!e.message.includes('rate')) console.warn('[AI] Gemini failed, trying Claude:', e.message);
    }
  }
  // 2. Try Claude
  if (window.getAIKey()) {
    try {
      window.aiActiveModel = 'claude';
      return await window.callClaude(messages, system, maxTokens);
    } catch(e) {
      if (!e.message.includes('rate')) console.warn('[AI] Claude failed, using smart mock:', e.message);
    }
  }
  // 3. Smart mock fallback
  window.aiActiveModel = 'mock';
  return await window.simulateClaudeMockResponse(messages);
};

// ── LIVE BUSINESS INSIGHTS ENGINE ─────────────────────────────────────
window.generateBusinessInsights = function() {
  const parts = window.parts || [];
  const invoices = window.invoices || [];
  const insights = [];

  // Critical: out of stock
  const oos = parts.filter(p => p.stock === 0 && p.minStock > 0);
  if (oos.length > 0) {
    insights.push({ type:'critical', icon:'fa-exclamation-circle', color:'var(--danger)',
      title:`${oos.length} Part${oos.length>1?'s':''} Out of Stock`,
      body: oos.slice(0,3).map(p=>`<b>${p.partNum}</b>`).join(', ') + (oos.length>3?` + ${oos.length-3} more`:''),
      action:'View Inventory', page:'inventory' });
  }

  // Warning: low stock
  const low = parts.filter(p => p.stock > 0 && p.stock <= p.minStock);
  if (low.length > 0) {
    insights.push({ type:'warn', icon:'fa-exclamation-triangle', color:'var(--gold)',
      title:`${low.length} Low-Stock Alert${low.length>1?'s':''}`,
      body: low.slice(0,3).map(p=>`${p.partNum} (${p.stock} left)`).join(', '),
      action:'View Inventory', page:'inventory' });
  }

  // Revenue analysis
  const finalized = invoices.filter(i => i.type === 'invoice');
  if (finalized.length > 0) {
    const totalRev = finalized.reduce((s,i)=>s+(i.grand||0),0);
    const now = Date.now();
    const recent30 = finalized.filter(i => (i.timestamp||0) > now - 30*864e5);
    const rev30 = recent30.reduce((s,i)=>s+(i.grand||0),0);
    insights.push({ type:'info', icon:'fa-chart-line', color:'var(--accent)',
      title:'Revenue Summary',
      body:`All-time: <b>KES ${Math.round(totalRev).toLocaleString()}</b> across ${finalized.length} invoices. Last 30 days: <b>KES ${Math.round(rev30).toLocaleString()}</b>`,
      action:'View Invoices', page:'invoices' });
  }

  // Top customer
  const spend = {};
  invoices.filter(i=>i.type==='invoice').forEach(inv => {
    if (inv.customer) spend[inv.customer] = (spend[inv.customer]||0) + (inv.grand||0);
  });
  const topCust = Object.entries(spend).sort((a,b)=>b[1]-a[1]).slice(0,1);
  if (topCust.length > 0) {
    insights.push({ type:'success', icon:'fa-star', color:'var(--success)',
      title:'Top Customer',
      body:`<b>${topCust[0][0]}</b> — KES ${Math.round(topCust[0][1]).toLocaleString()} total spend`,
      action:'View Analytics', page:'analytics' });
  }

  // Stock value
  const totalVal = parts.reduce((s,p)=>s+(p.stock*(p.priceKsh||0)),0);
  const catNames = {A:'Valves',B:'Bellows',C:'Gears',D:'Cam Followers',E:'Tapes',F:'Rollers',G:'Accessories'};
  const topCat = Object.entries({A:0,B:0,C:0,D:0,E:0,F:0,G:0}).map(([c])=>{
    const v = parts.filter(p=>p.category===c).reduce((s,p)=>s+p.stock*(p.priceKsh||0),0);
    return {cat:c, val:v, name:catNames[c]||c};
  }).sort((a,b)=>b.val-a.val)[0];
  if (totalVal > 0) {
    insights.push({ type:'info', icon:'fa-boxes-stacked', color:'var(--accent)',
      title:'Inventory Valuation',
      body:`Total stock value: <b>KES ${Math.round(totalVal).toLocaleString()}</b>. Highest category: <b>${topCat?.name||'—'}</b>`,
      action:'View Reports', page:'reports' });
  }

  return insights;
};

// ── AI INSIGHTS DASHBOARD RENDERER ────────────────────────────────────
window.renderAIInsightsDashboard = function() {
  const el = document.getElementById('aiInsightsDashboard');
  if (!el) return;
  const insights = window.generateBusinessInsights();
  if (insights.length === 0) {
    el.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:10px 0">No active alerts — system looks healthy ✅</div>`;
    return;
  }
  el.innerHTML = insights.map(ins => `
    <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--bg3);border-radius:var(--r);border-left:3px solid ${ins.color};margin-bottom:8px;cursor:pointer" onclick="window.showPage('${ins.page}', Array.from(document.querySelectorAll('.nav-item')).find(el=>el.getAttribute('onclick')?.includes('\'${ins.page}\'')))"
         title="Click to navigate">
      <i class="fa ${ins.icon}" style="color:${ins.color};font-size:16px;margin-top:2px;flex-shrink:0"></i>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:3px">${ins.title}</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.4">${ins.body}</div>
      </div>
      <span style="font-size:9px;color:${ins.color};font-weight:600;flex-shrink:0">${ins.action} →</span>
    </div>
  `).join('');
};

window.buildSystemPrompt = function() {
  const totalParts = window.parts.length;
  const inStock = window.parts.filter(p => p.stock > 0).length;
  const lowStock = window.parts.filter(p => p.stock > 0 && p.stock <= p.minStock);
  const outOfStock = window.parts.filter(p => p.stock === 0);
  const totalValue = window.parts.reduce((s, p) => s + (p.stock * (p.priceKsh || 0)), 0);

  const cats = ['A','B','C','D','E','F','G','J','K','L'];
  const catNames = {A:'Valves & Pneumatic Parts',B:'Bellows & Autoplate Parts',C:'Bearings & Gears',D:'Cam Followers',E:'Grippers & Separators',F:'Heidelberg Parts',G:'Sensors & Electronics',J:'Motors & Belts',K:'Cylinders',L:'Consumables'};
  const catBreakdown = cats.map(c => {
    const ps = window.parts.filter(p => p.category === c);
    const val = ps.reduce((s,p) => s + p.stock*(p.priceKsh||0), 0);
    return `  Cat ${c} (${catNames[c]}): ${ps.length} parts, stock value KSH ${val.toLocaleString()}`;
  }).join('\n');

  const invLines = window.parts.map(p =>
    `[${p.category}] ${p.partNum} | ${p.desc.slice(0,60)} | Stock:${p.stock}/${p.minStock}min | KSH ${p.priceKsh||0} | ${p.supplier||'?'} | ${p.location||'?'}`
  ).join('\n');

  const finalizedInv = window.invoices.filter(i => i.type === 'invoice');
  const invRevenue = finalizedInv.reduce((s,i) => s + i.grand, 0);
  const recentInv = finalizedInv.slice(-3).map(i => `  ${i.invoiceNumber} | ${i.customer} | KSH ${Math.round(i.grand).toLocaleString()} | ${i.date}`).join('\n');

  const proformaQuotes = window.invoices.filter(i => i.type === 'quotation');
  const quoteRevenue = proformaQuotes.reduce((s,i) => s + i.grand, 0);
  const recentQuote = proformaQuotes.slice(-3).map(i => `  ${i.invoiceNumber} | ${i.customer} | KSH ${Math.round(i.grand).toLocaleString()} | ${i.date}`).join('\n');

  return `You are PRINTEX AI, the dedicated intelligent business assistant for Printex Engineers Limited — a professional printing machinery parts supplier based in Nairobi, Kenya.

=== YOUR CAPABILITIES ===
1. INVENTORY MANAGEMENT: Add, edit, search, analyse parts. When user asks to add a part, output a JSON action block.
2. STOCK ALERTS: Proactively warn about low/out-of-stock items. Always check and mention critical alerts.
3. INVOICE ASSISTANCE: Help create, analyse, and explain invoices in KSH.
4. WEB RESEARCH: Summarise publicly known info about printing parts, suppliers, pricing (you know a lot about Heidelberg, Festo, SMC, KBA, Komori, Ryobi, Manroland parts).
5. DOCUMENT ANALYSIS: If a file is attached, read it and extract parts to add to inventory.
6. ANALYTICS: Give business insights on stock value, sales, trends.
7. GUIDANCE: Help stuck users step by step. Be patient, professional, and specific.

=== LIVE INVENTORY SNAPSHOT (${new Date().toLocaleDateString('en-KE')}) ===
Total Parts: ${totalParts} | In Stock: ${inStock} | Low Stock: ${lowStock.length} | Out of Stock: ${outOfStock.length}
Total Stock Value: KSH ${Math.round(totalValue).toLocaleString()}

CATEGORY BREAKDOWN:
${catBreakdown}

${lowStock.length > 0 ? `⚠️ LOW STOCK ALERT (${lowStock.length} items):\n${lowStock.slice(0,10).map(p=>`  ${p.partNum}: ${p.stock} remaining (min ${p.minStock})`).join('\n')}` : '✅ No low stock issues.'}

${outOfStock.length > 0 ? `🚫 OUT OF STOCK (${outOfStock.length} items):\n${outOfStock.slice(0,10).map(p=>`  ${p.partNum}: ${p.desc.slice(0,50)}`).join('\n')}` : '✅ No out-of-stock items.'}

=== FULL INVENTORY ===
${invLines}

=== FINALIZED INVOICES HISTORY ===
Total Finalized Invoices: ${finalizedInv.length} | Confirmed Revenue: KSH ${Math.round(invRevenue).toLocaleString()}
Recent Finalized Invoices:
${recentInv || '  No finalized invoices yet.'}

=== PROFORMA QUOTATIONS HISTORY ===
Total Quotations: ${proformaQuotes.length} | Potential Pipeline Value: KSH ${Math.round(quoteRevenue).toLocaleString()}
Recent Quotations:
${recentQuote || '  No quotations yet.'}

=== SMART AI CALENDAR & FOLLOW-UP EVENTS ===
Keep calendar events strictly distinct and tagged correctly by type so they never overlap:
- [Invoice Reminders]: Tagged for finalized sales awaiting payment.
- [Quotation Follow-ups]: Tagged for proforma quotes awaiting client conversion confirmation.
- [Delivery Schedules]: Tagged for logistics and dispatch dates.

=== PAYMENT TOOLS ===
These payment methods are available. When user asks about payment, describe them and offer to open the relevant tool:
- M-Pesa STK Push: Till 4977712 (Buy Goods). Use action "open_payment_tool" with data.tool="mpesa"
- Paybill: 880100, Account 051501
- Bank: NCBA Bank Kenya PLC (Lunga Lunga), Account 3026970037, SWIFT CBAFKENX
- Till Number: 4977712

=== ACTION FORMAT ===
When you need to take an action (add part, update stock, navigate), include a JSON block in your response using this exact format:

\`\`\`json-action
{
  "action": "add_part",
  "data": {
    "partNum": "SKU-001",
    "desc": "Part description",
    "category": "A",
    "stock": 10,
    "minStock": 3,
    "priceKsh": 5000,
    "supplier": "Supplier Name",
    "location": "Warehouse A1"
  }
}
\`\`\`

Available actions: add_part, update_stock, navigate_to, show_alert, bulk_add_parts (data.parts = array)

=== RULES ===
- Always use KSH for currency (never USD unless asked)
- Be concise but thorough. Use bullet points and tables for clarity.
- Always proactively mention critical stock alerts.
- When adding parts, confirm what you added and how many.
- For research questions, share your knowledge about printing industry parts, pricing trends, suppliers.
- If unsure about real-time web data, say so and share what you know.
- Format responses with markdown (bold, lists, tables) — they render in the UI.`;
};

window.initAIPage = function() {
  const key = window.getAIKey();
  const ki = document.getElementById('aiKeyInput');
  if (ki) ki.value = key;
  const si = document.getElementById('settingsApiKey');
  if (si) si.value = key;
  const gk = window.getGeminiKey();
  const gi = document.getElementById('geminiKeyInput');
  if (gi) gi.value = gk;
  window.updateAIStatus(!!(key || gk));
  window.renderAIContext();
  window.renderAIInsightsDashboard();

  const msgs = document.getElementById('aiMessages');
  if (msgs && msgs.children.length === 0) {
    window.showWelcomeMessage();
  }

  window.startAlertMonitor();
};

window.showWelcomeMessage = function() {
  const lowCount = window.parts.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const outCount = window.parts.filter(p => p.stock === 0).length;
  const alertText = (lowCount + outCount) > 0
    ? `\n\n⚠️ **Quick Alert:** You have **${lowCount} low stock** and **${outCount} out-of-stock** items that may need attention.`
    : '\n\n✅ **Stock Health:** All inventory levels are looking good!';

  window.appendAIMessage('bot', `👋 **Hello! I'm your Printex AI Assistant.**

I have real-time access to your **${window.parts.length} parts**, **${window.invoices.length} invoices**, and all your business data.${alertText}

**Here's what I can do for you:**
- 🔍 Search and analyse your inventory instantly
- ⚠️ Alert you about low/out-of-stock items
- ➕ Add parts to inventory just by describing them
- 📄 Read uploaded documents (CSV, JSON, PDF info) and extract parts
- 🧾 Help you create professional invoices
- 📊 Give you business insights and sales analytics
- 🌐 Research printing parts, suppliers and market prices

**Try asking me:** *"What parts are running low?"* or *"Add a new solenoid valve for SM52"*

How can I help you today?`);
};

window.renderAIContext = function() {
  const el = document.getElementById('aiContextStats');
  if (!el) return;
  const low = window.parts.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  const out = window.parts.filter(p => p.stock === 0).length;
  const modelBadge = { gemini: '🔵 Gemini', claude: '🟣 Claude', mock: '🤖 Smart Mock' }[window.aiActiveModel] || '🤖';
  el.innerHTML = [
    {num: window.parts.length, label: 'Total Parts', color: 'var(--accent)'},
    {num: window.invoices.length, label: 'Invoices', color: 'var(--gold)'},
    {num: `<span style="color:var(--warn)">${low}</span>`, label: 'Low Stock', color: 'var(--warn)'},
    {num: `<span style="color:var(--danger)">${out}</span>`, label: 'Out of Stock', color: 'var(--danger)'},
  ].map(i => `<div class="ai-ctx-item"><div class="ai-ctx-num">${i.num}</div><div class="ai-ctx-label">${i.label}</div></div>`).join('') +
  `<div style="grid-column:1/-1;font-size:10px;color:var(--muted);margin-top:4px">Active Model: <b>${modelBadge}</b></div>`;
  // Also refresh insights
  window.renderAIInsightsDashboard();
};

window.startAlertMonitor = function() {
  if (window.aiAlertTimer) clearInterval(window.aiAlertTimer);
  window.aiAlertTimer = setInterval(() => {
    const critical = window.parts.filter(p => p.stock === 0 && p.minStock > 0);
    if (critical.length > 0) {
      const badge = document.getElementById('aiBadge');
      if (badge) { badge.style.display = 'inline'; badge.textContent = critical.length; badge.style.background = 'var(--danger)'; }
    }
    const low = window.parts.filter(p => p.stock > 0 && p.stock <= p.minStock);
    if (low.length > 0) {
      const badge = document.getElementById('aiBadge');
      if (badge && badge.style.display === 'none') { badge.style.display = 'inline'; badge.textContent = low.length; badge.style.background = 'var(--warn)'; }
    }
    window.renderAIContext();
  }, 30000);
};

window.handleAIFile = function(input) {
  const file = input.files[0];
  if (!file) return;
  const bar = document.getElementById('aiFileBar');
  const nameEl = document.getElementById('aiFileName');
  if (nameEl) nameEl.textContent = `${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  if (bar) bar.style.display = 'flex';

  const reader = new FileReader();
  reader.onload = e => {
    const content = e.target.result;
    if (file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      window.aiFileData = { name: file.name, type: 'text', content: content.slice(0, 8000) };
    } else if (file.type.startsWith('image/')) {
      window.aiFileData = { name: file.name, type: 'image', content: content, mediaType: file.type };
    } else {
      window.aiFileData = { name: file.name, type: 'text', content: `[File: ${file.name} — ${file.size} bytes. Please analyse this document and extract any parts or inventory data.]` };
    }
    window.showToast(`File attached: ${file.name}`, 'success');

    if (typeof firebase !== 'undefined' && typeof fDb !== 'undefined') {
      const user = firebase.auth().currentUser;
      if (user) {
        const storageRef = firebase.storage().ref();
        const fileRef = storageRef.child(`users/${user.uid}/ai_attachments/${Date.now()}_${file.name}`);
        fileRef.put(file).then(snapshot => {
          return snapshot.ref.getDownloadURL();
        }).then(url => {
          console.log("[Firebase Storage] Scanned document uploaded successfully:", url);
          fDb.collection(`users/${user.uid}/uploads`).add({
            name: file.name,
            size: file.size,
            type: file.type,
            url: url,
            uploadedAt: Date.now()
          });
        }).catch(err => {
          console.warn("Storage upload failed for AI attachment:", err);
        });
      }
    }
  };
  if (file.type.startsWith('image/')) reader.readAsDataURL(file);
  else reader.readAsText(file);
};

window.removeAIFile = function() {
  window.aiFileData = null;
  const bar = document.getElementById('aiFileBar');
  if (bar) bar.style.display = 'none';
  const inp = document.getElementById('aiFileInput');
  if (inp) inp.value = '';
  const nameEl = document.getElementById('aiFileName');
  if (nameEl) nameEl.textContent = 'No file selected';
};

window.sendAI = async function() {
  const input = document.getElementById('aiInput');
  const msg = input ? input.value.trim() : '';
  if (!msg && !window.aiFileData) return;

  const userText = msg || `[Attached file: ${window.aiFileData?.name}]`;
  window.appendAIMessage('user', userText);
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }

  const userContent = [];
  if (window.aiFileData?.type === 'image') {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: window.aiFileData.mediaType, data: window.aiFileData.content.split(',')[1] } });
  } else if (window.aiFileData?.type === 'text') {
    userContent.push({ type: 'text', text: `[ATTACHED FILE: ${window.aiFileData.name}]\n\n${window.aiFileData.content}\n\n---\nUser message: ${msg}` });
  } else {
    userContent.push({ type: 'text', text: msg });
  }

  window.aiHistory.push({ role: 'user', content: userContent });
  if (window.aiFileData) { window.removeAIFile(); }

  if (!window.getAIKey() && window.handleAIPaymentIntent(msg)) {
    window.aiHistory.push({ role: 'assistant', content: 'I opened the payment details for you. Let me know if you need anything else!' });
    window.appendAIMessage('bot', '💳 I opened the payment tool for you! If you need to send an STK push, select the invoice first.\n\n**Tip:** Add your Claude API key to unlock the full AI assistant.');
    return;
  }

  const typingId = window.showTyping();

  try {
    const system = window.buildSystemPrompt();
    const replyText = await window.callAI(window.aiHistory, system, 2000);

    window.removeTyping(typingId);

    const { cleanText, actions } = window.parseAIActions(replyText);

    // Show which model replied
    const modelLabel = window.aiActiveModel === 'gemini' ? '🔵 Gemini' : window.aiActiveModel === 'claude' ? '🟣 Claude' : '🤖 Smart Mock';
    window.appendAIMessage('bot', cleanText, modelLabel);
    window.aiHistory.push({ role: 'assistant', content: replyText });

    for (const action of actions) {
      await window.executeAIAction(action);
    }

    window.updateAIStatus(true);
    window.renderAIContext();
    window.renderAIInsightsDashboard();

    if (window.aiHistory.length > 40) window.aiHistory = window.aiHistory.slice(-40);

  } catch(e) {
    window.removeTyping(typingId);
    window.appendAIMessage('error', `❌ **Error:** ${e.message}\n\nPlease check your API key in the AI Assistant panel or Settings.`);
    window.updateAIStatus(false);
  }
};

window.aiQuick = function(prompt) {
  const inp = document.getElementById('aiInput');
  if (inp) inp.value = prompt;
  window.sendAI();
};

window.parseAIActions = function(text) {
  const actions = [];
  const cleanText = text.replace(/```json-action\n([\s\S]*?)```/g, (_, json) => {
    try { actions.push(JSON.parse(json)); } catch(e) { console.warn('Bad action JSON:', e); }
    return '';
  }).trim();
  return { cleanText, actions };
};

window.executeAIAction = async function(action) {
  try {
    switch (action.action) {
      case 'add_part': {
        const d = action.data;
        if (!d.partNum || !d.desc) { window.showToast('AI tried to add part but missing partNum or desc', 'warn'); return; }
        const newPart = {
          partNum: d.partNum, desc: d.desc,
          category: d.category || 'G',
          stock: parseInt(d.stock) || 0,
          minStock: parseInt(d.minStock) || 1,
          priceKsh: parseFloat(d.priceKsh) || 0,
          supplier: d.supplier || '',
          location: d.location || '',
          image: null,
        };
        const id = await window.dbPut('parts', newPart);
        newPart.id = id;
        window.parts.push(newPart);
        window.renderInventory();
        await window.logActivity(`AI added part: ${newPart.partNum}`, 'part');
        window.logAIAction(`➕ Added part: ${newPart.partNum}`);
        window.showToast(`AI added part: ${newPart.partNum}`, 'success');
        window.appendActionButtons([{ label: '📦 View in Inventory', onclick: `showPage('inventory', document.querySelectorAll('.nav-item')[1])` }]);
        break;
      }
      case 'bulk_add_parts': {
        const partsArr = action.data.parts || [];
        let added = 0;
        for (const d of partsArr) {
          if (!d.partNum || !d.desc) continue;
          const newPart = {
            partNum: d.partNum, desc: d.desc,
            category: d.category || 'G',
            stock: parseInt(d.stock) || 0,
            minStock: parseInt(d.minStock) || 1,
            priceKsh: parseFloat(d.priceKsh) || 0,
            supplier: d.supplier || '',
            location: d.location || '',
            image: null,
          };
          const id = await window.dbPut('parts', newPart);
          newPart.id = id;
          window.parts.push(newPart);
          added++;
        }
        window.renderInventory();
        await window.logActivity(`AI bulk added ${added} parts`, 'part');
        window.logAIAction(`➕ Bulk added ${added} parts`);
        window.showToast(`AI added ${added} parts to inventory`, 'success');
        window.appendActionButtons([{ label: `📦 View ${added} New Parts`, onclick: `showPage('inventory', document.querySelectorAll('.nav-item')[1])` }]);
        break;
      }
      case 'update_stock': {
        const part = window.parts.find(p => p.partNum === action.data.partNum || String(p.id) === String(action.data.id));
        if (!part) { window.showToast(`Part not found for stock update: ${action.data.partNum}`, 'warn'); return; }
        const newStock = parseInt(action.data.stock);
        if (isNaN(newStock)) return;
        part.stock = Math.max(0, newStock);
        await window.dbPut('parts', part);
        await window.logActivity(`AI updated stock: ${part.partNum} → ${newStock}`, 'stock');
        window.logAIAction(`📦 Updated stock: ${part.partNum} → ${newStock}`);
        window.renderInventory();
        window.showToast(`Stock updated: ${part.partNum} → ${newStock}`, 'success');
        break;
      }
      case 'navigate_to': {
        const targetPage = action.data.page === 'new-invoice' ? 'createInvoice' : action.data.page;
        const navEl = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick')?.includes(`'${targetPage}'`));
        window.showPage(targetPage, navEl);
        break;
      }
      case 'show_alert': {
        window.showToast(action.data.message, action.data.type || 'warn');
        break;
      }
      case 'open_payment_tool': {
        const tool = action.data.tool || action.data.type;
        if (window.openPayToolModal) {
          window.openPayToolModal(tool);
          window.logAIAction(`💳 AI opened payment tool: ${tool}`);
        }
        break;
      }
    }
  } catch(e) {
    console.error('Action execution error:', e);
    window.showToast('AI action failed: ' + e.message, 'error');
  }
};

window.appendAIMessage = function(role, text) {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;

  const isUser = role === 'user';
  const isError = role === 'error';

  const div = document.createElement('div');
  div.className = `ai-msg ${isUser ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = `ai-avatar ${isUser ? 'user' : 'bot'}`;
  avatar.innerHTML = isUser
    ? (window.currentUser?.name?.[0]?.toUpperCase() || 'U')
    : '🤖';

  const bubble = document.createElement('div');
  bubble.className = `ai-bubble ${isUser ? 'user' : isError ? 'error' : 'bot'}`;
  bubble.innerHTML = window.formatAIText(text);

  div.appendChild(avatar);
  div.appendChild(bubble);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
};

window.appendActionButtons = function(buttons) {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding-left:40px;display:flex;gap:8px;flex-wrap:wrap;margin-top:-6px;animation:fadeIn 0.25s';
  wrap.innerHTML = buttons.map(b => `<button class="ai-action-btn" onclick="${b.onclick}">${b.label}</button>`).join('');
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
};

window.showTyping = function() {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return null;
  const id = 'typing_' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'ai-msg bot';
  div.innerHTML = `
    <div class="ai-avatar bot">🤖</div>
    <div class="ai-bubble bot" style="padding:0">
      <div class="ai-typing">
        <div class="ai-dot-anim"></div>
        <div class="ai-dot-anim"></div>
        <div class="ai-dot-anim"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
};

window.removeTyping = function(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
};

window.formatAIText = function(text) {
  if (!text) return '';
  let html = window.esc(text)
    .replace(/```[\w-]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^[•\-] (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/^⚠️ (.+)$/gm, '<div style="color:var(--warn)">⚠️ $1</div>')
    .replace(/^✅ (.+)$/gm, '<div style="color:var(--success)">✅ $1</div>')
    .replace(/^🚫 (.+)$/gm, '<div style="color:var(--danger)">🚫 $1</div>')
    .replace(/\n\n/g, '</p><p style="margin:6px 0">')
    .replace(/\n/g, '<br/>');

  html = html.replace(/(<li>.*?<\/li>)+/gs, m => `<ul>${m}</ul>`);
  return `<p style="margin:0">${html}</p>`;
};

window.logAIAction = function(text) {
  window.aiActionLogArr.unshift({ text, ts: Date.now() });
  if (window.aiActionLogArr.length > 10) window.aiActionLogArr.pop();
  const el = document.getElementById('aiActionLog');
  if (el) {
    el.innerHTML = window.aiActionLogArr.map(a =>
      `<div style="padding:3px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:4px">
        <span>${window.esc(a.text)}</span>
        <span style="color:var(--dim);font-size:10px;white-space:nowrap">${new Date(a.ts).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</span>
      </div>`
    ).join('') || 'No actions yet';
  }
};

window.clearAIChat = function() {
  if (!confirm('Clear the conversation? This cannot be undone.')) return;
  window.aiHistory = [];
  const msgs = document.getElementById('aiMessages');
  if (msgs) msgs.innerHTML = '';
  window.showWelcomeMessage();
  window.showToast('Conversation cleared', 'success');
};

window.exportAIChat = function() {
  const msgs = document.getElementById('aiMessages');
  if (!msgs || !msgs.children.length) return window.showToast('No conversation to export', 'warn');
  let text = `PRINTEX AI CONVERSATION EXPORT\n${new Date().toLocaleString('en-KE')}\n${'='.repeat(50)}\n\n`;
  window.aiHistory.forEach(m => {
    const role = m.role === 'user' ? 'YOU' : 'PRINTEX AI';
    const content = Array.isArray(m.content) ? m.content.find(c => c.type === 'text')?.text || '' : m.content;
    text += `[${role}]\n${content}\n\n`;
  });
  window.downloadFile(text, `printex-ai-chat-${Date.now()}.txt`, 'text/plain');
};

// ── INTERCEPT & PATCH showPage FOR AI INIT & NAVIGATION SYNC ─────────
const _showPageOrig = window.showPage;
window.showPage = function(id, navEl) {
  if (typeof _showPageOrig === 'function') {
    _showPageOrig(id, navEl);
  }
  
  if (id === 'ai') {
    const bar = document.getElementById('pageTitleBar');
    if (bar) bar.textContent = 'AI Assistant';
    window.initAIPage();
  }
  
  if (id === 'settings') {
    if (typeof window.loadFirebaseSettingsFields === 'function') {
      window.loadFirebaseSettingsFields();
    }
  }

  const bnavMap = {
    dashboard: 'dashboard',
    inventory: 'inventory',
    invoices: 'invoices',
    createInvoice: 'invoices',
    ai: 'ai',
    reports: 'settings',
    settings: 'settings'
  };
  
  if (typeof window.setBottomNav === 'function') {
    window.setBottomNav(bnavMap[id] || id);
  }
  
  if (typeof window.updateBottomNavBadge === 'function') {
    window.updateBottomNavBadge();
  }
};

window.setBottomNav = function(id) {
  const items = document.querySelectorAll('.bnav-item');
  items.forEach(item => {
    if (item.id === `bnav-${id}`) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
};
