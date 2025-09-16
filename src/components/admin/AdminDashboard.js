import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const AdminDashboard = () => {
    const [vista, setVista] = useState('informes');
    const [usuarios, setUsuarios] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [datosInforme, setDatosInforme] = useState(null);
    const [fechas, setFechas] = useState({ inicio: '', fin: '' });
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre_completo: '', email: '', password: '', rol: 'Conductor' });
    const [nuevoVehiculo, setNuevoVehiculo] = useState({ nombre: '', placa: '', marca: '', modelo: '' });
    
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
                } else if (vista === 'solicitudes') {
                    const res = await api.get('/admin/solicitudes/todas');
                    setSolicitudes(res.data);
                }
            } catch (error) { console.error(`Error cargando datos para ${vista}`, error); }
        };
        if (!vista.includes('_reload')) {
            cargarDatos();
        }
    }, [vista, datosInforme]);

    const generarInforme = async () => {
        if (!fechas.inicio || !fechas.fin) return alert("Por favor, selecciona un rango de fechas.");
        const res = await api.get(`/admin/informes/datos?fecha_inicio=${fechas.inicio}&fecha_fin=${fechas.fin}`);
        setDatosInforme(res.data);
    };

    const handleCrearUsuario = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/usuarios', nuevoUsuario);
            alert('Usuario creado con éxito');
            setNuevoUsuario({ nombre_completo: '', email: '', password: '', rol: 'Conductor' });
            setVista('usuarios_reload');
            setVista('usuarios');
        } catch (error) { alert(`Error: ${error.response?.data?.msg || 'Error desconocido'}`); }
    };

    const handleCrearVehiculo = async (e) => {
        e.preventDefault();
        try {
            await api.post('/vehiculos', nuevoVehiculo);
            alert('Vehículo creado con éxito');
            setNuevoVehiculo({ nombre: '', placa: '', marca: '', modelo: '' });
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
        <main className="container">
            <hgroup><h3>Panel de Administración</h3></hgroup>
            <nav>
                <ul>
                    <li><a href="#informes" onClick={(e) => {e.preventDefault(); setVista('informes')}}>Informes</a></li>
                    <li><a href="#usuarios" onClick={(e) => {e.preventDefault(); setVista('usuarios')}}>Gestionar Usuarios</a></li>
                    <li><a href="#vehiculos" onClick={(e) => {e.preventDefault(); setVista('vehiculos')}}>Gestionar Vehículos</a></li>
                    <li><a href="#solicitudes" onClick={(e) => {e.preventDefault(); setVista('solicitudes')}}>Ver Todas las Solicitudes</a></li>
                </ul>
            </nav>

            {vista === 'informes' && (
                <article>
                    <header>Informes de Mantenimiento</header>
                    <div className="grid">
                        <input type="date" value={fechas.inicio} onChange={e => setFechas({...fechas, inicio: e.target.value})} />
                        <input type="date" value={fechas.fin} onChange={e => setFechas({...fechas, fin: e.target.value})} />
                    </div>
                    <button onClick={generarInforme}>Generar Informe por Fecha</button>
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
                        <button type="submit">Crear Usuario</button>
                    </form>
                    <hr/>
                    <table>
                       <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th></tr></thead>
                        <tbody>{usuarios.map(u => <tr key={u.id}><td>{u.id}</td><td>{u.nombre_completo}</td><td>{u.email}</td><td>{u.rol}</td></tr>)}</tbody>
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
                            <input type="text" placeholder="Marca" value={nuevoVehiculo.marca} onChange={e => setNuevoVehiculo({...nuevoVehiculo, marca: e.target.value})} />
                            <input type="text" placeholder="Modelo" value={nuevoVehiculo.modelo} onChange={e => setNuevoVehiculo({...nuevoVehiculo, modelo: e.target.value})} />
                         </div>
                         <button type="submit">Crear Vehículo</button>
                    </form>
                    <hr/>
                    <table>
                        <thead><tr><th>ID</th><th>Nombre</th><th>Placa</th><th>Marca</th><th>Modelo</th></tr></thead>
                        <tbody>{vehiculos.map(v => <tr key={v.id}><td>{v.id}</td><td>{v.nombre}</td><td>{v.placa}</td><td>{v.marca}</td><td>{v.modelo}</td></tr>)}</tbody>
                    </table>
                </article>
            )}

            {vista === 'solicitudes' && (
                <article>
                    <header>Historial Global de Solicitudes</header>
                    {solicitudes.map(s => <p key={s.id}>ID #{s.id} - {s.necesidad_reportada} - <strong>{s.estado}</strong></p>)}
                </article>
            )}
        </main>
    );
};

export default AdminDashboard;