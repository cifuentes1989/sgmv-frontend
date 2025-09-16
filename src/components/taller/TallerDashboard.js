import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';

const TallerDashboard = () => {
  const [pendientes, setPendientes] = useState([]);
  const [enReparacion, setEnReparacion] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [diagnosticoAbiertoId, setDiagnosticoAbiertoId] = useState(null);
  const [diagnosticoData, setDiagnosticoData] = useState({ texto: '', hora: '' });
  const diagSigCanvas = useRef({});
  const [finalizacionAbiertaId, setFinalizacionAbiertaId] = useState(null);
  const [finalizacionData, setFinalizacionData] = useState({ trabajos_realizados: '', repuestos_utilizados: '', observaciones_taller: '', hora_salida_taller: '' });
  const finalSigCanvas = useRef({});

  const cargarDatos = async () => {
    try {
      setMensaje('Cargando...');
      const resPendientes = await api.get('/solicitudes/taller/pendientes');
      const resEnReparacion = await api.get('/solicitudes/taller/en-reparacion');
      setPendientes(resPendientes.data);
      setEnReparacion(resEnReparacion.data);
      setMensaje('');
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setMensaje('No se pudieron cargar los datos del taller.');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleAbrirDiagnostico = (solicitudId) => {
    setFinalizacionAbiertaId(null);
    setDiagnosticoAbiertoId(solicitudId);
    setDiagnosticoData({ texto: '', hora: new Date().toISOString().slice(0, 16) });
  };

  const handleAbrirFinalizacion = (solicitudId) => {
    setDiagnosticoAbiertoId(null);
    setFinalizacionAbiertaId(solicitudId);
    setFinalizacionData({ trabajos_realizados: '', repuestos_utilizados: '', observaciones_taller: '', hora_salida_taller: new Date().toISOString().slice(0, 16) });
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
    } catch (error) { setMensaje('Error al guardar el diagnóstico.'); }
  };

  const handleFinalizarReparacion = async (e) => {
    e.preventDefault();
    if (!finalizacionData.trabajos_realizados || !finalizacionData.hora_salida_taller) { return alert("Los campos 'Trabajos Realizados' y 'Hora de Salida' son obligatorios."); }
    if (finalSigCanvas.current.isEmpty()) { return alert("La firma de finalización es obligatoria."); }
    const firma_taller_finalizacion = finalSigCanvas.current.toDataURL();
    try {
      await api.put(`/solicitudes/finalizar/${finalizacionAbiertaId}`, { ...finalizacionData, firma_taller_finalizacion });
      setFinalizacionAbiertaId(null);
      cargarDatos();
    } catch (error) {
      setMensaje('Error al finalizar la reparación.');
      console.error(error);
    }
  };

  return (
    <main className="container">
      <hgroup>
        <h3>Panel del Taller</h3>
        <p>Gestione los diagnósticos y reparaciones pendientes.</p>
      </hgroup>
      {mensaje && <article><p>{mensaje}</p></article>}

      <details open>
        <summary>Pendientes de Diagnóstico ({pendientes.length})</summary>
        {pendientes.length > 0 ? pendientes.map((solicitud) => (
          <article key={solicitud.id}>
            <header>
              <strong>ID #{solicitud.id}</strong> | Vehículo: <strong>{solicitud.nombre_vehiculo} ({solicitud.placa_vehiculo})</strong>
            </header>
            <p><strong>Reportado por:</strong> {solicitud.nombre_conductor}</p>
            <p><strong>Necesidad:</strong> {solicitud.necesidad_reportada}</p>
            {diagnosticoAbiertoId === solicitud.id ? (
              <form onSubmit={handleGuardarDiagnostico}>
                <label htmlFor={`hora_ingreso_${solicitud.id}`}>Hora de Ingreso:</label>
                <input id={`hora_ingreso_${solicitud.id}`} type="datetime-local" value={diagnosticoData.hora} onChange={(e) => setDiagnosticoData({ ...diagnosticoData, hora: e.target.value })} required />
                <label htmlFor={`diagnostico_${solicitud.id}`}>Diagnóstico:</label>
                <textarea id={`diagnostico_${solicitud.id}`} rows="3" placeholder="Diagnóstico..." value={diagnosticoData.texto} onChange={(e) => setDiagnosticoData({ ...diagnosticoData, texto: e.target.value })} required />
                <label>Firma del Técnico:</label>
                <div style={{ border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150 }}><SignatureCanvas ref={diagSigCanvas} canvasProps={{ width: 300, height: 150 }} /></div>
                <footer style={{ paddingTop: '1rem' }}>
                  <button type="submit">Guardar Diagnóstico</button>
                  <button type="button" className="secondary" onClick={() => setDiagnosticoAbiertoId(null)}>Cancelar</button>
                </footer>
              </form>
            ) : (<button onClick={() => handleAbrirDiagnostico(solicitud.id)}>Añadir Diagnóstico</button>)}
          </article>
        )) : <p>No hay solicitudes pendientes de diagnóstico.</p>}
      </details>
      <details open>
        <summary>En Reparación ({enReparacion.length})</summary>
        {enReparacion.length > 0 ? enReparacion.map((solicitud) => (
          <article key={solicitud.id}>
            <header>
              <strong>ID #{solicitud.id}</strong> | Vehículo: <strong>{solicitud.nombre_vehiculo} ({solicitud.placa_vehiculo})</strong>
            </header>
            <p><strong>Diagnóstico:</strong> {solicitud.diagnostico_taller}</p>
            {finalizacionAbiertaId === solicitud.id ? (
              <form onSubmit={handleFinalizarReparacion}>
                <label htmlFor={`hora_salida_${solicitud.id}`}><strong>Hora de Salida:</strong></label>
                <input id={`hora_salida_${solicitud.id}`} type="datetime-local" value={finalizacionData.hora_salida_taller} onChange={(e) => setFinalizacionData({ ...finalizacionData, hora_salida_taller: e.target.value })} required />
                <label htmlFor={`trabajos_${solicitud.id}`}><strong>Trabajos Realizados:</strong></label>
                <textarea id={`trabajos_${solicitud.id}`} rows="3" value={finalizacionData.trabajos_realizados} onChange={(e) => setFinalizacionData({ ...finalizacionData, trabajos_realizados: e.target.value })} required />
                <label htmlFor={`repuestos_${solicitud.id}`}><strong>Repuestos Utilizados (opcional):</strong></label>
                <textarea id={`repuestos_${solicitud.id}`} rows="2" value={finalizacionData.repuestos_utilizados} onChange={(e) => setFinalizacionData({ ...finalizacionData, repuestos_utilizados: e.target.value })} />
                <label htmlFor={`obs_${solicitud.id}`}><strong>Observaciones Adicionales (opcional):</strong></label>
                <textarea id={`obs_${solicitud.id}`} rows="2" value={finalizacionData.observaciones_taller} onChange={(e) => setFinalizacionData({ ...finalizacionData, observaciones_taller: e.target.value })} />
                <label><strong>Firma de Finalización:</strong></label>
                <div style={{ border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150 }}><SignatureCanvas ref={finalSigCanvas} canvasProps={{ width: 300, height: 150 }} /></div>
                <button type="button" className="secondary outline" onClick={() => finalSigCanvas.current.clear()} style={{ width: 'auto', marginTop: '0.5rem' }}>Limpiar Firma</button>
                <footer style={{ paddingTop: '1rem' }}>
                  <button type="submit">Confirmar Finalización</button>
                  <button type="button" className="secondary" onClick={() => setFinalizacionAbiertaId(null)}>Cancelar</button>
                </footer>
              </form>
            ) : (<button onClick={() => handleAbrirFinalizacion(solicitud.id)}>Registrar Finalización</button>)}
          </article>
        )) : <p>No hay vehículos en reparación.</p>}
      </details>
    </main>
  );
};

export default TallerDashboard;