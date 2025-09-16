import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import SignatureCanvas from 'react-signature-canvas';

const NuevaSolicitudForm = ({ onSolicitudCreada }) => {
  const [vehiculos, setVehiculos] = useState([]);
  const [idVehiculo, setIdVehiculo] = useState('');
  const [necesidad, setNecesidad] = useState('');
  const [mensaje, setMensaje] = useState('');
  const sigCanvas = useRef({});

  useEffect(() => {
    const fetchVehiculos = async () => {
      try {
        const res = await api.get('/vehiculos');
        setVehiculos(res.data);
      } catch (error) {
        console.error("Error al cargar vehículos", error);
      }
    };
    fetchVehiculos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!idVehiculo) {
      return alert("Debes seleccionar un vehículo.");
    }
    if (sigCanvas.current.isEmpty()) {
      return alert("La firma del conductor es obligatoria.");
    }
    const firma_conductor_solicitud = sigCanvas.current.toDataURL();
    try {
      await api.post('/solicitudes', {
        id_vehiculo: idVehiculo,
        necesidad,
        firma_conductor_solicitud
      });
      setMensaje('¡Solicitud creada con éxito!');
      if (onSolicitudCreada) onSolicitudCreada();
    } catch (error) {
      setMensaje('Error al crear la solicitud.');
      console.error(error);
    }
  };

  return (
    <article style={{ marginTop: '1rem' }}>
      <form onSubmit={handleSubmit}>
        <hgroup>
          <h4>Crear Nueva Solicitud</h4>
          <p>Por favor, detalle la necesidad del vehículo.</p>
        </hgroup>
        <label htmlFor="vehiculo">Vehículo:</label>
        <select id="vehiculo" value={idVehiculo} onChange={(e) => setIdVehiculo(e.target.value)} required>
          <option value="">-- Selecciona un vehículo --</option>
          {vehiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre} - {v.placa}
            </option>
          ))}
        </select>
        <label htmlFor="necesidad">Necesidad o Falla Reportada:</label>
        <textarea
          id="necesidad"
          value={necesidad}
          onChange={(e) => setNecesidad(e.target.value)}
          rows="4"
          placeholder="Ej: Se escucha un ruido extraño en el motor..."
          required
        />
        <label>Firma del Conductor:</label>
        <div style={{ border: '1px solid var(--pico-contrast)', borderRadius: 'var(--pico-border-radius)', width: 300, height: 150 }}>
          <SignatureCanvas ref={sigCanvas} canvasProps={{ width: 300, height: 150 }} />
        </div>
        <button type="button" className="secondary outline" onClick={() => sigCanvas.current.clear()} style={{ width: 'auto', marginTop: '0.5rem' }}>Limpiar Firma</button>
        <footer style={{ paddingTop: '1rem' }}>
          <button type="submit">Enviar Solicitud</button>
          {mensaje && <p>{mensaje}</p>}
        </footer>
      </form>
    </article>
  );
};

export default NuevaSolicitudForm;