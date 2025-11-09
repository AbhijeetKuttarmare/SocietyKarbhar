(async function(){
  try{
    const path = require('path');
    const db = require(path.join(__dirname,'..','src','models'));
    console.log('DB models loaded. Searching buildings...');
    const wings = await db.Building.findAll({ include: [{ model: db.Flat, required:false, include: [{ model: db.User, as:'owner', required:false }, { model: db.Agreement, required:false }] }] , limit: 20});
    console.log('Found wings:', wings.length);
    for(const w of wings){
      const wplain = w.get ? w.get({ plain:true }) : w;
      console.log('Wing', wplain.id, wplain.name, 'flats:', (wplain.Flats||[]).length);
      for(const f of (wplain.Flats||[])){
        console.log('  Flat', f.id, f.flat_no, 'owner:', f.owner ? (f.owner.name||f.owner.phone) : null, 'agreements:', (f.Agreements||[]).length);
      }
    }
    process.exit(0);
  }catch(e){
    console.error('inspect failed', e && e.stack ? e.stack : e);
    process.exit(2);
  }
})();
