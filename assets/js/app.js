var app = angular.module('app', ['ngRoute', 'ngTouch'], ['$routeProvider', function ($routeProvider) {
	$routeProvider.when('/', {
		controller: 'HomeCtrl',
		templateUrl: 'templates/home.html'
	})
	.when('/search', {
		controller: 'SearchCtrl',
		templateUrl: 'templates/search.html',
		resolve: {
			playlists: ['$pouchdb', function($pouchdb){
				return $pouchdb.getPlaylists();
			}]
		}
	})
	.when('/playlist', {
      	controller: 'PlaylistCtrl',
		templateUrl: 'templates/playlist.html'
    })
	.otherwise({ redirectTo: '/' });
}]);

app.run(['$rootScope', '$http', function($rootScope, $http){
	 var socket = io.connect('http://' + window.location.hostname + ':3000');
	  socket.on('playingTrack', function (track) {
			$rootScope.$apply(function(){
		    $rootScope.playingTrack = track;
			$rootScope.isPlaying = true;
			$http.get('/api/albumart?albumUri=' + track.albumUri).success(function(albumUri){
				$rootScope.playingAlbumArt = albumUri.uri;
			});
		});
	  });
}]);

app.controller('HomeCtrl', ['$scope','$http', '$pouchdb', function($scope, $http, $pouchdb){
	$scope.$root.pageTitle = 'Playlists';
	$scope.$on('changed',getPlaylists);

	$scope.new = function(){
		var playlist = prompt('Create new playlist');
		!!playlist && $pouchdb.addPlaylist(playlist);
	};

	getPlaylists();
	
	function getPlaylists(){
		$pouchdb.getPlaylists().then(function(playlists){
			$scope.playlists = playlists;
		});		
	};
}]);

app.controller('PlaylistCtrl', ['$scope', '$location', '$player', '$pouchdb', function($scope, $location, $player, $pouchdb){
	var id = $location.search().id;
	$scope.$on('changed',getTracks);

	getTracks();

	$scope.play = function(track, i){
		$player.play(track, $scope.tracks);
	};

	function getTracks(){
		$pouchdb.getTracks(id).then(function(tracks){ 
			$scope.tracks = tracks;
		});
	}
}]);

app.controller('SearchCtrl', ['$scope','$pouchdb', '$location', '$player', 'playlists', function($scope,$pouchdb, $location, $player, playlists){
	$scope.playlists = playlists;
	$scope.$root.pageTitle = 'Search:' + $location.search().term;

	$player.searchTracks($location.search().term).then(function(tracks){
		$scope.tracks = tracks;
	})

	$scope.play = function(track, i){
		$player.play(track);
	};

	$scope.addTo = function(playlistId, track){
		$pouchdb.addTrack(playlistId, track);
		$scope.playlistId = null;
	};
}]);

app.directive('header', ['$location', '$timeout', '$rootScope', function($location, $timeout, $rootScope){
	return{
		restrict: 'E',
		scope:true,
		link: function(scope, element){
			var input = element.find('input')[0];
			
			scope.goHome = function(){
				$location.path('/');
			}

			scope.goToSearch = function(){
				scope.showSearch = true;
			};

			scope.search = function(){
				if(!!!scope.term)return;
				$location.path('search').search('term', scope.term);
				scope.term = null;
				$timeout(function () { 
					input.blur();
				}, 0, false);
			};

			scope.blur = function(){
				scope.showSearch = false;
			};
		}
	};
}]);

app.directive('player', ['$player', '$rootScope', function($player, $rootScope){
	return {
		restrict: 'C',
		link: function(scope){
			scope.stop = function(){
				$player.stop();
			};

			scope.play = function(){
				if(!!!$rootScope.playingTrack) return;
				$player.play($rootScope.playingTrack);
			};
		}
	};
}]);

app.factory('$player', ['$rootScope', '$http', '$q', function($rootScope, $http, $q){
	return{
		play: play,
		stop: stop,
		searchTracks: searchTracks
	}

	var queue = [];

	function searchTracks(term){
		var wait = $q.defer(term);
		
		$http.get('api/search?term=' + term).success(function(tracks){
			wait.resolve(tracks);
		});

		return wait.promise;
	}

	function play(track, queueTracks){
		var model = { track: track, queue: queueTracks };
		$http.post('/api/play', model).success(function(m){
			$rootScope.playingTrack = track;
		});
		$http.get('/api/albumart?albumUri=' + track.albumUri).success(function(albumUri){
			$rootScope.playingAlbumArt = albumUri.uri;
		});
	}

	function stop(){
		$http.get('/api/stop').success(function(){
			$rootScope.isPlaying = false;
		});
	}
}]);

app.factory('$pouchdb', ['$rootScope', '$q', function($rootScope, $q){
	var db = new PouchDB('spotbox');
	var remoteCouch = 'http://spotbox.iriscouch.com/spotbox';

	db.info(function(err, info){
		db.changes({
			since: info.update_seq,
			continuous: true,
			onChange: onChange
		});
	});
	
	function onChange (change){
		$rootScope.$apply(function(){
			$rootScope.$broadcast('changed');
		});
	}

	function sync() {
		$rootScope.syncing = true;
		var opts = {continuous: true, complete: function(){
			$rootScope.syncing = false;
			console.log('error');	
		}};
		db.replicate.to(remoteCouch, opts);
		db.replicate.from(remoteCouch, opts);
	}

	function addPlaylist(playlistTitle){
		var wait = $q.defer();
		db.put({_id: s4(), title: playlistTitle, tracks: []}, function(err, res){
			$rootScope.$apply(function(){
				if(err)
					wait.reject(err);
				else
					wait.resolve(res);
			});		
		});
		return wait.promise;

		function s4() {
  			return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
		};
	}

	function addTrack(playlistId, track){
		var wait = $q.defer();
		db.get(playlistId, function(err, res){
			res.tracks.push(track);
			db.put(res, function(err, res){
				$rootScope.$apply(function(){
			 	if(err)
			 		wait.reject(err);
			 	else
			 		wait.resolve(res);
				});
			});
		});
		return wait.promise;	
	}

	function getPlaylists(){
		var wait = $q.defer();
		var map = function(doc){
			var trackscount = !!doc.tracks ? doc.tracks.length : 0;
			emit(null, {id: doc._id, title: doc.title, trackscount: trackscount});
		};

		db.query({map: map}, function(err, res){
			$rootScope.$apply(function() {
	        	if (err) 
	            	wait.reject(err);
	          	else 
	          		wait.resolve(res.rows);
	        });
		});

		return wait.promise;
	}

	function getTracks(playlistId){
		var wait = $q.defer();

		db.get(playlistId, function(err, res){
			$rootScope.$apply(function() {
	        	if (err) 
	            	wait.reject(err);
	          	else 
	          		wait.resolve(res.tracks);
	        });
		});

		return wait.promise;		
	}

	sync();

	return{
		addPlaylist: addPlaylist,
		addTrack: addTrack,
		getPlaylists: getPlaylists,
		getTracks: getTracks
	};
}]);