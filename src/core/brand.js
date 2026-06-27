export const BRAND = Object.freeze({
  name: 'Stixio',
  slogan: 'One workspace. Every sticker.',
  mission: 'Create once. Adapt everywhere.',
  productCategory: 'Sticker Production Workspace'
});

export function getAppTitle() {
  return BRAND.name + ' - ' + BRAND.slogan;
}
