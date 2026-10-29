// TTC Bystřice — načtení aktualit a fotek ze Supabase do stránky.
// Prvek s atributem data-obsah="aktuality" nebo data-obsah="galerie" se naplní
// obsahem z databáze; data-limit omezí počet položek.
(function () {
  var cfg = window.TTC_SUPABASE;
  if (!cfg) return;

  function api(path) {
    return fetch(cfg.url + '/rest/v1/' + path, { headers: { apikey: cfg.key } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Text aktuality: prázdný řádek = nový odstavec, Enter = nový řádek, adresy http(s) = odkazy.
  function textNaHtml(text) {
    return esc(text).split(/\n\s*\n/).map(function (odst) {
      var html = odst.trim().replace(/\n/g, '<br>').replace(
        /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
        '<a href="$1" target="_blank" rel="noopener">$1</a>'
      );
      return '<p>' + html + '</p>';
    }).join('');
  }

  function fotoUrl(cesta, bucket) {
    // cesta může obsahovat lomítka (2026/…), ta zůstávají
    return cfg.url + '/storage/v1/object/public/' + (bucket || cfg.bucket) + '/' +
      String(cesta).split('/').map(encodeURIComponent).join('/');
  }

  function chyba(el, co) {
    el.innerHTML = '<div class="gallery-empty"><strong>' + co + ' se teď nepodařilo načíst</strong>' +
      'Zkuste prosím stránku za chvíli obnovit.</div>';
  }

  function nactiAktuality(el) {
    var limit = parseInt(el.getAttribute('data-limit') || '6', 10);
    api('aktuality?select=nadpis,text,stitek,datum_text,foto&order=pripnuto.desc,vytvoreno.desc&limit=' + limit)
      .then(function (rows) {
        if (!rows.length) {
          el.innerHTML = '<div class="gallery-empty"><strong>Zatím žádné aktuality</strong>Brzy se tu objeví novinky z klubu.</div>';
          return;
        }
        el.innerHTML = rows.map(function (a) {
          var foto = a.foto ? '<figure class="news-card__foto gallery-item"><img src="' +
            fotoUrl(a.foto, cfg.bucketAktuality) + '" alt="' + esc(a.nadpis) + '" loading="lazy"></figure>' : '';
          return '<article class="news-card' + (a.foto ? ' news-card--foto' : '') + '">' + foto +
            '<span class="tag">' + esc(a.stitek) + '</span>' +
            (a.datum_text ? '<div class="news-card__date">' + esc(a.datum_text) + '</div>' : '') +
            '<h3>' + esc(a.nadpis) + '</h3>' + textNaHtml(a.text) +
            '</article>';
        }).join('');
      })
      .catch(function () { chyba(el, 'Aktuality'); });
  }

  function nactiGalerii(el) {
    var limit = el.getAttribute('data-limit');
    api('galerie?select=cesta,popisek&order=vytvoreno.desc' + (limit ? '&limit=' + parseInt(limit, 10) : ''))
      .then(function (rows) {
        if (!rows.length) {
          el.innerHTML = '<div class="gallery-empty"><strong>Galerie zatím čeká na první fotky</strong>' +
            'Fotky z tréninků a zápasů sem brzy přidáme.</div>';
          return;
        }
        el.innerHTML = rows.map(fotkaHtml).join('');
      })
      .catch(function () { chyba(el, 'Fotky'); });
  }

  function fotkaHtml(f) {
    return '<figure class="gallery-item">' +
      '<img src="' + fotoUrl(f.cesta) + '" alt="' + esc(f.popisek || 'Fotka TTC Bystřice') + '" loading="lazy">' +
      (f.popisek ? '<figcaption>' + esc(f.popisek) + '</figcaption>' : '') +
      '</figure>';
  }

  function pocetFotek(n) {
    return n + (n === 1 ? ' fotka' : n >= 2 && n <= 4 ? ' fotky' : ' fotek');
  }

  // Stránka Galerie: bez parametru přehled alb (po letech), s ?rok=2026 fotky daného roku.
  function nactiAlba(el) {
    var rok = parseInt(new URLSearchParams(location.search).get('rok'), 10);
    api('galerie?select=cesta,popisek,rok&order=vytvoreno.desc')
      .then(function (rows) {
        if (!rows.length) {
          el.innerHTML = '<div class="gallery-empty"><strong>Galerie zatím čeká na první fotky</strong>' +
            'Fotky z tréninků a zápasů sem brzy přidáme.</div>';
          return;
        }
        var alba = {};
        rows.forEach(function (f) { (alba[f.rok] = alba[f.rok] || []).push(f); });
        var roky = Object.keys(alba).map(Number).sort(function (a, b) { return b - a; });

        if (rok && alba[rok]) {
          document.title = 'Fotogalerie ' + rok + ' — TTC Bystřice';
          var drobek = document.querySelector('.breadcrumb');
          if (drobek) drobek.innerHTML = '<a href="index.html">Domů</a> / <a href="galerie.html">Fotogalerie</a> / ' + rok;
          var jine = roky.filter(function (r) { return r !== rok; }).map(function (r) {
            return '<a href="galerie.html?rok=' + r + '" class="album-nav__rok">' + r + '</a>';
          }).join('');
          el.innerHTML =
            '<div class="album-head">' +
              '<div><h2>Album ' + rok + '</h2><span class="album-head__pocet">' + pocetFotek(alba[rok].length) + '</span></div>' +
              '<div class="album-nav"><a href="galerie.html" class="btn btn--sm btn--ghost">← Všechna alba</a>' + jine + '</div>' +
            '</div>' +
            '<div class="gallery-grid">' + alba[rok].map(fotkaHtml).join('') + '</div>';
          return;
        }

        el.innerHTML = '<div class="album-grid">' + roky.map(function (r) {
          var titulni = alba[r][0];
          return '<a href="galerie.html?rok=' + r + '" class="album-card">' +
            '<div class="album-card__img"><img src="' + fotoUrl(titulni.cesta) + '" alt="" loading="lazy"></div>' +
            '<div class="album-card__body"><span class="album-card__rok">' + r + '</span>' +
            '<span class="album-card__pocet">' + pocetFotek(alba[r].length) + '</span></div>' +
            '</a>';
        }).join('') + '</div>';
      })
      .catch(function () { chyba(el, 'Fotky'); });
  }

  document.querySelectorAll('[data-obsah="aktuality"]').forEach(nactiAktuality);
  document.querySelectorAll('[data-obsah="galerie-alba"]').forEach(nactiAlba);
  document.querySelectorAll('[data-obsah="galerie"]').forEach(nactiGalerii);
})();
