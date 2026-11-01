const apiService = require('../services/apiService');

exports.index = async (req, res) => {
  try {
    const response = await apiService.getGrelhaPendentes();
    res.render('cozinha', {
      title: 'Cozinha / Grelha - EspetinhoPro',
      itensGrelha: response.data,
      error: null
    });
  
};