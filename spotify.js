var Spotify 	= require('spotify-web');
var config 		= require('./config');
var through    	= require('through');
var hyperquest 	= require('hyperquest');
var JSONStream 	= require('JSONStream');
var http		= require('http');

module.exports = {
	search: search,
	albumArt: albumArt,
	playlist: playlist,
	playlists: playlists
};

function parseTrack(track){
	var artist = track.artists.map(function(x) { return x.name; }).join(', ');
	var ms = parseInt(track.length, 10) * 1000;
	return {
		albumUri: track.album.href,
		uri: track.href,
		artist: artist,
		title: track.name,
		durationMs: ms,
	};
}

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
}

function albumArt(albumUri, callback){
	Spotify.login(config.spotify_user, config.spotify_password, function (err, spotify) {
		if (err) throw err;

		spotify.get(albumUri, function (err, album) {
			if (err) throw err;
		
			album.cover.forEach(function (image) {
				if(image.size == 'SMALL')
					callback(image.uri);
				//console.log('%s: %s', image.size, image.uri);
			});

	    	spotify.disconnect();
		});
	});
}

function playlist(uri, callback){
	Spotify.login(config.spotify_user, config.spotify_password, function (err, spotify) {
	  if (err) throw err;

	  var skip = 0;
	  var take = 9999; 

	  spotify.playlist(uri, skip, take, function (err, playlist) {
	    if (err) throw err;

	    var uri = 'http://ws.spotify.com/lookup/1/.json?uri=';
		var parsingKeys = ['track', true];
		var tracks = [];
  		var playlistItems = playlist.contents.items;
	    
	    spotify.disconnect();

		playlistItems.forEach(function(item){
	    	http.get(uri + item.uri, function(res) {
			   res.on('data', function (chunk) {
			   	var track = parseTrack(JSON.parse(chunk).track)
			    tracks.push(track);
			    end();
			  });
			});
	    });
		
		function end() {
			if(playlistItems.length == tracks.length)
				callback(tracks);
		}

	  });
	});
}

function playlists(callback){
	Spotify.login(config.spotify_user, config.spotify_password, function (err, spotify) {
	  if (err) throw err;

	  spotify.rootlist(function (err, rootlist) {
	    if (err) throw err;

	    callback(rootlist.contents.items);
	    spotify.disconnect();
	  });
	});
}