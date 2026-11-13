import React, { useState, useEffect } from 'react';
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

  // 2. ESTADOS
  const [solicitudes, setSolicitudes] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [observacionesInputs, setObservacionesInputs] = useState({}); 
  const sigCanvases = {}; // Referencias para las firmas de satisfacción (conductor)
  
  // 🚀 NUEVO: Estados y referencias para la firma del taller externo
  const sigCanvasesTaller = {}; 
  const [mostrarFirmaTaller, setMostrarFirmaTaller] = useState({});
  const [nombreTallerInputs, setNombreTallerInputs] = useState({});

  // 3. CARGA DE DATOS
  const cargarDatos = async () => {
    try {
      const res = await api.get('/solicitudes/conductor');
      setSolicitudes(res.data);
    } catch (error) {
      console.error("Error cargando solicitudes", error);
      alert("Error al cargar el historial de solicitudes. Verifique su conexión.");
    }
  };

  useEffect(() => { cargarDatos(); }, []);
  
  // 4. MANEJO DE LA CONFIRMACIÓN DE ENTREGA (Original)
  const handleSatisfaccion = async (id) => {
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
        
        setObservacionesInputs(prev => ({ ...prev, [id]: '' }));
        cargarDatos();
        alert("Entrega confirmada correctamente. El proceso ha pasado a cierre administrativo.");
    } catch(error) {
        console.error("Error al confirmar satisfacción", error);
        alert("No se pudo registrar la confirmación.");
    }
  };

  const handleObservacionChange = (id, texto) => {
    setObservacionesInputs(prev => ({ ...prev, [id]: texto }));
  };

  // 🚀 NUEVO: Manejo de entrega a Taller Externo (Firma del Mecánico)
  const handleNombreTallerChange = (id, texto) => {
      setNombreTallerInputs(prev => ({ ...prev, [id]: texto }));
  };

  const handleFirmaTallerExterno = async (id) => {
      const nombreRecibe = nombreTallerInputs[id] || '';
      
      if (!nombreRecibe.trim()) {
          alert("Debe ingresar el nombre de quien recibe en el taller.");
          return;
      }
      
      if (sigCanvasesTaller[id].isEmpty()) {
          alert("El encargado del taller externo debe firmar el documento.");
          return;
      }

      const firmaBase64 = sigCanvasesTaller[id].toDataURL();

      try {
          // Llama al nuevo endpoint que creamos en el backend
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


  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
  };

  const getStatusColor = (estado) => {
      const status = estado?.toLowerCase() || '';
      if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100' };
      if (status.includes('taller') || status.includes('aprobado')) return { bg: '#e3f2fd', text: '#1565c0' };
      if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828' };
      if (status.includes('cierre') || status.includes('terminado') || status.includes('listo') || status.includes('reparación')) return { bg: '#e8f5e9', text: '#2e7d32' };
      return { bg: '#eeeeee', text: '#424242' };
  };

  // --- PDF ORDEN MEDIA CARTA (Modificado) ---
  const generarOrdenAutorizadaPDF = (solicitud) => {
    // 🚀 NUEVO: Si ya firmó el taller, tomamos el nombre de la BD, si no, preguntamos.
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
    
    // 🚀 NUEVO: Inyectar firma del taller externo en el PDF si existe
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

  return (
    <main style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#333' }}>Bienvenido, {nombreUsuario}</h2>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Panel de Conductor | Sede: {nombreSede}</span>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Salir</button>
      </header>
      
      <button onClick={() => setMostrarFormulario(!mostrarFormulario)} style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: mostrarFormulario ? '#9e9e9e' : '#0288d1', color: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px rgba(2, 136, 209, 0.3)', marginBottom: '25px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.4rem' }}>{mostrarFormulario ? '➖' : '➕'}</span> 
        {mostrarFormulario ? 'Ocultar Formulario' : 'Crear Nueva Solicitud'}
      </button>

      {mostrarFormulario && (
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <NuevaSolicitudForm onSolicitudCreada={() => { setMostrarFormulario(false); cargarDatos(); }} />
        </div>
      )}
      
      <div>
          <h3 style={{ fontSize: '1.1rem', color: '#555', marginBottom: '15px', marginLeft: '5px' }}>Historial de Mis Solicitudes</h3>
          
          {solicitudes.length > 0 ? solicitudes.map(s => {
              const colores = getStatusColor(s.estado);
              return (
                  <div key={s.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `5px solid ${colores.text}` }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '1.1rem', color: '#222' }}>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong>
                          <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>{s.estado}</span>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#555' }}>
                          <strong>ID #{s.id}</strong> <br/> {new Date(s.fecha_creacion).toLocaleDateString('es-CO')}
                      </p>

                     {/* --- BOTÓN PARA PDF DE AUTORIZACIÓN (Disponible en todo el ciclo posterior a la aprobación) --- */}
                        {['Aprobado', 'En Reparación', 'Listo para Entrega', 'Pendiente de Cierre', 'Pendiente de Archivo', 'Proceso Finalizado'].includes(s.estado) && (
                        <button onClick={() => generarOrdenAutorizadaPDF(s)} style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', border: '2px solid #2e7d32', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        📄 Descargar Orden Autorizada
                        </button>
                        )}

                      {/* 🚀 NUEVO: SECCIÓN DE FIRMA TALLER EXTERNO (Se muestra si está aprobado o en reparación y aún no ha sido entregado) */}
                      {s.estado === 'En Reparación' && !s.firma_proveedor_externo && (
                        <div style={{ marginTop: '15px' }}>
                            <button 
                                onClick={() => setMostrarFirmaTaller(prev => ({ ...prev, [s.id]: !prev[s.id] }))} 
                                style={{ width: '100%', padding: '10px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}>
                                {mostrarFirmaTaller[s.id] ? 'Cancelar Entrega a Taller' : 'Entregar a Taller Externo'}
                            </button>

                            {mostrarFirmaTaller[s.id] && (
                                <div style={{ marginTop: '15px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                                    <h5 style={{ margin: '0 0 10px 0', color: '#0288d1' }}>✍️ Firma del Taller / Mecánico</h5>
                                    
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
                                            ref={ref => { sigCanvasesTaller[s.id] = ref; }} 
                                            canvasProps={{width: 300, height: 150, className: 'sigCanvas'}} 
                                        />
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => sigCanvasesTaller[s.id].clear()} style={{ flex: 1, padding: '10px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Borrar</button>
                                        <button onClick={() => handleFirmaTallerExterno(s.id)} style={{ flex: 2, padding: '10px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Guardar Firma</button>
                                    </div>
                                </div>
                            )}
                        </div>
                      )}

                      {/* SECCIÓN DE CONFIRMACIÓN DE ENTREGA (FIRMA CONDUCTOR FINAL) */}
                      {s.estado === 'Listo para Entrega' && (
                        <div style={{ marginTop: '15px', borderTop: '2px dashed #4caf50', paddingTop: '15px' }}>
                          <h5 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>✅ Confirmar Recepción del Vehículo</h5>
                          <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 10px 0' }}>Por favor revise el vehículo y deje sus observaciones antes de firmar.</p>
                          
                          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Sus Observaciones:</label>
                          <textarea 
                            rows="2" 
                            placeholder="Ej: Recibo a satisfacción, vehículo limpio..."
                            value={observacionesInputs[s.id] || ''}
                            onChange={(e) => handleObservacionChange(s.id, e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />

                          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Firma Digital:</label>
                          <div style={{ border: '2px dashed #999', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                            <SignatureCanvas 
                                ref={ref => { sigCanvases[s.id] = ref; }} 
                                canvasProps={{width: 300, height: 150, className: 'sigCanvas'}} 
                            />
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => sigCanvases[s.id].clear()} style={{ flex: 1, padding: '12px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Borrar</button>
                              <button onClick={() => handleSatisfaccion(s.id)} style={{ flex: 2, padding: '12px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Confirmar y Enviar</button>
                          </div>
                        </div>
                      )}
                  </div>
              )
          }) : (
              <div style={{ textAlign: 'center', padding: '30px', backgroundColor: 'white', borderRadius: '12px', color: '#888' }}>
                  <p style={{ fontSize: '1.1rem' }}>No tienes solicitudes registradas en el historial.</p>
              </div>
          )}
      </div>
    </main>
  );
};

export default ConductorDashboard;