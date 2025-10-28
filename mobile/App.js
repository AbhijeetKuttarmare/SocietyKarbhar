// Re-export the TypeScript App entry so packagers that look for App.js still work.
// Keep this file minimal and delegate to the TypeScript entrypoint.
module.exports = require('./App.tsx');
