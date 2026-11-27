// A document's pages: the hero, where the document has one, and the pages under it. Where the layout
// pages one per turn, a turn of the wheel or a key eases to the next page and the screen rests there,
// and a touch screen scrolls natively and settles by the stylesheet's scroll snap. In one column the
// document moves only as the reader scrolls it. The pager at the screen's right edge marks the page on
// the screen and names each page beside its mark, each page's words rise in as it arrives, and the light
// behind the pages (.nave) comes from the side the page on the screen names in data-light.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');
  const pages = [...(hero ? [hero] : []), ...document.querySelectorAll('.page:not([hidden])')];
  const under = document.querySelector('.pages');
  // The one-column layout, as pages.css states it. Every other screen pages one per turn.
  const oneColumn = matchMedia('(max-width: 899px), (max-aspect-ratio: 11/10)');
  // How long a move takes, and how long the wheel must rest after it before it moves again, in ms:
  // a trackpad's flick sends wheel events for about a second after the fingers leave.
  const MOVE = 900, REST = 140;
  // The keys that turn a page, and which way.
  const KEYS = { PageDown: 1, ArrowDown: 1, ' ': 1, PageUp: -1, ArrowUp: -1 };
  // frame: the next step of the move under way.
  let moving = false, frame = 0, lastWheel = -Infinity, pagerGesture = false, lastCancelable = true;

  // Back and Forward: the browser gives the reader's place back after popstate, and the mandatory snap would move it to
  // another page's start, often the hero's. The snap is off (is-returning) until the next scroll, which in Chrome 157
  // is the browser's, in the frame after popstate, also when the place it gives back is where the document is. A
  // move under way stops, or its next step would take the screen from the place given back.
  function returned() {
    removeEventListener('scroll', returned);
    root.classList.remove('is-returning');
  }
  addEventListener('popstate', () => {
    halt();
    root.classList.add('is-returning');
    addEventListener('scroll', returned, { passive: true });
  });

  // With no hero, pages.css hides every picture but the one the build marks (tools/web_pages.py) until is-released.
  // That is set once the browser has shown the marked one, at a scroll, or RELEASE_BY ms after load, and at once
  // where no such paint will come: no marked picture shown, a reader already scrolled, or no Element Timing.
  // landing.js lets go what waits under a hero.
  const RELEASE_BY = 3000;
  if (!hero) {
    const first = document.querySelector('.page img[elementtiming]');
    const release = () => document.body.classList.add('is-released');
    if (!first?.offsetParent || scrollY > 0 || !window.PerformanceObserver?.supportedEntryTypes?.includes('element')) {
      release();
    } else {
      addEventListener('scroll', release, { once: true, passive: true });
      addEventListener('load', () => setTimeout(release, RELEASE_BY));
      new PerformanceObserver((list) => { if (list.getEntries().some((entry) => entry.element === first)) release(); })
        .observe({ type: 'element', buffered: true });
    }
  }

  function ease(k) {
    return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
  }

  function current() {
    const middle = scrollY + innerHeight / 2;
    let found = 0;
    pages.forEach((page, i) => { if (page.offsetTop <= middle) found = i; });
    return found;
  }

  // Eases the screen to place(), read at each step: a page not yet drawn is as tall as the screen until it is
  // (pages.css), so the place of a page further down can change as a move draws the pages it passes. Each step
  // starts from where the screen is: the browser moves the screen when a page above it is drawn taller.
  function move(place) {
    if (moving) return;
    if (still) {
      scrollTo({ top: place(), behavior: 'instant' });
      return;
    }
    moving = true;
    root.classList.add('is-paging');
    const start = performance.now();
    let done = 0;
    (function step(now) {
      const k = Math.min(1, (now - start) / MOVE);
      const eased = ease(k);
      // The share of what is left that this step covers, which gives the eased curve from the first place.
      scrollTo({ top: scrollY + (place() - scrollY) * (k < 1 ? (eased - done) / (1 - done) : 1), behavior: 'instant' });
      done = eased;
      if (k < 1) frame = requestAnimationFrame(step);
      else halt();
    })(start);
  }

  // Ends the move under way, where the screen is.
  function halt() {
    cancelAnimationFrame(frame);
    root.classList.remove('is-paging');
    moving = false;
  }

  function go(index) {
    const page = pages[Math.min(pages.length - 1, Math.max(0, index))];
    move(() => page.offsetTop);
  }

  // One step down or up: a page taller than the screen shows its far end before the next page.
  function turn(direction) {
    const index = current();
    const page = pages[index];
    const bottom = () => page.offsetTop + page.offsetHeight - innerHeight;
    if (direction > 0 && scrollY < bottom() - 1) move(bottom);
    else if (direction < 0 && scrollY > page.offsetTop + 1) move(() => page.offsetTop);
    else if (pages[index + direction]) go(index + direction);
  }

  // Chrome 157 lets a page cancel a wheel gesture only from its first event: when that one is not cancelled the rest
  // come with cancelable false and the browser scrolls, and when it is, each later one must be cancelled too. So a
  // gesture's first event decides for all of it. One that starts more across than up or down is the browser's, which
  // takes a trackpad's swipe across for Back and Forward only from a gesture whose first event no page cancelled.
  addEventListener('wheel', event => {
    if (oneColumn.matches || event.ctrlKey) return;
    // The rest is timed from when each event was made, not when it is handled, so a flick's events that a busy frame
    // queued still count as one turn. Every event updates lastWheel, so the tail of a gesture the browser scrolls
    // starts no turn. A gesture also starts at the first event the page can cancel after one it could not, which Chrome sends for the
    // next gesture after one the browser scrolled.
    const starts = event.timeStamp - lastWheel > REST || !lastCancelable;
    lastWheel = event.timeStamp;
    lastCancelable = event.cancelable;
    // An event the page cannot cancel belongs to a gesture the browser scrolls, even after a pause longer than REST.
    if (!event.cancelable) return;
    if (starts) pagerGesture = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
    if (!pagerGesture) return;
    event.preventDefault();
    if (starts && event.deltaY !== 0) turn(Math.sign(event.deltaY));
  }, { passive: false });

  // A control that takes keys of its own keeps them: the wipe's slider moves on the arrows, Page Up,
  // Page Down, Home and End, and a button presses on Space.
  addEventListener('keydown', event => {
    if (oneColumn.matches || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, select, textarea, [contenteditable]')) return;
    if (event.key === ' ' && event.target.closest('button')) return;
    const step = event.key === ' ' && event.shiftKey ? -1 : KEYS[event.key];
    if (step) {
      event.preventDefault();
      turn(step);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      go(event.key === 'Home' ? 0 : pages.length - 1);
    }
  });

  // The scroll position for a hash's target: #top goes to the hero, the pages as a whole to their
  // first page, and a page to its start. An item inside a page goes to its page's start when it fits
  // on the screen from there, and otherwise to its own top less its scroll margin, which keeps it
  // clear of the nav, no further than the page's last screen. A scroll to the item itself can stop
  // between two pages' starts, where the mandatory snap moves it to the nearer page. The item's top is
  // read from the layout, without the transform that holds a page's words down until it arrives.
  function placed(target) {
    if (target.id === 'top') return pages[0].offsetTop;
    const page = target === under ? under.querySelector('.page') : target.closest('.page, .hero');
    if (!page) return null;
    let top = 0;
    for (let node = target; node; node = node.offsetParent) top += node.offsetTop;
    if (target === page || top + target.offsetHeight <= page.offsetTop + innerHeight) return page.offsetTop;
    const clear = top - parseFloat(getComputedStyle(target).scrollMarginTop);
    return Math.max(page.offsetTop, Math.min(clear, page.offsetTop + page.offsetHeight - innerHeight));
  }

  // The element a hash names, or null. A hash that is not a valid escape names its text as it is.
  function named(hash) {
    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* the hash as typed */ }
    return id ? document.getElementById(id) : null;
  }

  // The page's own links move as the wheel does. A folder's address and its index.html are one page. A link other
  // than the pager's marks adds the entry the browser would have added, so Back returns the reader to where they
  // followed it from. It adds the hash alone, which keeps the address's form of the page, and only for a click that
  // moves: move() does nothing while another move runs. The marks are the pager's scrollbar and add none.
  const folder = path => (path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href*="#"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || oneColumn.matches || link.origin !== location.origin || folder(link.pathname) !== folder(location.pathname)) return;
    const target = named(link.hash);
    if (!target || placed(target) === null) return;
    event.preventDefault();
    if (moving) return;
    if (link.hash !== location.hash && !pager.contains(link)) history.pushState(null, '', link.hash);
    move(() => placed(target));
  });

  // A hash that changes in place: typed into the address, followed in one column, or reached with Back or
  // Forward, which goes to the item and not to the place the browser gives back.
  addEventListener('hashchange', () => {
    halt();
    const target = named(location.hash);
    const to = target ? placed(target) : null;
    if (to !== null) scrollTo({ top: to, behavior: 'instant' });
  });

  const pager = document.createElement('nav');
  pager.className = 'pager';
  pager.setAttribute('aria-label', under.dataset.pager);
  pages.forEach(page => {
    const dot = document.createElement('a');
    if (!page.id) page.id = 'hero';
    dot.href = `#${page.id}`;
    dot.setAttribute('aria-label', page === hero ? 'Sun Forge' : page.querySelector('h1, h2').textContent);
    dot.dataset.name = page.dataset.name ?? 'Sun Forge';
    // The hero's dot shows the name, which every language shows as it is.
    if (page === hero) dot.translate = false;
    pager.append(dot);
  });
  document.body.append(pager);

  // An address with a hash, followed from a link or typed: the target's place, held against every scroll
  // until a second after the page has loaded or the reader's first input. The browser's own scroll to
  // the hash can come after this script or after the load. It puts the item's top at the screen's top
  // where placed() may choose its page's start, and in the paging layout the snap then moves it to a
  // page. A reload and a return keep the place the browser gives back.
  const arrival = performance.getEntriesByType('navigation')[0];
  const target = location.hash && (!arrival || arrival.type === 'navigate') ? named(location.hash) : null;
  if (target && placed(target) !== null) {
    const nav = document.querySelector('.nav');
    const shown = () => {
      const box = target.getBoundingClientRect();
      return box.top >= nav.getBoundingClientRect().bottom && box.bottom <= innerHeight;
    };
    const land = () => { if (!shown()) scrollTo({ top: placed(target), behavior: 'instant' }); };
    const inputs = ['wheel', 'keydown', 'touchstart', 'pointerdown'];
    const stop = () => {
      removeEventListener('scroll', land);
      removeEventListener('load', loaded);
      for (const kind of inputs) removeEventListener(kind, stop);
    };
    const loaded = () => { land(); setTimeout(stop, 1000); };
    land();
    addEventListener('scroll', land, { passive: true });
    for (const kind of inputs) addEventListener(kind, stop, { once: true, passive: true });
    if (document.readyState === 'complete') loaded();
    else addEventListener('load', loaded, { once: true });
  }

  function mark() {
    const index = current();
    [...pager.children].forEach((dot, i) => { dot.setAttribute('aria-current', String(i === index)); });
    pager.classList.toggle('is-on', !hero || index > 0);
    under.dataset.light = pages[index].dataset.light ?? 'none';
    pages.forEach(page => {
      if (page.classList.contains('is-in')) return;
      const box = page.getBoundingClientRect();
      if (box.top < innerHeight * 0.7 && box.bottom > innerHeight * 0.3) {
        // A page a jump lands on is not drawn yet and has no style to rise from (pages.css), so its parts take the
        // style they wait in before the page is marked.
        for (const part of page.children) void getComputedStyle(part).opacity;
        page.classList.add('is-in');
      }
    });
  }
  addEventListener('scroll', mark, { passive: true });
  addEventListener('resize', mark);
  mark();
  // After the first mark(), so the page on the screen at load shows at once: marked later, it would rise in.
  under.classList.add('is-paged');
})();
