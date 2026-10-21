# Busca por nome e filtro de nota — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à tela inicial uma busca por nome (só filmes em streaming por assinatura no BR) e um filtro de nota mínima do TMDB, combináveis com o filtro de streamings.

**Architecture:** `tmdb.js` ganha `minRating` em `getStreamingMovies` e a nova `searchStreamingMovies` (busca + checagem de providers por filme), ambas com o mesmo formato de retorno. A `HomePage` lê `busca`, `streaming` e `nota` da URL e escolhe a função conforme haja busca. Dois componentes novos, `SearchBar` e `RatingFilter`; o "Limpar" sai do `ProviderFilter` e vira "Limpar filtros" na `HomePage`.

**Tech Stack:** React, React Router, Vitest, React Testing Library (como na v1).

**Spec:** `docs/superpowers/specs/2026-10-21-busca-e-filtro-de-nota-design.md`

## Global Constraints

- Nota = `vote_average` do TMDB. `MIN_VOTES = 200`. Opções de nota: `0` "Qualquer nota", `6` "6+", `7` "7+", `8` "8+", `9` "9+".
- Parâmetros de URL: `busca`, `streaming`, `nota`. `nota` só aceita exatamente `6|7|8|9`; qualquer outro valor → 0.
- Disponibilidade = `results.BR.flatrate` não vazio (nunca `rent`/`buy`).
- `totalPages` sempre limitado a 500.
- Somente `src/api/tmdb.js` chama `fetch`.
- Textos exatos:
  - `"Buscar"`, rótulo do campo `"Buscar filme"`, placeholder `"Buscar filme..."`
  - `"Nota mínima"`, `"Limpar filtros"`
  - `Resultados para "<busca>"`
  - `"Nenhum filme encontrado com esses filtros"`
  - `"Nenhum filme em streaming nesta página de resultados."`
- Testes nunca acessam a internet.

## Review Focus

1. **Busca com caracteres especiais e acentos** (`Tom & Jerry`, `o poderoso chefão`): o texto chega intacto ao TMDB, sem quebrar a URL. Teste na Task 1.
2. **Busca só com espaços** (`"   "`) ou `?busca=` vazio: não entra em modo busca; mostra a listagem normal. Testes nas Tasks 2 e 3.
3. **Resultado de busca sem `vote_average`/`vote_count` com nota mínima ativa**: o filme é descartado sem quebrar. Teste na Task 1.
4. **Digitar no campo sem enviar**: não dispara nenhuma chamada à API. Teste na Task 3.
5. **Voltar de um filme para uma busca**: a URL restaura busca, nota e streamings, e o campo mostra o texto buscado. Teste na Task 3 (render com `?busca=batman&nota=8&streaming=8`).

---

### Task 1: API — nota mínima e busca

**Files:**
- Modify: `src/api/tmdb.js`
- Test: `src/api/tmdb.test.js`

**Interfaces:**
- Produces:
  - `getStreamingMovies({ providers: number[], minRating: number, page: number })` → `{ movies, page, totalPages }` (mesmo formato da v1)
  - `searchStreamingMovies({ query: string, providers: number[], minRating: number, page: number })` → `{ movies: Movie[], page: number, totalPages: number }`
  - `MIN_VOTES` exportada (200)

- [ ] **Step 1: Escrever os testes que falham** (usar os helpers `mockFetch`/`calledUrl` já existentes; para a busca, `fetch` simulado responde conforme a URL: `/search/movie` → página de busca; `/movie/{id}/watch/providers` → providers daquele id).
  - `getStreamingMovies com minRating 8 envia vote_average.gte=8 e vote_count.gte=200`
  - `getStreamingMovies com minRating 0 não envia vote_average.gte nem vote_count.gte`
  - `searchStreamingMovies monta a URL de busca`: path `/3/search/movie`, `query`, `page=2`, `include_adult=false`, `language=pt-BR`.
  - `searchStreamingMovies preserva caracteres especiais` (**Review Focus 1**): `query: 'Tom & Jerry'` → `searchParams.get('query') === 'Tom & Jerry'`.
  - `mantém só filmes com flatrate no BR`: 4 resultados — A (BR flatrate [8]), B (BR só rent), C (só US flatrate), D (BR flatrate [119]) → `[A, D]` na ordem original.
  - `com providers [8] mantém só quem tem 8 em flatrate` → `[A]`.
  - `com minRating 8 descarta nota baixa e poucos votos`: E (8.5, 500 votos) fica; F (7.9, 500) sai; G (9.0, 150) sai.
  - `com minRating descarta filme sem vote_average/vote_count` (**Review Focus 3**).
  - `página sem filmes em streaming devolve movies [] com page < totalPages`: `{ page: 1, total_pages: 3 }`, nenhum com flatrate BR → `{ movies: [], page: 1, totalPages: 3 }`.
  - `falha numa consulta de providers vira a mensagem genérica` (status 500 para um id).
  - `totalPages da busca limitado a 500` (`total_pages: 800`).
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/api`. Expected: os testes novos FALHAM (função inexistente / parâmetros ausentes); os antigos passam.
- [ ] **Step 3: Implementar em `src/api/tmdb.js`.** `MIN_VOTES = 200`. Em `getStreamingMovies`, acrescentar os dois parâmetros só quando `minRating > 0`. `searchStreamingMovies`: `request('/search/movie', { query, page: String(page), include_adult: 'false' })`; depois `Promise.all` de `request(`/movie/${id}/watch/providers`)` para cada resultado; filtrar com as três regras da spec §3; mapear com `toMovie`; `totalPages: Math.min(total_pages, MAX_PAGES)`. Extrair a regra de nota num helper interno `meetsRating(movie, minRating)` usado só pela busca.
- [ ] **Step 4: Rodar.** Run: `npx vitest run`. Expected: tudo PASS (a `HomePage` ainda chama sem `minRating`; `undefined > 0` é falso, então nada quebra).
- [ ] **Step 5: Commit.** `git add src/api && git commit -m "feat: nota mínima e busca em streaming na API"`

---

### Task 2: Componentes de busca e nota

**Files:**
- Create: `src/components/SearchBar.jsx`, `src/components/RatingFilter.jsx`
- Modify: `src/utils/movies.js`, `src/components/ProviderFilter.jsx`
- Test: `src/components/SearchBar.test.jsx`, `src/components/RatingFilter.test.jsx`, `src/utils/movies.test.js`, `src/components/ProviderFilter.test.jsx`

**Interfaces:**
- Produces:
  - `parseMinRating(param: string|null): 0|6|7|8|9` em `src/utils/movies.js`
  - `RATING_OPTIONS = [{ value: 0, label: 'Qualquer nota' }, { value: 6, label: '6+' }, { value: 7, label: '7+' }, { value: 8, label: '8+' }, { value: 9, label: '9+' }]` em `src/utils/movies.js` (usada por `parseMinRating` e pelo `RatingFilter`)
  - `<SearchBar value={string} onSearch={(text: string) => void} />`
  - `<RatingFilter value={number} onChange={(n: number) => void} />`
  - `<ProviderFilter providers selected onChange />` sem botão "Limpar"

- [ ] **Step 1: Escrever os testes que falham.**
  - `parseMinRating`: `'8'` → 8; `null`, `'abc'`, `'5'`, `'8.5'` → 0.
  - `SearchBar`: digitar `"  batman  "` e clicar "Buscar" → `onSearch('batman')`; apertar Enter também envia; enviar `"   "` → `onSearch('')` (**Review Focus 2**); `rerender` com `value="duna"` → o campo (`getByRole('searchbox', { name: 'Buscar filme' })`) mostra `"duna"`; digitar sem enviar não chama `onSearch`.
  - `RatingFilter`: `getByRole('combobox', { name: 'Nota mínima' })` com 5 opções nas labels exatas; `value={7}` deixa "7+" selecionado; escolher "8+" → `onChange(8)` (número).
  - `ProviderFilter`: remover os testes de "Limpar" e adicionar `não renderiza botão "Limpar"`.
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/components src/utils`. Expected: FAIL nos novos.
- [ ] **Step 3: Implementar.** `SearchBar`: `<form role="search">` com `<input type="search" aria-label="Buscar filme" placeholder="Buscar filme...">`, estado local inicializado com `value` e sincronizado com `useEffect(() => setText(value), [value])`; `onSubmit` faz `preventDefault` e chama `onSearch(text.trim())`. `RatingFilter`: `<label>` "Nota mínima" associado ao `<select>` por `htmlFor`/`id`. `ProviderFilter`: remover o botão e a regra de `disabled`.
- [ ] **Step 4: Rodar.** Run: `npx vitest run src/components src/utils`. Expected: PASS. (Os testes da `HomePage` que clicam em "Limpar" vão falhar até a Task 3 — é esperado; anotar no commit.)
- [ ] **Step 5: Commit.** `git add src && git commit -m "feat: componentes de busca e nota mínima"`

---

### Task 3: Tela inicial com busca, nota e "Limpar filtros"

**Files:**
- Modify: `src/pages/HomePage.jsx`, `src/index.css`, `src/App.test.jsx`
- Test: `src/pages/HomePage.test.jsx`

**Interfaces:**
- Consumes: `getStreamingMovies`, `searchStreamingMovies` (Task 1); `SearchBar`, `RatingFilter`, `parseMinRating` (Task 2); `ProviderFilter`, `MovieGrid`, `Loading`, `ErrorMessage`, `mergeMovies`, `parseProviderIds` (v1).

- [ ] **Step 1: Atualizar e escrever os testes que falham** (`HomePage.test.jsx`: mockar também `searchStreamingMovies`; `App.test.jsx`: trocar o texto da lista vazia).
  - Atualizar: as expectativas `toHaveBeenCalledWith({ providers, page })` passam a incluir `minRating: 0`; os testes de "Limpar" passam a usar "Limpar filtros"; o texto vazio vira `"Nenhum filme encontrado com esses filtros"`.
  - `com ?busca=batman chama searchStreamingMovies com os três filtros`: `/?busca=batman&streaming=8&nota=8` → `searchStreamingMovies({ query: 'batman', providers: [8], minRating: 8, page: 1 })`; `getStreamingMovies` não é chamado; o campo mostra `"batman"` e o menu mostra "8+" (**Review Focus 5**).
  - `?busca= vazio usa a listagem normal` (**Review Focus 2**).
  - `sem busca, a nota vai para getStreamingMovies`: `/?nota=7` → `{ providers: [], minRating: 7, page: 1 }`.
  - `buscar atualiza a URL e reinicia na página 1`: digitar "duna" + "Buscar" → `currentSearch` contém `busca=duna`; última chamada com `page: 1`.
  - `digitar sem enviar não chama a API` (**Review Focus 4**): contar chamadas antes e depois de digitar.
  - `escolher 8+ atualiza a URL com nota=8`.
  - `"Limpar filtros" remove busca, streaming e nota` → `currentSearch === ''`; `desabilitado sem filtros`.
  - `mostra Resultados para "batman" só com busca`.
  - `busca sem resultados em streaming numa página com mais páginas mostra a mensagem e "Carregar mais"`; clicar chama `searchStreamingMovies` com `page: 2`.
  - `resposta antiga de busca não sobrescreve a busca nova` (mesmo padrão `deferred()` do teste da v1).
- [ ] **Step 2: Rodar.** Run: `npx vitest run src/pages/HomePage src/App`. Expected: FAIL nos novos/atualizados.
- [ ] **Step 3: Implementar em `HomePage.jsx`.** Ler `busca` (com `trim`), `streaming` e `nota` da URL; `filterKey` = string que combine os três (ex.: `searchParams.toString()` não serve por causa da ordem — usar `` `${query}|${providersKey}|${minRating}` ``). Uma função interna `fetchPage(page)` escolhe `searchStreamingMovies` quando `query` não está vazia, senão `getStreamingMovies`, sempre com `{ providers, minRating, page }` (+ `query` na busca); o efeito da página 1 e o "Carregar mais" usam essa função. Um helper `updateParams(changes)` aplica mudanças em cópia de `searchParams`, removendo chaves vazias/zeradas. Layout conforme spec §4; o "Carregar mais" aparece quando `page < totalPages` também com lista vazia. Em `index.css`: estilos para `.search-bar` (campo + botão em linha, largura total), `.filters-row` (nota + limpar, `flex-wrap`), `.results-title`, `select` no tema escuro.
- [ ] **Step 4: Rodar a suíte inteira.** Run: `npx vitest run`. Expected: todos PASS.
- [ ] **Step 5: Commit.** `git add src && git commit -m "feat: tela inicial com busca, nota mínima e limpar filtros"`

---

### Task 4: Verificação real e README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Build.** Run: `npm run build`. Expected: sem erros.
- [ ] **Step 2: Verificação com a API real** (servidor `npm run dev`, token no `.env`): buscar "batman" sem filtros (aparecem só filmes em streaming); "batman" + Netflix; "8+" sem busca (notas ≥ 8 nos cartões); busca sem resultados ("xyzxyz" → "Nenhum filme encontrado com esses filtros"); abrir um filme e voltar (busca, nota e streamings mantidos). Anotar o resultado no commit.
- [ ] **Step 3: README.** Na lista de funcionalidades, acrescentar "Busca por nome (só filmes em streaming)" e "Filtro de nota mínima (nota do TMDB, com pelo menos 200 votos)".
- [ ] **Step 4: Commit.** `git add README.md && git commit -m "docs: README com busca e filtro de nota"`
