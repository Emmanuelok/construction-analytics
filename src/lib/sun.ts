/* Solar position — pure, unit-tested. Given a date/time + latitude/longitude,
 * returns the sun's azimuth (0=N, clockwise) and altitude (° above horizon), plus
 * a scene direction vector for the shadow-study light. Standard astronomical
 * algorithm (after Agafonkin's SunCalc). Drives the building viewer's sun/shadow. */

const rad = Math.PI / 180
const dayMs = 1000 * 60 * 60 * 24
const J1970 = 2440588, J2000 = 2451545
const e = rad * 23.4397 // obliquity of the ecliptic

const toDays = (date: Date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000
const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d)
const eclipticLongitude = (M: number) => {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  return M + C + rad * 102.9372 + Math.PI
}
const declination = (l: number) => Math.asin(Math.sin(0) * Math.cos(e) + Math.cos(0) * Math.sin(e) * Math.sin(l))
const rightAscension = (l: number) => Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l))
const siderealTime = (d: number, lw: number) => rad * (280.16 + 360.9856235 * d) - lw

export type SunPos = { azimuth: number; altitude: number }

/** Sun azimuth (deg, 0=N→90=E) and altitude (deg above horizon) for a moment + place. */
export function sunPosition(date: Date, lat: number, lng: number): SunPos {
  const lw = rad * -lng
  const phi = rad * lat
  const d = toDays(date)
  const L = eclipticLongitude(solarMeanAnomaly(d))
  const dec = declination(L)
  const H = siderealTime(d, lw) - rightAscension(L)
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  const azFromSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  return {
    azimuth: ((azFromSouth / rad + 180) % 360 + 360) % 360,
    altitude: Math.round((altitude / rad) * 10) / 10,
  }
}

/** Unit direction toward the sun in scene coords (x=East, y=up, z=North). */
export function sunDirection(azimuth: number, altitude: number): { x: number; y: number; z: number } {
  const a = azimuth * rad, al = altitude * rad
  return { x: Math.sin(a) * Math.cos(al), y: Math.sin(al), z: Math.cos(a) * Math.cos(al) }
}

/** A UTC moment from a month (1–12, mid-month) and local-solar hour — handy for a
 *  date/time slider where hour 12 ≈ solar noon (paired with lng 0). */
export function momentOf(month: number, hour: number, year = 2024): Date {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60)
  return new Date(Date.UTC(year, Math.max(0, Math.min(11, month - 1)), 15, h, m, 0))
}
