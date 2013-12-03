var app = angular.module('app', ['ngRoute', 'ngTouch'], ['$routeProvider', function ($routeProvider) {
	$routeProvider.when('/', {
		controller: 'HomeCtrl',
		templateUrl: 'templates/home.html'
	})
	.when('/search', {
		controller: 'SearchCtrl',
		templateUrl: 'templates/search.html'
	})
	.when('/playlist', {
      	controller: 'PlaylistCtrl',
		templateUrl: 'templates/playlist.html'
    })
	.otherwise({ redirectTo: '/' });
}]);

app.controller('HomeCtrl', ['$scope','$http', '$pouchdb', function($scope, $http, $pouchdb){
	$scope.$root.pageTitle = 'Playlists';
	$scope.$on('changed',getPlaylists);

	getPlaylists();
	updatePlaylists();

	function updatePlaylists(){
		$http.get('/api/playlists').success(function(playlists){
			angular.forEach(playlists, function(playlist){
				$pouchdb.addPlaylist(playlist);
			});
			
		});	
	}

	function getPlaylists(){
		$pouchdb.getPlaylists().then(function(playlists){
			$scope.playlists = playlists;
		});		
	}
}]);

app.controller('PlaylistCtrl', ['$scope', '$location', '$player', function($scope, $location, $player){
	var id = $location.search().id;
	$scope.$on('changed',getTracks);

	getTracks();
	$player.updateTracks(id);

	$scope.play = function(track, i){
		$player.play(track);
		$player.setQueueTracks($scope.tracks);
		$scope.currTrack = i;
	};

	function getTracks(){
		$player.getTracks(id).then(function(tracks){ $scope.tracks = tracks;});
	}
}]);

app.controller('SearchCtrl', ['$scope','$http', '$location', '$player', function($scope,$http, $location, $player){
	$scope.$root.pageTitle = 'Search:' + $location.search().term;

	$player.searchTracks($location.search().term).then(function(tracks){
		$scope.tracks = tracks;
	})

	$scope.play = function(track, i){
		$player.play(track);
		$player.setQueueTracks($scope.tracks);
		$scope.currTrack = i;
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

app.factory('$player', ['$rootScope', '$http', '$q', '$pouchdb', '$timeout', function($rootScope, $http, $q, $pouchdb, $timeout){
	return{
		play: play,
		stop: stop,
		searchTracks: searchTracks,
		getTracks: getTracks,
		updateTracks: updateTracks,
		setQueueTracks: setQueueTracks
	}

	var queue = [];

	function searchTracks(term){
		var wait = $q.defer(term);
		
		$http.get('api/search?term=' + term).success(function(tracks){
			wait.resolve(tracks);
		});

		return wait.promise;
	}

	function setQueueTracks(tracks){
		queue = tracks;
	}

	function getTracks(playlistId){
		var wait = $q.defer();

		$pouchdb.getTracks(playlistId).then(function(tracks){
			wait.resolve(tracks);
		});

		return wait.promise;
	}

	function updateTracks(playlistId){
		$http.get('api/playlist?uri=' + playlistId).success(function(tracks){
			$pouchdb.addTracks(playlistId, tracks);
		});	
	}

	function play(track){
		$http.get('/api/play?uri=' + track.uri).success(function(m){
			console.log(track);
			$rootScope.playingTrack = track;
			$rootScope.isPlaying = true;

			$timeout(function(){
				play(queue[Math.floor(Math.random()*queue.length)]);
			}, track.durationMs);
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
	var remoteCouch = 'http://' + window.location.hostname + ':5984/spotbox';

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

	function addPlaylist(playlist){
		var wait = $q.defer();
		playlist._id = playlist.uri;
		db.put(playlist, function(err, res){
			$rootScope.$apply(function(){
				if(err)
					wait.reject(err);
				else
					wait.resolve(res);
			});		
		});
		return wait.promise;
	}

	function addTracks(playlistId, tracks){
		var wait = $q.defer();
		db.get(playlistId, function(err, res){
			res.tracks = tracks;
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
			emit(null, {id: doc._id, uri: doc.uri, trackscount: trackscount});
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
		addTracks: addTracks,
		getPlaylists: getPlaylists,
		getTracks: getTracks
	};
}]);