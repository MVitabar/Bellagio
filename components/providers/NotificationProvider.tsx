import { useEffect, useState } from 'react';
import { initializeOneSignal } from '@/lib/onesignal';

export const NotificationProvider = ({ 
  children 
}: { 
  children: React.ReactNode 
}) => {
  const [initializationError, setInitializationError] = useState<Error | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeOneSignal();
        console.log('OneSignal initialized successfully');
      } catch (error) {
        console.error('Failed to initialize OneSignal:', error);
        setInitializationError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    initialize();
  }, []);

  // Puedes usar initializationError para mostrar un mensaje al usuario si lo deseas
  // Por ahora, solo lo registramos en la consola

  return <>{children}</>;
};