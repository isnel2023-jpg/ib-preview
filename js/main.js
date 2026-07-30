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
      '.showcase', '.feature-media'
    ].join(', ');
    var targets = document.querySelectorAll(selector);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) {
      el.classList.add('reveal');
      var idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = Math.min(idx * 80, 320) + 'ms';
      io.observe(el);
    });
  }
})();
