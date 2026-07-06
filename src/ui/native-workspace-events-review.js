export const REVIEW_WORKSPACE_EVENTS = String.raw`function bindReviewEvents(root) {
  root.querySelectorAll('.review-bg').forEach(button => {
    button.addEventListener('click', () => {
      state.settings.reviewBackground = button.dataset.reviewBg;
      renderReviewGrid();
      renderLargeReview();
      refreshReviewControls();
    });
  });
  root.querySelector('#toggleSafeGuideBtn')?.addEventListener('click', () => {
    state.settings.showSafeGuide = !state.settings.showSafeGuide;
    renderLargeReview();
    const button = root.querySelector('#toggleSafeGuideBtn');
    if (button) button.textContent = (state.settings.showSafeGuide ? '隱藏' : '顯示') + '安全區';
  });
  root.querySelector('#toggleContentBoundsBtn')?.addEventListener('click', () => {
    state.settings.showContentBounds = !state.settings.showContentBounds;
    renderLargeReview();
    const button = root.querySelector('#toggleContentBoundsBtn');
    if (button) button.textContent = (state.settings.showContentBounds ? '隱藏' : '顯示') + '內容邊界';
  });
  root.querySelector('#reviewSearchInput')?.addEventListener('input', event => {
    state.settings.reviewSearch = event.target.value;
    renderReviewGrid();
    renderReviewProgress();
  });
  root.querySelector('#reviewFilterInput')?.addEventListener('change', event => {
    state.settings.reviewFilter = event.target.value;
    renderReviewGrid();
    renderReviewProgress();
  });
  root.querySelector('#reviewSortInput')?.addEventListener('change', event => {
    state.settings.reviewSort = event.target.value;
    renderReviewGrid();
  });

  root.querySelector('#reviewPrevBtn')?.addEventListener('click', () => navigateReview(-1));
  root.querySelector('#reviewNextBtn')?.addEventListener('click', () => navigateReview(1));
  root.querySelector('#reviewZoomOutBtn')?.addEventListener('click', () => setReviewZoom(state.reviewView.zoom / 1.2));
  root.querySelector('#reviewZoomResetBtn')?.addEventListener('click', resetReviewViewport);
  root.querySelector('#reviewZoomInBtn')?.addEventListener('click', () => setReviewZoom(state.reviewView.zoom * 1.2));
  root.querySelector('#reviewSelectAllBtn')?.addEventListener('click', () => batchReviewExport('all'));
  root.querySelector('#reviewSelectNoneBtn')?.addEventListener('click', () => batchReviewExport('none'));
  root.querySelector('#reviewInvertBtn')?.addEventListener('click', () => batchReviewExport('invert'));
  root.querySelector('#reviewApproveCleanBtn')?.addEventListener('click', approveVisibleClean);
  root.querySelector('#reviewRevokeVisibleBtn')?.addEventListener('click', revokeVisibleApproval);
  root.querySelector('#reviewApproveCurrentBtn')?.addEventListener('click', () => setCurrentReviewApproval(true));
  root.querySelector('#reviewRevokeCurrentBtn')?.addEventListener('click', () => setCurrentReviewApproval(false));
  root.querySelector('#reviewNextIssueBtn')?.addEventListener('click', navigateNextIssue);

  const reviewStage = root.querySelector('#reviewHeroStage');
  if (reviewStage) bindReviewViewport(reviewStage);
}

`;
