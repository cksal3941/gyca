// Verified Unsplash photos (art / books / galleries / creativity) used to fill
// image boxes that have no real cover yet. The pick is deterministic by seed, so
// a given slug always shows the same photo. Replace with real artwork/photos
// before launch.
const POOL = [
  "photo-1518998053901-5348d3961a04", // gallery / paintings
  "photo-1544716278-ca5e3f4abd8c", // exhibition space
  "photo-1481627834876-b7833e8f5570", // books / library
  "photo-1513364776144-60967b0f800f", // open books
  "photo-1495562569060-2eec283d3391", // theater seats / stage
  "photo-1587825140708-dfaf72ae4b04", // performance / stage
  "photo-1516450360452-9312f5e86fc7", // stage lights / concert
  "photo-1470229722913-7c0e2dbbafd3", // concert crowd
  "photo-1493225457124-a3eb161ffa5f", // music / piano
  "photo-1465847899084-d164df4dedc6", // orchestra / music
  "photo-1499364615650-ec38552f4f34", // concert stage
  "photo-1544161515-4ab6ce6db874", // piano hands
] as const;

/** A stable Unsplash image URL for a seed (e.g. a slug), sized for its box. */
export function unsplashCover(seed: string, w = 1200): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return `https://images.unsplash.com/${POOL[h % POOL.length]}?auto=format&fit=crop&w=${w}&q=70`;
}

/** CSS `background-image` value: the real cover if present, otherwise an
 *  Unsplash fill — with the fill also layered under a possibly-missing local
 *  cover so a 404 still shows a photo (never a flat gradient). */
export function coverBg(seed: string, cover: string | null, w = 1200): string {
  const fill = `url(${unsplashCover(seed, w)})`;
  return cover ? `url(${cover}), ${fill}` : fill;
}
