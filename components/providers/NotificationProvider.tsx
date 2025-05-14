import { useEffect } from 'react';
import { initializeOneSignal } from '@/lib/onesignal';

export const NotificationProvider = ({ 
  children 
}: { 
  children: React.ReactNode 
}) => {
  useEffect(() => {
    initializeOneSignal();
  }, []);

  return <>{children}</>;
};