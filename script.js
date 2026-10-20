(() => {
  const root = document.documentElement;
  root.classList.add("js");

  const loader = document.querySelector(".loader");
  const percent = document.querySelector(".loader-pct");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hideLoader = () => {
    if (!loader) return;
    loader.classList.add("done");
    window.setTimeout(() => loader.remove(), 520);
  };

  if (loader && !reduced) {
    let value = 0;
    const step = () => {
      value = Math.min(100, value + Math.random() * 14 + 4);
      if (percent) percent.textContent = `${Math.floor(value)}%`;
      if (value >= 100) {
        window.setTimeout(hideLoader, 180);
        return;
      }
      window.setTimeout(step, 70);
    };
    window.setTimeout(step, 120);
  } else {
    hideLoader();
  }

  const menu = document.querySelector(".mobile-menu");
  const toggle = document.querySelector(".menu-toggle");
  const setMenu = (open) => {
    menu?.classList.toggle("open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle?.addEventListener("click", () => setMenu(!menu?.classList.contains("open")));
  menu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  const sections = [...document.querySelectorAll(".reveal")];
  if (reduced || !("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, current) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      current.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  sections.forEach((section) => observer.observe(section));
})();
