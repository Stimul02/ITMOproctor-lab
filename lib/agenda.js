//Основной файл для конфигурации Agenda
var config = require('nconf').file('./config.json');
var Agenda = require('agenda');
var agenda = new Agenda({ db: { address: config.get('mongoose:uri'), collection: 'jobs' }});

var jobTypes = process.env.JOB_TYPES ? process.env.JOB_TYPES.split(',') : [];


// Получение списка работ из папки "jobs".
jobTypes.forEach(function(type) {
  require('./jobs/' + type)(agenda);
})

if(jobTypes.length) {
  agenda.on('ready', function() {
    console.log(jobTypes);
    agenda.start();
    module.exports = agenda;
  });
}
