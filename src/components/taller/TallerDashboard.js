import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';

const TallerDashboard = () => {
  // 1. LÓGICA DE USUARIO Y SEDE
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Técnico', sede_id: null };
  const nombreUsuario = user.nombre_completo || user.nombre || 'Técnico';
  const nombreSede = user.sede_id === 1 ? 'Florencia' : user.sede_id === 2 ? 'Popayán' : 'General';

  // 2. ESTADOS
  const [pendientes, setPendientes] = useState([]);
  const [enReparacion, setEnReparacion] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [mensaje, setMensaje] = useState('');
  
  // NUEVO: ESTADO PARA EL BUSCADOR
  const [busqueda, setBusqueda] = useState('');

  const [diagnosticoAbiertoId, setDiagnosticoAbiertoId] = useState(null);
  const [diagnosticoData, setDiagnosticoData] = useState({ texto: '', hora: '' });
  const diagSigCanvas = useRef({});
  
  const [finalizacionAbiertaId, setFinalizacionAbiertaId] = useState(null);
  const [finalizacionData, setFinalizacionData] = useState({ trabajos_realizados: '', repuestos_utilizados: '', observaciones_taller: '', hora_salida_taller: '' });
  const finalSigCanvas = useRef({});

  // 3. CARGA DE DATOS
  const cargarDatos = async () => {
    try {
      setMensaje('Cargando...');
      const resPendientes = await api.get('/solicitudes/taller/pendientes');
      const resEnReparacion = await api.get('/solicitudes/taller/en-reparacion');
      const resHistorial = await api.get('/solicitudes/taller/historial');
      
      setPendientes(resPendientes.data);
      setEnReparacion(resEnReparacion.data);
      setHistorial(resHistorial.data);
      setMensaje('');
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setMensaje('No se pudieron cargar los datos del taller.');
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
  };

  const agregarTextoRapido = (tipo, texto) => {
      if (tipo === 'diagnostico') {
          setDiagnosticoData(prev => ({ ...prev, texto: prev.texto ? `${prev.texto}, ${texto}` : texto }));
      } else if (tipo === 'trabajo') {
          setFinalizacionData(prev => ({ ...prev, trabajos_realizados: prev.trabajos_realizados ? `${prev.trabajos_realizados}, ${texto}` : texto }));
      } else if (tipo === 'repuesto') {
          setFinalizacionData(prev => ({ ...prev, repuestos_utilizados: prev.repuestos_utilizados ? `${prev.repuestos_utilizados}, ${texto}` : texto }));
      }
  };

  // 4. MANEJADORES DE FORMULARIOS
  const handleAbrirDiagnostico = (solicitudId) => {
    setFinalizacionAbiertaId(null);
    setDiagnosticoAbiertoId(solicitudId);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDiagnosticoData({ texto: '', hora: now.toISOString().slice(0, 16) });
  };

  const handleAbrirFinalizacion = (solicitudId) => {
    setDiagnosticoAbiertoId(null);
    setFinalizacionAbiertaId(solicitudId);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFinalizacionData({ trabajos_realizados: '', repuestos_utilizados: '', observaciones_taller: '', hora_salida_taller: now.toISOString().slice(0, 16) });
  };

  const handleGuardarDiagnostico = async (e) => {
    e.preventDefault();
    if (diagSigCanvas.current.isEmpty()) { return alert("La firma del técnico es obligatoria."); }
    const firma_taller_diagnostico = diagSigCanvas.current.toDataURL();
    try {
      await api.put(`/solicitudes/diagnostico/${diagnosticoAbiertoId}`, {
        diagnostico: diagnosticoData.texto,
        hora_ingreso: diagnosticoData.hora,
        firma_taller_diagnostico
      });
      setDiagnosticoAbiertoId(null);
      cargarDatos();
      alert("Diagnóstico enviado correctamente.");
    } catch (error) { setMensaje('Error al guardar el diagnóstico.'); }
  };

  const handleFinalizarReparacion = async (e) => {
    e.preventDefault();
    if (!finalizacionData.trabajos_realizados) { return alert("El campo 'Trabajos Realizados' es obligatorio."); }
    if (finalSigCanvas.current.isEmpty()) { return alert("La firma de finalización es obligatoria."); }
    const firma_taller_finalizacion = finalSigCanvas.current.toDataURL();
    try {
      await api.put(`/solicitudes/finalizar/${finalizacionAbiertaId}`, { ...finalizacionData, firma_taller_finalizacion });
      setFinalizacionAbiertaId(null);
      cargarDatos();
      alert("Reparación finalizada. Vehículo listo para entrega.");
    } catch (error) {
      setMensaje('Error al finalizar la reparación.');
      console.error(error);
    }
  };

  const getStatusColor = (estado) => {
      const status = estado?.toLowerCase() || '';
      if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100' };
      if (status.includes('taller') || status.includes('aprobado')) return { bg: '#e3f2fd', text: '#1565c0' };
      if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828' };
      if (status.includes('cierre') || status.includes('terminado')) return { bg: '#e8f5e9', text: '#2e7d32' };
      return { bg: '#eeeeee', text: '#424242' };
  };

  // NUEVO: Función para filtrar listas con el buscador
  const filtrarLista = (lista) => lista.filter(s => 
      s.placa_vehiculo?.toLowerCase().includes(busqueda.toLowerCase()) || 
      s.id?.toString().includes(busqueda) || 
      s.nombre_vehiculo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* --- CABECERA UNIFICADA --- */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '15px' }}>
          <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{nombreUsuario}</h2>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Taller | Sede: {nombreSede}</span>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Salir
          </button>
      </header>

      {mensaje && (
          <div style={{ backgroundColor: '#e3f2fd', color: '#0d47a1', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', fontWeight: 'bold' }}>
              {mensaje}
          </div>
      )}

      {/* --- BUSCADOR FLOTANTE --- */}
      <div style={{ marginBottom: '20px' }}>
          <input 
            type="search" placeholder="🔍 Buscar por Placa, Vehículo o ID..." 
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}
          />
      </div>

      {/* SECCIÓN 1: PENDIENTES DE DIAGNÓSTICO */}
      <details open style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <summary style={{ padding: '15px', backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
            🛠️ Diagnósticos Pendientes ({filtrarLista(pendientes).length})
        </summary>
        <div style={{ padding: '15px' }}>
            {filtrarLista(pendientes).length > 0 ? filtrarLista(pendientes).map((solicitud) => (
            
            /* TARJETA COMPACTA (ACORDEÓN) */
            <details key={solicitud.id} style={{ backgroundColor: '#f9f9f9', marginBottom: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                <summary style={{ padding: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', outline: 'none' }}>
                    <span>{solicitud.placa_vehiculo} <small style={{color: '#d32f2f', marginLeft: '5px'}}>⚠️ Falla reportada</small></span>
                    <span style={{color: '#888'}}>ID #{solicitud.id}</span>
                </summary>
                
                <div style={{ padding: '15px', borderTop: '1px solid #eee' }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Vehículo:</strong> {solicitud.nombre_vehiculo}</p>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Conductor:</strong> {solicitud.nombre_conductor}</p>
                    <p style={{ margin: '0 0 15px 0', color: '#d32f2f' }}><strong>⚠️ Falla:</strong> {solicitud.necesidad_reportada}</p>
                    
                    {diagnosticoAbiertoId === solicitud.id ? (
                    <form onSubmit={handleGuardarDiagnostico} style={{ backgroundColor: '#f1f8e9', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: '#2e7d32' }}>📝 Registrar Diagnóstico</h5>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Hora de Ingreso:</label>
                        <input type="datetime-local" value={diagnosticoData.hora} onChange={(e) => setDiagnosticoData({ ...diagnosticoData, hora: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}/>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Diagnóstico Técnico:</label>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            {['Frenos', 'Motor', 'Suspensión', 'Eléctrico', 'Llantas'].map(tag => (
                                <span key={tag} onClick={() => agregarTextoRapido('diagnostico', tag)} style={{ backgroundColor: '#e0e0e0', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#333' }}>+ {tag}</span>
                            ))}
                        </div>
                        <textarea rows="3" placeholder="Describa el diagnóstico..." value={diagnosticoData.texto} onChange={(e) => setDiagnosticoData({ ...diagnosticoData, texto: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}/>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Firma del Técnico:</label>
                        <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                            <SignatureCanvas ref={diagSigCanvas} canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }} />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => setDiagnosticoAbiertoId(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Cancelar</button>
                            <button type="submit" style={{ flex: 2, padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Guardar Diagnóstico</button>
                        </div>
                    </form>
                    ) : (
                        <button onClick={() => handleAbrirDiagnostico(solicitud.id)} style={{ width: '100%', padding: '12px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                            Añadir Diagnóstico
                        </button>
                    )}
                </div>
            </details>
            )) : <p style={{ color: '#888', textAlign: 'center', padding: '10px' }}>No hay solicitudes pendientes.</p>}
        </div>
      </details>
      
      {/* SECCIÓN 2: EN REPARACIÓN */}
      <details open style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <summary style={{ padding: '15px', backgroundColor: '#e3f2fd', color: '#1565c0', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
            ⚙️ En Reparación ({filtrarLista(enReparacion).length})
        </summary>
        <div style={{ padding: '15px' }}>
            {filtrarLista(enReparacion).length > 0 ? filtrarLista(enReparacion).map((solicitud) => (
            
            /* TARJETA COMPACTA (ACORDEÓN) */
            <details key={solicitud.id} style={{ backgroundColor: '#f9f9f9', marginBottom: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                <summary style={{ padding: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', outline: 'none' }}>
                    <span>{solicitud.placa_vehiculo} <small style={{color: '#1565c0', marginLeft: '5px'}}>🔧 Aprobado</small></span>
                    <span style={{color: '#888'}}>ID #{solicitud.id}</span>
                </summary>

                <div style={{ padding: '15px', borderTop: '1px solid #eee' }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Vehículo:</strong> {solicitud.nombre_vehiculo}</p>
                    <div style={{ backgroundColor: '#e8eaf6', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '15px' }}>
                        <p style={{ margin: '0 0 5px 0', color: '#283593' }}><strong>✅ Diagnóstico Aprobado:</strong> {solicitud.diagnostico_taller}</p>
                        <p style={{ margin: '0', fontSize: '0.8rem', color: '#5c6bc0' }}>Aprobó: {solicitud.nombre_coordinador || 'Coordinación'}</p>
                    </div>
                    
                    {finalizacionAbiertaId === solicitud.id ? (
                    <form onSubmit={handleFinalizarReparacion} style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                        <h5 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>🏁 Finalizar Reparación</h5>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Hora de Salida:</label>
                        <input type="datetime-local" value={finalizacionData.hora_salida_taller} onChange={(e) => setFinalizacionData({ ...finalizacionData, hora_salida_taller: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}/>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Trabajos Realizados:</label>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            {['Cambio de Aceite', 'Ajuste de Frenos', 'Alineación', 'Revisión General'].map(tag => (
                                <span key={tag} onClick={() => agregarTextoRapido('trabajo', tag)} style={{ backgroundColor: '#bbdefb', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#0d47a1' }}>+ {tag}</span>
                            ))}
                        </div>
                        <textarea rows="3" value={finalizacionData.trabajos_realizados} onChange={(e) => setFinalizacionData({ ...finalizacionData, trabajos_realizados: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}/>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Repuestos Utilizados:</label>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                            {['Pastillas', 'Filtro', 'Aceite', 'Ninguno'].map(tag => (
                                <span key={tag} onClick={() => agregarTextoRapido('repuesto', tag)} style={{ backgroundColor: '#bbdefb', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#0d47a1' }}>+ {tag}</span>
                            ))}
                        </div>
                        <textarea rows="2" placeholder="Opcional..." value={finalizacionData.repuestos_utilizados} onChange={(e) => setFinalizacionData({ ...finalizacionData, repuestos_utilizados: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}/>
                        
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Firma de Finalización:</label>
                        <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                            <SignatureCanvas ref={finalSigCanvas} canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }} />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => setFinalizacionAbiertaId(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#bbdefb', color: '#0d47a1', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Cancelar</button>
                            <button type="submit" style={{ flex: 2, padding: '12px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Confirmar Entrega</button>
                        </div>
                    </form>
                    ) : (
                        <button onClick={() => handleAbrirFinalizacion(solicitud.id)} style={{ width: '100%', padding: '12px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                            Registrar Reparación
                        </button>
                    )}
                </div>
            </details>
            )) : <p style={{ color: '#888', textAlign: 'center', padding: '10px' }}>No hay vehículos en reparación.</p>}
        </div>
      </details>

      {/* SECCIÓN 3: HISTORIAL CON NUEVA LÍNEA DE TIEMPO */}
      <details style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <summary style={{ padding: '15px', backgroundColor: '#eeeeee', color: '#424242', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
            📚 Historial de Trabajos ({filtrarLista(historial).length})
        </summary>
        <div style={{ padding: '15px' }}>
            {filtrarLista(historial).length > 0 ? filtrarLista(historial).map((s) => {
                const colores = getStatusColor(s.estado);
                return (
                <div key={s.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '1rem' }}>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong>
                        <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            {s.estado}
                        </span>
                    </div>
                    
                    {/* --- LÍNEA DE TIEMPO DE TRAZABILIDAD --- */}
                    <details style={{ outline: 'none', marginTop: '10px' }}>
                        <summary style={{ cursor: 'pointer', color: '#0288d1', fontSize: '0.9rem', fontWeight: '600', padding: '5px 0' }}>
                            ⏳ Ver Trazabilidad y Tiempos
                        </summary>
                        <div style={{ padding: '15px 12px', marginTop: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '0.85rem', color: '#444' }}>
                            <div style={{ borderLeft: '2px solid #ccc', paddingLeft: '15px', marginLeft: '5px' }}>
                                
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#0288d1', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#0288d1' }}><strong>1️⃣ Solicitud Inicial</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {new Date(s.fecha_creacion).toLocaleString('es-CO')}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.necesidad_reportada} <br/><small>(Por: {s.nombre_conductor})</small></p>
                                </div>

                                {s.diagnostico_taller && (
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#f57c00', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#f57c00' }}><strong>2️⃣ Diagnóstico Taller</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'Sin fecha registrada'}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.diagnostico_taller} <br/><small>(Técnico: {s.nombre_tecnico})</small></p>
                                </div>
                                )}

                                {s.fecha_aprobacion_rechazo && (
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: s.motivo_rechazo ? '#d32f2f' : '#388e3c', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: s.motivo_rechazo ? '#d32f2f' : '#388e3c' }}><strong>3️⃣ Decisión Coordinación</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {new Date(s.fecha_aprobacion_rechazo).toLocaleString('es-CO')}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.motivo_rechazo ? `Rechazado: ${s.motivo_rechazo}` : 'Aprobado'} <br/><small>(Coord: {s.nombre_coordinador})</small></p>
                                </div>
                                )}

                                {s.trabajos_realizados && (
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#1976d2', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#1976d2' }}><strong>4️⃣ Reparación Realizada</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'Sin fecha registrada'}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.trabajos_realizados} <br/><small>Repuestos: {s.repuestos_utilizados || 'Ninguno'}</small></p>
                                </div>
                                )}

                                {s.fecha_cierre_proceso && (
                                <div style={{ position: 'relative', marginBottom: '0' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#388e3c', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#388e3c' }}><strong>5️⃣ Cierre del Proceso</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>Observaciones: {s.observaciones_entrega_conductor || 'Ninguna'}</p>
                                </div>
                                )}
                            </div>
                        </div>
                    </details>
                </div>
            )}) : <p style={{ color: '#888', textAlign: 'center', padding: '10px' }}>No hay trabajos en tu historial.</p>}
        </div>
      </details>
    </main>
  );
};

export default TallerDashboard;