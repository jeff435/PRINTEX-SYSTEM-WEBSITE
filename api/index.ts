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
      // Tables
      await pool.query(`
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
      `);

      // Alter columns safely
      const addCol = async (sql: string) => pool.query(sql).catch(() => {});
      await addCol("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';");
      await addCol("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate REAL DEFAULT 0;");
      await addCol("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id TEXT;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at INTEGER DEFAULT 0;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category_id TEXT;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 0;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS buying_price REAL DEFAULT 0;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS selling_price REAL DEFAULT 0;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode TEXT;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier_id TEXT;");
      await addCol("ALTER TABLE inventory ADD COLUMN IF NOT EXISTS expiry_date TEXT;");

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
    const srcRes = await query("SELECT name FROM categories WHERE id = $1 AND user_id = $2", [sourceId, userId]);
    const tgtRes = await query("SELECT name FROM categories WHERE id = $1 AND user_id = $2", [targetId, userId]);
    if (srcRes.rows.length === 0 || tgtRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid source or target category" });
    }
    const sourceName = srcRes.rows[0].name;
    const targetName = tgtRes.rows[0].name;
    const now = Date.now();

    await query(
      "UPDATE inventory SET category_id = $1, category = $2, updated_at = $3 WHERE category_id = $4 AND user_id = $5",
      [targetId, targetName, now, sourceId, userId]
    );
    await query(
      "UPDATE inventory SET category_id = $1, category = $2, updated_at = $3 WHERE category = $4 AND user_id = $5",
      [targetId, targetName, now, sourceName, userId]
    );

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
  const { 
    parts, invoices, settings, activity, submissions,
    categories, customers, suppliers, expenses, employees, purchases 
  } = req.body;
  const now = Date.now();
  console.log(`[Sync Push] user=${userId} parts=${parts?.length || 0} invoices=${invoices?.length || 0} submissions=${submissions?.length || 0}`);

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
          [String(p.id), userId, p.category || "", p.category_id || p.categoryId || null, p.partNum || p.part_num || "", p.desc || p.description || "", st, minSt, reorderLvl, price, buyPrice, sellPrice, p.barcode || "", p.supplier || "", p.supplier_id || p.supplierId || "", p.location || "", p.expiry_date || p.expiryDate || "", p.image || null, now]
        );
      }
    }

    // 2. Sync Invoices
    if (invoices && Array.isArray(invoices)) {
      for (const inv of invoices) {
        const itemsStr = typeof inv.items === "string" ? inv.items : JSON.stringify(inv.items || []);
        await query(
          `INSERT INTO invoices (id, user_id, invoice_number, date, customer, customer_id, notes, type, items, subtotal, discount_pct, discount_amt, vat, vat_rate, grand, payment_status, payment_ref, paid_at, delivery_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           ON CONFLICT(id) DO UPDATE SET invoice_number=$3, date=$4, customer=$5, customer_id=$6, notes=$7, type=$8, items=$9, subtotal=$10, discount_pct=$11, discount_amt=$12, vat=$13, vat_rate=$14, grand=$15, payment_status=$16, payment_ref=$17, paid_at=$18, delivery_status=$19, created_at=$20, updated_at=$21`,
          [String(inv.id), userId, inv.invoiceNumber || inv.invoice_number, inv.date, inv.customer, inv.customer_id || inv.customerId || null, inv.notes || "", inv.type, itemsStr, inv.subtotal, inv.discountPct || inv.discount_pct, inv.discountAmt || inv.discount_amt, inv.vat, inv.vatRate || inv.vat_rate, inv.grand, inv.paymentStatus || inv.payment_status || "", inv.paymentRef || inv.payment_ref || "", inv.paidAt || inv.paid_at || "", inv.deliveryStatus || inv.delivery_status || "pending", inv.createdAt || inv.created_at, now]
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
      parts: partsResult.rows.map((r) => ({
        id: r.id, category: r.category, categoryId: r.category_id, partNum: r.part_num, desc: r.description,
        stock: r.stock, minStock: r.min_stock, reorderLevel: r.reorder_level, priceKsh: r.price,
        buyingPrice: r.buying_price, sellingPrice: r.selling_price, barcode: r.barcode,
        supplier: r.supplier, supplierId: r.supplier_id, location: r.location, expiryDate: r.expiry_date, image: r.image,
      })),
      invoices: invoicesResult.rows.map((r) => ({
        id: r.id, userId: r.user_id, invoiceNumber: r.invoice_number, date: r.date,
        customer: r.customer, customerId: r.customer_id, notes: r.notes, type: r.type, items: r.items,
        subtotal: r.subtotal, discountPct: r.discount_pct, discountAmt: r.discount_amt,
        vat: r.vat, vatRate: r.vat_rate, grand: r.grand,
        paymentStatus: r.payment_status || "pending", paymentRef: r.payment_ref || "",
        paidAt: r.paid_at || "", deliveryStatus: r.delivery_status || "pending",
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
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
    const allowedTables = ['inventory', 'invoices', 'settings', 'activity', 'submissions', 'categories', 'customers', 'suppliers', 'expenses', 'employees', 'purchases'];
    if (!allowedTables.includes(table)) {
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
