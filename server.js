var express = require('express');
var http   = require('http');
var stack  = require('stack');
var routes = require('./routes');
var config = require('./config');

var app = express();
app.use(express.logger());
app.use(express.static(__dirname + '/assets'));
app.set('views', __dirname + '/');
app.engine('html', require('ejs').renderFile);

app.get('/', routes.main);
app.get('/api/search', routes.search);
app.get('/api/play', routes.play);
app.get('/api/stop', routes.stop);

app.listen(config.port);
console.log('Listening on port ' + config.port);