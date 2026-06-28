/**
 * 共用圖片燈箱（與 managementconsole 同款行為）
 * 需頁面含 #lightbox 結構；引入 style.css 的 #lightbox 樣式
 */
export function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox || lightbox.dataset.initialized === '1') return;

  const lightboxImg = lightbox.querySelector('.lb-img');
  const closeBtn = lightbox.querySelector('.lb-close');
  const wrap = lightbox.querySelector('.lb-wrap');
  if (!lightboxImg || !closeBtn || !wrap) return;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'lb-prev';
  prevBtn.setAttribute('aria-label', '上一張');
  prevBtn.innerHTML = '&#10094;';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'lb-next';
  nextBtn.setAttribute('aria-label', '下一張');
  nextBtn.innerHTML = '&#10095;';
  wrap.append(prevBtn, nextBtn);

  let currentImages = [];
  let currentIndex = 0;

  function showImage(index) {
    if (!currentImages.length) return;
    currentIndex = index;
    lightboxImg.src = currentImages[currentIndex];
    const showNav = currentImages.length > 1;
    prevBtn.style.display = showNav ? 'block' : 'none';
    nextBtn.style.display = showNav ? 'block' : 'none';
  }

  function openLightbox(urls, index) {
    currentImages = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!currentImages.length) return;
    showImage(Math.min(Math.max(0, index || 0), currentImages.length - 1));
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', handleKeydown);
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.src = '';
    currentImages = [];
    document.removeEventListener('keydown', handleKeydown);
  }

  function showPrev() {
    showImage((currentIndex - 1 + currentImages.length) % currentImages.length);
  }

  function showNext() {
    showImage((currentIndex + 1) % currentImages.length);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  }

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  window.__openLightbox__ = openLightbox;
  lightbox.dataset.initialized = '1';
}
