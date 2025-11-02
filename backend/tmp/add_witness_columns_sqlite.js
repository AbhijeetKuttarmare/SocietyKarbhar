const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(__dirname,'..','tmp','dev.sqlite');
const db = new sqlite3.Database(dbPath);

function colExists(cb){
  db.get("PRAGMA table_info('agreements')", (err,row)=>{
    if(err) return cb(err);
    // we will query table_info separately
    db.all("PRAGMA table_info('agreements')", (err,rows)=>{
      if(err) return cb(err);
      const names = rows.map(r=>r.name);
      cb(null, names.includes('witness1'), names.includes('witness2'));
    });
  });
}

colExists((err, has1, has2)=>{
  if(err){console.error(err); process.exit(1);} 
  const ops = [];
  if(!has1){ ops.push("ALTER TABLE agreements ADD COLUMN witness1 VARCHAR;"); }
  if(!has2){ ops.push("ALTER TABLE agreements ADD COLUMN witness2 VARCHAR;"); }
  if(ops.length===0){ console.log('Columns already exist'); process.exit(0); }
  db.serialize(()=>{
    ops.forEach(sql=>{
      console.log('running:', sql);
      db.run(sql,(e)=>{ if(e) console.error('error running',sql,e); else console.log('ok'); });
    });
  });
  db.close(()=>process.exit(0));
});
