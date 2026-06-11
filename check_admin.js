
const Database = require('better-sqlite3');
const db = new Database('printex.db');
const user = db.prepare("SELECT * FROM users WHERE email = ?").get('printexengineers@gmail.com');
console.log('Admin user:', user);
