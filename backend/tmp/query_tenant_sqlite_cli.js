const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, '..', 'tmp', 'dev.sqlite');
const phoneArg = process.argv[2] || '';
const idArg = process.argv[3] || '';

function toPlain(row) {
  if (!row) return null;
  const plain = {};
  Object.keys(row).forEach((k) => (plain[k] = row[k]));
  return plain;
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('failed to open sqlite db', dbPath, err && err.message);
    process.exit(2);
  }
});

(async () => {
  try {
    const get = (sql, params) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
      });
    const all = (sql, params) =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
      });

    let user = null;
    if (idArg) {
      user = await get('SELECT * FROM users WHERE id = ? LIMIT 1', [idArg]);
    }
    if (!user && phoneArg) {
      const phoneClean = String(phoneArg).replace(/\D/g, '');
      user = await get('SELECT * FROM users WHERE phone = ? LIMIT 1', [phoneClean]);
    }

    if (!user) {
      console.log(JSON.stringify({ error: 'user_not_found', phone: phoneArg, id: idArg }, null, 2));
      db.close();
      process.exit(0);
    }

    const tenant = toPlain(user);
    const agreements = await all('SELECT * FROM agreements WHERE tenantId = ? ORDER BY createdAt DESC', [tenant.id]);
    const detailed = [];
    for (const a of agreements) {
      const aPlain = toPlain(a);
      let flat = null;
      if (aPlain.flatId) {
        flat = await get('SELECT * FROM flats WHERE id = ? LIMIT 1', [aPlain.flatId]);
      }
      const flatPlain = toPlain(flat);
      let owner = null;
      if (aPlain.ownerId) {
        owner = await get('SELECT * FROM users WHERE id = ? LIMIT 1', [aPlain.ownerId]);
      } else if (flatPlain && flatPlain.ownerId) {
        owner = await get('SELECT * FROM users WHERE id = ? LIMIT 1', [flatPlain.ownerId]);
      }
      const ownerPlain = toPlain(owner);
      detailed.push({ agreement: aPlain, flat: flatPlain || null, owner: ownerPlain || null });
    }

    console.log(JSON.stringify({ tenant, agreements: detailed }, null, 2));
    db.close();
    process.exit(0);
  } catch (e) {
    console.error('query failed', e && (e.stack || e.message || e));
    db.close();
    process.exit(2);
  }
})();
