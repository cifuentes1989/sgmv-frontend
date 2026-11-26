/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  const [busqueda, setBusqueda] = useState('');
  const [tabActiva, setTabActiva] = useState('aprobar'); // 'aprobar' | 'cerrar' | 'historial'
  const [fueraDeServicio, setFueraDeServicio] = useState({});

  // Referencias seguras para firmas (evita que se borren al marcar casillas o escribir)
  const sigCanvasesAprobacion = useRef({});
  const sigCanvasesCierre = useRef({});

  // 3. CARGA DE DATOS
  const cargarDatos = async () => {
    try {
      setMensaje('Cargando...');
      const resAprobacion = await api.get('/solicitudes/coordinacion/aprobacion');
      const resCierre = await api.get('/solicitudes/coordinacion/cierre');
      const resHistorial = await api.get('/solicitudes/coordinacion/historial');

      const dataAprobacion = Array.isArray(resAprobacion.data) ? resAprobacion.data : [];
      const dataCierre = Array.isArray(resCierre.data) ? resCierre.data : [];
      const dataHistorial = Array.isArray(resHistorial.data) ? resHistorial.data : [];

      setPorAprobar(dataAprobacion);
      setPorCerrar(dataCierre);
      setHistorialCompleto(dataHistorial);

      // Si no hay nada por aprobar pero sí por cerrar, enfocamos esa pestaña automáticamente
      if (dataAprobacion.length === 0 && dataCierre.length > 0 && tabActiva === 'aprobar') {
        setTabActiva('cerrar');
      }

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
    if (!sigCanvasesAprobacion.current[id] || sigCanvasesAprobacion.current[id].isEmpty()) {
      alert("La firma es obligatoria para aprobar o rechazar.");
      return;
    }

    let motivo_rechazo = null;

    if (decision === 'Rechazado') {
      motivo_rechazo = prompt('⚠️ Por favor, ingrese el motivo del rechazo (OBLIGATORIO):');
      if (!motivo_rechazo || motivo_rechazo.trim() === "") {
        alert("No se puede rechazar sin un motivo.");
        return;
      }
    }

    const firma_coordinacion_aprobacion = sigCanvasesAprobacion.current[id].toDataURL();
    const marcar_fuera_servicio = fueraDeServicio[id] || false;

    try {
      await api.put(`/solicitudes/decision/${id}`, {
        decision,
        motivo_rechazo,
        firma_coordinacion_aprobacion,
        marcar_fuera_servicio
      });
      cargarDatos();
      alert(decision === 'Aprobado' ? "Solicitud aprobada." : "Solicitud rechazada.");
    } catch (error) {
      setMensaje('Error al procesar la decisión.');
    }
  };

  const handleCheckboxChange = (id, checked) => {
    setFueraDeServicio(prev => ({ ...prev, [id]: checked }));
  };

  const handleCierre = async (id) => {
    if (!sigCanvasesCierre.current[id] || sigCanvasesCierre.current[id].isEmpty()) {
      alert("La firma es obligatoria para el cierre final.");
      return;
    }
    const firma_coordinacion_cierre = sigCanvasesCierre.current[id].toDataURL();
    try {
      await api.put(`/solicitudes/cierre/${id}`, { firma_coordinacion_cierre });
      cargarDatos();
      alert("Proceso cerrado operativamente y enviado a Archivo.");
    } catch (error) {
      setMensaje('Error al cerrar el proceso.');
    }
  };

  // --- 5. GENERADOR DE PDF OFICIAL DE REPORTE ---
  const generarPDF = (solicitud) => {
    const doc = new jsPDF();
    const azulCorporativo = [44, 62, 80];
    const margen = 10;
    const anchoUtil = 190;
    let y = 10;

    doc.setFillColor(...azulCorporativo);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('REPORTE DE MANTENIMIENTO VEHICULAR', 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`ID Solicitud: #${solicitud.id}  |  Fecha: ${new Date(solicitud.fecha_creacion).toLocaleDateString()}`, 105, 22, { align: 'center' });

    y = 35;

    const dibujarSeccion = (titulo, contenido, altura = 20) => {
      if (y + altura > 270) { doc.addPage(); y = 20; }

      doc.setFillColor(220, 220, 220);
      doc.rect(margen, y, anchoUtil, 6, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(titulo.toUpperCase(), margen + 2, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lineas = doc.splitTextToSize(contenido || 'N/A', anchoUtil - 4);
      doc.text(lineas, margen + 2, y + 10);

      const alturaReal = Math.max(altura, (lineas.length * 4) + 8);
      doc.setDrawColor(150, 150, 150);
      doc.rect(margen, y, anchoUtil, alturaReal);

      y += alturaReal + 2;
    };

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`VEHÍCULO: ${solicitud.nombre_vehiculo}   |   PLACA: ${solicitud.placa_vehiculo}   |   SEDE: ${solicitud.nombre_sede || 'General'}`, margen, y);
    y += 6;
    doc.line(margen, y, margen + anchoUtil, y);
    y += 5;

    const textoSolicitud = `CONDUCTOR: ${solicitud.nombre_conductor}\nREPORTE: ${solicitud.necesidad_reportada}`;
    dibujarSeccion("1. Solicitud Inicial", textoSolicitud, 15);

    if (solicitud.diagnostico_taller) {
      const textoDiag = `TÉCNICO: ${solicitud.nombre_tecnico || 'N/A'}  |  FECHA INGRESO: ${solicitud.hora_ingreso_taller ? new Date(solicitud.hora_ingreso_taller).toLocaleString() : 'N/A'}\nDIAGNÓSTICO: ${solicitud.diagnostico_taller}`;
      dibujarSeccion("2. Diagnóstico Técnico", textoDiag, 20);
    }

    if (solicitud.fecha_aprobacion_rechazo) {
      const estado = solicitud.motivo_rechazo ? 'RECHAZADO' : 'APROBADO';
      let textoAprob = `COORDINADOR: ${solicitud.nombre_coordinador || 'N/A'}  |  DECISIÓN: ${estado}`;
      if (solicitud.motivo_rechazo) textoAprob += `\nMOTIVO: ${solicitud.motivo_rechazo}`;
      dibujarSeccion("3. Decisión Coordinación", textoAprob, 15);
    }

    if (solicitud.trabajos_realizados) {
      const textoRep = `FECHA SALIDA: ${solicitud.hora_salida_taller ? new Date(solicitud.hora_salida_taller).toLocaleString() : 'N/A'}\nTRABAJOS: ${solicitud.trabajos_realizados}\nREPUESTOS: ${solicitud.repuestos_utilizados || 'Ninguno'}`;
      dibujarSeccion("4. Reparación y Repuestos", textoRep, 25);
    }

    if (solicitud.fecha_cierre_proceso) {
      const textoCierre = `FECHA FINAL: ${new Date(solicitud.fecha_cierre_proceso).toLocaleString()}\nOBSERVACIÓN CONDUCTOR: ${solicitud.observaciones_entrega_conductor || 'Recibido a satisfacción.'}`;
      dibujarSeccion("5. Cierre y Entrega", textoCierre, 15);
    }

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

  // --- 6. GENERADOR DE PDF ORDEN MEDIA CARTA ---
  const generarOrdenAutorizadaPDF = (solicitud) => {
    let nombreDestino = solicitud.nombre_quien_recibe || '';
    if (!nombreDestino) {
      const destinoExterno = window.prompt(
        "¿A qué taller externo se enviará el vehículo? (Ej. CATERPILLAR)\nDeje en blanco si es para el Taller Interno:"
      );
      nombreDestino = destinoExterno && destinoExterno.trim() !== "" ? destinoExterno.toUpperCase() : "TALLER INTERNO";
    }

    const doc = new jsPDF({ format: 'letter' });

    try {
      doc.addImage('/logo.png', 'PNG', 14, 10, 40, 20);
    } catch (e) {
      // Continúa sin detener la descarga si el logo no está en /public
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('IPS MUTUAL SAS', 196, 14, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('NIT: 901274906', 196, 19, { align: 'right' });
    doc.text('Dir: Calle 21N # 8-48 Ciudad Jardín', 196, 24, { align: 'right' });
    doc.text('Cel: 318 045 0369', 196, 29, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEN DE SERVICIO EXTERNO Y REMISIÓN', 105, 40, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`ID Solicitud: #${solicitud.id}`, 14, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 196, 46, { align: 'right' });

    autoTable(doc, {
      startY: 50,
      head: [['Detalle', 'Información']],
      body: [
        ['TALLER DESTINO / PROVEEDOR', nombreDestino],
        ['Placa del Vehículo', solicitud.placa_vehiculo || 'N/A'],
        ['Sede Origen', solicitud.nombre_sede || 'General'],
        ['Conductor Solicitante', solicitud.nombre_conductor || 'N/A'],
        ['Falla Reportada', solicitud.necesidad_reportada || 'N/A'],
        ['Diagnóstico Inicial', solicitud.diagnostico_taller || 'N/A']
      ],
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('AUTORIZACIÓN INTERNA', 14, finalY);
    doc.text('RECEPCIÓN (PROVEEDOR)', 120, finalY);

    finalY += 15;

    doc.line(14, finalY, 55, finalY);
    if (solicitud.firma_taller_diagnostico) {
      doc.addImage(solicitud.firma_taller_diagnostico, 'PNG', 14, finalY - 14, 35, 12);
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Técnico (Diagnóstico)', 14, finalY + 4);

    doc.line(65, finalY, 106, finalY);
    if (solicitud.firma_coordinacion_aprobacion) {
      doc.addImage(solicitud.firma_coordinacion_aprobacion, 'PNG', 65, finalY - 14, 35, 12);
    }
    doc.text('Coordinación (Aprueba)', 65, finalY + 4);

    doc.line(120, finalY, 196, finalY);
    if (solicitud.firma_proveedor_externo) {
      doc.addImage(solicitud.firma_proveedor_externo, 'PNG', 120, finalY - 14, 35, 12);
      let fechaRec = solicitud.fecha_recepcion_taller ? new Date(solicitud.fecha_recepcion_taller) : new Date();
      doc.text(`Recibe: ${solicitud.nombre_quien_recibe}`, 120, finalY + 4);
      doc.text(`Fecha: ${fechaRec.toLocaleDateString()}   Hora: ${fechaRec.toLocaleTimeString()}`, 120, finalY + 10);
    } else {
      doc.text(`Recibe: ${nombreDestino}`, 120, finalY + 4);
      doc.text('Firma legible / Sello del Taller', 120, finalY + 8);
      doc.text('Fecha: _____/_____/202___   Hora: ______:______', 120, finalY + 14);
    }

    const corteY = Math.max(135, finalY + 25);
    doc.setDrawColor(150, 150, 150);
    doc.setLineDash([3, 3], 0);
    doc.line(10, corteY, 206, corteY);

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('✂️ Corte por esta línea para ahorrar papel', 105, corteY + 4, { align: 'center' });

    doc.save(`Remision_Servicio_${solicitud.placa_vehiculo}_ID${solicitud.id}.pdf`);
  };

  // --- FUNCIÓN DE COLORES DE ESTADO ---
  const getStatusColor = (estado) => {
    const status = estado?.toLowerCase() || '';
    if (status.includes('pendiente de archivo')) return { bg: '#fff9c4', text: '#f57f17', border: '#fbc02d' };
    if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100', border: '#ff9800' };
    if (status.includes('taller') || status.includes('aprobado') || status.includes('reparación') || status.includes('reparacion')) return { bg: '#e3f2fd', text: '#1565c0', border: '#1e88e5' };
    if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828', border: '#e53935' };
    if (status.includes('cierre') || status.includes('terminado') || status.includes('finalizado')) return { bg: '#e8f5e9', text: '#2e7d32', border: '#43a047' };
    return { bg: '#eeeeee', text: '#424242', border: '#9e9e9e' };
  };

  // Filtro inteligente por placa, ID, vehículo, conductor o diagnóstico
  const filtrarLista = (lista) => lista.filter(s => {
    const q = busqueda.toLowerCase();
    return (
      s.placa_vehiculo?.toLowerCase().includes(q) ||
      s.id?.toString().includes(q) ||
      s.nombre_vehiculo?.toLowerCase().includes(q) ||
      s.nombre_conductor?.toLowerCase().includes(q) ||
      s.diagnostico_taller?.toLowerCase().includes(q) ||
      s.necesidad_reportada?.toLowerCase().includes(q)
    );
  });

  const listaAprobar = filtrarLista(porAprobar);
  const listaCerrar = filtrarLista(porCerrar);
  const listaHistorial = filtrarLista(historialCompleto);

  return (
    <main style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* CABECERA LIMPIA SIN BOTÓN SALIR REDUNDANTE */}
      <header style={{ backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1565c0' }}>Panel de Coordinación y Control</h2>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>Responsable: <strong>{nombreUsuario}</strong> | Sede: {nombreSede}</span>
      </header>

      {mensaje && (
        <div style={{ backgroundColor: '#e3f2fd', color: '#0d47a1', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', fontWeight: 'bold' }}>
          {mensaje}
        </div>
      )}

      {/* PANEL PRINCIPAL CON BUSCADOR Y PESTAÑAS */}
      <section style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>

        {/* BUSCADOR UNIVERSAL */}
        <div style={{ marginBottom: '18px' }}>
          <input
            type="search"
            placeholder="🔍 Buscar por Placa, ID, Conductor o Falla..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.95rem', boxSizing: 'border-box', backgroundColor: '#f9f9f9' }}
          />
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS (TABS) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px', overflowX: 'auto' }}>
          <button
            onClick={() => setTabActiva('aprobar')}
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: tabActiva === 'aprobar' ? '#e65100' : '#f5f5f5', color: tabActiva === 'aprobar' ? 'white' : '#555' }}
          >
            ⚖️ Por Aprobar ({listaAprobar.length})
          </button>
          <button
            onClick={() => setTabActiva('cerrar')}
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: tabActiva === 'cerrar' ? '#2e7d32' : '#f5f5f5', color: tabActiva === 'cerrar' ? 'white' : '#555' }}
          >
            🔒 Por Cerrar ({listaCerrar.length})
          </button>
          <button
            onClick={() => setTabActiva('historial')}
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: tabActiva === 'historial' ? '#1565c0' : '#f5f5f5', color: tabActiva === 'historial' ? 'white' : '#555' }}
          >
            📚 Historial ({listaHistorial.length})
          </button>
        </div>

        {/* ==================== PESTAÑA 1: POR APROBAR ==================== */}
        {tabActiva === 'aprobar' && (
          <div>
            {listaAprobar.length > 0 ? listaAprobar.map(s => (
              <details key={s.id} style={{ backgroundColor: 'white', marginBottom: '12px', borderRadius: '10px', border: '1px solid #e0e0e0', borderLeft: '5px solid #e65100', overflow: 'hidden' }}>
                <summary style={{ padding: '14px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', outline: 'none', gap: '10px' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#222' }}>{s.placa_vehiculo}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>({s.nombre_vehiculo})</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>• ID #{s.id} • {new Date(s.fecha_creacion).toLocaleDateString('es-CO')}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#0d47a1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
                      <strong>Diagnóstico:</strong> {s.diagnostico_taller || 'Pendiente'}
                    </p>
                  </div>
                  <span style={{ backgroundColor: '#fff3e0', color: '#e65100', padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    ⏳ Revisar
                  </span>
                </summary>

                <div style={{ padding: '18px', borderTop: '1px solid #eee' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem' }}><strong>Conductor:</strong> {s.nombre_conductor}</p>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}><strong>Falla Reportada:</strong> {s.necesidad_reportada}</p>

                  <div style={{ backgroundColor: '#e3f2fd', borderLeft: '4px solid #1565c0', padding: '12px', borderRadius: '0 8px 8px 0', fontSize: '0.95rem', marginBottom: '15px' }}>
                    <p style={{ margin: 0, color: '#0d47a1' }}><strong>🛠️ Diagnóstico Taller:</strong> {s.diagnostico_taller}</p>
                    {s.nombre_tecnico && <small style={{ color: '#555' }}>Técnico: {s.nombre_tecnico}</small>}
                  </div>

                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>Su Firma para Decisión:</label>
                  <div style={{ border: '2px dashed #ccc', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 10px auto', display: 'flex', justifyContent: 'center' }}>
                    <SignatureCanvas ref={ref => { sigCanvasesAprobacion.current[s.id] = ref; }} canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }} />
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <button type="button" onClick={() => sigCanvasesAprobacion.current[s.id]?.clear()} style={{ padding: '4px 12px', fontSize: '0.8rem', backgroundColor: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#555' }}>
                      Limpiar firma
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#ffebee', padding: '10px', borderRadius: '8px', border: '1px solid #ffcdd2', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id={`fuera_servicio_${s.id}`}
                      checked={fueraDeServicio[s.id] || false}
                      onChange={(e) => handleCheckboxChange(s.id, e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label htmlFor={`fuera_servicio_${s.id}`} style={{ margin: 0, cursor: 'pointer', color: '#b71c1c', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      🚨 Marcar vehículo como FUERA DE SERVICIO (Daño grave / Larga duración)
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleDecision(s.id, 'Rechazado')} style={{ flex: 1, padding: '12px', backgroundColor: 'transparent', color: '#d32f2f', border: '2px solid #d32f2f', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                      ❌ Rechazar
                    </button>
                    <button onClick={() => handleDecision(s.id, 'Aprobado')} style={{ flex: 1.5, padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                      ✅ Aprobar
                    </button>
                  </div>
                </div>
              </details>
            )) : (
              <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
                <p style={{ margin: 0 }}>🎉 No hay solicitudes pendientes de aprobación.</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== PESTAÑA 2: POR CERRAR ==================== */}
        {tabActiva === 'cerrar' && (
          <div>
            {listaCerrar.length > 0 ? listaCerrar.map(s => (
              <details key={s.id} style={{ backgroundColor: 'white', marginBottom: '12px', borderRadius: '10px', border: '1px solid #e0e0e0', borderLeft: '5px solid #2e7d32', overflow: 'hidden' }}>
                <summary style={{ padding: '14px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', outline: 'none', gap: '10px' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#222' }}>{s.placa_vehiculo}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>({s.nombre_vehiculo})</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>• ID #{s.id}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
                      <strong>Trabajo:</strong> {s.trabajos_realizados || 'Reparación completada'}
                    </p>
                  </div>
                  <span style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    ✔️ Listo para cierre
                  </span>
                </summary>

                <div style={{ padding: '18px', borderTop: '1px solid #eee' }}>
                  {s.trabajos_realizados && (
                    <div style={{ backgroundColor: '#e3f2fd', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.9rem' }}>
                      <strong>🔧 Trabajos realizados:</strong> {s.trabajos_realizados}
                      {s.repuestos_utilizados && <div><strong>Repuestos:</strong> {s.repuestos_utilizados}</div>}
                    </div>
                  )}

                  <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: '15px', borderLeft: '3px solid #4caf50' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#555' }}><strong>Observación del Conductor ({s.nombre_conductor}) al recibir:</strong></p>
                    <p style={{ margin: 0, fontStyle: 'italic', color: '#333' }}>"{s.observaciones_entrega_conductor || "Recibido a satisfacción sin observaciones"}"</p>
                  </div>

                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>Firma de Cierre Operativo:</label>
                  <div style={{ border: '2px dashed #ccc', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 10px auto', display: 'flex', justifyContent: 'center' }}>
                    <SignatureCanvas ref={ref => { sigCanvasesCierre.current[s.id] = ref; }} canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }} />
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <button type="button" onClick={() => sigCanvasesCierre.current[s.id]?.clear()} style={{ padding: '4px 12px', fontSize: '0.8rem', backgroundColor: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#555' }}>
                      Limpiar firma
                    </button>
                  </div>

                  <button onClick={() => handleCierre(s.id)} style={{ width: '100%', padding: '14px', backgroundColor: '#37474f', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    🗄️ Firmar Cierre y Enviar a Archivo
                  </button>
                </div>
              </details>
            )) : (
              <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
                <p style={{ margin: 0 }}>🎉 No hay procesos pendientes de cierre operativo.</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== PESTAÑA 3: HISTORIAL COMPLETO ==================== */}
        {tabActiva === 'historial' && (
          <div>
            {listaHistorial.length > 0 ? listaHistorial.map(s => {
              const colores = getStatusColor(s.estado);
              const permiteOrdenPDF = ['Aprobado', 'En Reparación', 'Listo para Entrega', 'Pendiente de Cierre', 'Pendiente de Archivo', 'Proceso Finalizado'].includes(s.estado);

              return (
                <details key={s.id} style={{ backgroundColor: 'white', marginBottom: '12px', borderRadius: '10px', border: '1px solid #e0e0e0', borderLeft: `5px solid ${colores.border}`, overflow: 'hidden' }}>
                  <summary style={{ padding: '14px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', outline: 'none', gap: '10px' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#222' }}>{s.placa_vehiculo}</strong>
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>({s.nombre_vehiculo})</span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>• ID #{s.id} • {new Date(s.fecha_creacion).toLocaleDateString('es-CO')}</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
                        <strong>Conductor:</strong> {s.nombre_conductor} — {s.necesidad_reportada}
                      </p>
                    </div>
                    <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {s.estado}
                    </span>
                  </summary>

                  <div style={{ padding: '18px', borderTop: '1px solid #eee' }}>
                    {/* LÍNEA DE TIEMPO COMPLETA */}
                    <div style={{ padding: '15px 12px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '0.85rem', color: '#444' }}>
                      <div style={{ borderLeft: '2px solid #ccc', paddingLeft: '15px', marginLeft: '5px' }}>

                        <div style={{ position: 'relative', marginBottom: '14px' }}>
                          <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#0288d1', fontSize: '1rem' }}>●</span>
                          <p style={{ margin: 0, color: '#0288d1' }}><strong>1️⃣ Solicitud Inicial</strong> ({new Date(s.fecha_creacion).toLocaleString('es-CO')})</p>
                          <p style={{ margin: '4px 0 0 0' }}>{s.necesidad_reportada} <small style={{ color: '#666' }}>(Por: {s.nombre_conductor})</small></p>
                        </div>

                        {s.diagnostico_taller && (
                          <div style={{ position: 'relative', marginBottom: '14px' }}>
                            <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#f57c00', fontSize: '1rem' }}>●</span>
                            <p style={{ margin: 0, color: '#f57c00' }}><strong>2️⃣ Diagnóstico Taller</strong> ({s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'Sin fecha'})</p>
                            <p style={{ margin: '4px 0 0 0' }}>{s.diagnostico_taller} <small style={{ color: '#666' }}>(Técnico: {s.nombre_tecnico || 'N/A'})</small></p>
                          </div>
                        )}

                        {s.fecha_aprobacion_rechazo && (
                          <div style={{ position: 'relative', marginBottom: '14px' }}>
                            <span style={{ position: 'absolute', left: '-22px', top: '0', color: s.motivo_rechazo ? '#d32f2f' : '#388e3c', fontSize: '1rem' }}>●</span>
                            <p style={{ margin: 0, color: s.motivo_rechazo ? '#d32f2f' : '#388e3c' }}><strong>3️⃣ Decisión Coordinación</strong> ({new Date(s.fecha_aprobacion_rechazo).toLocaleString('es-CO')})</p>
                            <p style={{ margin: '4px 0 0 0' }}>{s.motivo_rechazo ? `Rechazado: ${s.motivo_rechazo}` : 'Aprobado'} <small style={{ color: '#666' }}>(Coord: {s.nombre_coordinador || 'Coordinación'})</small></p>
                          </div>
                        )}

                        {s.trabajos_realizados && (
                          <div style={{ position: 'relative', marginBottom: '14px' }}>
                            <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#1976d2', fontSize: '1rem' }}>●</span>
                            <p style={{ margin: 0, color: '#1976d2' }}><strong>4️⃣ Reparación Realizada</strong> ({s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'Sin fecha'})</p>
                            <p style={{ margin: '4px 0 0 0' }}>{s.trabajos_realizados} <br /><small>Repuestos: {s.repuestos_utilizados || 'Ninguno'}</small></p>
                          </div>
                        )}

                        {s.fecha_cierre_proceso && (
                          <div style={{ position: 'relative', marginBottom: (s.url_doc_ingreso || s.url_doc_salida || s.url_evidencia_externa) ? '14px' : '0' }}>
                            <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#388e3c', fontSize: '1rem' }}>●</span>
                            <p style={{ margin: 0, color: '#388e3c' }}><strong>5️⃣ Cierre Operativo</strong> ({new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')})</p>
                            <p style={{ margin: '4px 0 0 0' }}>Observaciones: {s.observaciones_entrega_conductor || 'Ninguna'}</p>
                          </div>
                        )}

                        {/* 6️⃣ SOPORTES DOCUMENTALES DE ARCHIVO */}
                        {(s.url_doc_ingreso || s.url_doc_salida || s.url_evidencia_externa) && (
                          <div style={{ position: 'relative', marginBottom: '0' }}>
                            <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#9c27b0', fontSize: '1rem' }}>●</span>
                            <p style={{ margin: 0, color: '#9c27b0' }}><strong>6️⃣ Soportes Documentales (Archivo)</strong></p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                              {s.url_doc_ingreso && (
                                <a href={s.url_doc_ingreso} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#e1f5fe', color: '#0277bd', border: '1px solid #81d4fa', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                  📄 Ver Soporte Ingreso
                                </a>
                              )}
                              {(s.url_doc_salida || s.url_evidencia_externa) && (
                                <a href={s.url_doc_salida || s.url_evidencia_externa} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#fff3e0', color: '#ef6c00', border: '1px solid #ffcc80', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                  📄 Ver Soporte Salida / Factura
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>

                    {/* BOTONES DE DESCARGA PDF */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                      {permiteOrdenPDF && (
                        <button onClick={() => generarOrdenAutorizadaPDF(s)} style={{ flex: 1, minWidth: '220px', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #2e7d32', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          📄 Descargar Orden Autorizada
                        </button>
                      )}

                      {['Pendiente de Archivo', 'Proceso Finalizado'].includes(s.estado) && (
                        <button onClick={() => generarPDF(s)} style={{ flex: 1, minWidth: '220px', padding: '10px', backgroundColor: '#e3f2fd', color: '#1565c0', border: '1px solid #1565c0', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          📋 Descargar Reporte Oficial SGMV
                        </button>
                      )}
                    </div>
                  </div>
                </details>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
                <p style={{ margin: 0 }}>No se encontraron solicitudes en el historial.</p>
              </div>
            )}
          </div>
        )}

      </section>
    </main>
  );
};

export default CoordinacionDashboard;