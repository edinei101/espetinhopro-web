const apiService = require('../services/apiService');

exports.index = async (req, res) => {
  try {
    const response = await apiService.getComandas();
    res.render('comandas', {
      title: 'Comandas - EspetinhoPro',
      comandas: response.data,
      error: null
    });
  } catch (error) {
    res.render('comandas', {
      title: 'Comandas - EspetinhoPro',
      comandas: [],
      error: 'Não foi possível carregar as comandas. Verifique se a API está rodando.'
    });
  }
};