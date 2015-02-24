var app = angular.module('demo', [])
.controller('brewberryController', function($scope) {
  console.log('hi');
  $scope.id = "pi";
  
});
angular.bootstrap(document, ['demo']);