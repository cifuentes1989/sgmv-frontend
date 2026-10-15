/* eslint-disable */
import React, { useState, useEffect } from 'react';
import api from '../../api/axios'; // Asegúrate de que esta ruta apunte a tu archivo axios

const ArchivoDashboard = () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Usuario Archivo' };

    const [solicitudes, setSolicitudes] = useState([]);
    const [archivosUpload, setArchivosUpload] = useState({});
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    const cargarDatos = async () => {
        try {
            // Reutilizamos la misma ruta que ya funciona para el Admin
            const res = await api.get('/admin/solicitudes/todas');
            const dataSegura = Array.isArray(res.data) ? res.data : [];
            
            // Filtramos SOLO las que el archivo necesita ver
            const pendientes = dataSegura.filter(s => s.estado === 'Pendiente de Archivo');
            setSolicitudes(pendientes);
        } catch (error) { 
            console.error('Error cargando datos:', error);
            setSolicitudes([]); 
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleFileSelect = (id, file) => {
        setArchivosUpload(prev => ({ ...prev, [id]: file }));
    };

    const handleSubirEvidencia = async (id) => {
        const file = archivosUpload[id];
        if (!file) return alert("Por favor, selecciona un archivo (PDF o Imagen) primero.");

        const formData = new FormData();
        formData.append('evidencia', file);

        setSubiendoArchivo(true);
        try {
            await api.put(`/solicitudes/archivo/subir-evidencia/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("✅ Evidencia subida. El proceso ha sido cerrado permanentemente.");
            setArchivosUpload(prev => {
                const nuevo = {...prev};
                delete nuevo[id];
                return nuevo;
            });
            cargarDatos(); // Recargar la lista para que desaparezca el vehículo completado
        } catch (error) {
            alert("Error al subir el archivo. Verifica tu conexión.");
        } finally {
            setSubiendoArchivo(false);
        }
    };

    return (
        <main style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#e65100' }}>Módulo de Archivo y Cierre</h2>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>Bienvenido/a, {user.nombre_completo}</span>
                </div>
                <button onClick={handleLogout} style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Salir</button>
            </header>

            <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>Pendientes de Digitalización ({solicitudes.length})</h3>
                    <p style={{ color: '#666' }}>Adjunta las remisiones o facturas para dar por cerrado el mantenimiento.</p>
                </div>

                <div>
                    {solicitudes.length > 0 ? solicitudes.map(s => (
                        <div key={s.id} style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ffe082', paddingBottom: '10px', marginBottom: '10px' }}>
                                <div>
                                    <strong style={{ fontSize: '1.1rem' }}>{s.placa_vehiculo} | ID #{s.id}</strong><br/>
                                    <span style={{ fontSize: '0.85rem', color: '#555' }}>Vehículo: {s.nombre_vehiculo}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#888' }}>Entregado al conductor el:</span><br/>
                                    <strong>{new Date(s.fecha_cierre_proceso || s.hora_salida_taller).toLocaleDateString()}</strong>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '250px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Adjuntar Soporte Físico (PDF/JPG):</label>
                                    <input 
                                        type="file" accept=".pdf, image/*" 
                                        onChange={(e) => handleFileSelect(s.id, e.target.files[0])}
                                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: 'white' }} 
                                    />
                                </div>
                                <button 
                                    onClick={() => handleSubirEvidencia(s.id)}
                                    disabled={subiendoArchivo || !archivosUpload[s.id]}
                                    style={{ 
                                        padding: '10px 20px', backgroundColor: (subiendoArchivo || !archivosUpload[s.id]) ? '#ccc' : '#f57c00', 
                                        color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (subiendoArchivo || !archivosUpload[s.id]) ? 'not-allowed' : 'pointer' 
                                    }}
                                >
                                    {subiendoArchivo && archivosUpload[s.id] ? 'Subiendo...' : '☁️ Subir Documento'}
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                            <p style={{ color: '#888', fontSize: '1.1rem', margin: 0 }}>🎉 ¡Excelente! No hay documentos pendientes por archivar.</p>
                        </div>
                    )}
                </div>
            </article>
        </main>
    );
};

export default ArchivoDashboard;