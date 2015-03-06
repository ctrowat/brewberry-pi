
var app = angular.module('demo', ['CornerCouch'])
.directive("brewRepeatDirective", function() {
  return function(scope, element, attrs) {
    scope.$parent.server.getDB('brewberry_index').query('index_db','all', {key:scope.brew.id}).success(function(indexData) {
      if (data.rows.length === 1) {
        var minTemp = data.rows[0].min_temp;
        var maxTemp = data.rows[0].max_temp;
        scope.$parent.server.getDB('brewberry_temps').query('temps_db','by_brew_id', {key:scope.brew.id}).success(function(data) {
          scope.brew.temps = _.sortBy(_.map(data.rows, function(row) {
            return {
              date: row.value.date,
              temp: row.value.temp
            };
          }), function(row) { return row.value.temp; });
          scope.brew.temps[0].min = minTemp;
          scope.brew.temps[0].max = maxTemp;
          scope.brew.temps[scope.brew.temps.length - 1].min = minTemp;
          scope.brew.temps[scope.brew.temps.length - 1].max = maxTemp;
          setTimeout(function() {
            // we should be able to make a chart with this!
            // we could probably also hook up a callback to refresh the chart every minute or so
            scope.chart = new Morris.Line({
              'element':element.find('.brew-chart')[0],
              'data':temps,
              'xkey':'date',
              'ykeys':['temp', 'min', 'max'],
              'hideHover':true,
              'pointStrokeColors':'#000000',
              labels:['Temperature']
            });
          }, 100);
          scope.brew.loading = false;
        });
      }
    }).error(function(err) {
      console.dir(err);
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
      comments: row.comments,
      temps: [],
      loading: true
    };
  };
  
  indexDb.query('index_db','all').success(function(data) { 
    $scope.brews = _.map(data.rows, function(row) { return transformBrew(row.value, row.id); });
    $scope.loading = false;
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
    $scope.newBrews.push({channel:0, minTemp: 22, maxTemp: 24});
  };
  $scope.saveNew = function(newBrew) {
    // check for an existing brew with this id before blindly saving
    var newDoc = indexDb.newDoc({
      _id: _.snakeCase(_.deburr(newBrew.name)), 
      name: newBrew.name, 
      adc_channel: newBrew.channel,
      minTemp: parseInt(newBrew.minTemp, 10),
      maxTemp: parseInt(newBrew.maxTemp, 10)
    });
    newDoc.save().success(function() { 
      $scope.newBrews = _.without($scope.newBrews, newBrew);
      debugger;
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
    if (!$scope.isNumber(newBrew.minTemp)) { return false; }
    if (!$scope.isNumber(newBrew.maxTemp)) { return false; }
    return true;
  };
  $scope.showActions = function(brew) {
    return (!(brew.finished_date) || !(brew.start_date));
  };
});
angular.bootstrap(document, ['demo']);
