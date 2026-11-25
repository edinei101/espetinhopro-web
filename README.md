# EspetinhoPro Web — Sistema de Gestão Gastronômica

Sistema web completo para gerenciamento operacional, controle de salão (mesas e balcão), KDS (Kitchen/Bar Display System), controle de estoque com reserva atômica concorrente e frente de caixa com rateio automatizado de gorjetas.

Desenvolvido com arquitetura modular em **NestJS** e **TypeScript**, integrando renderização Server-Side (**EJS** + **Bootstrap 5**) e persistência relacional em **MySQL** com **TypeORM**.

---

## Tecnologias Utilizadas

* **Backend:** Node.js, NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`), Express
* **Linguagem:** TypeScript 7.0
* **Banco de Dados:** MySQL (`mysql2` + `TypeORM` DataSource com Prepared Statements)
* **Frontend / Views:** EJS (Embedded JavaScript Templates), Bootstrap 5.3, FontAwesome 6.4
* **Segurança & Autenticação:** `express-session` (Cookies `httpOnly` e `sameSite`), `bcryptjs` (Salt 10 rounds), Middleware Global RBAC (Role-Based Access Control)

---

## Arquitetura Modular do Projeto

```text
espetinhopro-web/
├── public/                        # Arquivos estáticos (CSS, JS)
├── src/
│   ├── config/
│   │   ├── constants/             # Constantes do provedor de banco de dados
│   │   └── database/              # Configuração do TypeORM DataSource (MySQL)
│   ├── modules/
│   │   ├── autenticacao/          # Login, Logout, Seed automático de Admin e 1º Acesso
│   │   ├── inicio/                # Dashboard em tempo real (ocupação do salão e balcão)
│   │   ├── mesas/                 # Gestão de mesas, abertura de comandas e consumo
│   │   ├── balcao/                # Atendimento rápido/avulso por cliente
│   │   ├── cozinha/               # KDS da Grelha/Cozinha (fila de preparo em tempo real)
│   │   ├── bar/                   # KDS do Bar/Bebidas (fila separada por setor)
│   │   ├── caixa/                 # Abertura/Fechamento de turno, pagamentos parciais e rateio
│   │   ├── cardapio/              # Gestão de produtos, categorias, pontos da carne e vínculos
│   │   ├── estoque/               # Controle de saldo, alertas de estoque mínimo e histórico
│   │   ├── usuarios/              # Gestão de equipe, perfis, permissões granulares e soft delete
│   │   ├── relatorios/            # Métricas financeiras, ticket médio, top 10 produtos e comissões
│   │   └── impressao/             # Emissão de cupons térmicos (Pré-Conta e Ordem de Produção)
│   ├── views/                     # Templates EJS organizados por módulo + partials
│   ├── app.module.ts              # Módulo raiz integrador
│   └── main.ts                    # Bootstrap da aplicação e Middleware Global de Segurança
├── .env                           # Variáveis de ambiente e credenciais iniciais
├── package.json                   # Dependências e scripts de execução
└── tsconfig.json                  # Configuração do compilador TypeScript

************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************

Destaques de Segurança e Regras de Negócio
Prevenção contra SQL Injection: 100% das consultas SQL utilizam Prepared Statements parametrizados (?).

Controle de Acesso Baseado em Permissões (RBAC): Middleware global em main.ts valida sessões ativas em todas as rotas (GET e POST) e verifica permissões individuais por módulo (acesso_salao, acesso_caixa, acesso_cozinha, acesso_estoque, acesso_relatorios, acesso_configuracoes).

Fluxo Intransponível de Primeiro Acesso: Colaboradores recém-cadastrados ou com senha resetada (primeiro_acesso = 1) ficam retidos na tela de redefinição até criarem uma senha pessoal segura.

Reserva Atômica de Estoque (Controle de Concorrência):

Ao lançar um item na comanda (Mesa ou Balcão), o saldo é reservado imediatamente no banco via trava atômica (WHERE id = ? AND quantidade_estoque >= ?), impedindo que dois garçons vendam a última unidade simultaneamente.

Se o item em rascunho for removido ou a comanda for cancelada antes do preparo, o saldo retorna automaticamente ao estoque.

Após o envio para a Cozinha/Bar, a exclusão é bloqueada e a baixa torna-se definitiva.

Separação Inteligente de Produção (KDS):

Categoria 1 e 2 (Espetinhos e Acompanhamentos): Roteados automaticamente para a fila da Cozinha/Grelha.

Categoria 3 (Bebidas): Roteadas automaticamente para a fila do Bar.

Categoria 4 (Checkout/Doces): Entregues imediatamente (PRONTO), sem poluir as telas de preparo.

Frente de Caixa Auditável & Rateio de Gorjetas:

Suporte a pagamentos parciais (divisão de conta entre clientes na mesma mesa), cálculo automático de troco e liberação automática da mesa ao quitar o saldo total.

Fechamento de turno com duas modalidades de distribuição da taxa de serviço: Comissão Individual por Garçom (baseada nas mesas atendidas) ou Rateio Igualitário entre Funcionários Selecionados do Turno.

⚙️ Como Configurar e Executar
1. Pré-requisitos
Node.js (v18 ou superior)

MySQL Server (v8.0 ou superior) com o banco espetinho_web_db criado.

2. Variáveis de Ambiente (.env)
Crie ou verifique o arquivo .env na raiz do projeto:
************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************
Usuario      senha
GERENTE      123456
GARÇOM 1     123456
CAIXA 1      123456
COZINHEIRA   123456