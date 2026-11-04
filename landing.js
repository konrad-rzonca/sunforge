// The hero: the scene's plate, with embers.js's embers rising past the star. scene.js, written by
// tools/web.py from the rendered frame, gives the plate's size and files, the star's box, the
// anvil's box and the stand's lit top in it, the night its floor fades into and a map of its
// brightness. The frame has the star's middle, the anvil's mass and its stand on one vertical,
// which the centered layout puts on the screen's middle axis.
(() => {
  const scene = window.SCENE;
  const root = document.documentElement;
  const body = document.body;
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.stage');
  const layers = {
    plate: stage.querySelector('.plate'),
    under: stage.querySelector('.embers.under'),
    over: hero.querySelector('.embers.over'),
  };
  const copy = document.querySelector('.copy');
  const title = copy.querySelector('h1');
  const words = [...title.querySelectorAll('.word')];
  const slogan = copy.querySelector('.slogan');
  const actions = copy.querySelector('.actions');
  const meta = copy.querySelector('.meta');
  const nav = document.querySelector('.nav');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Under 1.1 by 1 the subject and the copy stack.
  const narrowQuery = matchMedia('(max-aspect-ratio: 11/10)');
  // The plate's pointer parallax in screen pixels, and the margin the layout keeps for it.
  const PARALLAX = 6;
  const PAD = PARALLAX + 2;
  // The widest band the nav and the hero use: on a screen wider than 16 by 9, both keep to a 16 by
  // 9 band in the middle, and the screen shows more of the scene at both sides.
  const FRAME = 16 / 9;
  // The height under which the copy beside the subject leaves out the note.
  const SHORT = 640;
  // Beside the copy, the star's middle stands this far down the screen: a frame's optical middle
  // lies a little above its geometric one, and the copy, which runs further below the name than
  // above it, then centers on the screen.
  const STAR_AT = 0.42;
  // League Spartan's vertical metrics in em: its capitals' height, and the ascent and descent that
  // set a line box's content area.
  const CAP = 0.66, ASCENT = 0.7, DESCENT = 0.22;
  // The name's tracking, and how far the ink of its last letter, FORGE's E or SUN's N at weight
  // 800, stands in from the end of its advance; and how far SUN's S stands into its box.
  const TRACK = -0.016, E_RIGHT = 0.0683, S_LEFT = 0.0098;
  // The name's size beside the subject at which the plate is drawn at its own size (--k = 1).
  const PLATE_TITLE = 176;
  // Where the copy would not fit between the nav and the foot band with its line on the subject's
  // optical middle, the actions stand side by side past FORGE's E rather than stacked, then the
  // name shrinks by steps of SHRINK_STEP down to SHRINK_LEAST of its size, then the note goes and
  // the name shrinks again from its full size by the same steps; past that the copy is held
  // between the nav and the foot band, off the subject's middle.
  const SHRINK_STEP = 0.97, SHRINK_LEAST = 0.8;
  // Beside the subject, the gap between the subject's optical edge and the copy's ink, as a part
  // of the equal spaces left of the subject and right of the copy.
  const BETWEEN = 0.8;

  const [W, H] = scene.size;
  const [sl, st, sr, sb] = scene.star;
  const star = { left: sl, top: st, right: sr, bottom: sb, x: (sl + sr) / 2, y: (st + sb) / 2, h: sb - st };
  const [al, at, ar, ab] = scene.anvil;
  const anvil = { left: al, top: at, right: ar, bottom: ab };
  // The stand under the anvil: its lit top face runs from top to edge, and the name keeps clear of
  // the edge, where the scene starts to fade into the night.
  const stand = { left: scene.stand[0], top: scene.stand[1], right: scene.stand[2], edge: scene.stand[3] };
  // The subject: the box round the star and the anvil, from the star's top tip to the anvil's feet.
  const subject = { left: Math.min(sl, al), top: Math.min(st, at), right: Math.max(sr, ar), bottom: Math.max(sb, ab) };
  // Its optical width: the star's, and the anvil's heel where it reaches past. The horn tapers to a
  // point and adds no weight at its tip, so the eye takes the subject's left edge at the star's
  // side ray and the block under it, and the horn reaches into the space beside them.
  const optical = { left: sl, right: Math.max(sr, ar) };
  // The subject's optical middle, which the name and the slogan center on: halfway from the star's
  // middle to the gap between its lower tip and the anvil's face, since the bright star outweighs
  // the larger dark anvil.
  const opticalMiddle = (star.y + (star.bottom + anvil.top) / 2) / 2;
  stage.style.width = `${W}px`;
  stage.style.height = `${H}px`;

  if (scene.night) root.style.setProperty('--night', `rgb(${scene.night.join(' ')})`);

  const px = (name, value) => root.style.setProperty(name, `${value}px`);
  const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
  const textWidth = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect();
  };

  // Where text-box is missing, landing.css trims each line with margins from the face's metrics,
  // which leave the element's own box untrimmed: ink() reads an element's ink top and height, from
  // its first capitals to its last baseline, either way.
  function ink(el) {
    const top = el.offsetTop, height = el.offsetHeight;
    if (getComputedStyle(root).getPropertyValue('--untrimmed').trim() !== '1') return { top, height };
    const style = getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    const lead = (parseFloat(style.lineHeight) / size - ASCENT - DESCENT) / 2;
    const above = (lead + ASCENT - CAP) * size, below = (lead + DESCENT) * size;
    return { top: top + above, height: height - above - below };
  }

  // The copy's ink width from its left edge to the furthest ink at its right: the name's last
  // letter, the slogan's lines or the actions, each measured on its own text.
  function inkWidth() {
    const left = copy.getBoundingClientRect().left;
    const size = parseFloat(getComputedStyle(title).fontSize);
    const parts = [textWidth(title).right - (E_RIGHT + TRACK) * size, actions.getBoundingClientRect().right];
    for (const line of slogan.querySelectorAll('span')) parts.push(textWidth(line).right);
    if (meta.offsetParent) parts.push(textWidth(meta).right);
    return Math.max(...parts) - left;
  }

  // The actions' row, after the name's size changes: beside the subject the plate scales with the
  // name (--k) and the row ends where FORGE's E ends; centered it runs from SUN's S to FORGE's E.
  function sizeRow(centered) {
    const size = parseFloat(getComputedStyle(title).fontSize);
    root.style.setProperty('--k', `${size / PLATE_TITLE}`);
    const name = textWidth(title);
    if (root.classList.contains('row-free')) {
      root.style.setProperty('--row', 'max-content');
      actionsWrap();
      return;
    }
    const row = centered
      ? name.width - (S_LEFT + E_RIGHT + TRACK) * size
      : textWidth(title.querySelector('.forge')).right - (E_RIGHT + TRACK) * size - copy.getBoundingClientRect().left;
    px('--row', Math.round(row));
    actionsWrap();
  }

  // The lines the layout set, in the hero's pixels, which tools/web.py checks on its captures: the
  // star's tips, and the subject from the star's top tip to the lowest point of the stand the
  // screen shows, with its middle.
  window.heroLines = null;

  let view = { scale: 1, left: 0, top: 0, vw: 1, vh: 1 };
  function layout() {
    const vw = hero.clientWidth;
    const vh = hero.clientHeight;
    const narrow = narrowQuery.matches;
    root.classList.remove('row-free');
    // How much taller than 1080 pixels the screen is, which the nav grows by.
    root.style.setProperty('--ui', `${Math.max(1, vh / 1080)}`);
    root.classList.toggle('is-wide', !narrow);
    root.classList.toggle('is-stacked', narrow);
    root.classList.remove('is-short');
    let placed;
    if (narrow) placed = stacked(vw, vh);
    else {
      // The copy keeps its line on the subject's middle, giving up what fits it in, in turn.
      const tries = [{ short: false, free: false, shrink: 1 }];
      for (const short of [false, true]) {
        for (let shrink = 1; shrink >= SHRINK_LEAST; shrink *= SHRINK_STEP) tries.push({ short, free: true, shrink });
      }
      for (const [i, step] of tries.entries()) {
        root.classList.toggle('is-short', step.short);
        root.classList.toggle('row-free', step.free);
        placed = wide(vw, vh, step.shrink, i === tries.length - 1);
        if (placed.fits) break;
      }
    }
    view = { ...placed, vw, vh };
    window.heroLines = { ...placed.lines, star: { top: placed.top + star.top * placed.scale, middle: placed.top + star.y * placed.scale, bottom: placed.top + star.bottom * placed.scale }, scale: placed.scale };
    pickPlate();
    place(0);
    frames();
    snapMark();
    embers.resize(view);
  }

  // The plate's file for the width it is drawn at: sizes is set before srcset, so the browser
  // fetches one file.
  function pickPlate() {
    const img = layers.plate;
    img.sizes = `${Math.ceil(W * view.scale)}px`;
    if (!img.srcset) img.srcset = scene.plates.map(([file, width]) => `${file} ${width}w`).join(', ');
  }

  // Where the status and the plate wrap onto two rows, both take the row's width.
  function actionsWrap() {
    actions.classList.remove('is-wrapped');
    const [a, b] = actions.children;
    if (b && b.offsetParent && b.offsetTop >= a.offsetTop + a.offsetHeight) actions.classList.add('is-wrapped');
  }

  // The name's size beside the subject at a scale: from SUN's capitals to FORGE's middle the name
  // runs a line height and half a cap height, as far as from the star's top tip to its middle.
  function nameSize(scale) {
    const line = parseFloat(getComputedStyle(title).lineHeight) / parseFloat(getComputedStyle(title).fontSize);
    return ((star.y - star.top) * scale) / (line + CAP / 2);
  }

  // The plate's linear luminance under a box in its pixels: the 95th percentile of the brightness
  // map's cells, so a thin lit column or a window of stars behind a line counts, not the mean of a
  // mostly dark wall.
  function lum95(l, t, r, b) {
    const [cols, rows] = scene.bright.grid;
    const cx = (v) => clamp(0, Math.floor((v / W) * cols), cols - 1), cy = (v) => clamp(0, Math.floor((v / H) * rows), rows - 1);
    const cells = [];
    for (let row = cy(t); row <= cy(b); row++) for (let col = cx(l); col <= cx(r); col++) cells.push(scene.bright.cells[row * cols + col]);
    cells.sort((a, z) => a - z);
    return (cells[Math.floor((cells.length - 1) * 0.95)] || 0) / 1000;
  }

  // The darkening behind the copy, shaped to its lines: a block of the page's night behind each
  // part (the name, the slogan, the actions and the note), as dark as the brightest of the wall
  // under that part needs for its text to read, the wall darkened to SHADE_TARGET, at least 30% and
  // at most 86%; the blocks are blurred together by SHADE_BLUR of the name's size (landing.css), so
  // the darkening follows the copy with a long falloff and no edge. The parts' boxes are read from
  // the copy's place and their offsets in it, not their rects, which the entrance transforms move.
  const SHADE_TARGET = 0.045, SHADE_BLUR = 0.55, NIGHT_LUM = 0.005;
  const veil = document.querySelector('.shade canvas');
  function shade(copyX, copyY, toPlate) {
    const size = parseFloat(getComputedStyle(title).fontSize);
    // Drawn at a quarter of the screen's pixels: the blur leaves nothing finer.
    const k = 0.25;
    veil.width = Math.ceil(hero.clientWidth * k);
    veil.height = Math.ceil(hero.clientHeight * k);
    const ctx = veil.getContext('2d');
    ctx.clearRect(0, 0, veil.width, veil.height);
    ctx.fillStyle = getComputedStyle(root).getPropertyValue('--night').trim() || '#0b0806';
    const parts = [title, slogan, actions, ...(meta.offsetParent ? [meta] : [])];
    for (const el of parts) {
      const left = copyX + (el === title ? Math.min(...words.map((w) => w.offsetLeft)) : el.offsetLeft);
      const w = el === title ? Math.max(...words.map((w) => w.offsetLeft + w.offsetWidth)) + copyX - left : el.offsetWidth;
      const top = copyY + el.offsetTop, h = el.offsetHeight;
      const [pl, pt] = toPlate(left, top), [pr, pb] = toPlate(left + w, top + h);
      const lum = lum95(pl, pt, pr, pb);
      ctx.globalAlpha = clamp(0.3, lum > SHADE_TARGET ? (lum - SHADE_TARGET) / (lum - NIGHT_LUM) : 0, 0.86);
      const padX = size * 0.12, padY = size * 0.06;
      ctx.fillRect((left - padX) * k, (top - padY) * k, (w + 2 * padX) * k, (h + 2 * padY) * k);
    }
    px('--shade-blur', size * SHADE_BLUR);
  }

  // The least scale at which the plate covers the screen's foot with the star's middle at y. Its
  // top and sides may stand inside the screen, where they fade in from the night.
  function cover(y, vh) {
    return (vh - y + PAD) / (H - star.y);
  }

  // Where the plate's top or sides stand inside the screen, the shade fades them in from the night
  // (landing.css); an edge off the screen sets no fade.
  function edges(left, top, scale, vw) {
    const inside = (v) => (v > 0 ? v + PAD : -1e4);
    px('--plate-top', inside(top));
    px('--plate-left', inside(left));
    px('--plate-right', inside(vw - (left + W * scale)));
  }

  // Beside the subject: the subject at the left and the copy at the right, inside the band, with as
  // much space left of the subject's optical edge as right of the copy's ink, and the gap between
  // them a set part of it. The star's middle stands at STAR_AT of the height and the anvil's feet
  // on the foot band, which sets the subject's scale; the star's height sets the name's size, times
  // shrink, and the copy's width follows the name's. Where they do not fit across the band, both
  // shrink together, and the feet rise off the foot band. The middle of the name and the slogan
  // stands on the subject's optical middle; fits says whether the copy fits between the nav and the
  // foot band there, and on the last try the copy is held inside them.
  function wide(vw, vh, shrink, last) {
    const band = Math.min(vw, FRAME * vh);
    const edge = (vw - band) / 2;
    const margin = clamp(20, 0.034 * band, 56);
    px('--edge', edge);
    px('--margin', margin);
    const navHeight = nav.offsetHeight;
    const y = STAR_AT * vh;
    // The feet on the foot band, and the star's top tip at least half the nav's height under it.
    let scale = Math.min((vh - navHeight - y) / (subject.bottom - star.y), (y - navHeight * 1.5) / (star.y - subject.top));
    if (vh < SHORT) root.classList.add('is-short');
    // side is the space from the band's edge to the subject's optical edge, and from the copy's ink
    // to the band's other edge.
    let wideS, wideC, side;
    for (let i = 0; i < 40; i++) {
      px('--title', Math.max(30, nameSize(scale) * shrink));
      sizeRow(false);
      wideS = (optical.right - optical.left) * scale;
      wideC = inkWidth();
      side = (band - wideS - wideC) / (2 + BETWEEN);
      // The horn's tip, this far left of the optical edge, keeps half a margin from the screen.
      const horn = Math.max(0, optical.left - subject.left) * scale;
      if (side >= margin * 1.75 && side - horn >= margin * 0.5) break;
      scale *= 0.96;
    }
    const subjectLeft = edge + side;
    let x = subjectLeft + (star.x - optical.left) * scale;
    const copyX = subjectLeft + wideS + side * BETWEEN;
    // Where covering the screen still enlarges the plate, the subject moves right as far as the
    // horn's needle needs to keep half a margin from the screen's edge, and no nearer the copy
    // than half the gap.
    const most = copyX - side * BETWEEN * 0.5 - (optical.right - star.x) * scale;
    for (let i = 0; i < 3; i++) {
      scale = Math.max(scale, cover(y, vh));
      x = Math.min(Math.max(x, margin * 0.5 + (star.x - subject.left) * scale), Math.max(x, most));
    }

    // The subject on the screen: from the star's top tip down to the lowest point of the stand the
    // screen shows, which runs from its lit top to the frame's foot.
    const plateTop = y - star.y * scale;
    const span = { top: plateTop + subject.top * scale, bottom: Math.min(vh, plateTop + H * scale), middle: plateTop + opticalMiddle * scale };
    // The copy keeps clear of the nav and of the foot band.
    const top = navHeight * 1.25, bottom = vh - navHeight * 0.9;
    const inside = (at) => at >= top && at + copy.offsetHeight <= bottom;
    px('--copy-x', copyX);
    const name = ink(title), line = ink(slogan);
    let copyY = span.middle - (name.top + line.top + line.height) / 2;
    const fits = inside(copyY);
    if (!fits && last) copyY = clamp(top, copyY, Math.max(top, bottom - copy.offsetHeight));
    px('--copy-y', copyY);
    // Where the plate has too little above the star or beside it to reach the screen's edges, they
    // fade in from the night, so the subject keeps the size and place the copy left it.
    edges(x - star.x * scale, plateTop, scale, vw);
    shade(copyX, copyY, (sx, sy) => [star.x + (sx - x) / scale, star.y + (sy - y) / scale]);
    return { scale, left: x - star.x * scale, top: plateTop, fits, lines: { subject: span } };
  }

  // Centered: the star, the anvil and its stand on the page's middle axis, and the copy under the
  // stand's lit top face on the same axis, on narrow screens. The copy is set first and measured;
  // the subject takes what is left between the nav and the copy, so the actions stay on the first
  // screen. The plate covers the screen's width and runs down past the stand, where the scene fades
  // into the night from the stand's lit edge over a fifth of the screen; the copy keeps a set gap
  // under that edge. Where the plate's top stands below the screen's, it fades in from the night
  // under the nav.
  function stacked(vw, vh) {
    const margin = clamp(20, 0.06 * vw, 40);
    px('--edge', 0);
    px('--margin', margin);
    const x = vw / 2;
    const navHeight = nav.offsetHeight;
    // The air under the nav, between the stand's lit edge and the name, and under the copy.
    const air = clamp(14, 0.03 * vh, 40);
    const gap = clamp(22, 0.05 * vh, 64);
    const foot = clamp(20, 0.05 * vh, 56);
    // The subject runs from the star's top tip to the anvil's feet or the stand's lit edge.
    const tall = Math.max(subject.bottom, stand.edge) - subject.top;
    // It may be as wide as the screen less a margin (the horn's needle may reach half a margin from
    // the edge), and the plate covers at least the screen's width.
    const across = Math.min((x - margin * 0.5) / (star.x - subject.left), (vw - x - margin) / (subject.right - star.x));
    const width = Math.max((x + PAD) / star.x, (vw - x + PAD) / (W - star.x));
    // The name, on one line, as wide as the screen between the margins.
    px('--title', 100);
    const inkAt100 = textWidth(title).width - (S_LEFT + E_RIGHT + TRACK) * 100;
    px('--title', clamp(36, (100 * (vw - 2 * margin)) / inkAt100, 150));
    sizeRow(true);
    let copyHeight = copy.offsetHeight;
    let free = vh - navHeight - air - gap - copyHeight - foot;
    if (free < 0.3 * vh && meta.offsetParent) {
      root.classList.add('is-short');
      copyHeight = copy.offsetHeight;
      free = vh - navHeight - air - gap - copyHeight - foot;
    }
    const scale = Math.max(width, Math.min(free / tall, 0.62 * vh / tall, across));
    const height = tall * scale;
    // The subject and the copy as one group, centered in the room between the nav and the foot.
    const room = vh - navHeight - air - foot - (height + gap + copyHeight);
    const tip = navHeight + air + Math.max(0, room) * 0.45;
    const edge = tip + height;
    const below = edge + gap + Math.max(0, room) * 0.1;
    const top = tip - subject.top * scale;
    const plateFoot = top + H * scale;
    px('--copy-x', x);
    px('--copy-y', below);
    // The fade starts at the stand's lit edge, is 75% dark by the name's capitals and reaches the
    // trace a fifth of the screen down, or 6% of the screen before the plate ends, where it runs
    // on into the night. A plate that ends less than a quarter of the screen under the stand fades
    // in one ease over the last 15% of the screen above its end instead, 75% dark at 60% of the way
    // and at the trace at 85%, so its edge never shows.
    const plateEnd = Math.min(plateFoot, vh + 1);
    const close = plateEnd - edge < 0.25 * vh;
    const start = close ? Math.min(edge, plateEnd - 0.15 * vh) : edge;
    const mid = close ? start + (plateEnd - start) * 0.6 : edge + gap * 0.8;
    const end = close ? start + (plateEnd - start) * 0.85 : Math.max(mid, Math.min(edge + 0.2 * vh, plateEnd - 0.06 * vh));
    px('--fade-start', start);
    px('--fade-mid', mid);
    px('--fade-end', end);
    px('--plate-foot', Math.max(end + 1, plateEnd));
    edges(x - star.x * scale, top, scale, vw);
    // Centered, the scene fades from the stand's lit edge under the copy, so the subject the eye
    // takes in ends there.
    return { scale, left: x - star.x * scale, top, lines: { subject: { top: tip, bottom: edge, middle: (tip + edge) / 2 } } };
  }

  // The stage at its layout, zoomed in by zoom round the star, so the star holds still on screen.
  function place(zoom) {
    const { scale, left, top } = view;
    const k = 1 + zoom;
    const sx = left + star.x * scale, sy = top + star.y * scale;
    write(stage, 'transform', `translate3d(${sx + k * (left - sx)}px, ${sy + k * (top - sy)}px, 0) scale(${scale * k})`);
  }

  const embers = window.Embers({ scene, hero, copy, still, under: layers.under, over: layers.over });

  // Pointer and scroll. The embers part from the plate a little with the pointer, each depth by its
  // own amount, and the hero eases away on scroll: the stage zooms in by up to ZOOM and the copy
  // moves up by up to LIFT px over the first screen.
  const ZOOM = 0.05, LIFT = 90;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  // Writes a style only when its value changes.
  const written = new WeakMap();
  const write = (element, property, value) => {
    const values = written.get(element) || {};
    if (values[property] === value) return;
    values[property] = element.style[property] = value;
    written.set(element, values);
  };
  // How far up the copy was moved in the last frame, in screen pixels.
  let lifted = 0;
  function motion() {
    // The boxes are read before this frame's writes, so reading them forces no layout. They show
    // the copy at the last frame's lift, so each is corrected by the change in lift.
    const navHeight = nav.offsetHeight, copyTop = copy.getBoundingClientRect().top, titleBottom = title.getBoundingClientRect().bottom;
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    const p = Math.min(1, Math.max(0, scrollY / Math.max(1, view.vh)));
    const px = still ? 0 : pointer.x, py = still ? 0 : pointer.y;
    const shift = (k) => [(-px * k) / view.scale, (-py * k * 0.6) / view.scale].map((v) => `${v}px`).join(' ');
    write(layers.plate, 'translate', shift(PARALLAX));
    place(p * ZOOM);
    write(stage, 'opacity', `${1 - p * 0.65}`);
    const lift = p * LIFT;
    write(copy, 'translate', `0 ${-lift}px`);
    embers.track(px, py, p * ZOOM, lift);
    // The copy leaves by moving up and passing under the nav, cut at the nav's foot, at full
    // strength: faded, its gold would mix with the wall behind it.
    const under = navHeight - (copyTop + lifted - lift);
    write(copy, 'clipPath', under > 0 ? `inset(${under}px -100vw -100vh -100vw)` : '');
    nav.classList.toggle('is-solid', scrollY > 40);
    root.classList.toggle('name-gone', titleBottom + lifted - lift < navHeight);
    lifted = lift;
    requestAnimationFrame(motion);
  }

  // The plate's focus frame: its outline, standing 2.5 pixels off it with its corners cut where
  // the plate's are, stroked as SVG in the button's own pixels on the half pixel, so its cut
  // corners draw as fine as its straight sides.
  const SVG = 'http://www.w3.org/2000/svg';
  function frames() {
    document.querySelectorAll('.button').forEach((button) => {
      let svg = button.querySelector('svg.frame');
      if (!svg) {
        svg = document.createElementNS(SVG, 'svg');
        svg.classList.add('frame');
        svg.setAttribute('aria-hidden', 'true');
        button.append(svg);
      }
      const w = button.offsetWidth, h = button.offsetHeight;
      const cut = parseFloat(getComputedStyle(button).getPropertyValue('--cut')) || 0;
      const d = -2.5, c = cut - d * (2 - Math.SQRT2);
      const points = [[c + d, d], [w - c - d, d], [w - d, c + d], [w - d, h - c - d], [w - c - d, h - d], [c + d, h - d], [d, h - c - d], [d, c + d]];
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.innerHTML = `<path d="M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z"/>`;
    });
  }

  // The nav's mark, its middle moved onto the middle of the screen pixel nearest where landing.css
  // puts it, on both axes at any pixel ratio, so its upright and its level rays draw alike. At 1x
  // the stylesheet's half-pixel nudge already does this.
  const mark = nav.querySelector('.mark');
  function snapMark() {
    mark.style.translate = '';
    const box = mark.getBoundingClientRect();
    if (!box.width) return;
    const d = devicePixelRatio || 1;
    const nudge = getComputedStyle(mark).translate.split(' ').map((v) => parseFloat(v) || 0);
    const snap = (middle) => (Math.round(middle * d - 0.5) + 0.5) / d - middle;
    mark.style.translate = `${nudge[0] + snap(box.left + box.width / 2)}px ${(nudge[1] || 0) + snap(box.top + box.height / 2)}px`;
  }

  addEventListener('resize', layout);
  layout();
  // The layout measures the copy and the plate, which grow when the faces arrive.
  document.fonts.ready.then(layout);

  const plate = layers.plate;
  (plate.decode ? plate.decode().catch(() => {}) : Promise.resolve()).then(() => {
    requestAnimationFrame(() => {
      body.classList.add('is-ready');
      setTimeout(embers.start, still ? 0 : 700);
      requestAnimationFrame(motion);
    });
  });
})();
