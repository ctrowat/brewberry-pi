
var app = angular.module('demo', ['CornerCouch'])
.directive("brewRepeatDirective", function() {
  return function(scope, element, attrs) {
    // we should be able to make a chart with this!
    // we could probably also hook up a callback to refresh the chart every minute or so
    new Morris.Line({
      'element':element.find('.brew-chart')[0],
      'data':scope.brew.temps,
      'xkey':'date',
      'ykeys':['temp'],
      'hideHover':true,
      labels:['Temperature']
    });
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
        finished_date: row.value.finished_date,
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
  $scope.startBrew = function(brew, index) {
    var indexDoc = indexDb.getDoc();
    indexDoc.load(brew.id).success(function(a) {
      var newDoc = new indexDb.docClass(a);
      newDoc.start_date = (new Date()).toString('yyyy-MM-dd HH:mm:ss');
      newDoc.save().success(function(a,b,c) { 
        $scope.brews[index].start_date = newDoc.start_date;
      });
    });
  };
  $scope.finishBrew = function(brew, index) {
    var indexDoc = indexDb.getDoc();
    indexDoc.load(brew.id).success(function(a) {
      var newDoc = new indexDb.docClass(a);
      newDoc.finished_date = (new Date()).toString('yyyy-MM-dd HH:mm:ss');
      newDoc.save().success(function(a,b,c) { 
        $scope.brews[index].finished_date = newDoc.finished_date;
      });
    });
  };
  $scope.showActions = function(brew) {
    return (!(brew.finished_date) || !(brew.start_date));
  };
});
angular.bootstrap(document, ['demo']);
