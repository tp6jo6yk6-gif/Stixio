(() => {
  try {
    if (window.__stixioRefineMaskedPreviewPatch) return;
    window.__stixioRefineMaskedPreviewPatch = true;

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

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installSafeStyles, { once: true });
    } else {
      installSafeStyles();
    }
  } catch (error) {
    console.warn('Stixio safe restore patch skipped:', error);
  }
})();
