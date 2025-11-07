require('dotenv').config();
const { sequelize } = require('./models');
const app = require('./app');

const PORT = process.env.PORT || 4001;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Start server *after* DB connection succeeds
    app.listen(PORT, () => {
      console.log(`🚀 Server running and listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
}

start();
