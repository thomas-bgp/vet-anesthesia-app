# VetAnesthesia - Sistema de Gestão para Anestesiologistas Veterinários

Sistema web completo para gestão de anestesiologistas veterinários, permitindo controle de cirurgias, estoque de medicamentos, movimentações e relatórios financeiros.

---

## Funcionalidades

- **Autenticação segura** com JWT e controle de roles (admin / veterinário)
- **Links de convite** com expiração e limite de uso para cadastro de novos usuários
- **Gestão de cirurgias**: cadastro, acompanhamento de status (agendada, em andamento, concluída, cancelada), classificação ASA, protocolo anestésico e registro de complicações
- **Estoque de medicamentos**: cadastro de fármacos com princípio ativo, concentração, lote, validade e estoque mínimo
- **Movimentações de estoque**: entradas (compra), saídas (uso em cirurgia), ajustes e baixas por vencimento
- **Vínculo cirurgia × medicamento**: registro das doses administradas por via e horário
- **Dashboard financeiro**: receitas por cirurgia, custo de medicamentos e resultado operacional
- **Alertas de estoque mínimo e validade** próxima de medicamentos

---

## Stack Tecnológica

| Camada     | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | React 19 + Vite 8                   |
| Backend    | Node.js 20 + Express 4              |
| Banco      | SQLite 3 (better-sqlite3)           |
| Auth       | JWT (jsonwebtoken) + bcryptjs       |
| Segurança  | Helmet, express-rate-limit, CORS    |
| Infra      | Docker, Docker Compose, nginx       |

---

## Executar com Docker (Recomendado)

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) >= 24
- [Docker Compose](https://docs.docker.com/compose/) >= 2.x (já incluso no Docker Desktop)

### Passo a passo

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd vet-anesthesia-app

# 2. Copie e ajuste as variáveis de ambiente (opcional para produção real)
cp .env.example .env
# Edite .env e troque JWT_SECRET por uma string segura

# 3. Suba todos os serviços (build + start)
docker-compose up --build

# A primeira inicialização pode levar alguns minutos.
# Quando o backend estiver healthy, o frontend sobe automaticamente.
```

Acesse em: **http://localhost**

Para rodar em background:

```bash
docker-compose up --build -d
```

Para parar:

```bash
docker-compose down
```

Para parar e remover o volume do banco (atenção: apaga todos os dados):

```bash
docker-compose down -v
```

---

## Executar em Modo Desenvolvimento

### Backend

```bash
cd backend
npm install
# Crie um arquivo .env com as variáveis abaixo:
# JWT_SECRET=dev-secret
# DB_PATH=./vetanesthesia.db
# PORT=3001
npm run seed    # popula o banco com dados iniciais
npm run dev     # inicia com nodemon (hot-reload)
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # inicia o Vite dev server em http://localhost:5173
```

> Em desenvolvimento, o frontend acessa o backend diretamente em `http://localhost:3001`. Configure o proxy no `vite.config.js` se necessário.

---

## Credenciais Padrão (Seed)

Após executar `npm run seed` (ou na primeira inicialização via Docker), o sistema é populado com um usuário administrador:

| Campo  | Valor                  |
|--------|------------------------|
| E-mail | `admin@vetanesthesia.com` |
| Senha  | `admin123`             |
| Role   | `admin`                |

**Altere a senha imediatamente após o primeiro acesso em ambiente de produção.**

---

## Variáveis de Ambiente

| Variável     | Descrição                                        | Padrão                                      |
|--------------|--------------------------------------------------|---------------------------------------------|
| `JWT_SECRET` | Chave secreta para assinatura dos tokens JWT     | (obrigatório — troque em produção)          |
| `DB_PATH`    | Caminho absoluto para o arquivo do banco SQLite  | `/data/vetanesthesia.db`                    |
| `PORT`       | Porta HTTP do servidor backend                   | `3001`                                      |
| `NODE_ENV`   | Ambiente de execução (`development`/`production`)| `production` (via Docker)                   |

---

## Visão Geral da API

Todos os endpoints partem do prefixo `/api`.

### Autenticação

| Método | Rota               | Descrição                              |
|--------|--------------------|----------------------------------------|
| POST   | `/api/auth/login`  | Login — retorna JWT                    |
| POST   | `/api/auth/register` | Cadastro via link de convite         |
| GET    | `/api/auth/me`     | Dados do usuário autenticado           |

### Cirurgias

| Método | Rota                    | Descrição                              |
|--------|-------------------------|----------------------------------------|
| GET    | `/api/surgeries`        | Listar cirurgias do usuário            |
| POST   | `/api/surgeries`        | Criar nova cirurgia                    |
| GET    | `/api/surgeries/:id`    | Detalhes de uma cirurgia               |
| PUT    | `/api/surgeries/:id`    | Atualizar cirurgia                     |
| DELETE | `/api/surgeries/:id`    | Remover cirurgia                       |

### Medicamentos

| Método | Rota                    | Descrição                              |
|--------|-------------------------|----------------------------------------|
| GET    | `/api/medicines`        | Listar medicamentos do usuário         |
| POST   | `/api/medicines`        | Cadastrar medicamento                  |
| PUT    | `/api/medicines/:id`    | Atualizar medicamento                  |
| DELETE | `/api/medicines/:id`    | Inativar medicamento                   |

### Estoque

| Método | Rota                        | Descrição                          |
|--------|-----------------------------|------------------------------------|
| GET    | `/api/stock`                | Listar movimentações               |
| POST   | `/api/stock/movement`       | Registrar movimentação             |

### Links de Convite (Admin)

| Método | Rota                        | Descrição                          |
|--------|-----------------------------|------------------------------------|
| POST   | `/api/referrals`            | Gerar link de convite              |
| GET    | `/api/referrals`            | Listar links criados               |

### Health Check

| Método | Rota            | Descrição                               |
|--------|-----------------|-----------------------------------------|
| GET    | `/api/health`   | Status do serviço (usado pelo Docker)   |

---

## Arquitetura

```
vet-anesthesia-app/
├── docker-compose.yml       # Orquestração dos serviços
├── .env.example             # Variáveis de ambiente de referência
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── server.js            # Entry point Express
│   ├── db/
│   │   ├── database.js      # Conexão e inicialização SQLite
│   │   └── schema.sql       # DDL do banco de dados
│   ├── middleware/          # Auth JWT, rate-limit, etc.
│   └── routes/              # Rotas da API
└── frontend/
    ├── Dockerfile           # Multi-stage: build Vite → nginx
    ├── nginx.conf           # SPA routing + proxy /api → backend
    ├── src/                 # Componentes React
    └── public/
```

---

## Screenshots

> _Em breve._

---

## Licença

Uso privado. Todos os direitos reservados.
