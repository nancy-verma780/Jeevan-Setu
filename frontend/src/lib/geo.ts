/** Great-circle distance in km (same formula as the server, Eq. 3.1-3.2). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function directionsUrl(from: [number, number] | null, to: [number, number]): string {
  const origin = from ? `&origin=${from[0]},${from[1]}` : "";
  return `https://www.google.com/maps/dir/?api=1${origin}&destination=${to[0]},${to[1]}&travelmode=driving`;
}
