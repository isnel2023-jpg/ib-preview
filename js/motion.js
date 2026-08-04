/* ==========================================================================
   THE INNER BLUEPRINT : motion engine
   --------------------------------------------------------------------------
   Regla numero uno de este archivo: NADA de lo que hay aqui puede dejar
   contenido invisible. Una animacion perdida es un detalle; un titular que no
   aparece es una pagina rota. Por eso:

     - .has-motion solo se pone si GSAP esta vivo de verdad.
     - toda ENTRADA se apunta en PENDING y un barrido comprueba que nada se
       quede invisible con la seccion ya en pantalla. Si algo revienta, se
       desmonta el motor entero y la pagina vuelve a su version estatica.
     - sin JavaScript, sin GSAP o con prefers-reduced-motion, la pagina es
       exactamente la de antes: texto visible, imagenes quietas, listas
       apiladas.

   La coreografia esta escrita movil primero. El bloque fijado del metodo es
   el momento firma: en el telefono las tres fases dejan de ser tres tarjetas
   apiladas y pasan a ser una escena que avanza con el dedo.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ok = !!(window.gsap && window.ScrollTrigger) && !reduced;

  // main.js lee esta bandera para no revelar dos veces los mismos titulares
  window.__ibMotion = ok;
  if (!ok) return;

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  var root = document.documentElement;

  /* PENDING solo contiene ENTRADAS: cosas que se ocultan una vez y que tienen
     que acabar visibles sin excepcion. Lo que se mueve atado al scroll (el
     parallax, la escena fijada) NO va aqui: ahi estar en opacidad cero con la
     seccion en pantalla es el comportamiento correcto, y forzarlo a visible
     seria romper la coreografia, no rescatarla. */
  var PENDING = [];
  function guard(el) { if (PENDING.indexOf(el) < 0) PENDING.push(el); return el; }

  /* Barrido de seguridad, no temporizador ciego.
     Un temporizador que a los N segundos lo enciende todo destruiria la
     entrada escalonada de cuanto queda por debajo del pliegue. Este mira solo
     lo que YA deberia haber entrado: esta dentro de la pantalla y sigue
     invisible. Tres barridos seguidos en ese estado significan que su
     disparador no va a llegar nunca, y entonces se fuerza.
     Es la misma red que ya salvo los titulares en main.js, afinada. */
  function sweep() {
    for (var i = 0; i < PENDING.length; i++) {
      var el = PENDING[i];
      if (!el || !el.isConnected) continue;
      var r = el.getBoundingClientRect();
      var hidden = parseFloat(getComputedStyle(el).opacity) < 0.95;
      if (!hidden) { el.__strikes = 0; continue; }

      /* Ya quedo POR ENCIMA de la pantalla y sigue oculto. Eso no admite
         discusion: el lector paso por delante y no lo vio. Se enciende ya, sin
         contar avisos. Este es el caso que fallaba con saltos de scroll
         grandes, cuando un elemento entra y sale del rango en el mismo tick. */
      if (r.bottom < 0) {
        gsap.set(el, { opacity: 1, y: 0, yPercent: 0, clearProps: 'clipPath' });
        continue;
      }
      if (r.top < window.innerHeight - 40 && r.bottom > 0) {
        el.__strikes = (el.__strikes || 0) + 1;
        if (el.__strikes >= 3) {
          gsap.set(el, { opacity: 1, y: 0, yPercent: 0, clearProps: 'clipPath' });
          el.__strikes = 0;
        }
      } else {
        el.__strikes = 0;
      }
    }
  }
  /* El barrido tiene que correr TAMBIEN con el scroll, no solo cada 850 ms:
     un dedo rapido en un telefono recorre media pagina entre dos latidos del
     temporizador, y justo esos son los elementos que se saltan su disparador. */
  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; sweep(); });
  }, { passive: true });
  setInterval(sweep, 850);

  /* Desmontaje total: deja el sitio exactamente como si este archivo no
     existiera. Es la salida de emergencia si algo revienta. */
  function teardown() {
    try { ScrollTrigger.getAll().forEach(function (t) { t.kill(true); }); } catch (e) {}
    root.classList.remove('has-motion');
    gsap.set(PENDING, { clearProps: 'all' });
    // lo que no esta en PENDING porque lo conduce el scroll: la escena fijada
    // y el motivo. Al quitar .has-motion vuelven sus animaciones CSS, asi que
    // hay que borrarles tambien lo que dejamos escrito en linea.
    ['.pinstage__track > li', '.bp-motif', '.bp-motif *'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        gsap.set(el, { clearProps: 'all' });
      });
    });
  }

  root.classList.add('has-motion');

  /* ---------------------------------------------------------------- lineas --
     Corta un titular en lineas y las mete cada una en su propia caja con
     overflow oculto, para que suban desde detras de una mascara en vez de
     limitarse a aparecer. Es la diferencia entre "hay una animacion" y "esto
     esta compuesto".

     SplitText se re-corta solo al cambiar el ancho (autoSplit), que es justo
     lo que hace falta en un telefono cuando gira. */
  function lines(el, vars) {
    if (!window.SplitText) {
      return gsap.from(guard(el), Object.assign({ opacity: 0, y: 20, duration: 0.7 }, vars || {}));
    }
    var tween = null;
    SplitText.create(el, {
      type: 'lines',
      linesClass: 'split-line',
      mask: 'lines',
      autoSplit: true,
      onSplit: function (self) {
        guard(el);
        tween = gsap.from(self.lines, Object.assign({
          yPercent: 115,
          opacity: 0,
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.08
        }, vars || {}));
        return tween;
      }
    });
    return tween;
  }

  /* ------------------------------------------------------------------ hero --
     Entra sin esperar al scroll: es lo primero que se ve y tiene que estar
     compuesto desde el primer fotograma. */
  function hero() {
    var h1 = document.querySelector('.hero h1, .page-hero h1');
    if (!h1) return;
    var scope = h1.closest('.hero, .page-hero');
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    var tag = scope.querySelector('.tagline, .page-hero .annot');
    if (tag) tl.from(guard(tag), { opacity: 0, x: -14, duration: 0.5 }, 0);

    lines(h1, { delay: 0.12 });

    var lede = scope.querySelector('.lede');
    if (lede) tl.from(guard(lede), { opacity: 0, y: 16, duration: 0.7 }, 0.45);

    var acts = gsap.utils.toArray(scope.querySelectorAll('.hero-actions .btn'));
    if (acts.length) {
      acts.forEach(guard);
      tl.from(acts, { opacity: 0, y: 14, duration: 0.55, stagger: 0.08 }, 0.62);
    }

    var cue = scope.querySelector('.scroll-cue');
    if (cue) tl.from(guard(cue), { opacity: 0, duration: 0.6 }, 0.9);

    /* El motivo: trazado y profundidad desde el mismo sitio.
       El trazado con CSS tardaba 3,5 segundos en cerrarse porque los retardos
       estaban pensados para el escritorio, donde el dibujo va al lado del
       texto. En un telefono va DEBAJO del pliegue: cuando el lector llega, el
       corazon todavia se esta dibujando y se ve roto. Aqui se cierra en 1,6 s
       y arranca cuando el motivo asoma, no al cargar. */
    var motif = document.querySelector('.bp-motif');
    if (motif) {
      var guideEls = motif.querySelectorAll('.guide');
      var drawEls = motif.querySelectorAll('.draw');
      var capEls = motif.querySelectorAll('.cap');
      gsap.set(guideEls, { strokeDashoffset: 100 });
      gsap.set(drawEls, { strokeDashoffset: 100 });
      gsap.set(capEls, { opacity: 0 });
      gsap.timeline({ scrollTrigger: { trigger: motif, start: 'top 92%', once: true } })
        .to(guideEls, { strokeDashoffset: 0, duration: 0.85, stagger: 0.07, ease: 'none' }, 0)
        .to(drawEls, { strokeDashoffset: 0, duration: 0.5, stagger: 0.05, ease: 'power1.out' }, 0.28)
        .to(capEls, { opacity: 1, duration: 0.22 }, '-=0.15');
    }
    if (motif) {
      /* Solo desplazamiento y opacidad, nunca escala. La regla de marca dice
         que el simbolo no se modifica ni se estira: una escala conserva la
         proporcion y seria defendible, pero no hay ninguna razon para dar esa
         discusion a cambio de un efecto que el desplazamiento ya da. */
      gsap.to(motif, {
        yPercent: -16, opacity: 0.35, ease: 'none',
        scrollTrigger: { trigger: scope, start: 'top top', end: 'bottom top', scrub: 0.6 }
      });
      var guides = motif.querySelector('.bp-guides');
      if (guides) {
        gsap.to(guides, {
          yPercent: 8, opacity: 0.2, ease: 'none',
          scrollTrigger: { trigger: scope, start: 'top top', end: 'bottom top', scrub: 0.6 }
        });
      }
    }
  }

  /* ------------------------------------------------------- titulares de seccion --
     Cada H2 del cuerpo entra por lineas enmascaradas. Una sola vez, hacia
     adelante: un titular que se vuelve a esconder al subir es un titular que
     el lector ya leyo y que ahora parpadea. */
  function headlines() {
    gsap.utils.toArray('.section h2, .cta-band h2').forEach(function (h) {
      if (h.closest('.hero, .page-hero')) return;
      ScrollTrigger.create({
        trigger: h,
        start: 'top 88%',
        once: true,
        onEnter: function () { lines(h); }
      });
    });
  }

  /* -------------------------------------------------------------- parallax --
     La imagen es mas alta que su marco y recorre esa diferencia mientras pasa
     por delante. Solo transformadas: no provoca recalculo de diseno, que es lo
     que hunde los fotogramas en un telefono. */
  function parallax() {
    gsap.utils.toArray('.media img, .showcase img, .photo-bg img').forEach(function (img) {
      var frame = img.parentElement;
      frame.classList.add('px-frame');
      gsap.set(img, { scale: 1.2, transformOrigin: '50% 50%' });
      gsap.fromTo(img, { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
      });
    });
  }

  /* -------------------------------------------------------------- entradas --
     Sustituye al revelado uniforme de main.js en los bloques en rejilla: en
     vez de que cada tarjeta suba sola cuando le toca, entran juntas y
     escalonadas, que es como se lee una fila y no una lista. */
  function batches() {
    var sets = ['.cta-grid > *', '.cred-cell', '.coach-card', '.book-card',
      '.path-flow li', '.faq-list details', '.founder-card', '.form .field'];
    sets.forEach(function (sel) {
      var els = gsap.utils.toArray(sel);
      if (!els.length) return;
      els.forEach(guard);
      gsap.set(els, { opacity: 0, y: 26 });

      var show = function (batch) {
        var todo = batch.filter(function (el) { return !el.__shown; });
        if (!todo.length) return;
        todo.forEach(function (el) { el.__shown = 1; });
        gsap.to(todo, {
          opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
          stagger: 0.09, overwrite: true
        });
      };

      /* Sin once: true. Con once el disparador se mata al pasar el final, y si
         un salto de scroll grande cruza el principio y el final en el mismo
         tick, el lote se muere antes de que se entregue su callback y la
         tarjeta se queda invisible para siempre. La idempotencia la da
         __shown, no el plugin. */
      ScrollTrigger.batch(els, { start: 'top 92%', onEnter: show, onEnterBack: show });

      // lo que ya nace por encima del pliegue se muestra sin esperar a nada
      show(els.filter(function (el) {
        return el.getBoundingClientRect().top < window.innerHeight * 0.92;
      }));
    });
  }

  /* ------------------------------------------------------------ contadores --
     El numero final vive en el HTML. Si esto no corre, el numero ya esta
     escrito y se lee igual. */
  function counters() {
    gsap.utils.toArray('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-count-suffix') || '';
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () {
          gsap.to(o, {
            v: end, duration: 1.4, ease: 'power2.out',
            onUpdate: function () { el.textContent = Math.round(o.v) + suffix; }
          });
        }
      });
    });
  }

  /* ------------------------------------------------- lineas de cota que se trazan -- */
  function dimLines() {
    gsap.utils.toArray('.dim-line').forEach(function (d) {
      guard(d);
      gsap.set(d, { opacity: 0 });
      var show = function () {
        if (d.__shown) return;
        d.__shown = 1;
        gsap.to(d, { opacity: 1, duration: 0.6, overwrite: true });
      };
      ScrollTrigger.create({ trigger: d, start: 'top 95%', onEnter: show, onEnterBack: show });
      if (d.getBoundingClientRect().top < window.innerHeight * 0.95) show();
    });
  }

  /* ------------------------------------------------------- escena fijada ----
     El momento firma. La seccion se clava en pantalla y las tres fases se
     relevan mientras el dedo avanza, con el carril de progreso llenandose.

     Cuidado con las medidas: los hijos pasan a posicion absoluta, asi que la
     pista pierde su altura. Se le fija a mano la del hijo mas alto ANTES de
     absolutizar nada, y se vuelve a medir en cada refresco (girar el telefono,
     cargar una fuente). */
  function pinstage() {
    var stage = document.querySelector('[data-pinstage]');
    if (!stage) return;
    var track = stage.querySelector('.pinstage__track');
    var steps = track ? gsap.utils.toArray(track.children) : [];
    var bars = gsap.utils.toArray('.pinstage__rail span');
    if (steps.length < 2) return;

    var measure = function () {
      gsap.set(track, { minHeight: 0 });
      var tallest = steps.reduce(function (m, s) {
        return Math.max(m, s.getBoundingClientRect().height);
      }, 0);
      gsap.set(track, { minHeight: Math.ceil(tallest) });
    };
    measure();
    ScrollTrigger.addEventListener('refreshInit', measure);

    gsap.set(steps.slice(1), { opacity: 0, y: 34 });

    var tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: stage,
        start: 'top top+=76',
        end: '+=' + (steps.length * 62) + '%',
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 0.55,
        invalidateOnRefresh: true
      }
    });

    steps.forEach(function (step, i) {
      if (i === 0) return;
      var prev = steps[i - 1];
      tl.to(prev, { opacity: 0, y: -30, duration: 0.5 }, i - 0.5)
        .to(step, { opacity: 1, y: 0, duration: 0.5 }, i - 0.25);
    });

    // el carril: cada tramo se llena cuando su fase esta en pantalla
    ScrollTrigger.create({
      trigger: stage,
      start: 'top top+=76',
      end: '+=' + (steps.length * 62) + '%',
      onUpdate: function (self) {
        var p = self.progress * (steps.length - 1);
        bars.forEach(function (b, i) {
          var w = gsap.utils.clamp(0, 1, p - (i - 1));
          b.style.setProperty('--w', (i === 0 ? 1 : w) * 100 + '%');
        });
      }
    });
  }

  /* -------------------------------------------------------------- thumbbar --
     Las dos puertas del negocio siempre a un pulgar. Se inyecta desde aqui a
     proposito: asi las 8 paginas no pueden desincronizarse entre si, que es
     exactamente el fallo que ya nos costo un indice duplicado. */
  function thumbbar() {
    if (window.innerWidth >= 768) return;
    var here = location.pathname.split('/').pop() || 'index.html';
    var bar = document.createElement('nav');
    bar.className = 'thumbbar';
    bar.setAttribute('aria-label', 'Quick actions');
    bar.innerHTML =
      '<a class="is-primary" href="find-a-coach.html">Find a Coach</a>' +
      '<a href="become-a-coach.html">Become a Coach</a>';
    Array.prototype.forEach.call(bar.querySelectorAll('a'), function (a) {
      if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });
    document.body.appendChild(bar);
    ScrollTrigger.create({
      start: 'top -=520',
      onToggle: function (self) { bar.classList.toggle('is-up', self.isActive); }
    });
  }

  function boot() {
    try {
      hero();
      headlines();
      parallax();
      batches();
      counters();
      dimLines();
      pinstage();
      thumbbar();
      ScrollTrigger.refresh();
    } catch (e) {
      // Si algo revienta a mitad, lo peor posible es dejar media pagina en
      // opacidad cero. Se desmonta todo y se devuelve el sitio a su version
      // estatica, que funciona.
      if (window.console) console.error('motion engine off:', e);
      teardown();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // las fuentes cambian la altura de cada linea: sin esto los disparadores
  // quedan calculados sobre una pagina que ya no existe
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
