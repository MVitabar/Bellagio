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

      // Usa la API clásica de OneSignal para obtener el ID del usuario (Player ID)
      // @ts-ignore
      const id = await OneSignal.getUserId();
      setUserId(id);
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