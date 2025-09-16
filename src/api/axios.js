import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:3001/api', // La URL base de nuestro backend
});

export default instance;