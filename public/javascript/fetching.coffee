---
---
$span = $(document.createElement 'span')

url = 'http://api.fetching.io/v1/documents?token=0ESGnuz6rC_lKM2OysG4QVXbKcjfdi02hDG9dhNviv-'
$.getJSON url, (bookmarks) ->
  {length} = bookmarks
  _.each bookmarks, (bookmark, index) ->
    comma = if length - 1 is index
      '.'
    else if length - 2 is index
      ' and '
    else
      ', '

    if bookmark.url and bookmark.title
      $span.append "<a href=\"#{bookmark.url}\">#{bookmark.title}</a>#{comma}"

  $('#fetching').append $span