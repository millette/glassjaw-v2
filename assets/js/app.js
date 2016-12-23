/* global $, timeago */

/**
 * TODO
 * ----
 * * Replace next argument with xmlhttprequest detection
 * * Don't redirect on ajax post, but reply with proper template
 * * Remove /ajax/XX route
 */

$(function () {
  $(document).foundation()
  var timeagoInstance = new timeago() // eslint-disable-line new-cap

  var renderTime = function (cancel) {
    var $timeago = $('.timeago')
    var r
    if (cancel) { timeagoInstance.cancel() }
    // https://github.com/hustcc/timeago.js/issues/98
    // High CPU usage with jQuery 2.2.2
    if ($.fn.jquery < '2.2.4') {
      for (r = 0; r < $timeago.length; ++r) {
        // timeagoInstance.render($timeago[r], 'fr')
        // only use timer when time is less than 8h ago
        if (Date.now() - Date.parse($timeago[r].dateTime) < 28800000) {
          timeagoInstance.render($timeago[r], 'fr')
        } else {
          $timeago[r].innerHTML = timeagoInstance.format($timeago[r].dateTime, 'fr')
        }
      }
    } else {
      timeagoInstance.render($timeago, 'fr')
    }
  }

  if ($('.row.front').length) {
    renderTime()

    $('.row.front')
      .on('submit', '.column > form[method="post"]', function (ev) {
        var $this = $(this)
        var data = $this.serializeArray()
        var $punchButton = $('button[name="punch"]', $this)
        var punch
        var obj
        var $here = $this.parents('.column')
        ev.preventDefault()

        // make sure we've got the proper form
        if ($punchButton.length !== 1) { return window.console.error('missing punch id') }
        if (data.length > 1) { return window.console.error('wrong form size') }
        if (data[0] && data[0].name !== 'comment') { return window.console.error('missing comment') }
        if (data[0] && !data[0].value) { return window.console.error('missing comment value') }

        punch = $punchButton.val()
        // setup object with punch id and comment
        obj = { punch: punch, next: '/ajax' + '/' + punch }
        if (data[0]) { obj.comment = data[0].value }

        // replace with new punch
        $here
          .addClass('punched')
          .load('/', obj, function () {
            renderTime(true)
            $here.removeClass('punched')
          })
      })
  }
})
