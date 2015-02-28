
var app = angular.module('demo', ['CornerCouch'])
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "../db";
  $scope.brews = [];
  $scope.events = [];
  var db = $scope.server.getDB('brewberry_index');
  db.query('index_db','all').success(function(data) { 
    $scope.brews = _.map(data.rows, function(row) {
      return {
        name: row.value.name,
        id: row.id
      };
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
