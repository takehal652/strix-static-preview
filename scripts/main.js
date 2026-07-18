const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const carouselStates = new WeakMap();
const logoLoopStates = new WeakMap();

function controlledElement(trigger) {
  const id = trigger.getAttribute("aria-controls");
  return id ? document.getElementById(id) : null;
}

function setToggle(trigger, open, moveFocus = false) {
  const panel = controlledElement(trigger);
  if (!panel) return;

  trigger.setAttribute("aria-expanded", String(open));
  panel.dataset.state = open ? "open" : "closed";
  panel.hidden = !open;
  panel.inert = !open;

  if (open && moveFocus) {
    panel.querySelector("a, button")?.focus();
  } else if (!open && panel.contains(document.activeElement)) {
    trigger.focus();
  }
}

for (const trigger of document.querySelectorAll('[data-action="toggle-features"]')) {
  setToggle(trigger, false);
  trigger.addEventListener("click", () => {
    setToggle(trigger, trigger.getAttribute("aria-expanded") !== "true");
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setToggle(trigger, true, true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setToggle(trigger, false);
    }
  });

  controlledElement(trigger)?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setToggle(trigger, false);
    }
  });
}

for (const trigger of document.querySelectorAll('[data-action="toggle-features"]')) {
  const panel = controlledElement(trigger);
  if (!panel) continue;
  let closeTimer = 0;
  let openedByHover = false;
  const cancelClose = () => window.clearTimeout(closeTimer);
  const scheduleClose = () => {
    closeTimer = window.setTimeout(() => setToggle(trigger, false), 80);
  };

  trigger.addEventListener("pointerenter", () => {
    cancelClose();
    openedByHover = true;
    setToggle(trigger, true);
  });
  trigger.addEventListener("pointerleave", () => {
    openedByHover = false;
    scheduleClose();
  });
  panel.addEventListener("pointerenter", cancelClose);
  panel.addEventListener("pointerleave", () => {
    scheduleClose();
  });
  trigger.addEventListener("click", () => {
    if (!openedByHover) return;
    openedByHover = false;
    setToggle(trigger, true);
  });
}

const menu = document.querySelector('[data-component="mobile-menu"]');
const menuOpeners = document.querySelectorAll('[data-action="open-menu"]');
let menuOpener = null;

function closeMenu() {
  if (menu?.open) menu.close();
}

for (const trigger of menuOpeners) {
  trigger.addEventListener("click", () => {
    if (!menu || menu.open) return;
    menuOpener = trigger;
    trigger.setAttribute("aria-expanded", "true");
    menu.dataset.state = "open";
    menu.showModal();
    queueMicrotask(() => menu.querySelector('[data-action="close-menu"]')?.focus());
  });
}

menu?.querySelector('[data-action="close-menu"]')?.addEventListener("click", closeMenu);
menu?.addEventListener("click", (event) => {
  if (event.target === menu) closeMenu();
});
menu?.addEventListener("close", () => {
  menu.dataset.state = "closed";
  menuOpener?.setAttribute("aria-expanded", "false");
  menuOpener?.focus();
  menuOpener = null;
});

function carouselTranslation(list) {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(list).transform);
  return matrix.m41;
}

function updateCarouselState(carousel, index, announce) {
  const state = carouselStates.get(carousel);
  if (!state) return;

  state.index = (index + state.slides.length) % state.slides.length;
  state.slides.forEach((slide, slideIndex) => {
    const current = slideIndex === state.index;
    slide.dataset.state = current ? "current" : "inactive";
    slide.toggleAttribute("aria-current", current);
    slide.setAttribute("aria-hidden", String(!current));
  });
  state.status.textContent = announce ? `スライド ${state.index + 1} / ${state.slides.length}` : "";
}

function moveCarousel(carousel, index, announce = true) {
  const state = carouselStates.get(carousel);
  if (!state) return;

  const nextIndex = (index + state.slides.length) % state.slides.length;
  const currentTranslation = carouselTranslation(state.list);
  const targetTranslation = state.baseTranslation - state.slideWidth * nextIndex;
  state.animation?.cancel();

  if (reducedMotion.matches) {
    state.list.style.transform = `translateX(${targetTranslation}px)`;
  } else {
    state.animation = state.list.animate(
      [
        { transform: `translateX(${currentTranslation}px)` },
        { transform: `translateX(${targetTranslation}px)` },
      ],
      { duration: 350, easing: "ease-out" },
    );
    state.animation.addEventListener(
      "finish",
      () => {
        state.list.style.transform = `translateX(${targetTranslation}px)`;
        state.animation.cancel();
        state.animation = null;
      },
      { once: true },
    );
  }
  updateCarouselState(carousel, nextIndex, announce);
}

function setCarouselPlaying(carousel, playing) {
  const state = carouselStates.get(carousel);
  if (!state) return;

  const shouldPlay = playing && !reducedMotion.matches;
  window.clearInterval(state.timer);
  state.timer = shouldPlay
    ? window.setInterval(() => moveCarousel(carousel, state.index + 1, false), 5_000)
    : 0;
  carousel.dataset.state = shouldPlay ? "playing" : "paused";
  state.playButton.setAttribute("aria-pressed", String(shouldPlay));
  state.playButton.setAttribute("aria-label", shouldPlay ? "自動再生を一時停止" : "自動再生を開始");
  state.playingIcon.hidden = !shouldPlay;
  state.pausedIcon.hidden = shouldPlay;
}

function initializeCarousel(carousel) {
  const list = carousel.querySelector("ul");
  const slides = list ? [...list.children].filter((child) => child.matches("li")) : [];
  const playButton = carousel.querySelector('[data-action="toggle-autoplay"]');
  const playingIcon = playButton?.querySelector('[data-state="playing"]');
  const pausedIcon = playButton?.querySelector('[data-state="paused"]');
  const status = carousel.querySelector('[data-component="carousel-status"]');
  if (!list || !slides.length || !playButton || !playingIcon || !pausedIcon || !status) return;

  carouselStates.set(carousel, {
    animation: null,
    baseTranslation: carouselTranslation(list),
    index: 0,
    list,
    pausedIcon,
    playButton,
    playingIcon,
    slideWidth: slides[0].getBoundingClientRect().width,
    slides,
    status,
    timer: 0,
  });
  updateCarouselState(carousel, 0, false);
  setCarouselPlaying(carousel, true);

  carousel.querySelector('[data-action="previous-slide"]')?.addEventListener("click", () => {
    const state = carouselStates.get(carousel);
    moveCarousel(carousel, state.index - 1);
  });
  carousel.querySelector('[data-action="next-slide"]')?.addEventListener("click", () => {
    const state = carouselStates.get(carousel);
    moveCarousel(carousel, state.index + 1);
  });
  playButton.addEventListener("click", () => {
    setCarouselPlaying(carousel, carousel.dataset.state !== "playing");
  });
  carousel.addEventListener("keydown", (event) => {
    const state = carouselStates.get(carousel);
    if (event.key === "ArrowLeft") moveCarousel(carousel, state.index - 1);
    else if (event.key === "ArrowRight") moveCarousel(carousel, state.index + 1);
    else if (event.key === "Home") moveCarousel(carousel, 0);
    else if (event.key === "End") moveCarousel(carousel, state.slides.length - 1);
    else if (event.key === " " && event.target === carousel) {
      setCarouselPlaying(carousel, carousel.dataset.state !== "playing");
    } else return;
    event.preventDefault();
  });
}

for (const carousel of document.querySelectorAll('[data-component="carousel"]')) {
  initializeCarousel(carousel);
  carousel.dataset.visualState = "pending";
  const visualObserver = new IntersectionObserver(
    ([entry], observer) => {
      if (!entry?.isIntersecting) return;
      carousel.dataset.visualState = "loaded";
      observer.disconnect();
    },
    { rootMargin: "0px" },
  );
  visualObserver.observe(carousel);
}

function removeCloneIds(element) {
  element.removeAttribute("id");
  for (const descendant of element.querySelectorAll("[id]")) descendant.removeAttribute("id");
}

function initializeLogoLoop(loop) {
  const track = loop.querySelector("ul");
  if (!track) return;
  const originals = [...track.children].filter((child) => child.matches("li"));
  if (!originals.length) return;

  const previous = logoLoopStates.get(loop);
  previous?.animation?.cancel();
  for (const clone of previous?.clones ?? []) clone.remove();

  const widths = originals.map((item) => item.getBoundingClientRect().width);
  const originalWidth = track.scrollWidth;
  const clones = [];
  let cloneIndex = 0;
  while (track.scrollWidth < originalWidth + loop.clientWidth) {
    const sourceIndex = cloneIndex % originals.length;
    const clone = originals[sourceIndex].cloneNode(true);
    removeCloneIds(clone);
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    clone.style.width = `${widths[sourceIndex]}px`;
    track.append(clone);
    clones.push(clone);
    cloneIndex += 1;
  }

  const start = carouselTranslation(track);
  const animation = reducedMotion.matches
    ? null
    : track.animate(
        [
          { transform: `translateX(${start}px)` },
          { transform: `translateX(${start - originalWidth}px)` },
        ],
        { duration: Math.max(originalWidth * 18, 20_000), iterations: Infinity, easing: "linear" },
      );
  loop.dataset.state = animation ? "running" : "paused";
  logoLoopStates.set(loop, { animation, clones });
}

for (const loop of document.querySelectorAll('[data-component="logo-loop"]')) {
  initializeLogoLoop(loop);
  new ResizeObserver(() => initializeLogoLoop(loop)).observe(loop);
}

let revealObserver = null;
function initializeReveals() {
  revealObserver?.disconnect();
  const reveals = [...document.querySelectorAll("[data-reveal]")];
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    for (const reveal of reveals) reveal.dataset.state = "visible";
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.state = "visible";
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
  );
  for (const reveal of reveals) revealObserver.observe(reveal);
}

function handleMotionPreference() {
  for (const carousel of document.querySelectorAll('[data-component="carousel"]')) {
    setCarouselPlaying(carousel, !reducedMotion.matches);
  }
  for (const loop of document.querySelectorAll('[data-component="logo-loop"]')) {
    initializeLogoLoop(loop);
  }
  initializeReveals();
}

reducedMotion.addEventListener("change", handleMotionPreference);
initializeReveals();
