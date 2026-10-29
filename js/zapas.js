// TTC Bystřice — zápis o utkání (zapas.html?id=672666).
// Data připravuje skript aktualizovat_data.py ze zápisu na STIS do data/zapisy/ID.json.
(function () {
  var TYMY = { A: 'tym-a.html', B: 'tym-b.html', C: 'tym-c.html', D: 'tym-d.html' };
  var NAS = 'Bystřice';
  var $ = function (id) { return document.getElementById(id); };
  var id = (new URLSearchParams(location.search).get('id') || '').replace(/\D/g, '');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nenalezeno(text) {
    $('z-skore').innerHTML = '<h1>Zápis nenalezen</h1>';
    $('z-stav').innerHTML = '<strong>' + text + '</strong>Zápisy se doplňují při automatické aktualizaci ze STIS.';
  }
  if (!id) return nenalezeno('Chybí ID utkání');

  fetch('data/zapisy/' + id + '.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(vykresli)
    .catch(function () { nenalezeno('Zápis tohoto utkání zatím není k dispozici'); });

  function vykresli(d) {
    var tymUrl = TYMY[d.tym];
    var nasDomaci = d.domaci.nazev.indexOf(NAS) >= 0, nasHoste = d.hoste.nazev.indexOf(NAS) >= 0;
    var body = d.body || [null, null];
    var vyhraDomaci = body[0] > body[1], vyhraHoste = body[1] > body[0];
    document.title = d.domaci.nazev + ' – ' + d.hoste.nazev + ' ' + body.join(':') + ' — TTC Bystřice';

    $('z-drobek').innerHTML = '<a href="index.html">Domů</a> / ' +
      (tymUrl ? '<a href="' + tymUrl + '">Tým ' + d.tym + '</a> / ' : '') + 'Zápis o utkání · ' + esc(d.kolo) + '. kolo';

    function tym(t, nas, vyhral) {
      var jmeno = nas && tymUrl ? '<a href="' + tymUrl + '">' + esc(t.nazev) + '</a>' : esc(t.nazev);
      return '<div class="zapas-skore__tym' + (vyhral ? ' is-winner' : '') + '">' + jmeno + '</div>';
    }
    $('z-skore').innerHTML =
      '<div class="zapas-skore__meta">' + esc(d.soutez) + ' · ' + esc(d.kolo) + '. kolo · ' + esc(d.kategorie) + '</div>' +
      '<div class="zapas-skore__radek">' +
        tym(d.domaci, nasDomaci, vyhraDomaci) +
        '<div class="zapas-skore__cislo"><span class="' + (vyhraDomaci ? 'is-winner' : 'is-loser') + '">' + body[0] + '</span>' +
          '<span class="result-card__colon">:</span><span class="' + (vyhraHoste ? 'is-winner' : 'is-loser') + '">' + body[1] + '</span></div>' +
        tym(d.hoste, nasHoste, vyhraHoste) +
      '</div>' +
      '<div class="zapas-skore__meta">' + esc(d.datum) + (d.misto ? ' · ' + esc(d.misto) : '') + '</div>';

    // ---------- hlavička zápisu ----------
    var sady = d.sady || [], micky = d.micky || [];
    var info = [
      ['Pořádající', esc(d.domaci.nazev)], ['Hostující', esc(d.hoste.nazev)],
      ['Hráno v místnosti', esc(d.misto || '—')], ['Datum dle rozpisu', esc(d.datum || '—')],
      ['Začátek – konec utkání', esc((d.zacatek || '?') + ' – ' + (d.konec || '?'))],
      ['Vrchní rozhodčí', esc(d.vrchni_rozhodci || '—')]
    ];
    if ((d.rozhodci || []).length) info.push(['Rozhodčí', esc(d.rozhodci.join(', '))]);
    var html = '<section class="section"><div class="container">' +
      '<div class="hrac-karty">' +
        '<div class="stat-card stat-card--hl"><span>Body</span><strong>' + body.join(' : ') + '</strong></div>' +
        '<div class="stat-card"><span>Sady</span><strong>' + sady.join(' : ') + '</strong></div>' +
        '<div class="stat-card"><span>Míčky</span><strong>' + micky.join(' : ') + '</strong></div>' +
        '<div class="stat-card"><span>Vítěz</span><strong class="zapas-vitez">' + esc(d.vitez ? d.vitez.nazev : 'remíza') + '</strong></div>' +
      '</div>' +
      '<div class="card"><ul class="info-list zapas-info">' + info.map(function (r) {
        return '<li><span>' + r[0] + '</span><strong>' + r[1] + '</strong></li>';
      }).join('') + '</ul></div>' +
      '</div></section>';

    // ---------- jednotlivé výsledky ----------
    var maxSetu = 5;
    function hraci(list, nas) {
      return list.map(function (p) {
        var j = nas ? '<a href="hrac.html?id=' + esc(p.id) + '">' + esc(p.jmeno) + '</a>' : esc(p.jmeno);
        return '<span class="zapas-hrac" data-hrac="' + esc(p.id) + '">' + j + '</span>';
      }).join('<br>');
    }
    var radky = d.hry.map(function (h) {
      var odehrano = h.sety.length > 0;
      var vd = odehrano && h.sady[0] > h.sady[1], vh = odehrano && h.sady[1] > h.sady[0];
      var sety = '';
      for (var i = 0; i < maxSetu; i++) {
        var s = h.sety[i];
        sety += '<td class="zapas-set' + (s == null ? '' : s > 0 ? ' set-d' : ' set-h') + '">' + (s == null ? '' : s) + '</td>';
      }
      var ctyrhra = h.domaci.length > 1 || h.hoste.length > 1;
      return '<tr class="' + (ctyrhra ? 'zapas-ctyrhra' : '') + (odehrano ? '' : ' zapas-neodehrano') + '">' +
        '<td>' + h.c + '.</td>' +
        '<td class="zapas-strana' + (vd ? ' is-winner' : '') + '">' + hraci(h.domaci, nasDomaci) + '</td>' +
        '<td class="zapas-strana' + (vh ? ' is-winner' : '') + '">' + hraci(h.hoste, nasHoste) + '</td>' +
        sety +
        '<td class="zapas-sady">' + (odehrano ? h.sady[0] + ' : ' + h.sady[1] : '—') + '</td>' +
        '<td class="zapas-stav">' + (h.stav[0] != null ? h.stav[0] + ' : ' + h.stav[1] : '') + '</td></tr>';
    });
    html += '<section class="section section--alt"><div class="container">' +
      '<div class="section__head"><h2>Jednotlivé výsledky</h2></div>' +
      '<p class="admin__muted zapas-napoveda">Najetím (nebo klepnutím) na hráče se zvýrazní všechny jeho hry. ' +
      'Kladné číslo = set vyhráli domácí, záporné = hosté.</p>' +
      '<div class="table-wrap"><table class="tabulka zapas-hry"><thead><tr><th>č.</th><th>' + esc(d.domaci.nazev) + '</th><th>' + esc(d.hoste.nazev) +
      '</th><th colspan="' + maxSetu + '">Výsledek hry</th><th>Sady</th><th>Body</th></tr></thead><tbody>' + radky.join('') + '</tbody></table></div>' +
      '</div></section>';

    // ---------- statistika jednotlivých hráčů ----------
    var st = d.statistika || { domaci: [], hoste: [] };
    function statRadky(list, nas) {
      return list.map(function (p) {
        var jmeno = p.id ? '<span class="zapas-hrac" data-hrac="' + esc(p.id) + '">' +
          (nas ? '<a href="hrac.html?id=' + esc(p.id) + '">' + esc(p.jmeno) + '</a>' : esc(p.jmeno)) + '</span>' : '<em>' + esc(p.jmeno) + '</em>';
        return '<tr><td>' + jmeno + '</td><td><strong>' + p.vyhry + ' : ' + p.prohry + '</strong></td></tr>';
      }).join('');
    }
    html += '<section class="section"><div class="container">' +
      '<div class="section__head"><h2>Statistika jednotlivých hráčů</h2></div>' +
      '<div class="grid grid--2">' +
        '<div><h3 class="zapas-stat__tym">' + esc(d.domaci.nazev) + '</h3>' +
          '<div class="table-wrap"><table class="tabulka"><thead><tr><th>Hráč</th><th>Výhry : prohry</th></tr></thead><tbody>' + statRadky(st.domaci, nasDomaci) + '</tbody></table></div></div>' +
        '<div><h3 class="zapas-stat__tym">' + esc(d.hoste.nazev) + '</h3>' +
          '<div class="table-wrap"><table class="tabulka"><thead><tr><th>Hráč</th><th>Výhry : prohry</th></tr></thead><tbody>' + statRadky(st.hoste, nasHoste) + '</tbody></table></div></div>' +
      '</div>' +
      (tymUrl ? '<p style="margin-top:22px"><a href="' + tymUrl + '" class="btn btn--sm btn--ghost">← Zpět na tým ' + d.tym + '</a></p>' : '') +
      '</div></section>';

    $('zapas-obsah').innerHTML = html;

    // zvýraznění všech her jednoho hráče (jako na STIS)
    var aktivni = null;
    function zvyrazni(pid) {
      document.querySelectorAll('.zapas-hrac').forEach(function (el) {
        el.classList.toggle('is-hl', !!pid && el.getAttribute('data-hrac') === pid);
      });
      document.querySelectorAll('.zapas-hry tbody tr').forEach(function (tr) {
        tr.classList.toggle('is-hl', !!pid && !!tr.querySelector('.zapas-hrac[data-hrac="' + pid + '"]'));
      });
    }
    var obsah = $('zapas-obsah');
    obsah.addEventListener('mouseover', function (e) {
      var h = e.target.closest('.zapas-hrac'); if (h && !aktivni) zvyrazni(h.getAttribute('data-hrac'));
    });
    obsah.addEventListener('mouseout', function (e) {
      if (e.target.closest('.zapas-hrac') && !aktivni) zvyrazni(null);
    });
    obsah.addEventListener('click', function (e) {   // na mobilu: klepnutí zvýraznění zapne / vypne
      var h = e.target.closest('.zapas-hrac');
      if (!h || e.target.closest('a')) return;
      var pid = h.getAttribute('data-hrac');
      aktivni = aktivni === pid ? null : pid;
      zvyrazni(aktivni);
    });
  }
})();
