// The hero's embers: sparks thrown up from the anvil's face and shed by the star's lower half,
// rising on the forge's draft, turning a little round the star's heat, cooling from yellow-white
// toward orange-red as they climb, and dying out above the star's top tip. Most are faint
// pinpricks and a few large and hot, so they read as sparks at different depths and not as an
// even speckle. Depth sets size, speed, parallax and layer: the far and middle ones draw over the
// plate and under the copy, fading out where they reach it, and the nearest in front of
// everything, never on the copy: in a still frame a spark on a letter reads as dirt on the type.
// The pointer stirs them.
(() => {
  // Every value that shapes the embers. Lengths and speeds are in the star's heights and per
  // second, sizes in 800ths of the plate's height, times in seconds. A pair [a, b] is a least
  // value a and how far a random share reaches past it.
  const TUNING = {
    // How many start each second, the most alive at once, the most started in one frame, the
    // share of the most that are already on their way when they start, and the most of its life
    // each of those has behind it.
    rate: 120, most: 1100, perFrame: 4, preaged: 0.5, preagedLife: 0.9,
    // Where they leave from, as shares of the starts: a plume from below the frame under the star,
    // and the anvil's face; the rest leave the star's lower half.
    sources: { below: 0.5, face: 0.3 },
    // The plume: strays spread round the star's middle (a normal deviate's width), starting in a
    // band under the frame. On a stray's turn a puff starts by chance, its sparks alike in depth
    // and lift, spread round its own middle.
    plume: { spread: 1.1, band: 0.2, puff: 0.08, sparks: [8, 18], puffSpread: 0.55, puffWidth: 0.05, puffDepth: 0.08, puffLift: [0.8, 0.5] },
    // The anvil's face: from this share of its width to its right end, in a band this tall with
    // this share of it above the face's top.
    face: { from: 0.25, band: 0.06, above: 0.3 },
    // The star's lower half: this wide round its middle, and this far down from it.
    star: { width: 0.7, depth: 0.4 },
    // Depth: a random share raised to this power, so most are far. The nearest draw over the copy
    // (over), the next on the front layer and the rest on the back layer, both over the plate and
    // under the copy; a share are near, out-of-focus discs.
    depth: 1.2, over: 0.8, front: 0.42, near: 0.035,
    // How far each layer moves with the pointer at the screen's edge, across and down, in screen
    // pixels.
    parallax: { back: [3, 1.8], front: [14.4, 8.64], over: [19.2, 11.4] },
    // Rise, in star heights a second: from below the frame, by depth, then times a stray's lift;
    // from the face and the star, by depth.
    rise: { below: [0.45, 0.2], belowDepth: 0.4, strayLift: [0.7, 0.6], other: [0.18, 0.25], otherDepth: 0.3 },
    // The sideways start, a random share less skew: off the face, and from the other sources; and
    // the share of it left after each second.
    sideways: { skew: 0.35, face: 0.5, other: 0.2, damping: 0.985 },
    // The nearest from the face are thrown toward the copy, out and up, and fall back by gravity.
    thrown: { out: [0.5, 0.9], up: [0.55, 0.5], gravity: 0.42 },
    // The draft: a field of curls this strong, leaning by lean toward the right, where the copy
    // sits beside the subject, carrying the far ones by its least share and the near ones by that
    // plus depth. Each wave of the curls is a sine of the spark's height, the time, its seed and
    // its place across, each times its frequency, and adds its weight of the sine.
    draft: {
      strength: 0.2, lean: 0.25, least: 0.55, depth: 0.6,
      waves: [[2.1, 0.35, 1, 0, 0.55], [4.3, -0.6, 1.7, 1.2, 0.3], [0, 0.21, 0, 2.7, 0.15]],
    },
    // The star's heat turns, pushes out and lifts the embers that pass within reach of its middle,
    // by the falloff power of how near they pass.
    swirl: { reach: 0.9, turn: 0.25, push: 0.1, lift: 0.2, falloff: 2 },
    // The pointer pushes the embers it passes. A moving pointer within reach star heights of a
    // spark on the screen pushes it away, and sideways by turn times that, by the falloff power of
    // how near it is and by the pointer's speed up to pace CSS pixels a second, at push star
    // heights a second each second. A mouse at rest pushes the sparks within rest straight away at
    // restPush. The share relax of a push is left after each second. A touch has no resting field.
    stir: { reach: 1.5, push: 4, turn: 0.7, pace: 600, rest: 0.9, restPush: 4, falloff: 2, relax: 0.4 },
    // They thin from the star's top tip and are gone this many star heights above it.
    ceiling: 1.5,
    // Lifetimes: from below the frame, and from the face and the star. They fade in over fadeIn,
    // and out over the last part of their life from fadeOut on.
    life: { below: [6, 6], other: [3, 5], fadeIn: 0.3, fadeOut: 0.6 },
    // Sizes: least, by depth, and a few large, rare by the power; near discs.
    size: { least: 1, depth: 2, large: 3, rarity: 4, near: [10, 16] },
    // Brightness: a random share raised to the power, and the far ones a little dimmer. Over a wall
    // brighter than wallDim less wallRange in linear luminance, a spark dims in proportion to how
    // far past that point the wall is, down to wallLeast.
    glow: { share: [0.55, 0.45], power: 1.5, depth: 0.25, wallDim: 0.3, wallRange: 0.2, wallLeast: 0.5 },
    // The colors from hot to cold. A spark starts at heat and cools by cooling over its life.
    ramp: [[255, 222, 150], [255, 196, 104], [255, 168, 62], [255, 138, 38], [246, 108, 24], [222, 78, 16], [180, 50, 10], [128, 30, 6]],
    heat: [0.75, 0.25], cooling: 0.4,
    // The sprite every spark is drawn from: alpha by radius, from the middle to the edge.
    sprite: [[0, 1], [0.18, 0.85], [0.42, 0.22], [1, 0]],
    // The halo's radius is halo sizes, at haloAlpha, its color haloCooler steps down the ramp from
    // the body's, as a near disc's is. The body is stretched along the spark's path as far as it
    // moves in 1 / shutter s, and is at least bodyLength sizes long and bodyWidth sizes wide. A
    // white core coreSize sizes in radius shows while the spark is in the ramp's hottest coreSteps
    // steps. Near discs draw at nearAlpha.
    halo: 4, haloAlpha: 0.32, haloCooler: 1, shutter: 12, bodyLength: 6, bodyWidth: 2,
    coreSize: 0.5, coreSteps: 2, coreAlpha: 0.7, nearAlpha: 0.22,
    // The flicker: brightness is least plus swing times the product of two sines, the faster at
    // rate radians a second, the slower at slow of it.
    flicker: { least: 0.72, swing: 0.28, rate: [3, 7], slow: 0.37 },
    // A spark inside the copy's box plus fade px fades out over 1 / fadeRate s; one over the copy
    // goes out within its box plus keep px.
    copy: { fade: 40, keep: 16, fadeRate: 3 },
    // The canvases' most pixels per CSS pixel.
    ratio: 1.5,
  };
  // A frame's step is at most this many seconds, so a hidden tab or a stopped loop returns to the
  // embers as it left them.
  const STEP = 0.05;
  // The pre-aged embers move on by this step, and this many of them are pre-aged a frame once the
  // fonts are ready, so the first crowd takes no long task: at a phone's speed all of it at once
  // stalls a frame as the page appears.
  const SETTLE_STEP = 0.1, SETTLE_PER_FRAME = 40;

  // Draws the hero's embers on the under canvas in the stage, the back and front layers both, and
  // the over canvas above the copy, from the frame's scene (scene.js); still is true under reduced
  // motion. Returns resize(view) for each layout, with the plate's place and scale on the screen,
  // track(x, y, zoom, lift) for each frame, and start(), which sets the hero's data-embers once the
  // embers run.
  window.Embers = ({ scene, hero, copy, under, over, still }) => {
    const T = TUNING;
    const [W, H] = scene.size;
    const [sl, st, sr, sb] = scene.star;
    const star = { top: st, x: (sl + sr) / 2, y: (st + sb) / 2, h: sb - st };
    const [al, at, ar] = scene.anvil;
    const anvil = { left: al, top: at, right: ar };
    const below = under.getContext('2d'), above = over.getContext('2d');
    const ctxs = { back: below, front: below, over: above };
    const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
    const list = [];
    let view = { scale: 1, left: 0, top: 0, vw: 1, vh: 1 };
    let dpr = 1, ratio = 1;
    const sprite = (() => {
      const size = 64;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [at, alpha] of T.sprite) grad.addColorStop(at, `rgba(255,255,255,${alpha})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return c;
    })();
    const last = T.ramp.length - 1;
    // A tinted copy of the sprite per heat step, so drawing needs no per-particle filter.
    const tinted = T.ramp.map(([r, g, b]) => {
      const c = document.createElement('canvas');
      c.width = c.height = sprite.width;
      const x = c.getContext('2d');
      x.drawImage(sprite, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = `rgb(${r},${g},${b})`;
      x.fillRect(0, 0, c.width, c.height);
      return c;
    });
    // Per heat step, a spark's halo with its white core added while the step is hot enough. The
    // embers add up on the canvas, so one image of both draws the same as drawing each.
    const glows = tinted.map((_, cool) => {
      const size = 128;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = T.haloAlpha;
      x.drawImage(tinted[Math.min(last, cool + T.haloCooler)], 0, 0, size, size);
      if (cool < T.coreSteps) {
        // The image is the halo's diameter across, halo * 2 sizes.
        const core = (size / 2) * (T.coreSize / T.halo);
        x.globalAlpha = T.coreAlpha;
        x.drawImage(sprite, size / 2 - core, size / 2 - core, core * 2, core * 2);
      }
      return c;
    });
    // The tinted sprites and the glows in one image, apart by a clear gap, so the canvas draws
    // every spark from one texture and can batch the draws. Each sprite's place is [x, y, size].
    const GAP = 2;
    const atlas = document.createElement('canvas');
    atlas.width = (glows[0].width + GAP) * glows.length;
    atlas.height = glows[0].width + GAP + sprite.width;
    const pen = atlas.getContext('2d');
    const place = (images, y) => images.map((image, i) => {
      const cell = [i * (image.width + GAP), y, image.width];
      pen.drawImage(image, cell[0], cell[1]);
      return cell;
    });
    const glowAt = place(glows, 0), tintAt = place(tinted, glows[0].width + GAP);
    const stamp = (ctx, [sx, sy, size], x, y, w, h) => ctx.drawImage(atlas, sx, sy, size, size, x, y, w, h);

    // Setting a canvas's size clears it, so a still page draws its embers again where they are.
    function resize(placed) {
      view = placed;
      dpr = Math.min(window.devicePixelRatio || 1, T.ratio);
      ratio = dpr * view.scale;
      under.width = Math.round(W * ratio);
      under.height = Math.round(H * ratio);
      over.width = Math.round(view.vw * dpr);
      over.height = Math.round(view.vh * dpr);
      // The stage's shifts are in the plate's pixels, so the next track works them out again.
      follow.x = NaN;
      zones();
      if (still && started) draw(clock);
      // The first crowd ages against the copy's box in its own faces, which may arrive late.
      if (!settling && !started) {
        settling = true;
        document.fonts.ready.then(() => requestAnimationFrame(settleSome));
      }
    }

    // The copy's box at rest in the plate's pixels, with a margin: the embers under it fade out in
    // the wider one, and the embers over it in the narrower, so none lies on a letter.
    let rest = { fade: null, keep: null };
    // The hero's top left corner on the page, in CSS pixels.
    let heroAt = { x: 0, y: 0 };
    function zones() {
      const rect = copy.getBoundingClientRect(), base = hero.getBoundingClientRect();
      const box = (m) => ({
        left: (rect.left - base.left - m - view.left) / view.scale, right: (rect.right - base.left + m - view.left) / view.scale,
        top: (rect.top + follow.lift - base.top - m - view.top) / view.scale, bottom: (rect.bottom + follow.lift - base.top + m - view.top) / view.scale,
      });
      rest = { fade: box(T.copy.fade), keep: box(T.copy.keep) };
      heroAt = { x: base.left + scrollX, y: base.top + scrollY };
      boxes();
    }

    // Where the pointer and the scroll have moved each layer and the copy: the pointer's place
    // from -1 to 1 across and down, the stage's zoom round the star, and how far up the copy has
    // moved, in screen pixels.
    const follow = { x: 0, y: 0, zoom: 0, lift: 0 };
    // Each layer's shift in its canvas's pixels, the plate's for the stage's two. The under canvas
    // draws its two layers at their shifts; the over canvas moves by its own.
    const shift = { back: [0, 0], front: [0, 0], over: [0, 0] };
    let placed = '';
    function track(x, y, zoom, lift) {
      if (follow.x === x && follow.y === y && follow.zoom === zoom && follow.lift === lift) return;
      Object.assign(follow, { x, y, zoom, lift });
      for (const level of ['back', 'front']) shift[level] = T.parallax[level].map((k, i) => (-[x, y][i] * k) / view.scale);
      shift.over = T.parallax.over.map((k, i) => -[x, y][i] * k);
      const translate = shift.over.map((v) => `${v}px`).join(' ');
      if (placed !== translate) over.style.translate = placed = translate;
      boxes();
    }

    // The copy's boxes in each canvas's own pixels, where the shifts and the lift put them: the
    // stage's layers zoom with the stage round the star, the over canvas does not.
    let copyBox = { back: null, front: null, over: null };
    function boxes() {
      if (!rest.fade) return;
      const k = 1 + follow.zoom, zoomOut = 1 / k - 1;
      const staged = (box, [dx, dy]) => ({
        left: box.left + (box.left - star.x) * zoomOut - dx, right: box.right + (box.right - star.x) * zoomOut - dx,
        top: box.top + (box.top - star.y) * zoomOut - dy - follow.lift / (view.scale * k),
        bottom: box.bottom + (box.bottom - star.y) * zoomOut - dy - follow.lift / (view.scale * k),
      });
      const [ox, oy] = shift.over, box = rest.keep;
      copyBox = {
        back: staged(rest.fade, shift.back), front: staged(rest.fade, shift.front),
        over: { left: box.left - ox / view.scale, right: box.right - ox / view.scale, top: box.top + (-follow.lift - oy) / view.scale, bottom: box.bottom + (-follow.lift - oy) / view.scale },
      };
    }
    const inside = (p, box) => p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom;

    // A spark's middle in the hero's CSS pixels, into spot. At the top of the page the hero fills
    // the screen, so these are the screen's pixels too.
    const spot = { x: 0, y: 0 };
    function inTheHero(p) {
      if (p.level === 'over') {
        spot.x = shift.over[0] + view.left + p.x * view.scale;
        spot.y = shift.over[1] + view.top + p.y * view.scale;
      } else {
        const k = view.scale * (1 + follow.zoom), [dx, dy] = shift[p.level];
        spot.x = view.left + star.x * view.scale + (p.x + dx - star.x) * k;
        spot.y = view.top + star.y * view.scale + (p.y + dy - star.y) * k;
      }
      return spot;
    }
    // Whether any of what a spark draws, reach plate pixels round its middle, lies on the screen.
    function onScreen(p, reach) {
      const k = p.level === 'over' ? 1 : 1 + follow.zoom;
      const { x, y } = inTheHero(p);
      // A canvas pixel more, which the scaled canvases blend into the screen's edge.
      const r = reach * view.scale * k + k / dpr;
      return x + r > 0 && x - r < view.vw && y + r > 0 && y - r < view.vh;
    }

    // The wall's linear luminance under a point of the plate, from the brightness map.
    const [cols, rows] = scene.bright.grid;
    function wall(x, y) {
      const col = clamp(0, Math.floor((x / W) * cols), cols - 1), row = clamp(0, Math.floor((y / H) * rows), rows - 1);
      return scene.bright.cells[row * cols + col] / 1000;
    }

    // A normal deviate, for the plume's spread.
    const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

    // Where a puff of embers leaves from, and how they climb: a puff's embers start together, alike
    // in depth and lift, and climb as a loose drift until the draft parts them.
    let puff = null;
    function spawn(t) {
      const u = H / 800;
      const near = !still && Math.random() < T.near;
      const pick = Math.random();
      const from = pick < T.sources.below ? 'below' : pick < T.sources.below + T.sources.face ? 'face' : 'star';
      const P = T.plume;
      if (from === 'below' && (!puff || puff.left <= 0) && Math.random() < P.puff) {
        puff = {
          left: P.sparks[0] + Math.floor(Math.random() * P.sparks[1]), x: star.x + gauss() * star.h * P.puffSpread,
          z: Math.random() ** T.depth, lift: P.puffLift[0] + Math.random() * P.puffLift[1],
        };
      }
      const inPuff = from === 'below' && puff && puff.left > 0;
      if (inPuff) puff.left -= 1;
      const z = inPuff ? clamp(0, puff.z + (Math.random() - 0.5) * P.puffDepth, 1) : Math.random() ** T.depth;
      const x = from === 'face'
        ? anvil.left + (anvil.right - anvil.left) * (T.face.from + (1 - T.face.from) * Math.random())
        : from === 'star' ? star.x + (Math.random() - 0.5) * star.h * T.star.width
        : inPuff ? puff.x + gauss() * star.h * P.puffWidth : star.x + gauss() * star.h * P.spread;
      const y = from === 'face' ? anvil.top + (Math.random() - T.face.above) * star.h * T.face.band
        : from === 'star' ? star.y + Math.random() * star.h * T.star.depth
        : H + Math.random() * star.h * P.band;
      const fromFace = from === 'face';
      // A still page draws no ember in front of the copy: a spark that cannot move reads as a speck
      // on the letters.
      const level = still ? (z > T.front ? 'front' : 'back') : near ? 'over' : z > T.over ? 'over' : z > T.front ? 'front' : 'back';
      // The nearest sparks from the face are thrown: flung up and out toward the copy's side in an
      // arc that gravity bends down, and they go out at the copy's edge.
      const thrown = fromFace && level === 'over' && !near;
      const R = T.rise, S = T.size;
      list.push({
        x, y,
        z: near ? 1 : z,
        vx: thrown ? star.h * (T.thrown.out[0] + Math.random() * T.thrown.out[1])
          : (Math.random() - T.sideways.skew) * star.h * (fromFace ? T.sideways.face : T.sideways.other),
        vy: thrown ? -star.h * (T.thrown.up[0] + Math.random() * T.thrown.up[1])
          : from === 'below' ? -star.h * (R.below[0] + z * R.belowDepth + Math.random() * R.below[1]) * (inPuff ? puff.lift : R.strayLift[0] + Math.random() * R.strayLift[1])
          : -(star.h * (R.other[0] + z * R.otherDepth + Math.random() * R.other[1])),
        vxNow: 0, vyNow: 0,
        // The pointer's push, in plate pixels a second.
        px: 0, py: 0,
        thrown,
        size: near ? u * (S.near[0] + Math.random() * S.near[1]) : u * (S.least + z * S.depth + S.large * Math.random() ** S.rarity),
        glow: T.glow.share[0] + T.glow.share[1] * Math.random() ** T.glow.power,
        born: t,
        life: from === 'below' ? T.life.below[0] + Math.random() * T.life.below[1] : T.life.other[0] + Math.random() * T.life.other[1],
        heat: T.heat[0] + Math.random() * T.heat[1],
        flicker: Math.random() * Math.PI * 2,
        rateF: T.flicker.rate[0] + Math.random() * T.flicker.rate[1],
        near,
        level,
        seed: Math.random() * 1000,
        fade: 1,
      });
    }

    // A slow field of curls round the subject: sums of sines across space and time, enough to look
    // like a draft, leaning toward the copy's side.
    const waves = T.draft.waves;
    function drift(p, t) {
      const s = p.seed;
      const u = p.x / star.h, v = p.y / star.h;
      let sum = T.draft.lean;
      for (let i = 0; i < waves.length; i++) {
        const [high, time, seed, across, weight] = waves[i];
        sum += Math.sin(v * high + t * time + s * seed + u * across) * weight;
      }
      return sum * star.h * T.draft.strength;
    }

    // The height above which the embers die out.
    const ceiling = () => star.top - star.h * T.ceiling;

    // Moves one ember on by dt seconds at time t.
    const SW = T.swirl;
    const swirlReach = star.h * SW.reach;
    function move(p, t, dt) {
      if (inside(p, copyBox[p.level])) p.fade -= dt * T.copy.fadeRate;
      const dx = p.x - star.x, dy = p.y - star.y;
      let swirlX = 0, swirlY = 0;
      if (Math.abs(dx) < swirlReach && Math.abs(dy) < swirlReach) {
        const d = Math.hypot(dx, dy);
        if (d < swirlReach && d > 1) {
          const k = (1 - d / swirlReach) ** SW.falloff * star.h;
          swirlX = (-dy / d) * k * SW.turn + (dx / d) * k * SW.push;
          swirlY = (dx / d) * k * SW.turn - k * SW.lift;
        }
      }
      p.vxNow = p.vx * T.sideways.damping ** (t - p.born) + drift(p, t) * (T.draft.least + p.z * T.draft.depth) + swirlX;
      if (p.thrown) p.vy += star.h * T.thrown.gravity * dt;
      p.vyNow = p.vy + swirlY;
      p.x += (p.vxNow + p.px) * dt;
      p.y += (p.vyNow + p.py) * dt;
    }

    // Moves the embers on by dt seconds at time t, ending the spent and starting new ones. The
    // embers add up on the canvas, so the order they draw in does not show, and a spent one's
    // place takes the last.
    let carry = 0;
    function step(t, dt) {
      carry = Math.min(carry + dt * T.rate, T.perFrame);
      while (carry >= 1 && list.length < T.most) {
        spawn(t);
        carry -= 1;
      }
      const top = ceiling();
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (t - p.born > p.life || p.y < top || p.fade <= 0) {
          list[i] = list[list.length - 1];
          list.pop();
          continue;
        }
        move(p, t, dt);
      }
    }

    // The pointer in CSS pixels on the screen, its speed in CSS pixels a second, whether it was
    // seen since it last came onto the page, whether it moved since the last frame, and whether a
    // mouse rests on the page.
    const pointer = { x: 0, y: 0, nx: 0, ny: 0, speed: 0, seen: false, moved: false, resting: false };
    if (!still) {
      addEventListener('pointermove', (e) => {
        pointer.nx = e.clientX;
        pointer.ny = e.clientY;
        pointer.moved = true;
        pointer.resting = e.pointerType === 'mouse';
      }, { passive: true });
      // A pointer that comes back, a touch landing anywhere or a mouse returning to the window, is
      // not a fast sweep from where it was last seen.
      const gone = () => { pointer.resting = pointer.seen = false; };
      addEventListener('pointerdown', () => { pointer.seen = false; }, { passive: true });
      document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) gone(); });
      addEventListener('blur', gone);
    }
    // Whether any ember still carries a push, so the pushes relax while the pointer is still.
    let pushed = false;
    function stir(dt) {
      const S = T.stir;
      if (pointer.moved) {
        const dx = pointer.nx - pointer.x, dy = pointer.ny - pointer.y;
        pointer.speed = pointer.seen && dt > 0 ? Math.hypot(dx, dy) / dt : 0;
        pointer.x = pointer.nx;
        pointer.y = pointer.ny;
        pointer.seen = true;
        pointer.moved = false;
      } else pointer.speed = 0;
      const pace = Math.min(1, pointer.speed / S.pace);
      if (!pace && !pointer.resting && !pushed) return;
      const relax = S.relax ** dt;
      const reach = star.h * view.scale * S.reach, restReach = star.h * view.scale * S.rest;
      const far = Math.max(pace ? reach : 0, pointer.resting ? restReach : 0);
      const push = pace * star.h * S.push * dt, restPush = star.h * S.restPush * dt;
      // The pointer in the hero's pixels, which scroll with the page.
      const ox = pointer.x + scrollX - heroAt.x, oy = pointer.y + scrollY - heroAt.y;
      pushed = false;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (far) {
          const { x, y } = inTheHero(p);
          const dx = x - ox, dy = y - oy;
          if (Math.abs(dx) < far && Math.abs(dy) < far) {
            const d = Math.hypot(dx, dy);
            if (pace && d < reach && d > 0.5) {
              const k = (1 - d / reach) ** S.falloff * push / d;
              p.px += (dx - dy * S.turn) * k;
              p.py += (dy + dx * S.turn) * k;
            }
            if (pointer.resting && d < restReach && d > 0.5) {
              const k = (1 - d / restReach) ** S.falloff * restPush / d;
              p.px += dx * k;
              p.py += dy * k;
            }
          }
        }
        if (p.px || p.py) {
          p.px *= relax;
          p.py *= relax;
          if (Math.abs(p.px) + Math.abs(p.py) < 0.01) p.px = p.py = 0;
          else pushed = true;
        }
      }
    }

    // Draws the embers as they are at time t. Each spark sets its canvas's transform once, turned
    // along its path, and draws its halo and core, which are round, and its body in that frame.
    // A layer's frame is its scale and its offset in canvas pixels.
    const frames = { back: [1, 0, 0], front: [1, 0, 0], over: [1, 0, 0] };
    function draw(t) {
      for (const ctx of [below, above]) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.globalCompositeOperation = 'lighter';
      }
      for (const level of ['back', 'front']) frames[level] = [ratio, ratio * shift[level][0], ratio * shift[level][1]];
      // The over canvas draws in the hero's pixels: the plate's, placed and scaled as the stage.
      frames.over = [dpr * view.scale, dpr * view.left, dpr * view.top];
      const roof = ceiling();
      const G = T.glow, L = T.life, F = T.flicker;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.level === 'over' && inside(p, copyBox.over)) continue;
        const age = t - p.born;
        const life = age / p.life;
        const fadeIn = Math.min(1, age / L.fadeIn);
        const fadeOut = 1 - Math.max(0, (life - L.fadeOut) / (1 - L.fadeOut));
        const high = clamp(0, (p.y - roof) / (star.top - roof), 1);
        let alpha = fadeIn * fadeOut * high * Math.max(0, p.fade) * p.glow;
        if (alpha <= 0) continue;
        const cool = Math.min(last, Math.floor((1 - p.heat + life * T.cooling) * last));
        const flick = F.least + F.swing * Math.sin(age * p.rateF + p.flicker) * Math.sin(age * p.rateF * F.slow + p.flicker * 2);
        alpha *= flick;
        const ctx = ctxs[p.level];
        const [k, e, f] = frames[p.level];
        if (p.near) {
          const r = p.size;
          if (!onScreen(p, r)) continue;
          ctx.setTransform(k, 0, 0, k, k * p.x + e, k * p.y + f);
          ctx.globalAlpha = alpha * T.nearAlpha;
          stamp(ctx, tintAt[Math.min(last, cool + T.haloCooler)], -r, -r, r * 2, r * 2);
          continue;
        }
        const v = Math.hypot(p.vxNow, p.vyNow);
        const halo = p.size * T.halo;
        const len = Math.max(p.size * T.bodyLength, v / T.shutter);
        if (!onScreen(p, Math.max(halo, len / 2))) continue;
        // Over a light wall a spark shows little, as it would against daylight.
        alpha *= (1 - G.depth + p.z * G.depth) * clamp(G.wallLeast, (G.wallDim - wall(p.x, p.y)) / G.wallRange, 1);
        // Along the path, or straight up while it is still.
        const c = v ? p.vxNow / v : 0, s = v ? p.vyNow / v : -1;
        ctx.setTransform(k * c, k * s, -k * s, k * c, k * p.x + e, k * p.y + f);
        ctx.globalAlpha = alpha;
        stamp(ctx, glowAt[cool], -halo, -halo, halo * 2, halo * 2);
        const r = p.size * T.bodyWidth;
        stamp(ctx, tintAt[cool], -len / 2, -r / 2, len, r);
      }
    }

    // The embers' clock: the sum of the frames' steps, each at most STEP, so it stops while the
    // tab is hidden or the hero is off the screen.
    let clock = 0, then = 0;
    let started = false, shown = true, looping = false;
    function tick(now) {
      const t = now / 1000;
      const dt = Math.max(0, Math.min(STEP, t - then));
      then = t;
      clock += dt;
      step(clock, dt);
      stir(dt);
      draw(clock);
      looping = shown;
      if (looping) requestAnimationFrame(tick);
    }
    // The loop starts without waiting for the observer's first report: reports arrive in real time,
    // so under a capture's fake clock they come at no fixed frame.
    new IntersectionObserver(([entry]) => {
      shown = entry.isIntersecting;
      if (shown && started && !looping) {
        looping = true;
        requestAnimationFrame(tick);
      }
    }).observe(hero);

    // Embers already on their way, each moved on by its age, so the first frame is never empty.
    // They are aged at the clock's start, a few each frame from when the fonts are ready
    // until start, which ages the rest.
    let settling = false, settled = 0;
    const toSettle = T.most * T.preaged;
    function settle(count) {
      for (let i = 0; i < count && settled < toSettle; i++, settled++) {
        spawn(clock);
        const p = list[list.length - 1];
        const age = Math.random() * p.life * T.preagedLife;
        p.born = clock - age;
        for (let a = 0; a < age; a += SETTLE_STEP) move(p, p.born + a, SETTLE_STEP);
        if (p.fade <= 0 || p.y < ceiling()) list.pop();
      }
    }
    function settleSome() {
      if (started) return;
      settle(SETTLE_PER_FRAME);
      if (settled < toSettle) requestAnimationFrame(settleSome);
    }

    function start() {
      zones();
      settle(toSettle);
      then = performance.now() / 1000;
      started = true;
      hero.dataset.embers = 'on';
      if (still) {
        // A still keeps the copy clear of embers.
        for (let i = list.length - 1; i >= 0; i--) if (inside(list[i], rest.fade)) list.splice(i, 1);
        step(clock, 0);
        draw(clock);
        return;
      }
      looping = true;
      requestAnimationFrame(tick);
    }

    return { resize, track, start };
  };
})();
