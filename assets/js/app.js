/* global $, timeago */

$(function () {
  $(document).foundation()
  var Timeago = timeago
  var timeagoInstance = new Timeago()
  timeagoInstance.render($('.timeago'), 'fr')
})
