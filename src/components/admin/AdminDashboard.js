import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import EstadoFlota from './EstadoFlota'; // Asegúrate de tener este componente creado

// Registrar componentes de gráficos
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AdminDashboard = () => {
    // Estado de la vista actual
    const [vista, setVista] = useState('dashboard');
    
    // Estados de datos
    const [usuarios, setUsuarios] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [sedes, setSedes] = useState([]);
    
    // Estados de filtros y formularios
    const [filtroSede, setFiltroSede] = useState('todas');
    const [datosInforme, setDatosInforme] = useState(null);
    const [fechas, setFechas] = useState({ inicio: '', fin: '' });
    
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre_completo: '', email: '', password: '', rol: 'Conductor', sede_id: '' });
    const [nuevoVehiculo, setNuevoVehiculo] = useState({ nombre: '', placa: '', marca: '', modelo: '', sede_id: '' });

    // Efecto para cerrar sesión
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const cargarDatos = async () => {
            try {
                // Cargar sedes si no están (hardcoded inicial o API futura)
                if (sedes.length === 0) {
                    setSedes([{id: 1, nombre: 'Florencia'}, {id: 2, nombre: 'Popayán'}]);
                }

                // Carga dinámica según la vista
                if (vista === 'informes' && !datosInforme) {
                    const res = await api.get('/admin/informes/datos');
                    setDatosInforme(res.data);
                } else if (vista === 'usuarios') {
                    const res = await api.get('/admin/usuarios');
                    setUsuarios(res.data);
                } else if (vista === 'vehiculos') {
                    const res = await api.get('/vehiculos');
                    setVehiculos(res.data);
                }
            } catch (error) { 
                console.error(`Error cargando datos para ${vista}`, error); 
            }
        };

        // Si la vista no es de recarga, cargamos datos
        if (!vista.includes('_reload')) {
            cargarDatos();
        }
    }, [vista, datosInforme, sedes.length]);
    
    // Efecto específico para filtrar solicitudes cuando cambia el select
    useEffect(() => {
        const cargarSolicitudesFiltradas = async () => {
            if (vista === 'solicitudes') {
                try {
                    const res = await api.get(`/admin/solicitudes/todas?sede_id=${filtroSede}`);
                    setSolicitudes(res.data);
                } catch (error) { 
                    console.error("Error al filtrar solicitudes", error); 
                }
            }
        };
        cargarSolicitudesFiltradas();
    }, [vista, filtroSede]);

    // --- MANEJADORES DE ACCIONES (HANDLERS) ---

    const handleCrearUsuario = async (e) => {
        e.preventDefault();
        if (!nuevoUsuario.sede_id) return alert('Por favor, selecciona una sede.');
        try {
            await api.post('/admin/usuarios', nuevoUsuario);
            alert('Usuario creado con éxito');
            setNuevoUsuario({ nombre_completo: '', email: '', password: '', rol: 'Conductor', sede_id: '' });
            
            // RECARGA AUTOMÁTICA
            const res = await api.get('/admin/usuarios');
            setUsuarios(res.data);
            
        } catch (error) { alert(`Error: ${error.response?.data?.msg || error.message || 'Error desconocido'}`); }
    };

    const handleCrearVehiculo = async (e) => {
        e.preventDefault();
        if (!nuevoVehiculo.sede_id) return alert('Por favor, selecciona una sede.');
        try {
            await api.post('/vehiculos', nuevoVehiculo);
            alert('Vehículo creado con éxito');
            setNuevoVehiculo({ nombre: '', placa: '', marca: '', modelo: '', sede_id: '' });
            
            // RECARGA AUTOMÁTICA
            const res = await api.get('/vehiculos');
            setVehiculos(res.data);

        } catch (error) { alert(`Error: ${error.response?.data?.msg || error.message || 'Error desconocido'}`); }
    };

    const generarInforme = async () => {
        if (!fechas.inicio || !fechas.fin) return alert("Por favor, selecciona un rango de fechas.");
        try {
            const res = await api.get(`/admin/informes/datos?fecha_inicio=${fechas.inicio}&fecha_fin=${fechas.fin}&sede_id=${filtroSede}`);
            setDatosInforme(res.data);
        } catch (error) {
            console.error("Error al generar el informe", error);
            alert("No se pudo generar el informe.");
        }
    };

    // Datos para los gráficos
    const chartDataEstado = {
        labels: datosInforme?.porEstado.map(d => d.estado) || [],
        datasets: [{
            label: 'Número de Solicitudes',
            data: datosInforme?.porEstado.map(d => d.cantidad) || [],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        }]
    };
    const chartDataVehiculo = {
        labels: datosInforme?.porVehiculo.map(d => d.placa) || [],
        datasets: [{
            label: 'Mantenimientos',
            data: datosInforme?.porVehiculo.map(d => d.cantidad) || [],
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }]
    };

    return (
        <main className="container">
            {/* --- NAVEGACIÓN SUPERIOR --- */}
            <nav style={{marginBottom: '2rem'}}>
                <ul>
                    <li><strong>Panel de Administración</strong></li>
                </ul>
                <ul>
                    <li><button onClick={handleLogout} className="outline secondary">Cerrar Sesión</button></li>
                </ul>
            </nav>

            <nav>
                <ul>
                    <li><a href="#dashboard" role="button" className={vista === 'dashboard' ? '' : 'outline contrast'} onClick={(e) => {e.preventDefault(); setVista('dashboard')}}>📊 Estado Flota</a></li>
                    <li><a href="#informes" role="button" className={vista === 'informes' ? '' : 'outline contrast'} onClick={(e) => {e.preventDefault(); setVista('informes')}}>Informes</a></li>
                    <li><a href="#usuarios" role="button" className={vista === 'usuarios' ? '' : 'outline contrast'} onClick={(e) => {e.preventDefault(); setVista('usuarios')}}>Usuarios</a></li>
                    <li><a href="#vehiculos" role="button" className={vista === 'vehiculos' ? '' : 'outline contrast'} onClick={(e) => {e.preventDefault(); setVista('vehiculos')}}>Vehículos</a></li>
                    <li><a href="#solicitudes" role="button" className={vista === 'solicitudes' ? '' : 'outline contrast'} onClick={(e) => {e.preventDefault(); setVista('solicitudes')}}>Solicitudes</a></li>
                </ul>
            </nav>

            <hr />

            {/* --- VISTA 1: DASHBOARD (ESTADO FLOTA) --- */}
            {vista === 'dashboard' && (
                <EstadoFlota />
            )}

            {/* --- VISTA 2: INFORMES --- */}
            {vista === 'informes' && (
                <article>
                    <header>Generar Informes</header>
                    <div className="grid">
                        <label>Desde: <input type="date" value={fechas.inicio} onChange={e => setFechas({...fechas, inicio: e.target.value})} /></label>
                        <label>Hasta: <input type="date" value={fechas.fin} onChange={e => setFechas({...fechas, fin: e.target.value})} /></label>
                    </div>
                    <label>Filtrar por Sede:</label>
                    <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
                        <option value="todas">Todas las Sedes</option>
                        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                    <button onClick={generarInforme} style={{marginTop: '1rem'}}>Actualizar Gráficos</button>
                    
                    {datosInforme && (
                        <div className="grid" style={{marginTop: '2rem'}}>
                            <div style={{maxWidth: '400px', margin: 'auto'}}>
                                <h5>Por Estado</h5>
                                <Pie data={chartDataEstado} />
                            </div>
                            <div>
                                <h5>Por Vehículo</h5>
                                <Bar data={chartDataVehiculo} />
                            </div>
                        </div>
                    )}
                </article>
            )}

            {/* --- VISTA 3: USUARIOS --- */}
            {vista === 'usuarios' && (
                <article>
                    <header>Gestión de Usuarios</header>
                    <form onSubmit={handleCrearUsuario}>
                        <div className="grid">
                            <input type="text" placeholder="Nombre completo" value={nuevoUsuario.nombre_completo} onChange={e => setNuevoUsuario({...nuevoUsuario, nombre_completo: e.target.value})} required/>
                            <input type="email" placeholder="Email" value={nuevoUsuario.email} onChange={e => setNuevoUsuario({...nuevoUsuario, email: e.target.value})} required/>
                        </div>
                        <div className="grid">
                            <input type="password" placeholder="Contraseña" value={nuevoUsuario.password} onChange={e => setNuevoUsuario({...nuevoUsuario, password: e.target.value})} required/>
                            <select value={nuevoUsuario.rol} onChange={e => setNuevoUsuario({...nuevoUsuario, rol: e.target.value})} required>
                                <option value="Conductor">Conductor</option>
                                <option value="Taller">Taller</option>
                                <option value="Coordinacion">Coordinacion</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
                        <label>Sede:</label>
                        <select value={nuevoUsuario.sede_id} onChange={e => setNuevoUsuario({...nuevoUsuario, sede_id: e.target.value})} required>
                            <option value="">-- Selecciona una Sede --</option>
                            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                        <button type="submit" style={{marginTop: '1rem'}}>Crear Usuario</button>
                    </form>
                    <hr/>
                    <figure>
                        <table>
                           <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Sede</th></tr></thead>
                            <tbody>{usuarios.map(u => <tr key={u.id}><td>{u.nombre_completo}</td><td>{u.email}</td><td>{u.rol}</td><td>{u.nombre_sede || 'N/A'}</td></tr>)}</tbody>
                        </table>
                    </figure>
                </article>
            )}
            
            {/* --- VISTA 4: VEHÍCULOS --- */}
            {vista === 'vehiculos' && (
                <article>
                    <header>Gestión de Vehículos</header>
                    <form onSubmit={handleCrearVehiculo}>
                         <div className="grid">
                           <input type="text" placeholder="Nombre (ej: Ambulancia 02)" value={nuevoVehiculo.nombre} onChange={e => setNuevoVehiculo({...nuevoVehiculo, nombre: e.target.value})} required/>
                           <input type="text" placeholder="Placa" value={nuevoVehiculo.placa} onChange={e => setNuevoVehiculo({...nuevoVehiculo, placa: e.target.value})} required/>
                         </div>
                         <label>Sede:</label>
                         <select value={nuevoVehiculo.sede_id} onChange={e => setNuevoVehiculo({...nuevoVehiculo, sede_id: e.target.value})} required>
                           <option value="">-- Selecciona una Sede --</option>
                           {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                         </select>
                         <button type="submit" style={{marginTop: '1rem'}}>Crear Vehículo</button>
                    </form>
                    <hr/>
                    <figure>
                        <table>
                            <thead><tr><th>Nombre</th><th>Placa</th><th>Sede</th></tr></thead>
                            <tbody>
                                {vehiculos.map(v => (
                                    <tr key={v.id}>
                                        <td>{v.nombre}</td>
                                        <td>{v.placa}</td>
                                        <td>{v.nombre_sede || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </figure>
                </article>
            )}

            {/* --- VISTA 5: SOLICITUDES (TRAZABILIDAD COMPLETA) --- */}
            {vista === 'solicitudes' && (
                <article>
                    <header>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span>Historial Global de Solicitudes</span>
                            <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={{maxWidth: '200px'}}>
                                <option value="todas">Ver Todas las Sedes</option>
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                    </header>
                    
                    {solicitudes.length > 0 ? solicitudes.map(s => (
                        <details key={s.id} style={{marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem'}}>
                            <summary>
                                <strong>ID #{s.id}</strong> | {s.nombre_vehiculo} ({s.placa_vehiculo}) | Estado: <mark>{s.estado}</mark>
                            </summary>
                            
                            <div style={{paddingLeft: '1rem', borderLeft: '3px solid var(--pico-primary)', marginTop: '1rem', fontSize: '0.9rem'}}>
                                <p><strong>📍 Sede:</strong> {s.nombre_sede}</p>
                                
                                {/* Etapa 1: Solicitud */}
                                <div style={{marginBottom: '1rem'}}>
                                    <strong>1️⃣ Solicitud Inicial</strong>
                                    <ul style={{margin: 0}}>
                                        <li><strong>Conductor:</strong> {s.nombre_conductor}</li>
                                        <li><strong>Fecha:</strong> {new Date(s.fecha_creacion).toLocaleString('es-CO')}</li>
                                        <li><strong>Necesidad:</strong> {s.necesidad_reportada}</li>
                                    </ul>
                                </div>

                                {/* Etapa 2: Diagnóstico */}
                                {s.diagnostico_taller && (
                                    <div style={{marginBottom: '1rem'}}>
                                        <strong>2️⃣ Diagnóstico Taller</strong>
                                        <ul style={{margin: 0}}>
                                            <li><strong>Técnico:</strong> {s.nombre_tecnico || 'Taller'}</li>
                                            <li><strong>Fecha Ingreso:</strong> {s.hora_ingreso_taller ? new Date(s.hora_ingreso_taller).toLocaleString('es-CO') : 'N/A'}</li>
                                            <li><strong>Diagnóstico:</strong> {s.diagnostico_taller}</li>
                                        </ul>
                                    </div>
                                )}

                                {/* Etapa 3: Decisión */}
                                {s.fecha_aprobacion_rechazo && (
                                    <div style={{marginBottom: '1rem'}}>
                                        <strong>3️⃣ Decisión Coordinación</strong>
                                        <ul style={{margin: 0}}>
                                            <li><strong>Coordinador:</strong> {s.nombre_coordinador || 'Coordinación'}</li>
                                            <li><strong>Fecha:</strong> {new Date(s.fecha_aprobacion_rechazo).toLocaleString('es-CO')}</li>
                                            <li><strong>Decisión:</strong> {s.motivo_rechazo ? <span style={{color:'red'}}>Rechazado</span> : <span style={{color:'green'}}>Aprobado</span>}</li>
                                            {s.motivo_rechazo && <li><strong style={{color:'red'}}>Motivo:</strong> {s.motivo_rechazo}</li>}
                                        </ul>
                                    </div>
                                )}
                                
                                {/* Etapa 4: Reparación */}
                                {s.trabajos_realizados && (
                                    <div style={{marginBottom: '1rem'}}>
                                        <strong>4️⃣ Reparación Realizada</strong>
                                        <ul style={{margin: 0}}>
                                            <li><strong>Fecha Salida:</strong> {s.hora_salida_taller ? new Date(s.hora_salida_taller).toLocaleString('es-CO') : 'N/A'}</li>
                                            <li><strong>Trabajos:</strong> {s.trabajos_realizados}</li>
                                            <li><strong>Repuestos:</strong> {s.repuestos_utilizados || 'Ninguno'}</li>
                                        </ul>
                                    </div>
                                )}

                                {/* Etapa 5: Cierre */}
                                {s.fecha_cierre_proceso && (
                                    <div style={{marginBottom: '1rem'}}>
                                        <strong>5️⃣ Cierre y Entrega</strong>
                                        <ul style={{margin: 0}}>
                                            <li><strong>Fecha Cierre Final:</strong> {new Date(s.fecha_cierre_proceso).toLocaleString('es-CO')}</li>
                                            <li><strong>Observación Conductor:</strong> {s.observaciones_entrega_conductor || 'Sin observaciones'}</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </details>
                    )) : <p>No hay solicitudes registradas.</p>}
                </article>
            )}
        </main>
    );
};

export default AdminDashboard;