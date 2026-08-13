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
        gsap.set(el, { opacity: 1, y: 0, yPercent: 0, filter: 'none', clearProps: 'clipPath' });
        continue;
      }
      if (r.top < window.innerHeight - 40 && r.bottom > 0) {
        el.__strikes = (el.__strikes || 0) + 1;
        if (el.__strikes >= 3) {
          gsap.set(el, { opacity: 1, y: 0, yPercent: 0, filter: 'none', clearProps: 'clipPath' });
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
    ['.pinstage__track > li', '.bp-motif', '.bp-motif *',
      '.hero-plate', '.hero-atmos', '.hero-grid > div',
      '.feature-media', '.showcase', '.path-stage__media',
      '.hero-depth', '.bp-stage', '.path-route', '.cta-grid > *', '.path-flow li', '.cta-card', '.coach-card',
      '[data-chapter]', '[data-method-story]', '[data-method-step]',
      '.human-scene', '.creator-portrait', '.page-index a'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        gsap.set(el, { clearProps: 'all' });
        el.classList.remove('is-chapter-active', 'is-current', 'is-in-view');
      });
    });
    document.querySelectorAll('.scroll-meter, .chapter-compass, .scroll-atmosphere').forEach(function (el) {
      el.remove();
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
      return gsap.from(guard(el), Object.assign({ opacity: 0, y: 14, duration: 0.9 }, vars || {}));
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
            yPercent: 70,
            opacity: 0,
            duration: 1,
            ease: 'power4.out',
            stagger: 0.06
        }, vars || {}));
        return tween;
      }
    });
    return tween;
  }

  /* ------------------------------------------------------- la mesa de dibujo --
     El motivo no "aparece": se TRAZA, y se traza como se traza de verdad. La
     hoja cuadriculada baja, se marca el centro, salen los ejes, el compas da
     la vuelta entera dejando la circunferencia detras, se acota el radio, y
     solo entonces empieza el oro: el circulo, el horizonte, los rayos
     disparados hacia fuera desde el borde, el tallo, el corazon cerrando sobre
     los centros de sus dos lobulos. Al final el cabezal del plotter pasa por
     encima y el andamiaje se RETIRA hacia el centro, que es el gesto que
     convierte todo lo anterior en una pieza terminada.

     Regla de marca, por si alguien la busca aqui: el simbolo no se toca. Nada
     de lo que se anade es dorado, nada escala el simbolo y nada lo redibuja.
     Todo el espectaculo es andamiaje azul de plano alrededor de una geometria
     que sale intacta del vector maestro. */
  function buildStage(motif) {
    var q = function (sel) { return gsap.utils.toArray(motif.querySelectorAll(sel)); };
    var vb = motif.viewBox.baseVal;
    var cross = motif.querySelector('.g-cross');
    var arm = motif.querySelector('.g-compass');
    var gcirc = motif.querySelector('.g-circle');
    var axes = q('.g-axis');
    var rays = q('[data-part="ray"]');
    var order = ['circle', 'chord', 'stem'];
    var pick = function (p) { return q('[data-part="' + p + '"]'); };

    // el centro real, leido de la marca de centro: no se supone
    var cc = motif.querySelector('.g-cross circle');
    var CX = cc ? +cc.getAttribute('cx') : vb.width / 2;
    var CY = cc ? +cc.getAttribute('cy') : vb.height / 2;
    var ORIGIN = CX + ' ' + CY;

    // estado inicial. Lo que ya nace oculto por CSS (.has-motion) no se toca
    // aqui: tocarlo dos veces es como no fijarlo ninguna.
    /* El patron es "100 200" y no "100" por una razon concreta: con "100" el
       guion y el hueco miden lo mismo, el patron se repite cada 200 y en
       desplazamiento 100 queda un guion de longitud CERO justo sobre el final
       del trazado. Con remate redondo, un guion de longitud cero se pinta como
       un PUNTO del grosor completo. Eso son los dos puntos dorados sueltos que
       se veian desde el primer fotograma, antes de que empezara nada.
       Con hueco de 200 no hay ningun limite del patron dentro del trazado. */
    gsap.set(q('.guide'), { strokeDasharray: '120 240', strokeDashoffset: 120 });
    gsap.set(q('.draw'), { strokeDasharray: '120 240', strokeDashoffset: 120 });
    gsap.set(q('.cap'), { opacity: 0 });
    gsap.set(cross, { scale: 0, svgOrigin: ORIGIN, opacity: 1 });
    gsap.set(arm, { rotation: 0, svgOrigin: ORIGIN, opacity: 0 });
    gsap.set(q('.pg'), { opacity: 0 });
    gsap.set(motif.querySelector('.pg-edge'), { opacity: 0 });

    var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    var paper = motif.querySelector('.bp-paper');
    var guides = motif.querySelector('.bp-guides');

    /* RITMO. La primera version duraba 4,65 s y el comentario fue "va muy
       rapido y no se aprecia nada". Tenia razon: cada fase se solapaba con la
       siguiente y el ojo no llegaba a registrar ninguna. Ahora cada beat tiene
       su sitio, hay una pausa despues de la construccion antes de que entre el
       oro, y el trazado dorado va casi al doble de lento. Se ve lo que pasa.

       Y al terminar no queda NADA: ni ejes, ni circunferencia, ni cruz. El
       estado en reposo es la marca limpia sobre el navy, igual que el estatico. */
    tl
    // 1. la hoja de papel entra desde el centro hacia fuera
      .to(paper, { opacity: 1, duration: 0.55 }, 0)
      .to(guides, { opacity: 1, duration: 0.3 }, 0.05)
      .fromTo(q('.pg'), { opacity: 0 },
        { opacity: 1, duration: 0.5, stagger: { each: 0.03, from: 'center' } }, 0)
      .fromTo(motif.querySelector('.pg-edge'), { opacity: 0 },
        { opacity: 1, duration: 0.5 }, 0.1)

    // 2. centro y ejes
      .to(cross, { opacity: 1, duration: 0.2 }, 0.45)
      .to(cross, { scale: 1, duration: 0.5, ease: 'back.out(2.6)' }, 0.45)
      .to(axes, { strokeDashoffset: 10, duration: 0.8, stagger: 0.12 }, 0.65)

    // 3. el compas da la vuelta entera y deja la circunferencia detras. Brazo y
    //    trazo comparten duracion y ease none: si no van clavados, la punta se
    //    despega de la linea y se ve el truco.
      .to(arm, { opacity: 1, duration: 0.2 }, 1.2)
      .to(arm, { rotation: 360, duration: 1.5, ease: 'none' }, 1.3)
      .to(gcirc, { strokeDashoffset: 10, duration: 1.5, ease: 'none' }, 1.3)
      .to(arm, { opacity: 0, duration: 0.3 }, 2.85)

    // 4. la cota del radio, y una pausa. La pausa es parte del diseno: sin ella
    //    el oro pisa a la construccion y no se lee ninguna de las dos.
      .to(motif.querySelector('.g-dim'), { opacity: 1, duration: 0.45 }, 2.35)

    // 5. el oro, en orden de construccion y sin prisa
      .to(pick('circle'), { strokeDashoffset: 10, duration: 0.95, ease: 'power1.inOut' }, 2.95)
      .to(pick('chord'), { strokeDashoffset: 10, duration: 0.45 }, 3.9)
      .to(rays, { strokeDashoffset: 10, duration: 0.5, ease: 'power3.out', stagger: 0.13 }, 4.2)
      .to(pick('stem'), { strokeDashoffset: 10, duration: 0.35 }, 5.0)
      .to(motif.querySelector('.g-lobe'), { opacity: 1, duration: 0.35 }, 5.1)
      .to(pick('heart'), { strokeDashoffset: 10, duration: 0.9, ease: 'power1.inOut' }, 5.25)
      .to(pick('tick'), { strokeDashoffset: 10, duration: 0.35, stagger: 0.1 }, 5.95)
      .to(q('.cap'), { opacity: 1, duration: 0.2 }, 6.25)

    // 6. el cabezal del plotter repasa la pieza terminada
      .fromTo(motif.querySelector('.bp-scan'), { opacity: 0, y: 0 },
        { opacity: 1, duration: 0.18 }, 6.45)
      .to(motif.querySelector('.bp-scan'), { y: vb.height + 24, duration: 0.8, ease: 'none' }, 6.45)
      .to(motif.querySelector('.bp-scan'), { opacity: 0, duration: 0.22 }, 7.1)

    // 7. se retira el andamiaje ENTERO. No queda ni una linea auxiliar: lo que
    //    se queda en pantalla es exactamente la marca aprobada.
      .to([paper, guides], { opacity: 0, duration: 0.7 }, 7.05)

      /* El posado. Cuando el andamiaje se retira, el simbolo se asienta un poco
         mas pequeno encima del video en vez de quedarse ocupando el mismo hueco
         gigante que necesitaba mientras se dibujaba. Es una ESCALA UNIFORME:
         la regla del cliente prohibe modificar, estirar, recolorear o redibujar
         el logo, y usarlo a otro tamano no es ninguna de las cuatro cosas. La
         quinta puerta lo comprueba: mide la proporcion (que no este estirado),
         el oro exacto (que no este recoloreado) y la silueta normalizada (que
         no este redibujado). */
      .to(motif, { scale: 0.78, duration: 1.2, ease: 'power2.inOut' }, 7.15);

    // asa para la verificacion: permite recorrer la secuencia por progreso en
    // vez de por reloj. Cronometrar capturas de pantalla mide el tiempo que
    // tarda la captura, no el que tarda la animacion.
    window.__ibStage = tl;

    ScrollTrigger.create({
      trigger: motif, start: 'top 92%', once: true,
      onEnter: function () {
        tl.play(0);
        /* RED DE SEGURIDAD DEL FINAL. GSAP avanza con requestAnimationFrame,
           y hay navegadores que lo estrangulan o lo pausan a mitad (Safari en
           modo de bajo consumo, una pestana que pasa a segundo plano, una
           captura de pantalla). Si eso pasa dentro de los 8 segundos de la
           secuencia, el trazado se queda congelado A MEDIAS: simbolo a medio
           dibujar o, peor, las guias de construccion sin retirar encima del
           logo terminado. Paso en produccion y se vio.

           setTimeout no depende del rAF: si al cumplirse el plazo (duracion
           mas margen) la secuencia no ha llegado al final, se la lleva al
           final de un salto. El estado queda EXACTAMENTE el del ultimo
           fotograma: guias fuera, oro completo, posado hecho. */
        setTimeout(function () {
          try {
            if (tl.progress() < 1) { tl.progress(1).pause(); }
          } catch (e) {}
        }, (tl.duration() + 2.5) * 1000);
      }
    });

    /* Tocarlo lo repite. No lleva rotulo a proposito: quien lo descubre siente
       que ha encontrado algo, y quien no, no pierde nada. El SVG es
       aria-hidden, asi que esto no es un control que haya que anunciar. */
    var stage = motif.closest('.bp-stage') || motif;
    stage.style.cursor = 'pointer';
    stage.addEventListener('click', function () {
      if (tl.progress() > 0.98 || tl.progress() === 0) tl.play(0);
    });
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
    if (tag) tl.from(guard(tag), { opacity: 0, x: -18, duration: 0.4 }, 0);

    lines(h1, { delay: 0.06, duration: 0.75, stagger: 0.045 });

    var lede = scope.querySelector('.lede');
    if (lede) tl.from(guard(lede), { opacity: 0, y: 20, duration: 0.5 }, 0.3);

    var acts = gsap.utils.toArray(scope.querySelectorAll('.hero-actions .btn'));
    if (acts.length) {
      acts.forEach(guard);
      /* Los botones ya no aparecen: entran de golpe y rebotan. Es lo
         primero que el visitante tiene que querer tocar. */
      tl.from(acts, { opacity: 0, y: 26, scale: 0.88, duration: 0.5,
                      ease: 'back.out(2)', stagger: 0.07 }, 0.42);
    }

    var cue = scope.querySelector('.scroll-cue');
    if (cue) tl.from(guard(cue), { opacity: 0, duration: 0.45 }, 0.66);

    /* El motivo: trazado y profundidad desde el mismo sitio.
       El trazado con CSS tardaba 3,5 segundos en cerrarse porque los retardos
       estaban pensados para el escritorio, donde el dibujo va al lado del
       texto. En un telefono va DEBAJO del pliegue: cuando el lector llega, el
       corazon todavia se esta dibujando y se ve roto. Aqui se cierra en 1,6 s
       y arranca cuando el motivo asoma, no al cargar. */
    /* El video del hero. Se queda dormido hasta que hay material de verdad:
       sin <source> no se descarga nada y la placa se ve navy limpio. Tampoco se
       carga si el usuario pidio ahorrar datos. Y se pausa cuando el hero sale
       de pantalla, que si no sigue decodificando fotogramas que nadie ve. */
    var vid = scope.querySelector('.hero-video');
    var ahorra = navigator.connection && navigator.connection.saveData;
    if (vid && vid.querySelector('source') && !ahorra) {
      vid.preload = 'auto';
      vid.load();
      vid.addEventListener('canplay', function () {
        vid.classList.add('is-live');
        var pr = vid.play();
        if (pr && pr.catch) { pr.catch(function () {}); }
      }, { once: true });
      ScrollTrigger.create({
        trigger: scope, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) {
          if (self.isActive) { var q = vid.play(); if (q && q.catch) { q.catch(function () {}); } }
          else { vid.pause(); }
        }
      });
    }

    var motif = document.querySelector('.bp-motif');
    if (motif) { buildStage(motif); }
    if (motif) {
      /* Solo desplazamiento, ni escala ni atenuacion.
         La regla de marca dice oro exacto #F0B018, ni un pixel distinto. Una
         opacidad global no cambia el tono, pero SI cambia el valor de cada
         pixel del simbolo mientras dura: a mitad de scroll el oro se medía
         rgb(208,154,26). Se atenua el ANDAMIAJE, que no es la marca, y el
         simbolo solo se desplaza. La profundidad sale igual, porque la da que
         los dos planos se muevan a velocidades distintas, no la opacidad. */
      gsap.to(motif, {
        yPercent: -16, ease: 'none',
        scrollTrigger: { trigger: scope, start: 'top top', end: 'bottom top', scrub: 0.6 }
      });
      /* --------------------------------------------------- los cuatro planos --
         La profundidad la da la DIFERENCIA de velocidad entre planos, no la
         cantidad de movimiento. Por eso la placa del fondo se queda ATRAS
         (positivo: se desplaza hacia abajo mientras la pagina sube) y el texto
         y el simbolo se ADELANTAN (negativo). Separacion total 27 %, cuando
         antes habia un solo plano moviendose un 16 % contra un fondo quieto,
         que el ojo lee como una lamina y no como dos distancias.

         Cada ScrollTrigger lleva su propio objeto de configuracion. Compartir
         uno entre varios tweens parece limpio y no lo es: GSAP se queda con la
         referencia y el segundo pisa al primero. */
      var hs = function () {
        return { trigger: scope, start: 'top top', end: 'bottom top', scrub: 0.6 };
      };
      var depth = scope.querySelector('.hero-depth');
      if (depth) {
        var plate = depth.querySelector('.hero-plate');
        var atmos = depth.querySelector('.hero-atmos');

        /* Profundidad REAL en el eje Z. La escala compensa el encogimiento que
           mete la perspectiva: sin ella, un plano a -220 px entraria en cuadro
           mas pequeno y se verian los bordes. La formula es
           escala = (perspectiva - z) / perspectiva, con perspective: 1200px.
           El desplazamiento en Z tiene que escribirlo GSAP y no el CSS: GSAP
           reescribe la propiedad transform entera en cada tween, asi que un
           translateZ puesto en la hoja de estilos se perderia en el primer
           fotograma del parallax. */
        if (plate) gsap.set(plate, { z: -220, scale: 1.184, transformOrigin: '50% 50%' });
        if (atmos) gsap.set(atmos, { z: -90, scale: 1.075, transformOrigin: '50% 50%' });

        if (plate) gsap.to(plate, { yPercent: 11, ease: 'none', scrollTrigger: hs() });
        if (atmos) gsap.to(atmos, { yPercent: 6, ease: 'none', scrollTrigger: hs() });

        /* El puntero inclina la escena. Es lo que hace que se lea como una caja
           con fondo y no como un cartel: la relacion entre los planos cambia
           cuando mueves la cabeza, que es exactamente como funciona el
           paralaje de movimiento en la vida real.

           Solo con raton. En tactil no existe el hover y ademas cada toque
           daria un salto. En reposo todo vale 0, asi que las puertas miden lo
           mismo que antes. */
        var fino = window.matchMedia('(hover: hover) and (pointer: fine)');
        if (fino.matches && (navigator.hardwareConcurrency || 8) >= 4) {
          var stage = scope.querySelector('.bp-stage');
          var rx = gsap.quickTo(depth, 'rotationY', { duration: 0.9, ease: 'power3.out' });
          var ry = gsap.quickTo(depth, 'rotationX', { duration: 0.9, ease: 'power3.out' });
          var sx = stage ? gsap.quickTo(stage, 'x', { duration: 1.1, ease: 'power3.out' }) : null;
          var sy = stage ? gsap.quickTo(stage, 'y', { duration: 1.1, ease: 'power3.out' }) : null;

          scope.addEventListener('pointermove', function (e) {
            var b = scope.getBoundingClientRect();
            var nx = (e.clientX - b.left) / b.width - 0.5;   // -0.5 .. 0.5
            var ny = (e.clientY - b.top) / b.height - 0.5;
            rx(nx * 6);          // grados
            ry(-ny * 4);
            if (sx) { sx(-nx * 18); sy(-ny * 12); }   // px, solo desplazamiento
          }, { passive: true });

          scope.addEventListener('pointerleave', function () {
            rx(0); ry(0); if (sx) { sx(0); sy(0); }
          }, { passive: true });
        }
      }
      var col = scope.querySelector('.hero-grid > div');
      if (col) gsap.to(col, { yPercent: -6, ease: 'none', scrollTrigger: hs() });

      var gd = motif.querySelector('.bp-guides');
      if (gd) {
        gsap.to(gd, {
          yPercent: 9, opacity: 0.12, ease: 'none',
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
      gsap.set(img, { scale: 1.08, transformOrigin: '50% 50%' });
      gsap.fromTo(img, { yPercent: -3.5 }, {
        yPercent: 3.5, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
      });
    });
  }

  /* -------------------------------------------------------------- entradas --
     Sustituye al revelado uniforme de main.js en los bloques en rejilla: en
     vez de que cada tarjeta suba sola cuando le toca, entran juntas y
     escalonadas, que es como se lee una fila y no una lista. */
  function batches() {
    var sets = ['.cta-grid > *', '.cred-cell', '.coach-card', '.book-card',
      '.path-flow li', '.faq-list details', '.founder-card', '.form .field',
      '.path-stage__content > *', '.step-list li', '.cta-card', '.stat'];
    sets.forEach(function (sel) {
      var els = gsap.utils.toArray(sel);
      if (!els.length) return;
      els.forEach(guard);
      /* 44 y no 16. Con 16 px de recorrido el ojo registra un parpadeo de
         opacidad, no una entrada: la cosa ya estaba practicamente en su sitio.
         El recorrido es lo que hace que se lea como que ENTRA. */
      gsap.set(els, { opacity: 0, y: 44 });

      var show = function (batch) {
        var todo = batch.filter(function (el) { return !el.__shown; });
        if (!todo.length) return;
        todo.forEach(function (el) { el.__shown = 1; });
        /* Mas rapido y con rebote. 1.05 s con power3 es elegante y se lee
           como algo que se posa despacio; el encargo es lo contrario, que
           entre con energia. back.out(1.4) pasa de largo un poco y vuelve, que
           es lo que el ojo lee como impulso. */
        gsap.to(todo, {
          opacity: 1, y: 0, duration: 0.62, ease: 'back.out(1.4)',
          stagger: 0.055, overwrite: true
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

  /* ------------------------------------------------- 3D atado al scroll --
     El giro por puntero solo existe con raton, o sea que en un telefono todo
     el trabajo de 3D no se veia. Esto lo ata al SCROLL, que es el unico gesto
     que existe en todas partes: la tarjeta llega inclinada hacia atras y se
     endereza al llegar al centro de la pantalla, como una pagina que se posa.

     scrub: 1 y ease none, que es lo que pide cualquier cosa atada al scroll:
     el tween no manda, manda el dedo. Diez grados, dentro del margen de 10 a
     15 que se recomienda para no marear. */
  function depth3d() {
    if (reduced) return;
    var items = gsap.utils.toArray('.path-route, .step-list li, .faq-list details, .book-card, .coach-card, .founder-card, .cred-cell, .podcast-row, .panel, .path-flow li, .cta-grid > *, .cta-card, .stat, .form .field');
    if (!items.length) return;
    items.forEach(function (el, i) {
      gsap.fromTo(el, { rotationX: 10, z: -60 }, {
        rotationX: 0, z: 0, ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 95%',
          end: 'center 62%',
          scrub: 1
        }
      });
    });
  }

  /* ------------------------------------------------------ tarjetas en 3D --
     Las tarjetas dejan de ser recortes pegados en la pagina y pasan a tener
     grosor: al pasar el puntero por encima giran unos grados y se acercan 18 px
     hacia el ojo. La perspectiva la pone la rejilla en el CSS, asi que todas
     las tarjetas de una fila comparten el mismo punto de fuga y giran como si
     estuvieran en la misma mesa, no cada una en su mundo.

     Solo con raton: en una pantalla tactil no hay hover y cada toque daria un
     brinco. En reposo todo vale 0, asi que las puertas de calidad miden lo
     mismo que antes. */
  function cards3d() {
    var fino = window.matchMedia('(hover: hover) and (pointer: fine)');
    /* Menos de 4 nucleos: se sale sin montar nada. El 3D por puntero obliga a
       recomponer capas en cada movimiento del raton, y en un equipo justo eso
       se nota antes en el scroll que en el propio efecto. */
    if (!fino.matches || (navigator.hardwareConcurrency || 8) < 4) return;
    gsap.utils.toArray('.path-route, .cta-grid > *, .path-flow li, .cta-card, .book-card, .coach-card').forEach(function (c) {
      var ry = gsap.quickTo(c, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      var rx = gsap.quickTo(c, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      var qz = gsap.quickTo(c, 'z', { duration: 0.6, ease: 'power3.out' });
      c.addEventListener('pointermove', function (e) {
        var b = c.getBoundingClientRect();
        ry(((e.clientX - b.left) / b.width - 0.5) * 7);
        rx(-((e.clientY - b.top) / b.height - 0.5) * 7);
        qz(18);
      }, { passive: true });
      c.addEventListener('pointerleave', function () { ry(0); rx(0); qz(0); }, { passive: true });
    });
  }

  /* ------------------------------------------------------- foco de entrada --
     Profundidad de campo: la foto entra desenfocada y se resuelve al acercarse,
     como cuando un objetivo hace foco. Es la senal de profundidad mas barata
     que existe y la que mas rompe la sensacion de lamina.

     Con motion.js vivo, main.js deja de revelar .feature-media y .showcase, asi
     que hasta ahora estas figuras no tenian ninguna entrada: solo el parallax
     de la imagen de dentro. Esto llena ese hueco.

     REGLA: el desenfoque SOLO durante la entrada, y se borra al terminar.
     filter: blur() atado al scroll continuo hunde el rendimiento en movil,
     porque obliga a rasterizar la capa entera en cada fotograma. */
  function focusIn() {
    var figs = gsap.utils.toArray(
      '.feature-media, .showcase, .human-scene, .path-stage__media, .creator-portrait');
    if (!figs.length) return;

    var enfocar = function (f) {
      if (f.__focused) return;
      f.__focused = 1;
      f.style.willChange = 'transform, opacity, clip-path';
      gsap.to(f, {
        opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.8, ease: 'power4.out',
        onComplete: function () {
          gsap.set(f, { clearProps: 'clipPath' });
          f.style.willChange = 'auto';
        }
      });
    };

    figs.forEach(function (f) {
      guard(f);
      /* Antes esto entraba con filter: blur(9px) y quedaba muy bien, pero la
         regla de rendimiento es clara: solo se animan transform y opacity,
         que son las dos unicas que el navegador compone en la GPU. Un blur
         obliga a repintar la capa entera en CADA fotograma, y sobre una foto
         a pantalla completa eso es justo el caso peor. El revelado por
         clip-path da la misma sensacion de que la imagen "llega" y no repinta
         nada: solo recorta. */
      gsap.set(f, { opacity: 0, y: 30, clipPath: 'inset(14% 0% 0% 0%)' });
      ScrollTrigger.create({
        trigger: f, start: 'top 88%',
        onEnter: function () { enfocar(f); },
        onEnterBack: function () { enfocar(f); }
      });
      // lo que nace ya visible no espera a nada
      if (f.getBoundingClientRect().top < window.innerHeight * 0.88) { enfocar(f); }
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

  /* ---------------------------------------------------- viaje por capitulos --
     El scroll sigue siendo nativo. Esta capa solo explica donde esta el lector:
     una linea superior muestra el avance total, una pequena brujula numera el
     capitulo activo y el indice de pagina acompana sin moverse de sitio. Nada se
     oculta, nada se fija y ninguna medida del documento cambia. */
  function chapterJourney() {
    var chapters = gsap.utils.toArray('main section[data-chapter]');
    if (!chapters.length) return;

    var meter = document.createElement('div');
    meter.className = 'scroll-meter';
    meter.setAttribute('aria-hidden', 'true');
    meter.innerHTML = '<span></span>';
    document.body.appendChild(meter);
    var meterFill = meter.firstElementChild;

    /* La brujula de capitulos (01 | 04 flotando en el margen izquierdo) se
       retiro a peticion del cliente: no aportaba nada al lector y en una
       pantalla ancha era lo primero que se veia a la izquierda del titular.
       La barra de progreso se queda, que esa si dice algo. */
    var compassCurrent = null;
    /* Sustituto inerte de la brujula retirada. La primera version quito la
       variable y dejo vivas cuatro llamadas a compass.style mas abajo: el motor
       entero reventaba con "compass is not defined" en las paginas con
       capitulos, y se caia TODA la animacion, no solo la brujula. Lo cazo la
       tercera puerta. Un objeto que traga las llamadas es mas seguro que ir
       borrando lineas sueltas. */
    var compass = { style: { setProperty: function () {} } };
    var indexLinks = gsap.utils.toArray('.page-index a[href^="#"]');

    var activate = function (section) {
      chapters.forEach(function (item) {
        item.classList.toggle('is-chapter-active', item === section);
      });
      if (compassCurrent) { compassCurrent.textContent = section.getAttribute('data-chapter') || '01'; }
      indexLinks.forEach(function (link) {
        link.classList.toggle('is-current', link.getAttribute('href') === '#' + section.id);
      });
    };

    activate(chapters[0]);
    compass.style.setProperty('--chapter-progress', '0%');

    chapters.forEach(function (section) {
      section.style.setProperty('--chapter-progress', '0%');
      ScrollTrigger.create({
        trigger: section,
        start: 'top 78%',
        end: 'bottom 22%',
        onEnter: function () { activate(section); },
        onEnterBack: function () { activate(section); },
        onUpdate: function (self) {
          var progress = (self.progress * 100).toFixed(2) + '%';
          section.style.setProperty('--chapter-progress', progress);
          if (section.classList.contains('is-chapter-active')) {
            compass.style.setProperty('--chapter-progress', progress);
          }
        },
        onLeave: function () {
          section.style.setProperty('--chapter-progress', '100%');
          if (section.classList.contains('is-chapter-active')) compass.style.setProperty('--chapter-progress', '100%');
        },
        onLeaveBack: function () {
          section.style.setProperty('--chapter-progress', '0%');
          if (section.classList.contains('is-chapter-active')) compass.style.setProperty('--chapter-progress', '0%');
        }
      });
    });

    ScrollTrigger.create({
      start: 0,
      end: 'max',
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        meterFill.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
      }
    });
  }

  /* --------------------------------------------------- metodo en flujo real --
     Los tres pasos nunca se superponen. El centro de la pantalla solo decide
     cual recibe enfasis y cuanto se ha completado el carril; toda la copia
     conserva su sitio natural en el documento. */
  function methodStory() {
    var story = document.querySelector('[data-method-story]');
    if (!story) return;
    var steps = gsap.utils.toArray(story.querySelectorAll('[data-method-step]'));
    var current = story.querySelector('.method-story__current');
    if (!steps.length) return;

    var activate = function (index) {
      steps.forEach(function (step, i) { step.classList.toggle('is-current', i === index); });
      if (current) current.textContent = String(index + 1).padStart(2, '0');
    };

    ScrollTrigger.create({
      trigger: story,
      start: 'top 64%',
      end: 'bottom 36%',
      onUpdate: function (self) {
        var index = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
        activate(index);
        story.style.setProperty('--method-progress', (self.progress * 100).toFixed(2) + '%');
      },
      onLeave: function () { activate(steps.length - 1); story.style.setProperty('--method-progress', '100%'); },
      onLeaveBack: function () { activate(0); story.style.setProperty('--method-progress', '0%'); }
    });
  }

  /* ------------------------------------------------------- foco fotografico --
     La escena gana luz y definicion al entrar, pero no escala ni salta. Es una
     respuesta ambiental al scroll, no un efecto de tarjeta. */
  function sceneFocus() {
    var scenes = gsap.utils.toArray('.human-scene, .creator-portrait, .outcome-spread__media, .reading-stage__media');
    scenes.forEach(function (scene) {
      ScrollTrigger.create({
        trigger: scene,
        start: 'top 86%',
        end: 'bottom 14%',
        onToggle: function (self) { scene.classList.toggle('is-in-view', self.isActive); }
      });
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
        end: '+=' + (steps.length * 44) + '%',
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
      end: '+=' + (steps.length * 44) + '%',
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
      focusIn();
      cards3d();
      depth3d();
      counters();
      dimLines();
      chapterJourney();
      methodStory();
      sceneFocus();
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
