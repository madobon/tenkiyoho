// http://qiita.com/inuscript/items/41168a50904242005271
import path from 'path';
import request from 'request';
import cheerio from 'cheerio';
import jtalk from 'openjtalk';
import http from 'http';
import express from "express";
import bodyParser from 'body-parser';
import {Server as WebSocketServer} from "ws";
import passport from 'passport';
import {BasicStrategy} from 'passport-http';
import db from './db';

let app = express(),
    port = process.env.PORT || 5000,
    $,
    connects = [],
    isTalking = false,
    users = [];

const WEEK = ["日","月","火","水","木","金","土"];

passport.use(new BasicStrategy(
  (username, password, done) => {
    db.users.findByUsername(username, (err, user) => {
      if (err) return done(err);
      if (!user) return done(null, false);
      if (user.password !== password) return done(null, false);
      return done(null, user);
    });
  }
));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())

app.get('/',
  passport.authenticate('basic', { session: false }),
  function (req, res) {
    res.render('index', {});
  }
);

let server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

var wss = new WebSocketServer({server: server});
console.log("websocket server created");

wss.on("connection", function(ws) {

  broadcast(ws, {message: '', talking: isTalking}, function(){}, true);

  console.log("websocket connection open");
  connects.push(ws);
  console.log('connects: %d', connects.length);

  ws.on("close", function() {
    console.log("websocket connection close");
    closeConnection(ws);
  })

  ws.on('message', function(message) {
    let obj = JSON.parse(message);
    obj && execute(ws, obj);
  });

  function closeConnection(conn) {
    connects = connects.filter(function (connect, i) {
        return (connect === conn) ? false : true;
    });
    console.log('connects: %d', connects.length);
  }
});

function broadcast(conn, message, func, self) {
  for (let connect of connects) {
    if (!self && connect === conn) continue;
    connect.send(JSON.stringify(message), func);
  }
}

function execute(conn, obj) {

  let args = obj.args;

  if (!args) {
    return;
  }

  request({
      method: 'GET',
      url: obj.url || 'http://weather.yahoo.co.jp/weather/jp/14/4610/14133.html'
  }, function(err, response, body) {
      if (err) return console.error(err);

      $ = cheerio.load(body);

      let $today = $('#yjw_pinpoint_today');
      let $tomorrow = $('#yjw_pinpoint_tomorrow');

      let texts = [];

      let textsArea = createAreaText($);

      Array.prototype.push.apply(texts, textsArea);

      let hasNoArgs = args.indexOf('now') === -1 &&
                      args.indexOf('today') === -1 &&
                      args.indexOf('tomorrow') === -1;

      if (args.indexOf('now') !== -1 || hasNoArgs) {
        let textsRealtime = createRealtimeWeatherText($, '', '');
        Array.prototype.push.apply(texts, textsRealtime);
      }
      if (args.indexOf('today') !== -1 || hasNoArgs) {
        let textsToday = createWeatherText($today, 'このあとの天気予報をお知らせします。', '以上、今日の天気予報をお知らせしました。');
        Array.prototype.push.apply(texts, textsToday);
      }
      if (args.indexOf('tomorrow') !== -1 || hasNoArgs) {
        let textsTommorow = createWeatherText($tomorrow, '明日の天気予報をお知らせします。', '以上、明日の天気予報をお知らせしました。');
        Array.prototype.push.apply(texts, textsTommorow);
      }

      talk(conn, texts);
  });
}

function talk(conn, texts) {
  if (isTalking) {
    return;
  }
  console.log(texts);
  isTalking = true;
  let mei = new jtalk({
    // htsvoice        : './voice/mei/mei_happy.htsvoice',
    // dic             : './dic/open_jtalk_dic_utf_8-1.08',
    sampling_rate   : 48000,
    pitch           : 200,
    audio_buff_size : 48000,
    alpha           : 0.5,
    beta            : 0.5,
    uv_threshold    : 0.5,
    gv_weight_mgc   : 1.0,
    gv_weight_lf0   : 1.0
  });

  let _talk = function(texts) {
    let i = arguments[1] || 0;
    if (texts.length < i + 1) {
      isTalking = false;
      broadcast(conn, {message: '', talking: isTalking}, function(){}, true);
      return;
    }
    let text = texts[i];

    var $li = $('<li />');
    var now　=　new Date();
    var nowMon = zeroPadding(now.getMonth() + 1);
    var nowDay = zeroPadding(now.getDate());
    var nowWeek = now.getDay();
    var nowHour = zeroPadding(now.getHours());
    var nowMin = zeroPadding(now.getMinutes());
    var nowSec = zeroPadding(now.getSeconds());
    var nowDate = "["+nowMon+"月"+nowDay+"日("+WEEK[nowWeek]+") "+nowHour+":"+nowMin+":"+nowSec+"] ";

    broadcast(conn, {message: nowDate + text, talking: isTalking}, function(){}, true);
    mei.talk(text, function(err) {
      if (err) console.log('err', err);
      _talk(texts, ++i);
    });
  }

  _talk(texts);
  return texts;
}

function zeroPadding(val) {
  return ("0" + val).slice(-2);
}

function createAreaText($) {
  let body = []
  body.push($('title').text().match(/(.+)の天気/)[0] + '予報です。');
  return body;
}

function createRealtimeWeatherText($, prefix, suffix) {

  let body = [];
  if (prefix) body.push(prefix);

  let $max = $('.RankArrow.MaxCurrent');
  let weather;
  if ($max.length) {
    weather = getWeather($max.parents('.LWbtn'));
    body.push(`只今、${$max.text()}の人が「${weather}」と呟いてます。`);
  } else {
    let message = [],
        count;
    message.push('只今、');
    $('.RankArrow').each(function(){
      weather = getWeather($(this).parents('.LWbtn'));
      message.push(`${$(this).text()}の人が「${weather}」`);
      count += parseInt($(this).text(), 10);
    });
    message.push('と呟いてます。');

    if (count > 0) {
      body.push(message.join(''));
    } else {
      body.push('残念ながら、実況者がおりませんでした。');
    }
  }

  if (suffix) body.push(suffix);

  return body;
}

function getWeather($weather) {

  let weather = '';

  switch ($weather.attr('id')) {
    case 'sunBtn':
      weather = '晴れ';
      break;
    case 'cloudsBtn':
      weather = '曇り';
      break;
    case 'rainBtn':
      weather = '雨';
      break;
    case 'snowBtn':
      weather = '雪';
      break;
    default:
      console.error('dom has changed!')
  }

  return weather
}

function createWeatherText($weather, prefix, suffix) {

    let weatherData = getRawWeatherData($weather.find('.yjw_table2'));

    let body = [];
    if (prefix) body.push(prefix);
    let date = $weather.find('h3 span').text()
                .replace(' - ', '')
                .replace(/\((.+?)\)/, '($1曜日)');

    body.push(date);

    let tempatures = [];

    Object.keys(weatherData).forEach(function(key) {

        let data = weatherData[key];
        let time = data[0].replace(/[\n\r]/g, '');
        let weather = data[1].replace(/[\n\r]/g, '');
        let tempature = data[2];
        let humidity = data[3];
        let precipitation = data[4];
        let windData = data[5].split(/[\n\r]/g);
        let windDirection = windData[0];
        let windPower = windData[1];

        // body.push(time + 'の天気は' + weather + '、気温は' + tempature + '度、湿度は' + humidity + '％、降水量は' + precipitation + 'ミリメートル、風向は' + windDirection + '、風速は' + windPower + 'メートル毎秒です。');

        if (parseInt(precipitation, 10) > 0) {
          body.push(`${time}、${weather}、気温は${tempature}度、湿度は${humidity}％、降水量は${precipitation}ミリメートルです。'`);
        } else {
          body.push(`${time}、${weather}、気温は${tempature}度、湿度は${humidity}％です。`);
        }

        tempatures.push({
          time: time,
          tempature: tempature
        });

    });

    tempatures = tempatures.sort(function(a, b){
      let x = a['tempature'];
      let y = b['tempature'];
      if (x > y) return 1;
      if (x < y) return -1;
      return 0;
    });

    if (tempatures.length > 1) {
      let minTempature = tempatures[0];
      let maxTempature = tempatures[tempatures.length - 1];

      body.push(`最低気温は${minTempature.time}の${minTempature.tempature}度です。`);
      body.push(`最高気温は${maxTempature.time}の${maxTempature.tempature}度です。`);
    }

    if (suffix) body.push(suffix);

    return body;
}

function getRawWeatherData($dataTable) {
    let weatherData = {};
    $dataTable.each(function() {
        $(this).find('tr').eq(0).each(function() {
            $(this).find('td').each(function(i, elem) {
                if ($(this).attr('bgcolor') === '#e9eefd') {
                    weatherData[i] = [];
                }
            });
        });
    });

    $dataTable.each(function() {
        $(this).find('tr').each(function() {
            let $td = $(this).find('td');
            Object.keys(weatherData).forEach(function(key) {
                weatherData[key].push($td.eq(key).text());
            });
        });
    });
    return weatherData;
}
