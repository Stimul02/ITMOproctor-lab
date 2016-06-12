var path = require('path');
var EmailTemplate = require('email-templates').EmailTemplate;
var nodemailer = require('nodemailer');
var wellknown = require('nodemailer-wellknown');
var bunyan = require('bunyan');

// Настройка транспорта для отправки сообщений
var transport = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: 'skylegolas1@mail.ru',
        pass: '12091995tm'
    },
    logger: bunyan.createLogger({name: 'nodemailer',streams: [
    {
      path: './emails.log' // Файл с логами по отправке
    }
  ]
})});

module.exports = transport;