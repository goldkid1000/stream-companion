// Stream Companion v2 features — analytics, schedule, clips, engagement,
// session tools, VOD pipeline, search, data portability, PWA registration.
// All data in localStorage. No network calls except the service worker cache.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt12(t) {
    if (!t) return '';
    var p = t.split(':'), h = parseInt(p[0], 10), m = p[1] || '00';
    var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
    return h + ':' + m + ' ' + ap;
  }
  function getLog() { return store.get('sc_log', []); }
  function switchTab(panelId, el) {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
    var tab = document.querySelector('.tab[data-tab="' + panelId + '"]');
    if (tab) tab.classList.add('active');
    var panel = $(panelId); if (panel) panel.classList.add('active');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 2000); }
  }

  // ---------- Analytics ----------
  function drawBars(canvas, values, labels, color) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#9fb0d8'; ctx.font = '13px system-ui';
    if (!values.length) { ctx.fillText('No sessions logged yet — add one on the Stream Log tab.', 16, 40); return; }
    var max = Math.max.apply(null, values.concat([1]));
    var padL = 46, padB = 34, padT = 14;
    var cw = (W - padL - 10) / values.length;
    var bw = Math.min(46, cw * 0.6);
    ctx.strokeStyle = 'rgba(159,176,216,.25)'; ctx.beginPath();
    ctx.moveTo(padL, H - padB); ctx.lineTo(W - 10, H - padB); ctx.stroke();
    values.forEach(function (v, i) {
      var bh = (H - padB - padT) * (v / max);
      var x = padL + i * cw + (cw - bw) / 2;
      ctx.fillStyle = color;
      ctx.fillRect(x, H - padB - bh, bw, bh);
      ctx.fillStyle = '#e8ecf8'; ctx.textAlign = 'center';
      ctx.fillText(v, x + bw / 2, H - padB - bh - 5);
      ctx.fillStyle = '#9fb0d8';
      ctx.fillText(labels[i], x + bw / 2, H - 10);
      ctx.textAlign = 'left';
    });
  }
  function renderAnalytics() {
    var entries = getLog().slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var gained = entries.reduce(function (s, e) { return s + (e.gained || 0); }, 0);
    var peaks = entries.map(function (e) { return e.peak || 0; });
    var best = peaks.length ? Math.max.apply(null, peaks) : 0;
    var avg = peaks.length ? (peaks.reduce(function (s, v) { return s + v; }, 0) / peaks.length).toFixed(1) : '0';
    $('anTotals').textContent = entries.length + ' sessions · ' + gained + ' followers gained · best peak ' + best + ' · avg peak ' + avg;
    // Best weekday by average peak viewers.
    var byDay = {};
    entries.forEach(function (e) {
      if (!e.date) return;
      var d = new Date(e.date + 'T12:00:00').getDay();
      (byDay[d] = byDay[d] || []).push(e.peak || 0);
    });
    var bestDay = null, bestAvg = -1;
    Object.keys(byDay).forEach(function (d) {
      var arr = byDay[d], a = arr.reduce(function (s, v) { return s + v; }, 0) / arr.length;
      if (a > bestAvg) { bestAvg = a; bestDay = d; }
    });
    // Streak: scheduled days with a logged session, walking back from today.
    var sched = store.get('sc_schedule', {});
    var logDates = {}; entries.forEach(function (e) { if (e.date) logDates[e.date] = true; });
    var streak = 0, cursor = new Date(); cursor.setHours(12, 0, 0, 0);
    for (var back = 0; back < 120; back++) {
      var cur = new Date(cursor); cur.setDate(cur.getDate() - back);
      var iso = cur.toISOString().slice(0, 10);
      var s = sched[cur.getDay()];
      if (!s || !s.on) continue;
      if (logDates[iso]) { streak++; continue; }
      if (back === 0) continue; // today may still happen
      break;
    }
    var insights = '<h3>Insights</h3>';
    if (!entries.length) { insights += '<p class="note">Log at least one session to see insights.</p>'; }
    else {
      insights += '<ul class="specs">' +
        '<li>Best weekday by average peak viewers: <b>' + (bestDay !== null ? DAYS[bestDay] + ' (avg ' + bestAvg.toFixed(1) + ')' : 'not enough data') + '</b></li>' +
        '<li>Current streak of scheduled stream days kept: <b>' + streak + '</b> (a scheduled day counts when a session is logged for it)</li>' +
        '<li>Total followers gained across logged sessions: <b>' + gained + '</b></li></ul>';
    }
    $('anInsights').innerHTML = insights;
    var cum = [], run = 0;
    entries.forEach(function (e) { run += (e.gained || 0); cum.push(run); });
    var labels = entries.map(function (e) { return e.date ? e.date.slice(5) : ''; });
    drawBars($('chartFollowers'), cum, labels, '#f5b942');
    drawBars($('chartViewers'), peaks, labels, '#2dd4bf');
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.tab === 'analytics') renderAnalytics(); });
  });
  var logForm = $('logForm');
  if (logForm) logForm.addEventListener('submit', function () { setTimeout(renderAnalytics, 50); });
  renderAnalytics();

  // ---------- Schedule planner ----------
  var SCHED = 'sc_schedule';
  function renderSchedGrid() {
    var s = store.get(SCHED, {});
    $('schedGrid').innerHTML = DAYS.map(function (d, i) {
      var row = s[i] || { on: false, time: '19:00', game: 'Warframe' };
      return '<div class="sched-row"><label class="sched-day"><input type="checkbox" data-day="' + i + '" data-f="on"' + (row.on ? ' checked' : '') + '> ' + d + '</label>' +
        '<input type="time" data-day="' + i + '" data-f="time" value="' + esc(row.time) + '">' +
        '<input type="text" data-day="' + i + '" data-f="game" value="' + esc(row.game) + '" placeholder="Game"></div>';
    }).join('');
  }
  function readSchedGrid() {
    var s = {};
    $('schedGrid').querySelectorAll('[data-day]').forEach(function (el) {
      var i = el.dataset.day, f = el.dataset.f;
      s[i] = s[i] || { on: false, time: '19:00', game: 'Warframe' };
      s[i][f] = (f === 'on') ? el.checked : el.value;
    });
    return s;
  }
  function schedText(s) {
    var lines = [];
    for (var i = 0; i < 7; i++) {
      var r = s[i];
      if (r && r.on) lines.push(DAYS[i] + ' ' + fmt12(r.time) + ' — ' + (r.game || 'Stream'));
    }
    return lines.length ? lines.join('\n') : 'No scheduled streams yet — pick 2–3 days above.';
  }
  function nextStream(s) {
    var now = new Date(), best = null;
    for (var i = 0; i < 7; i++) {
      var r = s[i]; if (!r || !r.on || !r.time) continue;
      var p = r.time.split(':'), d = new Date(now);
      d.setHours(parseInt(p[0], 10), parseInt(p[1] || '0', 10), 0, 0);
      var add = (i - d.getDay() + 7) % 7;
      if (add === 0 && d <= now) add = 7;
      d.setDate(d.getDate() + add);
      if (!best || d < best.date) best = { date: d, day: i, game: r.game };
    }
    return best;
  }
  function refreshSched() {
    var s = store.get(SCHED, {});
    $('schedText').textContent = schedText(s);
    var n = nextStream(s);
    if (!n) { $('nextCountdown').textContent = 'No scheduled streams yet.'; return; }
    var ms = n.date - new Date();
    var days = Math.floor(ms / 86400000), hrs = Math.floor(ms % 86400000 / 3600000), min = Math.floor(ms % 3600000 / 60000);
    $('nextCountdown').textContent = 'Next: ' + DAYS[n.day] + ' at ' + fmt12(n.date.toTimeString().slice(0, 5)) + ' — ' + (n.game || 'Stream') + ' · in ' + days + 'd ' + hrs + 'h ' + min + 'm';
  }
  $('saveSched').addEventListener('click', function () {
    store.set(SCHED, readSchedGrid()); refreshSched(); renderAnalytics();
  });
  renderSchedGrid(); refreshSched();
  setInterval(refreshSched, 30000);

  // ---------- Title studio: tones + tags ----------
  var TAGS = {
    Warframe: 'English, friendlygamer, Farming, Co-op, Chill',
    Fortnite: 'English, friendlygamer, BattleRoyale, ZeroBuild, Chill',
    Minecraft: 'English, friendlygamer, Survival, Building, Chill',
    VALORANT: 'English, friendlygamer, FPS, Competitive, Chill',
    'Rocket League': 'English, friendlygamer, Sports, Competitive, Chill',
    'Apex Legends': 'English, friendlygamer, BattleRoyale, FPS, Chill',
    'Elden Ring': 'English, friendlygamer, Soulslike, Chill, FirstPlaythrough',
    Roblox: 'English, friendlygamer, Variety, Chill'
  };
  function refreshTones() {
    var g = $('genGame').value.trim(), a = $('genActivity').value.trim(), gl = $('genGoal').value.trim();
    $('toneChill').textContent = 'Chill ' + g + ' ' + a + ' | ' + gl;
    $('toneHype').textContent = g + ' ' + a + ' — LET\'S GO! | ' + gl;
    $('toneGrind').textContent = g + ' GRIND: ' + a + ' | ' + gl;
  }
  ['genGame', 'genActivity', 'genGoal'].forEach(function (id) { $(id).addEventListener('input', refreshTones); });
  refreshTones();
  function refreshTags() { $('tagList').textContent = TAGS[$('tagGame').value] || 'English, friendlygamer'; }
  $('tagGame').addEventListener('change', refreshTags); refreshTags();
  var cat = $('genCategory');
  if (cat) cat.addEventListener('change', function () { $('genGame').value = cat.value; $('genGame').dispatchEvent(new Event('input')); });

  // ---------- Clip studio ----------
  var CLIPS = 'sc_clips';
  var HASHTAGS = {
    Warframe: '#warframe #warframeclips #tenno #gaming #fyp',
    Fortnite: '#fortnite #fortniteclips #gaming #fyp',
    Minecraft: '#minecraft #minecraftclips #gaming #fyp',
    VALORANT: '#valorant #valorantclips #gaming #fyp',
    'Rocket League': '#rocketleague #rlclips #gaming #fyp',
    'Apex Legends': '#apexlegends #apexclips #gaming #fyp',
    'Elden Ring': '#eldenring #soulslike #gaming #fyp',
    Roblox: '#roblox #robloxclips #gaming #fyp'
  };
  function renderClips() {
    var clips = store.get(CLIPS, []);
    $('clipList').innerHTML = clips.length ? clips.map(function (c, i) {
      var st = c.status || {};
      function box(k, label) { return '<label style="display:block;margin:4px 0"><input type="checkbox" data-clip="' + i + '" data-k="' + k + '"' + (st[k] ? ' checked' : '') + '> ' + label + '</label>'; }
      return '<li><button data-clipdel="' + i + '">Delete</button><b>' + esc(c.date) + ' — ' + esc(c.game) + '</b><br>' +
        '<small>Hook: ' + esc(c.hook) + (c.topic ? ' · ' + esc(c.topic) : '') + '</small>' +
        '<p class="title-line" id="clipCap' + i + '">' + esc(c.caption) + '</p>' +
        '<button data-copy="clipCap' + i + '">Copy caption</button>' +
        '<div style="margin-top:8px">' + box('edited', 'Edited') + box('captioned', 'Captioned') + box('tiktok', 'Posted to TikTok') + box('shorts', 'Posted to Shorts') + '</div></li>';
    }).join('') : '<li>No clips planned yet. One clip per stream — add the first one above.</li>';
  }
  $('clipForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var game = $('clipGame').value, hook = $('clipHook').value, topic = $('clipTopic').value.trim();
    var caption = hook + (topic ? ' ' + topic : '') + ' — ' + game + ' stream highlights 🎮 ' + (HASHTAGS[game] || '#gaming #fyp');
    var clips = store.get(CLIPS, []);
    clips.unshift({ date: $('clipDate').value, game: game, hook: hook, topic: topic, caption: caption, status: {} });
    store.set(CLIPS, clips); renderClips(); $('clipForm').reset();
  });
  $('clipList').addEventListener('change', function (e) {
    var box = e.target.closest('[data-clip]');
    if (!box) return;
    var clips = store.get(CLIPS, []);
    clips[box.dataset.clip].status = clips[box.dataset.clip].status || {};
    clips[box.dataset.clip].status[box.dataset.k] = box.checked;
    store.set(CLIPS, clips);
  });
  $('clipList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-clipdel]');
    if (!btn) return;
    var clips = store.get(CLIPS, []);
    clips.splice(parseInt(btn.dataset.clipdel, 10), 1);
    store.set(CLIPS, clips); renderClips();
  });
  renderClips();

  // ---------- Engagement: poll, giveaway, shoutouts ----------
  var POLL = 'sc_poll';
  function renderPoll() {
    var p = store.get(POLL, null);
    if (!p) { $('pollVotes').innerHTML = '<p class="note">No poll running. Enter a question + options and press Start.</p>'; return; }
    var total = p.opts.reduce(function (s, o) { return s + o.votes; }, 0);
    $('pollVotes').innerHTML = '<p><b>' + esc(p.q) + '</b> — ' + total + ' votes</p>' +
      p.opts.map(function (o, i) {
        return '<div class="row"><span style="flex:1">' + esc(o.text) + ': ' + o.votes + '</span><button class="btn secondary" data-vote="' + i + '">+1 vote</button></div>';
      }).join('');
  }
  $('pollStart').addEventListener('click', function () {
    var opts = [$('pollOpt1').value, $('pollOpt2').value, $('pollOpt3').value, $('pollOpt4').value]
      .map(function (t) { return t.trim(); }).filter(Boolean)
      .map(function (t) { return { text: t, votes: 0 }; });
    if (!opts.length) return;
    store.set(POLL, { q: $('pollQ').value.trim() || 'Poll', opts: opts }); renderPoll();
  });
  $('pollVotes').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-vote]');
    if (!btn) return;
    var p = store.get(POLL, null); if (!p) return;
    p.opts[parseInt(btn.dataset.vote, 10)].votes++;
    store.set(POLL, p); renderPoll();
  });
  renderPoll();

  $('givePick').addEventListener('click', function () {
    var names = $('giveNames').value.split('\n').map(function (n) { return n.trim(); }).filter(Boolean);
    if (!names.length) { $('giveResult').textContent = 'Paste at least one name first.'; return; }
    $('giveResult').textContent = '🎉 Winner: ' + names[Math.floor(Math.random() * names.length)] + ' — verify they were in chat, then announce it live!';
  });

  var SHOUTS = 'sc_shouts';
  function renderShouts() {
    var list = store.get(SHOUTS, []);
    $('shoutList').innerHTML = list.length ? list.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') : '<li>No one in the queue yet.</li>';
  }
  $('shoutAdd').addEventListener('click', function () {
    var n = $('shoutName').value.trim(); if (!n) return;
    var list = store.get(SHOUTS, []); list.push(n);
    store.set(SHOUTS, list); $('shoutName').value = ''; renderShouts();
  });
  $('shoutNext').addEventListener('click', function () {
    var list = store.get(SHOUTS, []);
    if (!list.length) return;
    var done = list.shift();
    store.set(SHOUTS, list); renderShouts();
    alert('Shoutout done: ' + done + ' — say it live, then move on to the next name.');
  });
  renderShouts();

  // ---------- Session tools ----------
  var upSec = 0, upTimer = null;
  function fmtUp(s) {
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(h) + ':' + p(m) + ':' + p(sec);
  }
  $('upStart').addEventListener('click', function () {
    if (upTimer) return;
    upTimer = setInterval(function () { upSec++; $('uptime').textContent = fmtUp(upSec); }, 1000);
  });
  $('upPause').addEventListener('click', function () { clearInterval(upTimer); upTimer = null; });
  $('upReset').addEventListener('click', function () { clearInterval(upTimer); upTimer = null; upSec = 0; $('uptime').textContent = '00:00:00'; });
  function refreshGoal() {
    var start = parseInt($('goalStart').value, 10) || 0;
    var now = parseInt($('goalNow').value, 10) || 0;
    var target = parseInt($('goalTarget').value, 10) || 100;
    var pct = target > start ? Math.max(0, Math.min(100, Math.round((now - start) / (target - start) * 100))) : 100;
    $('goalBar').style.width = pct + '%';
    $('goalPct').textContent = (now - start) + ' gained this stream · ' + now + ' / ' + target + ' (' + pct + '% of the way from start to goal)';
  }
  ['goalStart', 'goalNow', 'goalTarget'].forEach(function (id) { $(id).addEventListener('input', refreshGoal); });
  refreshGoal();

  var PROMPTS = [
    'Right now I\'m farming [item] because I need it for [build/weapon].',
    'This is run number [X] — let\'s see if the drop finally cooperates.',
    'Here\'s the fastest route I use for this farm, step by step.',
    'If you\'re farming this too, the one mistake to avoid is…',
    'What\'s your main right now — and what frame should I try next?',
    'What are you farming this week? Anyone else stuck on the same drop?',
    'New players in chat: what\'s the one thing you wish someone explained sooner?',
    'Chat, settle it: which is the better starter farm — relics or credits?',
    'Here\'s my build and why each mod is there — ask me about any slot.',
    'This weapon feels completely different with this one mod swapped.',
    'I\'m testing this build today — tell me if it looks off or cracked.',
    'The last change I made to this loadout was [X], and here\'s what it fixed.'
  ];
  var lastPrompt = -1;
  $('randomBtn').addEventListener('click', function () {
    var i;
    do { i = Math.floor(Math.random() * PROMPTS.length); } while (i === lastPrompt && PROMPTS.length > 1);
    lastPrompt = i;
    $('randomPrompt').textContent = PROMPTS[i];
  });

  // ---------- VOD pipeline ----------
  var VODS = 'sc_vods';
  var VOD_TASKS = [
    ['tiktok', 'TikTok clip'], ['shorts', 'YouTube Short'],
    ['youtube', 'Full YouTube video'], ['thumbnail', 'Thumbnail'],
    ['description', 'Description + tags'], ['scheduled', 'Scheduled / posted']
  ];
  function renderVods() {
    var vods = store.get(VODS, []);
    $('vodList').innerHTML = vods.length ? vods.map(function (v, i) {
      var st = v.tasks || {};
      var done = VOD_TASKS.filter(function (t) { return st[t[0]]; }).length;
      return '<li><button data-voddel="' + i + '">Delete</button><b>' + esc(v.title) + '</b> — ' + done + '/' + VOD_TASKS.length + ' done<br>' +
        VOD_TASKS.map(function (t) {
          return '<label style="display:block;margin:4px 0"><input type="checkbox" data-vod="' + i + '" data-k="' + t[0] + '"' + (st[t[0]] ? ' checked' : '') + '> ' + t[1] + '</label>';
        }).join('') + '</li>';
    }).join('') : '<li>No VODs in the pipeline yet. Add one after your next stream.</li>';
  }
  $('vodAdd').addEventListener('click', function () {
    var t = $('vodTitle').value.trim(); if (!t) return;
    var vods = store.get(VODS, []);
    vods.unshift({ title: t, tasks: {} });
    store.set(VODS, vods); $('vodTitle').value = ''; renderVods();
  });
  $('vodList').addEventListener('change', function (e) {
    var box = e.target.closest('[data-vod]');
    if (!box) return;
    var vods = store.get(VODS, []);
    vods[box.dataset.vod].tasks = vods[box.dataset.vod].tasks || {};
    vods[box.dataset.vod].tasks[box.dataset.k] = box.checked;
    store.set(VODS, vods); renderVods();
  });
  $('vodList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-voddel]');
    if (!btn) return;
    var vods = store.get(VODS, []);
    vods.splice(parseInt(btn.dataset.voddel, 10), 1);
    store.set(VODS, vods); renderVods();
  });
  renderVods();

  // ---------- Search ----------
  var searchIndex = [];
  document.querySelectorAll('[data-search]').forEach(function (el) {
    var panel = el.closest('.panel');
    searchIndex.push({ text: (el.dataset.search + ' ' + el.textContent).toLowerCase(), label: el.textContent.trim().slice(0, 90), panel: panel ? panel.id : '', el: el });
  });
  var searchInput = $('globalSearch'), resultsBox = $('searchResults');
  searchInput.addEventListener('input', function () {
    var q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) { resultsBox.innerHTML = ''; return; }
    var hits = searchIndex.filter(function (h) { return h.text.indexOf(q) !== -1; }).slice(0, 12);
    resultsBox.innerHTML = hits.length
      ? hits.map(function (h, i) { return '<button data-hit="' + i + '">' + esc(h.label) + ' <small>→ ' + esc(h.panel) + '</small></button>'; }).join('')
      : '<p class="note" style="padding:8px">No matches. Try “Warframe”, “bitrate”, “raid”, or “TikTok”.</p>';
    resultsBox.querySelectorAll('[data-hit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var h = hits[parseInt(btn.dataset.hit, 10)];
        resultsBox.innerHTML = ''; searchInput.value = '';
        switchTab(h.panel, h.el);
      });
    });
    // Keep the hit list for clicks: rebind by storing on the box.
    resultsBox._hits = hits;
  });

  // ---------- Data portability ----------
  $('exportBtn').addEventListener('click', function () {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf('sc_') === 0) { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { data[k] = localStorage.getItem(k); } }
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stream-companion-backup.json';
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('bad file');
        var count = 0;
        Object.keys(data).forEach(function (k) {
          if (k.indexOf('sc_') === 0) { localStorage.setItem(k, JSON.stringify(data[k])); count++; }
        });
        $('importMsg').textContent = 'Imported ' + count + ' sections. Reloading…';
        setTimeout(function () { location.reload(); }, 800);
      } catch (err) { $('importMsg').textContent = 'That file could not be imported — is it a Stream Companion backup?'; }
    };
    reader.readAsText(file);
  });
  $('clearBtn').addEventListener('click', function () {
    if (!confirm('Erase ALL Stream Companion data in this browser? Export a backup first.')) return;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('sc_') === 0) keys.push(k); }
    keys.forEach(function (k) { localStorage.removeItem(k); });
    location.reload();
  });

  // ---------- PWA ----------
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
