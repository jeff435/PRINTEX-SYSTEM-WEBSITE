import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { DatabaseSync } from "node:sqlite";
const Database = DatabaseSync;
import firebaseConfig from "./firebase-applet-config.json";

const JWT_SECRET = process.env.JWT_SECRET || "printex-secret-key-123";

// Initialize SQLite fallback
const sqliteFile = path.join(process.cwd(), "printex.db");
const sqlite = new Database(sqliteFile);

// Initialize Postgres Pool if available
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
}) : null;

// ─── Firebase Admin Initialization ───────────────────────────────
const FIREBASE_DB_ID = firebaseConfig.firestoreDatabaseId;
let adminInitError: string | null = null;
let adminApp: admin.app.App | null = null;

function initFirebaseAdmin(): admin.app.App | null {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      const serviceAccount = JSON.parse(serviceAccountEnv);
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("[Firebase Admin] Initialized from FIREBASE_SERVICE_ACCOUNT env var for project:", serviceAccount.project_id);
      return app;
    } catch (parseErr: any) {
      adminInitError = "FIREBASE_SERVICE_ACCOUNT could not be parsed as JSON: " + parseErr.message;
      console.error("[Firebase Admin]", adminInitError);
    }
  }

  // Fall back to applicationDefault (works with GOOGLE_APPLICATION_CREDENTIALS or local gcloud)
  try {
    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
    console.log("[Firebase Admin] Initialized via applicationDefault credentials.");
    return app;
  } catch (e: any) {
    adminInitError =
      "Firebase Admin could not initialize. Set FIREBASE_SERVICE_ACCOUNT env var with your service account JSON. Error: " + e.message;
    console.error("[Firebase Admin] CRITICAL:", adminInitError);
    return null;
  }
}

adminApp = initFirebaseAdmin();

const db = () => {
  if (!adminApp) throw new Error("Firebase Admin SDK not initialized. " + adminInitError);
  return getFirestore(adminApp, FIREBASE_DB_ID);
};
const auth = () => {
  if (!adminApp) throw new Error("Firebase Admin SDK not initialized. " + adminInitError);
  return adminApp.auth();
};

// Unified database query helper
async function query(text: string, params: any[] = []) {
  if (pool) {
    return pool.query(text, params);
  } else {
    // Map Postgres $1, $2 (which can be repeated) to positional SQLite ? placeholders
    const matches = text.match(/\$(\d+)/g) || [];
    const orderedParams = matches.map(m => {
      const index = parseInt(m.substring(1)) - 1;
      return params[index];
    });
    const sqliteSql = text.replace(/\$(\d+)/g, '?');
    const stmt = sqlite.prepare(sqliteSql);
    if (text.trim().toUpperCase().startsWith('SELECT')) {
      const rows = stmt.all(...orderedParams);
      return { rows };
    } else {
      const info = stmt.run(...orderedParams);
      return { rows: [], lastInsertRowid: info.lastInsertRowid };
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set high limits for file-uploads/base64-images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Database Tables
  try {
    console.log(`Initializing ${pool ? 'Postgres' : 'SQLite'} database...`);
    const initSql = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        fullName TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT,
        category_id TEXT,
        part_num TEXT,
        description TEXT,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        reorder_level INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        buying_price REAL DEFAULT 0,
        selling_price REAL DEFAULT 0,
        barcode TEXT,
        supplier TEXT,
        supplier_id TEXT,
        location TEXT,
        expiry_date TEXT,
        image TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        date TEXT NOT NULL,
        customer TEXT,
        customer_id TEXT,
        notes TEXT,
        type TEXT,
        items TEXT,
        subtotal REAL,
        discount_pct REAL,
        discount_amt REAL,
        vat REAL,
        vat_rate REAL,
        grand REAL,
        payment_status TEXT,
        payment_ref TEXT,
        paid_at TEXT,
        delivery_status TEXT DEFAULT 'pending',
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS settings (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        updated_at INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, key)
      );
      CREATE TABLE IF NOT EXISTS activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_details TEXT,
        project_description TEXT,
        invoice_number TEXT,
        totals REAL,
        notes TEXT,
        delivery_info TEXT,
        links TEXT,
        attachments TEXT,
        status TEXT DEFAULT 'Pending',
        risk_level TEXT DEFAULT 'Low Risk',
        risk_summary TEXT,
        reviewer_id TEXT,
        reviewer_name TEXT,
        reviewer_notes TEXT,
        reviewed_at TEXT,
        history TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#00d4ff',
        icon TEXT DEFAULT 'fa-tag',
        parent_id TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        balance REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        contact_person TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT,
        description TEXT NOT NULL,
        amount REAL DEFAULT 0,
        date TEXT,
        receipt_url TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        phone TEXT,
        email TEXT,
        salary REAL DEFAULT 0,
        hire_date TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        supplier_id TEXT,
        supplier_name TEXT,
        items TEXT,
        total REAL DEFAULT 0,
        date TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TEXT,
        updated_at INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id TEXT,
        old_data TEXT,
        new_data TEXT,
        timestamp INTEGER DEFAULT 0
      );
    `;
    
    // SQLite executes init script directly
    if (!pool) {
      sqlite.exec(initSql);
      // SQLite: add missing columns one by one (ALTER TABLE ADD COLUMN IF NOT EXISTS not supported in all SQLite versions)
      const addColSafe = (sql: string) => { try { sqlite.exec(sql); } catch(e: any) { if (!e.message?.includes('duplicate column')) console.warn('[DB] Col add:', e.message); } };
      addColSafe('ALTER TABLE inventory ADD COLUMN category_id TEXT');
      addColSafe('ALTER TABLE inventory ADD COLUMN reorder_level INTEGER DEFAULT 0');
      addColSafe('ALTER TABLE inventory ADD COLUMN buying_price REAL DEFAULT 0');
      addColSafe('ALTER TABLE inventory ADD COLUMN selling_price REAL DEFAULT 0');
      addColSafe('ALTER TABLE inventory ADD COLUMN barcode TEXT');
      addColSafe('ALTER TABLE inventory ADD COLUMN supplier_id TEXT');
      addColSafe('ALTER TABLE inventory ADD COLUMN expiry_date TEXT');
      addColSafe('ALTER TABLE invoices ADD COLUMN customer_id TEXT');
    } else {
      await pool.query(initSql);
      await pool.query("ALTER TABLE users DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE settings DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE activity DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE categories DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE customers DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE employees DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;").catch(() => {});
      await pool.query("ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;").catch(() => {});
      // PostgreSQL: add missing columns safely
      const pgAddCol = (sql: string) => pool!.query(sql).catch(() => {});
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category_id TEXT");
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0");
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS buying_price REAL DEFAULT 0");
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS selling_price REAL DEFAULT 0");
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode TEXT");
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier_id TEXT");
      await pgAddCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date TEXT");
      await pgAddCol("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id TEXT");
    }
    console.log("Database initialized successfully.");
  } catch (e) {
    console.error("Database initialization failed:", e);
  }

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      database: pool ? "postgres" : "sqlite",
      firebaseAdmin: adminApp ? "initialized" : "not_initialized",
      firebaseAdminError: adminInitError,
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api/status", (req, res) => {
    res.json({ status: "ok" });
  });

  // Sync Status — diagnostic endpoint (no auth required)
  app.get("/api/sync/status", async (req, res) => {
    let firebaseStatus = "not_initialized";
    let firebaseError = adminInitError;
    if (adminApp) {
      try {
        await auth().listUsers(1);
        firebaseStatus = "OK";
        firebaseError = null;
      } catch (e: any) {
        firebaseStatus = "credentials_error";
        firebaseError = e.message;
      }
    }
    res.json({
      firebaseAdmin: firebaseStatus,
      firebaseAdminError: firebaseError,
      database: pool ? "postgres" : "sqlite",
      firestoreDbId: FIREBASE_DB_ID,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      timestamp: new Date().toISOString(),
    });
  });



  // Log all requests for debugging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // --- Auth API ---
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = "usr_" + Math.random().toString(36).substring(2, 15);
      const emailLower = email.toLowerCase();
      const role = (emailLower === 'admin@printex.com' || emailLower === 'printexengineers@gmail.com') ? 'admin' : 'user';
      await query("INSERT INTO users (id, fullName, email, password, role) VALUES ($1, $2, $3, $4, $5)", [id, fullName, emailLower, hashedPassword, role]);
      const token = jwt.sign({ id, email, fullName }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ success: true, token, user: { id, email, fullName, role } });
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === "23505" || error.message?.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email already exists" });
      }
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
      console.error("Signin error:", error);
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
    } catch (error) {
      res.status(401).json({ valid: false });
    }
  });

  // --- Auth Middleware ---
  // Accepts Firebase ID tokens primarily. Falls back to local JWT only for non-sync routes.
  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.warn(`[Auth] Missing Authorization header on ${req.method} ${req.url}`);
      return res.status(401).json({
        error: "Unauthorized",
        reason: "No Authorization header provided. Send: Authorization: Bearer <firebase-id-token>",
      });
    }
    if (!authHeader.startsWith('Bearer ')) {
      console.warn(`[Auth] Authorization header does not use Bearer scheme on ${req.url}`);
      return res.status(401).json({
        error: "Unauthorized",
        reason: "Authorization header must use Bearer scheme.",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token || token.length < 20) {
      return res.status(401).json({ error: "Unauthorized", reason: "Bearer token is empty or malformed." });
    }

    // Primary: verify Firebase ID token
    if (adminApp) {
      try {
        const decoded = await auth().verifyIdToken(token, true);
        console.log(`[Auth] Firebase token verified for uid=${decoded.uid} email=${decoded.email}`);

        const emailLower = (decoded.email || "").toLowerCase();
        let localUserId = decoded.uid;
        let role = 'user';

        if (emailLower) {
          try {
            const userRes = await query("SELECT id, role FROM users WHERE LOWER(email) = $1", [emailLower]);
            if (userRes.rows.length > 0) {
              localUserId = userRes.rows[0].id;
              role = userRes.rows[0].role || 'user';
              if ((emailLower === 'admin@printex.com' || emailLower === 'printexengineers@gmail.com') && role !== 'admin') {
                role = 'admin';
                await query("UPDATE users SET role = 'admin' WHERE id = $1", [localUserId]);
                console.log(`[Auth] Upgraded local user ${emailLower} to admin`);
              }
            } else {
              const name = decoded.name || emailLower.split('@')[0];
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

        (req as any).user = { id: localUserId, uid: decoded.uid, email: decoded.email, fullName: decoded.name || "", role };
        return next();
      } catch (firebaseErr: any) {
        const code: string = firebaseErr.code || "";
        console.warn(`[Auth] Firebase token verification failed on ${req.url}:`, code, firebaseErr.message);

        // If running locally without service account, allow decoding Firebase JWT directly
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
          try {
            const decoded = jwt.decode(token) as any;
            if (decoded && (decoded.uid || decoded.user_id)) {
              const uid = decoded.uid || decoded.user_id;
              const email = decoded.email || "";
              console.log(`[Auth] [Local Fallback] Decoded Firebase token without verification: uid=${uid} email=${email}`);
              const emailLower = email.toLowerCase();
              let localUserId = uid;
              let role = 'user';

              if (emailLower) {
                const userRes = await query("SELECT id, role FROM users WHERE LOWER(email) = $1", [emailLower]);
                if (userRes.rows.length > 0) {
                  localUserId = userRes.rows[0].id;
                  role = userRes.rows[0].role || 'user';
                }
              }
              (req as any).user = { id: localUserId, uid, email, fullName: decoded.name || "", role };
              return next();
            }
          } catch (decodeErr: any) {
            console.error("[Auth] Direct decode of Firebase token failed:", decodeErr.message);
          }
        }

        if (code === 'auth/id-token-expired') {
          return res.status(401).json({
            error: "Unauthorized",
            reason: "Firebase ID token has expired. Client must call getIdToken(true) to refresh.",
            code: "TOKEN_EXPIRED",
          });
        }
        if (code === 'auth/id-token-revoked') {
          return res.status(401).json({
            error: "Unauthorized",
            reason: "Firebase ID token has been revoked. Please sign in again.",
            code: "TOKEN_REVOKED",
          });
        }
        // For sync routes, do NOT fall back to local JWT
        if (req.url.startsWith('/api/sync')) {
          return res.status(401).json({
            error: "Unauthorized",
            reason: "Sync routes require a valid Firebase ID token. Error: " + firebaseErr.message,
            code: "INVALID_TOKEN",
          });
        }
      }
    } else {
      console.error(`[Auth] Firebase Admin not initialized (${adminInitError}). Sync routes will be unavailable.`);
      if (req.url.startsWith('/api/sync')) {
        return res.status(401).json({
          error: "Unauthorized",
          reason: "Firebase Admin SDK is not initialized on the server. Set FIREBASE_SERVICE_ACCOUNT env var.",
          code: "ADMIN_NOT_INITIALIZED",
        });
      }
    }

    // Fallback: local JWT (only for non-sync routes)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log(`[Auth] Accepted local JWT for uid=${decoded.id} on ${req.url}`);
      (req as any).user = decoded;
      return next();
    } catch (jwtErr) {
      console.error("[Auth] All auth methods failed:", (jwtErr as any).message);
      return res.status(401).json({ error: "Unauthorized", reason: "Token is not a valid Firebase ID token or local JWT." });
    }
  };

  // --- Debug API ---
  app.get("/api/debug", async (req, res) => {
    const debugInfo: any = {
      firebase: "unknown",
      postgres: "unknown",
      firebaseAdminInitError: adminInitError,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      env: { HAS_DATABASE_URL: !!process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV }
    };
    try {
      const firebaseAuth = auth();
      debugInfo.firebase = "Initialized";
      await firebaseAuth.listUsers(1);
      debugInfo.firebase = "OK";
    } catch (e: any) {
      debugInfo.firebase = "ERROR: " + e.message;
    }
    if (process.env.DATABASE_URL) {
      try {
        const { default: pkg } = await import("pg");
        const { Pool } = pkg;
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const result = await pool.query("SELECT 1");
        debugInfo.postgres = "OK";
        const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        debugInfo.tables = tables.rows.map((r: any) => r.table_name);
        await pool.end();
      } catch (e: any) {
        debugInfo.postgres = "ERROR: " + e.message;
      }
    }
    res.json(debugInfo);
  });

  // --- M-Pesa API ---
  app.post("/api/mpesa/stk-push", async (req, res) => {
    const { phoneNumber, amount, invoiceId } = req.body;
    if (!phoneNumber || !amount || !invoiceId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Sanitize phone number to 254XXXXXXXXX format
    let phone = String(phoneNumber).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "254" + phone.substring(1);
    if (phone.startsWith("+")) phone = phone.substring(1);
    
    // Fallback/Mock for local testing without Daraja credentials
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    
    if (!consumerKey || !consumerSecret) {
      const checkoutId = "MOCK-CK-" + Date.now();
      console.log(`[M-Pesa Mock] STK Push: phone=${phone}, amount=${amount}, invoiceId=${invoiceId}, checkoutId=${checkoutId}`);
      
      // Initialize transaction in Firestore for client status polling
      try {
        await db().collection("mpesa_transactions").doc(checkoutId).set({
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
        console.log(`[M-Pesa Mock] Simulating successful payment callback for ${invoiceId}`);
        const now = Date.now();
        const receipt = `MOCK_${Math.random().toString(36).substring(2,8).toUpperCase()}`;
        await query(
          "UPDATE invoices SET payment_status = 'paid', payment_ref = $1, paid_at = $2, updated_at = $3 WHERE id = $4 OR invoice_number = $4",
          [receipt, new Date().toISOString(), now, invoiceId]
        );
        try {
          await db().collection('public_deliveries').doc(String(invoiceId)).set({
            paymentStatus: 'paid',
            paymentRef: receipt,
            paidAt: Date.now()
          }, { merge: true });
          
          await db().collection("mpesa_transactions").doc(checkoutId).set({
            status: "success",
            mpesaRef: receipt,
            amountPaid: Math.ceil(Number(amount)),
            phoneUsed: phone,
            updatedAt: Date.now()
          }, { merge: true });
        } catch(e) {
          console.error("Mock callback update failed:", e);
        }
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
      // Official Daraja integration logic
      const authHeaderValue = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      const baseUrl = process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

      const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${authHeaderValue}` }
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const shortcode = process.env.MPESA_SHORTCODE || "174379";
      const passkey = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

      const callbackUrl = process.env.PUBLIC_URL
        ? `${process.env.PUBLIC_URL}/api/mpesa/callback`
        : `https://printex.vercel.app/api/mpesa/callback`;

      const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
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
          TransactionDesc: "Printex Payment"
        })
      });
      
      const stkData = await stkRes.json();

      // Save transaction state to Firestore for client status polling
      if (stkData.ResponseCode === "0" && stkData.CheckoutRequestID) {
        try {
          await db().collection("mpesa_transactions").doc(stkData.CheckoutRequestID).set({
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
      res.status(500).json({ error: "M-Pesa request failed" });
    }
  });

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
          await db().collection("mpesa_transactions").doc(String(checkoutRequestId)).set({
            status: "failed",
            message: callbackData.ResultDesc || `Payment failed (code ${resultCode})`,
            updatedAt: Date.now()
          }, { merge: true });
        }
        return;
      }

      const meta = callbackData.CallbackMetadata?.Item || [];
      const get = (name: string) => meta.find((m: any) => m.Name === name)?.Value;

      const receipt      = get("MpesaReceiptNumber");
      const amountPaid   = get("Amount");
      const phoneUsed    = get("PhoneNumber");
      const invoiceId    = get("AccountReference");

      console.log(`[M-Pesa Callback] SUCCESS — Receipt: ${receipt}, Amount: ${amountPaid}, Phone: ${phoneUsed}, Ref: ${invoiceId}`);

      if (!invoiceId) {
        console.error("[M-Pesa Callback] No invoiceId in AccountReference");
        return;
      }

      // 1. Update Postgres/SQLite invoice
      await query(
        "UPDATE invoices SET payment_status = 'paid', payment_ref = $1, paid_at = $2 WHERE id = $3 OR invoice_number = $3",
        [receipt, new Date().toISOString(), String(invoiceId)]
      );

      // 2. Update Firebase public_deliveries for real-time sync
      await db().collection("public_deliveries").doc(String(invoiceId)).set({
        paymentStatus: "paid",
        paymentRef: receipt,
        amountPaid: amountPaid,
        phoneUsed: String(phoneUsed),
        paidAt: Date.now()
      }, { merge: true });

      // 3. Update Firestore transaction log for client status polling
      if (checkoutRequestId) {
        await db().collection("mpesa_transactions").doc(String(checkoutRequestId)).set({
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

  // --- M-Pesa Status Query ---
  app.get("/api/mpesa/status/:checkoutId", async (req, res) => {
    const { checkoutId } = req.params;
    try {
      const doc = await db().collection("mpesa_transactions").doc(String(checkoutId)).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(doc.data());
    } catch (e: any) {
      console.error("Status fetch error:", e);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  // --- Delivery API ---
  app.get("/api/delivery/:deliveryId", async (req, res) => {
    const { deliveryId } = req.params;
    try {
      let deliveryData: any = null;
      
      // 1. Try fetching from Firestore first
      try {
        const doc = await db().collection("public_deliveries").doc(String(deliveryId)).get();
        if (doc.exists) {
          deliveryData = doc.data();
        }
      } catch (e) {
        console.warn("Firestore not available or error fetching delivery, falling back to local DB:", e);
      }
      
      // 2. If not found or Firestore offline, try local database fallback
      if (!deliveryData) {
        const invCheck = await query(
          "SELECT id, invoice_number, customer, grand, payment_status, payment_ref, delivery_status FROM invoices WHERE id = $1 OR invoice_number = $1",
          [deliveryId]
        );
        if (invCheck.rows.length > 0) {
          const row = invCheck.rows[0];
          deliveryData = {
            deliveryId: row.id,
            invoiceNumber: row.invoice_number,
            customer: row.customer,
            grand: row.grand,
            paymentStatus: row.payment_status || 'pending',
            paymentRef: row.payment_ref || '',
            deliveryStatus: row.delivery_status || 'pending'
          };
        }
      }

      if (!deliveryData) {
        return res.status(404).json({ error: "Delivery not found" });
      }

      res.json({ success: true, data: deliveryData });
    } catch (e: any) {
      console.error("Delivery fetch error:", e);
      res.status(500).json({ error: "Failed to fetch delivery data" });
    }
  });

  app.post("/api/delivery/update", async (req, res) => {
    const { deliveryId, status, token } = req.body;
    if (!deliveryId || !status || !token) return res.status(400).json({ error: "Missing required fields" });
    
    // Simple secure token verification for public rider access
    if (token !== `sec_${deliveryId}`) {
      return res.status(403).json({ error: "Invalid delivery token" });
    }

    try {
      // 1. Update Firebase public_deliveries
      await db().collection('public_deliveries').doc(String(deliveryId)).set({
        deliveryStatus: status,
        updatedAt: Date.now()
      }, { merge: true });

      // 2. Update local database invoice delivery status
      await query(
        "UPDATE invoices SET delivery_status = $1, updated_at = $2 WHERE id = $3",
        [status, Date.now(), String(deliveryId)]
      );

      // 3. Update Firestore user-specific invoice and activity if invoice exists
      const invCheck = await query("SELECT user_id, invoice_number FROM invoices WHERE id = $1", [deliveryId]);
      if (invCheck.rows.length > 0) {
        const userId = invCheck.rows[0].user_id;
        const invoiceNumber = invCheck.rows[0].invoice_number;
        await db().collection(`users/${userId}/invoices`).doc(String(deliveryId)).set({
          deliveryStatus: status
        }, { merge: true });
        
        const actId = 'act_' + Math.random().toString(36).substring(2, 9);
        await query(
          "INSERT INTO activity (id, user_id, text, type, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [actId, userId, `Delivery status for ${invoiceNumber} updated to: ${status}`, "delivery", new Date().toISOString(), Date.now()]
        );
        await db().collection(`users/${userId}/activity`).doc(actId).set({
          text: `Delivery status for ${invoiceNumber} updated to: ${status}`,
          type: "delivery",
          created_at: new Date().toISOString()
        });
      }

      res.json({ success: true, status });
    } catch (e: any) {
      console.error("Delivery update error:", e);
      res.status(500).json({ error: "Failed to update delivery status" });
    }
  });

  // --- Inventory API ---
  app.get("/api/inventory", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    
    try {
      let items: any[] = [];
      
      // Fetch from Postgres/SQLite
      const result = await query("SELECT * FROM inventory WHERE user_id = $1", [userId]);
      items = [...items, ...result.rows];
      
      // Also try Firestore if possible
      try {
        const snapshot = await db().collection('inventory').where('user_id', '==', userId).get();
        items = [...items, ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
      } catch (fbErr) {
        // Silently skip if Firebase fails
      }
      
      res.json(items);
    } catch (e) {
      console.error("Inventory fetch error:", e);
      return res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  // --- File Upload API ---
  app.post("/api/upload", authenticate, async (req, res) => {
    res.json({ message: "File upload placeholder reached" });
  });

  // --- Category API ---
  app.get("/api/categories", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      const result = await query("SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC", [userId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch categories: " + e.message });
    }
  });

  app.post("/api/categories", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id, name, color, icon, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: "Category name is required" });
    const catId = id || "cat_" + Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    try {
      await query(
        `INSERT INTO categories (id, user_id, name, color, icon, parent_id, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(id) DO UPDATE SET name=$3, color=$4, icon=$5, parent_id=$6, updated_at=$8`,
        [catId, userId, name, color || '#00d4ff', icon || 'fa-tag', parent_id || null, new Date().toISOString(), now]
      );
      res.json({ success: true, category: { id: catId, name, color, icon, parent_id } });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to create category: " + e.message });
    }
  });

  app.put("/api/categories/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { name, color, icon, parent_id } = req.body;
    const now = Date.now();
    try {
      await query(
        "UPDATE categories SET name = $1, color = $2, icon = $3, parent_id = $4, updated_at = $5 WHERE id = $6 AND user_id = $7",
        [name, color || '#00d4ff', icon || 'fa-tag', parent_id || null, now, id, userId]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update category: " + e.message });
    }
  });

  app.delete("/api/categories/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    try {
      await query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete category: " + e.message });
    }
  });

  app.post("/api/categories/merge", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { sourceId, targetId } = req.body;
    if (!sourceId || !targetId) return res.status(400).json({ error: "Source and target categories are required" });
    try {
      // Get category info
      const srcRes = await query("SELECT name FROM categories WHERE id = $1 AND user_id = $2", [sourceId, userId]);
      const tgtRes = await query("SELECT name FROM categories WHERE id = $1 AND user_id = $2", [targetId, userId]);
      if (srcRes.rows.length === 0 || tgtRes.rows.length === 0) {
        return res.status(400).json({ error: "Invalid source or target category" });
      }
      const sourceName = srcRes.rows[0].name;
      const targetName = tgtRes.rows[0].name;
      const now = Date.now();

      // Update inventory items pointing to source category (by ID and text name)
      await query(
        "UPDATE inventory SET category_id = $1, category = $2, updated_at = $3 WHERE category_id = $4 AND user_id = $5",
        [targetId, targetName, now, sourceId, userId]
      );
      await query(
        "UPDATE inventory SET category_id = $1, category = $2, updated_at = $3 WHERE category = $4 AND user_id = $5",
        [targetId, targetName, now, sourceName, userId]
      );

      // Delete the source category
      await query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [sourceId, userId]);

      res.json({ success: true, message: `Merged ${sourceName} into ${targetName}` });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to merge categories: " + e.message });
    }
  });

  // --- Customer API ---
  app.get("/api/customers", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      const result = await query("SELECT * FROM customers WHERE user_id = $1 ORDER BY name ASC", [userId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch customers: " + e.message });
    }
  });

  app.post("/api/customers", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id, name, phone, email, address, balance, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Customer name is required" });
    const custId = id || "cust_" + Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    try {
      await query(
        `INSERT INTO customers (id, user_id, name, phone, email, address, balance, notes, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET name=$3, phone=$4, email=$5, address=$6, balance=$7, notes=$8, updated_at=$10`,
        [custId, userId, name, phone || '', email || '', address || '', parseFloat(balance) || 0, notes || '', new Date().toISOString(), now]
      );
      res.json({ success: true, customer: { id: custId, name, phone, email, address, balance, notes } });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save customer: " + e.message });
    }
  });

  app.delete("/api/customers/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    try {
      await query("DELETE FROM customers WHERE id = $1 AND user_id = $2", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete customer: " + e.message });
    }
  });

  // --- Supplier API ---
  app.get("/api/suppliers", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      const result = await query("SELECT * FROM suppliers WHERE user_id = $1 ORDER BY name ASC", [userId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch suppliers: " + e.message });
    }
  });

  app.post("/api/suppliers", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id, name, phone, email, address, contact_person, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Supplier name is required" });
    const suppId = id || "supp_" + Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    try {
      await query(
        `INSERT INTO suppliers (id, user_id, name, phone, email, address, contact_person, notes, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET name=$3, phone=$4, email=$5, address=$6, contact_person=$7, notes=$8, updated_at=$10`,
        [suppId, userId, name, phone || '', email || '', address || '', contact_person || '', notes || '', new Date().toISOString(), now]
      );
      res.json({ success: true, supplier: { id: suppId, name, phone, email, address, contact_person, notes } });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save supplier: " + e.message });
    }
  });

  app.delete("/api/suppliers/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    try {
      await query("DELETE FROM suppliers WHERE id = $1 AND user_id = $2", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete supplier: " + e.message });
    }
  });

  // --- Expenses API ---
  app.get("/api/expenses", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      const result = await query("SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC", [userId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch expenses: " + e.message });
    }
  });

  app.post("/api/expenses", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id, category, description, amount, date, receipt_url, notes } = req.body;
    if (!description || !amount) return res.status(400).json({ error: "Description and amount are required" });
    const expId = id || "exp_" + Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    try {
      await query(
        `INSERT INTO expenses (id, user_id, category, description, amount, date, receipt_url, notes, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET category=$3, description=$4, amount=$5, date=$6, receipt_url=$7, notes=$8, updated_at=$10`,
        [expId, userId, category || 'General', description, parseFloat(amount) || 0, date || new Date().toISOString().split('T')[0], receipt_url || '', notes || '', new Date().toISOString(), now]
      );
      res.json({ success: true, expense: { id: expId, category, description, amount, date, receipt_url, notes } });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save expense: " + e.message });
    }
  });

  app.delete("/api/expenses/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    try {
      await query("DELETE FROM expenses WHERE id = $1 AND user_id = $2", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete expense: " + e.message });
    }
  });

  // --- Employees API ---
  app.get("/api/employees", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      const result = await query("SELECT * FROM employees WHERE user_id = $1 ORDER BY name ASC", [userId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch employees: " + e.message });
    }
  });

  app.post("/api/employees", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id, name, role, phone, email, salary, hire_date, status, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Employee name is required" });
    const empId = id || "emp_" + Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    try {
      await query(
        `INSERT INTO employees (id, user_id, name, role, phone, email, salary, hire_date, status, notes, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT(id) DO UPDATE SET name=$3, role=$4, phone=$5, email=$6, salary=$7, hire_date=$8, status=$9, notes=$10, updated_at=$12`,
        [empId, userId, name, role || 'employee', phone || '', email || '', parseFloat(salary) || 0, hire_date || '', status || 'active', notes || '', new Date().toISOString(), now]
      );
      res.json({ success: true, employee: { id: empId, name, role, phone, email, salary, hire_date, status, notes } });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save employee: " + e.message });
    }
  });

  app.delete("/api/employees/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    try {
      await query("DELETE FROM employees WHERE id = $1 AND user_id = $2", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete employee: " + e.message });
    }
  });

  // --- Purchases API ---
  app.get("/api/purchases", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      const result = await query("SELECT * FROM purchases WHERE user_id = $1 ORDER BY date DESC", [userId]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch purchases: " + e.message });
    }
  });

  app.post("/api/purchases", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id, supplier_id, supplier_name, items, total, date, status, notes } = req.body;
    const purId = id || "pur_" + Math.random().toString(36).substring(2, 15);
    const now = Date.now();
    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items || []);
    try {
      await query(
        `INSERT INTO purchases (id, user_id, supplier_id, supplier_name, items, total, date, status, notes, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT(id) DO UPDATE SET supplier_id=$3, supplier_name=$4, items=$5, total=$6, date=$7, status=$8, notes=$9, updated_at=$11`,
        [purId, userId, supplier_id || '', supplier_name || '', itemsStr, parseFloat(total) || 0, date || new Date().toISOString().split('T')[0], status || 'pending', notes || '', new Date().toISOString(), now]
      );
      res.json({ success: true, purchase: { id: purId, supplier_id, supplier_name, total, date, status } });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to save purchase order: " + e.message });
    }
  });

  app.delete("/api/purchases/:id", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    try {
      await query("DELETE FROM purchases WHERE id = $1 AND user_id = $2", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to delete purchase order: " + e.message });
    }
  });

  // --- Cloud Sync API ---
  app.post("/api/sync/push", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { 
      parts, invoices, settings: clientSettings, activity, submissions,
      categories, customers, suppliers, expenses, employees, purchases 
    } = req.body;
    const now = Date.now();

    try {
      // 1. Sync Parts (inventory)
      if (parts && Array.isArray(parts)) {
        for (const p of parts) {
          const price = parseFloat(p.priceKsh || p.price) || 0;
          const buyPrice = parseFloat(p.buying_price || p.buyingPrice) || 0;
          const sellPrice = parseFloat(p.selling_price || p.sellingPrice) || 0;
          const minSt = parseInt(p.minStock || p.min_stock) || 0;
          const reorderLvl = parseInt(p.reorderLevel || p.reorder_level) || 0;
          const st = parseInt(p.stock) || 0;
          await query(
            `INSERT INTO inventory (id, user_id, category, category_id, part_num, description, stock, min_stock, reorder_level, price, buying_price, selling_price, barcode, supplier, supplier_id, location, expiry_date, image, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT(id) DO UPDATE SET category=$3, category_id=$4, part_num=$5, description=$6, stock=$7, min_stock=$8, reorder_level=$9, price=$10, buying_price=$11, selling_price=$12, barcode=$13, supplier=$14, supplier_id=$15, location=$16, expiry_date=$17, image=$18, updated_at=$19`,
            [String(p.id), userId, p.category || '', p.category_id || p.categoryId || null, p.partNum || p.part_num || '', p.desc || p.description || '', st, minSt, reorderLvl, price, buyPrice, sellPrice, p.barcode || '', p.supplier || '', p.supplier_id || p.supplierId || '', p.location || '', p.expiry_date || p.expiryDate || '', p.image || null, now]
          );
        }
      }

      // 2. Sync Invoices
      if (invoices && Array.isArray(invoices)) {
        for (const inv of invoices) {
          const itemsStr = typeof inv.items === 'string' ? inv.items : JSON.stringify(inv.items);
          await query(
            `INSERT INTO invoices (id, user_id, invoice_number, date, customer, customer_id, notes, type, items, subtotal, discount_pct, discount_amt, vat, vat_rate, grand, payment_status, payment_ref, paid_at, delivery_status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
             ON CONFLICT(id) DO UPDATE SET invoice_number=$3, date=$4, customer=$5, customer_id=$6, notes=$7, type=$8, items=$9, subtotal=$10, discount_pct=$11, discount_amt=$12, vat=$13, vat_rate=$14, grand=$15, payment_status=$16, payment_ref=$17, paid_at=$18, delivery_status=$19, created_at=$20, updated_at=$21`,
            [String(inv.id), userId, inv.invoiceNumber || inv.invoice_number, inv.date, inv.customer, inv.customer_id || inv.customerId || null, inv.notes || '', inv.type, itemsStr, inv.subtotal, inv.discountPct || inv.discount_pct, inv.discountAmt || inv.discount_amt, inv.vat, inv.vatRate || inv.vat_rate, inv.grand, inv.paymentStatus || inv.payment_status || '', inv.paymentRef || inv.payment_ref || '', inv.paidAt || inv.paid_at || '', inv.deliveryStatus || inv.delivery_status || 'pending', inv.createdAt || inv.created_at, now]
          );
        }
      }

      // 3. Sync Settings
      if (clientSettings && Array.isArray(clientSettings)) {
        for (const s of clientSettings) {
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

      // 5. Sync Freelance Submissions (with strict permissions)
      if (submissions && Array.isArray(submissions)) {
        const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
        const isAdmin = userCheck.rows[0]?.role === 'admin';
        for (const sub of submissions) {
          if (isAdmin) {
            // Admin/Reviewer updates are trusted
            await query(
              `INSERT INTO submissions (id, user_id, task_details, project_description, invoice_number, totals, notes, delivery_info, links, attachments, status, risk_level, risk_summary, reviewer_id, reviewer_name, reviewer_notes, reviewed_at, history, created_at, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
               ON CONFLICT(id) DO UPDATE SET user_id=$2, task_details=$3, project_description=$4, invoice_number=$5, totals=$6, notes=$7, delivery_info=$8, links=$9, attachments=$10, status=$11, risk_level=$12, risk_summary=$13, reviewer_id=$14, reviewer_name=$15, reviewer_notes=$16, reviewed_at=$17, history=$18, updated_at=$20`,
              [String(sub.id), sub.user_id || userId, sub.task_details || '', sub.project_description || '', sub.invoice_number || '', parseFloat(sub.totals) || 0, sub.notes || '', sub.delivery_info || '', sub.links || '', typeof sub.attachments === 'string' ? sub.attachments : JSON.stringify(sub.attachments || []), sub.status || 'Pending', sub.risk_level || 'Low Risk', sub.risk_summary || '', sub.reviewer_id || '', sub.reviewer_name || '', sub.reviewer_notes || '', sub.reviewed_at || '', typeof sub.history === 'string' ? sub.history : JSON.stringify(sub.history || []), sub.created_at || '', now]
            );
          } else {
            // Normal user can only create or update their own submissions.
            const existing = await query("SELECT status, user_id, risk_level, risk_summary, reviewer_id, reviewer_name, reviewer_notes, reviewed_at, history FROM submissions WHERE id = $1", [String(sub.id)]);
            if (existing.rows.length > 0) {
              const ext = existing.rows[0];
              if (ext.user_id === userId) {
                await query(
                  `UPDATE submissions SET task_details=$1, project_description=$2, invoice_number=$3, totals=$4, notes=$5, delivery_info=$6, links=$7, attachments=$8, updated_at=$9 WHERE id=$10`,
                  [sub.task_details || '', sub.project_description || '', sub.invoice_number || '', parseFloat(sub.totals) || 0, sub.notes || '', sub.delivery_info || '', sub.links || '', typeof sub.attachments === 'string' ? sub.attachments : JSON.stringify(sub.attachments || []), now, String(sub.id)]
                );
              }
            } else {
              // Insert brand new submission
              await query(
                `INSERT INTO submissions (id, user_id, task_details, project_description, invoice_number, totals, notes, delivery_info, links, attachments, status, risk_level, risk_summary, history, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Pending', 'Low Risk', '', '[]', $11, $12)`,
                [String(sub.id), userId, sub.task_details || '', sub.project_description || '', sub.invoice_number || '', parseFloat(sub.totals) || 0, sub.notes || '', sub.delivery_info || '', sub.links || '', typeof sub.attachments === 'string' ? sub.attachments : JSON.stringify(sub.attachments || []), sub.created_at || '', now]
              );
            }
          }
        }
      }

      // 6. Sync Categories
      if (categories && Array.isArray(categories)) {
        for (const cat of categories) {
          await query(
            `INSERT INTO categories (id, user_id, name, color, icon, parent_id, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT(id) DO UPDATE SET name=$3, color=$4, icon=$5, parent_id=$6, updated_at=$8`,
            [String(cat.id), userId, cat.name, cat.color || '#00d4ff', cat.icon || 'fa-tag', cat.parent_id || cat.parentId || null, cat.created_at || new Date().toISOString(), now]
          );
        }
      }

      // 7. Sync Customers
      if (customers && Array.isArray(customers)) {
        for (const cust of customers) {
          await query(
            `INSERT INTO customers (id, user_id, name, phone, email, address, balance, notes, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT(id) DO UPDATE SET name=$3, phone=$4, email=$5, address=$6, balance=$7, notes=$8, updated_at=$10`,
            [String(cust.id), userId, cust.name, cust.phone || '', cust.email || '', cust.address || '', parseFloat(cust.balance) || 0, cust.notes || '', cust.created_at || new Date().toISOString(), now]
          );
        }
      }

      // 8. Sync Suppliers
      if (suppliers && Array.isArray(suppliers)) {
        for (const supp of suppliers) {
          await query(
            `INSERT INTO suppliers (id, user_id, name, phone, email, address, contact_person, notes, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT(id) DO UPDATE SET name=$3, phone=$4, email=$5, address=$6, contact_person=$7, notes=$8, updated_at=$10`,
            [String(supp.id), userId, supp.name, supp.phone || '', supp.email || '', supp.address || '', supp.contact_person || supp.contactPerson || '', supp.notes || '', supp.created_at || new Date().toISOString(), now]
          );
        }
      }

      // 9. Sync Expenses
      if (expenses && Array.isArray(expenses)) {
        for (const exp of expenses) {
          await query(
            `INSERT INTO expenses (id, user_id, category, description, amount, date, receipt_url, notes, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT(id) DO UPDATE SET category=$3, description=$4, amount=$5, date=$6, receipt_url=$7, notes=$8, updated_at=$10`,
            [String(exp.id), userId, exp.category || 'General', exp.description, parseFloat(exp.amount) || 0, exp.date || '', exp.receipt_url || exp.receiptUrl || '', exp.notes || '', exp.created_at || new Date().toISOString(), now]
          );
        }
      }

      // 10. Sync Employees
      if (employees && Array.isArray(employees)) {
        for (const emp of employees) {
          await query(
            `INSERT INTO employees (id, user_id, name, role, phone, email, salary, hire_date, status, notes, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT(id) DO UPDATE SET name=$3, role=$4, phone=$5, email=$6, salary=$7, hire_date=$8, status=$9, notes=$10, updated_at=$12`,
            [String(emp.id), userId, emp.name, emp.role || 'employee', emp.phone || '', emp.email || '', parseFloat(emp.salary) || 0, emp.hire_date || emp.hireDate || '', emp.status || 'active', emp.notes || '', emp.created_at || new Date().toISOString(), now]
          );
        }
      }

      // 11. Sync Purchases
      if (purchases && Array.isArray(purchases)) {
        for (const pur of purchases) {
          const itemsStr = typeof pur.items === 'string' ? pur.items : JSON.stringify(pur.items || []);
          await query(
            `INSERT INTO purchases (id, user_id, supplier_id, supplier_name, items, total, date, status, notes, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT(id) DO UPDATE SET supplier_id=$3, supplier_name=$4, items=$5, total=$6, date=$7, status=$8, notes=$9, updated_at=$11`,
            [String(pur.id), userId, pur.supplier_id || pur.supplierId || '', pur.supplier_name || pur.supplierName || '', itemsStr, parseFloat(pur.total) || 0, pur.date || '', pur.status || 'pending', pur.notes || '', pur.created_at || new Date().toISOString(), now]
          );
        }
      }

      res.json({ success: true, timestamp: now });
    } catch (e: any) {
      console.error("Push sync error:", e);
      res.status(500).json({ error: "Failed to push changes to cloud database" });
    }
  });

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

      const categoriesResult = await query("SELECT * FROM categories WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);
      const customersResult = await query("SELECT * FROM customers WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);
      const suppliersResult = await query("SELECT * FROM suppliers WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);
      const expensesResult = await query("SELECT * FROM expenses WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);
      const employeesResult = await query("SELECT * FROM employees WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);
      const purchasesResult = await query("SELECT * FROM purchases WHERE user_id = $1 AND updated_at > $2", [userId, lastSyncTimestamp]);

      res.json({
        uidValidity: {
          parts: 20260608,
          invoices: 20260608,
          settings: 20260608,
          activity: 20260608,
          submissions: 20260608,
          categories: 20260608,
          customers: 20260608,
          suppliers: 20260608,
          expenses: 20260608,
          employees: 20260608,
          purchases: 20260608
        },
        parts: partsResult.rows.map(r => ({
          id: r.id,
          category: r.category,
          categoryId: r.category_id,
          partNum: r.part_num,
          desc: r.description,
          stock: r.stock,
          minStock: r.min_stock,
          reorderLevel: r.reorder_level,
          priceKsh: r.price,
          buyingPrice: r.buying_price,
          sellingPrice: r.selling_price,
          barcode: r.barcode,
          supplier: r.supplier,
          supplierId: r.supplier_id,
          location: r.location,
          expiryDate: r.expiry_date,
          image: r.image
        })),
        invoices: invoicesResult.rows,
        settings: settingsResult.rows,
        activity: activityResult.rows,
        submissions: submissionsResult.rows,
        categories: categoriesResult.rows,
        customers: customersResult.rows,
        suppliers: suppliersResult.rows,
        expenses: expensesResult.rows,
        employees: employeesResult.rows,
        purchases: purchasesResult.rows
      });
    } catch (e: any) {
      console.error("Pull sync error:", e);
      res.status(500).json({ error: "Failed to pull changes from cloud database" });
    }
  });

  app.post("/api/sync/delete", authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { store, id } = req.body;
    if (!store || !id) return res.status(400).json({ error: "Missing store or id" });
    
    try {
      const table = store === 'parts' ? 'inventory' : store;
      // Safeguard table name to prevent SQL injection
      const allowedTables = ['inventory', 'invoices', 'settings', 'activity', 'submissions', 'categories', 'customers', 'suppliers', 'expenses', 'employees', 'purchases'];
      if (!allowedTables.includes(table)) {
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Final catch-all for any missed API routes to return JSON
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found. Check if the backend is correctly deployed.` });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
