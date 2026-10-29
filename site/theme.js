// Apply before CSS paints; keep the appearance preference separate from progress.
(() => {
  const key = 'recall.theme.v1';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  function apply(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.textContent = dark ? 'Switch to light' : 'Switch to dark';
      button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    window.dispatchEvent(new Event('themechange'));
  }
  apply(preference === 'dark' || (preference !== 'light' && system.matches));
  const followSystem = () => {
    if (preference !== 'dark' && preference !== 'light') apply(system.matches);
  };
  if (system.addEventListener) system.addEventListener('change', followSystem);
  else if (system.addListener) system.addListener(followSystem);
  function mountToggle() {
    const header = document.querySelector('header');
    if (!header || document.getElementById('theme-toggle')) return;
    const controls = document.createElement('div');
    controls.className = 'header-controls';
    const privacy = header.querySelector(':scope > span');
    if (privacy) controls.append(privacy);
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.className = 'theme-toggle';
    button.type = 'button';
    button.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
    button.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply(preference === 'dark');
    });
    controls.append(button);
    header.append(controls);
    apply(document.documentElement.dataset.theme === 'dark');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle, {once:true});
  else mountToggle();
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue;
    apply(preference === 'dark' || (preference !== 'light' && system.matches));
  });
})();
