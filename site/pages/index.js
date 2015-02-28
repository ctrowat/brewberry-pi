
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
  $scope.startBrew = function(brew) {
    console.log('Mark this brew as started');
    console.dir(brew);
    // add a start date
  };
  $scope.finishBrew = function(brew) {
    var finishedDate = new Date();
    var indexDoc = indexDb.getDoc();
    indexDoc.load(brew.id).success(function(a,b,c,d,e) {
      var newDoc = new indexDb.docClass(a);
      newDoc.finished_date = finishedDate.getFullYear() + '-' + finishedDate.getMonth() + '-' + finishedDate.getDate() + ' ' + finishedDate.getHours() + ':' + finishedDate.getMinutes() + ':' + finishedDate.getSeconds();
      newDoc.save().success(function(a,b,c) { 
        debugger;
      });
    });
  };
  $scope.showActions = function(brew) {
    return (!(brew.finish_date) && !(brew.start_date));
  };
});
angular.bootstrap(document, ['demo']);
