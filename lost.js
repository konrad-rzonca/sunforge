// A missing address in a language the site serves, /<language>/<page>, reaches the English page where the
// language lacks it, and otherwise shows this page in that language where a <template> under .tongues holds it.
(() => {
  const tongues = document.querySelector('.tongues');
  const [, code, ...rest] = location.pathname.split('/');
  if (!tongues || !tongues.dataset.languages.split(' ').includes(code)) return;
  const english = `/${rest.join('/')}`;
  if (tongues.dataset.pages.split(' ').includes(english)) {
    location.replace(english + location.search + location.hash);
    return;
  }
  const held = [...tongues.querySelectorAll('template')].find((template) => template.dataset.language === code);
  if (!held) return;
  const shown = held.content;
  document.querySelector('header.nav').replaceWith(shown.querySelector('header'));
  document.querySelector('main').replaceWith(shown.querySelector('main'));
  document.documentElement.lang = held.lang;
  document.title = held.dataset.title;
})();

// The not-found page's rules for a guide address, by what /guide/versions.js says the site holds. An address
// with a version is /guide/<product>/<version>/<language>/<page>/. The editor of a version with no guide, such
// as a development build, reaches the stable copy's page, /guide/<product>/<language>/<page>/, which names the
// version asked for. An address in a language its version or the stable copy does not serve reaches the same
// page in English, and a version with no language its product's chooser. Any other missing address stays here.
(() => {
  const [, root, product, second, ...rest] = location.pathname.split('/');
  const guide = root === 'guide' && (window.GUIDES || {})[product];
  // An address that was sent on once and is still missing has no page in the stable copy.
  if (!guide || !second || new URLSearchParams(location.search).has('from')) return;
  if (/^[0-9]+[.][0-9]+$/.test(second)) {
    const [language, ...page] = rest;
    const held = guide.versions[second];
    if (!held) {
      const speaks = guide.languages.includes(language) ? language : 'en';
      location.replace(`/guide/${product}/${speaks}/${page.join('/')}?from=${encodeURIComponent(second)}${location.hash}`);
    } else if (!language) {
      location.replace(`/guide/${product}/`);
    } else if (!held.includes(language)) {
      location.replace(`/guide/${product}/${second}/en/${page.join('/')}${location.hash}`);
    }
  } else if (second !== 'en' && /^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(second) && !guide.languages.includes(second.toLowerCase())) {
    // A part shaped like a language tag is read as a language the stable copy does not serve.
    location.replace(`/guide/${product}/en/${rest.join('/')}${location.hash}`);
  }
})();
