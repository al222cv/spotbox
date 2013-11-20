var Spotify = require('spotify-web');
var config 	= require('./config');
var through    = require('through');
var hyperquest = require('hyperquest');
var JSONStream = require('JSONStream');

module.exports = {
	search: search
};

function search(term, callback){
	var uri = 'http://ws.spotify.com/search/1/track.json?q='  + term;
	var parsingKeys = ['tracks', true];
	var tracks = [];
  
	hyperquest(uri)
		.pipe(JSONStream.parse(parsingKeys))
		.pipe(through(function toTrack(track) {
			if (tracks.length < config.max_search_results) {
				track = parseTrack(track);
				if (track) tracks.push(track);
			}
		}, end)
	);
  
	function end() {
		callback(tracks);
	}

  	function parseTrack(track){
		var artist = track.artists.map(function(x) { return x.name; }).join(', ');
		var ms = parseInt(track.length, 10) * 1000;
		return {
			uri: track.href,
			artist: artist,
			title: track.name,
			durationMs: ms,
		};
	}
}

function play(uri){
	var stream = through();
	Spotify.login(config.spotify_user, config.spotify_password, function (err, spotify) {
		if (err) throw err;
		spotify.get(uri, function(err, track) {
	  		if (err) throw err;
			  	track
		    	.play()
				.pipe(stream)
				.on('finish', spotify.disconnect.bind(spotify));
		});
	});
	return stream;
}