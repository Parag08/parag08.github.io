/* ==========================================================================
   Parag Rahangdale — site behaviour
   ========================================================================== */

const STORAGE_KEY = 'pr-theme';
const DAY_START = 7;   // 07:00 -> light
const DAY_END = 19;    // 19:00 -> dark

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* --------------------------------------------------------------------------
   Theme
   The clock only decides for visitors who have never chosen. Once someone
   clicks the toggle their choice is stored and wins on every later visit,
   so a dark-mode person browsing at 2pm is not overruled every time.
   The initial attribute is set by an inline script in <head> to avoid a
   flash of the wrong theme; this module only handles toggling afterwards.
   -------------------------------------------------------------------------- */
function themeFromClock() {
    const hour = new Date().getHours();
    return hour >= DAY_START && hour < DAY_END ? 'light' : 'dark';
}

function storedTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        return null; // private mode / blocked storage
    }
}

function applyTheme(theme, animate) {
    const root = document.documentElement;

    if (animate) {
        root.classList.add('theme-transition');
        window.setTimeout(() => root.classList.remove('theme-transition'), 500);
    }

    root.setAttribute('data-theme', theme);

    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.setAttribute('aria-pressed', String(theme === 'dark'));
        btn.setAttribute(
            'aria-label',
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        );
    });

    // Keep the browser chrome in step with the page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0F13' : '#F5F7FA');

    // The 3D scene cannot use CSS variables, so it is recoloured by hand.
    if (typeof window.__setSceneTheme === 'function') window.__setSceneTheme(theme);
}

function initTheme() {
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const next =
                document.documentElement.getAttribute('data-theme') === 'dark'
                    ? 'light'
                    : 'dark';
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (e) {
                /* storage unavailable — theme still applies for this page view */
            }
            applyTheme(next, true);
        });
    });

    // Re-sync the visible state with whatever the inline head script chose.
    applyTheme(document.documentElement.getAttribute('data-theme') || themeFromClock(), false);

    // Someone leaving the tab open across sunset/sunrise should drift with the
    // clock, but only if they never expressed a preference.
    window.setInterval(() => {
        if (storedTheme()) return;
        const clockTheme = themeFromClock();
        if (clockTheme !== document.documentElement.getAttribute('data-theme')) {
            applyTheme(clockTheme, true);
        }
    }, 60 * 1000);
}

/* --------------------------------------------------------------------------
   Custom cursor
   The old version called cursorBlob.animate() on every mousemove, allocating
   a fresh Animation object per event. This lerps on one rAF loop instead.
   -------------------------------------------------------------------------- */
function initCursor() {
    if (!hasFinePointer || prefersReducedMotion) return;

    const dot = document.querySelector('.cursor-dot');
    const blob = document.querySelector('.cursor-blob');
    if (!dot || !blob) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let blobX = mouseX;
    let blobY = mouseY;

    window.addEventListener(
        'mousemove',
        e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
        },
        { passive: true }
    );

    (function render() {
        blobX += (mouseX - blobX) * 0.12;
        blobY += (mouseY - blobY) * 0.12;
        blob.style.transform = `translate3d(${blobX}px, ${blobY}px, 0)`;
        requestAnimationFrame(render);
    })();

    // Delegated, so it covers anything added later and costs two listeners
    // instead of one pair per interactive element.
    const interactiveSelector =
        'a, button, .timeline-content, .edu-card, .tag, .project-card, .defensiblity-card, .expertise-item';

    document.addEventListener('mouseover', e => {
        if (e.target.closest(interactiveSelector)) dot.classList.add('is-hovering');
    });

    document.addEventListener('mouseout', e => {
        if (e.target.closest(interactiveSelector)) dot.classList.remove('is-hovering');
    });
}

/* --------------------------------------------------------------------------
   Navigation
   -------------------------------------------------------------------------- */
function initNav() {
    const menuToggle = document.querySelector('.menu-toggle');
    const menuClose = document.querySelector('.menu-close');
    const mobileMenu = document.querySelector('.mobile-menu-overlay');

    function setMenu(open) {
        if (!mobileMenu) return;
        mobileMenu.classList.toggle('active', open);
        mobileMenu.setAttribute('aria-hidden', String(!open));
        document.body.style.overflow = open ? 'hidden' : '';
        if (menuToggle) menuToggle.setAttribute('aria-expanded', String(open));
    }

    if (menuToggle) menuToggle.addEventListener('click', () => setMenu(true));
    if (menuClose) menuClose.addEventListener('click', () => setMenu(false));

    document.querySelectorAll('.mobile-nav-links a').forEach(link => {
        link.addEventListener('click', () => setMenu(false));
    });

    // Escape closes the menu — it was previously a trap for keyboard users.
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && mobileMenu && mobileMenu.classList.contains('active')) {
            setMenu(false);
        }
    });

    // Navbar background on scroll, throttled to one rAF per frame.
    const navbar = document.querySelector('.navbar');
    let ticking = false;

    window.addEventListener(
        'scroll',
        () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
                ticking = false;
            });
        },
        { passive: true }
    );

    // Smooth scroll for in-page anchors.
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });
        });
    });
}

/* --------------------------------------------------------------------------
   Scrollspy — highlights the nav link for the section in view
   -------------------------------------------------------------------------- */
function initScrollSpy() {
    const sections = document.querySelectorAll('main section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    if (!sections.length || !navLinks.length) return;

    const spy = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            });
        },
        { rootMargin: '-45% 0px -50% 0px' }
    );

    sections.forEach(section => spy.observe(section));
}

/* --------------------------------------------------------------------------
   Scroll reveal
   -------------------------------------------------------------------------- */
function initReveal() {
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    if (prefersReducedMotion) {
        elements.forEach(el => el.classList.add('active'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('active');
                obs.unobserve(entry.target);
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    elements.forEach(el => observer.observe(el));
}

/* --------------------------------------------------------------------------
   Rotating hero pill
   The markup already carried #rotating-pill but nothing ever rotated it.
   -------------------------------------------------------------------------- */
function initRotatingPill() {
    const pill = document.getElementById('rotating-pill');
    if (!pill || prefersReducedMotion) return;

    const roles = [
        'Product Leader & AI Builder',
        'Engineering Team Lead',
        'INSEAD MBA 2026',
        '10 Years Shipping Software'
    ];

    let index = 0;

    window.setInterval(() => {
        if (document.hidden) return;
        index = (index + 1) % roles.length;
        pill.classList.add('swapping');
        window.setTimeout(() => {
            pill.textContent = roles[index];
            pill.classList.remove('swapping');
        }, 400);
    }, 3600);
}

/* --------------------------------------------------------------------------
   Magnetic buttons
   -------------------------------------------------------------------------- */
function initMagneticButtons() {
    if (!hasFinePointer || prefersReducedMotion) return;

    document.querySelectorAll('.magnetic-btn').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}

/* --------------------------------------------------------------------------
   3D particle network
   Additive blending only works on a dark page — on the light theme it adds
   light to an already-bright background and the particles vanish. So the
   materials are rebuilt per theme rather than merely recoloured.
   -------------------------------------------------------------------------- */
function initThreeJS() {
    const canvas = document.getElementById('hero-3d-canvas');
    if (!canvas || typeof THREE === 'undefined' || prefersReducedMotion) return;

    const THEME_COLORS = {
        dark: {
            point: 0x7c9bbf,
            line: 0x7c9bbf,
            pointOpacity: 0.75,
            lineOpacity: 0.16,
            blending: THREE.AdditiveBlending
        },
        light: {
            point: 0x3d6289,
            line: 0x3d6289,
            pointOpacity: 0.55,
            lineOpacity: 0.14,
            blending: THREE.NormalBlending
        }
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power'
    });
    // Cap the pixel ratio: on a 3x phone this was rendering 9x the pixels.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const range = 12;

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * range;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pointMaterial = new THREE.PointsMaterial({
        size: 0.06,
        transparent: true,
        depthWrite: false
    });

    const points = new THREE.Points(geometry, pointMaterial);
    scene.add(points);

    const lineMaterial = new THREE.LineBasicMaterial({
        transparent: true,
        depthWrite: false
    });

    const lineGeometry = new THREE.BufferGeometry();
    const lineObj = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineObj);

    // Exposed so applyTheme() can recolour the scene live, with no reload.
    window.__setSceneTheme = function (theme) {
        const c = THEME_COLORS[theme] || THEME_COLORS.dark;
        pointMaterial.color.setHex(c.point);
        pointMaterial.opacity = c.pointOpacity;
        pointMaterial.blending = c.blending;
        pointMaterial.needsUpdate = true;
        lineMaterial.color.setHex(c.line);
        lineMaterial.opacity = c.lineOpacity;
        lineMaterial.blending = c.blending;
        lineMaterial.needsUpdate = true;
    };

    window.__setSceneTheme(document.documentElement.getAttribute('data-theme') || 'dark');

    // Link nodes that sit close together. Positions never change, so this
    // O(n^2) pass runs exactly once.
    (function buildLines() {
        const pos = points.geometry.attributes.position.array;
        const linePositions = [];

        for (let i = 0; i < particleCount; i++) {
            for (let j = i + 1; j < particleCount; j++) {
                const dx = pos[i * 3] - pos[j * 3];
                const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
                const dz = pos[i * 3 + 2] - pos[j * 3 + 2];

                if (dx * dx + dy * dy + dz * dz < 5) {
                    linePositions.push(
                        pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2],
                        pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]
                    );
                }
            }
        }

        lineObj.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(linePositions, 3)
        );
    })();

    let mouseX = 0;
    let mouseY = 0;

    if (hasFinePointer) {
        document.addEventListener(
            'mousemove',
            event => {
                mouseX = event.clientX - window.innerWidth / 2;
                mouseY = event.clientY - window.innerHeight / 2;
            },
            { passive: true }
        );
    }

    function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (width <= 0 || height <= 0) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resize, 120);
    });
    resize();

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        // Browsers already throttle rAF in a background tab; this skips the
        // render call outright so a throttled tick costs nothing.
        if (document.hidden) return;

        const t = clock.getElapsedTime();

        points.rotation.y = t * 0.04;
        points.rotation.x = t * 0.02;
        lineObj.rotation.y = t * 0.04;
        lineObj.rotation.x = t * 0.02;

        scene.rotation.y += 0.05 * (mouseX * 0.0008 - scene.rotation.y);
        scene.rotation.x += 0.05 * (mouseY * 0.0008 - scene.rotation.x);

        renderer.render(scene, camera);
    }

    animate();
    canvas.classList.add('ready');
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCursor();
    initNav();
    initScrollSpy();
    initReveal();
    initRotatingPill();
    initMagneticButtons();
    initThreeJS();
});

window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});
