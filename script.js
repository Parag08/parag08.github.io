(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const themeButton = document.querySelector('.theme-toggle');
  const menu = document.querySelector('.mobile-menu');
  const menuButton = document.querySelector('.menu-toggle');
  const closeButton = document.querySelector('.menu-close');
  const setTheme = (theme) => {
    root.dataset.theme = theme;
    localStorage.setItem('pr-theme', theme);
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
      themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    }
  };
  themeButton?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
  const setMenu = (open) => {
    menu?.classList.toggle('open', open);
    menu?.setAttribute('aria-hidden', String(!open));
    menuButton?.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menuButton?.addEventListener('click', () => setMenu(true));
  closeButton?.addEventListener('click', () => setMenu(false));
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });
  document.querySelector('.back-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.querySelector('#year')?.replaceChildren(String(new Date().getFullYear()));
  const header = document.querySelector('.site-header');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('main > section')];
  const revealSections = () => {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    sections.forEach((section) => observer.observe(section));
  };
  revealSections();
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      header?.classList.toggle('scrolled', scrollY > 15);
      if (!prefersReducedMotion) {
        const hero = document.querySelector('.hero');
        if (hero) {
          const progress = Math.min(scrollY / Math.max(hero.offsetHeight, 1), 1);
          hero.style.setProperty('--hero-progress', progress.toFixed(3));
        }
      }
      ticking = false;
    });
  }, { passive: true });
})();
