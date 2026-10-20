# Catálogo de Streaming

Web app que mostra os filmes disponíveis **agora** nos serviços de streaming por assinatura no Brasil (Netflix, Prime Video, Max, Disney+, Globoplay...).

- Grade de filmes ordenada por popularidade, com botão "Carregar mais"
- Filtro por serviço de streaming (dá para marcar vários; o filtro fica na URL)
- Página de detalhes de cada filme, com a seção "Onde assistir"

Feito com React + Vite, usando a API do [TMDB](https://www.themoviedb.org/). Projeto de estudo.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou superior
- Um token de acesso da API do TMDB (gratuito)

### Como conseguir o token do TMDB

1. Crie uma conta em [themoviedb.org](https://www.themoviedb.org/signup).
2. Acesse **Configurações → API** e solicite uma chave (uso pessoal/educacional).
3. Copie o **API Read Access Token**, o texto longo que começa com `eyJ...`.

## Como rodar

```bash
npm install
cp .env.example .env    # depois cole o token no arquivo .env
npm run dev             # abre em http://localhost:5173
```

O arquivo `.env` fica assim:

```
VITE_TMDB_TOKEN=eyJ...seu token...
```

## Testes

```bash
npm test          # modo observação (roda de novo a cada alteração)
npx vitest run    # roda uma vez
```

Os testes simulam a API e não precisam de internet nem de token.

## Estrutura

```
src/
  api/tmdb.js       único lugar que conversa com o TMDB
  pages/            HomePage (lista + filtro) e MovieDetailsPage
  components/       cartão, grade, filtro, carregando, erro, rodapé
  utils/            formatação de ano/nota/duração e helpers da lista
```

## Sobre o token no navegador

Como o app roda inteiro no navegador, o token do TMDB fica embutido no JavaScript publicado e pode ser visto por quem inspecionar o site. Para este projeto de estudo isso é aceitável: o token é gratuito e só permite **leitura**. Uma versão futura pode esconder o token atrás de uma função serverless.

## Limitações conhecidas (v1)

- Ao voltar da página de um filme, a lista recomeça da primeira página e do topo. Os filmes de "Carregar mais" não são lembrados.

## Publicação (Vercel)

1. Envie o projeto para um repositório no GitHub.
2. Na [Vercel](https://vercel.com/), clique em **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione `VITE_TMDB_TOKEN` com o seu token.
4. Clique em **Deploy**.

O arquivo `vercel.json` faz todas as rotas (ex.: `/filme/123`) carregarem o app, para que recarregar a página não dê erro 404.

## Créditos

Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
Dados de streaming fornecidos por JustWatch.
