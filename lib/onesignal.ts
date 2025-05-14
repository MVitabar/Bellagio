import OneSignal from 'react-onesignal';

export const initializeOneSignal = async () => {
  try {
    await OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: false,
        prenotify: true,
        showCredit: false,
        text: {
          'tip.state.unsubscribed': 'Suscríbete a las notificaciones',
          'tip.state.subscribed': 'Estás suscrito a las notificaciones',
          'tip.state.blocked': 'Has bloqueado las notificaciones',
          'message.prenotify': 'Haz clic para suscribirte a las notificaciones',
          'message.action.subscribed': '¡Gracias por suscribirte!',
          'message.action.resubscribed': 'Has vuelto a suscribirte',
          'message.action.unsubscribed': 'No recibirás más notificaciones',
          'dialog.main.title': 'Gestionar notificaciones',
          'dialog.main.button.subscribe': 'Suscribirse',
          'dialog.main.button.unsubscribe': 'Darse de baja',
          'dialog.blocked.title': 'Desbloquea las notificaciones',
          'dialog.blocked.message': 'Sigue las instrucciones para habilitar notificaciones',
          'message.action.subscribing': ''
        }
      },
    });

    // Solicita el permiso push al usuario (prompt nativo)
    OneSignal.Slidedown.promptPush();
  } catch (error) {
    console.error('Error initializing OneSignal:', error);
  }
};