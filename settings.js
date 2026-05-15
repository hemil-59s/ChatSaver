/**
 * ChatSaver settings.js
 * Simplified settings for offline mode.
 */

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('back-btn');
  const backToPopupBtn = document.getElementById('back-to-popup');

  const goBack = () => {
    window.location.href = 'popup.html';
  };

  backBtn.addEventListener('click', goBack);
  backToPopupBtn.addEventListener('click', goBack);
});
