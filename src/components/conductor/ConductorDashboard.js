import React, { useState, useEffect } from 'react';
import NuevaSolicitudForm from './NuevaSolicitudForm';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';

const ConductorDashboard = () => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const sigCanvases = {};

  const cargarDatos = async () => {
    try {
      const res = await api.get('/solicitudes/conductor');
      setSolicitudes(res.data);
    } catch (error) {
      alert("Error al cargar el historial de solicitudes.");
    }
  };

  useEffect(() => { cargarDatos(); }, []);
  
  const handleSatisfaccion = async (id) => {
    if (sigCanvases[id].isEmpty()) {
      alert("Por favor, firma para confirmar la recepción.");
      return;
    }
    const firma_conductor_satisfaccion = sigCanvases[id].toDataURL();
    await api.put(`/solicitudes/satisfaccion/${id}`, { firma_conductor_satisfaccion });
    cargarDatos();
  };

  return (
    <main className="container">
      <hgroup>
        <h3>Panel del Conductor</h3>
        <p>Aquí puede crear nuevas solicitudes y ver el historial de sus mantenimientos.</p>
      </hgroup>
      
      <button onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{marginBottom: '1rem'}}>
        {mostrarFormulario ? 'Ocultar Formulario' : 'Crear Nueva Solicitud'}
      </button>

      {mostrarFormulario && <NuevaSolicitudForm onSolicitudCreada={() => { setMostrarFormulario(false); cargarDatos(); }} />}
      
      <h4>Historial de Mis Solicitudes</h4>
      {solicitudes.length > 0 ? solicitudes.map(s => (
        <article key={s.id}>
          <header>
            <strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong>
          </header>
          <p><strong>Estado Actual:</strong> <mark>{s.estado}</mark></p>
          <p><strong>Fecha de Creación:</strong> {new Date(s.fecha_creacion).toLocaleString('es-CO')}</p>
          <p><strong>Necesidad Reportada:</strong> {s.necesidad_reportada}</p>
          
          {s.diagnostico_taller && (
            <>
              <hr />
              <p><strong>Diagnóstico (Técnico: {s.nombre_tecnico || 'N/A'}):</strong> {s.diagnostico_taller}</p>
              <p><strong>Hora Ingreso a Taller:</strong> {new Date(s.hora_ingreso_taller).toLocaleString('es-CO')}</p>
            </>
          )}

          {s.trabajos_realizados && (
             <>
              <hr />
              <p><strong>Trabajos Realizados:</strong> {s.trabajos_realizados}</p>
              <p><strong>Hora Salida de Taller:</strong> {new Date(s.hora_salida_taller).toLocaleString('es-CO')}</p>
             </>
          )}

          {s.estado === 'Listo para Entrega' && (
            <footer>
              <p><strong>¡Su vehículo está listo! Por favor, firme a continuación para confirmar la entrega a satisfacción.</strong></p>
              <div style={{border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150, marginBottom: '1rem'}}>
                <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150}} />
              </div>
              <button onClick={() => handleSatisfaccion(s.id)}>Confirmar Recepción a Satisfacción</button>
            </footer>
          )}
        </article>
      )) : <p>No tienes solicitudes registradas.</p>}
    </main>
  );
};
export default ConductorDashboard;