// TTC Bystřice — jednoduchá interaktivita webu (mobilní menu)
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav__toggle');
  var list = document.querySelector('.nav__list');

  if (toggle && list) {
    toggle.addEventListener('click', function () {
      list.classList.toggle('open');
    });
  }

  // Rozbalení "Týmy" v mobilním menu klikem (na desktopu funguje hover z CSS)
  document.querySelectorAll('.nav__dropdown > a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (window.innerWidth <= 860) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  // Fotogalerie — kliknutí na náhled otevře fotku ve zvětšeném okně (lightbox)
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lightboxImg = lightbox.querySelector('img');
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var fullImg = item.querySelector('img');
        if (!fullImg) return;
        lightboxImg.src = fullImg.getAttribute('src');
        lightboxImg.alt = fullImg.getAttribute('alt') || '';
        lightbox.classList.add('open');
      });
    });
    lightbox.addEventListener('click', function () {
      lightbox.classList.remove('open');
      lightboxImg.src = '';
    });
  }
});
