import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Lee el token inicial desde el almacenamiento local
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      // --- LÍNEA CRÍTICA A VERIFICAR ---
      // Asegúrate de que el token se configure con el nombre de encabezado correcto al cargar la app
      api.defaults.headers.common['x-auth-token'] = token;
      const decodedUser = jwtDecode(token);
      setUser(decodedUser.user);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const newToken = response.data.token;
      
      localStorage.setItem('token', newToken);
      // --- LÍNEA CRÍTICA A VERIFICAR ---
      // Aquí establecemos el encabezado para todas las futuras peticiones después de iniciar sesión
      api.defaults.headers.common['x-auth-token'] = newToken;
      
      const decodedUser = jwtDecode(newToken);
      setUser(decodedUser.user);
      setToken(newToken);
      
      return true;
    } catch (error) {
      console.error('Error en el login:', error);
      logout();
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    // --- LÍNEA CRÍTICA A VERIFICAR ---
    // Asegúrate de borrar el encabezado correcto al cerrar sesión
    delete api.defaults.headers.common['x-auth-token'];
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;