import { sb, state, esc, $, $$, toast, fail, modal } from './core.js';

let root = null;
let blocks = [];
let completed = new Set();
let workDate = '';
let channel = null;

const localDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
};

const fmtTime = value => {
  if (!value) return 'Any time';
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return hh + ':' + String(m || 0).padStart(2, '0') + ' ' + suffix;
};

const duration = mins => {
  const n = Number(mins || 0);
  if (!n) return '';
  if (n < 60) return n + ' min';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? h + 'h ' + m + 'm' : h + 'h';
};

const isChase = () => String(state.user?.email || '').toLowerCase() === 'chasehamby@chproduction.org';

async function load() {
  if (!isChase()) return;
  workDate = localDate();

  const [b, c] = await Promise.all([
    sb.from('chase_daily_blocks').select('*').eq('active', true).order('sort_order').order('start_time'),
    sb.from('chase_daily_block_completions').select('block_id,completed_at').eq('work_date', workDate),
  ]);

  if (b.error) {
    if (root) root.innerHTML = '<section class="card"><div class="empty">Could not load your daily blocks.</div></section>';
    console.error('Chase Daily blocks', b.error);
    return;
  }
  if (c.error) {
    if (root) root.innerHTML = '<section class="card"><div class="empty">Could not load today’s completion state.</div></section>';
    console.error('Chase Daily completions', c.error);
    return;
  }

  blocks = b.data || [];
  completed = new Set((c.data || []).map(x => x.block_id));
  draw();
}

function draw() {
  if (!root || !root.isConnected) return;

  const done = blocks.filter(b => completed.has(b.id)).length;
  const total = blocks.length;
  const left = total - done;
  const dateLabel = new Date(workDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  root.innerHTML = `
    <div class="chaseDailyPage">
      <section class="chaseDailyHero">
        <div>
          <span class="chaseDailyEyebrow">PRIVATE · CHASE ONLY</span>
          <h1>Daily Ops</h1>
          <p>Recurring blocks for your own day. These never appear in Anaz's dashboard.</p>
        </div>
        <button class="btn primary" id="cdAdd">+ Add daily block</button>
      </section>

      <section class="chaseDailyStats">
        <div class="card"><span class="cdStatLabel">Today</span><b>${done}/${total}</b><small>${left ? left + ' left' : total ? 'All done' : 'No blocks yet'}</small></div>
        <div class="card"><span class="cdStatLabel">Schedule</span><b>Every day</b><small>Blocks repeat automatically</small></div>
        <div class="card"><span class="cdStatLabel">Date</span><b>${esc(dateLabel)}</b><small>Your local time</small></div>
      </section>

      <section class="card chaseDailyList">
        <header>
          <div>
            <h2>Today's blocks</h2>
            <p>Complete a block once today. Your recurring schedule stays intact for tomorrow.</p>
          </div>
          ${total ? '<strong class="cdProgress">' + Math.round(done / total * 100) + '%</strong>' : ''}
        </header>
        ${total ? '<ul>' + blocks.map(blockHtml).join('') + '</ul>' : `
          <div class="cdEmpty">
            <div class="cdEmptyIcon">+</div>
            <h3>Build your daily schedule</h3>
            <p>Add the work you want to repeat every day. For example: review pipeline, follow up with prospects, check WhatsApp, or plan tomorrow.</p>
            <button class="btn primary" id="cdAddEmpty">Add your first block</button>
          </div>`}
      </section>
    </div>
  `;

  $('#cdAdd', root)?.addEventListener('click', () => openBlockModal());
  $('#cdAddEmpty', root)?.addEventListener('click', () => openBlockModal());
  $$('[data-cd-check]', root).forEach(cb => cb.addEventListener('change', () => toggle(cb.dataset.cdCheck, cb.checked)));
  $$('[data-cd-edit]', root).forEach(btn => btn.addEventListener('click', () => {
    const block = blocks.find(x => x.id === btn.dataset.cdEdit);
    if (block) openBlockModal(block);
  }));
}

function blockHtml(block) {
  const done = completed.has(block.id);
  return `
    <li class="cdBlock ${done ? 'done' : ''}">
      <label class="cdCheck">
        <input type="checkbox" data-cd-check="${esc(block.id)}" ${done ? 'checked' : ''}>
        <span class="cdBox"></span>
        <span class="cdBlockMain">
          <b>${esc(block.title)}</b>
          <span class="cdMeta">
            <em>${fmtTime(block.start_time)}</em>
            ${block.duration_min ? '<span>·</span><span>' + duration(block.duration_min) + '</span>' : ''}
            <span>·</span><span>Every day</span>
          </span>
          ${block.notes ? '<small>' + esc(block.notes) + '</small>' : ''}
        </span>
      </label>
      <button type="button" class="btn sm ghost" data-cd-edit="${esc(block.id)}">Edit</button>
    </li>
  `;
}

async function toggle(id, checked) {
  const previous = new Set(completed);
  if (checked) completed.add(id); else completed.delete(id);
  draw();

  let result;
  if (checked) {
    result = await sb.from('chase_daily_block_completions').upsert({
      block_id: id,
      work_date: workDate,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'block_id,work_date' });
  } else {
    result = await sb.from('chase_daily_block_completions').delete()
      .eq('block_id', id)
      .eq('work_date', workDate);
  }

  if (fail(result, checked ? 'Complete block' : 'Undo block')) {
    completed = previous;
    draw();
    return;
  }

  toast(checked ? 'Block completed' : 'Block reopened');
}

function openBlockModal(def = null) {
  const isNew = !def;
  const block = def || {
    title: '',
    start_time: '',
    duration_min: '',
    notes: '',
    sort_order: blocks.length,
  };

  const { el } = modal({
    title: isNew ? 'Add daily block' : 'Edit daily block',
    submit: isNew ? 'Add block' : 'Save changes',
    wide: true,
    body: `
      <div class="form cdForm">
        <label class="field" style="grid-column:1/-1">
          Block name
          <input class="input" name="title" required value="${esc(block.title || '')}" placeholder="Review pipeline">
        </label>
        <label class="field">
          Start time
          <input class="input" type="time" name="start_time" step="900" value="${esc(String(block.start_time || '').slice(0, 5))}">
        </label>
        <label class="field">
          Duration
          <select class="select" name="duration_min">
            ${[['', 'No duration'], ['15', '15 minutes'], ['30', '30 minutes'], ['45', '45 minutes'], ['60', '1 hour'], ['90', '1.5 hours'], ['120', '2 hours'], ['180', '3 hours']].map(([v, l]) => '<option value="' + v + '" ' + (String(block.duration_min || '') === v ? 'selected' : '') + '>' + l + '</option>').join('')}
          </select>
        </label>
        <label class="field" style="grid-column:1/-1">
          Notes
          <textarea class="input" name="notes" rows="3" placeholder="Anything you want to remember when this block comes up.">${esc(block.notes || '')}</textarea>
        </label>
        <p class="s muted" style="grid-column:1/-1;margin:0">This block repeats every day until you delete it.</p>
        ${isNew ? '' : '<button type="button" class="btn sm danger" id="cdDelete" style="justify-self:start">Delete daily block</button>'}
      </div>
    `,
    async onSubmit(fd) {
      const title = String(fd.get('title') || '').trim();
      if (!title) { toast('Give the block a name'); return false; }

      const row = {
        title,
        start_time: fd.get('start_time') || null,
        duration_min: Number(fd.get('duration_min')) || null,
        notes: String(fd.get('notes') || '').trim() || null,
        active: true,
        sort_order: Number(block.sort_order || 0),
        updated_at: new Date().toISOString(),
      };

      const result = isNew
        ? await sb.from('chase_daily_blocks').insert(row)
        : await sb.from('chase_daily_blocks').update(row).eq('id', def.id);

      if (fail(result, 'Save daily block')) return false;
      toast(isNew ? 'Daily block added' : 'Daily block saved');
      await load();
    },
  });

  $('#cdDelete', el)?.addEventListener('click', async () => {
    if (!confirm('Delete this recurring daily block? It will disappear from your schedule going forward.')) return;
    const result = await sb.from('chase_daily_blocks').update({
      active: false,
      updated_at: new Date().toISOString(),
    }).eq('id', def.id);
    if (fail(result, 'Delete daily block')) return;
    toast('Daily block deleted');
    el.querySelector('[data-x]')?.click();
    await load();
  });
}

export function renderChaseDaily(el) {
  root = el;
  if (!isChase()) {
    el.innerHTML = '<div class="empty">This page is private.</div>';
    return;
  }
  load();
  if (!channel) {
    channel = sb.channel('chase-daily-private')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chase_daily_blocks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chase_daily_block_completions' }, load)
      .subscribe();
  }
}
