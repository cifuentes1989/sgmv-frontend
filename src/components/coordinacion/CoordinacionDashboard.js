import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';

const CoordinacionDashboard = () => {
  const [porAprobar, setPorAprobar] = useState([]);
  const [porCerrar, setPorCerrar] = useState([]);
  const [historialCompleto, setHistorialCompleto] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const sigCanvases = {};

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

  const handleDecision = async (id, decision) => {
    if (sigCanvases[id].isEmpty()) {
      alert("La firma es obligatoria para aprobar o rechazar.");
      return;
    }
    const firma_coordinacion_aprobacion = sigCanvases[id].toDataURL();
    let motivo_rechazo = null;
    if (decision === 'Rechazado') {
      motivo_rechazo = prompt('Por favor, ingresa el motivo del rechazo:');
      if (!motivo_rechazo) return;
    }
    try {
      await api.put(`/solicitudes/decision/${id}`, { decision, motivo_rechazo, firma_coordinacion_aprobacion });
      cargarDatos();
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
    } catch (error) {
      setMensaje('Error al cerrar el proceso.');
    }
  };

  const generarPDF = (solicitud) => {
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;

    // --- Encabezado del PDF ---
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE MANTENIMIENTO VEHICULAR', 105, y, { align: 'center' });
    y += 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Solicitud ID: ${solicitud.id}`, margin, y);
    doc.text(`Estado Final: ${solicitud.estado}`, 200, y, { align: 'right' });
    y += 7;
    doc.setLineWidth(0.5);
    doc.line(margin, y, 200, y);
    y += 10;

    // --- Función de ayuda para crear secciones ---
    const addSection = (title, content) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, y);
        y += 8;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(content || 'N/A', 180);
        doc.text(splitText, margin + 5, y);
        y += (splitText.length * 5) + 8;
    };
    
    // --- Función para añadir las imágenes de las firmas ---
    const addSignature = (title, signatureData) => {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(title, margin, y);
        if (signatureData) {
            try {
                doc.addImage(signatureData, 'PNG', margin + 5, y + 2, 60, 30);
            } catch (e) {
                doc.setFont('helvetica', 'normal');
                doc.text("[Firma no disponible]", margin + 5, y + 10);
            }
        } else {
            doc.setFont('helvetica', 'normal');
            doc.text("[Sin Firma]", margin + 5, y + 10);
        }
        y += 40;
    };
    
    // --- Contenido y Firmas del PDF (ORDEN CORRECTO) ---
    addSection("1. SOLICITUD INICIAL", 
        `Fecha: ${new Date(solicitud.fecha_creacion).toLocaleString('es-CO')}\n` +
        `Vehículo: ${solicitud.nombre_vehiculo || 'N/A'} (${solicitud.placa_vehiculo || 'N/A'})\n` +
        `Conductor: ${solicitud.nombre_conductor || 'N/A'}`
    );
    addSection("Necesidad Reportada:", solicitud.necesidad_reportada);
    addSignature("Firma Conductor (Solicitud):", solicitud.firma_conductor_solicitud);
    
    if (y > 220) { doc.addPage(); y = 20; }
    addSection("2. DIAGNÓSTICO DE TALLER", 
        `Fecha Ingreso: ${solicitud.hora_ingreso_taller ? new Date(solicitud.hora_ingreso_taller).toLocaleString('es-CO') : 'N/A'}\n` +
        `Técnico: ${solicitud.nombre_tecnico || 'N/A'}`
    );
    addSection("Diagnóstico:", solicitud.diagnostico_taller);
    addSignature("Firma Técnico (Diagnóstico):", solicitud.firma_taller_diagnostico);

    if (y > 220) { doc.addPage(); y = 20; }
    addSection("3. DECISIÓN DE COORDINACIÓN", 
        `Fecha: ${solicitud.fecha_aprobacion_rechazo ? new Date(solicitud.fecha_aprobacion_rechazo).toLocaleString('es-CO') : 'N/A'}\n` +
        `Coordinador: ${solicitud.nombre_coordinador || 'N/A'}\n` +
        `Decisión: ${(solicitud.motivo_rechazo ? 'Rechazado' : 'Aprobado')}`
    );
    if(solicitud.motivo_rechazo) addSection("Motivo del Rechazo:", solicitud.motivo_rechazo);
    addSignature("Firma Coordinador (Aprobación):", solicitud.firma_coordinacion_aprobacion);

    if (y > 220) { doc.addPage(); y = 20; }
    addSection("4. DETALLE DE REPARACIÓN", `Fecha Salida: ${solicitud.hora_salida_taller ? new Date(solicitud.hora_salida_taller).toLocaleString('es-CO') : 'N/A'}`);
    addSection("Trabajos Realizados:", solicitud.trabajos_realizados || "N/A");
    addSection("Repuestos Utilizados:", solicitud.repuestos_utilizados || "N/A");
    
    if (y > 220) { doc.addPage(); y = 20; }
    addSection("5. CIERRE Y ENTREGA", `Fecha de Cierre Final: ${solicitud.fecha_cierre_proceso ? new Date(solicitud.fecha_cierre_proceso).toLocaleString('es-CO') : 'N/A'}`);
    addSignature("Firma Conductor (Satisfacción):", solicitud.firma_conductor_satisfaccion);
    addSignature("Firma Coordinador (Cierre):", solicitud.firma_coordinacion_cierre);
    
    // Guardar el PDF
    doc.save(`reporte_solicitud_${solicitud.id}.pdf`);
  };

  return (
    <main className="container">
      <hgroup>
        <h3>Panel de Coordinación</h3>
        <p>Revise, apruebe y finalice las solicitudes de mantenimiento.</p>
      </hgroup>
      {mensaje && <article><p>{mensaje}</p></article>}

      <details open>
        <summary>Solicitudes por Aprobar ({porAprobar.length})</summary>
        {porAprobar.length > 0 ? porAprobar.map(s => (
          <article key={s.id}>
            <header><strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong></header>
            <p><strong>Reportado por:</strong> {s.nombre_conductor}</p>
            <p><strong>Necesidad:</strong> {s.necesidad_reportada}</p>
            <p style={{ background: '#f0f0f0', padding: '5px' }}><strong>Diagnóstico Taller:</strong> {s.diagnostico_taller}</p>
            <label>Firma de Coordinación:</label>
            <div style={{border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150}}>
              <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150}} />
            </div>
            <footer>
              <button onClick={() => handleDecision(s.id, 'Aprobado')}>Aprobar</button>
              <button onClick={() => handleDecision(s.id, 'Rechazado')} className="secondary">Rechazar</button>
            </footer>
          </article>
        )) : <p>No hay solicitudes pendientes de aprobación.</p>}
      </details>

      <details open>
        <summary>Procesos Pendientes de Cierre ({porCerrar.length})</summary>
        {porCerrar.length > 0 ? porCerrar.map(s => (
          <article key={s.id}>
             <header><strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong></header>
             <p><strong>Estado:</strong> {s.estado}</p>
             <label>Firma de Cierre Final:</label>
             <div style={{border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150}}>
               <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150}} />
             </div>
             <footer>
                <button onClick={() => handleCierre(s.id)}>Cierre Final y Archivar</button>
             </footer>
          </article>
        )) : <p>No hay procesos pendientes de cierre.</p>}
      </details>

      <details>
        <summary>Historial Completo de Solicitudes de la Sede ({historialCompleto.length})</summary>
        {historialCompleto.length > 0 ? historialCompleto.map(s => (
          <article key={s.id}>
            <header>
              <strong>ID #{s.id}</strong> | Vehículo: <strong>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong> | Estado: <mark>{s.estado}</mark>
            </header>
            <details>
              <summary>Ver Trazabilidad Completa</summary>
              <div style={{paddingLeft: '1rem', borderLeft: '2px solid var(--pico-primary)'}}>
                <p><strong><u>Etapa 1: Solicitud</u></strong></p>
                <p><strong>Conductor:</strong> {s.nombre_conductor}</p>
                <p><strong>Fecha y Hora:</strong> {new Date(s.fecha_creacion).toLocaleString('es-CO')}</p>
                <p><strong>Necesidad Reportada:</strong> {s.necesidad_reportada}</p>
                
                {s.diagnostico_taller && <>
                    <hr/>
                    <p><strong><u>Etapa 2: Diagnóstico</u></strong></p>
                    <p><strong>Técnico:</strong> {s.nombre_tecnico}</p>
                    <p><strong>Fecha Ingreso:</strong> {new Date(s.hora_ingreso_taller).toLocaleString('es-CO')}</p>
                    <p><strong>Diagnóstico:</strong> {s.diagnostico_taller}</p>
                </>}
              </div>
            </details>
            {s.estado === 'Proceso Finalizado' && (
                <footer><button onClick={() => generarPDF(s)}>Generar PDF</button></footer>
            )}
          </article>
        )) : <p>No hay solicitudes en el historial de la sede.</p>}
      </details>
    </main>
  );
};

export default CoordinacionDashboard;