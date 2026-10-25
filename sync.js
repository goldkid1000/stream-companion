// Stream Companion — Twitch Sync (automatic).
// Reads twitch-stats.json from the same site (written every 6 hours by a
// scheduled check of the public channel page — no Twitch login involved).
// This is the ONLY network fetch in the app, and it is same-origin.
// Everything it shows is read-only except the one-tap "use auto count"
// button, which writes the auto follower number into the manual tracker.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(at) {
    try {
      return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return at || ''; }
  }
  function show(msg) { if ($('syncChecked')) $('syncChecked').textContent = msg; }

  fetch('twitch-stats.json', { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('no sync file');
    return r.json();
  }).then(function (d) {
    show('Auto-tracked from your public channel page — last checked: ' + fmt(d.updated_at) + '.');
    var now = $('syncNow');
    if (now) {
      if (d.is_live) {
        now.innerHTML = '● <b>LIVE now</b> — ' + esc(d.title) + ' (' + esc(d.game) + ')' +
          (d.viewers != null ? ' · ' + esc(d.viewers) + ' viewers' : '');
      } else {
        now.innerHTML = 'Offline right now · <b>' + esc(d.followers) + ' followers</b> (auto)';
      }
    }
    var hist = $('syncHistory');
    if (hist) {
      var points = (d.history || []).slice(-10).reverse();
      hist.innerHTML = points.length ? points.map(function (p) {
        return '<li>' + esc(fmt(p.at)) + ' — ' + esc(p.followers) + ' followers' +
          (p.is_live ? ' · live' : '') + '</li>';
      }).join('') : '<li>No history yet.</li>';
    }
    var streams = $('syncStreams');
    if (streams) {
      var list = (d.streams || []).slice(-10).reverse();
      streams.innerHTML = list.length ? list.map(function (s) {
        return '<li>' + esc(s.date) + ' — ' + esc(s.title) + ' (' + esc(s.game) + ')' +
          (s.peak_viewers != null ? ' · peak ' + esc(s.peak_viewers) + ' viewers' : '') + '</li>';
      }).join('') : '<li>No streams recorded yet.</li>';
    }
    var btn = $('syncApply');
    if (btn) {
      btn.addEventListener('click', function () {
        if (typeof d.followers !== 'number') return;
        var input = $('inFollowers');
        var save = $('saveAffiliate');
        if (input) input.value = d.followers;
        if (save) save.click();
        var note = $('syncApplied');
        if (note) note.textContent = 'Tracker updated to ' + d.followers + ' followers.';
      });
    }
  }).catch(function () {
    show('No sync data yet — the first automatic check runs within 6 hours.');
  });
})();
