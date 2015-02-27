
var app = angular.module('demo', ['CornerCouch'])
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "../db";
  var db = $scope.server.getDB('brewberry_index');
  db.query('all','all').success(function(data) { 
    $scope.brews = _.map(data.rows, function(row) {
      return {
        name: row.value.name,
        id: row.id
      };
    });
  });
  $scope.finishBrew = function(brew) {
    console.dir(brew);
  };
});
angular.bootstrap(document, ['demo']);
