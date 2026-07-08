const GUIDE_ID = 'usableBetaGuide';
const CARD_SELECTOR = '.usable-beta-empty-card';

export function installUsableBetaGuide(root = document.getElementById('app')) {
  if (!root) return;

  ensureGuideContainer(root);
  updateUsableBetaGuide(root);

  const observer = new MutationObserver(() => updateUsableBetaGuide(root));
  observer.observe(root, { childList: true, subtree: true });

  window.addEventListener('stixio:ready', () => updateUsableBetaGuide(root));
  window.addEventListener('hashchange', () => updateUsableBetaGuide(root));
}

function ensureGuideContainer(root) {
  if (document.getElementById(GUIDE_ID)) return;
  const nav = root.querySelector('header nav[aria-label="Workshop workflow"]');
  if (!nav) return;
  const guide = document.createElement('div');
  guide.id = GUIDE_ID;
  guide.className = 'mx-auto max-w-[1600px] px-5 pb-4';
  nav.insertAdjacentElement('afterend', guide);
}

function updateUsableBetaGuide(root) {
  ensureGuideContainer(root);
  const guide = document.getElementById(GUIDE_ID);
  if (!guide) return;

  const info = getGuideState(root);
  guide.innerHTML = renderGuide(info);
  patchEmptyReview(root, info);
}

function getGuideState(root) {
  const sourceCards = root.querySelectorAll('[data-source-id], #sourceList button, #sourceList article').length;
  const reviewCards = root.querySelectorAll('[data-review-card="true"]').length;
  const exported = root.querySelectorAll('.export-check:checked, #reviewHeroExportInput:checked').length;
  const canExport = root.querySelector('#exportZipBtn:not(:disabled)') != null;

  if (!sourceCards && !reviewCards) {
    return {
      step: 'Start',
      title: 'Import artwork first',
      detail: 'Drop PNG, JPEG, WebP, or SVG artwork into Layout. Refine, Review, and Package unlock after frames exist.',
      action: 'Choose images',
      href: '#stage-layout',
      tone: 'emerald'
    };
  }

  if (!reviewCards) {
    return {
      step: 'Next',
      title: 'Create frames in Layout',
      detail: 'Run Detect or choose a grid preset, then adjust the crop boxes before moving on.',
      action: 'Open Layout',
      href: '#stage-layout',
      tone: 'emerald'
    };
  }

  if (!exported) {
    return {
      step: 'Next',
      title: 'Select outputs in Review',
      detail: 'Mark at least one frame for export so Package can build a ZIP.',
      action: 'Open Review',
      href: '#stage-review',
      tone: 'sky'
    };
  }

  if (!canExport) {
    return {
      step: 'Next',
      title: 'Approve clean frames',
      detail: 'Resolve blocking issues and approve the selected outputs. Package becomes available after Review passes.',
      action: 'Open Review',
      href: '#stage-review',
      tone: 'sky'
    };
  }

  return {
    step: 'Ready',
    title: 'Package is ready',
    detail: 'Download the ZIP or export the .stixio project for handoff and recovery.',
    action: 'Open Package',
    href: '#stage-package',
    tone: 'amber'
  };
}

function renderGuide(info) {
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    sky: 'border-sky-200 bg-sky-50 text-sky-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950'
  }[info.tone] || 'border-slate-200 bg-white text-slate-950';

  return `<section class="flex flex-col gap-3 rounded-2xl border ${toneClass} px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
    <div class="min-w-0">
      <div class="text-[10px] font-black uppercase tracking-[.18em]">${escapeHtml(info.step)} · Usable Beta Path</div>
      <div class="mt-1 text-sm font-black">${escapeHtml(info.title)}</div>
      <p class="mt-1 text-xs font-bold opacity-75">${escapeHtml(info.detail)}</p>
    </div>
    <a href="${info.href}" class="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-center text-xs font-black text-white">${escapeHtml(info.action)}</a>
  </section>`;
}

function patchEmptyReview(root, info) {
  const grid = root.querySelector('#reviewGrid');
  if (!grid || root.querySelector('[data-review-card="true"]')) return;
  if (grid.querySelector(CARD_SELECTOR)) return;

  grid.innerHTML = `<div class="${CARD_SELECTOR.slice(1)} col-span-full rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
    <div class="text-sm font-black text-slate-950">No frames to review yet</div>
    <p class="mx-auto mt-2 max-w-md text-xs font-bold leading-5">${escapeHtml(info.detail)}</p>
    <a href="${info.href}" class="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">${escapeHtml(info.action)}</a>
  </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}
