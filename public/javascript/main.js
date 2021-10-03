(function() {
    $(document).ready(() => {
        $('#image-static').mouseenter(() => {
            $('#image-static').addClass('hidden');
            $('#image-animated').removeClass('hidden');
        });

        $('#image-animated').mouseleave(() => {
            $('#image-animated').addClass('hidden');
            $('#image-static').removeClass('hidden');
        });
    });
}).call(this);