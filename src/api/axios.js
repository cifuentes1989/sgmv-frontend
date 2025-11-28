import axios from 'axios';

const instance = axios.create({
  // URL DE PRODUCCIÓN (La que sale en tu captura de pantalla de Render)
  baseURL: 'https://sgmv-backend.onrender.com/api', 
});

export default instance;