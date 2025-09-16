import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useContext(AuthContext);

  if (!user) {
    // Si no hay usuario, redirige a la página de login
    return <Navigate to="/login" />;
  }

  return children; // Si hay usuario, muestra el contenido de la página
};

export default ProtectedRoute;