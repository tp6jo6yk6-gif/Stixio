export const BRAND = Object.freeze({
  name: 'Stixio',
  shortName: 'Stixio',
  slogan: 'Create once. Adapt everywhere.',
  mission: 'A fast sticker production workspace for creators.',
  productCategory: 'Sticker Production Workspace',
  version: '0.9.0-beta',
  betaHost: 'beta.stixio.app',
  productionHost: 'stixio.app'
});

export function getAppTitle() {
  return `${BRAND.name} - ${BRAND.slogan}`;
}
