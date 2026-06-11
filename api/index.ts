// ═══════════════════════════════════════════════════════════════════
// Vercel Serverless Entry Point — Printex Business Platform
// ═══════════════════════════════════════════════════════════════════

import express from "express";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const JWT_SECRET = process.env.JWT_SECRET || "printex-secret-key-123";
const FIREBASE_DB_ID = "ai-studio-17572275-a7ee-4258-9b42-e6c17c3694d8";

// ─── Firebase Admin Initialization ────────────────────────────────
let adminInitError: string | null = null;

function initFirebaseAdmin(): admin.app.App | null {
  // Return existing app if already initialized
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountEnv) {
    adminInitError =
      "FIREBASE_SERVICE_ACCOUNT environment variable is not set. " +
      "Go to Firebase Console → Project Settings → Service Accounts → Generate new private key, " +
      "then add the JSON content as FIREBASE_SERVICE_ACCOUNT in your Vercel environment variables.";
    console.error("[Firebase Admin] CRITICAL:", adminInitError);
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountEnv);
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(
      "[Firebase Admin] Initialized successfully with service account for project:",
      serviceAccount.project_id
    );
    return app;
  } catch (parseErr: any) {
    adminInitError =
      "FIREBASE_SERVICE_ACCOUNT is set but could not be parsed as JSON. " +
      "Ensure the value is the raw JSON object (not base64 encoded). Error: " +
      parseErr.message;
    console.error("[Firebase Admin] JSON parse error:", adminInitError);
    return null;
  }
}

// Initialize on module load
const adminApp = initFirebaseAdmin();

function fDb() {
  if (!adminApp) throw new Error("Firebase Admin SDK not initialized. " + adminInitError);
  return getFirestore(adminApp, FIREBASE_DB_ID);
}

function fAuth() {
  if (!adminApp) throw new Error("Firebase Admin SDK not initialized. " + adminInitError);
  return adminApp.auth();
}

// ─── PostgreSQL Pool ───────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

// Run startup migrations
if (pool) {
  (async () => {
    try {
      await pool.query(
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';"
      );
      await pool.query(
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate REAL DEFAULT 0;"
      );
      await pool.query(
        "ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at INTEGER DEFAULT 0;"
      );
      console.log("[DB] PostgreSQL startup migrations completed.");
    } catch (e) {
      console.error("[DB] PostgreSQL startup migration error:", e);
    }
  })();
}

async function query(text: string, params: any[] = []) {
  if (!pool) {
    console.error("[DB] No DATABASE_URL set. Returning empty result for query:", text.substring(0, 80));
    return { rows: [] };
  }
  return pool.query(text, params);
}

// ─── Express App ───────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Request logger
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// ─── Auth Middleware ───────────────────────────────────────────────
// Accepts ONLY Firebase ID tokens for sync routes.
// Falls back to local JWT only for non-sync routes (legacy /api/auth/verify).
const authenticate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn(`[Auth] Missing Authorization header on ${req.method} ${req.url}`);
    return res.status(401).json({
      error: "Unauthorized",
      reason: "No Authorization header provided. Send: Authorization: Bearer <firebase-id-token>",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    console.warn(`[Auth] Authorization header does not start with 'Bearer ' on ${req.url}`);
    return res.status(401).json({
      error: "Unauthorized",
      reason: "Authorization header must use Bearer scheme: 'Authorization: Bearer <token>'",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token || token.length < 20) {
    console.warn(`[Auth] Empty or too-short token on ${req.url}`);
    return res.status(401).json({
      error: "Unauthorized",
      reason: "Bearer token is missing or malformed.",
    });
  }

  // Primary: verify Firebase ID token
  if (adminApp) {
    try {
      const decoded = await fAuth().verifyIdToken(token, true); // checkRevoked=true
      console.log(`[Auth] Firebase token verified for uid=${decoded.uid} email=${decoded.email}`);

      // Upsert user in local DB so userId resolves correctly for SQL queries
      const emailLower = (decoded.email || "").toLowerCase();
      let localUserId = decoded.uid;
      let role = "user";

      if (emailLower) {
        try {
          const userRes = await query(
            "SELECT id, role FROM users WHERE LOWER(email) = $1",
            [emailLower]
          );
          if (userRes.rows.length > 0) {
            localUserId = userRes.rows[0].id;
            role = userRes.rows[0].role || "user";
            if ((emailLower === 'admin@printex.com' || emailLower === 'printexengineers@gmail.com') && role !== 'admin') {
              role = 'admin';
              await query("UPDATE users SET role = 'admin' WHERE id = $1", [localUserId]);
              console.log(`[Auth] Upgraded local user ${emailLower} to admin`);
            }
          } else {
            // Auto-register Firebase user so SQL foreign keys resolve
            const name = decoded.name || emailLower.split("@")[0];
            const initialRole = (emailLower === 'admin@printex.com' || emailLower === 'printexengineers@gmail.com') ? 'admin' : 'user';
            await query(
              "INSERT INTO users (id, fullName, email, password, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO NOTHING",
              [decoded.uid, name, emailLower, bcrypt.hashSync(Math.random().toString(36), 10), initialRole]
            );
            console.log(`[Auth] Auto-registered Firebase user ${emailLower} as ${initialRole} in local DB`);
            role = initialRole;
          }
        } catch (dbErr) {
          console.warn("[Auth] Could not look up local user, using Firebase UID:", dbErr);
        }
      }

      (req as any).user = {
        id: localUserId,
        uid: decoded.uid,
        email: decoded.email,
        fullName: decoded.name || "",
        role,
      };
      return next();
    } catch (firebaseErr: any) {
      const code: string = firebaseErr.code || "";
      console.warn(
        `[Auth] Firebase token verification failed on ${req.url}:`,
        code,
        firebaseErr.message
      );

      if (code === "auth/id-token-expired") {
        return res.status(401).json({
          error: "Unauthorized",
          reason: "Firebase ID token has expired. The client must call getIdToken(true) to refresh.",
          code: "TOKEN_EXPIRED",
        });
      }
      if (code === "auth/id-token-revoked") {
        return res.status(401).json({
          error: "Unauthorized",
          reason: "Firebase ID token has been revoked. Please sign in again.",
          code: "TOKEN_REVOKED",
        });
      }
      if (code === "auth/argument-error" || code === "auth/invalid-id-token") {
        // Token might be a local JWT — try fallback only for non-sync routes
        if (!req.url.startsWith("/api/sync")) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            console.log(`[Auth] Accepted local JWT for uid=${decoded.id} on non-sync route ${req.url}`);
            (req as any).user = decoded;
            return next();
          } catch (jwtErr) {
            console.warn("[Auth] Local JWT fallback also failed:", (jwtErr as any).message);
          }
        }
        return res.status(401).json({
          error: "Unauthorized",
          reason: "Token is not a valid Firebase ID token. Ensure you send the token from firebase.auth().currentUser.getIdToken(true).",
          code: "INVALID_TOKEN",
        });
      }
      // Firebase Admin init problem (e.g. wrong credentials)
      return res.status(401).json({
        error: "Unauthorized",
        reason: "Firebase token verification service error: " + firebaseErr.message,
        code: "FIREBASE_ADMIN_ERROR",
      });
    }
  }

  // Firebase Admin not initialized — try local JWT as last resort (only for auth routes)
  if (!req.url.startsWith("/api/sync")) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log(`[Auth] Firebase Admin unavailable — accepted local JWT for uid=${decoded.id}`);
      (req as any).user = decoded;
      return next();
    } catch (jwtErr) {
      console.warn("[Auth] Local JWT fallback also failed (Firebase Admin unavailable)");
    }
  }

  console.error(`[Auth] All auth methods failed for ${req.url}. Firebase Admin status:`, adminInitError);
  return res.status(401).json({
    error: "Unauthorized",
    reason: "Firebase Admin SDK is not initialized on the server. Contact the administrator. " + (adminInitError || ""),
    code: "ADMIN_NOT_INITIALIZED",
  });
};

// ─── Health Check ──────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: pool ? "postgres" : "none",
    firebaseAdmin: adminApp ? "initialized" : "not_initialized",
    firebaseAdminError: adminInitError,
    env: process.env.NODE_ENV || "production",
  });
});

// ─── Sync Status (diagnostic, no auth required) ────────────────────
app.get("/api/sync/status", async (req, res) => {
  let firebaseStatus = "not_initialized";
  let firebaseError = adminInitError;

  if (adminApp) {
    try {
      // Lightweight check — list 1 user to verify credentials work
      await fAuth().listUsers(1);
      firebaseStatus = "OK";
      firebaseError = null;
    } catch (e: any) {
      firebaseStatus = "credentials_error";
      firebaseError = e.message;
    }
  }

  const dbStatus = pool ? "connected" : "no_database_url";

  res.json({
    firebaseAdmin: firebaseStatus,
    firebaseAdminError: firebaseError,
    database: dbStatus,
    firestoreDbId: FIREBASE_DB_ID,
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth API ──────────────────────────────────────────────────────
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName)
    return res.status(400).json({ error: "Missing required fields" });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = "usr_" + Math.random().toString(36).substring(2, 15);
    const emailLower = email.toLowerCase();
    const role = (emailLower === 'admin@printex.com' || emailLower === 'printexengineers@gmail.com') ? 'admin' : 'user';
    await query(
      "INSERT INTO users (id, fullName, email, password, role) VALUES ($1, $2, $3, $4, $5)",
      [id, fullName, emailLower, hashedPassword, role]
    );
    const token = jwt.sign({ id, email, fullName }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user: { id, email, fullName, role } });
  } catch (error: any) {
    if (error.code === "23505") return res.status(400).json({ error: "Email already exists" });
    console.error("[Auth] Signup error:", error);
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
    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch (error: any) {
    console.error("[Auth] Signin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/verify", authenticate, async (req, res) => {
  const user = (req as any).user;
  res.json({ valid: true, user });
});

// ─── M-Pesa STK Push ──────────────────────────────────────────────
app.post("/api/mpesa/stk-push", async (req, res) => {
  const { phoneNumber, amount, invoiceId } = req.body;
  if (!phoneNumber || !amount || !invoiceId)
    return res.status(400).json({ error: "Missing required parameters" });

  let phone = String(phoneNumber).replace(/\D/g, "");
  if (phone.startsWith("0")) phone = "254" + phone.substring(1);
  if (phone.startsWith("+")) phone = phone.substring(1);

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    const checkoutId = "MOCK-CK-" + Date.now();
    console.log(`[M-Pesa MOCK] STK Push: phone=${phone}, amount=${amount}, checkoutId=${checkoutId}`);
    try {
      await fDb()
        .collection("mpesa_transactions")
        .doc(checkoutId)
        .set({ status: "pending", invoiceId: String(invoiceId), amount: Math.ceil(Number(amount)), phoneNumber: phone, createdAt: Date.now() });
    } catch (e) {
      console.error("[M-Pesa MOCK] Firestore write failed:", e);
    }
    setTimeout(async () => {
      const receipt = "MOCK" + Math.random().toString(36).substring(2, 10).toUpperCase();
      try {
        await query("UPDATE invoices SET payment_status='paid', payment_ref=$1, paid_at=$2 WHERE id=$3 OR invoice_number=$3", [receipt, new Date().toISOString(), String(invoiceId)]);
        await fDb().collection("public_deliveries").doc(String(invoiceId)).set({ paymentStatus: "paid", paymentRef: receipt, paidAt: Date.now() }, { merge: true });
        await fDb().collection("mpesa_transactions").doc(checkoutId).set({ status: "success", mpesaRef: receipt, amountPaid: Math.ceil(Number(amount)), phoneUsed: phone, updatedAt: Date.now() }, { merge: true });
      } catch (e) { console.error("[M-Pesa MOCK] Callback update failed:", e); }
    }, 5000);
    return res.json({ MerchantRequestID: "MOCK-" + Date.now(), CheckoutRequestID: checkoutId, ResponseCode: "0", ResponseDescription: "Mock STK Push Success", CustomerMessage: "Check your phone." });
  }

  try {
    const authString = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const baseUrl = process.env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${authString}` } });
    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Failed to get M-Pesa access token: " + JSON.stringify(tokenData));
    const accessToken = tokenData.access_token;
    const shortcode = process.env.MPESA_SHORTCODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
    const callbackUrl = process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/mpesa/callback` : `https://printex.vercel.app/api/mpesa/callback`;
    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, TransactionType: process.env.MPESA_TYPE === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline", Amount: Math.ceil(Number(amount)), PartyA: phone, PartyB: shortcode, PhoneNumber: phone, CallBackURL: callbackUrl, AccountReference: String(invoiceId).substring(0, 12), TransactionDesc: "Printex Invoice Payment" }) });
    const stkData = await stkRes.json();
    if ((stkData as any).ResponseCode === "0" && (stkData as any).CheckoutRequestID) {
      try { await fDb().collection("mpesa_transactions").doc((stkData as any).CheckoutRequestID).set({ status: "pending", invoiceId: String(invoiceId), amount: Math.ceil(Number(amount)), phoneNumber: phone, createdAt: Date.now() }); } catch (e) { console.error("[M-Pesa] Firestore init failed:", e); }
    }
    res.json(stkData);
  } catch (e: any) {
    console.error("[M-Pesa] STK Push error:", e);
    res.status(500).json({ error: "M-Pesa request failed: " + e.message });
  }
});

app.post("/api/mpesa/callback", async (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (!callbackData) return;
    const resultCode = callbackData.ResultCode;
    const checkoutRequestId = callbackData.CheckoutRequestID;
    if (resultCode !== 0) {
      if (checkoutRequestId) { await fDb().collection("mpesa_transactions").doc(String(checkoutRequestId)).set({ status: "failed", message: callbackData.ResultDesc || `Payment failed (code ${resultCode})`, updatedAt: Date.now() }, { merge: true }); }
      return;
    }
    const meta: any[] = callbackData.CallbackMetadata?.Item || [];
    const get = (name: string) => meta.find((m: any) => m.Name === name)?.Value;
    const receipt = get("MpesaReceiptNumber");
    const amountPaid = get("Amount");
    const phoneUsed = get("PhoneNumber");
    const invoiceId = get("AccountReference");
    if (!invoiceId) { console.error("[M-Pesa Callback] No invoiceId in AccountReference"); return; }
    await query("UPDATE invoices SET payment_status='paid', payment_ref=$1, paid_at=$2 WHERE id=$3 OR invoice_number=$3", [receipt, new Date().toISOString(), String(invoiceId)]);
    await fDb().collection("public_deliveries").doc(String(invoiceId)).set({ paymentStatus: "paid", paymentRef: receipt, amountPaid, phoneUsed: String(phoneUsed), paidAt: Date.now() }, { merge: true });
    if (checkoutRequestId) { await fDb().collection("mpesa_transactions").doc(String(checkoutRequestId)).set({ status: "success", mpesaRef: receipt, amountPaid, phoneUsed: String(phoneUsed), updatedAt: Date.now() }, { merge: true }); }
  } catch (e: any) { console.error("[M-Pesa Callback] Processing error:", e); }
});

app.get("/api/mpesa/status/:checkoutId", async (req, res) => {
  try {
    const doc = await fDb().collection("mpesa_transactions").doc(String(req.params.checkoutId)).get();
    if (!doc.exists) return res.status(404).json({ error: "Transaction not found" });
    res.json(doc.data());
  } catch (e: any) { res.status(500).json({ error: "Failed to fetch status" }); }
});

// ─── Delivery API ─────────────────────────────────────────────────
app.get("/api/delivery/:deliveryId", async (req, res) => {
  const { deliveryId } = req.params;
  try {
    let deliveryData: any = null;
    try {
      const doc = await fDb().collection("public_deliveries").doc(String(deliveryId)).get();
      if (doc.exists) deliveryData = doc.data();
    } catch (e) { console.warn("[Delivery] Firestore unavailable, falling back to DB:", e); }
    if (!deliveryData) {
      const invCheck = await query("SELECT id, invoice_number, customer, grand, payment_status, payment_ref, delivery_status FROM invoices WHERE id = $1 OR invoice_number = $1", [deliveryId]);
      if (invCheck.rows.length > 0) {
        const row = invCheck.rows[0];
        deliveryData = { deliveryId: row.id, invoiceNumber: row.invoice_number, customer: row.customer, grand: row.grand, paymentStatus: row.payment_status || "pending", paymentRef: row.payment_ref || "", deliveryStatus: row.delivery_status || "pending" };
      }
    }
    if (!deliveryData) return res.status(404).json({ error: "Delivery not found" });
    res.json({ success: true, data: deliveryData });
  } catch (e: any) { res.status(500).json({ error: "Failed to fetch delivery data" }); }
});

app.post("/api/delivery/update", async (req, res) => {
  const { deliveryId, status, token } = req.body;
  if (!deliveryId || !status || !token) return res.status(400).json({ error: "Missing required fields" });
  const validStatuses = ["pending", "dispatched", "arrived", "delivered"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status value" });
  if (token !== `sec_${deliveryId}`) return res.status(403).json({ error: "Invalid delivery token" });
  try {
    await fDb().collection("public_deliveries").doc(String(deliveryId)).set({ deliveryStatus: status, updatedAt: Date.now() }, { merge: true });
    await query("UPDATE invoices SET delivery_status = $1, updated_at = $2 WHERE id = $3", [status, Date.now(), String(deliveryId)]);
    const invCheck = await query("SELECT user_id, invoice_number FROM invoices WHERE id = $1", [deliveryId]);
    if (invCheck.rows.length > 0) {
      const { user_id: userId, invoice_number: invoiceNumber } = invCheck.rows[0];
      await fDb().collection(`users/${userId}/invoices`).doc(String(deliveryId)).set({ deliveryStatus: status }, { merge: true });
      const actId = "act_" + Math.random().toString(36).substring(2, 9);
      await query("INSERT INTO activity (id, user_id, text, type, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)", [actId, userId, `Delivery status for ${invoiceNumber} updated to: ${status}`, "delivery", new Date().toISOString(), Date.now()]);
    }
    res.json({ success: true, deliveryId, status });
  } catch (e: any) { res.status(500).json({ error: "Failed to update delivery status: " + e.message }); }
});

// ─── Inventory API ────────────────────────────────────────────────
app.get("/api/inventory", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const result = await query("SELECT * FROM inventory WHERE user_id = $1", [userId]);
    res.json(result.rows);
  } catch (e) {
    console.error("[Inventory] Fetch error:", e);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// ─── Sync Push API ────────────────────────────────────────────────
app.post("/api/sync/push", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { parts, invoices, settings, activity, submissions } = req.body;
  const now = Date.now();
  console.log(`[Sync Push] user=${userId} parts=${parts?.length || 0} invoices=${invoices?.length || 0} submissions=${submissions?.length || 0}`);

  try {
    // 1. Sync Parts (inventory)
    if (parts && Array.isArray(parts)) {
      for (const p of parts) {
        const price = parseFloat(p.priceKsh || p.price) || 0;
        await query(
          `INSERT INTO inventory (id, user_id, category, part_num, description, stock, min_stock, price, supplier, location, image, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT(id) DO UPDATE SET category=$3, part_num=$4, description=$5, stock=$6, min_stock=$7, price=$8, supplier=$9, location=$10, image=$11, updated_at=$12`,
          [String(p.id), userId, p.category, p.partNum, p.desc, parseInt(p.stock) || 0, parseInt(p.minStock) || 0, price, p.supplier || "", p.location || "", p.image || null, now]
        );
      }
    }

    // 2. Sync Invoices
    if (invoices && Array.isArray(invoices)) {
      for (const inv of invoices) {
        const itemsStr = typeof inv.items === "string" ? inv.items : JSON.stringify(inv.items || []);
        await query(
          `INSERT INTO invoices (id, user_id, invoice_number, date, customer, notes, type, items, subtotal, discount_pct, discount_amt, vat, vat_rate, grand, payment_status, payment_ref, paid_at, delivery_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           ON CONFLICT(id) DO UPDATE SET invoice_number=$3, date=$4, customer=$5, notes=$6, type=$7, items=$8, subtotal=$9, discount_pct=$10, discount_amt=$11, vat=$12, vat_rate=$13, grand=$14, payment_status=$15, payment_ref=$16, paid_at=$17, delivery_status=$18, created_at=$19, updated_at=$20`,
          [String(inv.id), userId, inv.invoiceNumber, inv.date, inv.customer, inv.notes || "", inv.type, itemsStr, inv.subtotal, inv.discountPct, inv.discountAmt, inv.vat, inv.vatRate || 0, inv.grand, inv.paymentStatus || "", inv.paymentRef || "", inv.paidAt || "", inv.deliveryStatus || "pending", inv.createdAt, now]
        );
        // Mirror to Firestore public_deliveries for real-time tracking
        if (inv.type === "invoice") {
          try {
            await fDb().collection("public_deliveries").doc(String(inv.id)).set({
              invoiceNumber: inv.invoiceNumber,
              customer: inv.customer,
              grand: inv.grand,
              paymentStatus: inv.paymentStatus || "pending",
              deliveryStatus: inv.deliveryStatus || "pending",
              createdAt: inv.createdAt || now,
            }, { merge: true });
          } catch (fbErr) { console.warn("[Sync Push] Firestore delivery mirror failed:", fbErr); }
        }
      }
    }

    // 3. Sync Settings
    if (settings && Array.isArray(settings)) {
      for (const s of settings) {
        const valStr = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
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
          [String(act.id), userId, act.text, act.type || "", act.created_at || act.createdAt || "", now]
        );
      }
    }

    // 5. Sync Submissions
    if (submissions && Array.isArray(submissions)) {
      const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
      const isAdmin = userCheck.rows[0]?.role === "admin";
      for (const sub of submissions) {
        if (isAdmin) {
          await query(
            `INSERT INTO submissions (id, user_id, task_details, project_description, invoice_number, totals, notes, delivery_info, links, attachments, status, risk_level, risk_summary, reviewer_id, reviewer_name, reviewer_notes, reviewed_at, history, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
             ON CONFLICT(id) DO UPDATE SET user_id=$2, task_details=$3, project_description=$4, invoice_number=$5, totals=$6, notes=$7, delivery_info=$8, links=$9, attachments=$10, status=$11, risk_level=$12, risk_summary=$13, reviewer_id=$14, reviewer_name=$15, reviewer_notes=$16, reviewed_at=$17, history=$18, updated_at=$20`,
            [String(sub.id), sub.user_id || userId, sub.task_details || "", sub.project_description || "", sub.invoice_number || "", parseFloat(sub.totals) || 0, sub.notes || "", sub.delivery_info || "", sub.links || "", typeof sub.attachments === "string" ? sub.attachments : JSON.stringify(sub.attachments || []), sub.status || "Pending", sub.risk_level || "Low Risk", sub.risk_summary || "", sub.reviewer_id || "", sub.reviewer_name || "", sub.reviewer_notes || "", sub.reviewed_at || "", typeof sub.history === "string" ? sub.history : JSON.stringify(sub.history || []), sub.created_at || "", now]
          );
        } else {
          const existing = await query("SELECT status, user_id FROM submissions WHERE id = $1", [String(sub.id)]);
          if (existing.rows.length > 0) {
            if (existing.rows[0].user_id === userId) {
              await query(
                `UPDATE submissions SET task_details=$1, project_description=$2, invoice_number=$3, totals=$4, notes=$5, delivery_info=$6, links=$7, attachments=$8, updated_at=$9 WHERE id=$10`,
                [sub.task_details || "", sub.project_description || "", sub.invoice_number || "", parseFloat(sub.totals) || 0, sub.notes || "", sub.delivery_info || "", sub.links || "", typeof sub.attachments === "string" ? sub.attachments : JSON.stringify(sub.attachments || []), now, String(sub.id)]
              );
            }
          } else {
            await query(
              `INSERT INTO submissions (id, user_id, task_details, project_description, invoice_number, totals, notes, delivery_info, links, attachments, status, risk_level, risk_summary, history, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending', 'Low Risk', '', '[]', $11, $12)`,
              [String(sub.id), userId, sub.task_details || "", sub.project_description || "", sub.invoice_number || "", parseFloat(sub.totals) || 0, sub.notes || "", sub.delivery_info || "", sub.links || "", typeof sub.attachments === "string" ? sub.attachments : JSON.stringify(sub.attachments || []), sub.created_at || "", now]
            );
          }
        }
      }
    }

    console.log(`[Sync Push] Success for user=${userId} at ${now}`);
    res.json({ success: true, timestamp: now });
  } catch (e: any) {
    console.error("[Sync Push] Error:", e);
    res.status(500).json({ error: "Sync failed: " + e.message });
  }
});

// ─── Sync Pull API ────────────────────────────────────────────────
app.post("/api/sync/pull", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const lastSyncTimestamp = parseInt(req.body.lastSyncTimestamp) || 0;
  console.log(`[Sync Pull] user=${userId} since=${lastSyncTimestamp}`);

  try {
    const [partsResult, invoicesResult, settingsResult, activityResult] = await Promise.all([
      query("SELECT * FROM inventory WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]),
      query("SELECT * FROM invoices WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]),
      query("SELECT * FROM settings WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]),
      query("SELECT * FROM activity WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]),
    ]);

    const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
    const isAdmin = userCheck.rows[0]?.role === "admin";
    const submissionsResult = isAdmin
      ? await query("SELECT * FROM submissions WHERE updated_at > $1", [lastSyncTimestamp])
      : await query("SELECT * FROM submissions WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);

    res.json({
      uidValidity: { parts: 20260608, invoices: 20260608, settings: 20260608, activity: 20260608, submissions: 20260608 },
      parts: partsResult.rows.map((r) => ({
        id: r.id, category: r.category, partNum: r.part_num, desc: r.description,
        stock: r.stock, minStock: r.min_stock, priceKsh: r.price,
        supplier: r.supplier, location: r.location, image: r.image,
      })),
      invoices: invoicesResult.rows.map((r) => ({
        id: r.id, userId: r.user_id, invoiceNumber: r.invoice_number, date: r.date,
        customer: r.customer, notes: r.notes, type: r.type, items: r.items,
        subtotal: r.subtotal, discountPct: r.discount_pct, discountAmt: r.discount_amt,
        vat: r.vat, vatRate: r.vat_rate, grand: r.grand,
        paymentStatus: r.payment_status || "pending", paymentRef: r.payment_ref || "",
        paidAt: r.paid_at || "", deliveryStatus: r.delivery_status || "pending",
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
      settings: settingsResult.rows,
      activity: activityResult.rows,
      submissions: submissionsResult.rows,
    });
  } catch (e: any) {
    console.error("[Sync Pull] Error:", e);
    res.status(500).json({ error: "Failed to pull changes: " + e.message });
  }
});

// ─── Sync Delete API ──────────────────────────────────────────────
app.post("/api/sync/delete", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { store, id } = req.body;
  if (!store || !id) return res.status(400).json({ error: "Missing store or id" });
  console.log(`[Sync Delete] user=${userId} store=${store} id=${id}`);

  try {
    const table = store === "parts" ? "inventory" : store;
    if (!["inventory", "invoices", "settings", "activity", "submissions"].includes(table)) {
      return res.status(400).json({ error: "Invalid store: " + store });
    }

    if (table === "settings") {
      await query("DELETE FROM settings WHERE user_id = $1 AND key = $2", [userId, id]);
    } else if (table === "submissions") {
      const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
      const isAdmin = userCheck.rows[0]?.role === "admin";
      if (isAdmin) {
        await query("DELETE FROM submissions WHERE id = $1", [id]);
      } else {
        await query("DELETE FROM submissions WHERE user_id = $1 AND id = $2", [userId, id]);
      }
    } else {
      await query(`DELETE FROM ${table} WHERE user_id = $1 AND id = $2`, [userId, id]);
    }
    console.log(`[Sync Delete] Success: deleted ${table}/${id} for user=${userId}`);
    res.json({ success: true });
  } catch (e: any) {
    console.error("[Sync Delete] Error:", e);
    res.status(500).json({ error: "Failed to delete item: " + e.message });
  }
});

// ─── Catch-all API 404 ────────────────────────────────────────────
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.url} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Server] Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// ─── Export for Vercel ────────────────────────────────────────────
export default app;
