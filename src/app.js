require('dotenv').config();
const express = require('express');
const path = require('path');

const homeRoutes = require('./routes/homeRoutes');
const cardapioRoutes = require('./routes/cardapioRoutes');
const comandasRoutes = require('./routes/comandasRoutes');
const cozinhaRoutes = require('./routes/cozinhaRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Template Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para arquivos estáticos e dados de formulário
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Definindo as Rotas
app.use('/', homeRoutes);
app.use('/cardapio', cardapioRoutes);
app.use('/comandas', comandasRoutes);
app.use('/cozinha', cozinhaRoutes);

// Tratamento de Rota Não Encontrada (404)
app.use((req, res) => {
  res.status(404).render('home', { title: 'Página Não Encontrada', error: '404 - Rota não encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor EspetinhoPro Web rodando em http://localhost:${PORT}`);
});