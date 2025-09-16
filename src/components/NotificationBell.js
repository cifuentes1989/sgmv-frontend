import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import AuthContext from '../context/AuthContext';

const NotificationBell = () => {
    const [count, setCount] = useState(0);
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            try {
                const res = await api.get('/solicitudes/notificaciones');
                setCount(res.data.count);
            } catch (error) {
                console.error("Error fetching notifications", error);
            }
        };

        fetchNotifications(); // Llama una vez al cargar
        const interval = setInterval(fetchNotifications, 30000); // Y luego cada 30 segundos

        return () => clearInterval(interval); // Limpia el intervalo al desmontar el componente
    }, [user]);

    return (
        <div style={{ position: 'relative', cursor: 'pointer' }}>
            <span role="img" aria-label="Notificaciones" style={{ fontSize: '1.5rem' }}>🔔</span>
            {count > 0 && (
                <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-10px',
                    background: 'red',
                    color: 'white',
                    borderRadius: '50%',
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                }}>
                    {count}
                </span>
            )}
        </div>
    );
};

export default NotificationBell;