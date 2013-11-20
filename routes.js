var childProcess = require('child_process');
var spotify 	   = require('./spotify');
var player       = null;

module.exports = {
  main: main,
  search: search,
  stream: stream,
  play: play,
  stop: stop
};

function main (req, res){
	res.render('index.html');
}

function search(req, res){
	spotify.search(req.query.term, function(tracks){
		res.json(tracks);
	});
}

function play(req, res) {
  if (player) player.kill();
  player = childProcess.fork('./player');
  player.send(req.query.uri);
  res.writeHead(302, {'Location': '/'});
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

