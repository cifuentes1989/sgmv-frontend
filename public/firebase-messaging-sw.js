// Este archivo debe estar en la carpeta 'public'

// Carga los scripts de Firebase necesarios para el Service Worker
self.importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
self.importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDhAvr-HnGEENWfe7lmHinQsCwHB3XcUGU",
  authDomain: "sgmv-notificaciones.firebaseapp.com",
  projectId: "sgmv-notificaciones",
  storageBucket: "sgmv-notificaciones.appspot.com",
  messagingSenderId: "362766658429",
  appId: "1:362766658429:web:e3300a9ef4e331b047ba14"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Este código maneja las notificaciones cuando la aplicación está en segundo plano
messaging.onBackgroundMessage(function(payload) {
  console.log("Mensaje recibido en segundo plano: ", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});