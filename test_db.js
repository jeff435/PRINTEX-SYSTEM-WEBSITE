import Database from 'better-sqlite3';
const db = new Database('printex.db');
try {
  const count = db.prepare('SELECT count(*) as count FROM inventory').get().count;
  console.log('COUNT:', count);
} catch (e) {
  console.error(e);
}
