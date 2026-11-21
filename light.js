// The hero's moving light, drawn over the plate from what scene.js holds of a frame's light. The
// breath moves the frame's light to another mix of it and back: down is that mix as what the plate
// is multiplied by, and up as what is added to it, stored gain times over, so both at a strength of
// a show the plate a of the way to the mix. The face is the star's face at each moment of its boil,
// one atlas of square cuts, dissolved one into the next.
(() => {
  const TAU = Math.PI * 2;
  // The seconds one breath takes, and the seconds from one moment of the boil to the next.
  const BREATH = 8, MOMENT = 1;
  // A frame's step is at most this many seconds, so the light goes on from where it stopped.
  const STEP = 0.05;
  // The breath's strength t seconds in: 0 at the start, so the light adds nothing to the first
  // paint, and never quite even, since its speed drifts over a period 2.7 times as long.
  const breath = (t) => 0.5 - 0.5 * Math.cos((TAU * t) / BREATH + 0.6 * Math.sin((TAU * t) / (2.7 * BREATH)));
  // The face is drawn round, as far as the bezel that mirrors it: the wall round the star's rays
  // takes the breath.
  const ROUND = 'radial-gradient(circle closest-side, #000 80%, transparent 96%)';

  // The light of scene, a frame of scene.js, drawn in the stage under the element before. Returns
  // load(), which fetches the pictures, puts the light in the stage once they are decoded and
  // resolves then, track(now, shift) for each frame the hero shows, with the time in seconds and
  // the plate's parallax, and stop(), which takes the light out of the stage for good.
  // A file's path in scene.js is from the site's root, which holds this script.
  const here = document.currentScript.src;
  window.Light = ({ scene, stage, before }) => {
    const { down, up, gain, face } = scene.light;
    const [W, H] = scene.size;
    const loads = [];
    const picture = (file) => {
      const img = new Image();
      img.alt = '';
      loads.push([img, file]);
      return img;
    };
    // Each of the breath's layers with the opacity it has at full strength.
    const layers = [[down, 'multiply', 1], [up, 'plus-lighter', 1 / gain]].filter(([file]) => file).map(([file, blend, most]) => {
      const img = picture(file);
      img.className = 'layer';
      img.style.mixBlendMode = blend;
      img.style.opacity = '0';
      return { img, most, opacity: '0' };
    });
    let atlas, canvas, context;
    if (face) {
      atlas = picture(face.atlas);
      canvas = document.createElement('canvas');
      canvas.className = 'layer';
      canvas.width = canvas.height = face.side;
      const [left, top, right, bottom] = face.box;
      const part = (value, of) => `${(value / of) * 100}%`;
      Object.assign(canvas.style, {
        inset: 'auto', left: part(left, W), top: part(top, H), width: part(right - left, W), height: part(bottom - top, H),
        maskImage: ROUND, webkitMaskImage: ROUND,
      });
      context = canvas.getContext('2d');
    }
    const drawn = [...layers.map((layer) => layer.img), ...(canvas ? [canvas] : [])];

    // The light's clock: the sum of the frames' steps, each at most STEP, so it stops while the tab
    // is hidden or the hero is out of sight.
    let ready = false, stopped = false, clock = 0, then = null;
    function load() {
      for (const [img, file] of loads) img.src = new URL(file, here).href;
      return Promise.all(loads.map(([img]) => img.decode().catch(() => {}))).then(() => {
        if (stopped) return;
        for (const element of drawn) stage.insertBefore(element, before);
        ready = true;
      });
    }

    // The face t seconds in: the moment it is in, and the next one over it as far as it has come.
    function boil(t) {
      const at = (t / MOMENT) % face.count;
      const one = Math.floor(at), two = (one + 1) % face.count;
      const side = face.side;
      const cut = (index, alpha) => {
        context.globalAlpha = alpha;
        context.drawImage(atlas, (index % face.columns) * side, Math.floor(index / face.columns) * side, side, side, 0, 0, side, side);
      };
      context.clearRect(0, 0, side, side);
      cut(one, 1);
      cut(two, at - one);
    }

    function track(now, shift) {
      if (!ready) return;
      if (then !== null) clock += Math.max(0, Math.min(STEP, now - then));
      then = now;
      const t = clock;
      for (const element of drawn) if (element.style.translate !== shift) element.style.translate = shift;
      for (const layer of layers) {
        const opacity = (breath(t) * layer.most).toFixed(4);
        if (layer.opacity !== opacity) layer.opacity = layer.img.style.opacity = opacity;
      }
      // An atlas that failed to load has no width, and drawing it would throw.
      if (face && atlas.naturalWidth) boil(t);
    }

    function stop() {
      stopped = true;
      ready = false;
      for (const element of drawn) element.remove();
    }

    return { load, track, stop };
  };
})();
