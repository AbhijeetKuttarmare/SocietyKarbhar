// Expo app config that injects runtime 'extra' values.
// This file sets extra.API_BASE_URL which is read by the mobile api modules.
// You can override the default by setting the environment variable API_BASE_URL
// before starting Expo, e.g. (Windows cmd):
//   set API_BASE_URL=http://192.168.1.8:4001
//   npx expo start --clear

const fs = require('fs');

// Try to reuse existing app.json if present so we don't clobber other settings
let base = {};
try {
  base = require('./app.json');
} catch (e) {
  base = { expo: {} };
}

const DEFAULT_API = process.env.API_BASE_URL || 'http://192.168.1.12:4001';

module.exports = () => {
  const expo = Object.assign({}, base.expo || {});
  expo.extra = Object.assign({}, expo.extra || {}, { API_BASE_URL: DEFAULT_API });
  return { expo };
};
