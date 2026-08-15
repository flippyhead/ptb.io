// Feeds for the "things I've recently ..." lists on the homepage.
//
// Loaded once, deferred, from _includes/head.html. Deferred scripts run
// after the document is parsed, which is what lets this read the markup
// the Goodreads widget injects synchronously further down the page.
//
// Adding a feed: write a function returning [{ href, text }, ...] and
// hand it to renderList with the id of its target span.

const LIST_FORMAT = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

// Last.fm caps the response server-side, so we ask for what we display
// rather than fetching everything and slicing.
const LASTFM_URL =
  'https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks' +
  '&user=flippyheads&api_key=b094d5020475474c4db04cd7686b4acb&format=json&limit=12';

// Fills #<id> with "a, b and c." and reveals the paragraph around it,
// which ships hidden so a dead feed leaves no dangling half-sentence.
// Both feeds are third-party, so an item is only linked if it is an
// absolute http(s) URL. Without this a `javascript:` href from either feed
// would become a clickable script. Parsing rather than pattern-matching
// gets the evasions for free: leading whitespace, embedded tabs, casing.
// No base URL on purpose — anything relative, empty, or missing throws
// here rather than quietly resolving into a link to our own pages.
function isWebLink(href) {
  try {
    return /^https?:$/.test(new URL(href).protocol);
  } catch {
    return false;
  }
}

// Builds real nodes instead of innerHTML: the titles are third-party.
function renderList(id, feedItems) {
  const target = document.getElementById(id);
  const items = feedItems.filter((item) => isWebLink(item.href));
  if (!target || !items.length) return;

  let next = 0;
  for (const part of LIST_FORMAT.formatToParts(items.map((item) => item.text))) {
    if (part.type === 'literal') {
      target.append(part.value);
      continue;
    }
    const { href, text } = items[next++];
    const link = document.createElement('a');
    link.href = href;
    link.textContent = text;
    target.append(link);
  }
  target.append('.');

  target.closest('p')?.classList.remove('hidden');
}

function goodreadsBooks() {
  return [...document.querySelectorAll('#gr_grid_widget_1431821457 a')]
    .map((anchor) => ({ href: anchor.href, text: anchor.title }))
    .filter((book) => book.text);
}

async function lastfmTracks() {
  const response = await fetch(LASTFM_URL);
  if (!response.ok) throw new Error(`Last.fm returned ${response.status}`);

  const { recenttracks } = await response.json();
  return (recenttracks?.track ?? [])
    .map((track) => ({
      href: track.url,
      text: `${track.name} by ${track.artist?.['#text']}`,
    }));
}

renderList('goodreads', goodreadsBooks());

lastfmTracks()
  .then((tracks) => renderList('spotify', tracks))
  .catch((error) => console.warn('Last.fm feed unavailable:', error));
