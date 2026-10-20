import { formatRating, formatRuntime, formatYear } from './format'

describe('formatYear', () => {
  test('extrai o ano da data', () => expect(formatYear('2024-03-01')).toBe('2024'))
  test('data vazia vira texto vazio', () => expect(formatYear('')).toBe(''))
  test('data indefinida vira texto vazio', () => expect(formatYear(undefined)).toBe(''))
})

describe('formatRating', () => {
  test('mostra a nota com uma casa decimal', () => expect(formatRating(7.83, 10)).toBe('⭐ 7.8'))
  test('sem votos mostra "Sem nota"', () => expect(formatRating(0, 0)).toBe('Sem nota'))
})

describe('formatRuntime', () => {
  test('horas e minutos', () => expect(formatRuntime(112)).toBe('1h 52min'))
  test('só minutos', () => expect(formatRuntime(45)).toBe('45min'))
  test('horas exatas', () => expect(formatRuntime(120)).toBe('2h'))
  test('zero vira texto vazio', () => expect(formatRuntime(0)).toBe(''))
  test('null vira texto vazio', () => expect(formatRuntime(null)).toBe(''))
})
