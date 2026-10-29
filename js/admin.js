// TTC Bystřice — administrace aktualit a fotogalerie (Supabase).
// Kdo smí co, hlídá databáze (pravidla v supabase/schema.sql); tady se jen
// skrývají tlačítka, na která přihlášený uživatel nemá právo.
(function () {
  var cfg = window.TTC_SUPABASE;
  var $ = function (id) { return document.getElementById(id); };

  if (!window.supabase || !cfg) {
    $('nacitani').textContent = 'Administraci se nepodařilo načíst (chybí připojení k internetu?). Zkuste stránku obnovit.';
    return;
  }

  var sb = window.supabase.createClient(cfg.url, cfg.key);
  var ja = null;        // { id, email, role, jmeno }
  var aktuality = [];   // načtené aktuality (pro úpravy)
  var upravujeId = null;
  var fotky = [];       // načtené fotky (pro filtr podle alba)
  var LETOS = new Date().getFullYear();

  // výběr roku: od založení oddílu (2007) do příštího roku, nejnovější nahoře
  function rokyOptions(vybrany) {
    var html = '';
    for (var r = LETOS + 1; r >= 2007; r--) {
      html += '<option value="' + r + '"' + (r === vybrany ? ' selected' : '') + '>' + r + '</option>';
    }
    return html;
  }
  document.querySelectorAll('select[data-roky]').forEach(function (sel) { sel.innerHTML = rokyOptions(LETOS); });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function zprava(id, text, ok) {
    var el = $(id);
    el.textContent = text || '';
    el.classList.toggle('is-ok', !!ok);
  }
  function smi(autor) { return ja && (ja.role === 'admin' || autor === ja.id); }
  function dnes() {
    var d = new Date();
    return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
  }
  function fotoUrl(cesta) {
    return sb.storage.from(cfg.bucket).getPublicUrl(cesta).data.publicUrl;
  }
  function cesky(err) {
    var m = (err && (err.message || err.error_description)) || String(err);
    if (/Invalid login credentials/i.test(m)) return 'Špatný e-mail nebo heslo.';
    if (/Email not confirmed/i.test(m)) return 'E-mail není potvrzený — požádejte správce, ať u účtu zapne „Auto Confirm“.';
    if (/row-level security|permission denied|violates row-level/i.test(m)) return 'Na tuto akci nemáte oprávnění.';
    if (/Password should be at least/i.test(m)) return 'Heslo je příliš krátké.';
    if (/same as the old password|should be different/i.test(m)) return 'Nové heslo musí být jiné než současné.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu.';
    return 'Chyba: ' + m;
  }

  // ---------- přihlášení / odhlášení ----------
  function ukaz(prihlasen) {
    $('nacitani').hidden = true;
    $('prihlaseni').hidden = prihlasen;
    $('panel').hidden = !prihlasen;
  }

  function poPrihlaseni(user) {
    return sb.from('role_uzivatelu').select('role, jmeno').eq('user_id', user.id).maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        if (!res.data) {
          return sb.auth.signOut().then(function () {
            ukaz(false);
            zprava('login-msg', 'Tento účet nemá přidělenou roli. Požádejte správce webu o přístup.');
          });
        }
        ja = { id: user.id, email: user.email, role: res.data.role, jmeno: res.data.jmeno || user.email };
        $('kdo').textContent = ja.jmeno;
        $('role').textContent = ja.role === 'admin' ? 'admin' : 'editor';
        ukaz(true);
        $('akt-form').elements.datum_text.value = dnes();
        nactiAktuality();
        nactiFotky();
      });
  }

  sb.auth.getSession().then(function (res) {
    var s = res.data && res.data.session;
    if (s) poPrihlaseni(s.user).catch(function (e) { ukaz(false); zprava('login-msg', cesky(e)); });
    else ukaz(false);
  });

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    zprava('login-msg', 'Přihlašuji…', true);
    sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.heslo.value })
      .then(function (res) {
        if (res.error) throw res.error;
        f.heslo.value = '';
        zprava('login-msg', '');
        return poPrihlaseni(res.data.user);
      })
      .catch(function (err) { zprava('login-msg', cesky(err)); });
  });

  $('btn-odhlasit').addEventListener('click', function () {
    sb.auth.signOut().then(function () { ja = null; ukaz(false); });
  });

  // ---------- změna hesla ----------
  $('btn-heslo').addEventListener('click', function () { $('heslo-form').hidden = false; });
  $('heslo-zrusit').addEventListener('click', function () { $('heslo-form').reset(); $('heslo-form').hidden = true; zprava('heslo-msg', ''); });
  $('heslo-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.heslo1.value !== f.heslo2.value) return zprava('heslo-msg', 'Hesla se neshodují.');
    sb.auth.updateUser({ password: f.heslo1.value }).then(function (res) {
      if (res.error) throw res.error;
      f.reset();
      zprava('heslo-msg', 'Heslo bylo změněno.', true);
    }).catch(function (err) { zprava('heslo-msg', cesky(err)); });
  });

  // ---------- záložky ----------
  document.querySelectorAll('.admin__tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.admin__tab').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      document.querySelectorAll('.admin__tabpanel').forEach(function (p) { p.hidden = p.id !== btn.getAttribute('data-tab'); });
    });
  });

  // ---------- aktuality ----------
  function nactiAktuality() {
    sb.from('aktuality').select('*').order('pripnuto', { ascending: false }).order('vytvoreno', { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        aktuality = res.data;
        $('akt-seznam').innerHTML = aktuality.length ? aktuality.map(function (a) {
          var akce = smi(a.autor)
            ? '<button type="button" class="btn btn--sm btn--ghost" data-upravit="' + a.id + '">Upravit</button>' +
              '<button type="button" class="btn btn--sm btn--danger" data-smazat="' + a.id + '">Smazat</button>'
            : '<span class="admin__muted">jen autor / admin</span>';
          return '<div class="admin__item">' +
            '<div><span class="tag">' + esc(a.stitek) + '</span>' + (a.pripnuto ? ' <span class="tag tag--pin">Připnuto</span>' : '') +
            '<strong class="admin__item-title">' + esc(a.nadpis) + '</strong>' +
            '<span class="admin__muted">' + esc(a.datum_text || '') + '</span></div>' +
            '<div class="admin__item-actions">' + akce + '</div></div>';
        }).join('') : '<p class="admin__muted">Zatím žádné aktuality.</p>';
      })
      .catch(function (err) { $('akt-seznam').innerHTML = '<p class="admin__msg">' + esc(cesky(err)) + '</p>'; });
  }

  function resetAktForm() {
    var f = $('akt-form');
    f.reset();
    f.datum_text.value = dnes();
    upravujeId = null;
    $('akt-form-nadpis').textContent = 'Nová aktualita';
    $('akt-ulozit').textContent = 'Zveřejnit';
    $('akt-zrusit').hidden = true;
  }
  $('akt-zrusit').addEventListener('click', function () { resetAktForm(); zprava('akt-msg', ''); });

  $('akt-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var data = {
      nadpis: f.nadpis.value.trim(),
      stitek: f.stitek.value.trim() || 'Klub',
      datum_text: f.datum_text.value.trim() || null,
      text: f.text.value.trim(),
      pripnuto: f.pripnuto.checked
    };
    var dotaz = upravujeId
      ? sb.from('aktuality').update(data).eq('id', upravujeId).select()
      : sb.from('aktuality').insert(data).select();
    zprava('akt-msg', 'Ukládám…', true);
    dotaz.then(function (res) {
      if (res.error) throw res.error;
      if (!res.data || !res.data.length) throw new Error('permission denied');
      zprava('akt-msg', upravujeId ? 'Aktualita byla upravena.' : 'Aktualita je zveřejněná na webu.', true);
      resetAktForm();
      nactiAktuality();
    }).catch(function (err) { zprava('akt-msg', cesky(err)); });
  });

  $('akt-seznam').addEventListener('click', function (e) {
    var up = e.target.getAttribute('data-upravit');
    var sm = e.target.getAttribute('data-smazat');
    if (up) {
      var a = aktuality.find(function (x) { return String(x.id) === up; });
      var f = $('akt-form');
      f.nadpis.value = a.nadpis; f.stitek.value = a.stitek; f.datum_text.value = a.datum_text || '';
      f.text.value = a.text; f.pripnuto.checked = a.pripnuto;
      upravujeId = a.id;
      $('akt-form-nadpis').textContent = 'Úprava aktuality';
      $('akt-ulozit').textContent = 'Uložit změny';
      $('akt-zrusit').hidden = false;
      zprava('akt-msg', '');
      f.scrollIntoView({ behavior: 'smooth' });
    }
    if (sm) {
      var b = aktuality.find(function (x) { return String(x.id) === sm; });
      if (!confirm('Opravdu smazat aktualitu „' + b.nadpis + '“?')) return;
      sb.from('aktuality').delete().eq('id', sm).select().then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('permission denied');
        if (String(upravujeId) === sm) resetAktForm();
        nactiAktuality();
      }).catch(function (err) { alert(cesky(err)); });
    }
  });

  // ---------- fotogalerie ----------
  function nactiFotky() {
    sb.from('galerie').select('*').order('rok', { ascending: false }).order('vytvoreno', { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        fotky = res.data;
        // filtr: jen roky, ve kterých nějaké fotky jsou
        var filtr = $('foto-filtr'), zvoleny = filtr.value;
        var roky = fotky.map(function (f) { return f.rok; }).filter(function (r, i, a) { return a.indexOf(r) === i; });
        filtr.innerHTML = '<option value="">Všechna alba</option>' + roky.map(function (r) {
          var n = fotky.filter(function (f) { return f.rok === r; }).length;
          return '<option value="' + r + '"' + (String(r) === zvoleny ? ' selected' : '') + '>' + r + ' (' + n + ')</option>';
        }).join('');
        vykresliFotky();
      })
      .catch(function (err) { $('foto-seznam').innerHTML = '<p class="admin__msg">' + esc(cesky(err)) + '</p>'; });
  }

  function vykresliFotky() {
    var zvoleny = $('foto-filtr').value;
    var vyber = fotky.filter(function (f) { return !zvoleny || String(f.rok) === zvoleny; });
    if (!vyber.length) {
      $('foto-seznam').innerHTML = '<p class="admin__muted">V galerii zatím nejsou žádné fotky.</p>';
      return;
    }
    // seskupit po albech (rocích)
    var html = '', rok = null;
    vyber.forEach(function (f) {
      if (f.rok !== rok) {
        if (rok !== null) html += '</div>';
        rok = f.rok;
        html += '<h3 class="admin__album">Album ' + rok + '</h3><div class="admin__photos">';
      }
      var muze = smi(f.autor);
      html += '<div class="admin__photo" data-id="' + f.id + '" data-cesta="' + esc(f.cesta) + '">' +
        '<img src="' + fotoUrl(f.cesta) + '" alt="" loading="lazy">' +
        '<input type="text" maxlength="120" value="' + esc(f.popisek || '') + '" placeholder="Bez popisku"' + (muze ? '' : ' disabled') + '>' +
        '<select class="admin__select"' + (muze ? '' : ' disabled') + ' aria-label="Album">' + rokyOptions(f.rok) + '</select>' +
        (muze ? '<div class="admin__row"><button type="button" class="btn btn--sm btn--ghost" data-popisek>Uložit</button>' +
                '<button type="button" class="btn btn--sm btn--danger" data-smazat-foto>Smazat</button></div>' : '') +
        '</div>';
    });
    $('foto-seznam').innerHTML = html + '</div>';
  }
  $('foto-filtr').addEventListener('change', vykresliFotky);

  // zmenší fotku na max. 1600 px a převede na JPEG
  function zmensi(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('převod se nepovedl')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Soubor „' + file.name + '“ nejde otevřít jako obrázek (formát HEIC z iPhonu uložte jako JPG).'));
      };
      img.src = url;
    });
  }

  $('foto-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var soubory = Array.prototype.slice.call(f.soubory.files);
    var popisek = f.popisek.value.trim() || null;
    var rokAlba = parseInt(f.rok.value, 10);
    if (!soubory.length) return;
    $('foto-nahrat').disabled = true;
    var hotovo = 0, chyby = [];
    var d = new Date();
    var prefix = rokAlba + '/';

    soubory.reduce(function (p, file, i) {
      return p.then(function () {
        zprava('foto-msg', 'Nahrávám ' + (i + 1) + ' z ' + soubory.length + '…', true);
        var cesta = prefix + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        return zmensi(file)
          .then(function (blob) {
            return sb.storage.from(cfg.bucket).upload(cesta, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
          })
          .then(function (res) {
            if (res.error) throw res.error;
            return sb.from('galerie').insert({ cesta: cesta, popisek: popisek, rok: rokAlba });
          })
          .then(function (res) {
            if (res.error) {
              sb.storage.from(cfg.bucket).remove([cesta]);
              throw res.error;
            }
            hotovo++;
          })
          .catch(function (err) { chyby.push(cesky(err)); });
      });
    }, Promise.resolve()).then(function () {
      $('foto-nahrat').disabled = false;
      f.reset();
      f.rok.value = rokAlba;   // rok nechat vybraný pro další dávku fotek
      zprava('foto-msg', (hotovo ? 'Nahráno fotek do alba ' + rokAlba + ': ' + hotovo + '. ' : '') + chyby.join(' '), !chyby.length);
      nactiFotky();
    });
  });

  $('foto-seznam').addEventListener('click', function (e) {
    var box = e.target.closest('.admin__photo');
    if (!box) return;
    var id = box.getAttribute('data-id'), cesta = box.getAttribute('data-cesta');
    if (e.target.hasAttribute('data-popisek')) {
      var popisek = box.querySelector('input').value.trim() || null;
      var novyRok = parseInt(box.querySelector('select').value, 10);
      sb.from('galerie').update({ popisek: popisek, rok: novyRok }).eq('id', id).select().then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('permission denied');
        var f = fotky.find(function (x) { return String(x.id) === id; });
        var presun = f && f.rok !== novyRok;
        if (presun) return nactiFotky();   // fotka se přesunula do jiného alba
        e.target.textContent = 'Uloženo ✓';
        setTimeout(function () { e.target.textContent = 'Uložit'; }, 1500);
      }).catch(function (err) { alert(cesky(err)); });
    }
    if (e.target.hasAttribute('data-smazat-foto')) {
      if (!confirm('Opravdu smazat tuto fotku?')) return;
      // nejdřív soubor (pravidlo pro editory ověřuje autora podle záznamu v tabulce), pak záznam
      sb.storage.from(cfg.bucket).remove([cesta]).then(function (res) {
        if (res.error) throw res.error;
        return sb.from('galerie').delete().eq('id', id).select();
      }).then(function (res) {
        if (res.error) throw res.error;
        nactiFotky();
      }).catch(function (err) { alert(cesky(err)); });
    }
  });
})();
