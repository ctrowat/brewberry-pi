var app = angular.module('demo', ['CornerCouch'])
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "http://localhost:3000/db";
  $scope.server.getDB('brewberry_index').getInfo().success(function(a) { console.dir(a); });
  $scope.brews = [{id:"testbrew", name:"something awesome"}];
});
angular.bootstrap(document, ['demo']);