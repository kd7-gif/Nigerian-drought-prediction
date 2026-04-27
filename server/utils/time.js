function parseAnchor(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function anchorKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastCompleteMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function resolveAnchor(param, defaultAnchor = null) {
  const explicit = parseAnchor(param);
  if (explicit) return explicit;
  const def = parseAnchor(defaultAnchor);
  return def || lastCompleteMonth();
}

function forecastMonthLabels(anchorLike, horizon = 6) {
  const anchor = anchorLike instanceof Date ? anchorLike : resolveAnchor(anchorLike);
  return Array.from({ length: horizon }, (_, i) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() + i + 1, 1);
    return d.toLocaleString('default', { month:'short', year:'2-digit' });
  });
}

module.exports = { parseAnchor, anchorKey, resolveAnchor, forecastMonthLabels, lastCompleteMonth };
