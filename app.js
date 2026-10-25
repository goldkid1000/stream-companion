// Stream Companion — all personal data lives in localStorage. No network
// calls except sync.js's same-origin fetch of twitch-stats.json.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---- Tabs ----
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      $(btn.dataset.tab).classList.add('active');
    });
  });

  // ---- Affiliate tracker (followers default = verified 60; rest start at 0) ----
  var AFF = 'sc_affiliate';
  var aff = store.get(AFF, { followers: 60, minutes: 0, days: 0, viewers: 0 });
  function showAff() {
    $('inFollowers').value = aff.followers; $('inMinutes').value = aff.minutes;
    $('inDays').value = aff.days; $('inViewers').value = aff.viewers;
    var rows = [
      ['barFollowers', 'pctFollowers', aff.followers, 100, 'followers'],
      ['barMinutes', 'pctMinutes', aff.minutes, 500, 'minutes'],
      ['barDays', 'pctDays', aff.days, 7, 'days'],
      ['barViewers', 'pctViewers', aff.viewers, 3, 'avg viewers']
    ];
    rows.forEach(function (r) {
      var pct = Math.min(100, Math.round(r[2] / r[3] * 100));
      $(r[0]).style.width = pct + '%';
      $(r[1]).textContent = r[2] + ' / ' + r[3] + ' ' + r[4] + ' — ' + pct + '%';
    });
  }
  $('saveAffiliate').addEventListener('click', function () {
    aff = {
      followers: Math.max(0, parseInt($('inFollowers').value, 10) || 0),
      minutes: Math.max(0, parseInt($('inMinutes').value, 10) || 0),
      days: Math.max(0, parseInt($('inDays').value, 10) || 0),
      viewers: Math.max(0, parseFloat($('inViewers').value) || 0)
    };
    store.set(AFF, aff); showAff();
    $('affSaved').textContent = 'Saved ✓';
  });
  showAff();

  // ---- Go-live checklist with per-game presets ----
  var BASE_CHECKS = [
    'Title set (use Title Studio)',
    'Category set to the game you are playing',
    'Tags added (e.g. English, friendlygamer, Farming for Warframe)',
    'VOD setting “Store past broadcasts” is ON',
    'StreamElements overlay source is live in OBS',
    'Avatar source is on and visible',
    'Mic level checked (aim raw approx -20 dB)',
    'Test alert fired (follow alert shows + sounds right)'
  ];
  var PRESETS = {
    warframe: { note: 'Warframe preset: use Window Capture + Borderless Windowed — Game Capture shows black across the two GPUs. Keep output at 1280x720 for now.', extra: ['Capture set to Window Capture + Borderless Windowed', 'In-game HUD check: minimap clear of the chat box'] },
    fortnite: { note: 'Fortnite preset: Performance Mode + 120 FPS cap. Watch OBS Stats — rendering lag means the game GPU is overloaded.', extra: ['Fortnite set to Performance Mode + 120 FPS cap', 'OBS Preview OFF if the stream lags'] },
    variety: { note: 'Variety preset: confirm the capture mode for this game before going live (Game Capture works for single-GPU games; Window Capture is the safe fallback).', extra: ['Capture mode confirmed for this game', 'Category + title updated for this game (not left on Warframe)'] }
  };
  var CHK = 'sc_checks';
  var currentPreset = 'warframe';
  function checkItems() { return BASE_CHECKS.concat(PRESETS[currentPreset].extra); }
  function renderChecks() {
    var saved = store.get(CHK, {});
    var items = checkItems();
    $('presetNote').textContent = PRESETS[currentPreset].note;
    $('checkList').innerHTML = items.map(function (text, i) {
      var on = !!saved[currentPreset + ':' + i];
      return '<li class="' + (on ? 'done' : '') + '"><input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + '><span class="ctext">' + text + '</span></li>';
    }).join('');
    var done = items.filter(function (_, i) { return saved[currentPreset + ':' + i]; }).length;
    $('checkProgress').textContent = done + ' / ' + items.length + ' done';
    $('checkList').querySelectorAll('input').forEach(function (box) {
      box.addEventListener('change', function () {
        var s = store.get(CHK, {});
        s[currentPreset + ':' + box.dataset.i] = box.checked;
        store.set(CHK, s); renderChecks();
      });
    });
  }
  document.querySelectorAll('.preset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.preset').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentPreset = btn.dataset.preset; renderChecks();
    });
  });
  $('resetChecks').addEventListener('click', function () {
    var s = store.get(CHK, {});
    checkItems().forEach(function (_, i) { delete s[currentPreset + ':' + i]; });
    store.set(CHK, s); renderChecks();
  });
  renderChecks();

  // ---- Title studio ----
  var DEFAULT_TITLE = 'Warframe Farming + Chatting | Road to 100 Followers';
  var ALTS = [
    'Chill Warframe Farms | Road to 100 Followers',
    'Warframe Grind & Good Vibes | Road to 100 Followers',
    'Relic Farming | Warframe Farming + Chatting | Road to 100 Followers'
  ];
  function genTitle() {
    return $('genGame').value.trim() + ' ' + $('genActivity').value.trim() + ' | ' + $('genGoal').value.trim();
  }
  function refreshGen() { $('genTitle').textContent = genTitle(); }
  ['genGame', 'genActivity', 'genGoal'].forEach(function (id) {
    $(id).addEventListener('input', refreshGen);
  });
  refreshGen();
  $('altTitles').innerHTML = ALTS.map(function (t, i) {
    return '<li><span id="alt' + i + '">' + t + '</span><button data-copy="alt' + i + '">Copy</button></li>';
  }).join('');

  // ---- Copy buttons (event delegation covers static + generated buttons) ----
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = $(btn.dataset.copy).textContent;
    function done() { var old = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = old; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta); done();
    }
  });

  // ---- Stream log ----
  var LOG = 'sc_log';
  function getLog() { return store.get(LOG, []); }
  function renderLog() {
    var entries = getLog();
    var gained = entries.reduce(function (s, e) { return s + (e.gained || 0); }, 0);
    var best = entries.reduce(function (m, e) { return Math.max(m, e.peak || 0); }, 0);
    $('logTotals').textContent = entries.length + ' sessions · ' + gained + ' followers gained · best peak ' + best + ' viewers';
    $('logList').innerHTML = entries.length ? entries.map(function (e, i) {
      return '<li><button data-del="' + i + '">Delete</button><b>' + e.date + ' — ' + e.game + '</b><br>' +
        e.title + '<br><small>Peak: ' + (e.peak || 0) + ' · Gained: ' + (e.gained || 0) +
        (e.notes ? ' · ' + e.notes : '') + '</small></li>';
    }).join('') : '<li>No sessions logged yet. Your first entry goes here after your next stream.</li>';
  }
  $('logForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var entries = getLog();
    entries.unshift({
      date: $('logDate').value, game: $('logGame').value, title: $('logTitle').value,
      peak: parseInt($('logPeak').value, 10) || 0, gained: parseInt($('logGained').value, 10) || 0,
      notes: $('logNotes').value
    });
    store.set(LOG, entries); renderLog(); $('logForm').reset();
    $('logGame').value = 'Warframe';
    $('logTitle').value = DEFAULT_TITLE;
  });
  $('logList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-del]');
    if (!btn) return;
    var entries = getLog();
    entries.splice(parseInt(btn.dataset.del, 10), 1);
    store.set(LOG, entries); renderLog();
  });
  renderLog();
})();
