'use strict';

(function initMapFullscreen() {
  const section = document.querySelector('.map-section');
  const button = document.getElementById('mapFullscreen');
  const status = document.getElementById('fullscreenStatus');
  const background = [];
  let expanded = false;
  let requesting = false;
  let previousActive = false;

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  function refresh() {
    const active = fullscreenElement() === section || expanded;
    button.textContent = active ? 'Quitter le plein écran' : 'Plein écran';
    button.setAttribute('aria-pressed', String(active));
    status.textContent = active ? 'Carte en plein écran. Utilisez le bouton ou Échap pour revenir.' : '';
    resize();
    invalidate();
    if (active !== previousActive) button.focus();
    previousActive = active;
  }

  function expandInWindow() {
    expanded = true;
    section.classList.add('map-expanded');
    document.body.classList.add('map-expanded-open');
    // The export dialog stays available as a top-layer modal.
    const others = [...section.parentElement.children].filter(item => item !== section);
    others.push(...document.querySelectorAll('body > header, body > footer, body > .skip'));
    for (const element of others) {
      background.push({element, inert:element.inert});
      element.inert = true;
    }
    refresh();
  }

  function leaveWindow() {
    expanded = false;
    section.classList.remove('map-expanded');
    document.body.classList.remove('map-expanded-open');
    for (const {element,inert} of background) element.inert = inert;
    background.length = 0;
    refresh();
  }

  button.addEventListener('click', async () => {
    if (requesting) return;
    if (expanded) { leaveWindow(); return; }
    const active = fullscreenElement() === section;
    const action = active
      ? (document.exitFullscreen || document.webkitExitFullscreen)
      : (section.requestFullscreen || section.webkitRequestFullscreen);
    if (!action) { expandInWindow(); return; }
    requesting = true;
    try {
      await action.call(active ? document : section);
      refresh();
    } catch {
      if (!active && !fullscreenElement()) expandInWindow();
      else status.textContent = 'Utilisez la commande de sortie du plein écran de votre navigateur.';
    } finally {
      requesting = false;
    }
  });

  document.addEventListener('fullscreenchange', refresh);
  document.addEventListener('webkitfullscreenchange', refresh);
  document.addEventListener('keydown', event => {
    if (!expanded || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      leaveWindow();
    }
    if (event.key === 'Tab') {
      const controls = [...section.querySelectorAll('button, a[href], input, select, [tabindex="0"]')]
        .filter(element => !element.disabled && element.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        controls[controls.length-1]?.focus();
      } else if (!event.shiftKey && (index < 0 || index === controls.length-1)) {
        event.preventDefault();
        controls[0]?.focus();
      }
    }
  });
})();
