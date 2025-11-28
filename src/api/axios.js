import axios from 'axios';

// --- CORRECCIÓN AQUÍ ---
// Asegúrate de que diga 3001 (antes tenías 3000)
const instance = axios.create({
  baseURL: 'http://localhost:3001/api', 
});
// -----------------------

export default instance;