var app = angular.module('demo', ['CornerCouch'])
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "http://localhost:5984";
  $scope.server.method = "JSONP";
  $scope.server.getDB('brewberry_index').getInfo().success(function(a) { console.dir(a); });
});
angular.bootstrap(document, ['demo']);