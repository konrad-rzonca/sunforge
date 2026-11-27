// A plate's focus frame: its outline, 2.5 pixels off it with its corners cut where the
// plate's are (landing.css), stroked as SVG in the button's own pixels on the half pixel, so its
// cut corners draw as fine as its straight sides. Each plate's frame is drawn again when its size
// changes.
(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const OFF = -2.5;

  function frame(button) {
    let svg = button.querySelector('svg.frame');
    if (!svg) {
      svg = document.createElementNS(SVG, 'svg');
      svg.classList.add('frame');
      svg.setAttribute('aria-hidden', 'true');
      button.append(svg);
    }
    const w = button.offsetWidth, h = button.offsetHeight;
    const cut = parseFloat(getComputedStyle(button).getPropertyValue('--cut')) || 0;
    const d = OFF, c = cut - d * (2 - Math.SQRT2);
    const points = [[c + d, d], [w - c - d, d], [w - d, c + d], [w - d, h - c - d], [w - c - d, h - d], [c + d, h - d], [d, h - c - d], [d, c + d]];
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = `<path d="M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z"/>`;
  }

  const sized = new ResizeObserver(entries => entries.forEach(entry => frame(entry.target)));
  document.querySelectorAll('.button').forEach(button => sized.observe(button));
})();
