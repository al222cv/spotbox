var childProcess = require('child_process');
var spotify 	   = require('./spotify');
var player       = null;
var queue        = [];
var playTimeout, socket, playingTrack;

module.exports = function(io){
  if(!!io){
    io.sockets.on('connection', function(s){
      socket = s;
      !!playingTrack && socket.emit('playingTrack', playingTrack);
    });  
  }

  return {
    main: main,
    search: search,
    play: play,
    stop: stop,
    albumart: albumart,
    playlist: playlist, 
    playlists: playlists
  };  
}

function main (req, res){
  res.render('index.html');
}

function search(req, res){
	spotify.search(req.query.term, function(tracks){
    queue = tracks;
    res.json(tracks);
	});
}

function albumart(req, res){
  spotify.albumArt(req.query.albumUri, function(uri){
    res.json({uri: uri});
  });
}

function playlist(req, res){
  spotify.playlist(req.query.uri, function(playlist){
    queue = playlist;
    res.json(playlist);
  })
}

function playlists(req, res){
  spotify.playlists(function(playlists){
    res.json(playlists);
  })
}

function play(req, res) {
  !!playTimeout && clearTimeout(playTimeout);
  
  var track = req.body.track;
  queue = req.body.queue;

  startPlaying(track)
  res.end();  
}

function startPlaying(track){
  if (player) player.kill();
  player = childProcess.fork('./player');
  player.send(track.uri);
  playingTrack = track;
  socket.emit('playingTrack', playingTrack);

  if(queue.length > 0){
    playTimeout = setTimeout(function(){
      var nextTrack = queue[Math.floor(Math.random()*queue.length)];
      startPlaying(nextTrack);
    }, track.durationMs)
  }
}

function stop(req, res){
   if (player) player.kill();
   if(playTimeout) clearTimeout(playTimeout);
   res.end();
}