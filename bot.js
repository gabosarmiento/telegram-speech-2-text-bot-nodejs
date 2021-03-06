'use strict';
var Bot = require('node-telegram-bot-api');
var watson = require('watson-developer-cloud');
var request = require('request');
var config = require('./config');

module.exports = function () {
  var speechToText = watson.speech_to_text({
    username: config.watson.username,
    password: config.watson.password,
    version: 'v1',
    url: 'https://stream.watsonplatform.net/speech-to-text/api',
  });

  var params = {
    content_type: 'audio/ogg;codecs=opus',
    continuous: true,
    interim_results: false,
    model: 'es-ES_BroadbandModel',
  };

  var bot = new Bot(config.telegram.token, { polling: true });

  // Matches /echo [whatever]
  bot.onText(/\/echo (.+)/, function (msg, match) {
    var fromId = msg.from.id;
    var resp = match[1];
    bot.sendMessage(fromId, resp);
  });

  bot.on('message', function (msg) {
    var property = 'voice';
    if (msg[property]) {
      return onVoiceMessage(msg);
    }
  });

  function onVoiceMessage(msg) {
    var chatId = msg.chat.id;
    bot.getFileLink(msg.voice.file_id).then(function (link) {
      // setup new recognizer stream
      var recognizeStream = speechToText.createRecognizeStream(params);
      recognizeStream.setEncoding('utf8');
      recognizeStream.on('results', function (data) {
        if (data && data.results && data.results.length > 0 && data.results[0].alternatives
          && data.results[0].alternatives.length > 0) {
          var result = data.results[0].alternatives[0].transcript;
          console.log('result: ', result);

          // send speech recognizer result back to chat
          bot.sendMessage(chatId, result, {
            disable_notification: true,
            reply_to_message_id: msg.message_id,
          }).then(function () {
            // reply sent!
          });
        }
      }
      );
      ['data', 'error', 'connection-close'].forEach(function (eventName) {
        recognizeStream.on(eventName, console.log.bind(console, eventName + ' event: '));
      });

      // pipe voice message to recognizer -> send to watson
      request(link).pipe(recognizeStream);
    });
  }
};
