/* Lambda handler for Serverless Framework
   Wraps existing Express app (exports from src/app.js) using serverless-http
   Ensures Sequelize DB connection is authenticated on cold start and reused across invocations.
*/
require('dotenv').config();
const serverless = require('serverless-http');
const app = require('./app');
const { sequelize } = require('./models');

let dbConnected = false;
async function ensureDb() {
  if (dbConnected) return;
  try {
    await sequelize.authenticate();
    dbConnected = true;
    console.log('[lambda] DB connected');
  } catch (e) {
    console.error('[lambda] DB connection failed', e && e.message);
    throw e;
  }
}

const server = serverless(app);

module.exports.handler = async (event, context) => {
  // Ensure DB connection before handling the request. This helps apps that rely on sequelize models.
  await ensureDb();
  // Forward to serverless adapter
  return server(event, context);
};
