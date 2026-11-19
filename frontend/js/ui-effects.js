// ========================================================
// FlowerShop - UI Effects & Animations (v2.0)
// Scroll Reveal, Scroll-To-Top, Ripple, etc.
// ========================================================

(function () {
  'use strict';

  // ---- Scroll Reveal ----
  function initScrollReveal() {
    var els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (!els.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { obs.observe(el); });
  }

  // ---- Scroll To Top Button ----
  function initScrollToTop() {
    var btn = document.getElementById('scroll-to-top');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'scroll-to-top';
      btn.title = 'Lên đầu trang';
      btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
      btn.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };
      document.body.appendChild(btn);
    }
    window.addEventListener('scroll', function () {
      if (window.scrollY > 320) btn.classList.add('show');
      else btn.classList.remove('show');
    }, { passive: true });
  }

  // ---- Ripple Effect ----
  function initRipple() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-ripple, .btn-add-cart, .btn-danger, .btn-outline-danger');
      if (!btn) return;
      var ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.style.position = btn.style.position || 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 700);
    });
  }

  // ---- Auto Reveal on Section Elements ----
  function markRevealElements() {
    // Add reveal classes to common elements that don't already have them
    var selectors = [
      '.product-card',
      '.feature-card',
      '.testimonial-card',
      '.card:not(.navbar-floral):not(.offcanvas)',
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el, i) {
        if (!el.closest('.offcanvas') && !el.closest('.modal') && !el.closest('.navbar') &&
            !el.classList.contains('reveal') && !el.classList.contains('reveal-left') &&
            !el.classList.contains('reveal-right') && !el.classList.contains('reveal-scale')) {
          el.classList.add('reveal');
          // Stagger for siblings
          var delay = (i % 4) * 0.08;
          el.style.transitionDelay = delay + 's';
        }
      });
    });
  }

  // ---- Navbar Scroll Shrink ----
  function initNavbarShrink() {
    var navbar = document.querySelector('.navbar-floral');
    if (!navbar) return;
    window.addEventListener('scroll', function () {
      if (window.scrollY > 60) {
        navbar.style.padding = '6px 0';
        navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
      } else {
        navbar.style.padding = '';
        navbar.style.boxShadow = '';
      }
    }, { passive: true });
  }

  // ---- Active nav link highlight ----
  function highlightNavLink() {
    var currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var linkPath = href.split('?')[0];
      link.classList.remove('active');
      if (currentPath === linkPath || (currentPath === '/' && linkPath === '/index.html') ||
          (currentPath === '/index.html' && linkPath === '/')) {
        link.classList.add('active');
      }
    });
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    initScrollToTop();
    initRipple();
    initNavbarShrink();
    highlightNavLink();
    // Mark & reveal after short delay so dynamic content can load
    setTimeout(function () {
      markRevealElements();
      initScrollReveal();
    }, 300);
  });

  // Re-init reveal when new products load dynamically
  window.reinitReveal = function () {
    setTimeout(function () {
      markRevealElements();
      initScrollReveal();
    }, 100);
  };

})();
