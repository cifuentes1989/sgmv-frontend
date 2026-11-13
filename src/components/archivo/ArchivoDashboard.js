/* eslint-disable */
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ArchivoDashboard = () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Usuario Archivo' };

    const [solicitudes, setSolicitudes] = useState([]);
    const [filtroTexto, setFiltroTexto] = useState(''); // Nuevo estado para la búsqueda
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);

    const cargarDatos = async () => {
        try {
            const res = await api.get('/admin/solicitudes/todas');
            const dataSegura = Array.isArray(res.data) ? res.data : [];
            
            // Filtramos los estados correspondientes al ciclo de archivo
            const pendientes = dataSegura.filter(s => 
                ['En Reparación', 'Listo para Entrega', 'Pendiente de Cierre', 'Pendiente de Archivo'].includes(s.estado)
            );
            setSolicitudes(pendientes);
        } catch (error) { 
            console.error('Error cargando datos:', error);
            setSolicitudes([]); 
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    // --- LÓGICA DE PDF INTERNO ---
    const generarOrdenAutorizadaPDF = (solicitud) => {
        const doc = new jsPDF({ format: 'letter' });
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('IPS MUTUAL SAS', 196, 14, { align: 'right' });
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('NIT: 901274906', 196, 19, { align: 'right' });
        doc.text('Dir: Calle 21N # 8-48 Ciudad Jardín', 196, 24, { align: 'right' });
        doc.text('Cel: 318 045 0369', 196, 29, { align: 'right' });
        doc.setLineWidth(0.5); doc.line(14, 33, 196, 33);
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        doc.text('ORDEN DE SERVICIO Y REMISIÓN', 105, 40, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`ID Solicitud: #${solicitud.id}`, 14, 46);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 196, 46, { align: 'right' });

        autoTable(doc, {
            startY: 50,
            head: [['Detalle', 'Información']],
            body: [
                ['Placa del Vehículo', solicitud.placa_vehiculo || 'N/A'],
                ['Sede Origen', solicitud.sede_id === 1 ? 'Florencia' : 'Popayán'],
                ['Conductor', solicitud.nombre_conductor || 'N/A'],
                ['Falla Reportada', solicitud.necesidad_reportada || 'N/A'],
                ['Diagnóstico', solicitud.diagnostico_taller || 'N/A']
            ],
            theme: 'striped', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 9 }
        });
        doc.save(`Remision_${solicitud.placa_vehiculo}_ID${solicitud.id}.pdf`);
    };

    // --- COMPONENTE DE TARJETA INDIVIDUAL ---
    const TarjetaSolicitud = ({ s }) => {
        const [fileIngreso, setFileIngreso] = useState(null);
        const [fileSalida, setFileSalida] = useState(null);

        const handleUploadIngreso = async () => {
            if (!fileIngreso) return alert("Seleccione el documento de ingreso.");
            setSubiendoArchivo(true);
            const formData = new FormData();
            formData.append('evidencia', fileIngreso);
            try {
                await api.put(`/archivo/subir-ingreso/${s.id}`, formData);
                alert("Documento de ingreso subido con éxito.");
                cargarDatos();
            } catch (error) { console.error(error); alert("Error al subir ingreso."); }
            finally { setSubiendoArchivo(false); }
        };

        const handleUploadSalidaYCerrar = async () => {
            if (!fileSalida) return alert("Seleccione el documento de salida.");
            if (!s.url_doc_ingreso) return alert("Debe subir el documento de ingreso primero.");
            
            setSubiendoArchivo(true);
            const formData = new FormData();
            formData.append('evidencia', fileSalida);
            try {
                await api.put(`/archivo/subir-salida-cierre/${s.id}`, formData);
                alert("Proceso cerrado definitivamente.");
                cargarDatos();
            } catch (error) { console.error(error); alert("Error al subir salida."); }
            finally { setSubiendoArchivo(false); }
        };

        // Extraer fecha para auditoría de tiempos
        const fechaAuditoria = s.fecha_recepcion_taller || s.hora_ingreso_taller || s.fecha_creacion;

        return (
            <div style={{ backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
                    <div>
                        <strong style={{ fontSize: '1.2rem', color: '#333' }}>{s.placa_vehiculo} | ID #{s.id}</strong><br/>
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>Vehículo: {s.nombre_vehiculo} | Estado Actual: <b>{s.estado}</b></span><br/>
                        {fechaAuditoria && (
                            <span style={{ fontSize: '0.85rem', color: '#888' }}>
                                ⏳ Radicado el: {new Date(fechaAuditoria).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* 1. DOCUMENTO DE INGRESO */}
                <div style={{ backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#0288d1' }}>1. Soportes de Ingreso al Taller</h4>
                    {s.url_doc_ingreso ? (
                        <p style={{ color: '#2e7d32', margin: 0, fontWeight: 'bold' }}>✅ Ingreso Registrado <a href={s.url_doc_ingreso} target="_blank" rel="noreferrer" style={{ marginLeft: '10px', color: '#0288d1' }}>(Ver Documento)</a></p>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="file" onChange={(e) => setFileIngreso(e.target.files[0])} accept=".pdf,image/*" style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '200px' }} />
                            <button onClick={handleUploadIngreso} disabled={subiendoArchivo} style={{ backgroundColor: '#0288d1', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                                {subiendoArchivo ? 'Subiendo...' : 'Subir Ingreso'}
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. DOCUMENTO DE SALIDA Y CIERRE */}
                <div style={{ backgroundColor: s.url_doc_ingreso ? '#fff3e0' : '#f5f5f5', border: '1px solid #ffe0b2', padding: '15px', borderRadius: '8px', opacity: s.url_doc_ingreso ? 1 : 0.6 }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#e65100' }}>2. Soportes de Salida y Cierre Definitivo</h4>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="file" onChange={(e) => setFileSalida(e.target.files[0])} accept=".pdf,image/*" disabled={!s.url_doc_ingreso} style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '200px' }} />
                        <button onClick={handleUploadSalidaYCerrar} disabled={!s.url_doc_ingreso || subiendoArchivo} style={{ backgroundColor: s.url_doc_ingreso ? '#2e7d32' : '#9e9e9e', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: s.url_doc_ingreso ? 'pointer' : 'not-allowed' }}>
                            {subiendoArchivo ? 'Cerrando...' : 'Subir Salida y Finalizar'}
                        </button>
                    </div>
                </div>

                {/* 3. PDF INTERNO */}
                <div style={{ marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '15px', textAlign: 'center' }}>
                    <button onClick={() => generarOrdenAutorizadaPDF(s)} style={{ backgroundColor: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📄 Descargar Orden Interna del Sistema (PDF)
                    </button>
                </div>
            </div>
        );
    };

    // Aplicar el filtro de búsqueda
    const solicitudesFiltradas = solicitudes.filter(s => 
        (s.placa_vehiculo && s.placa_vehiculo.toLowerCase().includes(filtroTexto.toLowerCase())) || 
        (s.id && s.id.toString().includes(filtroTexto))
    );

    return (
        <main style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
            
            {/* Encabezado limpio sin botones redundantes */}
            <header style={{ backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#e65100' }}>Módulo de Recepción y Cierre Documental</h2>
                <span style={{ fontSize: '0.9rem', color: '#666' }}>Gestión a cargo de: <strong>{user.nombre_completo}</strong></span>
            </header>

            <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#333' }}>Expedientes Pendientes ({solicitudesFiltradas.length})</h3>
                        <p style={{ color: '#666', margin: '5px 0 0 0' }}>Sube el documento de ingreso al llegar al taller, y el de salida al finalizar la reparación.</p>
                    </div>

                    {/* BARRA DE BÚSQUEDA */}
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar por placa (ej. IZC151) o ID del ticket..." 
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        style={{ width: '100%', padding: '12px 15px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box', backgroundColor: '#f9f9f9' }}
                    />
                </div>

                <div>
                    {solicitudesFiltradas.length > 0 ? solicitudesFiltradas.map(s => (
                        <TarjetaSolicitud key={s.id} s={s} />
                    )) : (
                        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                            <p style={{ color: '#888', fontSize: '1.1rem', margin: 0 }}>
                                {filtroTexto ? 'No se encontraron expedientes con esa búsqueda.' : '🎉 ¡Excelente! No hay expedientes pendientes por gestionar.'}
                            </p>
                        </div>
                    )}
                </div>
            </article>
        </main>
    );
};

export default ArchivoDashboard;