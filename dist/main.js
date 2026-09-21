(() => {
  const route = document.querySelector('#route-file');
  const files = [...document.querySelectorAll('.file')];
  const sections = [...document.querySelectorAll('[data-route]')];
  const topbar = document.querySelector('.topbar');
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const motionMedia = window.matchMedia('(prefers-reduced-motion: no-preference)');

  const activate = (section) => {
    if (!section) return;
    if (route) route.textContent = section.dataset.route;
    files.forEach((file) => {
      const current = file.dataset.file === section.id;
      file.classList.toggle('is-active', current);
      if (current) file.setAttribute('aria-current', 'true');
      else file.removeAttribute('aria-current');
    });
  };

  // --- Section navigation -------------------------------------------------
  // A scene plays its reveals across its own scroll length, so the very top of
  // a scene is the one spot where nothing has appeared yet. Anchors aim past
  // the last reveal instead, otherwise every link lands on an empty screen.
  const isStoryScene = (section) => {
    const sticky = section.querySelector('.scene__sticky');
    return !!sticky && getComputedStyle(sticky).position === 'sticky';
  };

  const targetFor = (section) => {
    const top = section.getBoundingClientRect().top + window.scrollY;
    const travel = section.offsetHeight - window.innerHeight;
    if (travel > 0 && isStoryScene(section)) {
      const played = [...section.querySelectorAll('.reveal')]
        .reduce((max, item) => Math.max(max, Number(item.dataset.out) || 0), 0);
      return top + travel * clamp(played + .04);
    }
    return Math.max(0, top - (topbar ? topbar.offsetHeight : 0));
  };

  const sectionFor = (hash) => {
    if (!hash || hash.length < 2) return null;
    let section = null;
    try { section = document.querySelector(hash); } catch { return null; }
    return section && section.hasAttribute('data-route') ? section : null;
  };

  const goTo = (section) => {
    const top = targetFor(section);
    // The page is ~13 viewports tall; smooth-scrolling the full length is a
    // long stare at scenery, so only animate short hops.
    const near = Math.abs(top - window.scrollY) < window.innerHeight * 3;
    window.scrollTo({ top, behavior: near && motionMedia.matches ? 'smooth' : 'instant' });
    activate(section);
  };

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    const section = sectionFor(hash);
    if (!section) return;
    event.preventDefault();
    closeMenu();
    goTo(section);
    // Deliberately not writing the fragment into the URL. The browser keeps a
    // tab on its last address, so a stored "#mizaan" would reopen the site
    // mid-story instead of at the top.
  });

  // A scroll story has to begin at the beginning. Left on 'auto' the browser
  // restores the previous offset, so reopening the tab drops you into
  // whichever scene you happened to stop on.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const deepLink = sectionFor(location.hash);
  if (deepLink) {
    // A shared link like /#mizaan still lands on that scene. The fragment is
    // dropped from the URL and left off: it also stops the browser re-applying
    // its own fragment scroll every time a late layout change undoes ours.
    history.replaceState(null, '', location.pathname + location.search);
    const settle = () => {
      window.scrollTo({ top: targetFor(deepLink), behavior: 'instant' });
      activate(deepLink);
    };
    settle();
    window.addEventListener('load', settle);
    (document.fonts ? document.fonts.ready : Promise.resolve())
      .then(() => setTimeout(settle, 60));
  }

  // --- Mobile drawer ------------------------------------------------------
  const menuToggle = document.querySelector('.menu-toggle');
  const explorer = document.querySelector('.explorer');
  const scrim = document.querySelector('.menu-scrim');

  function closeMenu(returnFocus) {
    if (!menuToggle || menuToggle.getAttribute('aria-expanded') !== 'true') return;
    menuToggle.setAttribute('aria-expanded', 'false');
    explorer.classList.remove('is-open');
    document.body.classList.remove('is-menu-open');
    if (returnFocus) menuToggle.focus();
  }

  if (menuToggle && explorer) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      if (open) return closeMenu(true);
      menuToggle.setAttribute('aria-expanded', 'true');
      explorer.classList.add('is-open');
      document.body.classList.add('is-menu-open');
      const first = explorer.querySelector('.file');
      if (first) first.focus();
    });
    if (scrim) scrim.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu(true);
    });
  }

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const active = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (active) activate(active.target);
    }, { rootMargin: '-22% 0px -62%', threshold: [0, .15, .4, .7] });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  const compactLayout = window.matchMedia('(max-width: 700px)');
  const nativeTimelines = !new URLSearchParams(window.location.search).has('force-js-motion') &&
    CSS.supports('animation-timeline: view()') &&
    CSS.supports('animation-range: contain 0% contain 100%');

  const scenes = [...document.querySelectorAll('.scene')].map((element) => ({
    element,
    reveals: [...element.querySelectorAll('.reveal')].map((item) => ({
      item,
      start: clamp(Number(item.dataset.in) || 0),
      end: clamp(Number(item.dataset.out) || .2),
      top: 0,
    })),
    heroCopy: element.querySelector('.hero-copy'),
    code: element.querySelector('.code-window'),
    cue: element.querySelector('.scroll-cue'),
    line: element.querySelector('.transition-line'),
    lineDot: element.querySelector('.transition-line span'),
    bus: element.querySelector('.capability-bus'),
    pipelineDot: element.querySelector('.pipeline-flow span'),
    documentDot: element.querySelector('.document-flow span'),
    start: 0,
    height: 0,
    travel: 1,
    last: -1,
  }));

  if (nativeTimelines) {
    scenes.forEach((scene) => scene.reveals.forEach(({ item, start, end }) => {
      item.style.setProperty('--reveal-start', `${start * 100}%`);
      item.style.setProperty('--reveal-end', `${Math.max(start + .01, end) * 100}%`);
    }));
    document.documentElement.classList.add('scroll-animated');
    return;
  }

  // Fallback for browsers without CSS scroll timelines. Geometry is measured
  // only on resize; each scroll frame writes to the one or two visible scenes.
  let enabled = false;
  let ticking = false;

  const clearMotion = () => {
    document.documentElement.classList.remove('scroll-fallback');
    scenes.forEach((scene) => {
      scene.last = -1;
      scene.reveals.forEach(({ item }) => {
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
      });
      [scene.heroCopy, scene.code, scene.line, scene.lineDot,
        scene.bus, scene.pipelineDot, scene.documentDot].forEach((item) => {
        if (item) {
          item.style.removeProperty('opacity');
          item.style.removeProperty('transform');
        }
      });
      if (scene.cue) scene.cue.style.removeProperty('opacity');
    });
    if (topbar) topbar.style.removeProperty('--page-progress');
  };

  const render = () => {
    ticking = false;
    if (!enabled) return;
    const scrollY = window.scrollY;
    const viewport = window.innerHeight;
    const compact = compactLayout.matches;
    const pageTravel = Math.max(1, document.documentElement.scrollHeight - viewport);
    if (topbar) topbar.style.setProperty('--page-progress', (scrollY / pageTravel).toFixed(4));

    scenes.forEach((scene) => {
      if (scrollY + viewport < scene.start || scrollY > scene.start + scene.height) return;
      const progress = clamp((scrollY - scene.start) / scene.travel);
      if (Math.abs(progress - scene.last) < .001) return;
      scene.last = progress;

      scene.reveals.forEach(({ item, start, end, top }) => {
        const amount = compact
          ? clamp((scrollY + viewport - top) / Math.max(1, viewport * .35))
          : clamp((progress - start) / Math.max(.01, end - start));
        item.style.opacity = String(amount);
        item.style.transform = compact
          ? `translate3d(0, ${(1 - amount) * 30}px, 0)`
          : `translate3d(0, ${(1 - amount) * 64}px, 0) scale(${.9 + amount * .1})`;
      });

      if (scene.heroCopy) {
        if (compact && viewport <= 700) {
          scene.heroCopy.style.removeProperty('transform');
          scene.heroCopy.style.removeProperty('opacity');
          if (scene.code) scene.code.style.removeProperty('transform');
        } else {
          const amount = clamp((progress - (compact ? .15 : .2)) / (compact ? .85 : .8));
          scene.heroCopy.style.transform = compact
            ? `translate3d(0, ${amount * -55}px, 0) scale(${1 - amount * .18})`
            : `translate3d(0, ${amount * -55}px, 0) scale(${1 - amount * .22})`;
          scene.heroCopy.style.opacity = String(1 - amount * (compact ? .75 : .68));
          if (scene.code) scene.code.style.transform = compact
            ? `translate3d(0, ${amount * -65}px, 0) scale(${1 + amount * .06})`
            : `translate3d(${amount * -110}px, ${amount * 20}px, 0) scale(${1 + amount * .18})`;
        }
        if (scene.cue) scene.cue.style.opacity = String(1 - clamp(progress / .22));
      }

      const lineProgress = clamp((progress - .62) / .3);
      if (scene.line) scene.line.style.transform = `scaleX(${lineProgress})`;
      if (scene.lineDot) scene.lineDot.style.transform = `translate3d(${lineProgress * 42}vw, 0, 0)`;
      if (scene.bus) scene.bus.style.transform = `scaleX(${clamp((progress - .48) / .34)})`;
      if (scene.pipelineDot) scene.pipelineDot.style.transform = `translate3d(${clamp((progress - .28) / .5) * 58}vw, 0, 0)`;
      if (scene.documentDot) scene.documentDot.style.transform = `translate3d(${clamp((progress - .28) / .52) * 66}vw, 0, 0)`;
    });
  };

  const requestRender = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(render);
    }
  };

  const measure = () => {
    const scrollY = window.scrollY;
    scenes.forEach((scene) => {
      scene.start = scene.element.getBoundingClientRect().top + scrollY;
      scene.height = scene.element.offsetHeight;
      scene.travel = Math.max(1, scene.height - window.innerHeight);
      scene.last = -1;
      scene.reveals.forEach((reveal) => {
        reveal.top = reveal.item.getBoundingClientRect().top + scrollY;
      });
    });
    requestRender();
  };

  const updateMode = () => {
    if (motionMedia.matches === enabled) return;
    enabled = motionMedia.matches;
    if (enabled) {
      measure();
      document.documentElement.classList.add('scroll-fallback');
      render();
    } else {
      clearMotion();
    }
  };

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  motionMedia.addEventListener('change', updateMode);
  compactLayout.addEventListener('change', measure);
  document.fonts?.ready.then(measure);
  updateMode();
})();
