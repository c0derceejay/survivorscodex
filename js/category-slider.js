(() => {
  const slider = document.querySelector(".category-slider");
  if (!slider) return;

  const track = slider.querySelector(".category-slider__track");
  const slides = [...slider.querySelectorAll(".category-slide")];
  const dotsWrap = slider.querySelector(".category-slider__dots");
  const prevBtn = slider.querySelector('[data-slider="prev"]');
  const nextBtn = slider.querySelector('[data-slider="next"]');
  const status = slider.querySelector(".category-slider__status");

  if (!track || !slides.length || !dotsWrap) return;

  const INTERVAL = 5500;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = null;

  slides.forEach((slide, i) => {
    const label = slide.querySelector(".category-slide__eyebrow")?.textContent || `Slide ${i + 1}`;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "category-slider__dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", label);
    dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
    dot.addEventListener("click", () => goTo(i, true));
    dotsWrap.appendChild(dot);
  });

  const dots = [...dotsWrap.querySelectorAll(".category-slider__dot")];

  function announce(slide) {
    if (!status || !slide) return;
    const title = slide.querySelector("h3")?.textContent || "";
    const section = slide.querySelector(".category-slide__eyebrow")?.textContent || "";
    status.textContent = `${section}: ${title}`;
  }

  function goTo(nextIndex, fromUser = false) {
    index = ((nextIndex % slides.length) + slides.length) % slides.length;
    track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
      dot.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    announce(slides[index]);
    if (fromUser) resetTimer();
  }

  function next() {
    goTo(index + 1);
  }

  function resetTimer() {
    clearInterval(timer);
    if (!reducedMotion) timer = setInterval(next, INTERVAL);
  }

  prevBtn?.addEventListener("click", () => goTo(index - 1, true));
  nextBtn?.addEventListener("click", () => goTo(index + 1, true));

  slider.addEventListener("mouseenter", () => clearInterval(timer));
  slider.addEventListener("mouseleave", resetTimer);
  slider.addEventListener("focusin", () => clearInterval(timer));
  slider.addEventListener("focusout", (e) => {
    if (!slider.contains(e.relatedTarget)) resetTimer();
  });

  slides[0]?.classList.add("is-active");
  dots[0]?.classList.add("is-active");
  announce(slides[0]);
  resetTimer();
})();
