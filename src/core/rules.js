const registry = new Map();

export function registerDestinationRules(rules) {
  validateRules(rules);
  registry.set(rules.key, rules);
  return rules;
}

export function getDestinationRules(key) {
  const rules = registry.get(key);
  if (!rules) throw new Error(`Destination rules not registered: ${key}`);
  return rules;
}

export function listDestinationRules() {
  return Array.from(registry.values());
}

export function validateRules(rules) {
  if (!rules || typeof rules !== 'object') throw new Error('Rules must be an object.');
  if (!rules.key) throw new Error('Destination rules key is required.');
  if (!rules.name) throw new Error('Destination rules name is required.');
  if (!rules.version) throw new Error('Destination rules version is required.');
  if (!rules.canvas || !rules.canvas.width || !rules.canvas.height) {
    throw new Error(`Destination rules ${rules.key} must define canvas width and height.`);
  }
  if (!rules.package) throw new Error(`Destination rules ${rules.key} must define package rules.`);
  return true;
}
