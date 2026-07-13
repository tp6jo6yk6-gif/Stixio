(() => {
  try {
    if (window.__stixioRefineMaskedPreviewPatch) return;
    window.__stixioRefineMaskedPreviewPatch = true;

    const deletedSourceIds = new Set();
    let observer = null;

    const installSafeStyles = () => {
      if (document.getElementById('stixio-refine-safe-restore')) return;
      const style = document.createElement('style');
      style.id = 'stixio-refine-safe-restore';
      style.textContent = `
        #stage-refine #refineWorkspace {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        #stage-refine #refineViewport,
        #stage-refine #refineResultPane {
          display: grid !important;
          min-height: 430px !important;
        }

        #stage-refine #refineCanvas,
        #stage-refine #refineOutputCanvas {
          image-rendering: auto;
        }

        @media (max-width: 1023px) {
          #stage-refine #refineWorkspace {
            grid-template-columns: 1fr !important;
          }
        }
      `;
      document.head.appendChild(style);
    };

    const liveSourceIds = () => new Set([...document.querySelectorAll('#sourceList [data-source-id]')].map(node => node.dataset.sourceId).filter(Boolean));
    const clearCanvas = id => {
      const canvas = document.getElementById(id);
      const ctx = canvas?.getContext?.('2d');
      if (!canvas || !ctx) return;
      canvas.width = 1;
      canvas.height = 1;
      ctx.clearRect(0, 0, 1, 1);
    };

    const hasSelectedReviewCard = () => Boolean(document.querySelector('#reviewGrid [data-review-card="true"].border-sky-400'));

    const scrubDeletedSource = sourceId => {
      if (!sourceId) return;
      if (liveSourceIds().has(sourceId)) return;

      deletedSourceIds.add(sourceId);
      document.querySelectorAll(`#reviewGrid [data-source-id="${CSS.escape(sourceId)}"]`).forEach(node => node.remove());
      document.querySelectorAll(`[data-source-id="${CSS.escape(sourceId)}"] img`).forEach(image => image.removeAttribute('src'));

      if (!hasSelectedReviewCard()) {
        document.getElementById('reviewHeroImage')?.removeAttribute('src');
        clearCanvas('refineCanvas');
        clearCanvas('refineOutputCanvas');
      }
    };

    const scrubAllDeletedSources = () => {
      [...deletedSourceIds].forEach(sourceId => scrubDeletedSource(sourceId));
    };

    const watchLateThumbnailWrites = () => {
      if (observer || !document.body) return;
      observer = new MutationObserver(mutations => {
        if (!deletedSourceIds.size) return;
        if (!mutations.some(item => item.type === 'attributes' && item.attributeName === 'src')) return;
        requestAnimationFrame(scrubAllDeletedSources);
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['src'], subtree: true });
    };

    const installDeleteGuard = () => {
      if (document.documentElement.dataset.stixioSourceDeleteGuard === 'true') return;
      document.documentElement.dataset.stixioSourceDeleteGuard = 'true';
      document.addEventListener('click', event => {
        const button = event.target?.closest?.('button');
        const row = button?.closest?.('#sourceList [data-source-id]');
        if (!button || !row || row.lastElementChild !== button) return;
        const sourceId = row.dataset.sourceId;
        [0, 80, 240, 600, 1200].forEach(delay => setTimeout(() => scrubDeletedSource(sourceId), delay));
      }, true);
      watchLateThumbnailWrites();
    };

    const install = () => {
      installSafeStyles();
      installDeleteGuard();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
  } catch (error) {
    console.warn('Stixio safe restore patch skipped:', error);
  }
})();
