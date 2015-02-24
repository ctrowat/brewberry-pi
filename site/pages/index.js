var app = angular.module('demo', [])
.controller('brewberryController', function($scope) {
  $scope.id = "pi";
  
});
angular.bootstrap(document, ['demo']);