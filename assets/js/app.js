/* global $, timeago */

$(function () {
  $(document).foundation()
  var timeagoInstance = new timeago()
  timeagoInstance.render($('.timeago'), 'fr')
})
