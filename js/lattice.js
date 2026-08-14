/* La retícula del hero: un volumen de puntos en 3D de verdad.
   ---------------------------------------------------------------------------
   Por qué existe este archivo y por qué no es Vanta.

   La skill de efectos 3D ligeros propone VANTA.NET para exactamente esto: una
   red de puntos y líneas que gira y reacciona al puntero. Es el efecto correcto
   para una marca que se llama Blueprint. Lo que no encaja es el coste: Vanta
   monta sobre three.js, y three.js son unos 600 KB, casi seis veces todo el
   JavaScript que tiene el sitio hoy. Este archivo hace el mismo efecto en 6 KB
   porque no necesita un motor 3D general: solo hay que proyectar puntos.

   La proyección es la de verdad, no un truco de escala:

       factor = f / (f + z)          f = distancia focal
       x' = cx + x * factor
       y' = cy + y * factor

   De ahí sale todo lo demás. Un punto lejano se dibuja más pequeño, más tenue
   y más juntito al centro, que es lo que hace que el ojo lea profundidad. Las
   líneas solo unen puntos que están cerca EN EL ESPACIO, no en la pantalla:
   por eso al girar el volumen las uniones cambian, como en una celosía real.

   Reglas que respeta, y ninguna es opcional:
     - si el usuario pide menos movimiento, esto no se monta
     - si el hero no está en pantalla, el bucle se para (no se decodifican
       fotogramas que nadie ve, y en un portátil eso es batería)
     - en pantalla táctil baja a la mitad de puntos y no escucha al puntero
     - se redibuja con requestAnimationFrame y nada más
*/
(function () {
  'use strict';

  var lienzo = document.querySelector('.hero-lattice');
  if (!lienzo) { return; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }

  var ctx = lienzo.getContext('2d', { alpha: true });
  if (!ctx) { return; }

  /* LA GALAXIA ACOMPANA TODO EL RECORRIDO (pedido de Isnel). El lienzo se
     muda del hero al body y pasa a ser una capa fija a pantalla completa.
     Dos razones para MUDARLO en vez de crear otro: (1) un solo campo de
     puntos, no dos motores O(n2) corriendo a la vez; (2) dentro del hero los
     transforms del parallax convierten position:fixed en position:absolute
     silenciosamente, y la capa se iria con el scroll. */
  lienzo.classList.add('page-lattice');
  document.body.appendChild(lienzo);

  var fino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var flojo = (navigator.hardwareConcurrency || 8) < 4;

  /* El recuento es lo único que decide el coste: unir puntos es O(n²), o sea
     que 96 puntos son 4.560 comparaciones por fotograma y 48 son 1.128. */
  /* DENSIDAD. La primera version llevaba 130 puntos y el preset NET de la
     propia skill usa points: 10. El resultado fue una madeja que tapaba el
     titular. Un fondo es un fondo: pocos nodos, lineas tenues. */
  /* DISTRIBUCION (feedback de Isnel: "el espacio deberia estar bien
     distribuido en toda la pagina"). El volumen media un 0.85 del viewport y
     la perspectiva encoge lo lejano hacia el centro: resultado, una madeja
     central y las esquinas vacias. El volumen pasa a 1.55 veces el viewport
     (los puntos cercanos, con factor ~0.84, alcanzan asi los bordes reales) y
     el recuento sube a 96/48, que es el techo que este archivo documenta
     arriba como asumible (4.560 comparaciones por fotograma). El ENLACE crece
     en proporcion para que la red no se deshilache al separarse los puntos. */
  var N = fino && !flojo ? 96 : 48;
  var ENLACE = 300;      // distancia máxima para unir dos puntos, en unidades del volumen
  var FOCAL = 720;
  var PROF = 900;        // fondo del volumen

  var ORO = '240, 176, 24';

  /* EL COLOR VIAJA CON EL LECTOR (pedido de Isnel: "que cambie de color de
     vez en cuando"). En vez de un azul fijo, la galaxia recorre una paleta
     segun la profundidad del scroll: azul de plano arriba, violeta en el
     tramo medio, cian hacia el fondo y un ambar tenue en el cierre, que le
     devuelve el saludo al oro de la marca. El transito es continuo (se
     interpola entre anclas), asi que nunca hay un salto de color: solo la
     sensacion de que la pagina cambia de hora a medida que bajas. Los nodos
     dorados no entran en esto: el oro de la marca no se negocia. */
  var PALETA = [
    [122, 132, 205],   // azul de plano
    [156, 120, 224],   // violeta
    [96, 176, 216],    // cian
    [214, 168, 110]    // ambar tenue
  ];
  function tono() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var f = max > 0 ? Math.min(1, Math.max(0, (window.scrollY || 0) / max)) : 0;
    var t = f * (PALETA.length - 1);
    var i = Math.min(PALETA.length - 2, Math.floor(t));
    var u = t - i;
    var a = PALETA[i], b = PALETA[i + 1];
    return Math.round(a[0] + (b[0] - a[0]) * u) + ',' +
           Math.round(a[1] + (b[1] - a[1]) * u) + ',' +
           Math.round(a[2] + (b[2] - a[2]) * u);
  }
  var AZUL = PALETA[0].join(', ');

  var w = 0, h = 0, dpr = 1;
  var puntos = [];
  var raf = 0, visible = true;
  var girX = 0, girY = 0, objX = 0, objY = 0;
  var ratonX = -9999, ratonY = -9999;

  /* ------------------------------------------------------------- ANCLAS --
     El cambio que pidio Isnel: que la galaxia no flote "superpuesta y ya",
     sino que DELINEE lo que el lector tiene delante. Los puntos libres se
     conectan a las esquinas de los bloques visibles (titulares, tarjetas,
     marcos de foto y video): la red se agarra del contenido como un plano
     que va acotando lo que mide, que es la metafora de toda la marca. Las
     esquinas se leen del layout real en cada fotograma (los rects cambian
     con el scroll); la LISTA de elementos se refresca solo de vez en
     cuando, que es lo caro. */
  var ANCLA_SEL = '.section h2, .teaser-frame, .coach-card, .book-card, ' +
    '.cta-card, .panel, .media, .stat, .founder-card, .cred-cell';
  var ANCLA_R = 170;          // alcance de un enlace punto-esquina, en px
  var RATON_R = 190;          // alcance de un enlace punto-cursor
  var anclaEls = [];
  var anclas = [];
  var marcoAncla = 0;
  function listarAnclas() {
    anclaEls = Array.prototype.slice.call(document.querySelectorAll(ANCLA_SEL), 0, 24);
  }
  function medirAnclas() {
    anclas.length = 0;
    for (var i = 0; i < anclaEls.length && anclas.length < 40; i++) {
      var r = anclaEls[i].getBoundingClientRect();
      if (r.bottom < -40 || r.top > h + 40 || r.width < 40 || r.height < 10) { continue; }
      anclas.push(r.left, r.top, r.right, r.top, r.left, r.bottom, r.right, r.bottom);
    }
  }

  function medir() {
    var r = lienzo.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    lienzo.width = Math.round(w * dpr);
    lienzo.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sembrar() {
    puntos = [];
    var anchoVol = Math.max(w, 900) * 1.55;
    var altoVol = Math.max(h, 600) * 1.55;
    /* SIEMBRA ESTRATIFICADA, no aleatoria pura. Con Math.random() a secas los
       puntos nacen a grumos (es estadistica, no mala suerte), y las lineas
       amplifican cada grumo al cuadrado: una madeja aqui, un desierto alla.
       El volumen se parte en una rejilla de celdas, un punto por celda con
       jitter dentro de la suya: mismo azar aparente, cobertura garantizada. */
    var cols = Math.max(1, Math.round(Math.sqrt(N * anchoVol / altoVol)));
    var rows = Math.max(1, Math.ceil(N / cols));
    for (var i = 0; i < N; i++) {
      puntos.push({
        x: ((i % cols + Math.random()) / cols - 0.5) * anchoVol,
        y: ((Math.floor(i / cols) % rows + Math.random()) / rows - 0.5) * altoVol,
        /* z SIMETRICO. Antes iba de -0.35 a +0.7 de la profundidad: esa media
           desplazada, al girar el volumen sobre Y, empujaba todos los puntos
           hacia el mismo lado de la pantalla (columna derecha desierta,
           medido por novenos). Centrado en cero, el giro no arrastra nada. */
        z: (Math.random() - 0.5) * PROF,
        /* deriva propia: sin ella la celosía es un objeto rígido girando, y se
           nota que es un truco. Con ella respira. */
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.12,
        vz: (Math.random() - 0.5) * 0.2,
        oro: Math.random() < 0.14
      });
    }
  }

  function pintar(t) {
    raf = 0;
    if (!visible) { return; }

    ctx.clearRect(0, 0, w, h);

    AZUL = tono();   // el color del fotograma, segun donde este el lector

    girX += (objX - girX) * 0.05;
    girY += (objY - girY) * 0.05;

    /* VAIVEN, no vuelta completa. Girando sin limite, cada vez que el volumen
       pasaba de canto (90 grados) todo el campo se apretaba en una franja
       central de 900 px y los bordes de la pantalla quedaban desiertos: la
       mala distribucion que Isnel reporto era ESTE momento del giro. Un
       balanceo de +/-0.3 rad da el mismo parallax vivo sin el colapso. */
    var giro = Math.sin(t * 0.00005) * 0.3 + girY;
    var cos = Math.cos(giro), sin = Math.sin(giro);
    var cosX = Math.cos(girX), sinX = Math.sin(girX);
    var cx = w / 2, cy = h / 2;
    var i, p, q, x, y, z, yy, zz, f, n = puntos.length;

    for (i = 0; i < n; i++) {
      p = puntos[i];
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      /* el volumen es un toro: lo que sale por un lado entra por el otro, así
         no hay que resembrar nunca ni aparecen huecos */
      var lim = Math.max(w, 900) * 0.775;   // la mitad del volumen de 1.55
      if (p.x > lim) p.x = -lim; else if (p.x < -lim) p.x = lim;
      var limY = Math.max(h, 600) * 0.775;
      if (p.y > limY) p.y = -limY; else if (p.y < -limY) p.y = limY;
      if (p.z > PROF * 0.5) p.z = -PROF * 0.5; else if (p.z < -PROF * 0.5) p.z = PROF * 0.5;

      // rotación en Y y luego en X
      x = p.x * cos - p.z * sin;
      z = p.x * sin + p.z * cos;
      yy = p.y * cosX - z * sinX;
      zz = p.y * sinX + z * cosX;

      f = FOCAL / (FOCAL + zz + PROF * 0.5);
      p.sx = cx + x * f;
      p.sy = cy + yy * f;
      p.sf = f;
      p.rx = x; p.ry = yy; p.rz = zz;
    }

    // las uniones, primero, para que los nodos queden por encima
    ctx.lineWidth = 1;
    for (i = 0; i < n; i++) {
      p = puntos[i];
      if (p.sf <= 0) continue;
      for (var j = i + 1; j < n; j++) {
        q = puntos[j];
        if (q.sf <= 0) continue;
        var dx = p.rx - q.rx, dy = p.ry - q.ry, dz = p.rz - q.rz;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > ENLACE * ENLACE) continue;
        var d = Math.sqrt(d2);
        /* la línea se apaga con la distancia Y con la profundidad: las dos
           cosas a la vez son lo que da la sensación de niebla */
        var a = (1 - d / ENLACE) * 0.6 * Math.min(p.sf, q.sf);
        if (a < 0.02) continue;
        ctx.strokeStyle = 'rgba(' + AZUL + ',' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }
    }

    /* la red se agarra del contenido: enlaces de los puntos libres a las
       esquinas de los bloques en pantalla, y al cursor si esta cerca */
    if ((marcoAncla++ & 63) === 0) { listarAnclas(); }
    medirAnclas();
    var k, ax, ay, ddx, ddy, dd2, aa;
    for (i = 0; i < n; i++) {
      p = puntos[i];
      if (p.sf <= 0) continue;
      for (k = 0; k < anclas.length; k += 2) {
        ax = anclas[k]; ay = anclas[k + 1];
        ddx = p.sx - ax; ddy = p.sy - ay;
        dd2 = ddx * ddx + ddy * ddy;
        if (dd2 > ANCLA_R * ANCLA_R) continue;
        aa = (1 - Math.sqrt(dd2) / ANCLA_R) * 0.3 * p.sf;
        if (aa < 0.02) continue;
        ctx.strokeStyle = 'rgba(' + AZUL + ',' + aa.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(ax, ay);
        ctx.stroke();
      }
      // el cursor tambien es un nodo: la red responde a la mano del lector
      ddx = p.sx - ratonX; ddy = p.sy - ratonY;
      dd2 = ddx * ddx + ddy * ddy;
      if (dd2 < RATON_R * RATON_R) {
        aa = (1 - Math.sqrt(dd2) / RATON_R) * 0.42 * p.sf;
        if (aa >= 0.02) {
          ctx.strokeStyle = 'rgba(' + AZUL + ',' + aa.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(ratonX, ratonY);
          ctx.stroke();
        }
      }
    }
    /* la marca de cada esquina acotada: un tick dorado minimo, como las
       marcas de registro de un plano. Solo donde de verdad llega la red. */
    ctx.fillStyle = 'rgba(' + ORO + ',0.30)';
    for (k = 0; k < anclas.length; k += 2) {
      ctx.fillRect(anclas[k] - 1, anclas[k + 1] - 1, 2, 2);
    }

    for (i = 0; i < n; i++) {
      p = puntos[i];
      if (p.sf <= 0) continue;
      var r = Math.max(0.7, p.sf * 2.0);
      var a2 = Math.min(0.8, p.sf * 0.95);
      ctx.fillStyle = 'rgba(' + (p.oro ? ORO : AZUL) + ',' + a2.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, 6.283185);
      ctx.fill();
    }

    pedir();
  }

  function pedir() {
    if (!raf && visible) { raf = window.requestAnimationFrame(pintar); }
  }

  function arrancar() {
    medir();
    sembrar();
    pedir();
  }

  var reloj = 0;
  window.addEventListener('resize', function () {
    clearTimeout(reloj);
    reloj = setTimeout(arrancar, 180);
  }, { passive: true });

  /* EL ZOOM. La resolucion interna del canvas se media UNA vez, al arrancar.
     Si en ese momento la caja aun no tenia su tamano final (hoja de estilos
     llegando tarde, fuentes moviendo el hero, lo que sea), el lienzo se
     quedaba en su resolucion por defecto de 300x150 y el CSS lo estiraba a
     pantalla completa: lineas gigantes y borrosas, la pagina "con zoom".
     El resize de window no protege de esto porque la ventana no cambio,
     cambio la CAJA. ResizeObserver mira la caja. */
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      var r = lienzo.getBoundingClientRect();
      if (Math.abs(r.width - w) > 2 || Math.abs(r.height - h) > 2) {
        clearTimeout(reloj);
        reloj = setTimeout(arrancar, 120);
      }
    }).observe(lienzo);
  }

  if (fino) {
    /* El puntero manda desde CUALQUIER punto de la pagina: la referencia ya
       no es la caja del hero sino la ventana entera. */
    window.addEventListener('pointermove', function (e) {
      objY = (e.clientX / window.innerWidth - 0.5) * 0.5;
      objX = (e.clientY / window.innerHeight - 0.5) * -0.32;
      ratonX = e.clientX; ratonY = e.clientY;
      pedir();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () {
      objX = 0; objY = 0; ratonX = -9999; ratonY = -9999; pedir();
    }, { passive: true });
  }

  /* Fuera de pantalla, el bucle se para. Sin esto, la retícula sigue
     calculando 4.560 distancias por fotograma en el pie de página. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (ent) {
      visible = ent[0].isIntersecting;
      if (visible) { pedir(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0 }).observe(lienzo);
  }

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    if (visible) { pedir(); }
  });

  arrancar();
})();
