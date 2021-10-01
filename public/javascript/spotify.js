(function() {
    var $span, limit, url;

    $span = $(document.createElement('span'));

    url = 'http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=flippyheads&api_key=b094d5020475474c4db04cd7686b4acb&format=json';

    limit = 10;

    $.getJSON(url, function(data) {
        var count, length;
        length = data.recenttracks.track.length;
        count = 0;
        _.each(data.recenttracks.track, function(track, index) {
            var comma;
            if (count >= limit) {
                return;
            }
            count = count + 1;
            comma = length - 1 === index ? '.' : length - 2 === index ? ' and ' : ', ';
            return $span.append("<a href=\"" + track.url + "\">" + track.name + " by " + track.artist['#text'] + "</a>" + comma);
        });
        return $('#spotify').append($span);
    });

}).call(this);