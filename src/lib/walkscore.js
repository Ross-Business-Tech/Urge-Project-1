// Walk Score lookup through the site's server (api/walkscore.js), which keeps the Walk Score key.
export async function lookupWalkScore(address) {
  let res;
  try {
    res = await fetch('./api/walkscore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
  } catch {
    throw Object.assign(new Error('Couldn’t reach walkscore.com. Check your connection and try again.'), { code: 'network' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || typeof data.walkScore !== 'number') {
    const fallback = res.status === 404 && !data ? 'The Walk Score lookup works on the live site only.' : 'The Walk Score lookup didn’t work. Try again, or look it up at walkscore.com.';
    throw Object.assign(new Error(data?.error || fallback), { code: data?.code || (res.status === 404 && !data ? 'unavailable' : 'error') });
  }
  return data;
}

export const walkScoreQuote = (r, when = new Date()) =>
  `Walk Score ${r.walkScore}${r.description ? ` (${r.description})` : ''}${r.transitScore != null ? `, Transit Score ${r.transitScore}` : ''}${r.bikeScore != null ? `, Bike Score ${r.bikeScore}` : ''} for ${r.matchedAddress || 'the project address'}, checked ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
