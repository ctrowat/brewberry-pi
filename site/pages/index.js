var app = angular.module('demo', ['CornerCouch'])
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "http://localhost:3000/db";
  var db = $scope.server.getDB('brewberry_index');
  db.query('all','all').success(function(data) { 
    console.dir(data); 
  });
  $scope.brews = [{id:"testbrew", name:"something awesome"}];
  $scope.finishBrew = function(brew) {
    console.dir(brew);
  };
});
angular.bootstrap(document, ['demo']);