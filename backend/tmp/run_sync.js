const path = require('path');
// ensure dotenv loads like server does
require('dotenv').config();
const { sequelize } = require(path.join(__dirname, '..', 'src', 'models'));

(async ()=>{
  try{
    await sequelize.sync({ alter: true });
    console.log('SYNC_OK');
    process.exit(0);
  }catch(e){
    console.error('SYNC_ERR', e && (e.stack || e));
    process.exit(1);
  }
})();
