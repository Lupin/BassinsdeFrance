'use strict';

// Run before the datasets so loading and initialization failures stay visible.
(function () {
  var status = document.getElementById('mapStartup');
  var message = document.getElementById('mapStartupMessage');
  var details = document.getElementById('mapStartupDetails');
  var diagnostic = document.getElementById('mapStartupDiagnostic');
  var lightweight = new URLSearchParams(location.search).get('mode') === 'light';
  var timer;
  window.mapLightweight = lightweight;
  window.mapHasRendered = false;

  function show(text, detail) {
    message.textContent = text;
    diagnostic.textContent = detail || '';
    details.hidden = !detail;
    status.hidden = false;
  }

  window.mapStartupFailure = function (detail) {
    clearTimeout(timer);
    show('L’affichage de la carte a été interrompu. Essayez le mode léger ou rechargez la page.', detail);
  };
  window.mapStartupReady = function () {
    window.mapHasRendered = true;
    clearTimeout(timer);
    status.hidden = true;
  };
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target.tagName === 'SCRIPT' && !window.mapHasRendered) {
      window.mapStartupFailure('Fichier inaccessible : ' + (target.src || 'données intégrées'));
    } else if (!window.mapHasRendered && event.message) {
      window.mapStartupFailure(event.message + (event.filename ? ' · ' + event.filename.split('/').pop() + ':' + event.lineno : ''));
    }
  }, true);
  var link = document.getElementById('mapLightLink');
  var lightURL = new URL(location.href);
  lightURL.searchParams.set('mode', 'light');
  link.href = lightURL.href;
  document.getElementById('mapReload').addEventListener('click', function () { location.reload(); });
  timer = setTimeout(function () {
    if (!window.mapHasRendered) show('Le chargement de la carte prend du temps. Vous pouvez patienter ou essayer le mode léger.');
  }, 20000);

  // Array.at is absent in some older embedded Chromium versions.
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', {
    configurable: true, writable: true,
    value: function (index) {
      var offset = Math.trunc(Number(index)) || 0;
      return this[offset < 0 ? this.length + offset : offset];
    }
  });
})();
