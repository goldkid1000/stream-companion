// Stream Companion — Publish studio.
// No account is truly "connected": X, TikTok, Instagram and friends block
// browser-only posting, so a static page cannot hold their login or post
// behind the scenes. What this tab does instead, honestly:
//  - X + Bluesky: opens a prefilled compose window (one tap, you hit Post).
//  - Facebook: opens the link sharer for your Twitch URL (Facebook does
//    not let any tool prefill the text).
//  - Threads / TikTok / Instagram / YouTube: copies the caption and opens
//    your profile, so you paste and post natively.
// Handles and the posted log live only in this browser (sc_handles,
// sc_published) and are included in the Data tab backup.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var TWITCH = 'https://www.twitch.tv/el_burry2006';
  var HANDLES = 'sc_handles';
  var LOG = 'sc_published';
  var FIELDS = [
    ['inX', 'x', 'X (Twitter)'], ['inBluesky', 'bluesky', 'Bluesky'],
    ['inThreads', 'threads', 'Threads'], ['inTiktok', 'tiktok', 'TikTok'],
    ['inYoutube', 'youtube', 'YouTube'], ['inInstagram', 'instagram', 'Instagram'],
    ['inFacebook', 'facebook', 'Facebook']
  ];
  var PROFILES = {
    threads: function (h) { return h ? 'https://www.threads.net/@' + h.replace(/^@/, '') : 'https://www.threads.net/'; },
    tiktok: function (h) { return h ? 'https://www.tiktok.com/@' + h.replace(/^@/, '') : 'https://www.tiktok.com/'; },
    instagram: function (h) { return h ? 'https://www.instagram.com/' + h.replace(/^@/, '') + '/' : 'https://www.instagram.com/'; },
    youtube: function (h) { return h ? 'https://www.youtube.com/@' + h.replace(/^@/, '') : 'https://www.youtube.com/'; }
  };
  var TEMPLATES = {
    live: '🔴 LIVE NOW — Warframe Farming + Chatting | Road to 100 Followers ▶ ' + TWITCH,
    clip: 'New clip is up 🎬 — watch it here: ' + TWITCH,
    schedule: "This week's streams 📅 — come hang out: " + TWITCH,
    vod: "VOD's up 📺 — catch the replay: " + TWITCH
  };

  function handles() { return store.get(HANDLES, {}); }
  function renderHandles() {
    var h = handles();
    FIELDS.forEach(function (f) { if ($(f[0])) $(f[0]).value = h[f[1]] || ''; });
  }
  function renderLog() {
    var ul = $('pubHistory');
    if (!ul) return;
    var log = store.get(LOG, []).slice(-10).reverse();
    ul.innerHTML = log.length ? log.map(function (e, i) {
      var idx = store.get(LOG, []).length - 1 - i;
      return '<li>' + esc(fmt(e.at)) + ' — ' + esc(e.type) + ' → ' + esc(e.account) +
        ' <button class="mini" data-del="' + idx + '">✕</button></li>';
    }).join('') : '<li>Nothing posted yet.</li>';
    ul.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var log2 = store.get(LOG, []);
        log2.splice(parseInt(b.dataset.del, 10), 1);
        store.set(LOG, log2);
        renderLog();
      });
    });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(at) {
    try { return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return at || ''; }
  }
  function logPost(type, account) {
    var log = store.get(LOG, []);
    log.push({ at: new Date().toISOString(), type: type, account: account });
    store.set(LOG, log);
    renderLog();
  }
  function text() { return $('pubText') ? $('pubText').value : ''; }
  function type() { return $('pubType') ? $('pubType').value : 'live'; }
  function count() {
    var c = $('pubCount');
    if (!c) return;
    var n = text().length;
    c.textContent = n + ' characters' + (n > 280 ? ' — over X\'s 280 limit, trim it for X' : ' (X limit: 280)');
  }
  function copyThen(url, account) {
    var t = text();
    function done() { window.open(url, '_blank'); logPost(type(), account); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done).catch(function () { done(); });
    } else { done(); }
    var note = $('pubCopied');
    if (note) note.textContent = 'Caption copied — paste it in ' + account + '.';
  }

  renderHandles();
  renderLog();
  count();
  var save = $('saveHandles');
  if (save) save.addEventListener('click', function () {
    var h = {};
    FIELDS.forEach(function (f) { h[f[1]] = $(f[0]) ? $(f[0]).value.trim() : ''; });
    store.set(HANDLES, h);
    var note = $('handlesSaved');
    if (note) note.textContent = 'Handles saved (this browser only).';
  });
  document.querySelectorAll('[data-tpl]').forEach(function (b) {
    b.addEventListener('click', function () {
      if ($('pubText')) $('pubText').value = TEMPLATES[b.dataset.tpl] || '';
      if ($('pubType')) $('pubType').value = b.dataset.tpl;
      count();
    });
  });
  var ta = $('pubText');
  if (ta) ta.addEventListener('input', count);
  document.querySelectorAll('[data-post]').forEach(function (b) {
    b.addEventListener('click', function () {
      var kind = b.dataset.post;
      var t = text();
      var h = handles();
      if (!t.trim()) return;
      if (kind === 'x') {
        window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(t), '_blank');
        logPost(type(), 'X');
      } else if (kind === 'bluesky') {
        window.open('https://bsky.app/intent/compose?text=' + encodeURIComponent(t), '_blank');
        logPost(type(), 'Bluesky');
      } else if (kind === 'facebook') {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(TWITCH), '_blank');
        logPost(type(), 'Facebook');
      } else if (PROFILES[kind]) {
        copyThen(PROFILES[kind](h[kind]), kind.charAt(0).toUpperCase() + kind.slice(1));
      }
    });
  });
})();
