import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EstadoFlota from './EstadoFlota';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AdminDashboard = () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : { nombre_completo: 'Administrador' };

    const [vista, setVista] = useState('dashboard');
    const [usuarios, setUsuarios] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [sedes, setSedes] = useState([]);
    
    const [filtroSede, setFiltroSede] = useState('todas');
    const [datosInforme, setDatosInforme] = useState(null);
    const [fechas, setFechas] = useState({ inicio: '', fin: '' });
    
    const [busquedaUsuario, setBusquedaUsuario] = useState('');
    const [busquedaVehiculo, setBusquedaVehiculo] = useState('');
    const [busquedaSolicitud, setBusquedaSolicitud] = useState(''); 
    
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre_completo: '', email: '', password: '', rol: 'Conductor', sede_id: '' });
    const [nuevoVehiculo, setNuevoVehiculo] = useState({ nombre: '', placa: '', marca: '', modelo: '', sede_id: '' });

    // NUEVO ESTADO PARA EL ARCHIVO
    const [archivosUpload, setArchivosUpload] = useState({});
    const [subiendoArchivo, setSubiendoArchivo] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    const cargarDatos = async () => {
        try {
            if (sedes.length === 0) setSedes([{id: 1, nombre: 'Florencia'}, {id: 2, nombre: 'Popayán'}]);
            if (vista === 'informes' && !datosInforme) {
                const res = await api.get('/admin/informes/datos');
                setDatosInforme(res.data);
            } else if (vista === 'usuarios') {
                const res = await api.get('/admin/usuarios');
                setUsuarios(res.data);
            } else if (vista === 'vehiculos') {
                const res = await api.get('/vehiculos');
                setVehiculos(res.data);
            } else if (vista === 'solicitudes' || vista === 'archivo') {
                const res = await api.get(`/admin/solicitudes/todas?sede_id=${filtroSede}`);
                setSolicitudes(res.data);
            }
        } catch (error) { console.error(`Error cargando datos para ${vista}`, error); }
    };

    useEffect(() => {
        cargarDatos();
    }, [vista, filtroSede]);

    // --- FUNCIONES PARA SUBIR EVIDENCIA (ARCHIVOS) ---
    const handleFileSelect = (id, file) => {
        setArchivosUpload(prev => ({ ...prev, [id]: file }));
    };

    const handleSubirEvidencia = async (id) => {
        const file = archivosUpload[id];
        if (!file) return alert("Por favor, selecciona un archivo (PDF o Imagen) primero.");

        const formData = new FormData();
        formData.append('evidencia', file);

        setSubiendoArchivo(true);
        try {
            await api.put(`/solicitudes/archivo/subir-evidencia/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("✅ Evidencia subida a la nube y proceso FINALIZADO permanentemente.");
            setArchivosUpload(prev => {
                const nuevo = {...prev};
                delete nuevo[id];
                return nuevo;
            });
            cargarDatos(); // Recargar lista
        } catch (error) {
            console.error(error);
            alert("Error al subir el archivo. Verifica tu conexión.");
        } finally {
            setSubiendoArchivo(false);
        }
    };

    // --- FILTROS INTELIGENTES ---
    const solicitudesFiltradas = solicitudes.filter(s => {
        const termino = busquedaSolicitud.toLowerCase();
        return (
            s.placa_vehiculo?.toLowerCase().includes(termino) ||
            s.id?.toString().includes(termino) ||
            s.estado?.toLowerCase().includes(termino) ||
            s.nombre_conductor?.toLowerCase().includes(termino) ||
            s.necesidad_reportada?.toLowerCase().includes(termino)
        );
    });

    // Filtramos específicamente las pendientes de archivo
    const solicitudesParaArchivo = solicitudesFiltradas.filter(s => s.estado === 'Pendiente de Archivo');

    // --- EXPORTAR A EXCEL (CSV) ---
    const exportarAExcel = () => {
        if (solicitudesFiltradas.length === 0) return alert("No hay datos para exportar.");
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Placa,Conductor,Sede,Estado,Inoperativo,Fecha Solicitud,Falla Reportada,Tecnico,Diagnostico,Trabajo Realizado,Fecha Cierre,URL Soportes\n";
        
        solicitudesFiltradas.forEach(s => {
            const row = [
                s.id,
                s.placa_vehiculo,
                `"${s.nombre_conductor || ''}"`,
                s.nombre_sede,
                s.estado,
                s.fuera_de_servicio ? 'SI' : 'NO',
                s.fecha_creacion ? new Date(s.fecha_creacion).toLocaleDateString() : '',
                `"${(s.necesidad_reportada || '').replace(/"/g, '""')}"`,
                `"${s.nombre_tecnico || ''}"`,
                `"${(s.diagnostico_taller || '').replace(/"/g, '""')}"`,
                `"${(s.trabajos_realizados || '').replace(/"/g, '""')}"`,
                s.fecha_cierre_proceso ? new Date(s.fecha_cierre_proceso).toLocaleDateString() : '',
                s.url_evidencia_externa ? s.url_evidencia_externa : 'Sin soporte'
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Reporte_SGMV_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- EXPORTAR A PDF (TABULAR) ---
    const exportarAPDF = () => {
        if (solicitudesFiltradas.length === 0) return alert("No hay datos para exportar.");
        const doc = new jsPDF('landscape'); 
        
        doc.setFontSize(16);
        doc.text('Reporte General de Solicitudes SGMV', 14, 15);
        doc.setFontSize(10);
        doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 22);

        const tableColumn = ["ID", "Placa", "Sede", "Conductor", "Estado", "Falla Reportada", "Fecha Solicitud"];
        const tableRows = [];

        solicitudesFiltradas.forEach(s => {
            const rowData = [
                s.id,
                s.placa_vehiculo,
                s.nombre_sede || 'General',
                s.nombre_conductor,
                s.fuera_de_servicio ? `INOPERATIVO (${s.estado})` : s.estado,
                s.necesidad_reportada.length > 30 ? s.necesidad_reportada.substring(0, 30) + '...' : s.necesidad_reportada,
                new Date(s.fecha_creacion).toLocaleDateString()
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [44, 62, 80] }
        });

        doc.save(`Reporte_Solicitudes_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const generarOrdenAutorizadaPDF = (solicitud) => {
        const destinoExterno = window.prompt("¿A qué taller externo se enviará el vehículo?\nDeje en blanco si es para el Taller Interno:");
        const nombreDestino = destinoExterno && destinoExterno.trim() !== "" ? destinoExterno.toUpperCase() : "TALLER INTERNO";
        const doc = new jsPDF({ format: 'letter' });

        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('IPS MUTUAL SAS', 196, 14, { align: 'right' });
        doc.setFontSize(9); doc.setFont('helvetica', 'normal');
        doc.text('NIT: 901274906', 196, 19, { align: 'right' });
        doc.text('Dir: Calle 21N # 8-48 Ciudad Jardín', 196, 24, { align: 'right' });
        doc.text('Cel: 318 045 0369', 196, 29, { align: 'right' });
        doc.setLineWidth(0.5); doc.line(14, 33, 196, 33);
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('ORDEN DE SERVICIO EXTERNO Y REMISIÓN', 105, 40, { align: 'center' });
        doc.setFontSize(10); doc.text(`ID Solicitud: #${solicitud.id}`, 14, 46);
        doc.setFont('helvetica', 'normal'); doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 196, 46, { align: 'right' });

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
            theme: 'striped', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 9 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } }
        });

        let finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('AUTORIZACIÓN INTERNA', 14, finalY); doc.text('RECEPCIÓN (PROVEEDOR)', 120, finalY);
        finalY += 15;
        doc.line(14, finalY, 55, finalY);
        if (solicitud.firma_taller_diagnostico) doc.addImage(solicitud.firma_taller_diagnostico, 'PNG', 14, finalY - 14, 35, 12);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text('Técnico (Diagnóstico)', 14, finalY + 4);
        
        doc.line(65, finalY, 106, finalY);
        if (solicitud.firma_coordinacion_aprobacion) doc.addImage(solicitud.firma_coordinacion_aprobacion, 'PNG', 65, finalY - 14, 35, 12);
        doc.text('Coordinación (Aprueba)', 65, finalY + 4);

        doc.line(120, finalY, 196, finalY);
        doc.text(`Recibe: ${nombreDestino}`, 120, finalY + 4);
        doc.text('Firma legible / Sello del Taller', 120, finalY + 8);
        doc.text('Fecha: _____/_____/202___   Hora: ______:______', 120, finalY + 14);

        const corteY = Math.max(135, finalY + 25);
        doc.setDrawColor(150, 150, 150); doc.setLineDash([3, 3], 0); doc.line(10, corteY, 206, corteY);
        doc.setFontSize(8); doc.setTextColor(150); doc.text('✂️ Corte por esta línea para ahorrar papel', 105, corteY + 4, { align: 'center' });

        doc.save(`Remision_Servicio_${solicitud.placa_vehiculo || 'ID'}_ID${solicitud.id}.pdf`);
    };

    const handleCrearUsuario = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/usuarios', nuevoUsuario);
            alert('Usuario creado con éxito');
            setNuevoUsuario({ nombre_completo: '', email: '', password: '', rol: 'Conductor', sede_id: '' });
            cargarDatos();
        } catch (error) { alert(`Error: ${error.response?.data?.msg || error.message}`); }
    };

    const handleCrearVehiculo = async (e) => {
        e.preventDefault();
        try {
            await api.post('/vehiculos', nuevoVehiculo);
            alert('Vehículo creado con éxito');
            setNuevoVehiculo({ nombre: '', placa: '', marca: '', modelo: '', sede_id: '' });
            cargarDatos();
        } catch (error) { alert(`Error: ${error.response?.data?.msg || error.message}`); }
    };

    const handleCambiarSedeVehiculo = async (vehiculoId, nuevaSedeId) => {
        try {
            await api.put(`/vehiculos/${vehiculoId}/sede`, { sede_id: nuevaSedeId });
            cargarDatos(); alert('Sede actualizada correctamente');
        } catch (error) { alert('Error al cambiar la sede del vehículo'); }
    };

    const generarInforme = async () => {
        if (!fechas.inicio || !fechas.fin) return alert("Por favor, selecciona un rango de fechas.");
        try {
            const res = await api.get(`/admin/informes/datos?fecha_inicio=${fechas.inicio}&fecha_fin=${fechas.fin}&sede_id=${filtroSede}`);
            setDatosInforme(res.data);
        } catch (error) { alert("No se pudo generar el informe."); }
    };

    const usuariosFiltrados = usuarios.filter(u => 
        u.nombre_completo?.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
        u.email?.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
        u.rol?.toLowerCase().includes(busquedaUsuario.toLowerCase())
    );

    const vehiculosFiltrados = vehiculos.filter(v => 
        v.nombre?.toLowerCase().includes(busquedaVehiculo.toLowerCase()) ||
        v.placa?.toLowerCase().includes(busquedaVehiculo.toLowerCase())
    );

    const getStatusColor = (estado) => {
        const status = estado?.toLowerCase() || '';
        if (status.includes('pendiente de archivo')) return { bg: '#fff9c4', text: '#f57f17' }; // Amarillo/Naranja
        if (status.includes('pendiente') || status.includes('creada')) return { bg: '#fff3e0', text: '#e65100' };
        if (status.includes('taller') || status.includes('aprobado') || status.includes('reparacion') || status.includes('reparación')) return { bg: '#e3f2fd', text: '#1565c0' };
        if (status.includes('rechazado')) return { bg: '#ffebee', text: '#c62828' };
        if (status.includes('cierre') || status.includes('terminado') || status.includes('listo') || status.includes('finalizado')) return { bg: '#e8f5e9', text: '#2e7d32' };
        return { bg: '#eeeeee', text: '#424242' };
    };

    const chartDataEstado = {
        labels: datosInforme?.porEstado.map(d => d.estado) || [],
        datasets: [{ label: 'Número de Solicitudes', data: datosInforme?.porEstado.map(d => d.cantidad) || [], backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }]
    };
    const chartDataVehiculo = {
        labels: datosInforme?.porVehiculo.map(d => d.placa) || [],
        datasets: [{ label: 'Mantenimientos', data: datosInforme?.porVehiculo.map(d => d.cantidad) || [], backgroundColor: 'rgba(54, 162, 235, 0.6)' }]
    };

    return (
        <main style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '15px', backgroundColor: '#f4f7f6', minHeight: '100vh', boxSizing: 'border-box' }}>
            
            {/* CABECERA ADMIN UNIFICADA */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#333' }}>Panel de Administración</h2>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>Bienvenido, {user.nombre_completo || 'Admin'}</span>
                </div>
                <button onClick={handleLogout} style={{ backgroundColor: 'transparent', border: '1px solid #dc3545', color: '#dc3545', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Salir</button>
            </header>

            {/* NAVEGACIÓN TABS (NUEVA PESTAÑA ARCHIVO AÑADIDA) */}
            <nav style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '20px' }}>
                <button onClick={() => setVista('dashboard')} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: vista === 'dashboard' ? '#0288d1' : '#e0e0e0', color: vista === 'dashboard' ? 'white' : '#333', whiteSpace: 'nowrap' }}>📊 Estado Flota</button>
                <button onClick={() => setVista('archivo')} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: vista === 'archivo' ? '#f57c00' : '#e0e0e0', color: vista === 'archivo' ? 'white' : '#333', whiteSpace: 'nowrap' }}>📁 Archivo (Facturas)</button>
                <button onClick={() => setVista('solicitudes')} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: vista === 'solicitudes' ? '#0288d1' : '#e0e0e0', color: vista === 'solicitudes' ? 'white' : '#333', whiteSpace: 'nowrap' }}>📋 Auditoría Solicitudes</button>
                <button onClick={() => setVista('informes')} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: vista === 'informes' ? '#0288d1' : '#e0e0e0', color: vista === 'informes' ? 'white' : '#333', whiteSpace: 'nowrap' }}>Informes</button>
                <button onClick={() => setVista('usuarios')} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: vista === 'usuarios' ? '#0288d1' : '#e0e0e0', color: vista === 'usuarios' ? 'white' : '#333', whiteSpace: 'nowrap' }}>Usuarios</button>
                <button onClick={() => setVista('vehiculos')} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: vista === 'vehiculos' ? '#0288d1' : '#e0e0e0', color: vista === 'vehiculos' ? 'white' : '#333', whiteSpace: 'nowrap' }}>Vehículos</button>
            </nav>

            {/* --- VISTA 1: DASHBOARD --- */}
            {vista === 'dashboard' && <EstadoFlota />}

            {/* --- VISTA NUEVA: ARCHIVO DE FACTURAS --- */}
            {vista === 'archivo' && (
                <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, color: '#e65100' }}>📁 Recepción de Soportes y Cierre Definitivo</h3>
                        <span style={{ backgroundColor: '#fff3e0', color: '#e65100', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
                            Pendientes: {solicitudesParaArchivo.length}
                        </span>
                    </div>
                    
                    <p style={{ color: '#666', marginBottom: '20px' }}>
                        Sube la foto de la factura, cuenta de cobro o remisión del taller para finalizar el proceso administrativamente en el sistema.
                    </p>

                    <div>
                        {solicitudesParaArchivo.length > 0 ? solicitudesParaArchivo.map(s => (
                            <div key={s.id} style={{ backgroundColor: '#fcfcfc', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <div>
                                        <strong style={{ fontSize: '1.1rem' }}>{s.placa_vehiculo} | ID #{s.id}</strong><br/>
                                        <span style={{ fontSize: '0.85rem', color: '#555' }}>Vehículo: {s.nombre_vehiculo} - Sede: {s.nombre_sede || 'General'}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#888' }}>Entregado el:</span><br/>
                                        <strong>{new Date(s.fecha_cierre_proceso || s.hora_salida_taller).toLocaleDateString()}</strong>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '250px' }}>
                                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>Adjuntar Soportes (PDF/JPG/PNG):</label>
                                        <input 
                                            type="file" 
                                            accept=".pdf, image/*" 
                                            onChange={(e) => handleFileSelect(s.id, e.target.files[0])}
                                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} 
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleSubirEvidencia(s.id)}
                                        disabled={subiendoArchivo || !archivosUpload[s.id]}
                                        style={{ 
                                            padding: '10px 20px', backgroundColor: (subiendoArchivo || !archivosUpload[s.id]) ? '#ccc' : '#f57c00', 
                                            color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (subiendoArchivo || !archivosUpload[s.id]) ? 'not-allowed' : 'pointer' 
                                        }}
                                    >
                                        {subiendoArchivo && archivosUpload[s.id] ? 'Subiendo nube...' : '☁️ Subir y Archivar'}
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                                <p style={{ color: '#888', fontSize: '1.1rem', margin: 0 }}>🎉 No hay vehículos pendientes de soportes físicos.</p>
                            </div>
                        )}
                    </div>
                </article>
            )}

            {/* --- VISTA 2: INFORMES --- */}
            {vista === 'informes' && (
                <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Generar Informes Estadísticos</h3>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Desde:</label>
                            <input type="date" value={fechas.inicio} onChange={e => setFechas({...fechas, inicio: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Hasta:</label>
                            <input type="date" value={fechas.fin} onChange={e => setFechas({...fechas, fin: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Filtrar por Sede:</label>
                            <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}>
                                <option value="todas">Todas las Sedes</option>
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    <button onClick={generarInforme} style={{ padding: '12px 24px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Actualizar Gráficos</button>
                    
                    {datosInforme && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '30px' }}>
                            <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px' }}>
                                <h5>Estado de Solicitudes</h5>
                                <Pie data={chartDataEstado} />
                            </div>
                            <div style={{ flex: 2, minWidth: '400px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px' }}>
                                <h5>Mantenimientos por Vehículo</h5>
                                <Bar data={chartDataVehiculo} />
                            </div>
                        </div>
                    )}
                </article>
            )}

            {/* --- VISTA 3: USUARIOS --- */}
            {vista === 'usuarios' && (
                <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Gestión de Usuarios</h3>
                    <form onSubmit={handleCrearUsuario} style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                            <input type="text" placeholder="Nombre completo" value={nuevoUsuario.nombre_completo} onChange={e => setNuevoUsuario({...nuevoUsuario, nombre_completo: e.target.value})} required style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}/>
                            <input type="email" placeholder="Email" value={nuevoUsuario.email} onChange={e => setNuevoUsuario({...nuevoUsuario, email: e.target.value})} required style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}/>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                            <input type="password" placeholder="Contraseña" value={nuevoUsuario.password} onChange={e => setNuevoUsuario({...nuevoUsuario, password: e.target.value})} required style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}/>
                            <select value={nuevoUsuario.rol} onChange={e => setNuevoUsuario({...nuevoUsuario, rol: e.target.value})} required style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>
                                <option value="Conductor">Conductor</option>
                                <option value="Taller">Taller</option>
                                <option value="Coordinacion">Coordinacion</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                        <select value={nuevoUsuario.sede_id} onChange={e => setNuevoUsuario({...nuevoUsuario, sede_id: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}>
                            <option value="">-- Selecciona una Sede --</option>
                            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                        <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Crear Usuario</button>
                    </form>
                    
                    <input type="search" placeholder="🔍 Buscar usuario..." value={busquedaUsuario} onChange={(e) => setBusquedaUsuario(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }} />

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#eeeeee' }}>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Nombre</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Email</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Rol</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Sede</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuariosFiltrados.length > 0 ? usuariosFiltrados.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px' }}>{u.nombre_completo}</td>
                                        <td style={{ padding: '12px' }}>{u.email}</td>
                                        <td style={{ padding: '12px' }}>{u.rol}</td>
                                        <td style={{ padding: '12px' }}>{u.nombre_sede || 'N/A'}</td>
                                    </tr>
                                )) : <tr><td colSpan="4" style={{textAlign: 'center', padding: '15px'}}>No se encontraron usuarios.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}
            
            {/* --- VISTA 4: VEHÍCULOS --- */}
            {vista === 'vehiculos' && (
                <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Gestión de Vehículos</h3>
                    <form onSubmit={handleCrearVehiculo} style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                         <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                           <input type="text" placeholder="Nombre (ej: Ambulancia 02)" value={nuevoVehiculo.nombre} onChange={e => setNuevoVehiculo({...nuevoVehiculo, nombre: e.target.value})} required style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}/>
                           <input type="text" placeholder="Placa" value={nuevoVehiculo.placa} onChange={e => setNuevoVehiculo({...nuevoVehiculo, placa: e.target.value})} required style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}/>
                         </div>
                         <select value={nuevoVehiculo.sede_id} onChange={e => setNuevoVehiculo({...nuevoVehiculo, sede_id: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}>
                           <option value="">-- Selecciona una Sede --</option>
                           {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                         </select>
                         <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#0288d1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Crear Vehículo</button>
                    </form>

                    <input type="search" placeholder="🔍 Buscar placa o vehículo..." value={busquedaVehiculo} onChange={(e) => setBusquedaVehiculo(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '15px', boxSizing: 'border-box' }}/>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#eeeeee' }}>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Vehículo</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Placa</th>
                                    <th style={{ padding: '12px', borderBottom: '2px solid #ccc' }}>Sede Actual</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehiculosFiltrados.length > 0 ? vehiculosFiltrados.map(v => (
                                    <tr key={v.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px' }}>{v.nombre}</td>
                                        <td style={{ padding: '12px' }}><strong>{v.placa}</strong></td>
                                        <td style={{ padding: '12px' }}>
                                            <select value={v.sede_id || ''} onChange={(e) => handleCambiarSedeVehiculo(v.id, e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}>
                                                <option value="" disabled>Seleccionar...</option>
                                                {sedes.map(sede => ( <option key={sede.id} value={sede.id}>{sede.nombre}</option> ))}
                                            </select>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan="3" style={{textAlign: 'center', padding: '15px'}}>No se encontraron vehículos.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </article>
            )}

            {/* --- VISTA 5: SOLICITUDES Y AUDITORÍA --- */}
            {vista === 'solicitudes' && (
                <article style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', gap: '15px' }}>
                        <h3 style={{ margin: 0 }}>Auditoría de Solicitudes</h3>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={exportarAExcel} style={{ padding: '10px 15px', backgroundColor: '#1d6f42', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                📊 Exportar Excel
                            </button>
                            <button onClick={exportarAPDF} style={{ padding: '10px 15px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                📄 Exportar PDF
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
                        <div style={{ flex: 1, minWidth: '250px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>🔍 Buscador Universal:</label>
                            <input 
                                type="search" 
                                placeholder="Placa, Conductor, Estado o Falla..." 
                                value={busquedaSolicitud} 
                                onChange={e => setBusquedaSolicitud(e.target.value)} 
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', fontSize: '0.9rem' }}>🏢 Filtrar por Sede:</label>
                            <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}>
                                <option value="todas">Todas las Sedes</option>
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        {solicitudesFiltradas.length > 0 ? solicitudesFiltradas.map(s => {
                            const colores = getStatusColor(s.estado);
                            return(
                            <details key={s.id} style={{ backgroundColor: 'white', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden' }}>
                                <summary style={{ padding: '15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa', borderBottom: '1px solid #eee', outline: 'none' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <strong style={{ fontSize: '1.1rem' }}>{s.placa_vehiculo} <span style={{ color: '#888', fontSize: '0.85rem' }}>| ID #{s.id}</span></strong>
                                        <span style={{ fontSize: '0.85rem', color: '#555' }}>Sede: {s.nombre_sede || 'General'}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {s.fuera_de_servicio && (
                                            <span style={{ backgroundColor: '#333', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                ⚫ INOPERATIVO
                                            </span>
                                        )}
                                        <span style={{ backgroundColor: colores.bg, color: colores.text, padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                            {s.estado}
                                        </span>
                                    </div>
                                </summary>
                                
                                <div style={{ padding: '20px', backgroundColor: 'white' }}>
                                    <div style={{ borderLeft: '3px solid #e0e0e0', paddingLeft: '20px', marginLeft: '10px' }}>
                                        
                                        {/* LÍNEA DE TIEMPO DEL TICKET */}
                                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                                            <span style={{ position: 'absolute', left: '-28px', top: '0', color: '#0288d1', fontSize: '1.2rem', backgroundColor: 'white' }}>●</span>
                                            <p style={{ margin: 0, color: '#0288d1', fontSize: '1rem' }}><strong>1. Solicitud Inicial</strong></p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>📅 {new Date(s.fecha_creacion).toLocaleString('es-CO')}</p>
                                        </div>

                                        {s.diagnostico_taller && (
                                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                                            <span style={{ position: 'absolute', left: '-28px', top: '0', color: '#f57c00', fontSize: '1.2rem', backgroundColor: 'white' }}>●</span>
                                            <p style={{ margin: 0, color: '#f57c00', fontSize: '1rem' }}><strong>2. Diagnóstico Taller</strong></p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>📅 {s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'Sin fecha'}</p>
                                        </div>
                                        )}

                                        {s.fecha_aprobacion_rechazo && (
                                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                                            <span style={{ position: 'absolute', left: '-28px', top: '0', color: s.motivo_rechazo ? '#d32f2f' : '#388e3c', fontSize: '1.2rem', backgroundColor: 'white' }}>●</span>
                                            <p style={{ margin: 0, color: s.motivo_rechazo ? '#d32f2f' : '#388e3c', fontSize: '1rem' }}><strong>3. Decisión Coordinación</strong></p>
                                        </div>
                                        )}

                                        {s.trabajos_realizados && (
                                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                                            <span style={{ position: 'absolute', left: '-28px', top: '0', color: '#1976d2', fontSize: '1.2rem', backgroundColor: 'white' }}>●</span>
                                            <p style={{ margin: 0, color: '#1976d2', fontSize: '1rem' }}><strong>4. Reparación Realizada</strong></p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>📅 {s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'Sin fecha'}</p>
                                        </div>
                                        )}

                                        {s.fecha_cierre_proceso && (
                                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                                            <span style={{ position: 'absolute', left: '-28px', top: '0', color: '#388e3c', fontSize: '1.2rem', backgroundColor: 'white' }}>●</span>
                                            <p style={{ margin: 0, color: '#388e3c', fontSize: '1rem' }}><strong>5. Cierre Operativo</strong></p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>📅 {new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')}</p>
                                        </div>
                                        )}

                                        {s.url_evidencia_externa && (
                                        <div style={{ position: 'relative', marginBottom: '0' }}>
                                            <span style={{ position: 'absolute', left: '-28px', top: '0', color: '#9c27b0', fontSize: '1.2rem', backgroundColor: 'white' }}>●</span>
                                            <p style={{ margin: 0, color: '#9c27b0', fontSize: '1rem' }}><strong>6. Soportes Archivados</strong></p>
                                            <a href={s.url_evidencia_externa} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '10px', padding: '8px 15px', backgroundColor: '#f3e5f5', color: '#6a1b9a', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                📎 Ver Documento Adjunto
                                            </a>
                                        </div>
                                        )}
                                    </div>
                                </div>
                            </details>
                        )}) : (
                            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
                                <p style={{ color: '#888', fontSize: '1.1rem', margin: 0 }}>No hay solicitudes que coincidan con la búsqueda.</p>
                            </div>
                        )}
                    </div>
                </article>
            )}
        </main>
    );
};

export default AdminDashboard;