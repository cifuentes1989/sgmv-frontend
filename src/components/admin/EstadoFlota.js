import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const EstadoFlota = () => {
  const [flota, setFlota] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Estado para las estadísticas separadas
  const [stats, setStats] = useState({
    global: { total: 0, operativos: 0, taller: 0 },
    florencia: { total: 0, operativos: 0, taller: 0 },
    popayan: { total: 0, operativos: 0, taller: 0 }
  });

  useEffect(() => {
    const cargarFlota = async () => {
      try {
        const res = await api.get('/vehiculos/estado-flota');
        const vehiculos = res.data;
        setFlota(vehiculos);
        
        // --- CÁLCULO DE ESTADÍSTICAS POR SEDE ---
        
        // 1. Inicializar contadores
        let global = { total: 0, operativos: 0, taller: 0 };
        let florencia = { total: 0, operativos: 0, taller: 0 };
        let popayan = { total: 0, operativos: 0, taller: 0 };

        vehiculos.forEach(v => {
            // Analizar estado
            const esTaller = v.estado_actual === 'EN TALLER';
            
            // Sumar al Global
            global.total++;
            if (esTaller) global.taller++; else global.operativos++;

            // Sumar a la Sede correspondiente (Normalizamos texto a minúsculas para comparar)
            const sedeNombre = v.sede ? v.sede.toLowerCase() : '';

            if (sedeNombre.includes('florencia')) {
                florencia.total++;
                if (esTaller) florencia.taller++; else florencia.operativos++;
            } else if (sedeNombre.includes('popayán') || sedeNombre.includes('popayan')) {
                popayan.total++;
                if (esTaller) popayan.taller++; else popayan.operativos++;
            }
        });
        
        setStats({ global, florencia, popayan });
        setCargando(false);

      } catch (error) {
        console.error("Error cargando flota", error);
        setCargando(false);
      }
    };
    cargarFlota();
  }, []);

  // Sub-componente para mostrar tarjeta de estadísticas
  const StatCard = ({ title, data, colorBorde }) => (
    <article style={{ borderLeft: `5px solid ${colorBorde}`, padding: '1rem', marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem', color: '#555' }}>{title}</h4>
        <div className="grid">
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: 0, color: '#2ecc71' }}>{data.operativos}</h2>
                <small>🟢 Operativos</small>
            </div>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: 0, color: '#e74c3c' }}>{data.taller}</h2>
                <small>🔴 Taller</small>
            </div>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: 0, color: '#3498db' }}>{data.total}</h2>
                <small>🚙 Total</small>
            </div>
        </div>
    </article>
  );

  if (cargando) return <p aria-busy="true">Analizando estado de la flota...</p>;

  return (
    <div className="animate__animated animate__fadeIn">
      <hgroup>
        <h3>Centro de Control de Flota</h3>
        <p>Monitoreo en tiempo real por ciudad.</p>
      </hgroup>

      {/* SECCIÓN DE TARJETAS POR CIUDAD */}
      <div className="grid">
        <StatCard title="📍 GLOBAL (Total Empresa)" data={stats.global} colorBorde="#3498db" />
        <StatCard title="📍 SEDE POPAYÁN" data={stats.popayan} colorBorde="#9b59b6" />
        <StatCard title="📍 SEDE FLORENCIA" data={stats.florencia} colorBorde="#f1c40f" />
      </div>

      <hr />

      {/* TABLA DETALLADA CON FILTROS VISUALES */}
      <h4>Detalle de Vehículos</h4>
      <figure>
        <table role="grid">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Vehículo</th>
              <th>Placa</th>
              <th>Sede</th>
            </tr>
          </thead>
          <tbody>
            {flota.map(v => (
              <tr key={v.id}>
                <td>
                  {v.estado_actual === 'OPERATIVO' ? (
                    <span style={{ 
                        backgroundColor: '#2ecc71', 
                        color: 'white', 
                        padding: '4px 10px', 
                        borderRadius: '15px', 
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                    }}>
                        🟢 OPERATIVO
                    </span>
                  ) : (
                    <span style={{ 
                        backgroundColor: '#e74c3c', 
                        color: 'white', 
                        padding: '4px 10px', 
                        borderRadius: '15px', 
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                    }}>
                        🔴 EN TALLER
                    </span>
                  )}
                </td>
                <td><strong>{v.nombre}</strong></td>
                <td>
                    <span style={{ 
                        border: '1px solid #ccc', 
                        padding: '2px 5px', 
                        borderRadius: '4px', 
                        backgroundColor: '#f9f9f9',
                        fontFamily: 'monospace'
                    }}>
                        {v.placa}
                    </span>
                </td>
                <td>
                    {v.sede === 'Popayán' ? '🏙️ Popayán' : v.sede === 'Florencia' ? '🌴 Florencia' : 'Sin Asignar'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </div>
  );
};

export default EstadoFlota;