/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import NuevaSolicitudForm from './NuevaSolicitudForm';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ConductorDashboard = () => {
  // 1. LÓGICA DE USUARIO Y SEDE
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Conductor', sede_id: null };
  const nombreUsuario = user.nombre_completo || user.nombre || 'Conductor';
  const nombreSede = user.sede_id === 1 ? 'Florencia' : user.sede_id === 2 ? 'Popayán' : 'General';

  // 2. ESTADOS GENERALES Y DE NAVEGACIÓN
  const [solicitudes, setSolicitudes] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tabActiva, setTabActiva] = useState('activas'); // 'activas' | 'historial'
  const [busqueda, setBusqueda] = useState('');

  // Estados y referencias para firmas (usando useRef para evitar pérdida de trazos al escribir)
  const [observacionesInputs, setObservacionesInputs] = useState({});
  const sigCanvases = useRef({});

  const sigCanvasesTaller = useRef({});
  const [mostrarFirmaTaller, setMostrarFirmaTaller] = useState({});
  const [nombreTallerInputs, setNombreTallerInputs] = useState({});

  // 3. CARGA DE DATOS
  const cargarDatos = async () => {
    try {
      const res = await api.get('/solicitudes/conductor');
      setSolicitudes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error cargando solicitudes", error);
      alert("Error al cargar el historial de solicitudes. Verifique su conexión.");
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  // 4. MANEJO DE LA CONFIRMACIÓN DE ENTREGA (Conductor)
  const handleSatisfaccion = async (id) => {
    if (!sigCanvases.current[id] || sigCanvases.current[id].isEmpty()) {
      alert("Por favor, firme para confirmar la recepción del vehículo.");
      return;
    }

    const observacionTexto = observacionesInputs[id] || '';
    const firma_conductor_satisfaccion = sigCanvases.current[id].toDataURL();

    try {
      await api.put(`/solicitudes/satisfaccion/${id}`, {
        firma_conductor_satisfaccion,
        observaciones_entrega_conductor: observacionTexto
      });

      setObservacionesInputs(prev => ({ ...prev, [id]: '' }));
      cargarDatos();
      alert("Entrega confirmada correctamente. El proceso ha pasado a cierre administrativo.");
    } catch (error) {
      console.error("Error al confirmar satisfacción", error);
      alert("No se pudo registrar la confirmación.");
    }
  };

  const handleObservacionChange = (id, texto) => {
    setObservacionesInputs(prev => ({ ...prev, [id]: texto }));
  };

  // 5. MANEJO DE ENTREGA A TALLER EXTERNO (Firma del Mecánico)
  const handleNombreTallerChange = (id, texto) => {
    setNombreTallerInputs(prev => ({ ...prev, [id]: texto }));
  };

  const handleFirmaTallerExterno = async (id) => {
    const nombreRecibe = nombreTallerInputs[id] || '';

    if (!nombreRecibe.trim()) {
      alert("Debe ingresar el nombre de quien recibe en el taller.");
      return;
    }

    if (!sigCanvasesTaller.current[id] || sigCanvasesTaller.current[id].isEmpty()) {
      alert("El encargado del taller externo debe firmar el documento.");
      return;
    }

    const firmaBase64 = sigCanvasesTaller.current[id].toDataURL();

    try {
      await api.put(`/solicitudes/${id}/entrega-taller`, {
        firmaBase64,
        nombreRecibe
      });

      setMostrarFirmaTaller(prev => ({ ...prev, [id]: false }));
      setNombreTallerInputs(prev => ({ ...prev, [id]: '' }));
      cargarDatos();
      alert("Vehículo entregado al taller externo con éxito.");
    } catch (error) {
      console.error("Error al enviar firma del taller", error);
      alert("Ocurrió un error al registrar la firma del taller.");
    }
  };

  const getStatusColor = (estado) => {
    const status = estado?.toLowerCase() || '';
    if (status.includes('listo para entrega')) return { bg: '#fff8e1', text: '#f57f17', border: '#ffb300' };
    if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100', border: '#ff9800' };
    if (status.includes('taller') || status.includes('aprobado') || status.includes('reparación') || status.includes('reparacion')) return { bg: '#e3f2fd', text: '#1565c0', border: '#1e88e5' };
    if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828', border: '#e53935' };
    if (status.includes('cierre') || status.includes('terminado') || status.includes('finalizado')) return { bg: '#e8f5e9', text: '#2e7d32', border: '#43a047' };
    return { bg: '#eeeeee', text: '#424242', border: '#9e9e9e' };
  };

  // --- PDF ORDEN MEDIA CARTA ---
  const generarOrdenAutorizadaPDF = (solicitud) => {
    let nombreDestino = solicitud.nombre_quien_recibe || '';
    if (!nombreDestino) {
      const destinoExterno = window.prompt("¿A qué taller externo se enviará el vehículo? (Ej. CATERPILLAR)\nDeje en blanco si es para el Taller Interno:");
      nombreDestino = destinoExterno && destinoExterno.trim() !== "" ? destinoExterno.toUpperCase() : "TALLER INTERNO";
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
        ['Conductor Solicitante', solicitud.nombre_conductor || nombreUsuario],
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

    doc.save(`Remision_Servicio_${solicitud.placa_vehiculo || 'ID'}_ID${solicitud.id}.pdf`);
  };

  // --- FILTRADO Y CLASIFICACIÓN EN PESTAÑAS ---
  const solicitudesFiltradas = solicitudes.filter(s => {
    const q = busqueda.toLowerCase();
    return (
      (s.placa_vehiculo && s.placa_vehiculo.toLowerCase().includes(q)) ||
      (s.nombre_vehiculo && s.nombre_vehiculo.toLowerCase().includes(q)) ||
      (s.id && s.id.toString().includes(q)) ||
      (s.necesidad_reportada && s.necesidad_reportada.toLowerCase().includes(q)) ||
      (s.trabajos_realizados && s.trabajos_realizados.toLowerCase().includes(q))
    );
  });

  const esFinalizada = (estado) => {
    const st = estado?.toLowerCase() || '';
    return st.includes('finalizado') || st.includes('rechazado') || st.includes('pendiente de archivo') || st.includes('pendiente de cierre');
  };

  const solicitudesActivas = solicitudesFiltradas.filter(s => !esFinalizada(s.estado));
  const solicitudesHistorial = solicitudesFiltradas.filter(s => esFinalizada(s.estado));

  const listaMostrar = tabActiva === 'activas' ? solicitudesActivas : solicitudesHistorial;

  return (
    <main style={{ width: '100%', maxWidth: '850px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* CABECERA LIMPIA SIN BOTÓN SALIR REDUNDANTE */}
      <header style={{ backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0288d1' }}>Mis Solicitudes de Mantenimiento</h2>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>Conductor: <strong>{nombreUsuario}</strong> | Sede: {nombreSede}</span>
      </header>

      {/* BOTÓN CREAR NUEVA SOLICITUD */}
      <button 
        onClick={() => setMostrarFormulario(!mostrarFormulario)} 
        style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 'bold', backgroundColor: mostrarFormulario ? '#757575' : '#0288d1', color: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px rgba(2, 136, 209, 0.25)', marginBottom: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
      >
        <span style={{ fontSize: '1.2rem' }}>{mostrarFormulario ? '➖' : '➕'}</span>
        {mostrarFormulario ? 'Ocultar Formulario' : 'Crear Nueva Solicitud'}
      </button>

      {mostrarFormulario && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <NuevaSolicitudForm onSolicitudCreada={() => { setMostrarFormulario(false); cargarDatos(); }} />
        </div>
      )}

      {/* PANEL DE CONSULTA Y TRAZABILIDAD */}
      <section style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        
        {/* BUSCADOR RÁPIDO */}
        <div style={{ marginBottom: '15px' }}>
          <input
            type="search"
            placeholder="🔍 Buscar por placa, ID o palabra clave (ej. frenos, aceite)..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.95rem', boxSizing: 'border-box', backgroundColor: '#f9f9f9' }}
          />
        </div>

        {/* PESTAÑAS (TABS) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
          <button
            onClick={() => setTabActiva('activas')}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabActiva === 'activas' ? '#0288d1' : '#f5f5f5', color: tabActiva === 'activas' ? 'white' : '#555' }}
          >
            ⚙️ En Proceso ({solicitudesActivas.length})
          </button>
          <button
            onClick={() => setTabActiva('historial')}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: tabActiva === 'historial' ? '#2e7d32' : '#f5f5f5', color: tabActiva === 'historial' ? 'white' : '#555' }}
          >
            📚 Historial Cerrado ({solicitudesHistorial.length})
          </button>
        </div>

        {/* LISTA DE SOLICITUDES COLAPSABLES */}
        <div>
          {listaMostrar.length > 0 ? listaMostrar.map(s => {
            const colores = getStatusColor(s.estado);
            const requiereFirmaConductor = s.estado === 'Listo para Entrega';

            return (
              <details 
                key={s.id} 
                open={requiereFirmaConductor} // Se abre sola si requiere acción urgente del conductor
                style={{ backgroundColor: 'white', borderRadius: '10px', marginBottom: '12px', border: '1px solid #e0e0e0', borderLeft: `5px solid ${colores.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                {/* CABECERA COMPACTA (Resumen sin abrir) */}
                <summary style={{ padding: '14px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', outline: 'none', gap: '10px' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#222' }}>{s.placa_vehiculo}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>({s.nombre_vehiculo})</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>• ID #{s.id} • {new Date(s.fecha_creacion).toLocaleDateString('es-CO')}</span>
                    </div>
                    {/* Vista previa de la falla en una sola línea */}
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '480px' }}>
                      <strong>Solicitud:</strong> {s.necesidad_reportada || 'Sin descripción'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '5px 10px', borderRadius: '15px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                      {s.estado}
                    </span>
                    {requiereFirmaConductor && (
                      <span style={{ fontSize: '0.7rem', color: '#d84315', fontWeight: 'bold' }}>⚠️ Firma pendiente</span>
                    )}
                  </div>
                </summary>

                {/* CONTENIDO DESPLEGABLE: TRAZABILIDAD Y ACCIONES */}
                <div style={{ padding: '15px 20px', borderTop: '1px solid #eee', backgroundColor: 'white' }}>
                  
                  {/* LÍNEA DE TIEMPO DE TRAZABILIDAD */}
                  <h5 style={{ margin: '0 0 12px 0', color: '#444', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📋 Trazabilidad de tu Solicitud
                  </h5>

                  <div style={{ borderLeft: '2px solid #ddd', paddingLeft: '15px', marginLeft: '6px', marginBottom: '15px' }}>
                    
                    {/* Paso 1: Lo que pidió el conductor */}
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                      <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#0288d1', backgroundColor: 'white' }}>●</span>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#0288d1' }}>1. Tu Reporte Inicial ({new Date(s.fecha_creacion).toLocaleString('es-CO')})</p>
                      <div style={{ marginTop: '4px', padding: '8px 10px', backgroundColor: '#f1f8fe', borderRadius: '6px', fontSize: '0.85rem', color: '#333' }}>
                        {s.necesidad_reportada || 'No especificado'}
                      </div>
                    </div>

                    {/* Paso 2: Diagnóstico del Taller */}
                    {s.diagnostico_taller && (
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#f57c00', backgroundColor: 'white' }}>●</span>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#f57c00' }}>
                          2. Diagnóstico del Taller {s.hora_ingreso_taller ? `(${new Date(s.hora_ingreso_taller).toLocaleDateString('es-CO')})` : ''}
                        </p>
                        <div style={{ marginTop: '4px', padding: '8px 10px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '0.85rem', color: '#333' }}>
                          {s.diagnostico_taller}
                        </div>
                      </div>
                    )}

                    {/* Paso 3: Decisión de Coordinación */}
                    {(s.firma_coordinacion_aprobacion || s.motivo_rechazo) && (
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '0', color: s.motivo_rechazo ? '#c62828' : '#2e7d32', backgroundColor: 'white' }}>●</span>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: s.motivo_rechazo ? '#c62828' : '#2e7d32' }}>
                          3. {s.motivo_rechazo ? 'Solicitud Rechazada por Coordinación' : 'Autorizado por Coordinación'}
                        </p>
                        {s.motivo_rechazo && (
                          <div style={{ marginTop: '4px', padding: '8px 10px', backgroundColor: '#ffebee', borderRadius: '6px', fontSize: '0.85rem', color: '#b71c1c' }}>
                            <strong>Motivo:</strong> {s.motivo_rechazo}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Paso 3.5: Entrega a Taller Externo (si aplica) */}
                    {s.nombre_quien_recibe && (
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#0288d1', backgroundColor: 'white' }}>●</span>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#0288d1' }}>Recepción en Taller Externo</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>Recibido por: <strong>{s.nombre_quien_recibe}</strong></p>
                      </div>
                    )}

                    {/* Paso 4: Qué le hicieron al vehículo */}
                    {s.trabajos_realizados && (
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#1565c0', backgroundColor: 'white' }}>●</span>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#1565c0' }}>
                          4. Trabajos Realizados {s.hora_salida_taller ? `(${new Date(s.hora_salida_taller).toLocaleDateString('es-CO')})` : ''}
                        </p>
                        <div style={{ marginTop: '4px', padding: '8px 10px', backgroundColor: '#e8eaf6', borderRadius: '6px', fontSize: '0.85rem', color: '#222' }}>
                          <div><strong>Mano de obra:</strong> {s.trabajos_realizados}</div>
                          {s.repuestos_utilizados && <div style={{ marginTop: '4px' }}><strong>Repuestos:</strong> {s.repuestos_utilizados}</div>}
                          {s.observaciones_taller && <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#555' }}><strong>Nota taller:</strong> {s.observaciones_taller}</div>}
                        </div>
                      </div>
                    )}

                    {/* Paso 5: Cierre / Recibido */}
                    {s.fecha_cierre_proceso && (
                      <div style={{ position: 'relative', marginBottom: '0' }}>
                        <span style={{ position: 'absolute', left: '-22px', top: '0', color: '#2e7d32', backgroundColor: 'white' }}>●</span>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: '#2e7d32' }}>
                          5. Vehículo Recibido ({new Date(s.fecha_cierre_proceso).toLocaleDateString('es-CO')})
                        </p>
                        {s.observaciones_entrega_conductor && (
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>Tu observación: "{s.observaciones_entrega_conductor}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* --- BOTÓN PARA PDF DE AUTORIZACIÓN --- */}
                  {['Aprobado', 'En Reparación', 'Listo para Entrega', 'Pendiente de Cierre', 'Pendiente de Archivo', 'Proceso Finalizado'].includes(s.estado) && (
                    <button 
                      onClick={() => generarOrdenAutorizadaPDF(s)} 
                      style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #2e7d32', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}
                    >
                      📄 Descargar Orden Autorizada (PDF)
                    </button>
                  )}

                  {/* --- SECCIÓN DE FIRMA TALLER EXTERNO --- */}
                  {s.estado === 'En Reparación' && !s.firma_proveedor_externo && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={() => setMostrarFirmaTaller(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}
                      >
                        {mostrarFirmaTaller[s.id] ? 'Cancelar Entrega a Taller' : '✍️ Registrar Entrega a Taller Externo'}
                      </button>

                      {mostrarFirmaTaller[s.id] && (
                        <div style={{ marginTop: '12px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                          <h5 style={{ margin: '0 0 10px 0', color: '#0288d1' }}>Firma del Taller / Mecánico</h5>

                          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.85rem' }}>Nombre de quien recibe:</label>
                          <input
                            type="text"
                            placeholder="Ej: Taller CAT / Juan Pérez"
                            value={nombreTallerInputs[s.id] || ''}
                            onChange={(e) => handleNombreTallerChange(s.id, e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}
                          />

                          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.85rem' }}>Firma del Mecánico/Taller:</label>
                          <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                            <SignatureCanvas
                              ref={ref => { sigCanvasesTaller.current[s.id] = ref; }}
                              canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="button" onClick={() => sigCanvasesTaller.current[s.id]?.clear()} style={{ flex: 1, padding: '10px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Borrar</button>
                            <button type="button" onClick={() => handleFirmaTallerExterno(s.id)} style={{ flex: 2, padding: '10px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Firma</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- SECCIÓN DE CONFIRMACIÓN DE ENTREGA (FIRMA CONDUCTOR FINAL) --- */}
                  {s.estado === 'Listo para Entrega' && (
                    <div style={{ marginTop: '15px', borderTop: '2px dashed #4caf50', paddingTop: '15px' }}>
                      <h5 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>✅ Confirmar Recepción del Vehículo</h5>
                      <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 10px 0' }}>Revise los trabajos realizados arriba y deje sus observaciones antes de firmar.</p>

                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.85rem' }}>Sus Observaciones:</label>
                      <textarea
                        rows="2"
                        placeholder="Ej: Recibo a satisfacción, frenos probados..."
                        value={observacionesInputs[s.id] || ''}
                        onChange={(e) => handleObservacionChange(s.id, e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />

                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.85rem' }}>Firma Digital del Conductor:</label>
                      <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                        <SignatureCanvas
                          ref={ref => { sigCanvases.current[s.id] = ref; }}
                          canvasProps={{ width: 300, height: 150, className: 'sigCanvas' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" onClick={() => sigCanvases.current[s.id]?.clear()} style={{ flex: 1, padding: '12px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Borrar</button>
                        <button type="button" onClick={() => handleSatisfaccion(s.id)} style={{ flex: 2, padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Confirmar y Enviar</button>
                      </div>
                    </div>
                  )}

                </div>
              </details>
            );
          }) : (
            <div style={{ textAlign: 'center', padding: '35px', backgroundColor: '#f9f9f9', borderRadius: '12px', color: '#888' }}>
              <p style={{ fontSize: '1rem', margin: 0 }}>
                {busqueda ? 'No se encontraron solicitudes con esa búsqueda.' : tabActiva === 'activas' ? '🎉 No tienes solicitudes activas en este momento.' : 'Aún no tienes solicitudes en el historial cerrado.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default ConductorDashboard;