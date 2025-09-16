import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import ConductorDashboard from '../components/conductor/ConductorDashboard';
import TallerDashboard from '../components/taller/TallerDashboard';
import CoordinacionDashboard from '../components/coordinacion/CoordinacionDashboard';
import AdminDashboard from '../components/admin/AdminDashboard';
import NotificationBell from '../components/NotificationBell';

const DashboardPage = () => {
  const { user, logout } = useContext(AuthContext);

  if (!user) {
    return <Navigate to="/login" />;
  }

  const renderDashboardByRole = () => {
    switch (user.rol) {
      case 'Conductor':
        return <ConductorDashboard />;
      case 'Taller':
        return <TallerDashboard />;
      case 'Coordinacion':
        return <CoordinacionDashboard />;
      case 'Admin':
        return <AdminDashboard />;
      default:
        return <div>Rol de usuario no reconocido.</div>;
    }
  };

  return (
    <div>
        <header className="container">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <img src="/logo.png" alt="Logo de la Empresa" style={{ maxWidth: '180px' }} />
            </div>
        </header>
        <div className="container" style={{marginTop: '-2rem'}}>
            <article>
                <header>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <hgroup style={{ marginBottom: '0' }}>
                    <h1>Panel Principal</h1>
                    <p>Bienvenido, {user.nombre}. Tu rol es: <strong>{user.rol}</strong></p>
                    </hgroup>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <NotificationBell />
                        <button onClick={logout} className="secondary" style={{ width: 'auto' }}>Cerrar Sesión</button>
                    </div>
                </div>
                </header>
                
                {renderDashboardByRole()}

            </article>
        </div>
    </div>
  );
};

export default DashboardPage;