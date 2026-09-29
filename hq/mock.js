// Local-only fake Supabase + sheet, loaded on localhost with ?mock. Never used in production.
(function () {
  const id = () => Math.random().toString(36).slice(2, 10);
  const accts = ['Peter Plaut', 'Chase', 'Tengku Harris', 'Razeen', 'Sara Rathsack', 'Anaz'].map((n, i) => ({ id: 'a' + i, owner_name: n, account_name: n, active: true, sort_order: i, posting_days: [1, 3], posting_time: '09:00' }));
  const A = n => accts.find(a => a.owner_name === n).id;
  const d = off => new Date(Date.now() - off * 864e5).toISOString();
  const post = (acct, off, name, comments, tags = {}, metrics = {}) => ({ id: id(), account_id: A(acct), post_name: name, posted_at: d(off), linkedin_post_url: 'https://linkedin.com', commenter_count: comments, unreplied_count: 0, tags, metrics });
  const db = {
    daily_ops_accounts: accts,
    daily_ops_posts: [
      post('Peter Plaut', 2, '900+ family offices map', 41, { format: 'Infographic', creative: 'Map', hook: 'Data / stat', cta: 'Comment keyword', creative_group: '900-fo-map', boosted_by: ['Chase', 'Razeen'] }, { impressions: 5200, reactions: 88, saves: 14 }),
      post('Razeen', 2, '900+ family offices map', 12, { format: 'Infographic', creative: 'Map', hook: 'Data / stat', cta: 'Comment keyword', creative_group: '900-fo-map' }, { impressions: 1900, reactions: 30, saves: 4 }),
      post('Chase', 3, 'Why most raises die at the teaser', 22, { format: 'Text only', hook: 'Contrarian', cta: 'DM me', boosted_by: ['Peter Plaut'] }, { impressions: 1828, reactions: 40 }),
      post('Tengku Harris', 4, 'The mandate we turned down', 2, { format: 'Text only', hook: 'Story', cta: 'DM me' }, { impressions: 407 }),
      post('Chase', 8, 'Capital stack explained', 9, { format: 'Carousel / document', creative: 'Chart / data', hook: 'List / how-to', cta: 'Comment keyword' }, { impressions: 1400 }),
      post('Peter Plaut', 9, 'What family offices ask first', 27, { format: 'Single image', creative: 'Person photo', hook: 'Question', cta: 'Question', boosted_by: ['Chase'] }, { impressions: 3500 }),
      post('Razeen', 10, 'GCC capital flows', 32, { format: 'Single image', creative: 'Chart / data', hook: 'Data / stat', cta: 'Comment keyword' }, { impressions: 2024 }),
      post('Sara Rathsack', 11, 'Deal flow Friday', 14, {}, { impressions: 1678 }),
    ],
    daily_ops_experiments: [
      { id: id(), name: 'Map creative vs chart creative', variable: 'Creative', primary_metric: 'comments', variant_a: 'Chart of FO allocations', variant_b: 'Map of 900+ family offices', account_a: 'Peter Plaut', account_b: 'Peter Plaut', hypothesis: 'Maps feel exclusive and invite "send me the list" comments.', status: 'running', started_at: d(6).slice(0, 10), metrics_a: { impressions: 3100, comments: 11, reactions: 40 }, metrics_b: { impressions: 5200, comments: 41, reactions: 88, meetings: 2 }, assets: [] },
      { id: id(), name: 'Hostage experiment vs provided list', variable: 'CTA', primary_metric: 'replies', variant_a: 'Provided list', variant_b: 'Hostage (list held back until they reply)', status: 'complete', started_at: d(20).slice(0, 10), ended_at: d(13).slice(0, 10), metrics_a: { sent: 14, replies: 1 }, metrics_b: { sent: 13, replies: 10 }, winner: 'B', learning: 'Gating the list 10x’d replies with the same send volume.', assets: [] },
    ],
    growth_meetings: [],
    daily_ops_schedule: [],
    growth_settings: [{ id: 1, scrape_enabled: true, monthly_budget: 19, scrape_mode: 'daily', scrape_hour: 9 }],
    daily_ops_linkedin_auto_log: [
      { id: 3, created_at: d(0.1), run_mode: 'comments', usage_before: 6.2, usage_after: 6.26, detail: { usage_usd: 6.2, recommended_average_interval_minutes: 190, result: { comment_posts_processed: 2 } } },
      { id: 2, created_at: d(0.3), run_mode: 'posts', usage_before: 6.1, usage_after: 6.2, detail: { usage_usd: 6.1, result: { posts_saved: 9 } } },
      { id: 1, created_at: d(0.6), run_mode: 'error_posts', usage_before: 6.0, detail: { error: 'insert post: duplicate key' } },
    ],
  };
  { const t = new Date(Date.now() - 2 * 3600e3 + 8 * 3600e3).toISOString().slice(0, 10);
    [['08:30', "Sara · Respond to 20 comments", 'done', "Respond to 20 comments on Sara's posts before the posting run begins."], ['09:00', 'Peter Plaut · Post 900-FO map', 'done', '1-hour posting block'], ['10:00', 'Chase · Post capital stack carousel', 'due', '1-hour posting block'], ['11:00', 'Peter Plaut · Reply to past post comments', 'due', '15 minutes'], ['13:30', 'DM follow-ups + qualification', 'due', ''], ['16:30', 'Final engagement + tomorrow setup', 'due', '']]
      .forEach(([st, task, status, notes]) => db.daily_ops_schedule.push({ id: id(), work_date: t, start_time: st + ':00', task, status, notes, priority: 'high', completed_by_name: status === 'done' ? 'Anaz' : null })); }
  db.growth_meetings.push({ id: id(), meeting_date: d(2).slice(0, 10), account_name: 'Peter Plaut', source: 'inbound_post', post_id: db.daily_ops_posts[0].id, lead_name: 'J. Tan', company: 'SG family office', status: 'held' },
    { id: id(), meeting_date: d(3).slice(0, 10), account_name: 'Tengku Harris', source: 'outbound_dm', lead_name: 'M. Ali', company: 'KL developer', status: 'booked' },
    { id: id(), meeting_date: d(5).slice(0, 10), account_name: 'Chase', source: 'comment_to_dm', post_id: db.daily_ops_posts[2].id, lead_name: 'R. Cole', company: 'Independent sponsor', status: 'qualified' });

  db.resource_jobs = [
    { id: id(), created_at: d(0.02), fired_at: d(0.02), started_at: d(0.015), requested_by: 'anaz@outerhaven.test', format: 'list', poster: 'Peter Plaut', brand: 'OuterHaven Advisory', topic: '50 family offices investing in Asian real estate', status: 'building', progress: 'Running the Apify scraper (Google search results, 65 rows)', session_url: 'https://claude.ai/code/session_x' },
    { id: id(), created_at: d(1.1), fired_at: d(1.1), finished_at: d(1.09), requested_by: 'tengku@outerhaven.test', format: 'notion', poster: 'Peter Plaut', brand: 'OuterHaven Advisory', topic: 'AI deal screening', output_title: 'AI CIO', output_url: 'https://www.notion.so/x', status: 'ready', judgment_calls: ['Worked example uses a hypothetical $1.2M ARR SaaS deal', 'Caption says "7 components": delivered 7'], session_url: 'https://claude.ai/code/session_y' },
    { id: id(), created_at: d(2), requested_by: 'chase@outerhaven.test', format: 'pdf', poster: 'Chase Hamby', brand: 'OuterHaven Advisory', topic: 'Capital stack cheat sheet', status: 'failed', error: "Claude's daily routine limit is used up for today. Try again tomorrow." },
  ];
  db.daily_ops_posts.forEach((p, i) => { p.post_text = p.post_text || (i % 2 ? 'Steal my 7-step screening prompt. Comment SCREEN and I will send it.' : 'Thoughts on the Singapore family office market this quarter.'); p.work_date = p.work_date || d(i + 1).slice(0, 10); p.tags = p.tags || {}; });
  db.resource_jobs[1].post_id = db.daily_ops_posts[1]?.id; db.resource_jobs.forEach(j => j.source = 'generated');
  const cfg = { connected: !location.search.includes('noconn'), daily_cap: 6, used_today: 1, notion_parent_url: null, drive_folder_url: null };
  // ?mock=real: tests inject a read-only snapshot of real rows at /__fixture.json (never committed).
  if (location.search.includes('real')) {
    try {
      const x = new XMLHttpRequest(); x.open('GET', '/__fixture.json', false); x.send();
      const f = JSON.parse(x.responseText);
      db.daily_ops_accounts = f.accounts; db.daily_ops_posts = f.posts; db.daily_ops_schedule = f.schedule || [];
      db.daily_ops_linkedin_auto_log = f.log; db.daily_ops_experiments = []; db.growth_meetings = [];
    } catch (e) { console.warn('fixture', e); }
  }
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.payload = null; this.single_ = false; }
    select() { if (this.op === 'select') this.op = 'select'; else this.returning = true; return this; }
    order() { return this; } limit() { return this; }
    eq(k, v) { this.f.push(r => r[k] === v); return this; } neq(k, v) { this.f.push(r => r[k] !== v); return this; } in(k, v) { this.f.push(r => v.includes(r[k])); return this; } gte() { return this; } or() { return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; } update(p) { this.op = 'update'; this.payload = p; return this; } delete() { this.op = 'delete'; return this; }
    single() { this.single_ = true; return this; } maybeSingle() { return this.single(); }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
    run() {
      const rows = db[this.t]; if (!rows) return { data: null, error: { message: `relation "${this.t}" does not exist` } };
      const m = r => this.f.every(f => f(r));
      if (this.op === 'select') { const out = rows.filter(m).map(r => ({ ...r })); return { data: this.single_ ? out[0] || null : out, error: null }; }
      if (this.op === 'insert') { const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(p => ({ id: id(), created_at: new Date().toISOString(), started_at: new Date().toISOString(), assets: [], tags: {}, metrics: {}, ...p })); rows.unshift(...list); return { data: this.single_ ? list[0] : list, error: null }; }
      if (this.op === 'update') { const hit = rows.filter(m); hit.forEach(r => Object.assign(r, this.payload)); return { data: this.single_ ? hit[0] : hit, error: null }; }
      if (this.op === 'delete') { db[this.t] = rows.filter(r => !m(r)); return { data: null, error: null }; }
    }
  }
  const blobs = new Map();
  const client = {
    from: t => new Q(t),
    rpc: async (n, a = {}) => { if (n === 'set_post_no_resource') { const p = db.daily_ops_posts.find(x => x.id === a.p_post); if (p) p.tags = { ...p.tags, no_resource: a.p_value || undefined }; } if (n === 'link_resource') { const j = db.resource_jobs.find(x => x.id === a.p_job); if (j) j.post_id = a.p_post; } return ({ data: n === 'dashboard_role' ? (location.search.includes('ops') ? 'ops' : 'admin') : n === 'resource_config' ? { ...cfg } : n === 'set_routine_secret' ? (cfg.connected = true, null) : n === 'link_resource' || n === 'set_post_no_resource' ? null : true, error: null }); },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'tengku@outerhaven.test' } } } }), signOut: async () => ({}), signInWithPassword: async () => ({}) },
    functions: { invoke: async (n, { body }) => { await new Promise(r => setTimeout(r, 150));
      if (n === 'resource-request') { if (body.action === 'create') { const j = { id: id(), created_at: new Date().toISOString(), fired_at: new Date().toISOString(), requested_by: 'tengku@outerhaven.test', status: 'queued', progress: 'Waiting for Claude to start', ...body.job }; db.resource_jobs.unshift(j); cfg.used_today++; window.__lastJob = body.job; return { data: { ok: true, id: j.id }, error: null }; } return { data: { ok: true }, error: null }; } db.daily_ops_linkedin_auto_log.unshift({ id: Date.now(), created_at: new Date().toISOString(), run_mode: 'manual_' + body.mode, usage_before: 6.3, usage_after: 6.4, detail: { by: 'tengku@chproduction.org', result: body.mode === 'posts' ? { posts_saved: 9, errors: [] } : { comment_posts_processed: 3, errors: [] } } }); return { data: { ok: true, ran: true, result: body.mode === 'posts' ? { posts_saved: 9, errors: [] } : { comment_posts_processed: 3, errors: [] } }, error: null }; } },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    storage: { from: () => ({
      upload: async (path, file) => { blobs.set(path, URL.createObjectURL(file)); return { data: { path }, error: null }; },
      createSignedUrl: async path => ({ data: { signedUrl: blobs.get(path) || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect width=%22200%22 height=%22200%22 fill=%22%230d1b2a%22/><text x=%2250%%22 y=%2255%%22 fill=%22%23c4b59f%22 font-size=%2228%22 text-anchor=%22middle%22 font-family=%22Georgia%22>creative</text></svg>' }, error: null }),
      remove: async () => ({ data: null, error: null }) }) },
  };
  window.supabase = { createClient: () => client };
  window.__mockdb = db;
  const csv = `"Account","Date","Post amount","Total comments","Saves","Repost","Sends","Impressions","Network Ratio (In/Out)","Connections","Total Followers","Total Replied Comments","Total Unreplied comments","Total Comment Connections","Total Initiated DM's","Total Followed-Up DM's","Total Leads replied","Meetings Booked","Successful Meetings"
"Peter Plaut","29/8/2026","2","18","6","0","1","2900","15/85","40","40","90","0","50","10","0","1","2","1"
"Tengku Harris","29/8/2026","2","3","0","0","0","380","25/75","60","60","80","0","40","0","0","0","6","2"
"Chase","29/8/2026","2","15","5","1","1","1500","13/87","20","20","50","0","40","0","0","0","1","1"
"Razeen","29/8/2026","2","20","6","0","2","1800","6/94","80","80","60","0","40","0","0","0","0","0"
"Peter Plaut","5/9/2026","2","23","10","0","2","3515","15/85","52","52","143","0","67","27","0","0","3","2"
"Sara Rathsack","5/9/2026","2","14","4","0","1","1678","31/69","23","23","150","0","78","0","0","0","0","0"
"Tengku Harris","5/9/2026","2","2","0","0","1","407","25/75","72","72","108","0","55","0","0","0","11","2"
"Chase ","5/9/2026","3","22","7","3","2","1828","13/87","23","23","66","0","66","0","0","0","3","1"
"Razeen","5/9/2026","2","32","10","0","4","2024","6/94","97","97","70","0","50","0","0","0","0","0"
"Dev","5/9/2026","2","0","0","0","0","343","54/46","36","36","50","0","24","0","0","0","0","0"
"Sahid","5/9/2026","2","1","0","0","0","330","53/47","5","5","80","1","60","63","0","4","0","0"
"Reza","5/9/2026","2","4","5","0","2","664","32/68","1","1","28","0","20","0","0","0","0","0"
"Peter Plaut","13/9/2026","","","","","","","","","","","","","","","","",""
"Anaz","13/9/2026","","","","","","","","","","","","","","","","",""`;
  const realFetch = window.fetch;
  window.fetch = (u, o) => String(u).includes('docs.google.com') ? Promise.resolve(new Response(csv, { status: 200 })) : realFetch(u, o);
})();
