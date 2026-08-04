// The Inner Blueprint: interaction engine
(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');

  // ---- mobile navigation ----
  if (toggle && header) {
    var LABEL = toggle.textContent.trim() || 'MENU';

    // La hoja se abre justo debajo de la cabecera. Su altura real se mide, no
    // se supone: la barra de las dos puertas cambia de alto con el ancho y una
    // constante escrita a mano deja una franja de pagina asomando por arriba.
    var setSheetTop = function () {
      var r = header.getBoundingClientRect();
      document.documentElement.style.setProperty('--header-h', (r.bottom) + 'px');
    };

    /* Las dos puertas del negocio, dentro de la hoja.
       Se clonan de la franja superior en vez de escribirse en las 8 paginas:
       una copia en el HTML de cada pagina es una copia que se puede
       desincronizar, y ese error ya nos costo un indice duplicado. */
    var menu = document.getElementById('nav-menu');
    var doorbar = document.querySelector('.doorbar');
    if (menu && doorbar && !menu.querySelector('.nav-doors')) {
      var doors = document.createElement('li');
      doors.className = 'nav-doors';
      doors.innerHTML = '<ul>' + doorbar.querySelector('ul').innerHTML + '</ul>';
      // el marcador de pagina actual ya viene en el clon; los enlaces del clon
      // no deben duplicar el papel de navegacion de los originales
      doors.querySelectorAll('a').forEach(function (a) { a.removeAttribute('aria-current'); });
      doors.firstChild.style.listStyle = 'none';
      doors.firstChild.style.display = 'grid';
      doors.firstChild.style.gap = '0.5rem';
      menu.appendChild(doors);
    }

    var setMenu = function (open) {
      if (open) setSheetTop();
      header.classList.toggle('nav-open', open);
      document.documentElement.classList.toggle('nav-locked', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'CLOSE' : LABEL;
    };

    toggle.addEventListener('click', function () {
      setMenu(!header.classList.contains('nav-open'));
    });
    header.addEventListener('click', function (e) {
      if (e.target.closest('a') && header.classList.contains('nav-open')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    // si el telefono gira o se pasa a escritorio, la hoja no puede quedarse
    // abierta bloqueando el scroll de una pagina que ya no la muestra
    window.addEventListener('resize', function () {
      if (header.classList.contains('nav-open')) {
        if (window.innerWidth >= 960) { setMenu(false); } else { setSheetTop(); }
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
    // Cuando el motor de animacion (motion.js) esta vivo, el se encarga de los
    // titulares, de las rejillas y de la escena fijada. Revelarlos dos veces
    // con dos sistemas distintos deja estilos en linea peleandose entre si.
    // Aqui se queda solo lo que motion.js no toca.
    var base = ['.panel', '.podcast-row', '.stack-2 > p', '.section .lede'];
    var extra = ['.section h2', '.step-list li', '.cta-card', '.coach-card',
      '.book-card', '.path-flow li', '.faq-list details', '.cred-cell',
      '.founder-card', '.dim-line', '.form .field', '.feature-media', '.showcase'];
    var selector = (window.__ibMotion ? base : base.concat(extra)).join(', ');
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
