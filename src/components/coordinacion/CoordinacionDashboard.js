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
  
  // NUEVO: ESTADO PARA EL BUSCADOR
  const [busqueda, setBusqueda] = useState('');
  
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

  // --- FUNCIÓN: CERRAR SESIÓN ---
  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
  };

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

  // --- 5. GENERADOR DE PDF PROFESIONAL (INTACTO) ---
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

  // --- FUNCIÓN DE COLORES DE ESTADO ---
  const getStatusColor = (estado) => {
    const status = estado?.toLowerCase() || '';
    if (status.includes('pendiente')) return { bg: '#fff3e0', text: '#e65100' };
    if (status.includes('taller') || status.includes('aprobado')) return { bg: '#e3f2fd', text: '#1565c0' };
    if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828' };
    if (status.includes('cierre') || status.includes('terminado') || status.includes('finalizado')) return { bg: '#e8f5e9', text: '#2e7d32' };
    return { bg: '#eeeeee', text: '#424242' };
  };

  // NUEVO: Filtro para el buscador
  const filtrarLista = (lista) => lista.filter(s => 
      s.placa_vehiculo?.toLowerCase().includes(busqueda.toLowerCase()) || 
      s.id?.toString().includes(busqueda) || 
      s.nombre_vehiculo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <main style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* --- CABECERA RESPONSIVA --- */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '15px' }}>
          <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{nombreUsuario}</h2>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>Coordinación | Sede: {nombreSede}</span>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Salir
          </button>
      </header>

      {mensaje && (
          <div style={{ backgroundColor: '#e3f2fd', color: '#0d47a1', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', fontWeight: 'bold' }}>
              {mensaje}
          </div>
      )}

      {/* --- BUSCADOR FLOTANTE --- */}
      <div style={{ marginBottom: '20px' }}>
          <input 
            type="search" placeholder="🔍 Buscar por Placa, Vehículo o ID..." 
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}
          />
      </div>

      {/* 1. APROBACIONES PENDIENTES */}
      <details open style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <summary style={{ padding: '15px', backgroundColor: '#fff3e0', color: '#e65100', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
            ⚖️ Solicitudes por Aprobar ({filtrarLista(porAprobar).length})
        </summary>
        <div style={{ padding: '15px' }}>
            {filtrarLista(porAprobar).length > 0 ? filtrarLista(porAprobar).map(s => (
            
            /* TARJETA COMPACTA (ACORDEÓN) */
            <details key={s.id} style={{ backgroundColor: '#f9f9f9', marginBottom: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                <summary style={{ padding: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', outline: 'none' }}>
                    <span>{s.placa_vehiculo} <small style={{color: '#0d47a1', marginLeft: '5px'}}>⏳ Revisar Diagnóstico</small></span>
                    <span style={{color: '#888'}}>ID #{s.id}</span>
                </summary>

                <div style={{ padding: '15px', borderTop: '1px solid #eee' }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Vehículo:</strong> {s.nombre_vehiculo}</p>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Conductor:</strong> {s.nombre_conductor}</p>
                    <p style={{ margin: '0 0 10px 0' }}><strong>Falla Inicial:</strong> {s.necesidad_reportada}</p>

                    {/* CUADRO RESALTADO: EL DIAGNÓSTICO DEL TALLER */}
                    <div style={{ backgroundColor: '#e3f2fd', borderLeft: '4px solid #1565c0', padding: '12px', borderRadius: '0 8px 8px 0', fontSize: '0.95rem', marginBottom: '15px' }}>
                        <p style={{ margin: 0, color: '#0d47a1' }}><strong>🛠️ Diagnóstico Taller:</strong> {s.diagnostico_taller}</p>
                    </div>
                    
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>Su Firma para Decisión:</label>
                    <div style={{ border: '2px dashed #ccc', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                        <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150, className: 'sigCanvas'}} />
                    </div>
                    
                    {/* BOTONES LADO A LADO PARA CELULAR */}
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
            )) : <p style={{ color: '#888', textAlign: 'center', padding: '10px' }}>No hay solicitudes pendientes de aprobación.</p>}
        </div>
      </details>

      {/* 2. CIERRES PENDIENTES */}
      <details open style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <summary style={{ padding: '15px', backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
            🔒 Procesos Pendientes de Cierre ({filtrarLista(porCerrar).length})
        </summary>
        <div style={{ padding: '15px' }}>
            {filtrarLista(porCerrar).length > 0 ? filtrarLista(porCerrar).map(s => (
            
            /* TARJETA COMPACTA */
            <details key={s.id} style={{ backgroundColor: '#f9f9f9', marginBottom: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                <summary style={{ padding: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', outline: 'none' }}>
                    <span>{s.placa_vehiculo} <small style={{color: '#2e7d32', marginLeft: '5px'}}>✔️ Listo para cierre</small></span>
                    <span style={{color: '#888'}}>ID #{s.id}</span>
                </summary>

                <div style={{ padding: '15px', borderTop: '1px solid #eee' }}>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Vehículo:</strong> {s.nombre_vehiculo}</p>
                    <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '8px', marginBottom: '15px', borderLeft: '3px solid #ccc' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.85rem', color: '#555' }}><strong>Feedback del Conductor al Recibir:</strong></p>
                        <p style={{ margin: 0, fontStyle: 'italic', color: '#333' }}>"{s.observaciones_entrega_conductor || "Sin observaciones"}"</p>
                    </div>
                    
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>Firma de Cierre Final:</label>
                    <div style={{ border: '2px dashed #ccc', borderRadius: '8px', width: '100%', maxWidth: '300px', height: '150px', backgroundColor: 'white', margin: '0 auto 15px auto', display: 'flex', justifyContent: 'center' }}>
                        <SignatureCanvas ref={ref => { sigCanvases[s.id] = ref; }} canvasProps={{width: 300, height: 150, className: 'sigCanvas'}} />
                    </div>
                    
                    <button onClick={() => handleCierre(s.id)} style={{ width: '100%', padding: '14px', backgroundColor: '#37474f', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        🗄️ Firmar y Archivar Caso
                    </button>
                </div>
            </details>
            )) : <p style={{ color: '#888', textAlign: 'center', padding: '10px' }}>No hay procesos pendientes de cierre.</p>}
        </div>
      </details>

      {/* 3. HISTORIAL COMPLETO CON NUEVA LÍNEA DE TIEMPO */}
      <details style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <summary style={{ padding: '15px', backgroundColor: '#eeeeee', color: '#424242', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
            📚 Historial Completo ({filtrarLista(historialCompleto).length})
        </summary>
        <div style={{ padding: '15px' }}>
            {filtrarLista(historialCompleto).length > 0 ? filtrarLista(historialCompleto).map(s => {
                const colores = getStatusColor(s.estado);
                return (
                <div key={s.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '1rem', color: '#333' }}>{s.nombre_vehiculo} ({s.placa_vehiculo})</strong>
                        <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center' }}>
                            {s.estado}
                        </span>
                    </div>
                    
                    {/* --- LÍNEA DE TIEMPO DE TRAZABILIDAD --- */}
                    <details style={{ outline: 'none', marginTop: '10px' }}>
                        <summary style={{ cursor: 'pointer', color: '#0288d1', fontSize: '0.9rem', fontWeight: '600', padding: '5px 0' }}>
                            ⏳ Ver Trazabilidad y Tiempos
                        </summary>
                        <div style={{ padding: '15px 12px', marginTop: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '0.85rem', color: '#444' }}>
                            <div style={{ borderLeft: '2px solid #ccc', paddingLeft: '15px', marginLeft: '5px' }}>
                                
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#0288d1', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#0288d1' }}><strong>1️⃣ Solicitud Inicial</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {new Date(s.fecha_creacion).toLocaleString('es-CO')}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.necesidad_reportada} <br/><small>(Por: {s.nombre_conductor})</small></p>
                                </div>

                                {s.diagnostico_taller && (
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#f57c00', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#f57c00' }}><strong>2️⃣ Diagnóstico Taller</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'Sin fecha registrada'}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.diagnostico_taller} <br/><small>(Técnico: {s.nombre_tecnico})</small></p>
                                </div>
                                )}

                                {s.fecha_aprobacion_rechazo && (
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: s.motivo_rechazo ? '#d32f2f' : '#388e3c', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: s.motivo_rechazo ? '#d32f2f' : '#388e3c' }}><strong>3️⃣ Decisión Coordinación</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {new Date(s.fecha_aprobacion_rechazo).toLocaleString('es-CO')}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.motivo_rechazo ? `Rechazado: ${s.motivo_rechazo}` : 'Aprobado'} <br/><small>(Coord: {s.nombre_coordinador})</small></p>
                                </div>
                                )}

                                {s.trabajos_realizados && (
                                <div style={{ position: 'relative', marginBottom: '15px' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#1976d2', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#1976d2' }}><strong>4️⃣ Reparación Realizada</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'Sin fecha registrada'}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>{s.trabajos_realizados} <br/><small>Repuestos: {s.repuestos_utilizados || 'Ninguno'}</small></p>
                                </div>
                                )}

                                {s.fecha_cierre_proceso && (
                                <div style={{ position: 'relative', marginBottom: '0' }}>
                                    <span style={{ position: 'absolute', left: '-22px', top: '2px', color: '#388e3c', fontSize: '1rem' }}>●</span>
                                    <p style={{ margin: 0, color: '#388e3c' }}><strong>5️⃣ Cierre del Proceso</strong></p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
                                        📅 {new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')}
                                    </p>
                                    <p style={{ margin: '4px 0 0 0' }}>Observaciones: {s.observaciones_entrega_conductor || 'Ninguna'}</p>
                                </div>
                                )}
                            </div>
                        </div>
                    </details>

                    {s.estado === 'Proceso Finalizado' && (
                        <button onClick={() => generarPDF(s)} style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: '#fff', color: '#0288d1', border: '2px solid #0288d1', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            📄 Descargar PDF Oficial
                        </button>
                    )}
                </div>
            )}) : <p style={{ color: '#888', textAlign: 'center', padding: '10px' }}>No hay solicitudes en el historial.</p>}
        </div>
      </details>
    </main>
  );
};

export default CoordinacionDashboard;