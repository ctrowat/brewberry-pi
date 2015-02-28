
var app = angular.module('demo', ['CornerCouch'])
.directive("brewRepeatDirective", function() {
  return function(scope, element, attrs) {
    //console.dir(scope.brew.temps);
    //console.dir(element.find('.brew-table'));
    // we should be able to make a chart with this!
  }
})
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "../db";
  $scope.brews = [];
  $scope.events = [];
  var indexDb = $scope.server.getDB('brewberry_index');
  var tempsDb = $scope.server.getDB('brewberry_temps');
  indexDb.query('index_db','all').success(function(data) { 
    var brews = _.map(data.rows, function(row) {
      return {
        name: row.value.name ? row.value.name : 'NO NAME (' + row.id +')',
        id: row.id,
        start_date: row.value.start_date,
        finish_date: row.value.finish_date,
        temps: []
      };
    });
    tempsDb.query('temps_db','by_brew_id').success(function(data) {
      var brewsIndex = _.indexBy(brews, function(brew) { return brew.id; });
      _.each(data.rows, function(row) {
        if (!_.isUndefined(brewsIndex[row.key])) { 
          brewsIndex[row.key].temps.push({
            date: row.value.date,
            temp: row.value.temp
          }); 
        }
      });
      $scope.brews = _.values(brewsIndex);  
    });
  });  
  $scope.startBrew = function(brew) {
    console.log('Mark this brew as started');
    console.dir(brew);
    // add a start date
  };
  $scope.finishBrew = function(brew) {
    console.log('Mark this brew as finished');
    console.dir(brew);
    // insert the finished date
  };
  $scope.showActions = function(brew) {
    return $scope.showStart(brew) || $scope.showFinish(brew);
  };
  $scope.showStart = function(brew) {
    return true;
  };
  $scope.showFinish = function(brew) {
    return true;
  };
});
angular.bootstrap(document, ['demo']);
