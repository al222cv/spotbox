var through = require('through');
var speaker = require('speaker')();
var decoder = require('lame').Decoder();

process.on('message', function(uri) {
 var track = through();
   stream({params:[uri]}, track);
   track
     .pipe(decoder)
     .pipe(speaker);
});


function stream(q, r) {
    var uri = q.params[0];
    require('./stream/spotify')(uri).pipe(r);
}