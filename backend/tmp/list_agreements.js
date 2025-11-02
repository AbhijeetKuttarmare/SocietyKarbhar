(async function(){
  try{
    const path = require('path');
    const db = require(path.join(__dirname,'..','src','models'));
    await db.sequelize.authenticate();
    const tenantId = process.argv[2] || '74a5a81f-a214-421c-9f52-362f31516347';
    const ag = await db.Agreement.findAll({where:{tenantId}});
    console.log('agreements for tenant', tenantId, ag.length);
    ag.forEach(a=>{
      console.log(a.id, a.file_url ? 'HAS_URL' : 'NO_URL', a.file_url ? a.file_url.slice(0,80) : '');
    });
    process.exit(0);
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();
