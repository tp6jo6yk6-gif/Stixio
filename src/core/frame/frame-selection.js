import { cloneFrame } from './frame.js';

export function selectFrame(frames, frameId, { multi = false } = {}) {
  return frames.map(frame => cloneFrame(frame, {
    state: {
      ...frame.state,
      selected: multi ? (frame.id === frameId ? !frame.state?.selected : frame.state?.selected) : frame.id === frameId
    }
  }));
}

export function clearFrameSelection(frames) {
  return frames.map(frame => cloneFrame(frame, {
    state: {
      ...frame.state,
      selected: false
    }
  }));
}

export function getSelectedFrames(frames) {
  return frames.filter(frame => frame.state?.selected);
}

export function getPrimarySelectedFrame(frames) {
  return getSelectedFrames(frames)[0] || null;
}

export function selectNextFrame(frames, currentId) {
  if (!frames.length) return frames;
  const currentIndex = Math.max(0, frames.findIndex(frame => frame.id === currentId));
  const next = frames[(currentIndex + 1) % frames.length];
  return selectFrame(frames, next.id);
}

export function selectPreviousFrame(frames, currentId) {
  if (!frames.length) return frames;
  const currentIndex = Math.max(0, frames.findIndex(frame => frame.id === currentId));
  const next = frames[(currentIndex - 1 + frames.length) % frames.length];
  return selectFrame(frames, next.id);
}
