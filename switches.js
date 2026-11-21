// The page's switches, its wipe and its pixel art. window.slideOrScroll decides whether a finger on an element slides
// or scrolls the page.
//
// A switch is a group of buttons, [data-switch="<axis>"], each [data-pick="<value>"], one of them
// pressed. Pressing one writes its value to the page's [data-picks] element as data-<axis>, and shows
// the pictures there whose own data-<axis> attributes match every pick, so a scene under two
// switches, the hour's and the style's, shows the picture of both, and a picture with no attribute
// of an axis shows at any pick of it. Any other part of the page with a data-<axis> attribute, such as
// a figure of the look a switch picks, shows by the same rule through its hidden attribute, as the
// pictures change. A button with data-locks="<axis> ..." disables each axis's switch while it is pressed.
// The ring reads its clip and its target from the same attributes.
//
// A picture marked data-late is off the page and loads lazily, so the browser leaves its file. Its
// files and size are in a list at the site's root, which <html data-late> names and this script fetches
// as it starts (tools/web_pages.py, HELD). A press that wants it puts it on the page and loads it, and
// the picture it replaces stays until it has decoded, and while the list has not come. Once the reader
// has stayed on a page for DWELL, and the document has let go what waits for its first screen
// (pages.css), the page loads the pictures one press away, so the next press shows its picture at
// once. It then marks its [data-picks] element data-ahead, which ring.js reads to download ahead.
//
// The wipe draws one picture over another up to the seam, which moves from edge to edge of the frame. A mouse press
// or a tap brings the seam to the pointer, except on the star, where it leaves the seam, so a drag keeps the star
// where it was grabbed. The mouse drags the seam from its press, which gives the wipe's slider the keys. A finger or
// a pen that moves either scrolls the page or slides the seam, by the way it first moves. Each side's name rides the
// seam, and fades while its side is too narrow to hold it whole.
//
// A Pixel picture is at one pixel per texel. Enlarged, it draws with no smoothing, so its texels stay
// square. Shrunk, it keeps the browser's smoothing, because a texel dropped whole breaks an outline.
(() => {
  // How long a page is on the screen before it takes the pictures one press away, in ms.
  const DWELL = 700;
  const sparing = navigator.connection?.saveData === true;
  // Settles once the document holds no picture back for its first screen: at once where it holds none (pages.css).
  const released = new Promise(done => {
    const body = document.body;
    const free = () => body.classList.contains('is-released');
    if (free() || !document.querySelector('.hero, img[elementtiming]')) done();
    else new MutationObserver((_, watch) => { if (free()) { watch.disconnect(); done(); } }).observe(body, { attributeFilter: ['class'] });
  });

  const take = picture => {
    if (!('late' in picture.dataset) || !picture.hasAttribute('src')) return;
    delete picture.dataset.late;
    picture.loading = 'eager';
  };

  // How many times the list is fetched before a call gives up, and the wait before the first retry, in ms, which
  // doubles at each retry.
  const TRIES = 4, RETRY = 1000;
  // Gives each held picture the attributes its list holds for it, one picture a line in page order. A call that gave
  // up leaves them as they are, and the next call fetches again.
  const list = document.documentElement.dataset.late;
  const held = [...document.querySelectorAll('img[data-late]:not([src])')];
  const fetched = (tries, wait) => fetch(new URL(list, document.baseURI), { priority: 'low' })
    .then(answer => answer.ok ? answer.text() : Promise.reject(answer.status))
    .catch(error => tries > 1 ? new Promise(done => setTimeout(done, wait)).then(() => fetched(tries - 1, wait * 2)) : Promise.reject(error));
  let filling = null;
  const filled = () => {
    if (!list || held.every(picture => picture.hasAttribute('src'))) return Promise.resolve();
    filling ??= fetched(TRIES, RETRY)
      .then(text => {
        const files = document.createElement('template');
        files.innerHTML = text;
        [...files.content.children].forEach((source, at) => {
          for (const { name, value } of source.attributes) held[at]?.setAttribute(name, value);
        });
      })
      .catch(() => { filling = null; });
    return filling;
  };
  filled();

  for (const picks of document.querySelectorAll('[data-picks]')) {
    const page = picks.closest('.page');
    const groups = [...page.querySelectorAll('[data-switch]')];
    const axes = groups.map(group => group.dataset.switch);
    const pictures = [...picks.querySelectorAll('img')];
    const parts = axes.length ? [...page.querySelectorAll(axes.map(axis => `[data-${axis}]`).join())]
      .filter(part => part !== picks && part.tagName !== 'IMG') : [];
    const shows = (picture, at) => axes.every(axis => !(axis in picture.dataset) || picture.dataset[axis] === at[axis]);
    let turn = 0;

    // Shows the pictures of the picks. Asked to wait, it keeps the pictures on show until the new ones have decoded.
    const show = wait => {
      const wanted = pictures.filter(picture => shows(picture, picks.dataset));
      const mine = ++turn;
      const swap = () => {
        if (mine !== turn) return;
        pictures.forEach(picture => picture.classList.toggle('on', wanted.includes(picture)));
        parts.forEach(part => { part.hidden = !shows(part, picks.dataset); });
      };
      const go = () => {
        if (mine !== turn || !wanted.every(picture => picture.hasAttribute('src'))) return;
        wanted.forEach(take);
        if (wait) Promise.all(wanted.map(picture => picture.decode().catch(() => { /* a broken picture shows its alt */ }))).then(swap);
        else swap();
      };
      if (wanted.every(picture => picture.hasAttribute('src'))) go();
      else filled().then(go);
    };

    const warm = () => {
      if (sparing) return;
      picks.dataset.ahead = '';
      for (const group of groups) {
        for (const button of group.querySelectorAll('[data-pick]:not(:disabled)')) {
          const at = { ...picks.dataset, [group.dataset.switch]: button.dataset.pick };
          filled().then(() => pictures.filter(picture => shows(picture, at)).forEach(take));
        }
      }
    };
    let dwelt = false, timer = 0;
    new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (entry.isIntersecting && !dwelt) timer = setTimeout(() => released.then(() => { dwelt = true; warm(); }), DWELL);
    }, { threshold: 0.6 }).observe(page);

    for (const group of groups) {
      const axis = group.dataset.switch;
      const buttons = [...group.querySelectorAll('[data-pick]')];
      const locksOf = button => (button.dataset.locks || '').split(' ').filter(Boolean);
      const lockable = new Set(buttons.flatMap(locksOf));
      const press = (button, wait) => {
        buttons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
        picks.dataset[axis] = button.dataset.pick;
        for (const locked of lockable) {
          page.querySelectorAll(`[data-switch="${locked}"] [data-pick]`).forEach(other => { other.disabled = locksOf(button).includes(locked); });
        }
        show(wait);
        if (dwelt) warm();
      };
      buttons.forEach(button => button.addEventListener('click', () => press(button, true)));
      press(buttons.find(button => button.getAttribute('aria-pressed') === 'true'), false);
    }
  }

  // How far a finger or a pen moves before slideOrScroll decides whether it slides or the page scrolls, in CSS pixels:
  // it slides if the touch moved further across than down.
  const SLOP = 5;
  // Decides whether a press of the primary pointer's main button on element slides or leaves the page to scroll. A
  // mouse press slides at once. press runs at every such press. move runs for each move of a press that slides, for a
  // mouse first with its press, and for a touch or a pen with the move that decides it. lift, if given, runs at the
  // press's pointerup. cancel runs when the browser or a second finger takes a press that slid. A press that slides
  // captures its pointer, so it slides on wherever the pointer goes until it lifts.
  window.slideOrScroll = (element, { press, move, lift, cancel }) => {
    let grip = null;
    element.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      grip = { id: event.pointerId, x: event.clientX, y: event.clientY, sliding: false };
      press(event);
      if (event.pointerType !== 'mouse') return;
      grip.sliding = true;
      element.setPointerCapture(event.pointerId);
      move(event);
    });
    element.addEventListener('pointermove', event => {
      if (event.pointerId !== grip?.id) return;
      if (!grip.sliding) {
        const across = Math.abs(event.clientX - grip.x), down = Math.abs(event.clientY - grip.y);
        if (Math.hypot(across, down) < SLOP) return;
        if (across <= down) {
          grip = null;
          return;
        }
        grip.sliding = true;
        element.setPointerCapture(event.pointerId);
      }
      move(event);
    });
    element.addEventListener('pointerup', event => {
      if (event.pointerId !== grip?.id) return;
      grip = null;
      lift?.(event);
    });
    const drop = () => {
      if (grip?.sliding) cancel();
      grip = null;
    };
    element.addEventListener('pointercancel', event => { if (event.pointerId === grip?.id) drop(); });
    // touch-action keeps a slide from scrolling in Chrome. Safari's scroll can still follow a slide's drift down, so a
    // sliding touch cancels its moves. pointermove runs before the touchmove of the same movement, so a slide that has
    // just started cancels its first one. A touch that lands while the page still glides sends moves the page cannot
    // cancel, and still slides.
    element.addEventListener('touchmove', event => {
      if (!grip) return;
      if (event.touches.length > 1) drop();
      else if (grip.sliding && event.cancelable) event.preventDefault();
    }, { passive: false });
  };

  for (const wipe of document.querySelectorAll('[data-wipe]')) {
    const range = wipe.querySelector('input'), seam = wipe.querySelector('.seam');
    const left = wipe.querySelector('.left'), right = wipe.querySelector('.right');
    // The seam's place in percent of the frame. A drag sets it between the slider's whole steps.
    let at = Number(range.value);
    const place = () => {
      const width = wipe.clientWidth;
      if (!width) return;
      wipe.style.setProperty('--at', `${at}%`);
      left.toggleAttribute('data-closed', left.offsetWidth > at / 100 * width);
      right.toggleAttribute('data-closed', right.offsetWidth > (100 - at) / 100 * width);
    };
    const set = value => {
      at = Math.min(100, Math.max(0, value));
      range.value = Math.round(at);
      place();
    };
    range.addEventListener('input', () => set(Number(range.value)));
    const sized = new ResizeObserver(place);
    [wipe, left, right].forEach(part => sized.observe(part));

    const percent = event => {
      const box = wipe.getBoundingClientRect();
      return (event.clientX - box.left) / box.width * 100;
    };
    // Where the seam stood when the press landed, and the seam's offset from a landing on the star, measured at the
    // landing so a slide keeps the star where it was grabbed.
    let startAt = at, offset = 0;
    slideOrScroll(wipe, {
      press: event => {
        const box = wipe.getBoundingClientRect(), star = parseFloat(getComputedStyle(seam, '::after').width) / 2;
        const onStar = Math.abs(event.clientX - (box.left + at / 100 * box.width)) <= star
          && Math.abs(event.clientY - (box.top + box.height / 2)) <= star;
        startAt = at;
        offset = onStar ? at - percent(event) : 0;
      },
      move: event => set(percent(event) + offset),
      // Focused once the press is over, so no default of the press can move the focus off it. A focus a script gives
      // shows the star's keyboard frame unless focusVisible is false, which Chrome before 145 and Safari before 18.4
      // ignore.
      lift: event => { if (event.pointerType === 'mouse') range.focus({ preventScroll: true, focusVisible: false }); },
      cancel: () => set(startAt),
    });
    // A tap places the seam as a mouse press does. click is the browser's judgment of a tap, so a touch that scrolled
    // the page or stopped its glide places nothing. A mouse's click repeats the place its last move set. A click a
    // script or an assistive tool sends to the slider has no point the reader chose, so only a click on the frame
    // itself counts.
    wipe.addEventListener('click', event => { if (event.target === wipe) set(percent(event) + offset); });

    // A side a switch picks is named as the option in use.
    const named = wipe.querySelector('[data-names]');
    if (named) {
      const group = wipe.closest('.page').querySelector(`[data-switch="${named.dataset.names}"]`);
      const name = () => { named.textContent = group.querySelector('[aria-pressed="true"]').textContent; };
      group.addEventListener('click', name);
      name();
    }
    place();
  }

  const pixelArt = [...document.querySelectorAll('.scene img[data-style="pixel"]')];
  // A hidden picture has no width to judge by, so each is judged when it shows, loads or changes size.
  const crisp = () => pixelArt.filter(picture => picture.clientWidth && picture.naturalWidth).forEach(picture => {
    picture.style.imageRendering = picture.clientWidth * devicePixelRatio >= picture.naturalWidth ? 'pixelated' : '';
  });
  const watcher = new ResizeObserver(crisp);
  pixelArt.forEach(picture => { picture.addEventListener('load', crisp); watcher.observe(picture); });
})();
