/* eslint-disable */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ArchivoDashboard from './components/archivo/ArchivoDashboard'; // <-- IMPORTAMOS EL NUEVO MÓDULO
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />

        {/* --- NUEVA RUTA EXCLUSIVA PARA ARCHIVO --- */}
        <Route 
          path="/archivo" 
          element={
            <ProtectedRoute>
              <ArchivoDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Cualquier URL no reconocida se envía al dashboard (o al login si no hay sesión) */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;