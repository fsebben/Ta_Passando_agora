# Busca por nome e filtro de nota mínima — Design

**Data:** 2026-10-21
**Status:** aguardando revisão
**Base:** app da v1 (`docs/superpowers/specs/2026-10-20-catalogo-filmes-streaming-design.md`). Tudo o que não é citado aqui continua como na v1.

## 1. Objetivo

Adicionar duas funcionalidades à tela inicial antes da publicação:

1. **Busca por nome do filme**, mostrando só filmes disponíveis em streaming por assinatura no Brasil.
2. **Filtro de nota mínima**, por exemplo "só filmes com nota 8 ou mais".

Os três filtros (busca, streamings e nota) se combinam. Exemplo: "batman" + Netflix + 7+ mostra os filmes do Batman na assinatura da Netflix com nota 7 ou mais.

## 2. Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Nota usada | **Nota do TMDB** (`vote_average`), a mesma dos cartões | O TMDB não fornece a nota do IMDb; usar a OMDb exigiria outra chave, teria limite diário e não permitiria filtrar o catálogo inteiro |
| Mínimo de votos no filtro de nota | **200 votos** (`MIN_VOTES`), não exibido na tela | Sem mínimo, "nota ≥ 8" retornou 2.246 filmes, muitos com ~100 votos; com 200 votos, 254 filmes conhecidos (medido em 2026-10-21) |
| Resultado da busca | **Só filmes em streaming por assinatura no BR** | Mantém a proposta do app; `/search/movie` ignora os filtros de streaming, então cada resultado é conferido |
| Escolha da nota | **Menu com opções fixas**: Qualquer nota, 6+, 7+, 8+, 9+ | Simples, um clique, funciona bem no celular |
| Quando a busca roda | **Ao apertar Enter ou clicar em "Buscar"** | Cada busca faz ~21 chamadas; buscar a cada letra seria pesado |
| Arquitetura | **A tela inicial ganha um "modo busca"** (sem página nova) | Reaproveita grade, "Carregar mais", erros e proteção contra respostas fora de ordem |
| Ordem dos resultados | Busca: relevância do TMDB. Sem busca: popularidade (como hoje) | — |

## 3. Camada da API (`src/api/tmdb.js`)

Constantes novas: `MIN_VOTES = 200`.

### `getStreamingMovies({ providers, minRating, page })` (alterada)
- `minRating > 0`: acrescenta `vote_average.gte=<minRating>` e `vote_count.gte=200` à chamada de `/discover/movie`.
- `minRating === 0`: a chamada fica idêntica à da v1.

### `searchStreamingMovies({ query, providers, minRating, page })` (nova)
1. `GET /search/movie?query=<query>&page=<page>&include_adult=false&language=pt-BR`.
2. Para cada filme da resposta, `GET /movie/{id}/watch/providers`, todas em paralelo (`Promise.all`).
3. Mantém um filme somente se **todas** as condições valem:
   - `results.BR.flatrate` existe e não está vazio;
   - se `providers` não está vazio, algum item de `flatrate` tem `provider_id` em `providers`;
   - se `minRating > 0`, `vote_average >= minRating` **e** `vote_count >= 200`.
4. Retorna `{ movies, page, totalPages }` no mesmo formato de `getStreamingMovies`, com `totalPages = min(total_pages, 500)` e a ordem original da busca.

Como a checagem usa só `flatrate`, lojas de aluguel/compra nunca contam como disponibilidade.

**Página sem nenhum filme em streaming:** a função devolve `movies: []` com `page < totalPages`. Ela **não** busca páginas seguintes automaticamente; a tela oferece "Carregar mais" (seção 4).

**Falhas:** se a busca ou qualquer consulta de providers falhar, a função lança o erro com a mesma regra da v1 (401 → mensagem de token; demais → mensagem genérica). Não há resultado parcial.

## 4. Tela inicial

### Layout (de cima para baixo)
1. `SearchBar`: campo "Buscar filme..." + botão "Buscar".
2. `ProviderFilter`: logos dos streamings (sem o botão "Limpar").
3. Linha com `RatingFilter` ("Nota mínima") e o botão **"Limpar filtros"**.
4. Com busca ativa: título `Resultados para "<busca>"`.
5. Grade, mensagens e "Carregar mais", como na v1.

No celular, as linhas ocupam a largura toda e os itens empilham.

### Componentes
- **`SearchBar({ value, onSearch })`**: formulário com `<input type="search">` (rótulo acessível "Buscar filme") e botão "Buscar". O texto digitado fica em estado local e é inicializado com `value`; quando `value` muda (URL alterada por "Limpar filtros" ou pelo navegador), o campo acompanha. Ao enviar, chama `onSearch(texto.trim())`.
- **`RatingFilter({ value, onChange })`**: `<select>` com rótulo "Nota mínima" e opções `0` "Qualquer nota", `6` "6+", `7` "7+", `8` "8+", `9` "9+". Chama `onChange(Number(valor))`.
- **`ProviderFilter`**: perde o botão "Limpar"; o resto não muda.
- **`HomePage`**: botão "Limpar filtros" que remove `busca`, `streaming` e `nota` da URL. Fica desabilitado quando nenhum filtro está ativo e aparece sempre (inclusive quando os logos falham ao carregar).

### URL
`/?busca=batman&streaming=8,119&nota=7`
- `busca`: texto sem espaços nas pontas; vazio → parâmetro removido.
- `nota`: `parseMinRating(param)` retorna 6, 7, 8 ou 9 quando o valor é exatamente um deles; qualquer outro valor (ausente, `abc`, `5`, `8.5`) → 0.
- `streaming`: como na v1.

### Comportamento
- Com `busca` → `searchStreamingMovies`; sem `busca` → `getStreamingMovies`. As duas recebem os três filtros.
- Mudar qualquer filtro volta para a página 1 e substitui a lista. A proteção contra respostas fora de ordem (efeito com `ignore` e ref do filtro atual) passa a considerar a combinação dos três filtros.
- "Carregar mais" chama a mesma função do modo atual, com `page + 1`, e usa `mergeMovies`.

### Mensagens de lista vazia
| Situação | Mensagem |
|---|---|
| Nenhum filme e `page >= totalPages` | `"Nenhum filme encontrado com esses filtros"` (substitui `"Nenhum filme encontrado para esses serviços"` da v1) |
| Nenhum filme e `page < totalPages` (só ocorre na busca) | `"Nenhum filme em streaming nesta página de resultados."` + botão "Carregar mais" |

## 5. Erros

Iguais à v1: estado de erro com "Tentar de novo" na carga inicial e erro junto ao botão no "Carregar mais", mantendo os filmes já carregados.

## 6. Testes

Vitest + React Testing Library, escritos antes do código, sem acessar a internet.

- **`tmdb.js`**
  - `getStreamingMovies` com `minRating: 8` envia `vote_average.gte=8` e `vote_count.gte=200`; com `minRating: 0` não envia nenhum dos dois.
  - `searchStreamingMovies` chama `/search/movie` com `query`, `page`, `include_adult=false` e `language=pt-BR`.
  - Mantém só filmes com `flatrate` no BR (ignora os que têm só `rent`/`buy` ou nada no BR).
  - Com `providers`, mantém só os que têm um desses ids em `flatrate`.
  - Com `minRating`, descarta nota abaixo do mínimo e filmes com menos de 200 votos.
  - Página sem filmes em streaming devolve `movies: []` com `page < totalPages`.
  - Falha em uma consulta de providers → mensagem genérica.
  - `totalPages` limitado a 500.
- **`parseMinRating`**: `'8'` → 8; `null`, `'abc'`, `'5'`, `'8.5'` → 0.
- **`SearchBar`**: enviar chama `onSearch` com o texto sem espaços nas pontas; mudar `value` atualiza o campo.
- **`RatingFilter`**: mostra as 5 opções com o valor atual selecionado; escolher "8+" chama `onChange(8)`.
- **`HomePage`**
  - Com `?busca=batman` chama `searchStreamingMovies`; sem busca chama `getStreamingMovies`; os três filtros vão juntos.
  - Buscar, mudar a nota ou mudar streamings reinicia na página 1 e atualiza a URL.
  - "Limpar filtros" remove todos os parâmetros e fica desabilitado sem filtros.
  - Título `Resultados para "batman"` aparece só com busca.
  - As duas mensagens de lista vazia.
  - Resposta antiga de uma busca não sobrescreve a busca nova.
- Os testes da v1 que dependem do "Limpar" dentro do `ProviderFilter` e do texto `"Nenhum filme encontrado para esses serviços"` são atualizados para o novo comportamento.
- **Verificação real** (com o token, após os testes): buscar "batman" com e sem filtros e usar "8+" sem busca, conferindo no navegador.

## 7. Fora do escopo
Busca enquanto digita, sugestões automáticas, nota do IMDb, busca automática de várias páginas quando uma vem vazia.
