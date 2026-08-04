// The Inner Blueprint: interaction engine
(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');

  // ---- mobile navigation ----
  if (toggle && header) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    header.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && header.classList.contains('nav-open')) {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---- the program panel: works with mouse, keyboard and touch ----
  var trigger = document.querySelector('.nav-trigger');
  var mega = trigger && document.getElementById(trigger.getAttribute('aria-controls'));
  if (trigger && mega) {
    var wide = window.matchMedia('(min-width: 60rem)');

    var setOpen = function (open) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { mega.removeAttribute('hidden'); } else { mega.setAttribute('hidden', ''); }
    };
    var isOpen = function () { return trigger.getAttribute('aria-expanded') === 'true'; };

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(!isOpen());
    });

    // Solo clic, a proposito. Abrir al pasar el raton y ademas alternar con el
    // clic se pelean entre si: el raton abre el panel y el clic lo cierra en el
    // mismo gesto. El clic se comporta igual en escritorio y en tactil.
    var parent = trigger.parentElement;

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { setOpen(false); trigger.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !parent.contains(e.target)) setOpen(false);
    });
    // al salir del ultimo enlace con el tabulador, se cierra
    mega.addEventListener('focusout', function (e) {
      if (wide.matches && !parent.contains(e.relatedTarget)) setOpen(false);
    });
    // si cambia el ancho, el panel vuelve a su estado cerrado y coherente
    wide.addEventListener('change', function () { setOpen(false); });
  }

  // ---- section index: marca en que seccion esta el lector ----
  var pi = document.querySelector('.page-index');
  if (pi && 'IntersectionObserver' in window) {
    var piLinks = {};
    pi.querySelectorAll('a[href^="#"]').forEach(function (a) {
      piLinks[a.getAttribute('href').slice(1)] = a;
    });
    var watched = Object.keys(piLinks)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (watched.length) {
      var piObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var a = piLinks[en.target.id];
          if (a) a.classList.toggle('is-here', en.isIntersecting);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      watched.forEach(function (s) { piObs.observe(s); });
    }
  }

  // ---- scroll progress bar (gold dimension line) ----
  var sp = document.createElement('div');
  sp.className = 'scroll-progress';
  sp.innerHTML = '<span class="sp-bar"></span>';
  document.body.appendChild(sp);
  var bar = sp.firstChild;

  // ---- scroll engine: progress + parallax + smart header ----
  var lastY = 0;
  var ticking = false;

  function update() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    document.documentElement.style.setProperty('--scrolly', y);
    if (header && !header.classList.contains('nav-open')) {
      if (y > 160 && y > lastY) {
        header.classList.add('header-hidden');
      } else {
        header.classList.remove('header-hidden');
      }
    }
    lastY = y;
    if (window.__ibSweep) window.__ibSweep();
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();

  // ---- scroll reveals with stagger ----
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && 'IntersectionObserver' in window) {
    var selector = [
      '.section h2', '.section .lede', '.panel', '.step-list li',
      '.cta-card', '.coach-card', '.book-card', '.path-flow li',
      '.faq-list details', '.cred-cell', '.founder-card', '.dim-line',
      '.podcast-row', '.form .field', '.stack-2 > p',
      '.feature-media', '.showcase', '.founder-card'
    ].join(', ');
    var targets = document.querySelectorAll(selector);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    // threshold 0 y un margen generoso: con umbral 0.15 y sin margen, un
    // elemento que entra y sale del viewport dentro del mismo fotograma (un
    // deslizamiento rapido en movil, o un salto por ancla) nunca se reporta y
    // el texto se queda invisible. Esto lo marca mucho antes de que llegue.
    }, { threshold: 0, rootMargin: '300px 0px 300px 0px' });

    targets.forEach(function (el) {
      el.classList.add('reveal');
      var idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = Math.min(idx * 80, 320) + 'ms';
      io.observe(el);
    });

    // Safety net. A reveal that never fires leaves a heading invisible, which
    // is far worse than losing the animation. Anything that is already inside
    // or above the viewport gets shown no matter what the observer did.
    // Red de seguridad. Un revelado que no dispara deja un titular invisible,
    // que es mucho peor que perder la animacion. Cualquier cosa que ya este
    // dentro o por encima del viewport se muestra pase lo que pase.
    var sweep = function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight + 100) {
          el.style.transitionDelay = '0ms';
          el.classList.add('in');
          io.unobserve(el);
        }
      });
    };
    window.__ibSweep = sweep;          // el bucle de scroll la llama en cada fotograma
    window.addEventListener('load', function () { setTimeout(sweep, 400); });
    setInterval(sweep, 1000);
  }

  // ---- pointer tracked highlight on panels ----
  if (!reduced && window.matchMedia('(hover: hover)').matches) {
    var lit = document.querySelectorAll(
      '.cta-card, .panel, .book-card, .founder-card, .step-list li, .form-aside');
    lit.forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  // ---- click to play video ----
  document.querySelectorAll('.video-facade').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = btn.getAttribute('data-yt');
      f.title = 'Inner Blueprint Podcast episodes on YouTube';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      btn.replaceWith(f);
    });
  });
})();
