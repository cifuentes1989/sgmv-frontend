/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TallerDashboard = () => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Técnico', sede_id: null };
  const nombreUsuario = user.nombre_completo || user.nombre || 'Técnico de Taller';
  const nombreSede = user.sede_id === 1 ? 'Florencia' : user.sede_id === 2 ? 'Popayán' : 'General';

  const [pendientes, setPendientes] = useState([]);
  const [enReparacion, setEnReparacion] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tabActiva, setTabActiva] = useState('pendientes'); // 'pendientes' | 'reparacion' | 'historial'
  const [limiteHistorial, setLimiteHistorial] = useState(25); // Evita saturar la pantalla con 200+ items

  const [diagnosticoAbiertoId, setDiagnosticoAbiertoId] = useState(null);
  const [diagnosticoData, setDiagnosticoData] = useState({ texto: '', hora: '' });
  const diagSigCanvas = useRef(null);

  const [finalizacionAbiertaId, setFinalizacionAbiertaId] = useState(null);
  const [finalizacionData, setFinalizacionData] = useState({
    trabajos_realizados: '',
    repuestos_utilizados: '',
    observaciones_taller: '',
    hora_salida_taller: ''
  });
  const finalSigCanvas = useRef(null);

  const cargarDatos = async () => {
    try {
      setMensaje('Cargando...');
      const [resPendientes, resEnReparacion, resHistorial] = await Promise.all([
        api.get('/solicitudes/taller/pendientes'),
        api.get('/solicitudes/taller/en-reparacion'),
        api.get('/solicitudes/taller/historial')
      ]);

      const dataPend = Array.isArray(resPendientes.data) ? resPendientes.data : [];
      const dataRep = Array.isArray(resEnReparacion.data) ? resEnReparacion.data : [];
      const dataHist = Array.isArray(resHistorial.data) ? resHistorial.data : [];

      setPendientes(dataPend);
      setEnReparacion(dataRep);
      setHistorial(dataHist);

      // Si no hay diagnósticos pendientes pero sí carros en reparación, salta directo ahí
      if (dataPend.length === 0 && dataRep.length > 0 && tabActiva === 'pendientes') {
        setTabActiva('reparacion');
      }

      setMensaje('');
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setMensaje('No se pudieron cargar los datos del taller.');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const agregarTextoRapido = (tipo, texto) => {
    if (tipo === 'diagnostico') {
      setDiagnosticoData(prev => ({ ...prev, texto: prev.texto ? `${prev.texto}, ${texto}` : texto }));
    } else if (tipo === 'trabajo') {
      setFinalizacionData(prev => ({ ...prev, trabajos_realizados: prev.trabajos_realizados ? `${prev.trabajos_realizados}, ${texto}` : texto }));
    } else if (tipo === 'repuesto') {
      setFinalizacionData(prev => ({ ...prev, repuestos_utilizados: prev.repuestos_utilizados ? `${prev.repuestos_utilizados}, ${texto}` : texto }));
    }
  };

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
    setFinalizacionData({
      trabajos_realizados: '',
      repuestos_utilizados: '',
      observaciones_taller: '',
      hora_salida_taller: now.toISOString().slice(0, 16)
    });
  };

  const handleGuardarDiagnostico = async (e) => {
    e.preventDefault();
    if (!diagSigCanvas.current || diagSigCanvas.current.isEmpty()) {
      return alert('La firma del técnico es obligatoria.');
    }
    try {
      await api.put(`/solicitudes/diagnostico/${diagnosticoAbiertoId}`, {
        diagnostico: diagnosticoData.texto,
        hora_ingreso: diagnosticoData.hora,
        firma_taller_diagnostico: diagSigCanvas.current.toDataURL()
      });
      setDiagnosticoAbiertoId(null);
      cargarDatos();
      alert('Diagnóstico enviado correctamente.');
    } catch (error) {
      setMensaje('Error al guardar el diagnóstico.');
    }
  };

  const handleFinalizarReparacion = async (e) => {
    e.preventDefault();
    if (!finalizacionData.trabajos_realizados) {
      return alert("El campo 'Trabajos Realizados' es obligatorio.");
    }
    if (!finalSigCanvas.current || finalSigCanvas.current.isEmpty()) {
      return alert('La firma de finalización es obligatoria.');
    }
    try {
      await api.put(`/solicitudes/finalizar/${finalizacionAbiertaId}`, {
        ...finalizacionData,
        firma_taller_finalizacion: finalSigCanvas.current.toDataURL()
      });
      setFinalizacionAbiertaId(null);
      cargarDatos();
      alert('Reparación finalizada. Vehículo listo para entrega.');
    } catch (error) {
      setMensaje('Error al finalizar la reparación.');
    }
  };

  // --- BOTÓN DE PÁNICO (FUERA DE SERVICIO MANUAL) ---
  const handleReportarFueraServicio = async (id, placa) => {
    const confirmacion = window.confirm(
      `🚨 ADVERTENCIA: ¿Estás seguro que deseas reportar el vehículo ${placa} como FUERA DE SERVICIO por daño de larga duración? Esto alertará a Gerencia inmediatamente.`
    );

    if (confirmacion) {
      try {
        await api.put(`/solicitudes/taller/fuera-servicio/${id}`);
        cargarDatos();
        alert(`✅ El vehículo ${placa} ha sido marcado como Fuera de Servicio exitosamente.`);
      } catch (error) {
        console.error(error);
        alert('Error al reportar el vehículo.');
      }
    }
  };

  const getStatusColor = (estado) => {
    const status = estado?.toLowerCase() || '';
    if (status.includes('pendiente de archivo')) return { bg: '#fff9c4', text: '#f57f17', border: '#fbc02d' };
    if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100', border: '#ff9800' };
    if (status.includes('taller') || status.includes('aprobado') || status.includes('reparación') || status.includes('reparacion')) return { bg: '#e3f2fd', text: '#1565c0', border: '#1e88e5' };
    if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828', border: '#e53935' };
    if (status.includes('cierre') || status.includes('terminado') || status.includes('finalizado') || status.includes('listo')) return { bg: '#e8f5e9', text: '#2e7d32', border: '#43a047' };
    return { bg: '#eeeeee', text: '#424242', border: '#9e9e9e' };
  };

  const filtrarLista = (lista) =>
    lista.filter(s => {
      const q = busqueda.toLowerCase();
      return (
        s.placa_vehiculo?.toLowerCase().includes(q) ||
        s.id?.toString().includes(q) ||
        s.nombre_vehiculo?.toLowerCase().includes(q) ||
        s.nombre_conductor?.toLowerCase().includes(q) ||
        s.necesidad_reportada?.toLowerCase().includes(q) ||
        s.diagnostico_taller?.toLowerCase().includes(q)
      );
    });

  // --- PDF ORDEN MEDIA CARTA ---
  const generarOrdenAutorizadaPDF = (solicitud) => {
    let nombreDestino = solicitud.nombre_quien_recibe || '';
    if (!nombreDestino) {
      const destinoExterno = window.prompt(
        '¿A qué taller externo se enviará el vehículo? (Ej. CATERPILLAR)\nDeje en blanco si es para el Taller Interno:'
      );
      nombreDestino = destinoExterno && destinoExterno.trim() !== '' ? destinoExterno.toUpperCase() : 'TALLER INTERNO';
    }

    const doc = new jsPDF({ format: 'letter' });

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
        ['Placa del Vehículo', solicitud.placa_vehiculo || solicitud.placa || 'N/A'],
        ['Sede Origen', solicitud.nombre_sede || solicitud.sede || 'General'],
        ['Conductor Solicitante', solicitud.nombre_conductor || 'N/A'],
        ['Falla Reportada', solicitud.necesidad_reportada || solicitud.descripcion_falla || 'N/A'],
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

  const listaPendientes = filtrarLista(pendientes);
  const listaReparacion = filtrarLista(enReparacion);
  const listaHistorialCompleta = filtrarLista(historial);
  const listaHistorialVisible = busqueda ? listaHistorialCompleta : listaHistorialCompleta.slice(0, limiteHistorial);

  return (
    <main style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* CABECERA ESTANDARIZADA */}
      <header style={{ backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#e65100' }}>Módulo Operativo de Taller</h2>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>Técnico: <strong>{nombreUsuario}</strong> | Sede: {nombreSede}</span>
      </header>

      {mensaje && (
        <div style={{ backgroundColor: '#e3f2fd', color: '#0d47a1', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', fontWeight: 'bold' }}>
          {mensaje}
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL CON BUSCADOR Y PESTAÑAS */}
      <section style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        
        {/* BUSCADOR */}
        <div style={{ marginBottom: '18px' }}>
          <input
            type="search"
            placeholder="🔍 Buscar por Placa, Vehículo, ID o Falla..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.95rem', boxSizing: 'border-box', backgroundColor: '#f9f9f9' }}
          />
        </div>

        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px', overflowX: 'auto' }}>
          <button
            onClick={() => setTabActiva('pendientes')}
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: tabActiva === 'pendientes' ? '#e65100' : '#f5f5f5', color: tabActiva === 'pendientes' ? 'white' : '#555' }}
          >
            🛠️ Por Diagnosticar ({listaPendientes.length})
          </button>
          <button
            onClick={() => setTabActiva('reparacion')}
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: tabActiva === 'reparacion' ? '#1565c0' : '#f5f5f5', color: tabActiva === 'reparacion' ? 'white' : '#555' }}
          >
            ⚙️ En Reparación ({listaReparacion.length})
          </button>
          <button
            onClick={() => setTabActiva('historial')}
            style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: tabActiva === 'historial' ? '#2e7d32' : '#f5f5f5', color: tabActiva === 'historial' ? 'white' : '#555' }}
          >
            📚 Historial ({listaHistorialCompleta.length})
          </button>
        </div>

        {/* ==================== PESTAÑA 1: POR DIAGNOSTICAR ==================== */}
        {tabActiva === 'pendientes' && (
          <div>
            {listaPendientes.length > 0 ? listaPendientes.map(solicitud => (
              <details key={solicitud.id} style={{ backgroundColor: 'white', marginBottom: '12px', borderRadius: '10px', border: '1px solid #e0e0e0', borderLeft: '5px solid #e65100', overflow: 'hidden' }}>
                <summary style={{ padding: '14px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', outline: 'none', gap: '10px' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#222' }}>{solicitud.placa_vehiculo}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>({solicitud.nombre_vehiculo})</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>• ID #{solicitud.id} • {new Date(solicitud.fecha_creacion).toLocaleDateString('es-CO')}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#d32f2f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
                      <strong>⚠️ Falla:</strong> {solicitud.necesidad_reportada}
                    </p>
                  </div>
                  <span style={{ backgroundColor: '#fff3e0', color: '#e65100', padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    Diagnosticar
                  </span>
                </summary>

                <div style={{ padding: '18px', borderTop: '1px solid #eee' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#555' }}>
                    <strong>📅 Reportado el:</strong> {new Date(solicitud.fecha_creacion).toLocaleString('es-CO')} | <strong>Conductor:</strong> {solicitud.nombre_conductor}
                  </p>
                  <div style={{ backgroundColor: '#ffebee', padding: '10px 12px', borderRadius: '8px', marginBottom: '15px', color: '#b71c1c', fontSize: '0.9rem' }}>
                    <strong>Falla reportada:</strong> {solicitud.necesidad_reportada}
                  </div>

                  {diagnosticoAbiertoId === solicitud.id ? (
                    <form onSubmit={handleGuardarDiagnostico} style={{ backgroundColor: '#f1f8e9', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                      <h5 style={{ margin: '0 0 15px 0', color: '#2e7d32' }}>📝 Registrar Diagnóstico</h5>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Hora de Ingreso:</label>
                      <input type="datetime-local" value={diagnosticoData.hora} onChange={e => setDiagnosticoData({ ...diagnosticoData, hora: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }} />
                      
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Diagnóstico Técnico:</label>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {['Frenos', 'Motor', 'Suspensión', 'Eléctrico', 'Llantas', 'Cambio de Aceite'].map(tag => (
                          <span key={tag} onClick={() => agregarTextoRapido('diagnostico', tag)} style={{ backgroundColor: '#e0e0e0', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#333' }}>
                            + {tag}
                          </span>
                        ))}
                      </div>
                      <textarea rows="3" placeholder="Describa el diagnóstico y repuestos requeridos..." value={diagnosticoData.texto} onChange={e => setDiagnosticoData({ ...diagnosticoData, texto: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }} />
                      
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Firma del Técnico:</label>
                      <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 10px auto', display: 'flex', justifyContent: 'center' }}>
                        <SignatureCanvas ref={diagSigCanvas} canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }} />
                      </div>
                      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <button type="button" onClick={() => diagSigCanvas.current?.clear()} style={{ padding: '4px 12px', fontSize: '0.8rem', backgroundColor: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          Limpiar firma
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => setDiagnosticoAbiertoId(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" style={{ flex: 2, padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Diagnóstico</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => handleAbrirDiagnostico(solicitud.id)} style={{ width: '100%', padding: '12px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                      ✍️ Añadir Diagnóstico
                    </button>
                  )}
                </div>
              </details>
            )) : (
              <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
                <p style={{ margin: 0 }}>🎉 No hay diagnósticos pendientes.</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== PESTAÑA 2: EN REPARACIÓN ==================== */}
        {tabActiva === 'reparacion' && (
          <div>
            {listaReparacion.length > 0 ? listaReparacion.map(solicitud => (
              <details key={solicitud.id} style={{ backgroundColor: 'white', marginBottom: '12px', borderRadius: '10px', border: '1px solid #e0e0e0', borderLeft: '5px solid #1565c0', overflow: 'hidden' }}>
                <summary style={{ padding: '14px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', outline: 'none', gap: '10px' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#222' }}>{solicitud.placa_vehiculo}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>({solicitud.nombre_vehiculo})</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>• ID #{solicitud.id}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#1565c0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px' }}>
                      <strong>🔧 Aprobado:</strong> {solicitud.diagnostico_taller}
                    </p>
                  </div>
                  <span style={{ backgroundColor: '#e3f2fd', color: '#1565c0', padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    En Taller
                  </span>
                </summary>

                <div style={{ padding: '18px', borderTop: '1px solid #eee' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#1565c0', backgroundColor: '#e3f2fd', padding: '5px 10px', borderRadius: '5px', display: 'inline-block' }}>
                    <strong>📅 Aprobado el:</strong> {solicitud.fecha_aprobacion_rechazo ? new Date(solicitud.fecha_aprobacion_rechazo).toLocaleString('es-CO') : 'Sin fecha'}
                  </p>
                  <div style={{ backgroundColor: '#e8eaf6', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 5px 0', color: '#283593' }}><strong>✅ Diagnóstico Autorizado:</strong> {solicitud.diagnostico_taller}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#5c6bc0' }}>Aprobó: {solicitud.nombre_coordinador || 'Coordinación'}</p>
                  </div>

                  {/* BOTONES DE ACCIÓN PARA EL TALLER */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                    <button onClick={() => generarOrdenAutorizadaPDF(solicitud)} style={{ flex: '1 1 240px', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #2e7d32', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                      📄 Descargar Orden Autorizada
                    </button>
                    <button onClick={() => handleReportarFueraServicio(solicitud.id, solicitud.placa_vehiculo)} style={{ flex: '1 1 240px', padding: '10px', backgroundColor: '#ffebee', color: '#b71c1c', border: '1px solid #b71c1c', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                      🚨 Reportar Fuera de Servicio
                    </button>
                  </div>

                  {finalizacionAbiertaId === solicitud.id ? (
                    <form onSubmit={handleFinalizarReparacion} style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '12px', marginTop: '10px' }}>
                      <h5 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>🏁 Finalizar Reparación</h5>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Hora de Salida:</label>
                      <input type="datetime-local" value={finalizacionData.hora_salida_taller} onChange={e => setFinalizacionData({ ...finalizacionData, hora_salida_taller: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }} />

                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Trabajos Realizados:</label>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {['Cambio de Aceite', 'Ajuste de Frenos', 'Alineación', 'Revisión General'].map(tag => (
                          <span key={tag} onClick={() => agregarTextoRapido('trabajo', tag)} style={{ backgroundColor: '#bbdefb', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#0d47a1' }}>
                            + {tag}
                          </span>
                        ))}
                      </div>
                      <textarea rows="3" value={finalizacionData.trabajos_realizados} onChange={e => setFinalizacionData({ ...finalizacionData, trabajos_realizados: e.target.value })} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }} />

                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Repuestos Utilizados:</label>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {['Pastillas', 'Filtro', 'Aceite', 'Ninguno'].map(tag => (
                          <span key={tag} onClick={() => agregarTextoRapido('repuesto', tag)} style={{ backgroundColor: '#bbdefb', padding: '5px 10px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer', color: '#0d47a1' }}>
                            + {tag}
                          </span>
                        ))}
                      </div>
                      <textarea rows="2" placeholder="Opcional..." value={finalizacionData.repuestos_utilizados} onChange={e => setFinalizacionData({ ...finalizacionData, repuestos_utilizados: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }} />

                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Firma de Finalización:</label>
                      <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 10px auto', display: 'flex', justifyContent: 'center' }}>
                        <SignatureCanvas ref={finalSigCanvas} canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }} />
                      </div>
                      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <button type="button" onClick={() => finalSigCanvas.current?.clear()} style={{ padding: '4px 12px', fontSize: '0.8rem', backgroundColor: '#bbdefb', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0d47a1' }}>
                          Limpiar firma
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => setFinalizacionAbiertaId(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#bbdefb', color: '#0d47a1', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" style={{ flex: 2, padding: '12px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar Entrega</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => handleAbrirFinalizacion(solicitud.id)} style={{ width: '100%', padding: '12px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                      🏁 Registrar Reparación Terminada
                    </button>
                  )}
                </div>
              </details>
            )) : (
              <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
                <p style={{ margin: 0 }}>No hay vehículos en reparación activa.</p>
              </div>
            )}
          </div>
        )}

        {/* ==================== PESTAÑA 3: HISTORIAL CON PAGINACIÓN LIGERA ==================== */}
        {tabActiva === 'historial' && (
          <div>
            {listaHistorialVisible.length > 0 ? (
              <>
                {listaHistorialVisible.map(s => {
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
                            <strong>Trabajo:</strong> {s.trabajos_realizados || s.diagnostico_taller || s.necesidad_reportada}
                          </p>
                        </div>
                        <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          {s.estado}
                        </span>
                      </summary>

                      <div style={{ padding: '18px', borderTop: '1px solid #eee' }}>
                        <div style={{ padding: '15px 12px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '0.85rem', color: '#444' }}>
                          <div style={{ borderLeft: '2px solid #ccc', paddingLeft: '15px', marginLeft: '5px' }}>
                            <div style={{ position: 'relative', marginBottom: '14px' }}>
                              <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#0288d1', fontSize: '1rem' }}>●</span>
                              <p style={{ margin: 0, color: '#0288d1' }}><strong>1️⃣ Solicitud Inicial</strong> ({new Date(s.fecha_creacion).toLocaleString('es-CO')})</p>
                              <p style={{ margin: '4px 0 0 0' }}>{s.necesidad_reportada} <small style={{ color: '#666' }}>(Conductor: {s.nombre_conductor})</small></p>
                            </div>

                            {s.diagnostico_taller && (
                              <div style={{ position: 'relative', marginBottom: '14px' }}>
                                <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#f57c00', fontSize: '1rem' }}>●</span>
                                <p style={{ margin: 0, color: '#f57c00' }}><strong>2️⃣ Diagnóstico Taller</strong> ({s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'Sin fecha'})</p>
                                <p style={{ margin: '4px 0 0 0' }}>{s.diagnostico_taller} <small style={{ color: '#666' }}>(Técnico: {s.nombre_tecnico || 'Taller'})</small></p>
                              </div>
                            )}

                            {s.fecha_aprobacion_rechazo && (
                              <div style={{ position: 'relative', marginBottom: '14px' }}>
                                <span style={{ position: 'absolute', left: '-22px', top: '0', color: s.motivo_rechazo ? '#d32f2f' : '#388e3c', fontSize: '1rem' }}>●</span>
                                <p style={{ margin: 0, color: s.motivo_rechazo ? '#d32f2f' : '#388e3c' }}><strong>3️⃣ Decisión Coordinación</strong> ({new Date(s.fecha_aprobacion_rechazo).toLocaleString('es-CO')})</p>
                                <p style={{ margin: '4px 0 0 0' }}>{s.motivo_rechazo ? `Rechazado: ${s.motivo_rechazo}` : 'Aprobado'}</p>
                              </div>
                            )}

                            {s.trabajos_realizados && (
                              <div style={{ position: 'relative', marginBottom: s.fecha_cierre_proceso ? '14px' : '0' }}>
                                <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#1976d2', fontSize: '1rem' }}>●</span>
                                <p style={{ margin: 0, color: '#1976d2' }}><strong>4️⃣ Reparación Realizada</strong> ({s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'Sin fecha'})</p>
                                <p style={{ margin: '4px 0 0 0' }}>{s.trabajos_realizados} <br /><small>Repuestos: {s.repuestos_utilizados || 'Ninguno'}</small></p>
                              </div>
                            )}

                            {s.fecha_cierre_proceso && (
                              <div style={{ position: 'relative', marginBottom: '0' }}>
                                <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#388e3c', fontSize: '1rem' }}>●</span>
                                <p style={{ margin: 0, color: '#388e3c' }}><strong>5️⃣ Cierre Operativo</strong> ({new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')})</p>
                                <p style={{ margin: '4px 0 0 0' }}>Observaciones: {s.observaciones_entrega_conductor || 'Ninguna'}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {permiteOrdenPDF && (
                          <button onClick={() => generarOrdenAutorizadaPDF(s)} style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #2e7d32', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                            📄 Descargar Orden Autorizada (PDF)
                          </button>
                        )}
                      </div>
                    </details>
                  );
                })}

                {/* BOTÓN CARGAR MÁS SI HAY MUCHOS REGISTROS */}
                {!busqueda && listaHistorialCompleta.length > limiteHistorial && (
                  <button
                    onClick={() => setLimiteHistorial(prev => prev + 25)}
                    style={{ width: '100%', padding: '12px', marginTop: '10px', backgroundColor: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    👇 Mostrar más registros ({listaHistorialVisible.length} de {listaHistorialCompleta.length})
                  </button>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
                <p style={{ margin: 0 }}>No hay trabajos que coincidan con la búsqueda.</p>
              </div>
            )}
          </div>
        )}

      </section>
    </main>
  );
};

export default TallerDashboard;