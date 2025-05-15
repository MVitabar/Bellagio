export interface NotificationPreferences {
  // Tipos de Notificação
  newOrders: boolean;
  orderStatusUpdates: boolean;
  lowInventoryAlerts: boolean;
  dailyReports: boolean;
  customerFeedback: boolean;
  systemUpdates: boolean;
  tableReservations: boolean;
  staffMessages: boolean;
  soundAlerts: boolean;
  
  // Métodos de Entrega
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export type BooleanNotificationPreferenceKey = keyof NotificationPreferences;

export interface NotificationSettings {
  enabled: boolean;
  preferences: NotificationPreferences;
  deviceToken?: string;
  lastUpdated?: Date;
}
