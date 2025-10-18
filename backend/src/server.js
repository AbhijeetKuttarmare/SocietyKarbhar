// ensure .env is loaded before models initialize
require('dotenv').config();
const { sequelize } = require('./models');
const app = require('./app');

const PORT = process.env.PORT || 4001;

async function start(){
  try{
    await sequelize.authenticate();
    console.log('Database connected');
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
  }catch(err){
    console.error(err);
    process.exit(1);
  }
}

if(require.main === module){
  start();
}
