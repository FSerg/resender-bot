var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var config = require('./config');
var TelegramBot = require('node-telegram-bot-api');

var phantom = require('phantomjs');
var childProcess = require('child_process');

var moment = require('moment');
require('moment/locale/ru');

var numeral = require('numeral');
// numeral.language('ru');
var numeralRu = require('numeral/languages/ru');
numeral.language('ru', numeralRu);
numeral.language('ru');

// Setup polling way
var bot = new TelegramBot(config.token, {polling: false});


var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/123', function(req, res) {
    var myText = 'Привет!';
    bot.sendMessage(config.chatid, myText);
});

app.post('/ut', function(req, res) {
    // console.log('===========');
    // console.log(req);
    console.log('===========');
    console.log(req.body);
    console.log('===========');

    var data = req.body;
    //var myText = 'Выручка на тек.момент ('+moment().format('llll')+'):\n';
    var myText = data.Title+'\n';
    var summaTotal = numeral(data.Summa).format('0,0.00 $');
    myText = myText + '*Общая: '+summaTotal+'*\n';

    var series = [];
    var kkms = [];
    var cashValues = [];
    var cardValues = [];
    var totalValues = [];
    data.Details.forEach(function(line){
        //var summa = numeral(line.Summa0).format('0,0[.]00 $');
        var summa = numeral(line.Summa).format('0,0.00 $');
        myText = myText + line.Kassa + ' = *' + summa + '*\n';

        // подготовим данные для графика
        series.push({ "name": line.Kassa, "y": line.Summa });

        // additional variant
        kkms.push(line.Kassa);
        cashValues.push(line.SummaCash);
        cardValues.push(line.SummaCards);
        totalValues.push(line.Summa);
    });
    kkms = kkms.filter(uniqueVal);
    var maxValue = Math.max.apply(null, totalValues);
    maxValue = maxValue + maxValue*0.1;

    var opts = { parse_mode: 'Markdown' };
    bot.sendMessage(data.SenderID, myText, opts);

    // ПОДГОТОВИМ И ОТПРАВИМ ГРАФИК
    // var inFileData = GetInFileDataPie(data.Title, series);
    var inFileData = GetInFileDataBar(data.Title, kkms, cashValues, cardValues, maxValue);

    SendPic(data.SenderID, inFileData, function (error) {
        if (error) {
            // ОТПРАВИМ Ошибочный СТАТУС ВЫПОЛНЕНИЯ
            res.status(400).send({ status: 'Ошибка при отправке картинки графика' });
        }

        // ОТПРАВИМ УСПЕШНЫЙ СТАТУС ВЫПОЛНЕНИЯ
        res.status(200).send({ status: 'ok' });
    });

});

app.listen(config.port, function(err) {
  if(err) {
      console.log(err);
  } else {
      console.log('Server work! port ' + config.port);
  }
});


function SendPic(SenderID, inFileData, callback) {
    // запишем файл входящих параметров
    var inFileName = SenderID+'.json';
    var picFileName = SenderID+'.png';
    fs.writeFileSync(inFileName, JSON.stringify(inFileData));
    var childArgs = [
        './exporter/highcharts-convert.js',
        '-infile', inFileName,
        '-outfile', picFileName,
        '-width', '800' ];

    // запустим конвертер
    childProcess.execFile(phantom.path, childArgs, null, function(error, stdout, stderr) {
        if (error) {
            console.log(error);
            callback(error);
        }

        // отправляем файл
        bot.sendPhoto(SenderID, picFileName, {title: 'Выручка по кассам'})
            .then(function(resp) {
                console.log("Pic was successfully sent!");
                console.log("Delete temporary files...");
                fs.unlinkSync('./' + picFileName);
                fs.unlinkSync('./' + inFileName);
                callback();
            });
    });
}

function GetInFileDataBar(title, kkms, cashValues, cardValues, maxValue) {
    return  {
        "chart": {
            "type": "bar"
        },
        "title": {
            "text": title
        },
        "xAxis": {
            "categories": kkms
        },
        "yAxis": {
            "min": 0,
            "max": maxValue,
            "title": {
                "text": "Сумма рублей"
            },
            "stackLabels": {
                "enabled": true,
                "style": {
                    "fontWeight": "bold",
                    "color": "(Highcharts.theme && Highcharts.theme.textColor) || gray"
                }
            }
        },
        "legend": {
            "reversed": true
        },
        "plotOptions": {
            "series": {
                "stacking": "normal",
                "dataLabels": {
                    "enabled": true,
                    "align": "right",
                    "x": -10,
                    "style": {
                        "fontSize": "10px",
                        "fontFamily": "Verdana, sans-serif"
                    }
                }
            }
        },
        "series": [{
            "name": "Картой",
            "data": cardValues
        },
        {
            "name": "Наличными",
            "data": cashValues
        }]
    };
} // GetInFileDataBar

function uniqueVal(value, index, self) {
    return self.indexOf(value) === index;
}
