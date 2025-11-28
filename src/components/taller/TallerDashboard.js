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
  
  // Estados para formularios dinámicos
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

  // 4. MANEJADORES DE FORMULARIOS
  const handleAbrirDiagnostico = (solicitudId) => {
    setFinalizacionAbiertaId(null);
    setDiagnosticoAbiertoId(solicitudId);
    // Hora actual por defecto en formato datetime-local
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

  return (
    <main className="container">
      <hgroup>
        {/* ENCABEZADO PERSONALIZADO */}
        <h3>Bienvenido, {nombreUsuario}</h3>
        <p>Panel del Taller | Sede: <strong>{nombreSede}</strong></p>
        <p>Gestione los diagnósticos y reparaciones pendientes.</p>
      </hgroup>
      {mensaje && <article><p>{mensaje}</p></article>}

      {/* SECCIÓN 1: PENDIENTES DE DIAGNÓSTICO */}
      <details open>
        <summary>Pendientes de Diagnóstico ({pendientes.length})</summary>
        {pendientes.length > 0 ? pendientes.map((solicitud) => (
          <article key={solicitud.id}>
            <header>
              <strong>ID #{solicitud.id}</strong> | Vehículo: <strong>{solicitud.nombre_vehiculo} ({solicitud.placa_vehiculo})</strong>
            </header>
            <div className="grid">
                <div>
                    <small>Reportado por:</small>
                    <p>{solicitud.nombre_conductor}</p>
                </div>
                <div>
                    <small>Necesidad:</small>
                    <p>{solicitud.necesidad_reportada}</p>
                </div>
            </div>
            
            {diagnosticoAbiertoId === solicitud.id ? (
              <form onSubmit={handleGuardarDiagnostico} style={{marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '5px'}}>
                <h5>Registrar Diagnóstico</h5>
                <label>Hora de Ingreso:</label>
                <input type="datetime-local" value={diagnosticoData.hora} onChange={(e) => setDiagnosticoData({ ...diagnosticoData, hora: e.target.value })} required />
                <label>Diagnóstico Técnico:</label>
                <textarea rows="3" placeholder="Describa el diagnóstico..." value={diagnosticoData.texto} onChange={(e) => setDiagnosticoData({ ...diagnosticoData, texto: e.target.value })} required />
                <label>Firma del Técnico:</label>
                <div style={{ border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150, backgroundColor: 'white' }}>
                    <SignatureCanvas ref={diagSigCanvas} canvasProps={{ width: 300, height: 150 }} />
                </div>
                <div role="group" style={{marginTop: '1rem'}}>
                    <button type="button" className="secondary" onClick={() => setDiagnosticoAbiertoId(null)}>Cancelar</button>
                    <button type="submit">Guardar y Enviar</button>
                </div>
              </form>
            ) : (<button onClick={() => handleAbrirDiagnostico(solicitud.id)}>Añadir Diagnóstico</button>)}
          </article>
        )) : <p>No hay solicitudes pendientes de diagnóstico.</p>}
      </details>
      
      {/* SECCIÓN 2: EN REPARACIÓN */}
      <details open>
        <summary>En Reparación ({enReparacion.length})</summary>
        {enReparacion.length > 0 ? enReparacion.map((solicitud) => (
          <article key={solicitud.id}>
            <header>
              <strong>ID #{solicitud.id}</strong> | Vehículo: <strong>{solicitud.nombre_vehiculo} ({solicitud.placa_vehiculo})</strong>
            </header>
            <p><strong>Diagnóstico Aprobado:</strong> {solicitud.diagnostico_taller}</p>
            <p><small>Aprobado por Coordinador: {solicitud.nombre_coordinador || 'N/A'}</small></p>
            
            {finalizacionAbiertaId === solicitud.id ? (
              <form onSubmit={handleFinalizarReparacion} style={{marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '5px'}}>
                <h5>Finalizar Reparación</h5>
                <label>Hora de Salida:</label>
                <input type="datetime-local" value={finalizacionData.hora_salida_taller} onChange={(e) => setFinalizacionData({ ...finalizacionData, hora_salida_taller: e.target.value })} required />
                <label>Trabajos Realizados:</label>
                <textarea rows="3" value={finalizacionData.trabajos_realizados} onChange={(e) => setFinalizacionData({ ...finalizacionData, trabajos_realizados: e.target.value })} required />
                <label>Repuestos Utilizados:</label>
                <textarea rows="2" value={finalizacionData.repuestos_utilizados} onChange={(e) => setFinalizacionData({ ...finalizacionData, repuestos_utilizados: e.target.value })} />
                <label>Firma de Finalización:</label>
                <div style={{ border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150, backgroundColor: 'white' }}>
                    <SignatureCanvas ref={finalSigCanvas} canvasProps={{ width: 300, height: 150 }} />
                </div>
                <div role="group" style={{marginTop: '1rem'}}>
                    <button type="button" className="secondary" onClick={() => setFinalizacionAbiertaId(null)}>Cancelar</button>
                    <button type="submit">Confirmar Finalización</button>
                </div>
              </form>
            ) : (<button onClick={() => handleAbrirFinalizacion(solicitud.id)}>Registrar Finalización</button>)}
          </article>
        )) : <p>No hay vehículos en reparación.</p>}
      </details>

      {/* SECCIÓN 3: HISTORIAL (Con trazabilidad completa) */}
      <details>
        <summary>Historial de Trabajos Realizados ({historial.length})</summary>
        {historial.length > 0 ? historial.map((s) => (
          <article key={s.id}>
            <header>
              <strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong> | <mark>{s.estado}</mark>
            </header>
            
            {/* TRAZABILIDAD COMPLETA TAMBIÉN PARA EL TALLER */}
            <details>
                <summary>Ver Detalle Completo del Caso</summary>
                <div style={{paddingLeft: '1rem', borderLeft: '3px solid var(--pico-primary)', marginTop: '1rem', fontSize: '0.9rem'}}>
                    <p><strong>1. Solicitud:</strong> {s.necesidad_reportada} (Por: {s.nombre_conductor})</p>
                    <hr style={{margin: '0.5rem 0'}}/>
                    <p><strong>2. Mi Diagnóstico:</strong> {s.diagnostico_taller}</p>
                    <hr style={{margin: '0.5rem 0'}}/>
                    <p><strong>3. Trabajos Efectuados:</strong> {s.trabajos_realizados}</p>
                    <p><strong>Repuestos:</strong> {s.repuestos_utilizados || 'Ninguno'}</p>
                    
                    {s.observaciones_entrega_conductor && (
                        <>
                            <hr style={{margin: '0.5rem 0'}}/>
                            <p><strong>4. Feedback del Conductor:</strong> {s.observaciones_entrega_conductor}</p>
                        </>
                    )}
                    
                    {s.motivo_rechazo && (
                        <>
                            <hr style={{margin: '0.5rem 0'}}/>
                            <p style={{color: 'red'}}><strong>Caso Rechazado:</strong> {s.motivo_rechazo}</p>
                        </>
                    )}
                </div>
            </details>
          </article>
        )) : <p>No hay trabajos en tu historial.</p>}
      </details>
    </main>
  );
};

export default TallerDashboard;