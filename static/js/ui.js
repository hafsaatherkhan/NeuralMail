/**
 * Shared UI: mobile nav, scroll reveals, dashboard drawer
 */
(function () {
    function initMobileMenu() {
        const btn = document.getElementById('menu-btn');
        const menu = document.getElementById('mobile-menu');
        if (!btn || !menu) return;

        btn.addEventListener('click', () => {
            const open = menu.classList.toggle('is-open');
            menu.classList.toggle('hidden', !open);
            if (open) {
                menu.style.display = 'flex';
                menu.classList.add('flex-col');
            } else {
                setTimeout(() => {
                    if (!menu.classList.contains('is-open')) menu.style.display = '';
                }, 400);
            }
        });

        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                menu.classList.remove('is-open');
                menu.classList.add('hidden');
            });
        });
    }

    function initScrollReveal() {
        const els = document.querySelectorAll('.reveal-on-scroll');
        if (!els.length) return;

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );

        els.forEach((el) => io.observe(el));
    }

    function initDashboardDrawer() {
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const toggle = document.getElementById('sidebar-toggle');
        const closeBtn = document.getElementById('sidebar-close');

        if (!sidebar) return;

        function open() {
            sidebar.classList.add('is-open');
            overlay?.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        }

        function close() {
            sidebar.classList.remove('is-open');
            overlay?.classList.remove('is-open');
            document.body.style.overflow = '';
        }

        toggle?.addEventListener('click', open);
        closeBtn?.addEventListener('click', close);
        overlay?.addEventListener('click', close);

        sidebar.querySelectorAll('.nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (window.innerWidth < 1024) close();
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) close();
        });
    }

    function staggerSection(sectionEl) {
        if (!sectionEl) return;
        sectionEl.classList.remove('stagger-children');
        void sectionEl.offsetWidth;
        sectionEl.classList.add('stagger-children');
    }

    document.addEventListener('DOMContentLoaded', () => {
        initMobileMenu();
        initScrollReveal();
        initDashboardDrawer();
    });

    window.NeuralUI = { staggerSection, initScrollReveal };
})();
