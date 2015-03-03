
var app = angular.module('demo', ['CornerCouch'])
.directive("brewRepeatDirective", function() {
  return function(scope, element, attrs) {
    scope.$parent.server.getDB('brewberry_temps').query('temps_db','by_brew_id', {key:scope.brew.id}).success(function(data) {
      scope.brew.temps = _.map(data.rows, function(row) {
        return {
          date: row.value.date,
          temp: row.value.temp
        };
      });
      setTimeout(function() {
        // we should be able to make a chart with this!
        // we could probably also hook up a callback to refresh the chart every minute or so
        scope.chart = new Morris.Line({
          'element':element.find('.brew-chart')[0],
          'data':scope.brew.temps,
          'xkey':'date',
          'ykeys':['temp'],
          'hideHover':true,
          labels:['Temperature']
        });
      }, 100);
      scope.brew.loading = false;
      /*var chart = new Highcharts.Chart({
        chart: { renderTo: element.find('.brew-chart')[0] },
        xAxis: { type: 'datetime' },
        series: [{ data: scope.brew.temps }]
      });*/
    });
  }
})
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "../db";
  $scope.brews = [];
  $scope.newBrews = [];
  $scope.events = [];
  $scope.loading = true;
  var indexDb = $scope.server.getDB('brewberry_index');
  var tempsDb = $scope.server.getDB('brewberry_temps');
  var eventsDb = $scope.server.getDB('brewberry_events');
  
  indexDb.query('index_db','all').success(function(data) { 
      $scope.loading = false;
    var brews = _.map(data.rows, function(row) {
      return {
        name: row.value.name ? row.value.name : 'NO NAME (' + row.id +')',
        id: row.id,
        start_date: row.value.start_date,
        finished_date: row.value.finished_date,
        comments: row.value.comments,
        temps: [],
        loading: true
      };
    });
    var brewsIndex = _.indexBy(brews, function(brew) { return brew.id; });
    $scope.brews = _.values(brewsIndex);  
  });  
  $scope.startBrew = function(brew, index) {
    var indexDoc = indexDb.getDoc();
    indexDoc.load(brew.id).success(function(a) {
      var loadedDoc = new indexDb.docClass(a);
      loadedDoc.start_date = (new Date()).toString('yyyy-MM-dd HH:mm:ss');
      loadedDoc.save().success(function() { 
        $scope.brews[index].start_date = loadedDoc.start_date;
      });
    });
  };
  $scope.finishBrew = function(brew, index) {
    var indexDoc = indexDb.getDoc();
    indexDoc.load(brew.id).success(function(a) {
      var loadedDoc = new indexDb.docClass(a);
      loadedDoc.finished_date = (new Date()).toString('yyyy-MM-dd HH:mm:ss');
      loadedDoc.save().success(function() { 
        $scope.brews[index].finished_date = loadedDoc.finished_date;
      });
    });
  };
  $scope.addNew = function() {
    $scope.newBrews.push({channel:0});
  };
  $scope.saveNew = function(newBrew) {
    // check for an existing brew with this id before blindly saving
    var newDocId = _.snakeCase(_.deburr(newBrew.name));
    var newDoc = indexDb.newDoc({_id: newDocId, name: newBrew.name, adc_channel: newBrew.channel });
    newDoc.save().success(function() { 
      $scope.newBrews = _.without($scope.newBrews, newBrew);
    }).error(function(err) {
      console.log('error saving document');
      console.dir(newBrew);
      console.dir(newDoc);
      console.dir(err);
    });
  };
  $scope.saveNewEnabled = function(newBrew) {
    return !newBrew.name || (newBrew.channel < 0) || (newBrew.channel > 7);
  };
  $scope.showActions = function(brew) {
    return (!(brew.finished_date) || !(brew.start_date));
  };
});
angular.bootstrap(document, ['demo']);
