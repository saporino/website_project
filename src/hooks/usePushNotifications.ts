import { useState, useEffect } from 'react';

export type NotifPermission = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotifPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    setSupported(isSupported);
    if (isSupported) setPermission(Notification.permission as NotifPermission);
  }, []);

  async function requestPermission(): Promise<boolean> {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result === 'granted';
  }

  function sendNotification(title: string, options?: NotificationOptions & { onClick?: () => void }) {
    if (!supported || permission !== 'granted') return;
    navigator.serviceWorker.ready
      .then(registration => {
        registration.showNotification(title, {
          icon: '/icons/pwa-192x192.png',
          badge: '/icons/pwa-192x192.png',
          vibrate: [200, 100, 200],
          ...options,
        });
      })
      .catch(() => {
        const notif = new Notification(title, { icon: '/icons/pwa-192x192.png', ...options });
        if (options?.onClick) notif.onclick = options.onClick;
      });
  }

  return { permission, supported, requestPermission, sendNotification };
}
