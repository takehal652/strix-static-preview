(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function markMaterialSymbolsReady() {
    const ready = () =>
      document.body?.setAttribute("data-material-symbols-loaded", "true");
    if (!document.fonts) {
      window.setTimeout(ready, 1000);
      return;
    }
    Promise.race([
      document.fonts.ready,
      new Promise((resolve) => window.setTimeout(resolve, 1000)),
    ]).then(ready);
  }

  function imageCandidate(image) {
    const source = image.dataset.sdImgSrc;
    const filename = source?.split("/").pop() ?? "";
    const dimensions = filename.match(/(?:^|_)s-(\d+)x(\d+)(?:_|\.|$)/);
    const variants = filename.match(/(?:^|_)v-([a-z]+)(?:_|\.|$)/)?.[1] ?? "";
    if (!source || !dimensions || !variants) return source;

    const [, widthText, heightText] = dimensions;
    const sourceWidth = Number(widthText);
    const sourceHeight = Number(heightText);
    const neededWidth =
      Math.max(image.getBoundingClientRect().width, image.clientWidth) *
      window.devicePixelRatio;
    const candidates = [
      ["s", 600, "_small"],
      ["m", 1200, "_middle"],
      ["r", 1800, "_regular"],
    ];
    const selected = candidates.find(([flag, size]) => {
      if (!variants.includes(flag)) return false;
      const availableWidth =
        sourceWidth < sourceHeight
          ? Math.ceil((size / sourceHeight) * sourceWidth)
          : size;
      return availableWidth >= neededWidth;
    });
    if (!selected) return source;

    const extension = /(?:^|_)webp(?:_|\.|$)/i.test(filename) ? "webp" : null;
    return source.replace(
      /(_small|_middle|_regular)?\.(jpg|jpeg|png|gif|svg|webp)([?#].*)?$/i,
      (_, _oldVariant, originalExtension, suffix = "") =>
        `${selected[2]}.${extension ?? originalExtension}${suffix}`,
    );
  }

  function loadImage(image) {
    const candidate = imageCandidate(image);
    if (candidate) image.src = candidate;
  }

  function initImages(root = document) {
    const images = [...root.querySelectorAll("img[data-sd-img-src]")];
    if (!("IntersectionObserver" in window)) {
      images.forEach(loadImage);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "100% 0px" },
    );
    images.forEach((image) => observer.observe(image));
  }

  function initAppear(root = document) {
    const elements = [...root.querySelectorAll("[data-appear]")].filter(
      (element) => !element.closest("[data-appear-manual]"),
    );
    const reveal = (element) => element.classList.remove(
      [...element.classList].find((name) => name.includes("__appear-")) ?? "",
    );
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target);
        observer.unobserve(entry.target);
      }
    });
    for (const element of elements) {
      element.setAttribute("data-inited-appear", "");
      observer.observe(element);
    }
  }

  function setToggleOpen(toggle, open) {
    const trigger = toggle.querySelector(":scope > [data-toggle-trigger]");
    const content = toggle.querySelector(":scope > [data-toggle-content]");
    toggle.toggleAttribute("open", open);
    trigger?.setAttribute("aria-expanded", String(open));
    if (content) {
      content.setAttribute("aria-hidden", String(!open));
      content.inert = !open;
    }
  }

  function initToggles(root = document) {
    for (const toggle of root.querySelectorAll("sd-toggle")) {
      if (toggle.dataset.strixToggleReady === "true") continue;
      toggle.dataset.strixToggleReady = "true";
      setToggleOpen(toggle, toggle.hasAttribute("open"));
      const trigger = toggle.querySelector(":scope > [data-toggle-trigger]");
      trigger?.addEventListener("click", () =>
        setToggleOpen(toggle, !toggle.hasAttribute("open")),
      );
      if (toggle.hasAttribute("hover")) {
        toggle.addEventListener("mouseenter", () => setToggleOpen(toggle, true));
        toggle.addEventListener("mouseleave", () => setToggleOpen(toggle, false));
      }
    }
  }

  function closeDialog(dialog) {
    if (dialog?.open) dialog.close();
  }

  function initModals() {
    let returnFocus = null;
    document.addEventListener("click", (event) => {
      const openTrigger = event.target.closest("[data-modal]");
      if (openTrigger) {
        const dialog = document.getElementById(openTrigger.dataset.modal);
        if (dialog instanceof HTMLDialogElement) {
          returnFocus = openTrigger;
          dialog.showModal();
          initToggles(dialog);
        }
        return;
      }
      const closeTrigger = event.target.closest('[data-action="modal-close"]');
      if (closeTrigger) {
        closeDialog(closeTrigger.closest("dialog"));
        returnFocus?.focus();
        returnFocus = null;
        return;
      }
      const backdrop = event.target.closest("dialog > *:first-child");
      if (backdrop) closeDialog(backdrop.closest("dialog"));
    });
    for (const dialog of document.querySelectorAll("dialog")) {
      dialog.addEventListener("close", () => {
        returnFocus?.focus();
        returnFocus = null;
      });
    }
  }

  function initCarousel(carousel) {
    if (carousel.dataset.initedCarousel === "") return;
    const template = carousel.querySelector(":scope > template");
    const controls =
      carousel.querySelector(":scope > :not(template) [slot='prev']")?.parentElement;
    if (!template || !controls) return;

    const sourceSlides = [...template.content.children];
    const maximum = Number(carousel.dataset.maxLength) || sourceSlides.length;
    const slides = sourceSlides.slice(0, maximum).map((slide) => slide.cloneNode(true));
    if (!slides.length) return;

    let activeIndex = 0;
    let timer = null;
    const duration = Number(carousel.dataset.animateDuration) || 0;
    const interval = Number(carousel.dataset.intervalDuration) || 4000;
    carousel.style.setProperty("--_durationms", `${duration}ms`);
    carousel.setAttribute("aria-live", "polite");
    carousel.setAttribute("data-inited-carousel", "");

    const render = () => {
      carousel.querySelectorAll(":scope > [data-strix-carousel-slide]").forEach(
        (slide) => slide.remove(),
      );
      const ordered = slides.map(
        (_, offset) => slides[(activeIndex + offset - 3 + slides.length) % slides.length],
      );
      for (const slide of ordered) {
        slide.setAttribute("data-strix-carousel-slide", "");
        carousel.insertBefore(slide, controls);
      }
    };
    const move = (amount) => {
      activeIndex = (activeIndex + amount + slides.length) % slides.length;
      render();
      initImages(carousel);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      carousel.removeAttribute("is-playing");
      controls.querySelector("[slot='play-toggle']")?.setAttribute(
        "aria-label",
        controls.querySelector("[slot='play-toggle']")?.dataset.pausedLabel ??
          "Play automatic slide show",
      );
    };
    const play = () => {
      if (reducedMotion.matches || timer !== null) return;
      timer = window.setInterval(() => move(1), interval);
      carousel.setAttribute("is-playing", "");
      controls.querySelector("[slot='play-toggle']")?.setAttribute(
        "aria-label",
        controls.querySelector("[slot='play-toggle']")?.dataset.playingLabel ??
          "Stop automatic slide show",
      );
    };

    controls.querySelector("[slot='prev']")?.addEventListener("click", () => move(-1));
    controls.querySelector("[slot='next']")?.addEventListener("click", () => move(1));
    controls.querySelector("[slot='play-toggle']")?.addEventListener("click", () => {
      if (timer === null) play();
      else stop();
    });
    if (carousel.hasAttribute("data-hover-stop")) {
      carousel.addEventListener("mouseenter", () => timer !== null && stop());
    }
    reducedMotion.addEventListener("change", (event) => {
      if (event.matches) stop();
    });
    render();
  }

  function initLoopBox(loopBox) {
    if (loopBox.querySelector(":scope > .loop-track")) return;
    const originals = [...loopBox.children];
    if (!originals.length) return;

    const sizer = document.createElement("div");
    sizer.className = "loop-sizer";
    sizer.style.cssText =
      `display:flex;flex-direction:row;min-width:${loopBox.clientWidth}px;` +
      "visibility:hidden;column-gap:var(--gap-h, 0px);row-gap:var(--gap-v, 0px);" +
      "justify-content:flex-start;align-items:center";
    for (const original of originals) {
      const clone = original.cloneNode(true);
      clone.querySelectorAll("[data-sd-img-src]").forEach((image) => {
        image.removeAttribute("data-sd-img-src");
      });
      clone.setAttribute("data-base-item", "true");
      sizer.append(clone);
    }

    const track = document.createElement("div");
    track.className = "loop-track";
    track.style.cssText =
      "position:absolute;left:0;height:100%;display:flex;flex-direction:row;" +
      "min-width:100%;transition:none;column-gap:var(--gap-h, 0px);" +
      "row-gap:var(--gap-v, 0px);justify-content:flex-start;align-items:center;" +
      "transform:translateX(0px)";
    for (const original of originals) {
      original.setAttribute("data-base-item", "true");
      original.style.maxWidth = "unset";
      track.append(original);
    }

    loopBox.replaceChildren(sizer, track);
    requestAnimationFrame(() => {
      const style = getComputedStyle(track);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const cycleWidth =
        [...track.children].reduce(
          (total, item) => total + item.getBoundingClientRect().width,
          0,
        ) +
        gap * Math.max(0, originals.length - 1);
      track.style.width = `${cycleWidth}px`;

      const cloneContainer = document.createElement("div");
      cloneContainer.className = "loop-clone";
      cloneContainer.setAttribute("aria-hidden", "true");
      cloneContainer.style.cssText =
        `position:absolute;left:${cycleWidth + gap}px;height:100%;display:flex;` +
        "flex-direction:row;min-width:100%;transition:none;" +
        "column-gap:var(--gap-h, 0px);row-gap:var(--gap-v, 0px);" +
        "justify-content:flex-start;align-items:center";
      originals.forEach((item) => cloneContainer.append(item.cloneNode(true)));
      track.append(cloneContainer);

      const speed = Math.max(1, Number(loopBox.getAttribute("speed")) || 100);
      let animation = null;
      let hoverPaused = false;
      const animateNext = () => {
        const firstItem = track.querySelector(":scope > [data-base-item]");
        if (!firstItem) return;
        const distance = firstItem.getBoundingClientRect().width + gap;
        animation = track.animate(
          [
            { transform: "translateX(0px)" },
            { transform: `translateX(-${distance}px)` },
          ],
          {
            duration: (distance / speed) * 1000,
            fill: "forwards",
            easing: "linear",
          },
        );
        animation.onfinish = () => {
          track.insertBefore(firstItem, cloneContainer);
          animation.cancel();
          track.style.transform = "translateX(0px)";
          animateNext();
        };
        if (reducedMotion.matches || hoverPaused) animation.pause();
      };
      animateNext();
      loopBox.addEventListener("mouseenter", () => {
        hoverPaused = true;
        animation?.pause();
      });
      loopBox.addEventListener("mouseleave", () => {
        hoverPaused = false;
        if (!reducedMotion.matches) animation?.play();
      });
      reducedMotion.addEventListener("change", (event) => {
        if (event.matches) animation?.pause();
        else if (!hoverPaused) animation?.play();
      });
      loopBox
        .querySelectorAll(".loop-track img[data-sd-img-src]")
        .forEach(loadImage);
    });
  }

  function init() {
    markMaterialSymbolsReady();
    document.querySelectorAll("sd-loop-box").forEach(initLoopBox);
    document.querySelectorAll("sd-carousel[data-type='carousel']").forEach(initCarousel);
    initImages();
    initAppear();
    initToggles();
    initModals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
