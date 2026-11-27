// The ring: the knight's baked sprites on a canvas with no ground, one for each direction, round a larger knight in
// the middle, with a camera filming it. The middle knight faces one direction, and the sprite of that direction is
// outlined and plays the clip with it, at the rate it was baked. Every other sprite stands at one pose. The mouse turns
// the middle knight to the sprite it is nearest as it moves. A finger turns it by a tap or a slide across, and a swipe
// that starts up or down scrolls the page. The slider under the ring turns it too. The ring's data-directions, which a
// switch sets, is how many directions it shows.
//
// PAGES.knight.ring (data.js, from listing/ring.py) places every part in ring units, where the ring's half width is
// 1. This file fits the ring to its canvas and draws it with the canvas's strokes and the page's accent. The clip on
// show is the ring's data-clip and what it shows its data-target, which their switches set (switches.js, which runs
// first): in game or a texture of the bake. The middle always shows the 3D model as the bake films it, playing in
// place. The ring carries data-pending until it has drawn the clip and target its switches pick, playing the first
// time, data-facing, the direction the middle knight faces, and data-playing, the clip, while that direction plays.
//
// Every picture of the ring is a run, a file of consecutive cells in one row, and a frame draws a cell as a source
// rectangle of its run's one bitmap. A strip holds a clip's frames in one direction, and a clip's poses hold a cell
// per direction at one frame (PAGES.knight gives each picture's run, its cells per file). A frame draws every sprite
// from the clip's poses, and the middle and the outlined sprite from the faced direction's strip. Only those two play:
// drawing sixteen strips each frame did not hold a steady rate. listing/strips.py keeps each run under RUN_PIXELS,
// because the browser readies a whole bitmap for the GPU at its first draw, and a large one stalls the page. A turn
// waits for one run, not for a whole strip.
//
// Four workers (ring-cells.js), one per lane of LANES, download and decode each picture off the page's thread, each
// started when it first has work: middle takes the middle's pose and its first run, ring the ring sprites' poses and
// the outlined sprite's first run, later the rest of both strips, in the order the clock reaches them, and poses the
// middle's poses of the other directions shown, nearest first, so a turn shows its pose at once. Each of the first
// two asks first for the run of poses that holds the cells its sprites draw, then for its first run. A worker
// answers in the order asked, so the other poses have a worker of their own: on middle, a turn made just after a
// switch would wait for them before its first run, and on later, the turn's later runs would wait for them and the
// ring would hold frames. The first run asked for is the one the clock will be on when it arrives: lag ms from now,
// where lag is how long recent first runs took to arrive.
//
// The ring is pending while a part has no cell of the picked clip and target to draw, or until it has played once. A
// part plays while it holds the run the clock is on. It shows its pose until its first run, and holds its last frame
// while a later run is late. After a turn, a part with neither its new pose nor its new run draws what it drew last of
// the same clip, target and size, so a turn never leaves the ring pending. The canvas is drawn again only when what a
// part draws changes. Each part draws from one size, the one its height needs. The ring loads from LOAD screens away,
// so it opens playing.
//
// Safari on iOS reloads a page that holds more memory than the phone allows, so the ring holds decoded only what it
// draws from: the poses its sprites can show, the faced direction's runs, the clip's poses of every target it has
// shown, so a switch back shows them at once, and what each sprite drew last until it draws another. A turn back
// decodes its runs again, from the HTTP cache. A worker drops a picture the ring stops wanting before decoding it, and
// beyond FAR screens from the viewport the ring holds none.
//
// Once switches.js marks the ring data-ahead, after the reader has stayed on its page and never on Save-Data, the
// ring downloads the runs of the NEAR directions on each side of the faced one, so a turn there finds them in the
// HTTP cache. It decodes none of them.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The site's root, which this script is served from: a page in a folder of the site names the ring's pictures from here.
  const SITE = new URL('.', document.currentScript.src);
  const K = window.PAGES.knight;
  const { directions: DIRECTIONS, rates: RATES, ring: RING } = K;
  const MIDDLE = RING.sprites.find(s => s.middle);
  const AROUND = RING.sprites.filter(s => !s.middle);
  // The folder of the 3D model's pictures.
  const MODEL = 'model';
  // How many directions on each side of the faced one the ring downloads ahead.
  const NEAR = 1;
  // How many of those downloads run at once.
  const DOWNLOADS = 2;
  // How many screens from the viewport the ring loads.
  const LOAD = 1;
  // Beyond how many screens the ring lets go of every picture, so a reader moving near it does not load it again.
  const FAR = 3;
  // How long a picture that failed waits before the ring asks for it again, in ms.
  const RETRY = 5000;
  // The most a first run is aimed ahead of the clock, in ms. A turn shows its pose until the clock reaches the run it
  // aimed at, so slow samples, such as downloads a phone stalled, freeze the next turns at most this long.
  const LAG = 1500;
  // What data-failed says when a worker fails, and when one cannot be made.
  const WORKER_FAILED = "the ring's worker failed", NO_WORKER = "the ring's worker did not start";
  // A folder's sizes, smallest first, each with its body's height and the cells of its pictures.
  const ladderOf = folder => folder === MODEL ? K.model : K.sprite;

  // The outline round a ring sprite, in ring units.
  const outlineOf = s => {
    const { half, top, height, corner } = RING.outlined;
    return { x: s.x - s.height * half, y: s.foot - s.height * top, width: s.height * half * 2, height: s.height * height, corner: s.height * corner };
  };
  // Everything the ring can draw: its own extent and the outline round any sprite.
  const EXTENT = AROUND.map(outlineOf).reduce((box, o) => ({
    left: Math.min(box.left, o.x), top: Math.min(box.top, o.y), right: Math.max(box.right, o.x + o.width), bottom: Math.max(box.bottom, o.y + o.height),
  }), RING.extent);

  // The ring's middle and half width in a box w by h, in the box's pixels: what the sprites draw (RING.box) centered
  // in the box, at the largest size that keeps everything the ring can draw inside it.
  const fitted = (w, h) => {
    const { box } = RING;
    const midX = (box.left + box.right) / 2, midY = (box.top + box.bottom) / 2;
    const rx = 0.98 * Math.min(w / 2 / Math.max(midX - EXTENT.left, EXTENT.right - midX), h / 2 / Math.max(midY - EXTENT.top, EXTENT.bottom - midY));
    return { cx: w / 2 - midX * rx, cy: h / 2 - midY * rx, rx };
  };
  const pad = n => String(n).padStart(2, '0');
  const clockAt = (clip, now) => Math.floor(now / 1000 * RATES[clip]) % K.frames[clip];

  for (const box of document.querySelectorAll('[data-ring]')) {
    const canvas = box.querySelector('canvas');
    const context = canvas.getContext('2d');
    const slider = box.querySelector('input[type=range]');
    // The pictures held, by file, each with its bitmap and, for poses, its clip.
    const pictures = new Map();
    // What each sprite drew last, by sprite, while the layout draws it.
    const drew = new Map();
    // The files asked of a worker, each with when it was asked and whether it is a first run.
    const loading = new Map();
    // When each file the ring wants last failed.
    const failed = new Map();
    // The pictures the ring wants, in the order it wants them, the files downloaded ahead, and how many downloads run.
    let wanted = [], warmed = new Set(), warming = 0, warmedFor = '';
    // How long a first run takes from the ask to its arrival, in ms, smoothed over the latest. Until a first run is
    // measured, a little above what a cold one takes at 40 Mbit/s: the first runs at open queue behind the poses and are
    // not measured, so the first turns aim by this value.
    let lag = 300;
    // The direction the middle knight faces, the camera's until a reader turns it. opened is whether the ring has
    // played once, and near whether it loads.
    let spot = MIDDLE.direction, drawn = '', opened = still, laid = '', near = false;
    // The sprites drawn, each with its folder, size and height, laid out for the canvas's size.
    let parts = [];
    // How many of the directions the pictures hold lie between two the ring shows: one at 16 directions, the most
    // the pictures hold, two at 8 and four at 4. A bake in fewer directions holds every second or fourth of these.
    const stepOf = () => DIRECTIONS / (Number(box.dataset.directions) || DIRECTIONS);

    // The workers by lane, as the top of this file names them; null for one that could not start, or that failed less
    // than RETRY ago. replaced holds the lanes whose worker failed until a new one answers with a picture.
    const LANES = { middle: 0, ring: 1, later: 2, poses: 3 };
    const workers = [], replaced = new Set();
    const workerOf = lane => {
      if (!(lane in workers)) {
        try {
          const worker = new Worker(new URL('ring-cells.js', SITE));
          worker.onmessage = arrived;
          // A worker that fails, such as one whose script did not download, is replaced after RETRY, and what it was
          // asked for is asked again.
          worker.onerror = () => {
            box.dataset.failed = WORKER_FAILED;
            worker.terminate();
            workers[lane] = null;
            replaced.add(lane);
            for (const [address, asked] of loading) if (asked.lane === lane) loading.delete(address);
            setTimeout(() => { delete workers[lane]; ask(); }, RETRY);
          };
          workers[lane] = worker;
        } catch {
          box.dataset.failed = NO_WORKER;
          workers[lane] = null;
        }
      }
      return workers[lane];
    };

    // The size of folder a sprite drawn height tall reads: the smallest whose body is at least 0.8 times that height.
    const sizeAt = (folder, height) => {
      const ladder = ladderOf(folder), sizes = Object.keys(ladder);
      return sizes.find(size => ladder[size].bodyHeight * 1.25 >= height) ?? sizes.at(-1);
    };
    // A picture is a run: its file, its cells' shape and, once a cell of it is picked, the cell's index. kind is the
    // clip, folder and size it shows, and strip, for a strip's run, also its direction.
    const file = (folder, clip, size, part) => new URL(`features/knight/${folder}/${clip.toLowerCase()}-${size}-${part}.webp`, SITE).href;
    const kindOf = (part, clip) => `${clip}.${part.folder}.${part.size}`;
    // The run of a clip's poses that holds direction d's cell, with the cell's index in it.
    const poseOf = (part, clip, d) => {
      const { bodyHeight, poses } = ladderOf(part.folder)[part.size], { run } = poses[clip][0], r = Math.floor(d / run);
      return { address: file(part.folder, clip, part.size, `poses-${pad(r)}`), shape: { ...poses[clip][r], bodyHeight }, index: d % run, clip, kind: kindOf(part, clip) };
    };
    // The cells of a clip's strip in a direction.
    const shapeOf = (part, clip, direction) => {
      const { bodyHeight, strips } = ladderOf(part.folder)[part.size];
      return { ...strips[clip][direction], bodyHeight };
    };
    // Run r of a strip, which holds frames r * run on.
    const runOf = (part, clip, direction, r) => ({
      address: file(part.folder, clip, part.size, `${pad(direction)}-${pad(r)}`), shape: shapeOf(part, clip, direction),
      kind: kindOf(part, clip), strip: `${kindOf(part, clip)}.${direction}`,
    });
    const runsOf = (part, clip, direction) => Math.ceil(K.frames[clip] / shapeOf(part, clip, direction).run);
    // The run of the faced direction's strip that holds frame, with the frame's index in it.
    const runAt = (part, clip, frame) => {
      const { run } = shapeOf(part, clip, spot);
      return { ...runOf(part, clip, spot, Math.floor(frame / run)), index: frame % run };
    };
    // The direction whose pose a part draws, and the lane of the worker that loads that pose and its first run.
    const facing = part => part.s.middle ? spot : part.s.direction;
    const laneOf = part => part.s.middle ? LANES.middle : LANES.ring;
    const wants = address => wanted.some(picture => picture.address === address);
    const held = picture => picture && pictures.has(picture.address) ? picture : null;

    // A worker's answer: a picture's bitmap, or that it dropped the picture or failed to load it.
    function arrived({ data: { address, cells, dropped } }) {
      const asked = loading.get(address);
      loading.delete(address);
      // Only a first run with its lane to itself is measured: one queued behind poses, as at open, would aim
      // later turns too far ahead. lag rises faster than it falls, because a run aimed too near waits a whole loop of
      // the clip, while one aimed too far waits only until the clock reaches it. Each sample is capped near twice lag,
      // so one stall, such as a page starved of frames, raises the aim one step rather than to LAG.
      if (cells && asked.first && asked.alone) {
        const took = Math.min(performance.now() - asked.at, 2 * lag + 100);
        lag = Math.min(LAG, lag + (took - lag) * (took > lag ? 0.7 : 0.3));
      }
      if (!wants(address)) {
        cells?.forEach(cell => cell.close());
        failed.delete(address);
        if (box.dataset.failed?.includes(address)) delete box.dataset.failed;
        return;
      }
      if (dropped) {
        // A turn back wanted it again before the worker's answer arrived.
        ask();
      } else if (!cells) {
        // A phone drops a download when the reader leaves the browser, so the ring asks again after RETRY.
        box.dataset.failed = `the ring's picture ${address} did not load`;
        failed.set(address, performance.now());
        setTimeout(() => retry(address), RETRY);
      } else {
        pictures.set(address, { bitmap: cells[0], clip: asked.clip });
        failed.delete(address);
        if (box.dataset.failed?.includes(address)) delete box.dataset.failed;
        if (replaced.delete(asked.lane) && !replaced.size && box.dataset.failed === WORKER_FAILED) delete box.dataset.failed;
      }
    }

    // Works out what the ring wants: nothing beyond the screens it loads from; else the run of poses that holds each
    // drawn sprite's cell, for the two playing parts the faced direction's runs, by how soon the clock reaches them,
    // and the other poses the middle can show, so a turn shows its pose at once while its run loads. Lets go of the
    // rest (release()), tells the workers, and asks for what it does not hold.
    function want() {
      const clip = box.dataset.clip, all = [];
      if (near) {
        for (const part of parts) all.push({ ...poseOf(part, clip, facing(part)), lane: laneOf(part) });
        if (!still) {
          const frame = clockAt(clip, performance.now() + lag), count = K.frames[clip], runs = [];
          for (const part of parts.filter(part => part.plays)) {
            const { run } = shapeOf(part, clip, spot), at = Math.floor(frame / run);
            for (let r = 0; r < runsOf(part, clip, spot); r++) {
              const first = r === at;
              runs.push({ ...runOf(part, clip, spot, r), lane: first ? laneOf(part) : LANES.later, first, soon: (r * run - frame + count) % count });
            }
          }
          all.push(...runs.sort((a, b) => b.first - a.first || a.soon - b.soon));
        }
        const middle = parts.find(part => part.s.middle);
        const step = stepOf();
        for (let away = step; away <= DIRECTIONS / 2; away += step) {
          for (const d of [(spot + away) % DIRECTIONS, (spot - away + DIRECTIONS) % DIRECTIONS]) {
            all.push({ ...poseOf(middle, clip, d), lane: LANES.poses });
          }
        }
      }
      wanted = all.filter((picture, i) => all.findIndex(other => other.address === picture.address) === i);
      if (!near) drew.clear();
      release();
      const addresses = wanted.map(picture => picture.address);
      for (const lane of Object.values(LANES)) {
        if (lane in workers || wanted.some(picture => picture.lane === lane)) workerOf(lane)?.postMessage({ wanted: addresses });
      }
      ask();
    }

    // Closes every picture the ring neither wants, keeps as the clip's poses, nor shows as what a sprite drew last.
    function release() {
      const clip = box.dataset.clip, shown = new Set([...drew.values()].map(picture => picture.address));
      for (const [address, picture] of pictures) {
        if (wants(address) || shown.has(address) || near && picture.clip === clip) continue;
        picture.bitmap.close();
        pictures.delete(address);
      }
    }

    // Lets a picture that failed RETRY ago be asked for again, and clears its failure if the ring no longer wants it.
    function retry(address) {
      failed.delete(address);
      if (!wants(address) && box.dataset.failed?.includes(address)) delete box.dataset.failed;
      ask();
    }

    // Asks the workers for what the ring wants and neither holds, waits for, nor saw fail within RETRY.
    function ask() {
      const now = performance.now();
      for (const { address, lane, first, clip } of wanted) {
        if (pictures.has(address) || loading.has(address) || now - (failed.get(address) ?? -RETRY) < RETRY) continue;
        const worker = workerOf(lane);
        if (!worker) continue;
        const alone = ![...loading.values()].some(asked => asked.lane === lane);
        loading.set(address, { at: now, first, clip, lane, alone });
        worker.postMessage({ address });
      }
    }

    // Downloads the runs of the directions within NEAR of the faced one, nearest first, DOWNLOADS at a time and none
    // while a playing part waits for its run. warmedFor is the layout whose runs it has all downloaded.
    function warm(clip, waiting) {
      if (!('ahead' in box.dataset) || still || waiting || warming >= DOWNLOADS || warmedFor === laid) return;
      const step = stepOf();
      let started = false;
      for (let away = 1; away <= NEAR && warming < DOWNLOADS; away++) {
        for (const direction of [(spot + away * step) % DIRECTIONS, (spot - away * step + DIRECTIONS) % DIRECTIONS]) {
          for (const part of parts.filter(part => part.s.middle || part.s.direction === direction)) {
            for (let r = 0; r < runsOf(part, clip, direction) && warming < DOWNLOADS; r++) {
              const { address } = runOf(part, clip, direction, r);
              if (warmed.has(address) || pictures.has(address) || loading.has(address)) continue;
              warmed.add(address);
              warming++;
              started = true;
              // The body is read whole, so the HTTP cache keeps it. One that fails stays in warmed: a turn there asks
              // for it again.
              fetch(address, { priority: 'low' }).then(response => response.ok && response.blob())
                .catch(() => {}).finally(() => { warming--; });
            }
          }
        }
      }
      if (!started && !warming) warmedFor = laid;
    }

    // Sizes the canvas's bitmap to its box at the screen's pixel ratio, at most 2.
    function fit() {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * ratio), h = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawn = '';
      }
    }

    // Draws a picture's picked cell with its pivot at (x, foot), scaled so its body is height tall.
    function cell({ address, shape: { cell: [cw, ch], pivot: [px, py], bodyHeight }, index }, x, foot, height) {
      const k = height / bodyHeight;
      context.drawImage(pictures.get(address).bitmap, index * cw, 0, cw, ch, x - px * k, foot - py * k, cw * k, ch * k);
    }

    // What the layout and the wanted pictures follow, as the last frame read them.
    let inputs = null;
    // Lays out the sprites and works out what the ring wants, when anything they follow has changed.
    function lay() {
      const { w, h, rx, step, target, clip, isNear } = inputs;
      const layout = `${w}.${h}.${step}.${target}.${clip}.${spot}.${isNear}`;
      if (layout === laid) return;
      laid = layout;
      near = isNear;
      parts = RING.sprites.filter(s => s.middle || s.direction % step === 0).map(s => {
        const height = s.height * rx, folder = s.middle ? MODEL : target;
        return { s, height, folder, size: sizeAt(folder, height), plays: s.middle || s.direction === spot };
      });
      for (const s of drew.keys()) if (!parts.some(part => part.s === s)) drew.delete(s);
      want();
    }

    function draw(now) {
      requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      const within = screens => rect.bottom >= -screens * innerHeight && rect.top <= (screens + 1) * innerHeight;
      const isNear = within(LOAD) || near && within(FAR);
      const clip = box.dataset.clip, target = box.dataset.target;
      const step = stepOf();
      if (slider && Number(slider.step) !== step) Object.assign(slider, { step: String(step), max: String(DIRECTIONS - step) });
      face(Math.round(spot / step) * step % DIRECTIONS);
      fit();
      const w = canvas.width, h = canvas.height;
      const { cx, cy, rx } = fitted(w, h);
      inputs = { w, h, rx, step, target, clip, isNear };
      lay();
      if (!near) return;
      const shown = rect.bottom >= 0 && rect.top <= innerHeight;
      const frame = clockAt(clip, now);
      // A part draws the run the clock is on. Without it, a part whose next run is late holds its last frame, so the
      // late run shows as a pause, not a flash of the pose. Else it draws its pose, and with no pose, as after a turn
      // before the new pose lands, what it drew last of the same clip, target and size.
      for (const part of parts) {
        const last = drew.get(part.s), playing = part.plays && !still ? runAt(part, clip, frame) : null;
        part.run = held(playing);
        part.drawn = part.run ?? (playing && last?.strip === playing.strip ? held(last) : null)
          ?? held(poseOf(part, clip, facing(part))) ?? (last?.kind === kindOf(part, clip) ? held(last) : null);
      }
      const plays = !still && parts.every(part => !part.plays || part.run);
      // The ring dims what it shows until every part has a cell of the picked target and clip to draw, and opens
      // playing.
      if (!parts.every(part => part.drawn) || !(opened || plays)) {
        if (!('pending' in box.dataset)) box.dataset.pending = '';
        return;
      }
      if (!shown) return;
      warm(clip, !plays);
      opened = true;
      if (plays && box.dataset.playing !== clip) box.dataset.playing = clip;
      if (!plays) delete box.dataset.playing;
      // Cleared before the frame is compared with the last one drawn: the canvas may already show it, as after a switch
      // away from a target and back before the other target's poses land.
      delete box.dataset.pending;
      const state = `${laid}.${parts.map(part => `${part.drawn.address}#${part.drawn.index}`).join()}`;
      if (state === drawn) return;
      drawn = state;
      let moved = false;
      for (const part of parts) {
        moved ||= drew.get(part.s)?.address !== part.drawn.address;
        drew.set(part.s, part.drawn);
      }
      if (moved) release();

      const accent = getComputedStyle(root).getPropertyValue('--accent').trim();
      const at = (x, y) => [cx + x * rx, cy + y * rx];
      context.clearRect(0, 0, w, h);
      context.strokeStyle = accent;
      context.lineJoin = 'round';
      context.lineWidth = Math.max(1.5, h / 420);
      context.beginPath();
      context.ellipse(cx, cy, rx, rx * RING.ry, 0, 0, Math.PI * 2);
      context.stroke();

      // What the camera sees: dashed lines to the middle knight.
      const { camera, glyph } = RING;
      const [eyeX, eyeY] = at(camera.x, camera.y);
      context.save();
      context.setLineDash([h / 90, h / 110]);
      for (const sight of RING.sights.filter(sight => sight.x === MIDDLE.x)) {
        context.beginPath();
        context.moveTo(eyeX, eyeY);
        context.lineTo(...at(sight.x, sight.y));
        context.stroke();
      }
      context.restore();

      for (const { s, height, drawn: picture } of parts) cell(picture, ...at(s.x, s.foot), height);

      // The outline round the sprite of the direction the middle knight faces.
      const outline = outlineOf(AROUND.find(s => s.direction === spot));
      context.save();
      context.lineWidth = Math.max(2, h / 300);
      context.beginPath();
      context.roundRect(...at(outline.x, outline.y), outline.width * rx, outline.height * rx, outline.corner * rx);
      context.stroke();
      context.restore();

      // The camera, turned to the middle knight, in the ring's line.
      const length = camera.size * rx, { body } = glyph;
      context.save();
      context.translate(eyeX, eyeY);
      context.rotate(camera.angle);
      context.scale(1, camera.flip);
      context.beginPath();
      context.roundRect(body.x * length, body.y * length, body.width * length, body.height * length, body.corner * length);
      context.stroke();
      for (const reel of glyph.reels) {
        context.beginPath();
        context.arc(reel.x * length, reel.y * length, reel.r * length, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      for (const [x, y] of glyph.lens) context.lineTo(x * length, y * length);
      context.closePath();
      context.stroke();
      context.restore();
    }
    requestAnimationFrame(draw);

    // Turns the middle knight, and asks for the new direction's runs from the turn itself.
    function face(direction) {
      if (direction === spot) return;
      spot = direction;
      box.dataset.facing = String(direction);
      if (slider) slider.value = String(direction);
      if (inputs) lay();
    }
    box.dataset.facing = String(spot);
    // Turns the middle knight to the ring sprite, among the directions shown, whose foot is nearest a pointer event's
    // point, with heights scaled by the ring's ry. It reads the canvas's box each time, so a scroll between moves keeps
    // it right.
    const turnTo = event => {
      const rect = canvas.getBoundingClientRect();
      const { cx, cy, rx } = fitted(rect.width, rect.height);
      const x = (event.clientX - rect.left - cx) / rx, y = (event.clientY - rect.top - cy) / rx;
      const off = s => (x - s.x) ** 2 + ((y - s.foot) / RING.ry) ** 2;
      face(AROUND.filter(s => s.direction % stepOf() === 0).reduce((best, s) => off(s) < off(best) ? s : best).direction);
    };
    // A press that slides turns the knight as it moves. If the browser or a second finger takes it, the knight turns
    // back to where it faced when the press landed.
    let pressedAt = spot;
    slideOrScroll(canvas, { press: () => { pressedAt = spot; }, move: turnTo, cancel: () => face(pressedAt) });
    // Moves that slideOrScroll does not take also turn the knight: a mouse the canvas has not captured, and a pen that
    // hovers.
    canvas.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' ? !canvas.hasPointerCapture(event.pointerId) : !(event.buttons & 1)) turnTo(event);
    });
    // A tap points as the mouse does. click is the browser's judgment of a tap, so a touch that moved too far for a tap,
    // or that stopped a fling, turns nothing.
    canvas.addEventListener('click', turnTo);
    if (slider) {
      slider.value = String(spot);
      slider.addEventListener('input', () => face(Number(slider.value)));
    }
  }
})();
