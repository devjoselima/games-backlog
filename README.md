# Backlog Games

Este é um projeto pessoal para gerenciamento de um backlog de jogos. Permite manter uma lista organizada dos jogos que você já zerou, os que está jogando e os que deseja jogar, com uma interface bonita e rápida.

## 🚀 Tecnologias Utilizadas

- **Vite** + **React** + **TanStack Router**
- **Supabase** (Banco de dados e Autenticação)
- **Tailwind CSS** (Estilização)
- **IGDB / Twitch API** (Capas dos jogos)

## 📦 Como rodar localmente

1. Clone este repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` na raiz do projeto com base nas chaves do seu Supabase e da Twitch (como explicado abaixo).
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 🔐 Variáveis de Ambiente (.env)

Você precisará configurar as seguintes variáveis no seu `.env` local ou no serviço de hospedagem (como Vercel):

```env
VITE_SUPABASE_URL="sua_url_do_supabase"
VITE_SUPABASE_ANON_KEY="sua_chave_publica_do_supabase"

SUPABASE_URL="sua_url_do_supabase"
SUPABASE_SERVICE_ROLE_KEY="sua_chave_secreta_do_supabase"

# Chaves da Twitch Dev para buscar capas na IGDB
TWITCH_CLIENT_ID="seu_client_id"
TWITCH_CLIENT_SECRET="seu_client_secret"
```

## 🛠️ Scripts Úteis

- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npm run build`: Cria a versão de produção.
- `npx supabase db push`: Envia as alterações da pasta `supabase/migrations` para o seu banco remoto.
