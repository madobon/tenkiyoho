let request = require('request'),
    cheerio = require('cheerio'),
    jtalk = require('openjtalk');

let $;

let arg = process.argv;

let url = 'http://weather.yahoo.co.jp/weather/jp/14/4610/14133.html';

arg.some(function(val){
  if (/^http/.test(val)) {
    url = val;
    return true;
  }
});

request({
    method: 'GET',
    url: url
}, function(err, response, body) {
    if (err) return console.error(err);

    $ = cheerio.load(body);

    let $today = $('#yjw_pinpoint_today');
    let $tomorrow = $('#yjw_pinpoint_tomorrow');

    let texts = [];
    let textsArea = createAreaText($);
    let textsRealtime = createRealtimeWeatherText($, '', '');
    let textsToday = createWeatherText($today, 'このあとの天気予報をお知らせします。', '以上、今日の天気予報をお知らせしました。');
    let textsTommorow = createWeatherText($tomorrow, '明日の天気予報をお知らせします。', '以上、明日の天気予報をお知らせしました。');

    Array.prototype.push.apply(texts, textsArea);

    if (arg.indexOf('now') !== -1) {
      Array.prototype.push.apply(texts, textsRealtime);
    }
    if (arg.indexOf('today') !== -1) {
      Array.prototype.push.apply(texts, textsToday);
    }
    if (arg.indexOf('tomorrow') !== -1) {
      Array.prototype.push.apply(texts, textsTommorow);
    }

    if (arg.indexOf('now') === -1 &&
        arg.indexOf('today') === -1 &&
        arg.indexOf('tomorrow') === -1) {
      Array.prototype.push.apply(texts, textsRealtime);
      Array.prototype.push.apply(texts, textsToday);
      Array.prototype.push.apply(texts, textsTommorow);
    }

    talk(texts);
});

function talk(texts) {
  console.log(texts);
  let mei = new jtalk();

  let _talk = function(texts) {
    let i = arguments[1] || 0;
    if (texts.length < i + 1) return;
    mei.talk(texts[i], function(err) {
      if (err) console.log('err', err);
      _talk(texts, ++i);
    });
  }

  _talk(texts);
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
