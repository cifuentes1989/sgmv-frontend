import React, { useState, useEffect } from 'react';
import NuevaSolicitudForm from './NuevaSolicitudForm';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';

const ConductorDashboard = () => {
  // 1. LÓGICA DE USUARIO Y SEDE
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Conductor', sede_id: null };
  const nombreUsuario = user.nombre_completo || user.nombre || 'Conductor';
  const nombreSede = user.sede_id === 1 ? 'Florencia' : user.sede_id === 2 ? 'Popayán' : 'General';

  // 2. ESTADOS
  const [solicitudes, setSolicitudes] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [observacionesInputs, setObservacionesInputs] = useState({}); 
  const sigCanvases = {}; // Referencias para las firmas

  // 3. CARGA DE DATOS (Ruta original restaurada)
  const cargarDatos = async () => {
    try {
      const res = await api.get('/solicitudes/conductor');
      setSolicitudes(res.data);
    } catch (error) {
      console.error("Error cargando solicitudes del conductor", error);
      alert("Error al cargar el historial de solicitudes. Verifique su conexión.");
    }
  };

  useEffect(() => { cargarDatos(); }, []);
  
  // 4. MANEJO DE LA CONFIRMACIÓN DE ENTREGA (Lógica original intacta)
  const handleSatisfaccion = async (id) => {
    if (sigCanvases[id].isEmpty()) {
      alert("Por favor, firme para confirmar la recepción del vehículo.");
      return;
    }

    const observacionTexto = observacionesInputs[id] || '';
    const firma_conductor_satisfaccion = sigCanvases[id].toDataURL();

    try {
        await api.put(`/solicitudes/satisfaccion/${id}`, { 
            firma_conductor_satisfaccion,
            observaciones_entrega_conductor: observacionTexto 
        });
        
        setObservacionesInputs(prev => ({ ...prev, [id]: '' }));
        cargarDatos();
        alert("Entrega confirmada correctamente. El proceso ha pasado a cierre administrativo.");
    } catch(error) {
        console.error("Error al confirmar satisfacción", error);
        alert("No se pudo registrar la confirmación.");
    }
  };

  const handleObservacionChange = (id, texto) => {
    setObservacionesInputs(prev => ({ ...prev, [id]: texto }));
  };

  // NUEVO: Función para cerrar sesión
  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
  };

  // NUEVO: Función de colores
  const getStatusColor = (estado) => {
      const status = estado?.toLowerCase() || '';
      if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100' };
      if (status.includes('taller') || status.includes('aprobado')) return { bg: '#e3f2fd', text: '#1565c0' };
      if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828' };
      if (status.includes('cierre') || status.includes('terminado') || status.includes('listo')) return { bg: '#e8f5e9', text: '#2e7d32' };
      return { bg: '#eeeeee', text: '#424242' };
  };

  return (
    // DISEÑO MOBILE-FIRST APLICADO
    <main style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* CABECERA RESPONSIVA */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#333' }}>Bienvenido, {nombreUsuario}</h2>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Panel de Conductor | Sede: {nombreSede}</span>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Salir
          </button>
      </header>
      
      {/* BOTÓN GIGANTE PARA NUEVA SOLICITUD */}
      <button 
        onClick={() => setMostrarFormulario(!mostrarFormulario)} 
        style={{ 
            width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', 
            backgroundColor: mostrarFormulario ? '#9e9e9e' : '#0288d1', 
            color: 'white', border: 'none', borderRadius: '12px', 
            boxShadow: '0 4px 6px rgba(2, 136, 209, 0.3)', marginBottom: '25px', cursor: 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px'
        }}
      >
        <span style={{ fontSize: '1.4rem' }}>{mostrarFormulario ? '➖' : '➕'}</span> 
        {mostrarFormulario ? 'Ocultar Formulario' : 'Crear Nueva Solicitud'}
      </button>

      {/* RENDERIZADO DEL FORMULARIO ORIGINAL (Si está activo) */}
      {mostrarFormulario && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <NuevaSolicitudForm onSolicitudCreada={() => { setMostrarFormulario(false); cargarDatos(); }} />
        </div>
      )}
      
      {/* HISTORIAL CON DISEÑO DE TARJETAS MÓVILES */}
      <div>
          <h3 style={{ fontSize: '1.1rem', color: '#555', marginBottom: '15px', marginLeft: '5px' }}>Historial de Mis Solicitudes</h3>
          
          {solicitudes.length > 0 ? solicitudes.map(s => {
              const colores = getStatusColor(s.estado);
              return (
                  <div key={s.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `5px solid ${colores.text}` }}>
                      
                      {/* ENCABEZADO DE LA TARJETA */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '1.1rem', color: '#222' }}>
                              {s.nombre_vehiculo} ({s.placa_vehiculo})
                          </strong>
                          <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {s.estado}
                          </span>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>
                          <strong>ID #{s.id}</strong> • {new Date(s.fecha_creacion).toLocaleDateString('es-CO')}
                      </p>

                      {/* VISUALIZACIÓN RÁPIDA DE RECHAZO */}
                      {s.motivo_rechazo && (
                        <div style={{marginTop: '1rem', padding: '1rem', backgroundColor: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', color: '#b71c1c', fontSize: '0.9rem'}}>
                          <strong>⛔ Rechazada:</strong> {s.motivo_rechazo}
                        </div>
                      )}
                      
                      {/* TRAZABILIDAD (OCULTA POR DEFECTO) */}
                      <details style={{ outline: 'none', marginTop: '10px' }}>
                          <summary style={{ cursor: 'pointer', color: '#0288d1', fontSize: '0.9rem', fontWeight: '600', padding: '5px 0' }}>
                              Ver Trazabilidad Completa
                          </summary>
                          <div style={{ padding: '12px', marginTop: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '0.85rem', color: '#444' }}>
                              <p><strong>1️⃣ Solicitud Inicial:</strong> {s.necesidad_reportada}</p>
                              {s.diagnostico_taller && (
                                  <p style={{marginTop: '8px'}}><strong>2️⃣ Diagnóstico Taller:</strong> {s.diagnostico_taller} <br/><small>(Técnico: {s.nombre_tecnico})</small></p>
                              )}
                              {s.fecha_aprobacion_rechazo && (
                                  <p style={{marginTop: '8px'}}><strong>3️⃣ Decisión Coordinación:</strong> {s.motivo_rechazo ? 'Rechazado' : 'Aprobado'} <br/><small>(Coord: {s.nombre_coordinador})</small></p>
                              )}
                              {s.trabajos_realizados && (
                                  <p style={{marginTop: '8px'}}><strong>4️⃣ Reparación Realizada:</strong> {s.trabajos_realizados} <br/><small>Repuestos: {s.repuestos_utilizados || 'Ninguno'}</small></p>
                              )}
                              {s.fecha_cierre_proceso && (
                                  <p style={{marginTop: '8px'}}><strong>5️⃣ Cierre del Proceso:</strong> {new Date(s.fecha_cierre_proceso).toLocaleDateString('es-CO')} <br/><small>Obs: {s.observaciones_entrega_conductor || 'Ninguna'}</small></p>
                              )}
                          </div>
                      </details>

                      {/* SECCIÓN DE CONFIRMACIÓN DE ENTREGA (FIRMA) */}
                      {s.estado === 'Listo para Entrega' && (
                        <div style={{ marginTop: '15px', borderTop: '2px dashed #4caf50', paddingTop: '15px' }}>
                          <h5 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>✅ Confirmar Recepción del Vehículo</h5>
                          <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 10px 0' }}>Por favor revise el vehículo y deje sus observaciones antes de firmar.</p>
                          
                          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Sus Observaciones:</label>
                          <textarea 
                            rows="2" 
                            placeholder="Ej: Recibo a satisfacción, vehículo limpio..."
                            value={observacionesInputs[s.id] || ''}
                            onChange={(e) => handleObservacionChange(s.id, e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />

                          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Firma Digital:</label>
                          <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                            <SignatureCanvas 
                                ref={ref => { sigCanvases[s.id] = ref; }} 
                                canvasProps={{width: 300, height: 150, className: 'sigCanvas'}} 
                            />
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => sigCanvases[s.id].clear()} style={{ flex: 1, padding: '12px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Borrar</button>
                              <button onClick={() => handleSatisfaccion(s.id)} style={{ flex: 2, padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Confirmar y Enviar</button>
                          </div>
                        </div>
                      )}

                  </div>
              )
          }) : (
              <div style={{ textAlign: 'center', padding: '30px', backgroundColor: 'white', borderRadius: '12px', color: '#888' }}>
                  <p style={{ fontSize: '1.1rem' }}>No tienes solicitudes registradas en el historial.</p>
              </div>
          )}
      </div>
    </main>
  );
};

export default ConductorDashboard;