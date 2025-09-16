import React, { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const loginSuccess = await login(email, password);
    if (loginSuccess) {
      navigate('/dashboard');
    } else {
      alert('Credenciales inválidas.');
    }
  };

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <main className="container">
      <article>
        <hgroup>
          <h1>Iniciar Sesión</h1>
          <h2>Sistema de Gestión de Mantenimiento Vehicular</h2>
        </hgroup>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password">Contraseña:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="contrast">Ingresar</button>
        </form>
      </article>
    </main>
  );
};

export default LoginPage;