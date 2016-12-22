/* global $, timeago */

$(function () {
  $(document).foundation()
  var Timeago = timeago
  var timeagoInstance = new Timeago()
  timeagoInstance.render($('.timeago'), 'fr')

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
          timeagoInstance.render($('.timeago', $(this)), 'fr')
          $here.removeClass('punched')
        })
    })
})
