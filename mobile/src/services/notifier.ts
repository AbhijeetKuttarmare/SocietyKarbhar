type Notification = {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
};

let _handler: ((n: Notification | null) => void) | null = null;

export function setNotificationHandler(fn: (n: Notification | null) => void) {
  _handler = fn;
}

export function clearNotificationHandler() {
  _handler = null;
}

export function notify(n: Notification) {
  try {
    if (_handler) _handler(n);
  } catch (e) {}
}

export default { setNotificationHandler, clearNotificationHandler, notify };
