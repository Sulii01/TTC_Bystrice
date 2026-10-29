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

  function fotoUrl(cesta) {
    return cfg.url + '/storage/v1/object/public/' + cfg.bucket + '/' + encodeURIComponent(cesta);
  }

  function chyba(el, co) {
    el.innerHTML = '<div class="gallery-empty"><strong>' + co + ' se teď nepodařilo načíst</strong>' +
      'Zkuste prosím stránku za chvíli obnovit.</div>';
  }

  function nactiAktuality(el) {
    var limit = parseInt(el.getAttribute('data-limit') || '6', 10);
    api('aktuality?select=nadpis,text,stitek,datum_text&order=pripnuto.desc,vytvoreno.desc&limit=' + limit)
      .then(function (rows) {
        if (!rows.length) {
          el.innerHTML = '<div class="gallery-empty"><strong>Zatím žádné aktuality</strong>Brzy se tu objeví novinky z klubu.</div>';
          return;
        }
        el.innerHTML = rows.map(function (a) {
          return '<article class="news-card">' +
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
        el.innerHTML = rows.map(function (f) {
          return '<figure class="gallery-item">' +
            '<img src="' + fotoUrl(f.cesta) + '" alt="' + esc(f.popisek || 'Fotka TTC Bystřice') + '" loading="lazy">' +
            (f.popisek ? '<figcaption>' + esc(f.popisek) + '</figcaption>' : '') +
            '</figure>';
        }).join('');
      })
      .catch(function () { chyba(el, 'Fotky'); });
  }

  document.querySelectorAll('[data-obsah="aktuality"]').forEach(nactiAktuality);
  document.querySelectorAll('[data-obsah="galerie"]').forEach(nactiGalerii);
})();
