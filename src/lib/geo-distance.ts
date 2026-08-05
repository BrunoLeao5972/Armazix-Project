// Matemática geográfica pura — sem chamada de rede. Usada pelos modelos de
// frete por distância depois que a loja e o cliente já têm lat/lng resolvidos.

const EARTH_RADIUS_M = 6_371_000;

/** Distância em linha reta entre dois pontos, em metros (fórmula de Haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Testa se um ponto está dentro de um polígono (algoritmo ray-casting).
 * `polygon` é um array de [lat, lng] (mesmo formato salvo pelo desenho no
 * mapa em DeliveryPricingConfig — ver BairroDesenhoSettings.poligonos).
 */
export function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<[number, number]>): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  const { lat: y, lng: x } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
