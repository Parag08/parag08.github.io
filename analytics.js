// Site-wide analytics. Included from every page's <head>; change IDs here only.
(function () {
  var GA_ID = 'G-QZDWFYF5RK';
  var CLARITY_ID = 'z7llhyih07';

  // Skip local previews so testing doesn't count as visits.
  var host = location.hostname;
  if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID);

  // Microsoft Clarity: heatmaps and session recordings.
  window.clarity = window.clarity || function () { (clarity.q = clarity.q || []).push(arguments); };
  var c = document.createElement('script');
  c.async = true;
  c.src = 'https://www.clarity.ms/tag/' + CLARITY_ID;
  document.head.appendChild(c);

  // GA4 only reports 90% scroll on its own; add 25/50/75 to see how far people read.
  var marks = [25, 50, 75], sent = {};
  window.addEventListener('scroll', function () {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    var pct = (window.scrollY / max) * 100;
    marks.forEach(function (m) {
      if (pct >= m && !sent[m]) {
        sent[m] = true;
        gtag('event', 'scroll_depth', { percent_scrolled: m });
      }
    });
  }, { passive: true });
})();
