// Shared runtime config for the mobile app network settings.
// Update these values to match your dev machine's LAN IP and backend port.
// When developing on Android emulators use 10.0.2.2 to reach the host machine.
// Change this back to your LAN IP when testing on a physical device.
export const DEFAULT_HOST = '192.168.1.4';
export const DEFAULT_PORT = 4001;

// Helper to build a default base URL
export function defaultBaseUrl() {
  return `http://${DEFAULT_HOST}:${DEFAULT_PORT}`;
}

// Allow importing a single default export if desired
export default { DEFAULT_HOST, DEFAULT_PORT, defaultBaseUrl };
