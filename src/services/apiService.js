const axios = require('axios');

const API_URL = process.env.API_URL || 'https://localhost:7123/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Funções para consumir os endpoints da EspetinhoPro-API
exports.getEspetinhos = () => api.get('/espetinhos');
exports.getAcompanhamentos = () => api.get('/acompanhamentos');
exports.getCombos = () => api.get('/combos');
exports.getComandas = () => api.get('/comandas');
exports.getPedidos = () => api.get('/pedidos');
exports.getGrelhaPendentes = () => api.get('/grelha/pendentes');