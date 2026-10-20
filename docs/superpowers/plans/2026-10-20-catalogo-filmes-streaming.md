# Catálogo de Filmes em Streaming — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app React que lista os filmes disponíveis em streaming por assinatura no Brasil, com filtro por serviço e página de detalhes, usando a API do TMDB.

**Architecture:** SPA em Vite + React que chama o TMDB direto do navegador. Todo acesso à API fica isolado em `src/api/tmdb.js`; páginas e componentes só consomem as funções dele. Rotas com React Router e estado do filtro na query string.

**Tech Stack:** Node 20+, Vite, React, React Router, Vitest, React Testing Library, jsdom, CSS simples. Deploy na Vercel.

**Spec:** `docs/superpowers/specs/2026-10-20-catalogo-filmes-streaming-design.md`

## Global Constraints

- JavaScript (`.js`/`.jsx`), sem TypeScript.
- Todas as chamadas ao TMDB usam `watch_region=BR` e `language=pt-BR`; a listagem usa `with_watch_monetization_types=flatrate` e `sort_by=popularity.desc`.
- Base da API: `https://api.themoviedb.org/3`; imagens: `https://image.tmdb.org/t/p/{tamanho}{path}`, com `w342` (grade), `w500` (detalhe) e `w92` (logos).
- Autenticação: cabeçalho `Authorization: Bearer ${import.meta.env.VITE_TMDB_TOKEN}`. `.env` nunca é commitado.
- Somente `src/api/tmdb.js` chama `fetch` ou monta URLs do TMDB.
- Textos da interface em português, exatamente como na spec:
  - `"Token do TMDB inválido ou ausente. Configure VITE_TMDB_TOKEN no arquivo .env."`
  - `"Filme não encontrado."`
  - `"Não foi possível carregar os dados. Tente novamente."`
  - `"Nenhum filme encontrado para esses serviços"`
  - `"Sinopse não disponível"`
  - `"Não disponível em streaming por assinatura no Brasil"`
  - `"Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB"`
  - `"Dados de streaming fornecidos por JustWatch"`
- Testes nunca acessam a internet (`fetch` sempre simulado com `vi.fn`/`vi.stubGlobal`).

## Review Focus

1. **Query `?streaming=` inválida** (ex.: `?streaming=abc,,8`): ignorar valores não numéricos e usar só `[8]`, sem quebrar a tela. Teste em `parseProviderIds` (Task 5).
2. **Respostas fora de ordem ao trocar o filtro rapidamente:** uma resposta antiga não pode sobrescrever a lista do filtro atual. Teste em `HomePage` (Task 5).
3. **Filme repetido entre páginas** (o `/discover` pode devolver o mesmo filme na página 1 e na 2 quando a popularidade muda): o "Carregar mais" não pode duplicar cartões nem gerar `key` duplicada. Teste em `mergeMovies` (Task 5).
4. **Filme sem votos** (`vote_average: 0`, `vote_count: 0`): mostrar "Sem nota" em vez de "⭐ 0.0". Teste em `MovieCard` (Task 3).
5. **`/filme/abc` ou id inexistente:** a página de detalhes mostra "Filme não encontrado." com link para `/`, sem travar no carregamento. Teste em `MovieDetailsPage` (Task 6).

---

### Task 1: Projeto base e verificação da API

**Files:**
- Create: projeto Vite (`package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`), `src/setupTests.js`, `.env.example`, `.gitignore` (garantir a linha `.env`)
- Test: `src/App.test.jsx`

**Interfaces:**
- Produces: `npm test` (Vitest, ambiente jsdom, globals, setup com `@testing-library/jest-dom`); `npm run dev`.

- [ ] **Step 1: Conferir o Node.** Run: `node -v`. Expected: `v20` ou superior. Se não houver Node, instalar o LTS em nodejs.org antes de seguir.
- [ ] **Step 2: Criar o projeto na raiz do repositório.** Run: `npm create vite@latest . -- --template react` e depois `npm install`. Remover o conteúdo de demonstração (`App.css`, logos e contador) e deixar `App.jsx` renderizando `<h1>Catálogo de Streaming</h1>`.
- [ ] **Step 3: Instalar as dependências.** Run: `npm install react-router-dom` e `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`. Em `vite.config.js`, adicionar `test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.js' }`. Em `package.json`, adicionar o script `"test": "vitest"`. `setupTests.js` contém `import '@testing-library/jest-dom'`.
- [ ] **Step 4: Escrever um teste de fumaça.**

```jsx
// src/App.test.jsx
import { render, screen } from '@testing-library/react'
import App from './App'
test('renderiza o título', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Catálogo de Streaming' })).toBeInTheDocument()
})
```

- [ ] **Step 5: Rodar.** Run: `npx vitest run`. Expected: 1 teste PASS.
- [ ] **Step 6: Configurar o token.** Criar `.env.example` com `VITE_TMDB_TOKEN=cole_aqui_seu_read_access_token`. O usuário cria uma conta em themoviedb.org, gera o "API Read Access Token" em Configurações → API e salva em `.env` (`VITE_TMDB_TOKEN=...`). Conferir que `git status` **não** lista `.env`.
- [ ] **Step 7: Verificar a premissa da spec (filtro sem serviços).** Rodar no terminal, com o token, as duas chamadas:
  - A: `/discover/movie?watch_region=BR&with_watch_monetization_types=flatrate&language=pt-BR&sort_by=popularity.desc`
  - B: a mesma URL sem `with_watch_monetization_types`

  Exemplo: `curl -s -H "Authorization: Bearer $TOKEN" "https://api.themoviedb.org/3/discover/movie?..."`. Comparar `total_results`. **Se A < B**, o filtro funciona sem provedores: anotar "premissa confirmada" no commit. **Se A == B**, o filtro é ignorado: anotar "premissa falhou". Nesse caso, a Task 2 envia os IDs dos provedores exibidos quando nenhum estiver selecionado (ver Task 2, Step 3).
- [ ] **Step 8: Commit.** `git add -A && git commit -m "chore: projeto Vite + React com Vitest"` (incluir no corpo o resultado do Step 7).

---

### Task 2: Cliente da API (`tmdb.js`)

**Files:**
- Create: `src/api/tmdb.js`
- Test: `src/api/tmdb.test.js`

**Interfaces:**
- Produces:
  - `getProviders(): Promise<Array<{ id: number, name: string, logoPath: string }>>`: os 10 primeiros por prioridade BR
  - `getStreamingMovies({ providers: number[], page: number }): Promise<{ movies: Movie[], page: number, totalPages: number }>`, com `Movie = { id, title, posterPath, releaseDate, voteAverage, voteCount }`
  - `getMovieDetails(id: string|number): Promise<MovieDetails>`, com `MovieDetails = { id, title, posterPath, releaseDate, runtime, genres: string[], voteAverage, voteCount, overview, streamingProviders: Array<{ id, name, logoPath }> }`
  - `imageUrl(path: string|null, size: 'w92'|'w342'|'w500'): string|null`: retorna `null` quando `path` é nulo
  - Os erros são `Error` com as mensagens exatas das Global Constraints.

- [ ] **Step 1: Escrever os testes que falham.** Em cada teste, `vi.stubGlobal('fetch', vi.fn())` devolve `{ ok, status, json: async () => body }`. Usar `vi.stubEnv('VITE_TMDB_TOKEN', 'tok')`.
  - `getStreamingMovies monta a URL de discover`: com `{ providers: [8, 119], page: 2 }`, a URL chamada contém `/discover/movie`, `watch_region=BR`, `language=pt-BR`, `with_watch_monetization_types=flatrate`, `sort_by=popularity.desc`, `page=2` e `with_watch_providers=8%7C119` (o `|` codificado). O cabeçalho `Authorization` é `Bearer tok`.
  - `getStreamingMovies sem provedores omite with_watch_providers` (se a premissa do Task 1 falhou, este teste passa a exigir o parâmetro preenchido; ver Step 3).
  - `getStreamingMovies converte a resposta`: `{ page: 1, total_pages: 5, results: [{ id: 1, title: 'X', poster_path: '/p.jpg', release_date: '2024-03-01', vote_average: 7.83, vote_count: 10 }] }` resulta em `{ page: 1, totalPages: 5, movies: [{ id: 1, title: 'X', posterPath: '/p.jpg', releaseDate: '2024-03-01', voteAverage: 7.83, voteCount: 10 }] }`.
  - `getProviders ordena por display_priorities.BR e limita a 10`: 12 provedores com prioridades embaralhadas, um deles sem `display_priorities` (cai para `display_priority`), resultam em 10 itens na ordem certa.
  - `getMovieDetails usa append_to_response e extrai flatrate do BR`: a URL contém `/movie/550`, `append_to_response=watch%2Fproviders` e `language=pt-BR`; `genres: [{name:'Drama'}]` vira `['Drama']`; `streamingProviders` vem de `['watch/providers'].results.BR.flatrate` e é `[]` quando `BR` ou `flatrate` não existem.
  - `erro 401 vira mensagem de token`, `erro 404 vira "Filme não encontrado."`, `outro status (500) e fetch rejeitado viram a mensagem genérica`.
  - `token vazio lança a mensagem de token sem chamar fetch` (`vi.stubEnv('VITE_TMDB_TOKEN', '')`).
  - `imageUrl('/a.jpg','w342')` resulta em `'https://image.tmdb.org/t/p/w342/a.jpg'`; `imageUrl(null,'w342')` resulta em `null`.
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/api`. Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `src/api/tmdb.js`.** Uma função interna `request(path, params)` monta a URL com `URLSearchParams`, sempre inclui `language=pt-BR`, faz o `fetch` com o cabeçalho e converte os erros. O token é lido com `import.meta.env.VITE_TMDB_TOKEN` **dentro** da função, para que `vi.stubEnv` funcione. Se a premissa do Task 1 falhou, `getStreamingMovies` com `providers` vazio chama `getProviders()` e usa todos os IDs.
- [ ] **Step 4: Rodar.** Run: `npx vitest run src/api`. Expected: todos PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat: cliente da API do TMDB"` (com `git add src/api` antes).

---

### Task 3: Componentes de apresentação

**Files:**
- Create: `src/components/MovieCard.jsx`, `src/components/MovieGrid.jsx`, `src/components/Loading.jsx`, `src/components/ErrorMessage.jsx`, `src/utils/format.js`, `public/no-poster.svg` (retângulo cinza 2:3 com ícone de filme simples)
- Test: `src/components/MovieCard.test.jsx`, `src/components/ErrorMessage.test.jsx`, `src/utils/format.test.js`

**Interfaces:**
- Consumes: `imageUrl` (Task 2), tipo `Movie` (Task 2).
- Produces:
  - `formatYear(releaseDate: string|undefined): string`: `'2024-03-01'` vira `'2024'`; vazio ou indefinido vira `''`
  - `formatRating(voteAverage: number, voteCount: number): string`: `(7.83, 10)` vira `'⭐ 7.8'`; `voteCount === 0` vira `'Sem nota'`
  - `formatRuntime(minutes: number|null): string`: `112` vira `'1h 52min'`, `45` vira `'45min'`, `120` vira `'2h'`, `0`/`null` vira `''`
  - `<MovieCard movie={Movie} />`: um `Link` para `/filme/{id}` com o pôster (`w342`, ou `/no-poster.svg` quando não houver; `alt` = título), o título, o ano e a nota
  - `<MovieGrid movies={Movie[]} />`: `<ul>` com um `<li key={id}>` de `MovieCard` para cada filme
  - `<Loading />`: elemento com `role="status"` e o texto "Carregando..."
  - `<ErrorMessage message={string} onRetry={fn?} />`: `role="alert"`; mostra o botão "Tentar de novo" só quando `onRetry` existe

- [ ] **Step 1: Escrever os testes que falham.** `format.test.js` cobre todos os exemplos acima. `MovieCard.test.jsx` (renderizado dentro de `MemoryRouter`): título, `'2024'`, `'⭐ 7.8'` e `href="/filme/1"`; sem `posterPath`, a imagem tem `src` `/no-poster.svg`; com `voteCount: 0`, mostra `'Sem nota'` (**Review Focus 4**). `ErrorMessage.test.jsx`: clicar em "Tentar de novo" chama `onRetry`; sem `onRetry`, o botão não aparece.
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/components src/utils`. Expected: FAIL.
- [ ] **Step 3: Implementar os arquivos listados com as assinaturas acima.** Pôster com `loading="lazy"`.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add src public && git commit -m "feat: componentes de cartão, grade, carregando e erro"`

---

### Task 4: Filtro de serviços (`ProviderFilter`)

**Files:**
- Create: `src/components/ProviderFilter.jsx`
- Test: `src/components/ProviderFilter.test.jsx`

**Interfaces:**
- Consumes: `imageUrl` (Task 2), provedores no formato de `getProviders()`.
- Produces: `<ProviderFilter providers={Provider[]} selected={number[]} onChange={(ids: number[]) => void} />`. Cada provedor é um `<button aria-pressed={bool}>` com o logo (`w92`, `alt` = nome). Há também um botão "Limpar", desabilitado quando `selected` está vazio.

- [ ] **Step 1: Escrever os testes que falham:** renderiza um botão por provedor; clicar num provedor não selecionado chama `onChange([...selected, id])`; clicar num selecionado chama `onChange` sem ele; `aria-pressed="true"` nos selecionados; "Limpar" chama `onChange([])`.
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/components/ProviderFilter`. Expected: FAIL.
- [ ] **Step 3: Implementar.** O componente é controlado e não tem estado próprio.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: filtro de serviços de streaming"` (após `git add`).

---

### Task 5: Tela inicial (`HomePage`)

**Files:**
- Create: `src/pages/HomePage.jsx`, `src/utils/movies.js`
- Test: `src/pages/HomePage.test.jsx`, `src/utils/movies.test.js`

**Interfaces:**
- Consumes: `getProviders`, `getStreamingMovies` (Task 2); `ProviderFilter` (Task 4); `MovieGrid`, `Loading`, `ErrorMessage` (Task 3).
- Produces:
  - `parseProviderIds(param: string|null): number[]`: `'8,119'` vira `[8, 119]`; `'abc,,8'` vira `[8]`; `null` vira `[]`
  - `mergeMovies(current: Movie[], incoming: Movie[]): Movie[]`: acrescenta ao fim só os filmes cujo `id` ainda não está na lista
  - `<HomePage />`: lê e escreve `?streaming=` com `useSearchParams` (lista vazia remove o parâmetro)

- [ ] **Step 1: Escrever os testes que falham.** No `HomePage.test.jsx`, usar `vi.mock('../api/tmdb')` e renderizar com `MemoryRouter initialEntries={[...]}`.
  - `movies.test.js`: exemplos de `parseProviderIds` (**Review Focus 1**) e `mergeMovies([A,B],[B,C])` resultando em `[A,B,C]` (**Review Focus 3**).
  - `mostra Loading e depois a grade`.
  - `lê o filtro da URL`: com `/?streaming=8,119`, `getStreamingMovies` é chamado com `{ providers: [8,119], page: 1 }`.
  - `trocar o filtro reinicia na página 1 e substitui a lista`.
  - `Carregar mais acrescenta a página 2 e some na última página`: com `totalPages: 2`, depois do clique a grade tem os itens das duas páginas e o botão "Carregar mais" desaparece.
  - `lista vazia mostra "Nenhum filme encontrado para esses serviços"`.
  - `erro na carga inicial mostra ErrorMessage; "Tentar de novo" refaz a chamada`.
  - `erro no Carregar mais mantém os filmes e mostra o erro junto ao botão`.
  - `resposta antiga não sobrescreve filtro novo` (**Review Focus 2**): a 1ª chamada devolve uma promise resolvida manualmente **depois** da 2ª; a grade final mostra só os filmes da 2ª.
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/pages/HomePage src/utils/movies`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Estados: `movies`, `page`, `totalPages`, `status` (`'loading'|'success'|'error'`), `loadMoreError`. Um `useEffect` depende da string de provedores e carrega a página 1. Para ignorar respostas antigas, usar uma variável `ignore = true` na função de limpeza do efeito. "Carregar mais" usa `mergeMovies`. Os provedores do filtro são carregados uma vez com `getProviders()`; se essa chamada falhar, o filtro não aparece, mas a grade continua funcionando.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: tela inicial com filtro e carregar mais"` (após `git add`).

---

### Task 6: Tela de detalhes (`MovieDetailsPage`)

**Files:**
- Create: `src/pages/MovieDetailsPage.jsx`
- Test: `src/pages/MovieDetailsPage.test.jsx`

**Interfaces:**
- Consumes: `getMovieDetails`, `imageUrl` (Task 2); `formatYear`, `formatRating`, `formatRuntime`, `Loading`, `ErrorMessage` (Task 3).
- Produces: `<MovieDetailsPage />`, que lê `id` com `useParams`.

- [ ] **Step 1: Escrever os testes que falham** (`vi.mock('../api/tmdb')`, `MemoryRouter` com uma `Route path="/filme/:id"`):
  - `mostra título, ano, duração "1h 52min", gêneros, nota e sinopse`.
  - `sinopse vazia mostra "Sinopse não disponível"`.
  - `"Onde assistir" lista os nomes dos streamingProviders`; com a lista vazia, mostra `"Não disponível em streaming por assinatura no Brasil"`.
  - `erro "Filme não encontrado." mostra o link para "/" e não mostra "Tentar de novo"` (**Review Focus 5**, com `/filme/abc`).
  - `outro erro mostra "Tentar de novo", que refaz a chamada`.
  - `"← Voltar" sem histórico navega para "/"` (verificar renderizando também uma `Route path="/"` com um texto marcador).
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/pages/MovieDetailsPage`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Para saber se há histórico no "Voltar", usar `location.key === 'default'` e, nesse caso, `navigate('/')`; senão, `navigate(-1)`. Pôster em `w500`.
- [ ] **Step 4: Rodar.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: página de detalhes do filme"` (após `git add`).

---

### Task 7: Rotas, rodapé e visual

**Files:**
- Create: `src/components/Footer.jsx`, `src/index.css` (substitui o do template), `public/tmdb-logo.svg` (logo oficial baixado de themoviedb.org/about/logos-attribution)
- Modify: `src/App.jsx`, `src/main.jsx`, `src/App.test.jsx`

**Interfaces:**
- Consumes: `HomePage` (Task 5), `MovieDetailsPage` (Task 6).
- Produces: `App` com `BrowserRouter` em `main.jsx`; rotas `/` e `/filme/:id`; cabeçalho com o nome do app linkando para `/`; `Footer` em todas as telas.

- [ ] **Step 1: Atualizar `App.test.jsx` (deve falhar):** renderizar `App` dentro de `MemoryRouter` (com `tmdb` mockado) e verificar que o rodapé contém os dois textos de crédito das Global Constraints e que `/filme/1` renderiza a página de detalhes.
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/App`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Tirar o `BrowserRouter` de `App` e colocá-lo em `main.jsx`, para que os testes usem `MemoryRouter`. Em `index.css`: variáveis em `:root` para o tema escuro (fundo ~`#141414`, texto claro, cor de destaque); grade com `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`; botões de provedor com `aria-pressed="true"` destacados (borda ou opacidade); layout da página de detalhes em coluna no celular e lado a lado a partir de 768px.
- [ ] **Step 4: Rodar todos os testes.** Run: `npx vitest run`. Expected: todos PASS.
- [ ] **Step 5: Ver no navegador.** Run: `npm run dev` e abrir o endereço mostrado. Conferir: a grade carrega; filtrar por Netflix muda a grade e a URL; "Carregar mais" funciona; abrir um filme e voltar mantém o filtro; o layout funciona em largura de celular (DevTools).
- [ ] **Step 6: Commit.** `git commit -m "feat: rotas, rodapé e tema escuro"` (após `git add`).

---

### Task 8: README e publicação

**Files:**
- Create: `README.md`, `vercel.json`

**Interfaces:**
- Consumes: o app completo.

- [ ] **Step 1: Criar o `vercel.json`:**

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- [ ] **Step 2: Escrever o `README.md`:** o que o app faz; pré-requisitos (Node 20+); como obter o token do TMDB; `cp .env.example .env`; `npm install`, `npm run dev` e `npm test`; a nota sobre o token ficar visível no navegador (spec, seção 4); os créditos TMDB/JustWatch.
- [ ] **Step 3: Verificar o build.** Run: `npm run build`. Expected: termina sem erros e gera `dist/`.
- [ ] **Step 4: Commit.** `git add README.md vercel.json && git commit -m "docs: README e configuração da Vercel"`
- [ ] **Step 5: Publicar (passos manuais do usuário, com orientação):** criar um repositório no GitHub e dar `git push`; na Vercel, "Add New Project" → importar o repositório → adicionar a variável `VITE_TMDB_TOKEN` → Deploy. Conferir no site publicado: a grade carrega e recarregar a página em `/filme/{id}` funciona.
