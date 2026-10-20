import { mergeMovies, parseProviderIds } from './movies'

describe('parseProviderIds', () => {
  test('lê ids separados por vírgula', () => expect(parseProviderIds('8,119')).toEqual([8, 119]))
  test('ignora valores inválidos e vazios', () => expect(parseProviderIds('abc,,8')).toEqual([8]))
  test('null vira lista vazia', () => expect(parseProviderIds(null)).toEqual([]))
})

describe('mergeMovies', () => {
  test('acrescenta só os filmes que ainda não estão na lista', () => {
    const a = { id: 1 }
    const b = { id: 2 }
    const bRepetido = { id: 2, title: 'repetido' }
    const c = { id: 3 }
    expect(mergeMovies([a, b], [bRepetido, c])).toEqual([a, b, c])
  })
})
