type Viewport = {
  width: number;
  height: number;
};

type LayoutSnapshot = {
  element: globalThis.HTMLElement;
  rect: globalThis.DOMRect;
  thresholds: string[];
};

const MOTION_SELECTOR = "[data-layout-motion][data-layout-motion-at]";
const ACTIVE_ATTRIBUTE = "data-layout-motion-active";
const MOTION_DURATION = 220;

const readViewport = (): Viewport => ({
  width: globalThis.innerWidth,
  height: globalThis.innerHeight
});

const thresholdMatches = (threshold: string, viewport: Viewport): boolean => {
  const [minimumWidth, minimumHeight] = threshold.split("x").map(Number);
  if (!Number.isFinite(minimumWidth)) return false;
  return (
    viewport.width >= minimumWidth &&
    (!Number.isFinite(minimumHeight) || viewport.height >= minimumHeight)
  );
};

const crossesThreshold = (thresholds: string[], previous: Viewport, current: Viewport): boolean =>
  thresholds.some(
    (threshold) => thresholdMatches(threshold, previous) !== thresholdMatches(threshold, current)
  );

const captureLayout = (root: globalThis.ParentNode): Map<string, LayoutSnapshot> => {
  const snapshots = new Map<string, LayoutSnapshot>();
  root.querySelectorAll<globalThis.HTMLElement>(MOTION_SELECTOR).forEach((element) => {
    const key = element.dataset.layoutMotion;
    const thresholds = element.dataset.layoutMotionAt?.split(/\s+/).filter(Boolean) ?? [];
    if (!key || !thresholds.length) return;
    snapshots.set(key, { element, rect: element.getBoundingClientRect(), thresholds });
  });
  return snapshots;
};

const hasMovingAncestor = (
  element: globalThis.HTMLElement,
  moving: Set<globalThis.HTMLElement>
): boolean => {
  let parent = element.parentElement;
  while (parent) {
    if (moving.has(parent)) return true;
    parent = parent.parentElement;
  }
  return false;
};

export function installResponsiveLayoutMotion(root: globalThis.ParentNode = document): () => void {
  let previousViewport = readViewport();
  let previousLayout = captureLayout(root);
  let refreshFrame: number | undefined;
  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");

  const refreshLayout = () => {
    if (refreshFrame !== undefined) globalThis.cancelAnimationFrame(refreshFrame);
    refreshFrame = globalThis.requestAnimationFrame(() => {
      previousLayout = captureLayout(root);
      previousViewport = readViewport();
      refreshFrame = undefined;
    });
  };

  const observer = new globalThis.MutationObserver(refreshLayout);
  observer.observe(root, { childList: true, subtree: true });

  const handleResize = () => {
    if (refreshFrame !== undefined) {
      globalThis.cancelAnimationFrame(refreshFrame);
      refreshFrame = undefined;
    }
    const currentViewport = readViewport();
    const currentLayout = captureLayout(root);
    if (!reducedMotion.matches) {
      const moving = new Set<globalThis.HTMLElement>();
      currentLayout.forEach((current, key) => {
        const previous = previousLayout.get(key);
        if (
          previous &&
          previous.rect.width > 0 &&
          previous.rect.height > 0 &&
          current.rect.width > 0 &&
          current.rect.height > 0 &&
          crossesThreshold(current.thresholds, previousViewport, currentViewport)
        ) {
          moving.add(current.element);
        }
      });

      currentLayout.forEach((current, key) => {
        const previous = previousLayout.get(key);
        if (
          !previous ||
          !moving.has(current.element) ||
          hasMovingAncestor(current.element, moving)
        ) {
          return;
        }
        const translateX = previous.rect.left - current.rect.left;
        const translateY = previous.rect.top - current.rect.top;
        if (Math.hypot(translateX, translateY) < 2 || !current.element.animate) return;

        current.element.setAttribute(ACTIVE_ATTRIBUTE, "");
        const animation = current.element.animate(
          [
            { opacity: 0.9, transform: `translate(${translateX}px, ${translateY}px)` },
            { opacity: 1, transform: "translate(0, 0)" }
          ],
          {
            duration: MOTION_DURATION,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
        );
        void animation.finished
          .catch(() => undefined)
          .finally(() => current.element.removeAttribute(ACTIVE_ATTRIBUTE));
      });
    }
    previousLayout = currentLayout;
    previousViewport = currentViewport;
  };

  globalThis.addEventListener("resize", handleResize, { passive: true });
  return () => {
    observer.disconnect();
    globalThis.removeEventListener("resize", handleResize);
    if (refreshFrame !== undefined) globalThis.cancelAnimationFrame(refreshFrame);
  };
}
