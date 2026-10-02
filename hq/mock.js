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
  { const base = new Date(Date.now() - 2 * 3600e3 + 8 * 3600e3);
    for (let back = 1; back <= 6; back++) { const day = new Date(base.getTime() - back * 864e5).toISOString().slice(0, 10);
      [['20:00', 'Reza · Post A'], ['21:00', 'Reza · Respond to past post comments'], ['21:15', 'Dev · Post B'], ['22:15', 'Dev · Respond to past post comments'], ['13:30', 'DM follow-ups + qualification']].forEach(([st, task], i) =>
        db.daily_ops_schedule.push({ id: id(), work_date: day, start_time: st + ':00', task, status: (i + back) % 3 === 0 && back < 3 ? 'due' : 'done', completed_by_name: 'Anaz', completed_at: day + 'T14:00:00Z', notes: '' })); } }
  db.daily_ops_schedule.forEach(r => { const a = accts.find(x => x.owner_name.split(' ')[0] === r.task.split(/[ ·]/)[0]); if (a) r.account_id = a.id; });
  db.daily_ops_weekly_posts = [];
  [[0,'21:00','Sara','A'],[0,'22:00','Razeen','B'],[0,'23:00','Peter','A'],[1,'20:00','Reza','Video'],[1,'21:00','Dev','A'],[1,'22:00','Anaz','B'],[1,'23:00','Chase','A'],[2,'21:00','Sara','B'],[2,'22:00','Peter','B'],[2,'23:00','Tengku','A'],[3,'20:00','Reza','A'],[3,'21:00','Sahid','A'],[3,'22:00','Anaz','C'],[3,'23:00','Razeen','A'],[4,'20:00','Dev','B'],[4,'21:00','Sara','C'],[4,'22:00','Peter','C'],[4,'23:00','Chase','B'],[5,'20:00','Reza','Video'],[5,'21:00','Sahid','B'],[5,'22:00','Anaz','A'],[5,'23:00','Tengku','B'],[6,'20:00','Sara','Cred Post'],[6,'21:00','Peter','Cred Post'],[6,'22:00','Reza','B'],[6,'23:00','Sara','D']]
    .forEach(([dw, t, o, c]) => db.daily_ops_weekly_posts.push({ id: id(), day_of_week: dw, start_time: t + ':00', end_time: null, owner_name: o, content_code: c, label: o + ' ' + c, active: true }));
  db.daily_ops_posts.forEach((p, i) => { p.linkedin_post_url = p.linkedin_post_url || 'https://www.linkedin.com/feed/update/urn:li:activity:' + (7000 + i); p.unreplied_count = i === 0 ? 64 : (p.unreplied_count || (i % 3)); p.work_date = p.work_date || d(i + 1).slice(0, 10); });
  db.daily_ops_accounts.forEach(a => { a.linkedin_url = a.linkedin_url || 'https://www.linkedin.com/in/' + String(a.owner_name).toLowerCase().replace(/\s+/g, '-'); });
  db.dm_tests = [{ id: 'dt1', name: 'Resource DM: short vs question', context: 'After someone comments the keyword', hypothesis: 'Ending with a question gets more replies', status: 'running', created_at: d(5) }];
  db.dm_variants = [{ id: 'dv1', test_id: 'dt1', label: 'A', message: 'Hey {name}, here is the 900 family offices map as promised: {link}' }, { id: 'dv2', test_id: 'dt1', label: 'B', message: 'Hey {name}, here is the map: {link}\n\nQuick one: are you raising right now or just building the list?' }];
  db.dm_events = []; for (let i = 0; i < 46; i++) db.dm_events.push({ id: id(), variant_id: i % 2 ? 'dv1' : 'dv2', event: 'sent', work_date: d(i % 5).slice(0, 10) });
  for (let i = 0; i < 9; i++) db.dm_events.push({ id: id(), variant_id: i < 7 ? 'dv2' : 'dv1', event: 'replied', work_date: d(1).slice(0, 10) });
  db.dm_conversations = [{ id: 'cv1', thread_url: 'https://www.linkedin.com/messaging/thread/2-ABC/', account_name: 'Tengku', prospect_name: 'Jane Tan', prospect_headline: 'CIO at Tan Family Office', prospect_url: 'https://www.linkedin.com/in/jane', message_count: 4, replied: true, meeting_booked: true, dm_variant_id: 'dv2', variant_match: 0.84, captured_at: d(1), messages: [{ from: 'us', at: 'Sep 26 9:14 PM', text: 'Hey Jane, here is the map' }, { from: 'us', at: 'Sep 26 9:14 PM', text: 'Quick one: are you raising right now?' }, { from: 'them', name: 'Jane Tan', at: 'Yesterday 10:02 AM', text: 'Building the list for now. Happy to chat next week.' }, { from: 'us', at: 'Yesterday 10:30 AM', text: 'Great, grab a slot: https://cal.com/outerhaven' }], ai: { stage: 'Meeting booked', summary: 'Warm: building an LP list, agreed to a call after the qualifying question.' } }];
  db.growth_reports = [{ id: 'gr1', week_start: d(2).slice(0, 10), created_at: d(2), summary: '- **Carousels beat single images for Peter** (median 18 vs 7 audience comments)\n- Dev had zero audience comments: all 8 were ours\n- Resource DM B (question at the end) replies at 30% vs 9%', findings: [{ title: 'Maps and data creatives outperform quote cards', detail: 'Across Peter and Razeen.', evidence: 'Peter: 3 vs 4 posts', confidence: 'anecdotal', group: 'creative' }], next_tests: [{ title: 'Hook with a number vs without', account: 'Peter', a: '900+ family offices…', b: 'Family offices are…', why: 'Numbers led 2 of 3 top posts' }] }];
  db.resource_jobs.push({ id: id(), kind: 'analysis', status: 'ready', created_at: d(2), topic: 'Weekly growth analysis' });

  // Pipeline fixtures (fictional names)
  { const ago = n => new Date(Date.now() - n * 864e5).toISOString(), due = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const P = (name, side, stage, ball, age, extra = {}) => ({ id: 'p_' + name.split(' ')[0].toLowerCase(), name, primary_side: side, pipeline_stage: stage, pipeline_active: true, waiting_on: ball, waiting_on_since: ago(age), updated_at: ago(age), relationship_type: side === 'Buy Side' ? 'Buy-side Relationship' : 'Sell-side Relationship', company_name: extra.co || null, linkedin_url: 'https://www.linkedin.com/in/' + name.split(' ')[0].toLowerCase(), ...extra });
    db.people = [P('Mira Lund', 'Sell Side', 'Diligence Call Complete', 'us', 14, { co: 'Lund Capital' }), P('Omar Haddad', 'Buy Side', 'NDA Signed + Thesis Captured', 'us', 2, { co: 'Haddad Family Office' }), P('Li Wei', 'Sell Side', 'Opportunity Received', 'them', 18, { co: 'Wei Developments' }), P('Sofia Reyes', 'Buy Side', 'New Relationship', null, 5), P('Jonas Berg', 'Sell Side', 'Initial Interest Identified', 'us', 9), P('Aiko Mori', 'Sell Side', 'New Relationship', 'them', 3, { co: 'Mori Holdings' }), P('Elena Voss', 'Both', 'Diligence Call Complete', 'us', 6, { co: 'Voss & Partners (IB + family offices)' }), P('Kenji Ito', 'Both', 'New Relationship', 'them', 2, { co: 'Ito Capital' }), P('Dana Cole', 'Sell Side', 'New Relationship', 'them', 30, { pipeline_active: false })];
    db.opportunities = [
      { id: 'o1', person_id: 'p_jonas', title: 'Nordic logistics platform raise', side: 'Sell Side', stage: 'Initial Interest Identified', pipeline_stage: 'Initial Interest Identified', pipeline_active: true, waiting_on: 'us', waiting_on_since: ago(9), updated_at: ago(9), next_step: 'Send buyer shortlist', next_step_owner: 'Chase', revenue_raise_amount: 40e6, opportunity_size: '$40M', owner_name: 'Chase' },
      { id: 'o2', person_id: 'p_li', title: 'KL mixed-use development', side: 'Sell Side', stage: 'Opportunity Received', pipeline_stage: 'Opportunity Received', pipeline_active: true, waiting_on: 'them', waiting_on_since: ago(18), updated_at: ago(18), next_step: 'Waiting on data room access', revenue_raise_amount: 120e6, owner_name: 'Tengku' },
      { id: 'o3', person_id: 'p_omar', title: 'Gulf hospitality mandate', side: 'Buy Side', stage: 'Relevant Deal Identified', pipeline_stage: 'Relevant Deal Identified', pipeline_active: true, waiting_on: 'them', waiting_on_since: ago(2), updated_at: ago(2), next_step: 'Intro call Thursday', revenue_raise_amount: 25e6, owner_name: 'Peter' },
      { id: 'o4', person_id: null, title: 'Bangkok senior living fund', side: 'Sell Side', stage: 'Opportunity Received', pipeline_stage: 'Opportunity Received', pipeline_active: true, waiting_on: null, updated_at: ago(25), owner_name: null, revenue_raise_amount: 15e6 },
    ];
    db.tasks = [{ id: 't1', person_id: 'p_mira', action: 'Send teaser and NDA', owner_name: 'Chase', due_date: due(-6), completed: false }, { id: 't2', person_id: 'p_jonas', opportunity_id: 'o1', action: 'Send buyer shortlist', owner_name: 'Chase', due_date: due(1), completed: false }];
    db.activity = [];
    db.team_tasks = ['Peter','Chase','Tengku','Razeen','Sara','Dev','Sahid','Reza'].map((n, i) => ({ id: 'tt' + i, title: "Reply in " + n + "'s inbox", notes: 'Open ' + n + "'s LinkedIn inbox and answer everyone waiting on a reply.", assignee: 'Chase', account: n, repeat: 'daily', days: [], on_date: null, until_date: null, start_time: null, duration_min: null, sort: i, active: true }));
    db.team_tasks.push({ id: 'tt9', title: 'Review pipeline red cards', assignee: 'Tengku', repeat: 'weekdays', days: [], start_time: '10:00', duration_min: 30, active: true, sort: 0 });
    db.daily_ops_creation_blocks = [[6,'10:00','Sara',4],[6,'12:00','Peter',4],[6,'14:00','Chase',3],[6,'15:30','Anaz',1],[0,'10:00','Anaz',2],[0,'11:00','Tengku',3],[0,'12:30','Razeen',3],[0,'14:00','Sahid',2],[0,'15:00','Dev',1],[0,'15:30','Reza',1]].map(([d, t, o, c], i) => ({ id: 'cb' + i, day_of_week: d, start_time: t + ':00', owner_name: o, creatives: c, minutes_per: 30, maker: 'Anaz', active: true }));
    const L = (name, dec, age, extra = {}) => ({ id: 'l_' + name.split(' ')[0].toLowerCase(), name, headline: 'Managing Partner', company_name: name.split(' ')[1] + ' Partners', decision: dec, created_at: ago(age), person_id: null, reviewed_at: null, reply_text: 'Interested, can you send more detail on the raise?', suggested_next_step: 'Reply with the deck and ask about timeline', source_account: 'https://www.linkedin.com/in/peterplaut', linkedin_url: 'https://www.linkedin.com/in/' + name.split(' ')[0].toLowerCase() + 'x', ...extra });
    db.lead_intake = [L('Noor Anwar', 'qualified_sell_side', 10, { id: 'l_noor0', reply_text: 'Hi Peter, thanks for reaching out.\n\nWe are a family-backed developer in Johor raising for a mixed-use scheme. Happy to share the teaser and our capital stack if useful. What sort of mandates do you usually take on?' }), L('Noor Anwar', 'qualified_sell_side', 8), L('Felix Ode', 'qualified_buy_side', 4), L('Hana Sato', 'needs_review', 1), L('Ravi Menon', 'qualified_sell_side', 12), L('Tess Quill', 'not_qualified', 3)];
  }
  const cfg = { connected: !location.search.includes('noconn'), daily_cap: 6, used_today: 1, notion_parent_url: null, drive_folder_url: null };
  // ?mock=real: tests inject a read-only snapshot of real rows at /__fixture.json (never committed).
  if (location.search.includes('real')) {
    try {
      const x = new XMLHttpRequest(); x.open('GET', '/__fixture.json', false); x.send();
      const f = JSON.parse(x.responseText);
      db.daily_ops_accounts = f.accounts; db.daily_ops_posts = f.posts; db.daily_ops_schedule = f.schedule || [];
      db.daily_ops_linkedin_auto_log = f.log; db.daily_ops_experiments = []; db.growth_meetings = []; ['opportunities', 'people', 'tasks', 'lead_intake'].forEach(k => { if (f[k]) db[k] = f[k]; });
    } catch (e) { console.warn('fixture', e); }
  }
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.payload = null; this.single_ = false; }
    select() { if (this.op === 'select') this.op = 'select'; else this.returning = true; return this; }
    order() { return this; } limit() { return this; }
    eq(k, v) { const g = r => k.includes('->>') ? (r[k.split('->>')[0]] || {})[k.split('->>')[1]] : r[k]; this.f.push(r => g(r) === v); return this; } neq(k, v) { this.f.push(r => r[k] !== v); return this; } in(k, v) { this.f.push(r => v.includes(r[k])); return this; } gte(k, v) { this.f.push(r => r[k] == null || String(r[k]) >= String(v)); return this; } lte(k, v) { this.f.push(r => r[k] != null && String(r[k]) <= String(v)); return this; } lt(k, v) { this.f.push(r => r[k] != null && String(r[k]) < String(v)); return this; } like(k, v) { const x = String(v).replace(/%/g, ''); this.f.push(r => String(r[k] || '').startsWith(x)); return this; } or(expr) { const cs = String(expr).split(',').map(c => { const [k, op, ...v] = c.split('.'); const val = v.join('.'); return r => op === 'eq' ? String(r[k]) === val : op === 'ilike' ? String(r[k] || '').toLowerCase().includes(val.replace(/%/g, '').toLowerCase()) : true; }); this.f.push(r => cs.some(f => f(r))); return this; } ilike(k, v) { const x = String(v).replace(/%/g, '').toLowerCase(); this.f.push(r => String(r[k] || '').toLowerCase().includes(x)); return this; } not() { return this; } is(k, v) { this.f.push(r => (r[k] ?? null) === v); return this; }
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
    from: t => { if (t === 'dm_variant_stats') { db.dm_variant_stats = db.dm_variants.map(v => ({ variant_id: v.id, test_id: v.test_id, label: v.label, sent: db.dm_events.filter(e => e.variant_id === v.id && e.event === 'sent').length, replied: db.dm_events.filter(e => e.variant_id === v.id && e.event === 'replied').length, meetings: db.growth_meetings.filter(m => m.dm_variant_id === v.id).length })); } return new Q(t); },
    rpc: async (n, a = {}) => { window.__apifyExtra ||= [];
      if (n === 'sync_team_tasks') { const t = new Date(Date.now() - 2 * 3600e3 + 8 * 3600e3), day = t.toISOString().slice(0, 10), dow = t.getUTCDay();
        (db.team_tasks || []).filter(x => x.active && (x.repeat === 'daily' || (x.repeat === 'weekdays' && dow >= 1 && dow <= 5) || (x.repeat === 'weekly' && (x.days || []).includes(dow)) || (x.repeat === 'once' && x.on_date === day))).forEach(x => {
          const key = 'task:' + x.id, ex = db.daily_ops_schedule.find(r => r.work_date === day && r.auto_key === key), acc = accts.find(a => a.owner_name.split(' ')[0] === x.account);
          const row = { work_date: day, start_time: x.start_time ? x.start_time.slice(0, 5) + ':00' : null, task: x.title, notes: x.notes, assignee: x.assignee, account_id: acc?.id || null, auto_key: key, auto_generated: true };
          if (ex) Object.assign(ex, row); else db.daily_ops_schedule.push({ id: id(), status: 'due', ...row }); });
        db.daily_ops_schedule = db.daily_ops_schedule.filter(r => !(r.work_date === day && r.auto_key?.startsWith('task:') && r.status === 'due' && !db.team_tasks.some(x => x.active && 'task:' + x.id === r.auto_key && (x.repeat === 'daily' || (x.repeat === 'weekdays' && dow >= 1 && dow <= 5) || (x.repeat === 'weekly' && (x.days || []).includes(dow)) || (x.repeat === 'once' && x.on_date === day)))));
        return { data: { ok: true }, error: null }; } if (n === 'set_apify_token') { window.__apifyExtra = window.__apifyExtra.filter(x => x !== a.p_slot); if (a.p_value) window.__apifyExtra.push(a.p_slot); return { data: null, error: null }; } if (n === 'apify_token_slots') return { data: [...window.__apifyExtra], error: null }; if (n === 'set_post_no_resource') { const p = db.daily_ops_posts.find(x => x.id === a.p_post); if (p) p.tags = { ...p.tags, no_resource: a.p_value || undefined }; } if (n === 'link_resource') { const j = db.resource_jobs.find(x => x.id === a.p_job); if (j) j.post_id = a.p_post; } return ({ data: n === 'dashboard_role' ? (location.search.includes('ops') ? 'ops' : 'admin') : n === 'resource_config' ? { ...cfg } : n === 'set_routine_secret' ? (cfg.connected = true, null) : n === 'link_resource' || n === 'set_post_no_resource' ? null : true, error: null }); },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'tengku@outerhaven.test' } } } }), signOut: async () => ({}), signInWithPassword: async () => ({}) },
    functions: { invoke: async (n, { body }) => { window.__apifyExtra ||= []; await new Promise(r => setTimeout(r, 150));
      if (n === 'daily-ops-linkedin-auto' && body.status_only) return { data: { ok: true, accounts: [{ slot: 1, name: 'chasehamby', used: 9.27, limit: 18.99, remaining: 9.72, error: null }, ...window.__apifyExtra.map(x => ({ slot: x, name: 'free-account-' + x, used: 0.4, limit: 4.75, remaining: 4.35, error: null }))] }, error: null };
      if (n === 'resource-request' && body.action === 'teaser') { const t = body.teaser; db.resource_jobs.unshift({ id: id(), kind: 'resource', format: 'pdf', status: 'ready', created_at: new Date().toISOString(), poster: t.contact, topic: 'Teaser: ' + (t.codename || t.lead_name), requested_by: 'tengku@outerhaven.test', judgment_calls: ['Ask them for: raise size, current revenue'], payload: { type: 'teaser', lead_name: t.lead_name, lead_company: t.lead_company, teaser: { project: t.codename || 'Project Meridian', headline: 'Family-backed developer raising equity for a mixed-use scheme in Johor, Malaysia', sector: 'Real estate · Mixed-use', geography: 'Malaysia (Johor)', transaction: 'Equity raise', size: 'To be confirmed', overview: 'A family-backed developer with a track record in southern Malaysia is raising equity for its next mixed-use scheme. Teaser and capital stack available under NDA.', highlights: ['Family-backed sponsor with local delivery track record', 'Mixed-use: residential and retail', 'Capital stack and teaser ready to share'], key_terms: [{ label: 'Instrument', value: 'Equity' }, { label: 'Ticket', value: 'To be confirmed' }], use_of_funds: ['Construction', 'Land costs'], ideal_investor: 'Family offices with SE Asia real estate exposure', next_steps: 'NDA → teaser and capital stack → call with the sponsor', contact: { name: t.contact, title: 'Managing Director, North America' }, missing: ['Raise size', 'GDV', 'Timeline'] } } }); return { data: { ok: true }, error: null }; }
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
