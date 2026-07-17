import type { LeadHunterCity, LeadHunterProspect, LeadHunterRoute } from '../../types'

const mapsDestination = (lead: LeadHunterProspect) => lead.address || `${lead.name}, ${lead.city}`

export const buildGoogleMapsRouteUrl = (startAddress: string, leads: LeadHunterProspect[]) => {
  if (!leads.length) return ''
  const ordered = [...leads].sort((a, b) => b.score - a.score)
  const destination = mapsDestination(ordered[ordered.length - 1])
  const waypoints = ordered.slice(0, -1).map(mapsDestination).join('|')
  const params = new URLSearchParams({ api: '1', origin: startAddress || 'Curitiba, PR', destination, travelmode: 'driving' })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export const recommendDailyMission = (cities: LeadHunterCity[], prospects: LeadHunterProspect[], routes: LeadHunterRoute[], preferredCity = '') => {
  const activeCities = cities.filter((city) => city.active && (!city.blockedUntil || new Date(city.blockedUntil) <= new Date()))
  const ranked = activeCities.map((city) => {
    const leads = prospects.filter((lead) => lead.cityId === city.id && !lead.discardedPermanently && !lead.contactId)
    const averageScore = leads.length ? leads.reduce((total, lead) => total + lead.score, 0) / leads.length : 0
    const newCount = leads.filter((lead) => lead.isNew).length
    const recentRoutes = routes.filter((route) => route.targetCity === city.name && Date.now() - new Date(route.createdAt).getTime() < 21 * 86_400_000).length
    const preferenceBonus = preferredCity && city.name.toLowerCase().includes(preferredCity.toLowerCase()) ? 50 : 0
    const rank = preferenceBonus + newCount * 8 + leads.length * 3 + averageScore / 5 - city.distanceFromBaseKm / 4 - recentRoutes * 20 - city.searchCount * 0.5
    return { city, leads: leads.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.score - a.score), averageScore, newCount, rank }
  }).filter((item) => item.leads.length).sort((a, b) => b.rank - a.rank)
  return ranked[0]
}
