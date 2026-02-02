export function buildAssetUrl(p?: string) {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const base = import.meta.env.VITE_ASSET_BASE_URL || '';
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}
