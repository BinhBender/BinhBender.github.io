// Apply before CSS paints; keep the appearance preference separate from progress.
(() => {
  const key = 'recall.theme.v1';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  function apply(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const button = document.getElementById('theme-toggle');
    if (button) button.setAttribute('aria-pressed', String(dark));
    window.dispatchEvent(new Event('themechange'));
  }
  apply(preference === 'dark' || (preference !== 'light' && system.matches));
  system.addEventListener('change', () => {
    if (preference !== 'dark' && preference !== 'light') apply(system.matches);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header');
    const controls = document.createElement('div');
    controls.className = 'header-controls';
    const privacy = header.querySelector(':scope > span');
    if (privacy) controls.append(privacy);
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.className = 'theme-toggle';
    button.type = 'button';
    button.textContent = 'Dark theme';
    button.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
    button.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply(preference === 'dark');
    });
    controls.append(button);
    header.append(controls);
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue;
    apply(preference === 'dark' || (preference !== 'light' && system.matches));
  });
})();
