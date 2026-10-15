const apiService = require('../services/apiService');

exports.index = async (req, res) => {
  try {
    const [espetinhosRes, acompanhamentosRes] = await Promise.all([
      apiService.getEspetinhos(),
      apiService.getAcompanhamentos()
    ]);

    res.render('cardapio', {
      title: 'Cardápio - EspetinhoPro',
      espetinhos: espetinhosRes.data,
      acompanhamentos: acompanhamentosRes.data,
      error: null
    });
  } catch (error) {
    res.render('cardapio', {
      title: 'Cardápio - EspetinhoPro',
      espetinhos: [],
      acompanhamentos: [],
      error: 'Não foi possível carregar o cardápio. Verifique se a API está rodando.'
    });
  }
};