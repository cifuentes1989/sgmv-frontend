import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';

const CoordinacionDashboard = () => {
  // 1. RECUPERAR DATOS DEL USUARIO (Local Storage)
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Coordinador', sede_id: null };
  const nombreUsuario = user.nombre_completo || user.nombre || 'Coordinador';
  const nombreSede = user.sede_id === 1 ? 'Florencia' : user.sede_id === 2 ? 'Popayán' : 'General';

  // 2. ESTADOS
  const [porAprobar, setPorAprobar] = useState([]);
  const [porCerrar, setPorCerrar] = useState([]);
  const [historialCompleto, setHistorialCompleto] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const sigCanvases = {}; // Referencias para las firmas

  // 3. CARGA DE DATOS
  const cargarDatos = async () => {
    try {
      setMensaje('Cargando...');
      const resAprobacion = await api.get('/solicitudes/coordinacion/aprobacion');
      const resCierre = await api.get('/solicitudes/coordinacion/cierre');
      const resHistorial = await api.get('/solicitudes/coordinacion/historial');
      
      setPorAprobar(resAprobacion.data);
      setPorCerrar(resCierre.data);
      setHistorialCompleto(resHistorial.data);
      setMensaje('');
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setMensaje('Error al cargar los datos de coordinación.');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // 4. MANEJADORES (HANDLERS)

  const handleDecision = async (id, decision) => {
    if (sigCanvases[id].isEmpty()) {
      alert("La firma es obligatoria para aprobar o rechazar.");
      return;
    }
    
    let motivo_rechazo = null;
    
    // LÓGICA DE RECHAZO OBLIGATORIO
    if (decision === 'Rechazado') {
      motivo_rechazo = prompt('⚠️ Por favor, ingrese el motivo del rechazo (OBLIGATORIO):');
      // Si cancela o lo deja vacío, no hacemos nada
      if (!motivo_rechazo || motivo_rechazo.trim() === "") {
        alert("No se puede rechazar sin un motivo.");
        return;
      }
    }

    const firma_coordinacion_aprobacion = sigCanvases[id].toDataURL();
    
    try {
      await api.put(`/solicitudes/decision/${id}`, { 
          decision, 
          motivo_rechazo, 
          firma_coordinacion_aprobacion 
      });
      cargarDatos();
      alert(decision === 'Aprobado' ? "Solicitud aprobada." : "Solicitud rechazada.");
    } catch (error) {
      setMensaje('Error al procesar la decisión.');
    }
  };

  const handleCierre = async (id) => {
    if (sigCanvases[id].isEmpty()) {
      alert("La firma es obligatoria para el cierre final.");
      return;
    }
    const firma_coordinacion_cierre = sigCanvases[id].toDataURL();
    try {
      await api.put(`/solicitudes/cierre/${id}`, { firma_coordinacion_cierre });
      cargarDatos();
      alert("Proceso cerrado exitosamente y archivado.");
    } catch (error) {
      setMensaje('Error al cerrar el proceso.');
    }
  };

  // --- 5. GENERADOR DE PDF PROFESIONAL (DISEÑO COMPACTO) ---
  const generarPDF = (solicitud) => {
    const doc = new jsPDF();
    
    // Configuración de Estilo
    const azulCorporativo = [44, 62, 80]; 
    const margen = 10;
    const anchoUtil = 190; 
    let y = 10; 

    // A. ENCABEZADO
    doc.setFillColor(...azulCorporativo);
    doc.rect(0, 0, 210, 30, 'F'); 
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('REPORTE DE MANTENIMIENTO VEHICULAR', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`ID Solicitud: #${solicitud.id}  |  Fecha: ${new Date(solicitud.fecha_creacion).toLocaleDateString()}`, 105, 22, { align: 'center' });

    y = 35;

    // Helper para dibujar secciones
    const dibujarSeccion = (titulo, contenido, altura = 20) => {
        if (y + altura > 270) { doc.addPage(); y = 20; }

        // Barra Título
        doc.setFillColor(220, 220, 220);
        doc.rect(margen, y, anchoUtil, 6, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(titulo.toUpperCase(), margen + 2, y + 4.5);

        // Contenido
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lineas = doc.splitTextToSize(contenido || 'N/A', anchoUtil - 4);
        doc.text(lineas, margen + 2, y + 10);
        
        // Borde
        const alturaReal = Math.max(altura, (lineas.length * 4) + 8);
        doc.setDrawColor(150, 150, 150);
        doc.rect(margen, y, anchoUtil, alturaReal);
        
        y += alturaReal + 2; 
    };

    // B. INFO VEHÍCULO
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`VEHÍCULO: ${solicitud.nombre_vehiculo}   |   PLACA: ${solicitud.placa_vehiculo}   |   SEDE: ${solicitud.nombre_sede || 'General'}`, margen, y);
    y += 6;
    doc.line(margen, y, margen + anchoUtil, y);
    y += 5;

    // C. SECCIONES DE DATOS
    const textoSolicitud = `CONDUCTOR: ${solicitud.nombre_conductor}\nREPORTE: ${solicitud.necesidad_reportada}`;
    dibujarSeccion("1. Solicitud Inicial", textoSolicitud, 15);

    if (solicitud.diagnostico_taller) {
        const textoDiag = `TÉCNICO: ${solicitud.nombre_tecnico || 'N/A'}  |  FECHA INGRESO: ${new Date(solicitud.hora_ingreso_taller).toLocaleString()}\nDIAGNÓSTICO: ${solicitud.diagnostico_taller}`;
        dibujarSeccion("2. Diagnóstico Técnico", textoDiag, 20);
    }

    if (solicitud.fecha_aprobacion_rechazo) {
        const estado = solicitud.motivo_rechazo ? 'RECHAZADO' : 'APROBADO';
        let textoAprob = `COORDINADOR: ${solicitud.nombre_coordinador || 'N/A'}  |  DECISIÓN: ${estado}`;
        if (solicitud.motivo_rechazo) textoAprob += `\nMOTIVO: ${solicitud.motivo_rechazo}`;
        dibujarSeccion("3. Decisión Coordinación", textoAprob, 15);
    }

    if (solicitud.trabajos_realizados) {
        const textoRep = `FECHA SALIDA: ${new Date(solicitud.hora_salida_taller).toLocaleString()}\nTRABAJOS: ${solicitud.trabajos_realizados}\nREPUESTOS: ${solicitud.repuestos_utilizados || 'Ninguno'}`;
        dibujarSeccion("4. Reparación y Repuestos", textoRep, 25);
    }

    if (solicitud.fecha_cierre_proceso) {
        const textoCierre = `FECHA FINAL: ${new Date(solicitud.fecha_cierre_proceso).toLocaleString()}\nOBSERVACIÓN CONDUCTOR: ${solicitud.observaciones_entrega_conductor || 'Recibido a satisfacción.'}`;
        dibujarSeccion("5. Cierre y Entrega", textoCierre, 15);
    }

    // D. FIRMAS (En fila horizontal)
    if (y + 40 > 280) doc.addPage();
    
    const yFirmas = y + 5;
    const anchoFirma = 40;
    const altoFirma = 25;
    const espacio = 5;
    let xFirma = margen + 5;

    const ponerFirma = (titulo, imgData) => {
        doc.setFontSize(7);
        doc.text(titulo, xFirma, yFirmas - 2);
        if (imgData) {
            try {
                doc.rect(xFirma, yFirmas, anchoFirma, altoFirma); 
                doc.addImage(imgData, 'PNG', xFirma + 1, yFirmas + 1, anchoFirma - 2, altoFirma - 2);
            } catch (e) { doc.text('(Error)', xFirma + 2, yFirmas + 10); }
        } else {
            doc.rect(xFirma, yFirmas, anchoFirma, altoFirma);
            doc.text('(Sin Firma)', xFirma + 5, yFirmas + 12);
        }
        xFirma += anchoFirma + espacio + 5;
    };

    ponerFirma("1. Conductor (Solicita)", solicitud.firma_conductor_solicitud);
    ponerFirma("2. Técnico (Diagnostica)", solicitud.firma_taller_diagnostico);
    ponerFirma("3. Coord (Aprueba)", solicitud.firma_coordinacion_aprobacion);
    ponerFirma("4. Conductor (Recibe)", solicitud.firma_conductor_satisfaccion);
    
    doc.save(`reporte_SGMV_${solicitud.id}.pdf`);
  };

  return (
    <main className="container">
      <hgroup>
        <h3>Bienvenido, {nombreUsuario}</h3>
        <p>Panel de Coordinación | Sede: <strong>{nombreSede}</strong></p>
        <p>Gestione aprobaciones, rechazos y cierres finales.</p>
      </hgroup>
      {mensaje && <article><p>{mensaje}</p></article>}

      {/* 1. APROBACIONES PENDIENTES */}
      <details open>
        <summary>Solicitudes por Aprobar ({porAprobar.length})</summary>
        {porAprobar.length > 0 ? porAprobar.map(s => (
          <article key={s.id}>
            <header><strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong></header>
            <div className="grid">
                <div>
                    <p><strong>Conductor:</strong> {s.nombre_conductor}</p>
                    <p><strong>Necesidad:</strong> {s.necesidad_reportada}</p>
                </div>
                <div>
                    <p style={{ background: '#f0f0f0', padding: '5px' }}><strong>Diagnóstico Taller:</strong> {s.diagnostico_taller}</p>
                </div>
            </div>
            
            <label>Firma de Coordinación:</label>
            <div style={{border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150, backgroundColor: 'white'}}>
              <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150}} />
            </div>
            <footer>
              <div role="group">
                  <button onClick={() => handleDecision(s.id, 'Aprobado')}>Aprobar</button>
                  <button onClick={() => handleDecision(s.id, 'Rechazado')} className="secondary">Rechazar</button>
              </div>
            </footer>
          </article>
        )) : <p>No hay solicitudes pendientes de aprobación.</p>}
      </details>

      {/* 2. CIERRES PENDIENTES */}
      <details open>
        <summary>Procesos Pendientes de Cierre ({porCerrar.length})</summary>
        {porCerrar.length > 0 ? porCerrar.map(s => (
          <article key={s.id}>
             <header><strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong></header>
             <p><strong>Estado:</strong> <mark>{s.estado}</mark></p>
             <div style={{marginBottom: '1rem'}}>
                <p><strong>Observación del Conductor al Recibir:</strong></p>
                <blockquote style={{margin: 0}}>"{s.observaciones_entrega_conductor || "Sin observaciones"}"</blockquote>
             </div>
             
             <label>Firma de Cierre Final:</label>
             <div style={{border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150, backgroundColor: 'white'}}>
               <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150}} />
             </div>
             <footer>
                <button onClick={() => handleCierre(s.id)}>Firmar y Archivar Caso</button>
             </footer>
          </article>
        )) : <p>No hay procesos pendientes de cierre.</p>}
      </details>

      {/* 3. HISTORIAL COMPLETO CON TRAZABILIDAD VISUAL */}
      <details>
        <summary>Historial Completo de Solicitudes ({historialCompleto.length})</summary>
        {historialCompleto.length > 0 ? historialCompleto.map(s => (
          <article key={s.id}>
            <header>
              <strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong> | Estado: <mark>{s.estado}</mark>
            </header>
            
            <details>
              <summary>Ver Trazabilidad Completa</summary>
              <div style={{paddingLeft: '1rem', borderLeft: '3px solid var(--pico-primary)', marginTop: '1rem', fontSize: '0.9rem'}}>
                
                {/* ETAPA 1 */}
                <p><strong>1️⃣ Solicitud Inicial</strong></p>
                <ul>
                    <li>Conductor: {s.nombre_conductor}</li>
                    <li>Fecha: {new Date(s.fecha_creacion).toLocaleString('es-CO')}</li>
                    <li>Reporte: {s.necesidad_reportada}</li>
                </ul>
                
                {/* ETAPA 2 */}
                {s.diagnostico_taller && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>2️⃣ Diagnóstico</strong></p>
                        <ul>
                            <li>Técnico: {s.nombre_tecnico}</li>
                            <li>Diagnóstico: {s.diagnostico_taller}</li>
                        </ul>
                    </>
                )}

                {/* ETAPA 3 */}
                {s.fecha_aprobacion_rechazo && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>3️⃣ Decisión</strong></p>
                        <ul>
                            <li>Coordinador: {s.nombre_coordinador}</li>
                            <li>Estado: {s.motivo_rechazo ? <span style={{color:'red'}}>Rechazado</span> : 'Aprobado'}</li>
                            {s.motivo_rechazo && <li><strong style={{color:'red'}}>Motivo: {s.motivo_rechazo}</strong></li>}
                        </ul>
                    </>
                )}

                {/* ETAPA 4 */}
                {s.trabajos_realizados && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>4️⃣ Reparación</strong></p>
                        <ul>
                            <li>Trabajos: {s.trabajos_realizados}</li>
                            <li>Repuestos: {s.repuestos_utilizados}</li>
                        </ul>
                    </>
                )}

                {/* ETAPA 5 */}
                {s.fecha_cierre_proceso && (
                    <>
                        <hr style={{margin: '0.5rem 0'}}/>
                        <p><strong>5️⃣ Cierre</strong></p>
                        <ul>
                            <li>Fecha Cierre: {new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')}</li>
                            <li>Observación Entrega: {s.observaciones_entrega_conductor}</li>
                        </ul>
                    </>
                )}
              </div>
            </details>

            {s.estado === 'Proceso Finalizado' && (
                <footer style={{marginTop: '1rem'}}>
                    <button onClick={() => generarPDF(s)}>📄 Descargar PDF Oficial</button>
                </footer>
            )}
          </article>
        )) : <p>No hay solicitudes en el historial de la sede.</p>}
      </details>
    </main>
  );
};

export default CoordinacionDashboard;