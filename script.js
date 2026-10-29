(() => {
  const root = document.documentElement;
  root.classList.add("js");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasObserver = "IntersectionObserver" in window;

  /* ---------------------------------------------------------------- preloader
     The old version faked progress with Math.random() and held a white sheet
     over the page for roughly a second on every visit. Progress is now tied to
     real milestones (first paint, fonts, window load), hard-capped at 350 ms,
     and skipped completely on repeat visits. */
  const loader = document.querySelector(".loader");
  const percent = document.querySelector(".loader-pct");
  const journeyLoader = loader?.hasAttribute("data-journey-loader");
  const SEEN_KEY = "pr-seen";
  const MAX_WAIT = 350;

  const seenBefore = (() => {
    try {
      return sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  })();

  const markReady = () => { if (!journeyLoader) root.classList.add("is-ready"); };

  // Failsafe: if anything above throws on an exotic browser, never leave the
  // hero hidden behind its entrance animation.
  window.setTimeout(markReady, 2000);

  const finish = ({ instant = false } = {}) => {
    // The mountain journey is released only by its own first-frame controller.
    if (journeyLoader) return;
    if (percent) percent.textContent = "100%";
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode - just show it every time */
    }

    if (!loader || !loader.isConnected) {
      markReady();
      return;
    }

    markReady();

    if (instant) {
      loader.remove();
      return;
    }

    loader.classList.add("done");
    window.setTimeout(() => loader.remove(), 400);
  };

  if (loader && !journeyLoader && !reduced && !seenBefore) {
    let value = 0;
    const paint = (next) => {
      value = Math.max(value, next);
      if (percent) percent.textContent = `${Math.round(value)}%`;
    };

    paint(18);
    window.setTimeout(() => paint(38), 80);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => paint(72));

    const pageLoaded = new Promise((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });

    // Whichever lands first: the page is genuinely ready, or the cap expires.
    Promise.race([pageLoaded, new Promise((resolve) => window.setTimeout(resolve, MAX_WAIT))])
      .then(() => finish());
  } else {
    finish({ instant: true });
  }

  /* -------------------------------------------------------------------- menu */
  const menu = document.querySelector(".mobile-menu");
  const toggle = document.querySelector(".menu-toggle");
  const menuLinks = menu ? [...menu.querySelectorAll("a")] : [];
  const pageRegions = [...document.querySelectorAll("main, .site-footer")];

  menuLinks.forEach((link, index) => link.style.setProperty("--i", String(index)));

  const menuOpen = () => Boolean(menu && menu.classList.contains("open"));

  const setMenu = (open) => {
    if (!menu) return;
    menu.classList.toggle("open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
    menu.inert = !open;
    pageRegions.forEach((region) => {
      region.inert = open;
    });
  };

  toggle?.addEventListener("click", () => setMenu(!menuOpen()));
  menuLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenu(false);
      return;
    }

    if (event.key !== "Tab" || !menuOpen()) return;

    const items = [toggle, ...menuLinks].filter(Boolean);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980 && menuOpen()) setMenu(false);
  }, { passive: true });

  const year = document.querySelector("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  const sections = [...document.querySelectorAll(".reveal")];
  if (reduced || !hasObserver) {
    sections.forEach((section) => section.classList.add("is-visible"));
  } else {
    root.classList.add("ts-reveal");

    const observer = new IntersectionObserver((entries, current) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        current.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    sections.forEach((section) => observer.observe(section));

    // Failsafe: anything already within a screen and a half is shown even if an
    // observation never arrives.
    window.setTimeout(() => {
      sections.forEach((section) => {
        if (section.classList.contains("is-visible")) return;
        if (section.getBoundingClientRect().top < window.innerHeight * 1.5) {
          section.classList.add("is-visible");
        }
      });
    }, 2500);
  }

  /* -------------------------------------------------------- scroll instruments
     Hairline progress bar and an auto-tucking nav share one rAF-throttled
     scroll listener. */
  const nav = document.querySelector(".site-nav");
  const scrollBar = document.createElement("div");
  scrollBar.className = "scroll-bar";
  scrollBar.setAttribute("aria-hidden", "true");

  document.body.append(scrollBar);

  let lastY = window.scrollY;
  let frame = 0;
  const updateScroll = () => {
    frame = 0;

    const scroller = document.scrollingElement || document.documentElement;
    const y = window.scrollY;
    const max = scroller.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    const rounded = ratio.toFixed(3);

    scrollBar.style.setProperty("--p", rounded);

    if (nav) {
      if (y < 90) nav.classList.remove("is-tucked");
      else if (y > lastY + 4) nav.classList.add("is-tucked");
      else if (y < lastY - 4) nav.classList.remove("is-tucked");
      if (Math.abs(y - lastY) > 4) lastY = y;
    }
  };

  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(updateScroll);
  };

  // A frame scheduled while the tab is hidden may never be delivered; drop the
  // handle on return so the instrument cannot get stuck.
  document.addEventListener("visibilitychange", () => {
    frame = 0;
    if (!document.hidden) updateScroll();
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("load", onScroll, { once: true });

  // Sections grow as fonts settle and as content-visibility renders them in, so
  // re-run the instrument whenever the page box changes.
  if ("ResizeObserver" in window) {
    new ResizeObserver(onScroll).observe(document.body);
  }

  // Land in the next frame instead of forcing layout during script execution.
  window.requestAnimationFrame(updateScroll);

  /* ---------------------------------------------------------------- SG clock */
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const tick = () => {
      clock.textContent = formatter.format(new Date());
    };
    tick();
    window.setInterval(tick, 20000);
  }

  /* ------------------------------------------------------ pointer choreography
     Chips drift on their own (CSS) and lean with the cursor (here). One rAF
     loop, paused whenever the hero leaves the viewport or the tab is hidden. */
  const hero = document.querySelector(".hero");
  const chips = [...document.querySelectorAll(".chip-layer > .chip")];
  const cta = document.querySelector(".hero-cv");

  if (hero && cta && finePointer && !reduced) {
    const depths = [0.9, 1.4, 0.7, 1.15, 1.55, 0.85, 1.25];
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let pointerFrame = 0;
    let heroVisible = true;

    const loop = () => {
      pointerFrame = 0;
      currentX += (targetX - currentX) * 0.075;
      currentY += (targetY - currentY) * 0.075;

      chips.forEach((chip, index) => {
        const depth = depths[index % depths.length] * 7;
        chip.style.translate = `${(currentX * depth).toFixed(2)}px ${(currentY * depth * 0.7).toFixed(2)}px`;
      });
      cta.style.translate = `${(currentX * 10).toFixed(2)}px ${(currentY * 8).toFixed(2)}px`;

      if (Math.abs(targetX - currentX) > 0.0015 || Math.abs(targetY - currentY) > 0.0015) {
        pointerFrame = window.requestAnimationFrame(loop);
      }
    };

    const kick = () => {
      if (!pointerFrame && heroVisible && !document.hidden) pointerFrame = window.requestAnimationFrame(loop);
    };

    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      kick();
    }, { passive: true });

    hero.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      kick();
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pointerFrame = 0;
      else kick();
    });

    if (hasObserver) {
      new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        if (heroVisible) kick();
      }).observe(hero);
    }
  }

  /* --------------------------------------------------------- count-up numbers
     Elements carrying data-count count from zero once, with data-prefix and
     data-suffix for currency and units. */
  const countUpEl = (el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;

    // Ranges start counting from their lower bound so intermediate frames still
    // read as the right number ("$40-41M", never "$40-24M").
    const from = Number(el.dataset.from || 0);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const render = (value) => {
      el.textContent = `${prefix}${value.toLocaleString("en-US")}${suffix}`;
    };

    if (reduced) {
      render(target);
      return;
    }

    // A second run (e.g. tab switched away and back) cancels the first.
    const token = (el.__countToken || 0) + 1;
    el.__countToken = token;
    const started = performance.now();
    const duration = 820;

    const frame = (now) => {
      if (el.__countToken !== token) return;
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      render(Math.round(from + (target - from) * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
    };

    render(from);
    window.requestAnimationFrame(frame);
  };

  const countUp = (scope) => {
    scope.querySelectorAll("[data-count]").forEach(countUpEl);
  };

  if (!reduced && hasObserver) {
    const counterObserver = new IntersectionObserver((entries, current) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        countUpEl(entry.target);
        current.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    document.querySelectorAll("[data-count]").forEach((el) => counterObserver.observe(el));
  }

  /* ----------------------------------------------------------------- console */
  const consolePanel = document.querySelector("[data-console]");

  if (consolePanel) {
    const tabs = [...consolePanel.querySelectorAll('[role="tab"]')];
    const panes = [...consolePanel.querySelectorAll(".console-pane")];
    let typing = 0;

    const typeInto = (el, text) => {
      window.clearTimeout(typing);
      if (!el) return;

      if (reduced) {
        el.textContent = text;
        return;
      }

      el.textContent = "";
      let index = 0;
      const step = () => {
        index += 1;
        el.textContent = text.slice(0, index);
        if (index < text.length) typing = window.setTimeout(step, 14);
      };
      typing = window.setTimeout(step, 90);
    };

    const activate = (tab, { focus = false } = {}) => {
      tabs.forEach((item) => {
        const on = item === tab;
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
      });

      panes.forEach((pane) => {
        const on = pane.id === tab.getAttribute("aria-controls");
        pane.hidden = !on;
        if (!on) return;
        countUp(pane);
        typeInto(pane.querySelector(".console-typed"), pane.dataset.log || "");
      });

      if (focus) tab.focus();
    };

    tabs.forEach((tab) => tab.addEventListener("click", () => activate(tab)));

    consolePanel.querySelector('[role="tablist"]')?.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(document.activeElement);
      if (index < 0) return;

      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];

      if (step) {
        event.preventDefault();
        activate(tabs[(index + step + tabs.length) % tabs.length], { focus: true });
      } else if (event.key === "Home") {
        event.preventDefault();
        activate(tabs[0], { focus: true });
      } else if (event.key === "End") {
        event.preventDefault();
        activate(tabs[tabs.length - 1], { focus: true });
      }
    });

    // Type the initial log line only once the panel is actually on screen.
    const firstPane = panes.find((pane) => !pane.hidden);
    if (firstPane) {
      const log = firstPane.querySelector(".console-typed");
      const text = firstPane.dataset.log || "";

      if (reduced || !hasObserver) {
        typeInto(log, text);
      } else {
        const logObserver = new IntersectionObserver(([entry], current) => {
          if (!entry.isIntersecting) return;
          typeInto(log, text);
          current.disconnect();
        }, { threshold: 0.4 });
        logObserver.observe(firstPane);
      }
    }
  }

  /* ---------------------------------------------------------------- prefetch */
  const prefetchPages = () => {
    const urls = new Set();

    document.querySelectorAll('a[href$=".html"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.includes("#") || urls.has(href)) return;
      urls.add(href);

      const hint = document.createElement("link");
      hint.rel = "prefetch";
      hint.href = href;
      document.head.append(hint);
    });
  };

  if ("requestIdleCallback" in window) window.requestIdleCallback(prefetchPages, { timeout: 2500 });
  else window.setTimeout(prefetchPages, 1500);
})();
