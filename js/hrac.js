// TTC Bystřice — detail hráče (hrac.html?id=12345).
// Data připravuje skript aktualizovat_data.py ze stránky hráče na STIS do data/hraci/ID.json.
(function () {
  var TYMY = { A: 'tym-a.html', B: 'tym-b.html', C: 'tym-c.html', D: 'tym-d.html' };
  var STIS = 'https://stis.ping-pong.cz';
  var $ = function (id) { return document.getElementById(id); };
  var id = (new URLSearchParams(location.search).get('id') || '').replace(/\D/g, '');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function znamenko(n) { return n > 0 ? '+' + n : String(n); }
  function trida(n) { return n > 0 ? 'plus' : n < 0 ? 'minus' : ''; }
  function sekce(nadpis, obsah, alt, akce) {
    return '<section class="section' + (alt ? ' section--alt' : '') + '"><div class="container">' +
      '<div class="section__head"><h2>' + nadpis + '</h2>' + (akce || '') + '</div>' + obsah + '</div></section>';
  }
  function tabulka(hlavicka, radky, cls) {
    return '<div class="table-wrap"><table class="tabulka ' + (cls || '') + '"><thead><tr>' +
      hlavicka.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      radky.join('') + '</tbody></table></div>';
  }
  // výsledek zápasu z pohledu hráče: první číslo = jeho sety
  function vyhral(vysledek) {
    var m = /^(\d+):(\d+)/.exec(vysledek || '');
    return m ? (+m[1] > +m[2] ? 1 : +m[1] < +m[2] ? -1 : 0) : 0;
  }

  if (!id) {
    $('h-jmeno').textContent = 'Hráč nenalezen';
    $('h-stav').innerHTML = '<strong>Chybí ID hráče</strong>Vyberte hráče ze soupisky na stránce týmu.';
    return;
  }

  fetch('data/hraci/' + id + '.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(vykresli)
    .catch(function () {
      $('h-jmeno').textContent = 'Hráč nenalezen';
      $('h-stav').innerHTML = '<strong>Data hráče zatím nejsou k dispozici</strong>' +
        'Doplní se při příští automatické aktualizaci ze STIS.';
    });

  function vykresli(d) {
    var ster = d.str || {};
    var akt = (d.sezony || [])[0] || {};
    document.title = d.jmeno + ' — TTC Bystřice';

    // ---------- hlavička ----------
    var tym = (d.tymy || [])[0];
    $('h-drobek').innerHTML = '<a href="index.html">Domů</a> / ' +
      (tym ? '<a href="' + TYMY[tym] + '">Tým ' + tym + '</a>' : '<a href="index.html#tymy">Týmy</a>') + ' / ' + esc(d.jmeno);
    $('h-jmeno').textContent = d.jmeno;
    $('h-str').innerHTML = ster.str ? '<span class="hrac-str__lbl">STR</span>' + ster.str : '–';
    $('h-str').classList.add('hrac-str');
    var pills = [];
    if (d.rok_narozeni) pills.push('<span class="pill"><strong>Rok narození:</strong> ' + d.rok_narozeni + '</span>');
    if (akt.oddil) pills.push('<span class="pill"><strong>Oddíl:</strong> ' + esc(akt.oddil) + '</span>');
    (d.tymy || []).forEach(function (t) {
      pills.push('<a class="pill pill--link" href="' + TYMY[t] + '"><strong>Družstvo:</strong> TTC Bystřice ' + t + ' →</a>');
    });
    pills.push('<a class="pill pill--link" href="' + esc(d.stis_url) + '" target="_blank" rel="noopener">Profil na STIS ↗</a>');
    $('h-pills').innerHTML = pills.join('');

    var html = '';

    // ---------- aktuální sezóna + STR ----------
    var druzstva = (akt.druzstva || []).map(function (x) {
      return '<li><span>' + esc(x.nazev) + ' <small>(' + esc(x.soutez || '') + ')</small></span>' +
        '<strong>' + esc(x.dvouhry || '0:0') + ' <small>dvouhry</small> · ' + esc(x.ctyrhry || '0:0') + ' <small>čtyřhry</small></strong></li>';
    }).join('');
    html += sekce('Sezóna ' + esc(akt.sezona || ''),
      '<div class="hrac-karty">' +
        '<div class="stat-card"><span>Bilance dvouher</span><strong>' + esc(akt.dvouhry || '0:0') + '</strong></div>' +
        '<div class="stat-card"><span>Bilance čtyřher</span><strong>' + esc(akt.ctyrhry || '0:0') + '</strong></div>' +
        '<div class="stat-card"><span>STR (stabilní)</span><strong>' + (ster.stabil != null ? String(ster.stabil).replace('.', ',') : '–') + '</strong></div>' +
        '<div class="stat-card"><span>STR min … max</span><strong>' + (ster.min || '–') + ' … ' + (ster.max || '–') + '</strong></div>' +
        '<div class="stat-card stat-card--hl"><span>Nejvyšší STR</span><strong>' + (ster.nejvyssi || '–') + '</strong>' +
          (ster.nejvyssi_datum ? '<small>' + esc(ster.nejvyssi_datum) + '</small>' : '') + '</div>' +
      '</div>' +
      (druzstva ? '<div class="card hrac-druzstva"><h3>Družstva v této sezóně</h3><ul class="info-list">' + druzstva + '</ul></div>' : ''));

    // ---------- graf STR ----------
    var graf = d.graf || { body: [], sezony: [] };
    if (graf.body.length) {
      var tlacitka = '<button type="button" class="album-nav__rok is-active" data-sezona="">Vše</button>' +
        graf.sezony.slice().reverse().map(function (s) {
          return '<button type="button" class="album-nav__rok" data-sezona="' + s.rok + '">' + s.rok + '/' + String(s.rok + 1).slice(2) + '</button>';
        }).join('');
      html += sekce('Vývoj STR',
        '<div class="card hrac-graf"><div class="album-nav hrac-graf__sezony">' + tlacitka + '</div>' +
        '<div class="hrac-graf__plocha"><canvas id="graf-str"></canvas></div>' +
        '<p class="admin__muted">Každý bod = jeden zápas. Najetím na bod uvidíte soupeře a výsledek.</p></div>', true);
    }

    // ---------- nejcennější výhry ----------
    var vyhry = ster.nejcennejsi_vyhry || [];
    if (vyhry.length) {
      html += sekce('Nejcennější výhry', tabulka(['Datum', 'Soupeř', 'STR soupeře', 'STR hráče', 'Výsledek', 'Soutěž'],
        vyhry.map(function (w) {
          return '<tr><td>' + esc(w.datum) + '</td><td><a href="' + STIS + '/hrac-' + esc(w.souper_id) + '" target="_blank" rel="noopener">' + esc(w.souper) + '</a></td>' +
            '<td><strong>' + w.str_soupere + '</strong></td><td>' + w.str_hrace + '</td><td>' + esc(w.vysledek) + '</td><td>' + esc(w.soutez) + '</td></tr>';
        })));
    }

    // ---------- bilance dvouher po sezónách ----------
    if ((d.bilance || []).length) {
      html += sekce('Bilance dvouher po sezónách', tabulka(['Sezóna', 'Družstvo', 'Soutěž', 'Utkání', 'Zápasy', 'Výhry', 'Prohry', 'Úspěšnost', 'STR', 'STR +/−'],
        d.bilance.map(function (b) {
          return '<tr><td>' + b.rok + '/' + String(b.rok + 1).slice(2) + '</td><td>' + esc(b.druzstvo) + '</td><td>' + esc(b.soutez) + '</td>' +
            '<td>' + b.pu + '</td><td>' + b.pz + '</td><td>' + b.vyhry + '</td><td>' + b.prohry + '</td><td>' + esc(b.uspesnost) + '</td>' +
            '<td>' + b.str + '</td><td class="str-' + trida(b.str_zmena) + '">' + znamenko(b.str_zmena) + '</td></tr>';
        })), true);
    }

    // ---------- historie sezón (oddíl, družstva) ----------
    if ((d.sezony || []).length) {
      html += sekce('Historie sezón', tabulka(['Sezóna', 'Oddíl', 'Dvouhry', 'Čtyřhry', 'Družstva'],
        d.sezony.map(function (s) {
          var dr = (s.druzstva || []).map(function (x) {
            return esc(x.nazev) + ' <small>(' + esc(x.soutez || '') + (x.dvouhry && x.dvouhry !== '0:0' ? ', ' + esc(x.dvouhry) : '') + ')</small>';
          }).join('<br>');
          return '<tr><td>' + esc(s.sezona) + '</td><td>' + esc(s.oddil || '') + '</td><td>' + esc(s.dvouhry || '0:0') + '</td><td>' + esc(s.ctyrhry || '0:0') + '</td><td class="wrap">' + dr + '</td></tr>';
        })));
    }

    // ---------- zápasy + statistika soupeřů ----------
    var sl = d.zapasy_sloupce, zapasy = (d.zapasy || []).map(function (z) {
      var o = {}; sl.forEach(function (k, i) { o[k] = z[i]; }); return o;
    });
    if (zapasy.length) {
      var roky = zapasy.map(function (z) { return z.rok; }).filter(function (r, i, a) { return a.indexOf(r) === i; });
      var prepinac = '<div class="admin__tabs hrac-tabs"><button type="button" class="admin__tab is-active" data-pohled="zapasy">Zápasy hráče</button>' +
        '<button type="button" class="admin__tab" data-pohled="souperi">Statistika soupeřů</button></div>';
      html += sekce('Zápasy',
        prepinac +
        '<div id="pohled-zapasy"><div class="album-nav hrac-roky">' + roky.map(function (r, i) {
          return '<button type="button" class="album-nav__rok' + (i === 0 ? ' is-active' : '') + '" data-rok="' + r + '">' + r + '/' + String(r + 1).slice(2) + '</button>';
        }).join('') + '<button type="button" class="album-nav__rok" data-rok="">Vše</button></div><div id="zapasy-tabulka"></div></div>' +
        '<div id="pohled-souperi" hidden><input type="search" id="souper-hledat" class="hrac-hledat" placeholder="Hledat soupeře…"><div id="souperi-tabulka"></div></div>', true);
    }

    $('hrac-obsah').innerHTML = html;
    if (graf.body.length) nakresliGraf(graf);
    if (zapasy.length) zapasyUI(zapasy, roky);
  }

  function radekZapasu(z) {
    var v = vyhral(z.vysledek), dz = z.str_po - z.str_pred;
    var vysl = z.zapis ? '<a href="' + STIS + esc(z.zapis) + '" target="_blank" rel="noopener" title="Zápis o utkání na STIS">' + esc(z.vysledek) + '</a>' : esc(z.vysledek);
    return '<tr class="' + (v > 0 ? 'rozpis--win' : v < 0 ? 'rozpis--loss' : '') + '"><td>' + esc(z.datum) + '</td>' +
      '<td><a href="' + STIS + '/hrac-' + esc(z.souper_id) + '" target="_blank" rel="noopener">' + esc(z.souper) + '</a><br><small>' + esc(z.souper_druzstvo) + '</small></td>' +
      '<td><span class="rozpis__skore">' + vysl + '</span> <span class="rozpis__stav rozpis__stav--' + (v > 0 ? 'win">Výhra' : v < 0 ? 'loss">Prohra' : 'draw">–') + '</span></td>' +
      '<td>' + esc(z.druzstvo) + '<br><small>' + esc(z.soutez) + '</small></td>' +
      '<td>' + z.str_po + ' <small class="str-' + trida(dz) + '">(' + znamenko(dz) + ')</small></td>' +
      '<td>' + z.souper_str_pred + '</td></tr>';
  }

  function zapasyUI(zapasy, roky) {
    var hlavicka = ['Datum', 'Soupeř', 'Výsledek', 'Družstvo / soutěž', 'STR hráče', 'STR soupeře'];
    function ukazRok(rok) {
      var vyber = zapasy.filter(function (z) { return !rok || String(z.rok) === String(rok); });
      var v = vyber.filter(function (z) { return vyhral(z.vysledek) > 0; }).length;
      $('zapasy-tabulka').innerHTML = '<p class="hrac-souhrn">Zápasů: <strong>' + vyber.length + '</strong> · výhry <strong>' + v +
        '</strong> · prohry <strong>' + (vyber.length - v) + '</strong></p>' + tabulka(hlavicka, vyber.map(radekZapasu), 'rozpis hrac-zapasy');
    }
    ukazRok(roky[0]);
    document.querySelector('.hrac-roky').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rok]'); if (!b) return;
      this.querySelectorAll('[data-rok]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      ukazRok(b.getAttribute('data-rok'));
    });

    // statistika soupeřů: spočítaná ze všech zápasů
    var souperi = {};
    zapasy.forEach(function (z) {
      var s = souperi[z.souper_id || z.souper] = souperi[z.souper_id || z.souper] ||
        { jmeno: z.souper, id: z.souper_id, druzstvo: z.souper_druzstvo, v: 0, p: 0, str: 0, posledni: z.datum };
      vyhral(z.vysledek) > 0 ? s.v++ : s.p++;
      s.str += (z.str_po - z.str_pred);
    });
    var seznam = Object.keys(souperi).map(function (k) { return souperi[k]; })
      .sort(function (a, b) { return (b.v + b.p) - (a.v + a.p) || a.jmeno.localeCompare(b.jmeno, 'cs'); });
    function ukazSoupere(hledat) {
      var q = (hledat || '').toLowerCase();
      var vyber = seznam.filter(function (s) { return !q || s.jmeno.toLowerCase().indexOf(q) >= 0 || (s.druzstvo || '').toLowerCase().indexOf(q) >= 0; });
      $('souperi-tabulka').innerHTML = '<p class="hrac-souhrn">Různých soupeřů: <strong>' + seznam.length + '</strong></p>' +
        tabulka(['Soupeř', 'Zápasy', 'Výhry : prohry', 'STR +/−', 'Naposledy'], vyber.map(function (s) {
          return '<tr><td><a href="' + STIS + '/hrac-' + esc(s.id) + '" target="_blank" rel="noopener">' + esc(s.jmeno) + '</a><br><small>' + esc(s.druzstvo) + '</small></td>' +
            '<td>' + (s.v + s.p) + '</td><td><strong>' + s.v + ' : ' + s.p + '</strong></td>' +
            '<td class="str-' + trida(s.str) + '">' + znamenko(s.str) + '</td><td>' + esc(s.posledni) + '</td></tr>';
        }), 'rozpis');
    }
    ukazSoupere('');
    $('souper-hledat').addEventListener('input', function () { ukazSoupere(this.value); });

    document.querySelector('.hrac-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pohled]'); if (!b) return;
      this.querySelectorAll('[data-pohled]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      $('pohled-zapasy').hidden = b.getAttribute('data-pohled') !== 'zapasy';
      $('pohled-souperi').hidden = b.getAttribute('data-pohled') !== 'souperi';
    });
  }

  function nakresliGraf(graf) {
    if (!window.Chart) {
      document.querySelector('.hrac-graf__plocha').innerHTML = '<p class="admin__muted">Graf se nepodařilo načíst.</p>';
      return;
    }
    var css = getComputedStyle(document.documentElement);
    var zluta = css.getPropertyValue('--yellow').trim() || '#f7c600';
    var cervena = css.getPropertyValue('--red').trim() || '#d9202f';
    var seda = css.getPropertyValue('--grey-dark').trim() || '#8a867c';
    var body = graf.body, offset = 0;
    var chart = new Chart(document.getElementById('graf-str'), {
      type: 'line',
      data: {
        labels: body.map(function (b) { return b[0]; }),
        datasets: [
          { label: 'STR', data: body.map(function (b) { return b[1]; }), borderColor: zluta, backgroundColor: 'rgba(247,198,0,.12)',
            fill: true, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4, tension: .15 },
          { label: 'STR (stabilní)', data: body.map(function (b) { return b[2]; }), borderColor: cervena,
            borderWidth: 2, pointRadius: 0, pointHoverRadius: 0, tension: .3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, locale: 'cs-CZ',
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: seda, boxWidth: 14 } },
          tooltip: { callbacks: { afterTitle: function (items) { return (body[offset + items[0].dataIndex] || [])[3] || ''; } } }
        },
        scales: {
          x: { ticks: { color: seda, maxTicksLimit: 10, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { ticks: { color: seda }, grid: { color: 'rgba(255,255,255,.07)' } }
        }
      }
    });
    document.querySelector('.hrac-graf__sezony').addEventListener('click', function (e) {
      var b = e.target.closest('[data-sezona]'); if (!b) return;
      this.querySelectorAll('[data-sezona]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      var s = graf.sezony.filter(function (x) { return String(x.rok) === b.getAttribute('data-sezona'); })[0];
      var od = s ? s.od : 0, do_ = s ? s.do : body.length;
      offset = od;
      var cast = body.slice(od, do_);
      chart.data.labels = cast.map(function (x) { return x[0]; });
      chart.data.datasets[0].data = cast.map(function (x) { return x[1]; });
      chart.data.datasets[1].data = cast.map(function (x) { return x[2]; });
      chart.update();
    });
  }
})();
