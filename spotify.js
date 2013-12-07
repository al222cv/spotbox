var Spotify 	= require('spotify-web');
var config 		= require('./config');
var through    	= require('through');
var hyperquest 	= require('hyperquest');
var JSONStream 	= require('JSONStream');
var xml2js 		= require('xml2js');
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
	    	spotify.disconnect();
			album.cover.forEach(function (image) {
				if(image.size == 'SMALL')
					callback(image.uri);
			});
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

		var tracks = [];
  		var playlistItems = playlist.contents.items;
	    
	    var i = 0;
		playlistItems.forEach(function(item){
			spotify.get(item.uri, function(err, track){
				if(!!!track) {
					playlistItems.splice(i, 1);
					end();
				}
				else{
					var trackModel = {
						artist: track.artist.map(function(x) { return x.name; }).join(', '),
						title: track.name,
						uri: item.uri,
						durationMs: track.duration,
						albumUri: item.uri
					}
					tracks.push(trackModel);
					end();
					i++;	
				}
			});
	    });
		
		function end() {
			if(playlistItems.length == tracks.length){
				spotify.disconnect();
				callback(tracks);
			}
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