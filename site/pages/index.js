
var app = angular.module('demo', ['CornerCouch'])
.directive("brewRepeatDirective", function() {
  return function(scope, element, attrs) {
    scope.$parent.server.getDB('brewberry_temps').query('temps_db','by_brew_id', {key:scope.brew.id}).success(function(data) {
      var series = {};
      series.min = {data: [], name: 'Min'};
      series.max = {data: [], name: 'Max'};
      series.temp = {data: [], name: 'Temp'};
      var min = 20, max = 20;
      scope.brew.temps = _.sortBy(_.map(data.rows, function(row) { return row.value; }), function(row) { return row.date; });
      _.each(scope.brew.temps.slice(-50), function(tempEntry, index) {
        var date = Date.parse(tempEntry.date);
        series.min.data.push([date, tempEntry.min_temp]);
        series.max.data.push([date, tempEntry.max_temp]);
        series.temp.data.push([date, tempEntry.temp]);
        min = Math.min(tempEntry.min_temp, Math.min(tempEntry.temp, min));
        max = Math.max(tempEntry.max_temp, Math.max(tempEntry.temp, max));
      });
      min -= 2;
      max += 2;
      setTimeout(function() {
        element.find('.brew-chart').highcharts({
          chart: { type: 'spline' },
          title: { text: 'Temperatures' },
          xAxis: {
            type: 'datetime',
            title: { text: 'Date' }
          },
          yAxis: {
            title: { text: 'Temperature' },
            min: min,
            max: max
          },
          tooltip: {
            headerFormat: '<b>{series.name}</b><br>',
          },
          plotOptions: { spline: { marker: { enabled: true } } },
          series: _.values(series)
        });
      }, 100);
      scope.brew.loading = false;
    });
  };
})
.controller('brewberryController', function($scope, cornercouch) {
  $scope.id = "pi";
  $scope.server = cornercouch();
  $scope.server.uri = "../db";
  $scope.brews = [];
  $scope.newBrews = [];
  $scope.events = [];
  $scope.loading = true;
  $scope.isNumber = function(value) { 
    return !_.isNaN(parseInt(value,10)); 
  };
  var indexDb = $scope.server.getDB('brewberry_index');
  var tempsDb = $scope.server.getDB('brewberry_temps');
  var eventsDb = $scope.server.getDB('brewberry_events');
  
  var transformBrew = function(row, id) {
    return {
      name: row.name ? row.name : 'NO NAME (' + id + ')',
      id: id,
      start_date: row.start_date,
      finish_date: row.finish_date,
      comment: row.comment,
      temps: [],
      loading: true
    };
  };
  
  indexDb.query('index_db','all').success(function(data) { 
    $scope.brews = _.map(data.rows, function(row) { return transformBrew(row.value, row.id); });
    $scope.loading = false;
  });
  eventsDb.query('events_db','by_brewid').success(function(data) {
    $scope.events = _.sortBy(_.map(data.rows, function(row) { return row.value; }), function(event) { return event.event_date; }).reverse().slice(0,10);
    
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
    $scope.newBrews.push({channel:0, min_temp: 22, max_temp: 24});
  };
  $scope.saveNew = function(newBrew) {
    // check for an existing brew with this id before blindly saving
    var newDoc = indexDb.newDoc({
      _id: _.snakeCase(_.deburr(newBrew.name)), 
      name: newBrew.name, 
      adc_channel: newBrew.channel,
      min_temp: parseInt(newBrew.min_temp, 10),
      max_temp: parseInt(newBrew.max_temp, 10)
    });
    newDoc.save().success(function() { 
      $scope.newBrews = _.without($scope.newBrews, newBrew);
      $scope.brews.push(transformBrew(newDoc, newDoc._id));
    }).error(function(err) {
      console.log('error saving document');
      console.dir(newBrew);
      console.dir(newDoc);
      console.dir(err);
    });
  };
  $scope.saveNewEnabled = function(newBrew) {
    if (!newBrew.name) { return false; }
    if (newBrew.channel < 0) { return false; }
    if (newBrew.channel > 7) { return false; }
    if (!$scope.isNumber(newBrew.min_temp)) { return false; }
    if (!$scope.isNumber(newBrew.max_temp)) { return false; }
    return true;
  };
  $scope.showActions = function(brew) {
    return (!(brew.finished_date) || !(brew.start_date));
  };
  $scope.saveComment = function(brew) {
    var indexDoc = indexDb.getDoc();
    indexDoc.load(brew.id).success(function(a) {
      var loadedDoc = new indexDb.docClass(a);
      loadedDoc.comment = brew.comment;
      loadedDoc.save().success(function() { 
      }).error(function(err) {
        console.log('error saving comment for %s: %s', brew.id, err);
      });
    });
  };
});
angular.bootstrap(document, ['demo']);
