import { tooMany } from './_lib.js';
// Walk Score lookup for the project address (Deal data, section 4).
//   1. The address is turned into map coordinates with the free U.S. Census geocoder (no key).
//   2. Walk Score's official API returns the Walk, Transit and Bike Scores.
// Needs WALKSCORE_API_KEY in the host's settings (free key: walkscore.com/professional/sign-up).
// The key stays on the server.

const json = (res, code, body) => res.status(code).json(body);

async function geocode(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(address)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('geocoder');
  const m = (await r.json())?.result?.addressMatches?.[0];
  return m ? { lat: m.coordinates.y, lon: m.coordinates.x, matched: m.matchedAddress } : null;
}

export default async function walkscore(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
  if (tooMany(req, 120)) return json(res, 429, { error: 'Too many Walk Score lookups this hour. Try again later.' });
  const address = String(req.body?.address || '').trim().slice(0, 300);
  if (address.length < 5) return json(res, 400, { error: 'Type the project’s street address first.', code: 'no_address' });
  const key = String(process.env.WALKSCORE_API_KEY || '').trim();
  if (!key) return json(res, 501, { error: 'Automatic fill-in isn’t switched on for this site (it needs a Walk Score API key). Use “Open this address on walkscore.com” and type the score in.', code: 'no_key' });

  let place;
  try { place = await geocode(address); } catch { return json(res, 502, { error: 'The address lookup service didn’t answer. Try again in a minute.' }); }
  if (!place) return json(res, 404, { error: 'Couldn’t find that address. Use the full street address with city and state (e.g. 123 Main St, Detroit, MI).', code: 'not_found' });

  const q = new URLSearchParams({ format: 'json', address: place.matched || address, lat: place.lat, lon: place.lon, transit: '1', bike: '1', wsapikey: key });
  const r = await fetch(`https://api.walkscore.com/score?${q}`, { signal: AbortSignal.timeout(15000) });
  const d = await r.json().catch(() => null);
  if (!d) return json(res, 502, { error: 'Walk Score didn’t answer. Try again in a minute.' });
  if (d.status === 2) return json(res, 503, { error: 'Walk Score is still calculating this address. Try again in a few minutes.' });
  if (d.status === 40) return json(res, 502, { error: 'Walk Score rejected the site’s Walk Score key. Tell whoever manages the tool.' });
  if (d.status === 41) return json(res, 429, { error: 'The site has used up today’s Walk Score lookups. Try again tomorrow.' });
  if (d.status !== 1 || typeof d.walkscore !== 'number') return json(res, 502, { error: 'Walk Score couldn’t score this address.' });
  return json(res, 200, {
    walkScore: d.walkscore,
    description: d.description || '',
    transitScore: d.transit?.score ?? null,
    transitDescription: d.transit?.description || '',
    bikeScore: d.bike?.score ?? null,
    link: /^https:\/\/(www\.)?walkscore\.com\//.test(String(d.ws_link || '')) ? d.ws_link : 'https://www.walkscore.com',
    matchedAddress: place.matched,
  });
}
