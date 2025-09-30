import { useEffect } from 'react';
import { getMessaging, getToken } from "firebase/messaging";
import { initializeApp } from "firebase/app";
import api from '../api/axios';

const PushManager = () => {
    useEffect(() => {
        // Tu configuración de Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyDhAvr-HnGEENWfe7lmHinQsCwHB3XcUGU",
            authDomain: "sgmv-notificaciones.firebaseapp.com",
            projectId: "sgmv-notificaciones",
            storageBucket: "sgmv-notificaciones.appspot.com", // Corregido para usar el dominio correcto
            messagingSenderId: "362766658429",
            appId: "1:362766658429:web:e3300a9ef4e331b047ba14"
        };
        
        const app = initializeApp(firebaseConfig);
        const messaging = getMessaging(app);

        const requestPermission = async () => {
            try {
                // 1. Pide permiso al usuario
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('Permiso de notificación concedido.');
                    
                    // 2. Obtiene el token del dispositivo usando tu VAPID key
                    const currentToken = await getToken(messaging, {
                        vapidKey: 'BBjmS56dU9Tl6CKlFjU-eVc1aF6CWqwjJKCRyA2nNUsOCyAf3WEP6cVL4gp0I3kukXGuCFV0G_qLyCUom0nNZdM'
                    });

                    if (currentToken) {
                        console.log('Token del dispositivo:', currentToken);
                        // 3. Envía el token al backend para guardarlo
                        await api.post('/notifications/subscribe', { subscription: { token: currentToken } });
                    } else {
                        console.log('No se pudo obtener el token de registro. Asegúrate de que el archivo firebase-messaging-sw.js esté en la carpeta public.');
                    }
                } else {
                    console.log('No se concedió el permiso para notificaciones.');
                }
            } catch (error) {
                console.error('Error al solicitar permiso o token:', error);
            }
        };
        
        requestPermission();

    }, []);

    return null; // Este componente no renderiza nada visual
};

export default PushManager;