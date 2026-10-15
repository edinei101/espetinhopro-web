const apiService = require('../services/apiService');

exports.index = async (req, res) => {
  try {
    const response = await apiService.getGrelhaPendentes();
    res.render('cozinha', {
      title: 'Cozinha / Grelha - EspetinhoPro',
      itensGrelha: response.data,
      error: null
    });
  } catch (error) {
    res.render('cozinha', {
      title: 'Cozinha / Grelha - EspetinhoPro',
      itensGrelha: [],
      error: 'Não foi possível carregar os pedidos da grelha. Verifique se a API está rodando.'
    });
  }
};