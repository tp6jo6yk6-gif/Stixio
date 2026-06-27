// Feature Engine
// During development, Developer enables everything. Production plans can narrow later.

export const PlanKeys = Object.freeze({
  DEVELOPER: 'developer',
  FREE: 'free',
  STARTER: 'starter',
  CREATOR: 'creator'
});

export const FeatureKeys = Object.freeze({
  ZIP_EXPORT: 'zipExport',
  WORKSPACE: 'workspace',
  GOOGLE_DRIVE: 'googleDrive',
  HISTORY: 'history',
  PROMPT_LIBRARY: 'promptLibrary',
  BRUSH_REPAIR: 'brushRepair',
  MULTI_PLATFORM: 'multiPlatform'
});

export const Plans = Object.freeze({
  [PlanKeys.DEVELOPER]: allFeatures(true),
  [PlanKeys.FREE]: {
    [FeatureKeys.ZIP_EXPORT]: true,
    [FeatureKeys.WORKSPACE]: true,
    [FeatureKeys.GOOGLE_DRIVE]: true,
    [FeatureKeys.HISTORY]: true,
    [FeatureKeys.PROMPT_LIBRARY]: true,
    [FeatureKeys.BRUSH_REPAIR]: true,
    [FeatureKeys.MULTI_PLATFORM]: true
  },
  [PlanKeys.STARTER]: allFeatures(true),
  [PlanKeys.CREATOR]: allFeatures(true)
});

export function createFeatureContext({ plan = PlanKeys.DEVELOPER, overrides = {} } = {}) {
  return {
    plan,
    features: {
      ...(Plans[plan] || Plans[PlanKeys.DEVELOPER]),
      ...overrides
    }
  };
}

export function canUse(context, featureKey) {
  return Boolean(context?.features?.[featureKey]);
}

export function requireFeature(context, featureKey) {
  if (!canUse(context, featureKey)) throw new Error(`Feature not available: ${featureKey}`);
  return true;
}

export function allFeatures(value = true) {
  return Object.fromEntries(Object.values(FeatureKeys).map(key => [key, value]));
}
