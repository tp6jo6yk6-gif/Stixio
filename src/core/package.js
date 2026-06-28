export const PackageRoles = Object.freeze({
  MAIN: 'main',
  TAB: 'tab',
  STICKER: 'sticker'
});

export const PackageRoleLabels = Object.freeze({
  [PackageRoles.MAIN]: 'Main',
  [PackageRoles.TAB]: 'Tab',
  [PackageRoles.STICKER]: 'Sticker'
});

export function createPackagePlan({ destinationKey, artworks, rules, roleMap = {}, order = [] }) {
  if (!destinationKey) throw new Error('destinationKey is required.');
  if (!Array.isArray(artworks)) throw new Error('artworks must be an array.');
  if (!rules?.package) throw new Error('package rules are required.');

  const orderedArtworks = applyOrder(artworks, order);
  const normalized = normalizePackageRoleAssignments(orderedArtworks, roleMap, rules.package);
  const items = createPackageItems(orderedArtworks, normalized.roleMap, rules.package);
  const validation = validatePackageRoles(items, rules.package);

  return {
    destinationKey,
    items,
    validation,
    ready: validation.errors.length === 0,
    metadata: {
      generatedAt: new Date().toISOString(),
      rulesVersion: rules.version
    }
  };
}

export function createPackageItems(artworks = [], roleMap = {}, packageRules = {}) {
  const stickerItems = [];
  const items = artworks.map((artwork, index) => {
    const role = normalizePackageRole(roleMap[artwork.id] || artwork.packageRole || artwork.state?.packageRole || PackageRoles.STICKER);
    const item = {
      artworkId: artwork.id,
      role,
      roleLabel: PackageRoleLabels[role],
      order: index,
      stickerIndex: null,
      fileName: null
    };
    if (role === PackageRoles.STICKER) stickerItems.push(item);
    return item;
  });

  stickerItems.forEach((item, stickerIndex) => {
    item.stickerIndex = stickerIndex + 1;
  });

  items.forEach(item => {
    item.fileName = getPackageFileName(item, packageRules);
  });

  return items;
}

export function normalizePackageRoleAssignments(artworks = [], roleMap = {}, packageRules = {}) {
  const nextRoleMap = {};
  artworks.forEach(artwork => {
    nextRoleMap[artwork.id] = normalizePackageRole(roleMap[artwork.id] || artwork.packageRole || artwork.state?.packageRole || PackageRoles.STICKER);
  });

  const roles = getPackageRoleRequirements(packageRules);
  const requiresMain = roles.main.required;
  const requiresTab = roles.tab.required;

  if (requiresMain && !Object.values(nextRoleMap).includes(PackageRoles.MAIN) && artworks[0]) {
    nextRoleMap[artworks[0].id] = PackageRoles.MAIN;
  }

  if (requiresTab && !Object.values(nextRoleMap).includes(PackageRoles.TAB)) {
    const candidate = artworks.find(artwork => nextRoleMap[artwork.id] === PackageRoles.STICKER) || artworks[1];
    if (candidate) nextRoleMap[candidate.id] = PackageRoles.TAB;
  }

  return { roleMap: nextRoleMap };
}

export function validatePackageRoles(items = [], packageRules = {}) {
  const errors = [];
  const warnings = [];
  const counts = countPackageRoles(items);
  const requirements = getPackageRoleRequirements(packageRules);

  if (requirements.main.required && counts.main !== 1) {
    errors.push(createPackageIssue('package.main.count', `Package requires exactly 1 Main image, found ${counts.main}.`, 'error'));
  }

  if (requirements.tab.required && counts.tab !== 1) {
    errors.push(createPackageIssue('package.tab.count', `Package requires exactly 1 Tab image, found ${counts.tab}.`, 'error'));
  }

  if (requirements.sticker.min && counts.sticker < requirements.sticker.min) {
    errors.push(createPackageIssue('package.sticker.min', `Package requires at least ${requirements.sticker.min} Stickers, found ${counts.sticker}.`, 'error'));
  }

  if (requirements.sticker.max && counts.sticker > requirements.sticker.max) {
    errors.push(createPackageIssue('package.sticker.max', `Package allows at most ${requirements.sticker.max} Stickers, found ${counts.sticker}.`, 'error'));
  }

  const duplicateFiles = findDuplicateFileNames(items);
  duplicateFiles.forEach(fileName => {
    errors.push(createPackageIssue('package.filename.duplicate', `Duplicate package filename: ${fileName}.`, 'error'));
  });

  if (!counts.main) warnings.push(createPackageIssue('package.main.missing', 'No Main image selected yet.', 'warning'));
  if (!counts.tab) warnings.push(createPackageIssue('package.tab.missing', 'No Tab image selected yet.', 'warning'));

  return { errors, warnings, counts };
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
  return normalizePackageRole(special?.key || PackageRoles.STICKER);
}

export function getPackageFileName(itemOrIndex, roleOrRules, maybeRules) {
  const legacyMode = typeof itemOrIndex === 'number';
  if (legacyMode) {
    const index = itemOrIndex;
    const role = normalizePackageRole(roleOrRules);
    const packageRules = maybeRules || {};
    return getRoleFileName({ role, order: index, stickerIndex: role === PackageRoles.STICKER ? Math.max(1, index - 1) : null }, packageRules);
  }

  return getRoleFileName(itemOrIndex, roleOrRules || {});
}

export function getRoleFileName(item, packageRules = {}) {
  if (packageRules.naming === 'sticker-package') {
    if (item.role === PackageRoles.MAIN) return 'main.png';
    if (item.role === PackageRoles.TAB) return 'tab.png';
    return `${String(item.stickerIndex || 1).padStart(2, '0')}.png`;
  }

  const extension = packageRules.extension || 'png';
  if (item.role === PackageRoles.MAIN) return `main.${extension}`;
  if (item.role === PackageRoles.TAB) return `tab.${extension}`;
  return `${String(item.stickerIndex || item.order + 1).padStart(3, '0')}.${extension}`;
}

export function normalizePackageRole(role) {
  if (role === PackageRoles.MAIN || role === PackageRoles.TAB || role === PackageRoles.STICKER) return role;
  return PackageRoles.STICKER;
}

export function setArtworkPackageRole(artwork, role) {
  const packageRole = normalizePackageRole(role);
  return {
    ...artwork,
    packageRole,
    state: {
      ...(artwork.state || {}),
      packageRole
    }
  };
}

export function countPackageRoles(items = []) {
  return items.reduce((counts, item) => {
    const role = normalizePackageRole(item.role);
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, { main: 0, tab: 0, sticker: 0 });
}

export function getPackageRoleRequirements(packageRules = {}) {
  const roleRules = packageRules.roles || [];
  const stickerRule = roleRules.find(role => role.key === PackageRoles.STICKER) || {};
  return {
    main: { required: roleRules.some(role => role.key === PackageRoles.MAIN) || packageRules.requiresMain !== false },
    tab: { required: roleRules.some(role => role.key === PackageRoles.TAB) || packageRules.requiresTab !== false },
    sticker: {
      min: packageRules.minStickers || stickerRule.min || 1,
      max: packageRules.maxStickers || stickerRule.max || packageRules.max || null
    }
  };
}

function createPackageIssue(code, message, severity = 'warning') {
  return { code, message, severity };
}

function findDuplicateFileNames(items = []) {
  const seen = new Set();
  const duplicates = new Set();
  items.forEach(item => {
    if (!item.fileName) return;
    if (seen.has(item.fileName)) duplicates.add(item.fileName);
    seen.add(item.fileName);
  });
  return Array.from(duplicates);
}
