---
---
$span = $(document.createElement 'span')

url = 'http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=flippyheads&api_key=b094d5020475474c4db04cd7686b4acb&format=json'
limit = 10

$.getJSON url, (data) ->
  {length} = data.recenttracks.track
  count = 0

  _.each data.recenttracks.track, (track, index) ->
    return if count >= limit
    count = count + 1

    comma = if length - 1 is index
      '.'
    else if length - 2 is index
      ' and '
    else
      ', '

    $span.append "<a href=\"#{track.url}\">#{track.name} by #{track.artist['#text']}</a>#{comma}"

  $('#spotify').append $span