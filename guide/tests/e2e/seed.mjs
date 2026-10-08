// Creates a session, answers and a lead through the public API, for testing
// the result page, the booking webhook and the dashboard.
// Usage: node tests/e2e/seed.mjs <baseUrl> <profile> [variant]  -> prints JSON with token and email
const [base = 'http://localhost:3100', profile = 'creator', variant = 'full'] = process.argv.slice(2);
const profiles = {
  creator: { role: 'creator', asset: 'music_release', platforms: ['tiktok', 'instagram_reels'], goal: 'streams', timing: 'this_month', budget: { band: '3k_10k' }, deciding: 'no' },
  brand: { role: 'brand', asset: 'product_launch', platforms: ['instagram_reels', 'x'], goal: 'sales', timing: 'two_weeks', budget: { band: '10k_50k' }, deciding: 'yes' },
  lowbuyer: { role: 'creator', asset: 'personal_brand', platforms: ['tiktok'], goal: 'views', timing: 'exploring', budget: { band: 'under_3k' }, deciding: 'no' },
  clipper: { role: 'clipper', asset: 'music', platforms: ['tiktok'], goal: 'side_income', timing: 'new' },
};
const answers = profiles[profile];
const post = async (path, body) => {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const s = await post('/api/session', { source: { src: 'seed' }, force: { variant, progress: 'none' } });
const token = s.data.token;
for (const [k, v] of Object.entries(answers)) await post('/api/answer', { token, questionId: k, value: v });
const email = `seed+${profile}${Date.now()}@example.com`;
const lead = await post('/api/lead', { token, firstName: 'Seed', email, igHandle: '@seed', company: answers.deciding === 'yes' ? 'Seed Label' : '', consent: true, role: variant === 'plain' ? answers.role : undefined });
console.log(JSON.stringify({ token, email, status: lead.status, qualified: lead.data?.lead?.qualified, humanPriority: lead.data?.lead?.humanPriority, ref: lead.data?.lead?.ref }));
