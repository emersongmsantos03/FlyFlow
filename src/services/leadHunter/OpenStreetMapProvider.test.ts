import { describe, expect, it } from 'vitest'
import { mapNominatimResult, mapOsmElement } from './OpenStreetMapProvider'

describe('OpenStreetMapLeadProvider', () => {
  it('converte somente dados reais presentes no elemento', () => {
    const lead = mapOsmElement({ type: 'node', id: 42, lat: -25.4, lon: -49.2, tags: { name: 'Pousada Teste', tourism: 'guest_house', phone: '41999999999', website: 'https://exemplo.com', 'addr:street': 'Rua Um', 'addr:housenumber': '10' } }, 'Curitiba', ['Pousada'])
    expect(lead).toMatchObject({ id: 'osm-node-42', name: 'Pousada Teste', categoryName: 'Pousada', city: 'Curitiba', phone: '41999999999', email: '' })
    expect(lead?.sources).toEqual(['OpenStreetMap'])
    expect(lead?.sourceUrls?.[0]).toContain('openstreetmap.org/node/42')
  })

  it('ignora registros públicos sem nome', () => {
    expect(mapOsmElement({ type: 'way', id: 7, tags: { tourism: 'hotel' } }, 'Curitiba', ['Hotel'])).toBeNull()
  })

  it('não inventa canais de contato ausentes', () => {
    const lead = mapOsmElement({ type: 'node', id: 8, tags: { name: 'Cabana Real', tourism: 'chalet' } }, 'Lapa', ['Cabana'])
    expect(lead?.phone).toBe('')
    expect(lead?.whatsapp).toBe('')
    expect(lead?.scoreReasons?.some((reason) => reason.id === 'incomplete-data')).toBe(true)
  })

  it('não classifica refinaria como chalé por causa do texto pesquisado', () => {
    const lead = mapNominatimResult({
      osm_type: 'way', osm_id: 90, lat: '-25.4', lon: '-49.2',
      name: 'Refinaria Presidente Getúlio Vargas',
      display_name: 'Refinaria Presidente Getúlio Vargas, Araucária',
      category: 'man_made', type: 'works',
    }, 'Araucária', ['Chalé'])
    expect(lead).toBeNull()
  })

  it('mantém hospedagem quando a classificação pública confirma o tipo', () => {
    const lead = mapNominatimResult({
      osm_type: 'node', osm_id: 91, lat: '-25.4', lon: '-49.2',
      name: 'Chalés da Serra', display_name: 'Chalés da Serra, Lapa',
      category: 'tourism', type: 'chalet',
    }, 'Lapa', ['Chalé'])
    expect(lead?.categoryName).toBe('Chalé ou cabana')
    expect(lead?.recommendedService).toBe('Filmagem de pousada')
  })

  it('remove infraestrutura industrial de baixa aderência comercial', () => {
    expect(mapOsmElement({
      type: 'way', id: 92,
      tags: { name: 'Indústria de Tijolos Exemplo', landuse: 'industrial' },
    }, 'Curitiba', ['Indústria'])).toBeNull()
  })
})
