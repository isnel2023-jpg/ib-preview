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

  var fino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var flojo = (navigator.hardwareConcurrency || 8) < 4;

  /* El recuento es lo único que decide el coste: unir puntos es O(n²), o sea
     que 96 puntos son 4.560 comparaciones por fotograma y 48 son 1.128. */
  var N = fino && !flojo ? 130 : 60;
  var ENLACE = 300;      // distancia máxima para unir dos puntos, en unidades del volumen
  var FOCAL = 720;
  var PROF = 900;        // fondo del volumen

  var AZUL = '122, 132, 205';
  var ORO = '240, 176, 24';

  var w = 0, h = 0, dpr = 1;
  var puntos = [];
  var raf = 0, visible = true;
  var girX = 0, girY = 0, objX = 0, objY = 0;

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
    var anchoVol = Math.max(w, 900) * 0.85;
    var altoVol = Math.max(h, 600) * 0.85;
    for (var i = 0; i < N; i++) {
      puntos.push({
        x: (Math.random() - 0.5) * anchoVol,
        y: (Math.random() - 0.5) * altoVol,
        z: Math.random() * PROF - PROF * 0.35,
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

    girX += (objX - girX) * 0.05;
    girY += (objY - girY) * 0.05;

    var giro = t * 0.00004 + girY;      // vuelta lenta sobre el eje Y
    var cos = Math.cos(giro), sin = Math.sin(giro);
    var cosX = Math.cos(girX), sinX = Math.sin(girX);
    var cx = w / 2, cy = h / 2;
    var i, p, q, x, y, z, yy, zz, f, n = puntos.length;

    for (i = 0; i < n; i++) {
      p = puntos[i];
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      /* el volumen es un toro: lo que sale por un lado entra por el otro, así
         no hay que resembrar nunca ni aparecen huecos */
      var lim = Math.max(w, 900) * 0.45;
      if (p.x > lim) p.x = -lim; else if (p.x < -lim) p.x = lim;
      var limY = Math.max(h, 600) * 0.45;
      if (p.y > limY) p.y = -limY; else if (p.y < -limY) p.y = limY;
      if (p.z > PROF * 0.7) p.z = -PROF * 0.35; else if (p.z < -PROF * 0.35) p.z = PROF * 0.7;

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
        var a = (1 - d / ENLACE) * 1.05 * Math.min(p.sf, q.sf);
        if (a < 0.02) continue;
        ctx.strokeStyle = 'rgba(' + AZUL + ',' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }
    }

    for (i = 0; i < n; i++) {
      p = puntos[i];
      if (p.sf <= 0) continue;
      var r = Math.max(0.9, p.sf * 2.6);
      var a2 = Math.min(0.95, p.sf * 1.15);
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

  if (fino) {
    var hero = lienzo.closest('.hero') || document.body;
    hero.addEventListener('pointermove', function (e) {
      var b = hero.getBoundingClientRect();
      objY = ((e.clientX - b.left) / b.width - 0.5) * 0.5;
      objX = ((e.clientY - b.top) / b.height - 0.5) * -0.32;
      pedir();
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { objX = 0; objY = 0; pedir(); }, { passive: true });
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
