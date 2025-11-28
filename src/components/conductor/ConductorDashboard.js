import React, { useState, useEffect } from 'react';
import NuevaSolicitudForm from './NuevaSolicitudForm';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';

const ConductorDashboard = () => {
  // 1. LÓGICA DE USUARIO Y SEDE
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Conductor', sede_id: null };
  // Intentamos obtener el nombre completo, si no existe, el nombre corto, si no, un genérico.
  const nombreUsuario = user.nombre_completo || user.nombre || 'Conductor';
  const nombreSede = user.sede_id === 1 ? 'Florencia' : user.sede_id === 2 ? 'Popayán' : 'General';

  // 2. ESTADOS
  const [solicitudes, setSolicitudes] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [observacionesInputs, setObservacionesInputs] = useState({}); 
  const sigCanvases = {}; // Referencias para las firmas

  // 3. CARGA DE DATOS
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
  
  // 4. MANEJO DE LA CONFIRMACIÓN DE ENTREGA
  const handleSatisfaccion = async (id) => {
    // Validación de firma
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
        
        // Limpiar campo de texto local
        setObservacionesInputs(prev => ({ ...prev, [id]: '' }));
        
        cargarDatos();
        alert("Entrega confirmada correctamente. El proceso ha pasado a cierre administrativo.");
    } catch(error) {
        console.error("Error al confirmar satisfacción", error);
        alert("No se pudo registrar la confirmación.");
    }
  };

  // Manejo del input de texto para observaciones
  const handleObservacionChange = (id, texto) => {
    setObservacionesInputs(prev => ({ ...prev, [id]: texto }));
  };

  return (
    <main className="container">
      <hgroup>
        {/* ENCABEZADO PERSONALIZADO */}
        <h3>Bienvenido, {nombreUsuario}</h3>
        <p>Panel de Conductor | Sede: <strong>{nombreSede}</strong></p>
        <p>Gestione sus solicitudes y confirme la recepción de vehículos.</p>
      </hgroup>
      
      <button 
        onClick={() => setMostrarFormulario(!mostrarFormulario)} 
        style={{marginBottom: '2rem'}}
        className={mostrarFormulario ? "secondary" : ""}
      >
        {mostrarFormulario ? 'Ocultar Formulario' : 'Crear Nueva Solicitud'}
      </button>

      {mostrarFormulario && (
        <NuevaSolicitudForm onSolicitudCreada={() => { setMostrarFormulario(false); cargarDatos(); }} />
      )}
      
      <hr />
      
      <h4>Historial de Mis Solicitudes</h4>
      
      {solicitudes.length > 0 ? solicitudes.map(s => (
        <article key={s.id}>
          <header>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                <span><strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong></span>
                <mark>{s.estado}</mark>
            </div>
          </header>
          
          {/* --- SECCIÓN DE TRAZABILIDAD DETALLADA --- */}
          <details>
            <summary>Ver Trazabilidad Completa del Proceso</summary>
            <div style={{paddingLeft: '1rem', borderLeft: '3px solid var(--pico-primary)', marginTop: '1rem', fontSize: '0.9rem'}}>
                
                {/* Paso 1: Creación */}
                <p><strong>1️⃣ Solicitud Inicial</strong></p>
                <ul>
                    <li><strong>Fecha:</strong> {new Date(s.fecha_creacion).toLocaleString('es-CO')}</li>
                    <li><strong>Necesidad:</strong> {s.necesidad_reportada}</li>
                </ul>

                {/* Paso 2: Diagnóstico (Solo si ya pasó) */}
                {s.diagnostico_taller && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>2️⃣ Diagnóstico Taller</strong></p>
                        <ul>
                            <li><strong>Técnico:</strong> {s.nombre_tecnico || 'Taller'}</li>
                            <li><strong>Fecha Ingreso:</strong> {s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'N/A'}</li>
                            <li><strong>Diagnóstico:</strong> {s.diagnostico_taller}</li>
                        </ul>
                    </>
                )}

                {/* Paso 3: Decisión Coordinación (Solo si ya pasó) */}
                {s.fecha_aprobacion_rechazo && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>3️⃣ Decisión Coordinación</strong></p>
                        <ul>
                            <li><strong>Coordinador:</strong> {s.nombre_coordinador || 'Coordinación'}</li>
                            <li><strong>Estado:</strong> {s.motivo_rechazo ? <span style={{color:'red'}}>Rechazado</span> : <span style={{color:'green'}}>Aprobado</span>}</li>
                            {s.motivo_rechazo && <li><strong style={{color:'red'}}>Motivo Rechazo:</strong> {s.motivo_rechazo}</li>}
                        </ul>
                    </>
                )}

                {/* Paso 4: Reparación (Solo si ya pasó) */}
                {s.trabajos_realizados && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>4️⃣ Reparación Realizada</strong></p>
                        <ul>
                            <li><strong>Fecha Salida:</strong> {s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'N/A'}</li>
                            <li><strong>Trabajos:</strong> {s.trabajos_realizados}</li>
                            <li><strong>Repuestos:</strong> {s.repuestos_utilizados || 'Ninguno'}</li>
                        </ul>
                    </>
                )}

                {/* Paso 5: Cierre (Solo si ya pasó) */}
                {s.fecha_cierre_proceso && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>5️⃣ Cierre del Proceso</strong></p>
                        <ul>
                            <li><strong>Fecha Cierre:</strong> {new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')}</li>
                            <li><strong>Observación Entrega:</strong> {s.observaciones_entrega_conductor || 'Ninguna'}</li>
                        </ul>
                    </>
                )}
            </div>
          </details>
          {/* ----------------------------------------- */}

          {/* VISUALIZACIÓN RÁPIDA DE RECHAZO (Fuera del desplegable para que sea evidente) */}
          {s.motivo_rechazo && (
            <div style={{marginTop: '1rem', padding: '1rem', backgroundColor: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '5px', color: '#b71c1c'}}>
              <strong>⛔ Solicitud Rechazada:</strong> {s.motivo_rechazo}
            </div>
          )}
          
          {/* SECCIÓN: Confirmación de Entrega (Solo si está listo) */}
          {s.estado === 'Listo para Entrega' && (
            <footer style={{marginTop: '1rem', borderTop: '2px solid var(--pico-primary)', paddingTop: '1rem'}}>
              <h5>Confirmar Recepción del Vehículo</h5>
              <p><small>Por favor revise el vehículo y deje sus observaciones antes de firmar.</small></p>
              
              <label htmlFor={`obs-${s.id}`}><strong>Sus Observaciones de Recibido:</strong></label>
              <textarea 
                id={`obs-${s.id}`}
                rows="2" 
                placeholder="Ej: Recibo a satisfacción, luces operativas, vehículo limpio..."
                value={observacionesInputs[s.id] || ''}
                onChange={(e) => handleObservacionChange(s.id, e.target.value)}
                style={{marginBottom: '1rem'}}
              />

              <label><strong>Firma Digital:</strong></label>
              <div style={{border: '1px solid #ccc', borderRadius: '5px', width: 300, height: 150, marginBottom: '1rem', backgroundColor: '#fff'}}>
                <SignatureCanvas 
                    ref={ref => { sigCanvases[s.id] = ref; }} 
                    canvasProps={{width: 300, height: 150, className: 'sigCanvas'}} 
                />
              </div>
              
              <div role="group">
                  <button onClick={() => sigCanvases[s.id].clear()} className="secondary outline">Borrar Firma</button>
                  <button onClick={() => handleSatisfaccion(s.id)}>Confirmar y Enviar</button>
              </div>
            </footer>
          )}
        </article>
      )) : (
        <p>No tienes solicitudes registradas en el historial.</p>
      )}
    </main>
  );
};

export default ConductorDashboard;