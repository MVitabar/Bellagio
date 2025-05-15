import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';

export const useNotifications = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      // Usa la API nativa del navegador para el permiso
      const status = Notification.permission;
      setIsSubscribed(status === 'granted');
      
      // Si prefieres el estado real de OneSignal, descomenta la siguiente línea:
      // const isEnabled = await OneSignal.isPushNotificationsEnabled();
      // setIsSubscribed(isEnabled);

      // Usa la API actualizada de OneSignal para obtener el ID del dispositivo
      try {
        // @ts-ignore - Usar getUserId en lugar de getDeviceId
        const id = await OneSignal.getUserId();
        setUserId(id);
      } catch (error) {
        console.error('Error getting OneSignal user ID:', error);
      }
    };

    checkSubscription();
  }, []);

  const sendNotification = async (data: {
    title: string;
    message: string;
    url?: string;
  }) => {
    try {
      // @ts-ignore
      await OneSignal.sendSelfNotification(
        data.title,
        data.message,
        data.url || window.location.origin,
        '/icon.png'
      );
    } catch (error) {
      // Puedes mostrar un toast si lo deseas
    }
  };

  return {
    isSubscribed,
    userId,
    sendNotification
  };
};