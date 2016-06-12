var config = require('nconf').file('./config.json');
var db = require('monk')(config.get('mongoose:uri')+'/asd');
var exams = db.get('exams');
var emails = db.get('emails'); // Коллекция для отслеживания писем и получения данных для них
var users = db.get('users');
var moment = require("moment");
var path = require('path');
var EmailTemplate = require('email-templates').EmailTemplate;
var transport = require("../mailer");

var templatesDir = path.resolve(__dirname, '../', 'templates');
// Указывается название папки из дериктории "templates" с необходимым шаблоном.
var template = new EmailTemplate(path.join(templatesDir, 'newsletter'));

module.exports = function(agenda) {
  // Задание для добавления в email новых записей
  agenda.define('check exams', function(job, done) {
    /* 
      Выборка всех записей из коллекции "exams", где
      1. docNew - запись из коллекции "exams";
      2. docOld - запись из коллекции "emails".
    */
    
    exams.find({}).each(function (docNew) {
          // Поиск в "emails" совпадения по имени студента и названию экзамена
          emails.find({'student': docNew.student,
            'subject': docNew.subject}).on('success', function (docOld) {
              // Если не нашли совпадений
              if((docOld.length == 0) && (docNew.beginDate != null)){
                // Получение текущего времени и из "exams" в UTC
                var now = moment.utc();
                var then = moment.utc(docNew.beginDate);
                var d = then.diff(now,'minutes');
                // Если разница во времени более 0 минут, то добавляем.
                if(d >= 0){
                  emails.insert({
                  'student': docNew.student,
                  'beginDate': docNew.beginDate,
                  'subject': docNew.subject,
                  'inspector': docNew.inspector,
                  'check': false
                  });
                  // Если остаётся меньше часа, то сразу отправляем письмо с оповещением.
                  if(d <= 60){
                    agenda.now('send email', {studentId: docNew.student, inspectorId: docNew.inspector, examName: docNew.subject});
                  }
                }
              }
              /*
                Проверки для изменения "emails":
                1. Если студент отменил запись, то удаляем;
                2. Если изменилась дата начала либо проктор, то обновляем.
                3. Если письмо отправлено удачно (check будет true), то удалем, чтобы не мешалось
              */
              else if(docOld.length != 0){
                if(docNew.beginDate == null){
                  emails.remove({'_id': docOld[0]._id});
                }
                else if((docOld[0].beginDate != docNew.beginDate) || (docOld[0].inspector != docNew.inspector)){
                  emails.update({'_id': docOld[0]._id},{$set: {'beginDate':docNew.beginDate,'inspector': docNew.inspector}});
                }
                if(docOld.check){
                  emails.remove({'_id': docOld._id});
                }
              };
            });
      });
    done();
  });
  // Задание для отправки оповещения студенту
  agenda.define('send email',function(job, done) {
    // Получаем данные о студенте и прокторе
    var student = users.find({'_id': job.attrs.data.studentId});
    var proctor = users.find({'_id': job.attrs.data.inspectorId});
    
    /*
      Переменная заведена для более удобного представления данных для отправки.
      Надо изменить под нужды или удалить.
    */
    var locals = {
      email: 'student1@example.com',
      name: {
        first: 'FirstName',
        last: 'LastName'
      }
    };
    template.render(locals, function (err, results) {
        if (err) {
            return console.error(err)
        }
        /*
          Заполнение данных, которые отдаюся на рендер в шаблон.
          Поля "from","to","html","text" обязательны. Последние два лучше не трогать.
        */
        transport.sendMail({
            from: 'Inspector1@example.com',
            to: locals.email,
            subject: 'Экзамен',
            html: results.html,
            text: results.text
        }, function (err, responseStatus) {
            if (err) {
                return console.error(err);
            }
            console.log(responseStatus.message);
            // Обновляем соответсвующую запись в коллекции "emails", что она отправлена успешно
            emails.update({'student': job.attrs.data.studentId, 'subject': job.attrs.data.examName},{$set: {'check': true}});
        })
    });
    done();
  });
  // Задание на проверку неотправленных оповещений
  agenda.define('check emails', function(job, done) {
    emails.find({'check': false}).each(function (doc) {
      var now = moment.utc();
      var then = moment.utc(doc.beginDate);
      var d = then.diff(now,'minutes');
      if((d <= 60) && (d >= 0)){
        agenda.now('send email', {studentId: doc.student, inspectorId: doc.inspector, examName: doc.subject});
      }
    });
    done();
  });
  // Установка временных интервалов для запуска каждой работы.
  agenda.on('ready', function() {
    agenda.every('20 seconds','check exams');
    agenda.every('10 minuts','check emails');
  });
}

db.close();