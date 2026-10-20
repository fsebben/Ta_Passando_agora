# Catálogo de Filmes em Streaming — Design (v1)

**Data:** 2026-10-20
**Status:** aguardando revisão

## 1. Objetivo

Web app de estudo/portfólio que mostra os filmes disponíveis **agora** em serviços de streaming por assinatura no Brasil, usando a API do TMDB.

**Contexto do autor:** iniciante em desenvolvimento web. As escolhas técnicas priorizam aprender um conceito novo por vez.

**Critério de sucesso:** app publicado online, funcionando, com código que o autor entende e consegue explicar.

## 2. Escopo

### Dentro da v1
1. Grade de filmes disponíveis em streaming por assinatura no Brasil, com botão "Carregar mais".
2. Filtro por serviço de streaming (seleção múltipla).
3. Página de detalhes do filme com a seção "Onde assistir".

### Fora da v1
Busca por nome, filtro por gênero, ordenação escolhida pelo usuário, favoritos, login, TypeScript, servidor/back-end próprio.

### Premissas
- Região fixa: Brasil (`watch_region=BR`); idioma: `pt-BR`.
- "Disponível no streaming" = monetização `flatrate` (incluído na assinatura). Aluguel, compra e gratuito com anúncios não contam.
- Sem login e sem banco de dados.

## 3. Stack

| Item | Escolha |
|---|---|
| Build/dev server | Vite |
| UI | React, JavaScript (sem TypeScript) |
| Rotas | React Router |
| Estilo | CSS simples (global + arquivos por componente quando útil), tema escuro |
| Testes | Vitest + React Testing Library |
| Hospedagem | Vercel, conectada ao GitHub |

## 4. Arquitetura

O app roda inteiro no navegador e chama a API do TMDB diretamente. Não há back-end próprio.

```
Navegador (React)  ──HTTPS──▶  api.themoviedb.org/3
      └──── imagens ◀──────── image.tmdb.org/t/p/...
```

### Autenticação
- Usa o "API Read Access Token" do TMDB no cabeçalho `Authorization: Bearer <token>`.
- O token fica em `.env` na variável `VITE_TMDB_TOKEN`. O `.env` vai no `.gitignore` e o repositório inclui um `.env.example`.
- **Limitação conhecida e aceita:** variáveis `VITE_*` ficam embutidas no JavaScript enviado ao navegador, então o token é visível para quem inspecionar o site. Isso é aceitável aqui porque o token do TMDB é gratuito, só permite leitura e o projeto é de estudo. Uma versão futura pode esconder o token atrás de uma função serverless.

### Endpoints usados

| Função em `tmdb.js` | Endpoint |
|---|---|
| `getProviders()` | `GET /watch/providers/movie?watch_region=BR&language=pt-BR` |
| `getStreamingMovies({ providers, page })` | `GET /discover/movie?watch_region=BR&with_watch_monetization_types=flatrate&with_watch_providers=<ids separados por \|>&language=pt-BR&sort_by=popularity.desc&page=<n>` |
| `getMovieDetails(id)` | `GET /movie/{id}?language=pt-BR&append_to_response=watch/providers` |

- `|` em `with_watch_providers` significa OU (filmes em qualquer um dos serviços selecionados).
- **Sem serviço selecionado:** o parâmetro `with_watch_providers` é omitido, e a expectativa é que `watch_region` + `flatrate` retornem filmes de qualquer serviço por assinatura. **Isso deve ser verificado na primeira tarefa de implementação.** Se a API ignorar o filtro de monetização sem provedores, `getStreamingMovies` passa a enviar os IDs de todos os serviços exibidos no filtro.
- No detalhe, os serviços vêm de `watch/providers.results.BR.flatrate`. Se essa chave não existir, a seção "Onde assistir" mostra "Não disponível em streaming por assinatura no Brasil".
- Imagens: `https://image.tmdb.org/t/p/w342{poster_path}` (grade), `w500` (detalhe) e `w92{logo_path}` (logos).

### Estrutura de pastas

```
src/
  api/tmdb.js              ← único módulo que conhece o TMDB
  pages/
    HomePage.jsx           ← filtro + grade + "Carregar mais"
    MovieDetailsPage.jsx   ← detalhes + "Onde assistir"
  components/
    ProviderFilter.jsx     ← logos clicáveis dos serviços
    MovieGrid.jsx
    MovieCard.jsx
    Loading.jsx
    ErrorMessage.jsx       ← mensagem + botão "Tentar de novo" opcional
    Footer.jsx             ← créditos TMDB e JustWatch
  App.jsx                  ← rotas
  main.jsx
```

**Regra de fronteira:** páginas e componentes nunca montam URLs do TMDB nem chamam `fetch` diretamente. Eles chamam as funções de `tmdb.js`, que devolvem dados prontos ou lançam um erro com mensagem legível.

### Rotas

| Rota | Página |
|---|---|
| `/` (com query `?streaming=8,119` opcional) | `HomePage` |
| `/filme/:id` | `MovieDetailsPage` |

## 5. Telas e comportamento

### Tela inicial (`/`)
- **Filtro de serviços:** mostra os 10 primeiros serviços de `getProviders()` pela ordem `display_priorities.BR` (ou `display_priority`, se a primeira não existir), como logos clicáveis. Clicar liga ou desliga o serviço; vários podem ficar ativos ao mesmo tempo. O botão "Limpar" desmarca todos.
- **Estado do filtro na URL:** os IDs selecionados ficam em `?streaming=` (separados por vírgula), lidos e escritos com `useSearchParams`. Mudar o filtro volta para a página 1 e substitui a lista.
- **Grade:** cartões com pôster, título, ano (de `release_date`) e nota (`vote_average` com 1 casa decimal). Layout responsivo com CSS Grid (`auto-fill`, ~2 colunas no celular, 5 ou 6 no desktop). Clicar num cartão leva para `/filme/:id`.
- **"Carregar mais":** busca a próxima página e acrescenta os filmes ao fim da lista. Fica oculto quando `page >= total_pages`. Mostra estado de carregando enquanto busca.
- **Lista vazia:** mostra "Nenhum filme encontrado para esses serviços".

### Tela de detalhes (`/filme/:id`)
- Pôster grande, título, ano, duração (`runtime` em "1h 52min"), gêneros, nota e sinopse.
- **"Onde assistir":** logos e nomes dos serviços `flatrate` no Brasil.
- Botão "← Voltar" (`navigate(-1)`; se não houver histórico, vai para `/`).

### Casos especiais
- Sem `poster_path`: mostra uma imagem genérica local (`public/no-poster.svg`).
- Sinopse vazia: mostra "Sinopse não disponível".
- Sem `release_date`: o ano não é exibido.

### Rodapé (todas as telas)
Crédito obrigatório: "Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB", com o logo do TMDB, e "Dados de streaming fornecidos por JustWatch".

## 6. Tratamento de erros

`tmdb.js` converte as falhas em `Error` com mensagens em português:

| Situação | Mensagem |
|---|---|
| Token ausente (`VITE_TMDB_TOKEN` vazio) ou HTTP 401 | "Token do TMDB inválido ou ausente. Configure VITE_TMDB_TOKEN no arquivo .env." |
| HTTP 404 | "Filme não encontrado." |
| Outro status ou falha de rede | "Não foi possível carregar os dados. Tente novamente." |

As telas mostram três estados: **carregando** (`Loading`), **erro** (`ErrorMessage` com "Tentar de novo", que refaz a última chamada) e **sucesso**. Na página de detalhes, o erro 404 mostra um link para `/` em vez do botão de nova tentativa. Se der erro no "Carregar mais", os filmes já carregados continuam na tela e o erro aparece junto ao botão.

## 7. Testes

Vitest + React Testing Library, escritos antes do código (TDD). O `fetch` é simulado; nenhum teste acessa a internet.

- **`tmdb.js`:** URLs e parâmetros corretos para cada função (região, idioma, monetização, provedores unidos por `|`, página); cabeçalho `Authorization`; conversão de 401, 404 e falha de rede nas mensagens da seção 6.
- **`ProviderFilter`:** renderiza os logos; clicar chama o callback com a seleção atualizada; "Limpar" esvazia a seleção.
- **`MovieCard`:** mostra título, ano e nota; usa a imagem genérica quando não há pôster; o link aponta para `/filme/:id`.
- **`HomePage`:** estados carregando, erro e sucesso; "Carregar mais" acrescenta itens e some na última página; lê o filtro inicial da URL.
- **`MovieDetailsPage`:** mostra os detalhes e "Onde assistir"; trata o 404 e a ausência de `results.BR`.

## 8. Publicação

- Repositório no GitHub com `.env` ignorado, `.env.example` e `README.md` (o que é, como obter o token do TMDB, como rodar e testar).
- Deploy na Vercel conectado ao GitHub, com `VITE_TMDB_TOKEN` configurado nas variáveis de ambiente do projeto.
- Rotas do lado do cliente: adicionar `vercel.json` com rewrite de todas as rotas para `/index.html`, para que `/filme/:id` funcione ao recarregar a página.
