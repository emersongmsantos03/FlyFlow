// Envia ao FlyFlow o clique em qualquer elemento com data-track="nome-do-botao".
(function () {
  var endpoint = 'https://flyflow.herodronecwb.workers.dev/t/event'
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-track]') : null
    if (!target) return
    var body = JSON.stringify({ name: target.getAttribute('data-track'), path: location.pathname })
    if (navigator.sendBeacon) navigator.sendBeacon(endpoint, body)
    else fetch(endpoint, { method: 'POST', body: body, keepalive: true }).catch(function () {})
  }, true)
})()
