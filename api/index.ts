// ═══════════════════════════════════════════════════════════════════
// Vercel Serverless Entry Point — Bridges Express app to Vercel
// ═══════════════════════════════════════════════════════════════════

import express from "express";
import path from "path";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "printex-secret-key-123";

// Initialize Postgres Pool (required in production — no SQLite on Vercel)
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}) : null;

async function query(text: string, params: any[] = []) {
  if (!pool) {
    console.error("No DATABASE_URL set. Returning empty result.");
    return { rows: [] };
  }
  return pool.query(text, params);
}

// Initialize Firebase Admin lazily
let adminApp: admin.app.App | null = null;
function getAdminApp() {
  if (adminApp) return adminApp;
  const apps = admin.apps;
  if (apps.length > 0) { adminApp = apps[0]!; return adminApp; }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    adminApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
  return adminApp;
}

function fDb() {
  getAdminApp();
  return getFirestore();
}
function fAuth() {
  return getAdminApp().auth();
}

// ─── Express App ──────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS for Vercel
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ─── Auth Middleware ───────────────────────────────────────────────
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = await fAuth().verifyIdToken(token);
    (req as any).user = { id: decoded.uid, email: decoded.email, fullName: decoded.name || "", role: "user" };
    next();
  } catch {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
};

// ─── Health Check ─────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: pool ? "postgres" : "none", env: process.env.NODE_ENV || "production" });
});

// ─── Auth API ─────────────────────────────────────────────────────
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) return res.status(400).json({ error: "Missing required fields" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = "usr_" + Math.random().toString(36).substring(2, 15);
    await query("INSERT INTO users (id, fullName, email, password) VALUES ($1, $2, $3, $4)", [id, fullName, email.toLowerCase(), hashedPassword]);
    const token = jwt.sign({ id, email, fullName }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { id, email, fullName, role: "user" } });
  } catch (error: any) {
    if (error.code === "23505") return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
  try {
    const result = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Invalid email or password" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: "Invalid email or password" });
    const token = jwt.sign({ id: user.id, email: user.email, fullName: user.fullName }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/verify", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ valid: false });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const result = await query("SELECT id, fullName, email, role FROM users WHERE id = $1", [decoded.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ valid: false });
    res.json({ valid: true, user });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// ─── M-Pesa STK Push ──────────────────────────────────────────────
app.post("/api/mpesa/stk-push", async (req, res) => {
  const { phoneNumber, amount, invoiceId } = req.body;
  if (!phoneNumber || !amount || !invoiceId) return res.status(400).json({ error: "Missing required parameters" });

  // Sanitize phone number to 254XXXXXXXXX format
  let phone = String(phoneNumber).replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.substring(1);
  if (phone.startsWith("+")) phone = phone.substring(1);

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    // Mock fallback for testing
    const checkoutId = "MOCK-CK-" + Date.now();
    console.log(`[M-Pesa MOCK] STK Push: phone=${phone}, amount=${amount}, invoiceId=${invoiceId}, checkoutId=${checkoutId}`);
    
    // Initialize transaction in Firestore for client status polling
    try {
      await fDb().collection("mpesa_transactions").doc(checkoutId).set({
        status: "pending",
        invoiceId: String(invoiceId),
        amount: Math.ceil(Number(amount)),
        phoneNumber: phone,
        createdAt: Date.now()
      });
    } catch(e) {
      console.error("Failed to initialize mock transaction in Firestore:", e);
    }

    setTimeout(async () => {
      const receipt = "MOCK" + Math.random().toString(36).substring(2, 10).toUpperCase();
      try {
        await query("UPDATE invoices SET payment_status='paid', payment_ref=$1, paid_at=$2 WHERE id=$3 OR invoice_number=$3",
          [receipt, new Date().toISOString(), String(invoiceId)]);
        await fDb().collection("public_deliveries").doc(String(invoiceId)).set({ paymentStatus: "paid", paymentRef: receipt, paidAt: Date.now() }, { merge: true });
        await fDb().collection("mpesa_transactions").doc(checkoutId).set({
          status: "success",
          mpesaRef: receipt,
          amountPaid: Math.ceil(Number(amount)),
          phoneUsed: phone,
          updatedAt: Date.now()
        }, { merge: true });
      } catch(e) { console.error("Mock callback update failed:", e); }
    }, 5000);

    return res.json({ 
      MerchantRequestID: "MOCK-" + Date.now(), 
      CheckoutRequestID: checkoutId, 
      ResponseCode: "0", 
      ResponseDescription: "Mock STK Push Success", 
      CustomerMessage: "Check your phone." 
    });
  }

  try {
    // Get access token
    const authString = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const baseUrl = process.env.MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${authString}` }
    });
    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Failed to get M-Pesa access token: " + JSON.stringify(tokenData));
    const accessToken = tokenData.access_token;

    const shortcode = process.env.MPESA_SHORTCODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    // Timestamp: YYYYMMDDHHmmss
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const callbackUrl = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL}/api/mpesa/callback`
      : `https://printex.vercel.app/api/mpesa/callback`;

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: process.env.MPESA_TYPE === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: String(invoiceId).substring(0, 12),
      TransactionDesc: "Printex Invoice Payment"
    };

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(stkBody)
    });
    const stkData = await stkRes.json();

    // Save transaction state to Firestore for client status polling
    if (stkData.ResponseCode === "0" && stkData.CheckoutRequestID) {
      try {
        await fDb().collection("mpesa_transactions").doc(stkData.CheckoutRequestID).set({
          status: "pending",
          invoiceId: String(invoiceId),
          amount: Math.ceil(Number(amount)),
          phoneNumber: phone,
          createdAt: Date.now()
        });
      } catch(e) {
        console.error("Failed to initialize transaction in Firestore:", e);
      }
    }

    res.json(stkData);
  } catch (e: any) {
    console.error("M-Pesa STK Push error:", e);
    res.status(500).json({ error: "M-Pesa request failed: " + e.message });
  }
});

// ─── M-Pesa Callback ──────────────────────────────────────────────
app.post("/api/mpesa/callback", async (req, res) => {
  // Immediately acknowledge Safaricom
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) return;

    const resultCode = callbackData.ResultCode;
    const merchantRequestId = callbackData.MerchantRequestID;
    const checkoutRequestId = callbackData.CheckoutRequestID;

    console.log(`[M-Pesa Callback] ResultCode: ${resultCode}, CheckoutReqID: ${checkoutRequestId}`);

    if (resultCode !== 0) {
      console.log(`[M-Pesa Callback] Payment failed/cancelled. Code: ${resultCode}, Desc: ${callbackData.ResultDesc}`);
      if (checkoutRequestId) {
        await fDb().collection("mpesa_transactions").doc(String(checkoutRequestId)).set({
          status: "failed",
          message: callbackData.ResultDesc || `Payment failed (code ${resultCode})`,
          updatedAt: Date.now()
        }, { merge: true });
      }
      return;
    }

    const meta: any[] = callbackData.CallbackMetadata?.Item || [];
    const get = (name: string) => meta.find((m: any) => m.Name === name)?.Value;

    const receipt      = get("MpesaReceiptNumber");
    const amountPaid   = get("Amount");
    const phoneUsed    = get("PhoneNumber");
    const invoiceId    = get("AccountReference"); // We set AccountReference = invoiceId during STK push

    console.log(`[M-Pesa Callback] SUCCESS — Receipt: ${receipt}, Amount: ${amountPaid}, Phone: ${phoneUsed}, Ref: ${invoiceId}`);

    if (!invoiceId) {
      console.error("[M-Pesa Callback] No invoiceId in AccountReference");
      return;
    }

    // 1. Update Postgres/SQLite invoice
    await query(
      "UPDATE invoices SET payment_status='paid', payment_ref=$1, paid_at=$2 WHERE id=$3 OR invoice_number=$3",
      [receipt, new Date().toISOString(), String(invoiceId)]
    );

    // 2. Update Firebase public_deliveries for real-time sync
    await fDb().collection("public_deliveries").doc(String(invoiceId)).set({
      paymentStatus: "paid",
      paymentRef: receipt,
      amountPaid: amountPaid,
      phoneUsed: String(phoneUsed),
      paidAt: Date.now()
    }, { merge: true });

    // 3. Update Firestore transaction log for client status polling
    if (checkoutRequestId) {
      await fDb().collection("mpesa_transactions").doc(String(checkoutRequestId)).set({
        status: "success",
        mpesaRef: receipt,
        amountPaid: amountPaid,
        phoneUsed: String(phoneUsed),
        updatedAt: Date.now()
      }, { merge: true });
    }

    console.log(`[M-Pesa Callback] Firebase + DB updated for invoice ${invoiceId}`);
  } catch (e: any) {
    console.error("[M-Pesa Callback] Processing error:", e);
  }
});

// ─── M-Pesa Status Query ──────────────────────────────────────────
app.get("/api/mpesa/status/:checkoutId", async (req, res) => {
  const { checkoutId } = req.params;
  try {
    const doc = await fDb().collection("mpesa_transactions").doc(String(checkoutId)).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(doc.data());
  } catch (e: any) {
    console.error("Status fetch error:", e);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

// ─── Delivery Update (Public Rider Access via Token) ───────────────
app.post("/api/delivery/update", async (req, res) => {
  const { deliveryId, status, token } = req.body;
  if (!deliveryId || !status || !token) return res.status(400).json({ error: "Missing required fields" });

  const validStatuses = ["pending", "dispatched", "arrived", "delivered"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status value" });

  // Verify the secure token embedded in QR code
  if (token !== `sec_${deliveryId}`) return res.status(403).json({ error: "Invalid delivery token" });

  try {
    // Update Firebase public_deliveries for instant real-time sync across all devices
    await fDb().collection("public_deliveries").doc(String(deliveryId)).set({
      deliveryStatus: status,
      updatedAt: Date.now()
    }, { merge: true });

    res.json({ success: true, deliveryId, status });
  } catch (e: any) {
    console.error("Delivery update error:", e);
    res.status(500).json({ error: "Failed to update delivery status: " + e.message });
  }
});

// ─── Delivery Info (Public Read) ───────────────────────────────────
app.get("/api/delivery/:deliveryId", async (req, res) => {
  const { deliveryId } = req.params;
  try {
    const doc = await fDb().collection("public_deliveries").doc(String(deliveryId)).get();
    if (!doc.exists) return res.status(404).json({ error: "Delivery not found" });
    res.json({ success: true, data: doc.data() });
  } catch (e: any) {
    console.error("Delivery fetch error:", e);
    res.status(500).json({ error: "Failed to fetch delivery data" });
  }
});

// ─── Inventory API ────────────────────────────────────────────────
app.get("/api/inventory", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    let items: any[] = [];
    const result = await query("SELECT * FROM inventory WHERE user_id = $1", [userId]);
    items = [...items, ...result.rows];
    try {
      const snapshot = await fDb().collection('inventory').where('user_id', '==', userId).get();
      items = [...items, ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
    } catch (fbErr) {
      // Silently skip if Firebase fails
    }
    res.json(items);
  } catch (e) {
    console.error("Inventory fetch error:", e);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// ─── Sync Push API ────────────────────────────────────────────────
app.post("/api/sync/push", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { parts, invoices, settings, activity, submissions } = req.body;
    const now = Date.now();

    // 1. Sync Parts (inventory)
    if (parts && Array.isArray(parts)) {
      for (const p of parts) {
        const price = parseFloat(p.priceKsh || p.price) || 0;
        await query(
          `INSERT INTO inventory (id, user_id, category, part_num, description, stock, min_stock, price, supplier, location, image, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT(id) DO UPDATE SET category=$3, part_num=$4, description=$5, stock=$6, min_stock=$7, price=$8, supplier=$9, location=$10, image=$11, updated_at=$12`,
          [String(p.id), userId, p.category, p.partNum, p.desc, p.stock, p.minStock, price, p.supplier || '', p.location || '', p.image || null, now]
        );
      }
    }

    // 2. Sync Invoices
    if (invoices && Array.isArray(invoices)) {
      for (const inv of invoices) {
        const itemsStr = typeof inv.items === 'string' ? inv.items : JSON.stringify(inv.items || []);
        await query(
          `INSERT INTO invoices (id, user_id, invoice_number, date, customer, notes, type, items, subtotal, discount_pct, discount_amt, vat, grand, payment_status, payment_ref, paid_at, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
           ON CONFLICT(id) DO UPDATE SET invoice_number=$3, date=$4, customer=$5, notes=$6, type=$7, items=$8, subtotal=$9, discount_pct=$10, discount_amt=$11, vat=$12, grand=$13, payment_status=$15, payment_ref=$16, paid_at=$17, created_at=$18, updated_at=$19`,
          [String(inv.id), userId, inv.invoiceNumber, inv.date, inv.customer, inv.notes || '', inv.type, itemsStr, inv.subtotal, inv.discountPct, inv.discountAmt, inv.vat, inv.grand, inv.paymentStatus || '', inv.paymentRef || '', inv.paidAt || '', inv.createdAt, now]
        );
        // Sync new invoices to public_deliveries
        if (inv.type === 'invoice') {
          await fDb().collection('public_deliveries').doc(String(inv.id)).set({
            invoiceNumber: inv.invoiceNumber,
            customer: inv.customer,
            grand: inv.grand,
            paymentStatus: inv.paymentStatus || 'pending',
            deliveryStatus: inv.deliveryStatus || 'pending',
            createdAt: inv.createdAt || Date.now()
          }, { merge: true });
        }
      }
    }

    // 3. Sync Settings
    if (settings && Array.isArray(settings)) {
      for (const s of settings) {
        const valStr = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        await query(
          `INSERT INTO settings (user_id, key, value, updated_at) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT(user_id, key) DO UPDATE SET value=$3, updated_at=$4`,
          [userId, s.key, valStr, now]
        );
      }
    }

    // 4. Sync Activity
    if (activity && Array.isArray(activity)) {
      for (const act of activity) {
        await query(
          `INSERT INTO activity (id, user_id, text, type, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT(id) DO UPDATE SET text=$3, type=$4, created_at=$5, updated_at=$6`,
          [String(act.id), userId, act.text, act.type || '', act.created_at || act.createdAt || '', now]
        );
      }
    }

    // 5. Sync Freelance Submissions
    if (submissions && Array.isArray(submissions)) {
      const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
      const isAdmin = userCheck.rows[0]?.role === 'admin';
      for (const sub of submissions) {
        if (isAdmin) {
          await query(
            `INSERT INTO submissions (id, user_id, task_details, project_description, invoice_number, totals, notes, delivery_info, links, attachments, status, risk_level, risk_summary, reviewer_id, reviewer_name, reviewer_notes, reviewed_at, history, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
             ON CONFLICT(id) DO UPDATE SET user_id=$2, task_details=$3, project_description=$4, invoice_number=$5, totals=$6, notes=$7, delivery_info=$8, links=$9, attachments=$10, status=$11, risk_level=$12, risk_summary=$13, reviewer_id=$14, reviewer_name=$15, reviewer_notes=$16, reviewed_at=$17, history=$18, updated_at=$20`,
            [String(sub.id), sub.user_id || userId, sub.task_details || '', sub.project_description || '', sub.invoice_number || '', parseFloat(sub.totals) || 0, sub.notes || '', sub.delivery_info || '', sub.links || '', typeof sub.attachments === 'string' ? sub.attachments : JSON.stringify(sub.attachments || []), sub.status || 'Pending', sub.risk_level || 'Low Risk', sub.risk_summary || '', sub.reviewer_id || '', sub.reviewer_name || '', sub.reviewer_notes || '', sub.reviewed_at || '', typeof sub.history === 'string' ? sub.history : JSON.stringify(sub.history || []), sub.created_at || '', now]
          );
        } else {
          const existing = await query("SELECT status, user_id, risk_level FROM submissions WHERE id = $1", [String(sub.id)]);
          if (existing.rows.length > 0) {
            const ext = existing.rows[0];
            if (ext.user_id === userId) {
              await query(
                `UPDATE submissions SET task_details=$1, project_description=$2, invoice_number=$3, totals=$4, notes=$5, delivery_info=$6, links=$7, attachments=$8, updated_at=$9 WHERE id=$10`,
                [sub.task_details || '', sub.project_description || '', sub.invoice_number || '', parseFloat(sub.totals) || 0, sub.notes || '', sub.delivery_info || '', sub.links || '', typeof sub.attachments === 'string' ? sub.attachments : JSON.stringify(sub.attachments || []), now, String(sub.id)]
              );
            }
          } else {
            await query(
              `INSERT INTO submissions (id, user_id, task_details, project_description, invoice_number, totals, notes, delivery_info, links, attachments, status, risk_level, risk_summary, history, created_at, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending', 'Low Risk', '', '[]', $11, $12)`,
              [String(sub.id), userId, sub.task_details || '', sub.project_description || '', sub.invoice_number || '', parseFloat(sub.totals) || 0, sub.notes || '', sub.delivery_info || '', sub.links || '', typeof sub.attachments === 'string' ? sub.attachments : JSON.stringify(sub.attachments || []), sub.created_at || '', now]
            );
          }
        }
      }
    }

    res.json({ success: true, timestamp: now });
  } catch (e: any) {
    console.error("Sync push error:", e);
    res.status(500).json({ error: "Sync failed: " + e.message });
  }
});

// ─── Sync Pull API ────────────────────────────────────────────────
app.post("/api/sync/pull", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const lastSyncTimestamp = parseInt(req.body.lastSyncTimestamp) || 0;

  try {
    const partsResult = await query(
      "SELECT * FROM inventory WHERE user_id = $1 AND updated_at > $2",
      [userId, lastSyncTimestamp]
    );

    const invoicesResult = await query(
      "SELECT * FROM invoices WHERE user_id = $1 AND updated_at > $2",
      [userId, lastSyncTimestamp]
    );

    const settingsResult = await query(
      "SELECT * FROM settings WHERE user_id = $1 AND updated_at > $2",
      [userId, lastSyncTimestamp]
    );

    const activityResult = await query(
      "SELECT * FROM activity WHERE user_id = $1 AND updated_at > $2",
      [userId, lastSyncTimestamp]
    );

    const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
    const isAdmin = userCheck.rows[0]?.role === 'admin';
    const submissionsResult = isAdmin
      ? await query("SELECT * FROM submissions WHERE updated_at > $1", [lastSyncTimestamp])
      : await query("SELECT * FROM submissions WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);

    res.json({
      parts: partsResult.rows.map(r => ({
        id: r.id,
        category: r.category,
        partNum: r.part_num,
        desc: r.description,
        stock: r.stock,
        minStock: r.min_stock,
        priceKsh: r.price,
        supplier: r.supplier,
        location: r.location,
        image: r.image
      })),
      invoices: invoicesResult.rows,
      settings: settingsResult.rows,
      activity: activityResult.rows,
      submissions: submissionsResult.rows
    });
  } catch (e: any) {
    console.error("Pull sync error:", e);
    res.status(500).json({ error: "Failed to pull changes from cloud database" });
  }
});

// ─── Sync Delete API ──────────────────────────────────────────────
app.post("/api/sync/delete", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { store, id } = req.body;
  if (!store || !id) return res.status(400).json({ error: "Missing store or id" });
  
  try {
    const table = store === 'parts' ? 'inventory' : store;
    if (!['inventory', 'invoices', 'settings', 'activity', 'submissions'].includes(table)) {
      return res.status(400).json({ error: "Invalid store" });
    }
    
    if (table === 'settings') {
      await query("DELETE FROM settings WHERE user_id = $1 AND key = $2", [userId, id]);
    } else if (table === 'submissions') {
      const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
      const isAdmin = userCheck.rows[0]?.role === 'admin';
      if (isAdmin) {
        await query("DELETE FROM submissions WHERE id = $1", [id]);
      } else {
        await query("DELETE FROM submissions WHERE user_id = $1 AND id = $2", [userId, id]);
      }
    } else {
      await query(`DELETE FROM ${table} WHERE user_id = $1 AND id = $2`, [userId, id]);
    }
    res.json({ success: true });
  } catch (e: any) {
    console.error("Delete sync error:", e);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ─── Export for Vercel ────────────────────────────────────────────
export default app;
