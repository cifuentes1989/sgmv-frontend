import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AdminDashboard = () => {
    const [vista, setVista] = useState('solicitudes');
    const [usuarios, setUsuarios] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [sedes, setSedes] = useState([]);
    const [filtroSede, setFiltroSede] = useState('todas');
    const [datosInforme, setDatosInforme] = useState(null);
    const [fechas, setFechas] = useState({ inicio: '', fin: '' });
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre_completo: '', email: '', password: '', rol: 'Conductor', sede_id: '' });
    const [nuevoVehiculo, setNuevoVehiculo] = useState({ nombre: '', placa: '', marca: '', modelo: '', sede_id: '' });
    
    useEffect(() => {
        const cargarDatos = async () => {
            try {
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
                if (sedes.length === 0) {
                    // En un futuro, esto debería venir de una ruta GET /api/sedes
                    setSedes([{id: 1, nombre: 'Florencia'}, {id: 2, nombre: 'Popayán'}]);
                }
            } catch (error) { console.error(`Error cargando datos para ${vista}`, error); }
        };

        if (!vista.includes('_reload')) {
            cargarDatos();
        }
    }, [vista, datosInforme, sedes.length]);
    
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

    const handleCrearUsuario = async (e) => {
        e.preventDefault();
        if (!nuevoUsuario.sede_id) return alert('Por favor, selecciona una sede.');
        try {
            await api.post('/admin/usuarios', nuevoUsuario);
            alert('Usuario creado con éxito');
            setNuevoUsuario({ nombre_completo: '', email: '', password: '', rol: 'Conductor', sede_id: '' });
            setVista('usuarios_reload'); // Truco para forzar recarga
            setVista('usuarios');
        } catch (error) { alert(`Error: ${error.response?.data?.msg || 'Error desconocido'}`); }
    };

    const handleCrearVehiculo = async (e) => {
        e.preventDefault();
        if (!nuevoVehiculo.sede_id) return alert('Por favor, selecciona una sede.');
        try {
            await api.post('/vehiculos', nuevoVehiculo);
            alert('Vehículo creado con éxito');
            setNuevoVehiculo({ nombre: '', placa: '', marca: '', modelo: '', sede_id: '' });
            setVista('vehiculos_reload');
            setVista('vehiculos');
        } catch (error) { alert(`Error: ${error.response?.data?.msg || 'Error desconocido'}`); }
    };

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
            label: 'Cantidad de Mantenimientos',
            data: datosInforme?.porVehiculo.map(d => d.cantidad) || [],
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
        }]
    };

    return (
        <main>
            <nav>
                <ul>
                    <li><a href="#informes" role="button" className={vista === 'informes' ? '' : 'secondary'} onClick={(e) => {e.preventDefault(); setVista('informes')}}>Informes</a></li>
                    <li><a href="#usuarios" role="button" className={vista === 'usuarios' ? '' : 'secondary'} onClick={(e) => {e.preventDefault(); setVista('usuarios')}}>Gestionar Usuarios</a></li>
                    <li><a href="#vehiculos" role="button" className={vista === 'vehiculos' ? '' : 'secondary'} onClick={(e) => {e.preventDefault(); setVista('vehiculos')}}>Gestionar Vehículos</a></li>
                    <li><a href="#solicitudes" role="button" className={vista === 'solicitudes' ? '' : 'secondary'} onClick={(e) => {e.preventDefault(); setVista('solicitudes')}}>Ver Todas las Solicitudes</a></li>
                </ul>
            </nav>

            {vista === 'informes' && (
                <article>
                    <header>Informes de Mantenimiento</header>
                    <div className="grid">
                        <input type="date" value={fechas.inicio} onChange={e => setFechas({...fechas, inicio: e.target.value})} />
                        <input type="date" value={fechas.fin} onChange={e => setFechas({...fechas, fin: e.target.value})} />
                    </div>
                    <label htmlFor="filtroSedeInforme">Filtrar por Sede (opcional)</label>
                    <select id="filtroSedeInforme" value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
                        <option value="todas">Todas las Sedes</option>
                        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                    <button onClick={generarInforme} style={{marginTop: '1rem'}}>Generar Informe</button>
                    {datosInforme && (
                        <div className="grid">
                            <div style={{maxWidth: '400px', margin: 'auto'}}><Pie data={chartDataEstado} options={{plugins: {title: { display: true, text: 'Solicitudes por Estado' }}}} /></div>
                            <div><Bar data={chartDataVehiculo} options={{plugins: {title: { display: true, text: 'Mantenimientos por Vehículo' }}}} /></div>
                        </div>
                    )}
                </article>
            )}

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
                        <label htmlFor="sede_usuario">Sede</label>
                        <select id="sede_usuario" value={nuevoUsuario.sede_id} onChange={e => setNuevoUsuario({...nuevoUsuario, sede_id: e.target.value})} required>
                            <option value="">-- Selecciona una Sede --</option>
                            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                        <button type="submit">Crear Usuario</button>
                    </form>
                    <hr/>
                    <table>
                       <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Sede</th></tr></thead>
                        <tbody>{usuarios.map(u => <tr key={u.id}><td>{u.id}</td><td>{u.nombre_completo}</td><td>{u.email}</td><td>{u.rol}</td><td>{u.nombre_sede || 'N/A'}</td></tr>)}</tbody>
                    </table>
                </article>
            )}
            
            {vista === 'vehiculos' && (
                <article>
                    <header>Gestión de Vehículos</header>
                    <form onSubmit={handleCrearVehiculo}>
                         <div className="grid">
                           <input type="text" placeholder="Nombre (ej: Ambulancia 02)" value={nuevoVehiculo.nombre} onChange={e => setNuevoVehiculo({...nuevoVehiculo, nombre: e.target.value})} required/>
                           <input type="text" placeholder="Placa" value={nuevoVehiculo.placa} onChange={e => setNuevoVehiculo({...nuevoVehiculo, placa: e.target.value})} required/>
                         </div>
                         <label htmlFor="sede_vehiculo">Sede</label>
                         <select id="sede_vehiculo" value={nuevoVehiculo.sede_id} 
                                onChange={e => setNuevoVehiculo({...nuevoVehiculo, sede_id: e.target.value})} 
                                required>
                           <option value="">-- Selecciona una Sede --</option>
                           {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                         </select>
                         <button type="submit" style={{marginTop: '1rem'}}>Crear Vehículo</button>
                    </form>
                    <hr/>
                    <table>
                        <thead><tr><th>ID</th><th>Nombre</th><th>Placa</th><th>Sede</th></tr></thead>
                        <tbody>
                            {vehiculos.map(v => (
                                <tr key={v.id}>
                                    <td>{v.id}</td>
                                    <td>{v.nombre}</td>
                                    <td>{v.placa}</td>
                                    <td>{v.nombre_sede || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </article>
            )}

            {vista === 'solicitudes' && (
                <article>
                    <header>
                        Historial Global de Solicitudes
                        <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={{maxWidth: '250px', marginLeft: '1rem'}}>
                            <option value="todas">Ver Todas las Sedes</option>
                            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </header>
                    {solicitudes.map(s => (
                        <details key={s.id} style={{marginBottom: '1rem'}}>
                            <summary>
                                <strong>ID #{s.id}</strong> | {s.nombre_vehiculo} ({s.placa_vehiculo}) | Estado: <strong>{s.estado}</strong>
                            </summary>
                            <div style={{paddingLeft: '1rem', borderLeft: '2px solid var(--pico-primary)'}}>
                                <p><strong>Sede:</strong> {s.nombre_sede}</p>
                                <hr/>
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

                                {s.id_coordinador_aprueba && <>
                                    <hr/>
                                    <p><strong><u>Etapa 3: Decisión</u></strong></p>
                                    <p><strong>Coordinador:</strong> {s.nombre_coordinador}</p>
                                    <p><strong>Fecha Decisión:</strong> {new Date(s.fecha_aprobacion_rechazo).toLocaleString('es-CO')}</p>
                                    <p><strong>Decisión:</strong> {s.motivo_rechazo ? 'Rechazado' : 'Aprobado'}</p>
                                    {s.motivo_rechazo && <p><strong>Motivo:</strong> {s.motivo_rechazo}</p>}
                                </>}
                                
                                {s.trabajos_realizados && <>
                                    <hr/>
                                    <p><strong><u>Etapa 4: Reparación</u></strong></p>
                                    <p><strong>Fecha Salida:</strong> {new Date(s.hora_salida_taller).toLocaleString('es-CO')}</p>
                                    <p><strong>Trabajos Realizados:</strong> {s.trabajos_realizados}</p>
                                    <p><strong>Repuestos:</strong> {s.repuestos_utilizados || 'N/A'}</p>
                                </>}
                            </div>
                        </details>
                    ))}
                </article>
            )}
        </main>
    );
};

export default AdminDashboard;