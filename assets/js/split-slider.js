function initSplitSlider() {
  const root = document.getElementById("split-slider");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".split-slide-image"));
  const dots = Array.from(root.querySelectorAll(".split-dot"));
  const titleEl = root.querySelector(".split-slider-title");
  const metaEl = root.querySelector(".split-slider-meta");
  const currentEl = root.querySelector(".split-slider-index .current");
  const totalEl = root.querySelector(".split-slider-index .total");

  let index = 0;
  let autoplayTimer = null;
  const AUTOPLAY_MS = 6500;

  totalEl.textContent = String(slides.length).padStart(2, "0");

  function show(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    const active = slides[index];

    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));

    titleEl.textContent = active.dataset.title;
    metaEl.textContent = active.dataset.meta;
    currentEl.textContent = String(index + 1).padStart(2, "0");
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => show(index + 1), AUTOPLAY_MS);
  }

  root.querySelector('[data-dir="prev"]').addEventListener("click", () => {
    show(index - 1);
    startAutoplay();
  });

  root.querySelector('[data-dir="next"]').addEventListener("click", () => {
    show(index + 1);
    startAutoplay();
  });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      show(i);
      startAutoplay();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      show(index + 1);
      startAutoplay();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      show(index - 1);
      startAutoplay();
    }
  });

  root.addEventListener("mouseenter", stopAutoplay);
  root.addEventListener("mouseleave", startAutoplay);

  show(0);
  startAutoplay();
}

document.addEventListener("DOMContentLoaded", initSplitSlider);
