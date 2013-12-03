var childProcess = require('child_process');
var spotify 	   = require('./spotify');
var player       = null;

module.exports = {
  main: main,
  search: search,
  stream: stream,
  play: play,
  stop: stop,
  albumart: albumart,
  playlist: playlist, 
  playlists: playlists
};

function main (req, res){
	res.render('index.html');
}

function search(req, res){
	spotify.search(req.query.term, function(tracks){
		res.json(tracks);
	});
}

function albumart(req, res){
  spotify.albumArt(req.query.albumUri, function(uri){
    res.json({uri: uri});
  });
}

function playlist(req, res){
  console.log(req.query.uri);
  spotify.playlist(req.query.uri, function(playlist){
    res.json(playlist);
  })
}

function playlists(req, res){
  spotify.playlists(function(playlists){
    res.json(playlists);
  })
}

function play(req, res) {
  if (player) player.kill();
  player = childProcess.fork('./player');
  player.send(req.query.uri);
  res.end();
}

function stop(req, res){
   if (player) player.kill();
   res.end();
}

function stream(q, r) {
    var uri = q.params[0];
    require('./stream/spotify')(uri).pipe(r);
}


