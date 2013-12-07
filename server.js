var express     = require('express');
var http        = require('http');
var config      = require('./config');
var socketio     = require('socket.io')  

var app = express();
var server = http.createServer(app);
var io = socketio.listen(server);
server.listen(config.port);
console.log('Listening on port ' + config.port);

var routes = require('./routes')(io);

app.use(express.logger());
app.use(express.static(__dirname + '/assets'));
app.use(express.bodyParser());
app.set('views', __dirname + '/');
app.engine('html', require('ejs').renderFile);

app.get('/', routes.main);
app.get('/api/search', routes.search);
app.get('/api/albumart', routes.albumart);
app.get('/api/playlists', routes.playlists);
app.get('/api/playlist', routes.playlist);
app.get('/api/albumart', routes.albumart);
app.post('/api/play', routes.play);
app.get('/api/stop', routes.stop);