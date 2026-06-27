// Export Engine
// Owns file delivery formats such as PNG, ZIP, and future formats.

export const ExportFormats = Object.freeze({
  PNG: 'png',
  ZIP: 'zip',
  JSON: 'json'
});

export function createExportJob({
  id = createId('export'),
  format = ExportFormats.PNG,
  destinationKey = null,
  packagePlan = null,
  items = [],
  fileName = 'stixio-export',
  metadata = {}
} = {}) {
  return {
    id,
    format,
    destinationKey,
    packagePlan,
    items,
    fileName,
    metadata,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function markExportRunning(job) {
  return touchExportJob({ ...job, status: 'running' });
}

export function markExportComplete(job, result = {}) {
  return touchExportJob({ ...job, status: 'complete', result });
}

export function markExportFailed(job, error) {
  return touchExportJob({ ...job, status: 'failed', error: String(error?.message || error) });
}

export function touchExportJob(job) {
  return {
    ...job,
    updatedAt: new Date().toISOString()
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
