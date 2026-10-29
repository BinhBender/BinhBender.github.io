// Convert ordinary video links to player URLs. Never embed arbitrary web pages.
export function videoSource(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  let id;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    id = host.endsWith('youtu.be') ? parts[0] : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : url.searchParams.get('v');
    if (!/^[\w-]{11}$/.test(id || '')) return null;
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    const timestamp = url.searchParams.get('start') || url.searchParams.get('t');
    if (timestamp) {
      const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(timestamp);
      if (match) {
        const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
        if (seconds) embed.searchParams.set('start', seconds);
      }
    }
    return {type:'iframe', src:embed.href, url:url.href};
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = /^\/(?:video\/)?(\d+)(?:\/([\w]+))?\/?$/.exec(url.pathname);
    if (!match) return null;
    const embed = new URL(`https://player.vimeo.com/video/${match[1]}`);
    const hash = url.searchParams.get('h') || match[2];
    if (hash) embed.searchParams.set('h', hash);
    return {type:'iframe',src:embed.href,url:url.href};
  }
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return {type:'video',src:url.href,url:url.href};
  return null;
}

export function setupStudyVideo(study) {
  // Preserve index.html: move existing study controls into a layout at runtime.
  const layout = document.createElement('div');
  layout.className = 'study-layout';
  const cards = document.createElement('div');
  cards.className = 'study-cards';
  cards.append(study.querySelector('.card-shell'));
  cards.append(study.querySelector('#reveal-wrap'), study.querySelector('#ratings'));
  const aside = document.createElement('aside');
  aside.className = 'study-video';
  aside.setAttribute('aria-label', 'Deck video');
  aside.hidden = true;
  layout.append(cards, aside);
  study.append(layout);
  return function showVideo(deck) {
    // Called only on deck changes, so revealing/rating never restarts playback.
    aside.replaceChildren();
    study.classList.remove('has-video');
    aside.hidden = true;
    if (!deck?.video_url) return;
    aside.hidden = false;
    study.classList.add('has-video');
    const heading = document.createElement('h2');
    heading.textContent = 'Watch alongside';
    aside.append(heading);
    const source = videoSource(deck.video_url);
    if (!source) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Use a YouTube, Vimeo, or direct MP4/WebM/OGG video URL in deck-videos.csv.';
      aside.append(hint);
      return;
    }
    const player = document.createElement(source.type);
    player.className = 'deck-video-player';
    player.title = `Video for ${deck.name}`;
    if (source.type === 'iframe') {
      player.allow = 'fullscreen; picture-in-picture; encrypted-media';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
    } else {
      player.controls = true;
      player.preload = 'metadata';
      player.playsInline = true;
    }
    player.src = source.src;
    const link = document.createElement('a');
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'text-button';
    link.textContent = 'Open video in a new tab ↗';
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'If playback is unavailable here, open the video in a new tab.';
    aside.append(player, link, hint);
  };
}
