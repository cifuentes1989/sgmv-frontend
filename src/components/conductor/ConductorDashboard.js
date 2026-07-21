import React, { useState, useEffect } from 'react';
import api from '../../api/axios'; // Verifica que esta ruta coincida con tu estructura

const ConductorDashboard = () => {
    // Estados originales
    const [solicitudes, setSolicitudes] = useState([]);
    const [usuario, setUsuario] = useState({});
    
    // --- NUEVOS ESTADOS PARA EL FORMULARIO ---
    const [vehiculos, setVehiculos] = useState([]);
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const [nuevaSolicitud, setNuevaSolicitud] = useState({
        vehiculo_id: '',
        necesidad_reportada: ''
    });
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        // --- 1. SOLUCIÓN AL BUG DEL NOMBRE ---
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUsuario(JSON.parse(storedUser));
        }

        // --- 2. CARGAR SOLICITUDES ---
        const cargarSolicitudes = async () => {
            try {
                const res = await api.get('/conductor/solicitudes'); 
                setSolicitudes(res.data);
            } catch (error) {
                console.error("Error al cargar solicitudes", error);
            }
        };

        // --- 3. NUEVO: CARGAR VEHÍCULOS PARA EL SELECT ---
        const cargarVehiculos = async () => {
            try {
                const res = await api.get('/vehiculos'); 
                setVehiculos(res.data);
            } catch (error) {
                console.error("Error al cargar vehículos", error);
            }
        };

        cargarSolicitudes();
        cargarVehiculos();
    }, []);

    // Función para cerrar sesión
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    // --- NUEVO: FUNCIÓN PARA ENVIAR LA SOLICITUD ---
    const handleCrearSolicitud = async (e) => {
        e.preventDefault();
        
        if (!nuevaSolicitud.vehiculo_id || !nuevaSolicitud.necesidad_reportada) {
            return alert("Por favor, selecciona un vehículo y describe la necesidad.");
        }

        setCargando(true);
        try {
            await api.post('/conductor/solicitudes', nuevaSolicitud);
            alert("✅ Solicitud creada con éxito.");
            
            // Recargar la lista y cerrar el modal
            const res = await api.get('/conductor/solicitudes'); 
            setSolicitudes(res.data);
            setMostrarFormulario(false);
            setNuevaSolicitud({ vehiculo_id: '', necesidad_reportada: '' }); // Limpiar formulario
            
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.response?.data?.msg || "No se pudo crear la solicitud"}`);
        } finally {
            setCargando(false);
        }
    };

    // --- FUNCIÓN PARA DARLE COLOR A LAS ETIQUETAS DE ESTADO ---
    const getStatusColor = (estado) => {
        const status = estado?.toLowerCase() || '';
        if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100' }; // Naranja
        if (status.includes('taller') || status.includes('aprobado')) return { bg: '#e3f2fd', text: '#1565c0' }; // Azul
        if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828' }; // Rojo
        if (status.includes('cierre') || status.includes('terminado')) return { bg: '#e8f5e9', text: '#2e7d32' }; // Verde
        return { bg: '#eeeeee', text: '#424242' }; // Gris por defecto
    };

    return (
        <main style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
            
            {/* --- CABECERA RESPONSIVA --- */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#333' }}>
                        Bienvenido, {usuario.nombre_completo || usuario.nombre || 'Conductor'}
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>Panel de Conductor | Sede: {usuario.nombre_sede || 'General'}</span>
                </div>
                <button 
                    onClick={handleLogout} 
                    style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Salir
                </button>
            </header>

            {/* --- BOTÓN GIGANTE DE ACCIÓN (Abre el Modal) --- */}
            <button 
                onClick={() => setMostrarFormulario(true)}
                style={{ 
                    width: '100%', 
                    padding: '18px', 
                    fontSize: '1.1rem', 
                    fontWeight: 'bold', 
                    backgroundColor: '#0288d1', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '12px', 
                    boxShadow: '0 4px 6px rgba(2, 136, 209, 0.3)',
                    marginBottom: '25px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}
            >
                <span style={{ fontSize: '1.4rem' }}>➕</span> Crear Nueva Solicitud
            </button>

            {/* --- HISTORIAL DE SOLICITUDES --- */}
            <div>
                <h3 style={{ fontSize: '1.1rem', color: '#555', marginBottom: '15px', marginLeft: '5px' }}>Historial de Mis Solicitudes</h3>
                
                {solicitudes.length > 0 ? solicitudes.map(s => {
                    const colores = getStatusColor(s.estado);
                    return (
                        <div key={s.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `5px solid ${colores.text}` }}>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                <strong style={{ fontSize: '1.1rem', color: '#222' }}>
                                    {s.nombre_vehiculo || 'Vehículo'} ({s.placa_vehiculo || s.placa || 'Sin Placa'})
                                </strong>
                                
                                <span style={{ 
                                    backgroundColor: colores.bg, 
                                    color: colores.text, 
                                    padding: '6px 12px', 
                                    borderRadius: '20px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {s.estado}
                                </span>
                            </div>

                            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>
                                <strong>ID #{s.id}</strong> • {new Date(s.fecha_creacion).toLocaleDateString('es-CO')}
                            </p>
                            
                            <details style={{ outline: 'none' }}>
                                <summary style={{ cursor: 'pointer', color: '#0288d1', fontSize: '0.9rem', fontWeight: '600', padding: '5px 0' }}>
                                    Ver Trazabilidad Completa
                                </summary>
                                <div style={{ padding: '12px', marginTop: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '0.85rem', color: '#444' }}>
                                    <p style={{ margin: '0 0 8px 0' }}><strong>📝 Necesidad:</strong> {s.necesidad_reportada}</p>
                                    {s.diagnostico_taller && <p style={{ margin: '0 0 8px 0' }}><strong>🔧 Diagnóstico:</strong> {s.diagnostico_taller}</p>}
                                    {s.trabajos_realizados && <p style={{ margin: '0' }}><strong>✅ Trabajo:</strong> {s.trabajos_realizados}</p>}
                                </div>
                            </details>

                        </div>
                    )
                }) : (
                    <div style={{ textAlign: 'center', padding: '30px', backgroundColor: 'white', borderRadius: '12px', color: '#888' }}>
                        <p style={{ fontSize: '1.1rem' }}>No tienes solicitudes registradas en este momento.</p>
                    </div>
                )}
            </div>

            {/* --- MODAL FORMULARIO DE NUEVA SOLICITUD (Diseño Móvil) --- */}
            {mostrarFormulario && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white', width: '100%', maxWidth: '600px',
                        borderTopLeftRadius: '25px', borderTopRightRadius: '25px',
                        padding: '25px', boxSizing: 'border-box',
                        boxShadow: '0 -4px 15px rgba(0,0,0,0.2)',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#333' }}>Nueva Solicitud</h3>
                            <button 
                                onClick={() => setMostrarFormulario(false)}
                                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#888', cursor: 'pointer' }}
                            >
                                ✖
                            </button>
                        </div>

                        <form onSubmit={handleCrearSolicitud}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>Vehículo:</label>
                                <select 
                                    value={nuevaSolicitud.vehiculo_id}
                                    onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, vehiculo_id: e.target.value})}
                                    style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '1rem', backgroundColor: '#f9f9f9' }}
                                    required
                                >
                                    <option value="" disabled>Seleccione el vehículo...</option>
                                    {vehiculos.map(v => (
                                        <option key={v.id} value={v.id}>{v.nombre} - {v.placa}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>¿Qué sucede? (Necesidad):</label>
                                <textarea 
                                    value={nuevaSolicitud.necesidad_reportada}
                                    onChange={(e) => setNuevaSolicitud({...nuevaSolicitud, necesidad_reportada: e.target.value})}
                                    placeholder="Ej: Llanta pinchada, ruido en el motor..."
                                    style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '1rem', minHeight: '120px', backgroundColor: '#f9f9f9', fontFamily: 'inherit' }}
                                    required
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={cargando}
                                style={{ 
                                    width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold',
                                    backgroundColor: cargando ? '#9e9e9e' : '#2e7d32', color: 'white',
                                    border: 'none', borderRadius: '12px', cursor: cargando ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {cargando ? 'Enviando...' : 'Enviar Solicitud'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Pequeña animación CSS para que el modal suba suavemente como en las apps nativas */}
            <style>{`
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>

        </main>
    );
};

export default ConductorDashboard;