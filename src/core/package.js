export function createPackagePlan({ destinationKey, artworks, rules, roleMap = {}, order = [] }) {
  if (!destinationKey) throw new Error('destinationKey is required.');
  if (!Array.isArray(artworks)) throw new Error('artworks must be an array.');
  if (!rules?.package) throw new Error('package rules are required.');

  const orderedArtworks = applyOrder(artworks, order);
  const items = orderedArtworks.map((artwork, index) => {
    const role = roleMap[artwork.id] || inferRole(index, rules.package);
    return {
      artworkId: artwork.id,
      role,
      fileName: getPackageFileName(index, role, rules.package),
      order: index
    };
  });

  return {
    destinationKey,
    items,
    metadata: {
      generatedAt: new Date().toISOString(),
      rulesVersion: rules.version
    }
  };
}

export function applyOrder(artworks, order) {
  if (!order?.length) return artworks;
  const map = new Map(artworks.map(item => [item.id, item]));
  const ordered = order.map(id => map.get(id)).filter(Boolean);
  const remaining = artworks.filter(item => !order.includes(item.id));
  return [...ordered, ...remaining];
}

export function inferRole(index, packageRules) {
  const roles = packageRules.roles || [];
  const special = roles.find(role => role.index === index);
  return special?.key || 'sticker';
}

export function getPackageFileName(index, role, packageRules) {
  if (packageRules.naming === 'line-sticker') {
    if (role === 'main') return 'main.png';
    if (role === 'tab') return 'tab.png';
    const stickerIndex = Math.max(1, index - 1);
    return `${String(stickerIndex).padStart(2, '0')}.png`;
  }

  const extension = packageRules.extension || 'png';
  return `${String(index + 1).padStart(3, '0')}.${extension}`;
}
