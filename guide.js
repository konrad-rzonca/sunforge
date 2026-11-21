// The guide's pages: a switch between pictures, the card that says what the spot under the pointer is, a menu's
// picture, which lights what the pointer is on, a sample's group, which opens for an address that names an entry
// in it, the note for a reader the not-found page sent here, and the search. A page reads whole without this
// script: every picture and list then shows, and a closed group opens on a click.
(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  // A switch sets its axis on the group of pictures that holds it, which shows the picture of that pick.
  const show = (group) => {
    all('[data-tab][data-view]', group).forEach((each) => {
      if (each !== group) each.hidden = each.dataset.tab !== group.dataset.tab || each.dataset.view !== group.dataset.view;
    });
    all('[data-switch] button', group).forEach((button) => button.setAttribute('aria-pressed', String(group.dataset[button.parentElement.dataset.switch] === button.dataset.pick)));
  };
  all('[data-picks]').forEach(show);
  all('[data-switch]').forEach((row) => row.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const group = row.closest('[data-picks]');
    group.dataset[row.dataset.switch] = button.dataset.pick;
    show(group);
  }));

  // The card over a picture says what the spot the pointer or the keyboard is on does, and keeps the last one.
  all('.shots').forEach((stage) => {
    const card = stage.querySelector('.card');
    if (!card) return;
    const tell = (spot) => {
      all('.spot.is-on', stage).forEach((other) => other.classList.remove('is-on'));
      spot.classList.add('is-on');
      card.classList.add('is-on');
      card.querySelector('.title').textContent = spot.dataset.title;
      card.querySelector('.tip').textContent = spot.dataset.tip;
      card.scrollTop = 0;
    };
    stage.addEventListener('pointerover', (event) => event.target.closest('.spot') && tell(event.target.closest('.spot')));
    stage.addEventListener('focusin', (event) => {
      const spot = event.target.closest('.spot');
      if (!spot) return;
      tell(spot);
      if (!spot.matches(':focus-visible')) return;
      // The card stays under the nav while the picture scrolls, and the keyboard can reach a spot behind it. The
      // page then moves down until the card clears the spot. A pointer cannot reach one.
      spot.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      const named = spot.getBoundingClientRect();
      const over = card.getBoundingClientRect();
      if (over.left < named.right && named.left < over.right && named.top < over.bottom) scrollBy({ top: named.top - over.bottom - 12, behavior: 'instant' });
    });
  });

  // A menu's picture beside its lines: an item of the picture lights the lines it stands for, and a line its item.
  all('.place').forEach((place) => {
    const spots = all('.spot[data-for]', place);
    const light = (keys) => {
      all('.is-lit', place).forEach((line) => line.classList.remove('is-lit'));
      spots.forEach((spot) => spot.classList.toggle('is-on', spot.dataset.for.split(' ').some((key) => keys.includes(key))));
      keys.forEach((key) => document.getElementById(key)?.classList.add('is-lit'));
    };
    const pointed = (event) => {
      const spot = event.target.closest('.spot[data-for]');
      const line = event.target.closest('.entries > li[id]');
      if (spot || line) light(spot ? spot.dataset.for.split(' ') : [line.id]);
    };
    place.addEventListener('pointerover', pointed);
    place.addEventListener('focusin', pointed);
    place.addEventListener('pointerleave', () => light([]));
    place.addEventListener('focusout', () => light([]));
  });

  // A sample's group is closed until the reader opens it, or the address names it or an entry in it. Not every
  // browser opens a closed group for an address, so the page opens it and scrolls there.
  const reveal = () => {
    let named = null;
    try { named = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch { /* A hash that is no encoding names nothing. */ }
    const group = named?.closest('details.sample');
    if (!group || group.open) return;
    group.open = true;
    named.scrollIntoView({ behavior: 'instant' });
  };
  reveal();
  addEventListener('hashchange', reveal);

  // The not-found page sends an address of a version with no guide to this one, and names the version asked for.
  // An address whose key this version does not hold says so.
  const notice = document.querySelector('.guide .notice');
  // Only a version's number is shown: the address is anyone's to write.
  const asked = (new URLSearchParams(location.search).get('from') || '').match(/^[0-9]+[.][0-9]+$/)?.[0];
  let key = location.hash.slice(1);
  try { key = decodeURIComponent(key); } catch { /* A hash that is no encoding names no entry as it is. */ }
  const said = notice ? [asked && notice.dataset.other.replace('{asked}', asked), key && !document.getElementById(key) && notice.dataset.missing].filter(Boolean) : [];
  if (said.length) {
    notice.textContent = said.join(' ');
    notice.hidden = false;
  }
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);

  // The search: every word typed must be in an entry's name or line, and a name that starts with the first word
  // comes first.
  const input = document.querySelector('.search input');
  const found = document.getElementById('found');
  const entries = window.GUIDE_SEARCH || [];
  // An entry's address is from the folder of the script that holds the entries.
  const index = document.querySelector('script[src$="search.js"]');
  const LIMIT = 40;
  const search = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    found.hidden = !words.length;
    if (!words.length) return;
    const hits = entries.map((entry) => ({ entry, title: entry.t.toLowerCase(), text: `${entry.t} ${entry.d} ${entry.k}`.toLowerCase() }))
      .filter((each) => words.every((word) => each.text.includes(word)))
      .sort((a, b) => (b.title.startsWith(words[0]) - a.title.startsWith(words[0])) || (b.title.includes(words[0]) - a.title.includes(words[0])));
    found.replaceChildren(...hits.slice(0, LIMIT).map(({ entry }) => {
      const link = document.createElement('a');
      link.href = new URL(entry.u, index.src).href;
      for (const [tag, text] of [['small', entry.k], ['b', entry.t], ['span', entry.d]]) link.appendChild(document.createElement(tag)).textContent = text;
      return link;
    }));
    if (!hits.length) found.appendChild(document.createElement('p')).textContent = found.dataset.nothing;
  };
  input.addEventListener('input', search);
  input.addEventListener('focus', search);
  found.addEventListener('click', () => { found.hidden = true; });
  addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== input) { event.preventDefault(); input.focus(); }
    if (event.key === 'Escape') { found.hidden = true; input.blur(); }
    if (event.key === 'Enter' && document.activeElement === input && found.firstElementChild?.href) found.firstElementChild.click();
  });
  addEventListener('pointerdown', (event) => { if (!event.target.closest('.finder')) found.hidden = true; });
})();
