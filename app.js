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


app.post('/ut12', function(req, res) {

    console.log('===========');
    console.log(req.body);
    console.log('===========');

    var data = req.body;
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
    maxValue = maxValue + maxValue*0.15;

    var opts = { parse_mode: 'Markdown' };
    bot.sendMessage(data.SenderID, myText, opts);

    // ПОДГОТОВИМ И ОТПРАВИМ ГРАФИК
    var inFileData = GetInFileBarChartHorizontal(data.Title, kkms, cashValues, cardValues, maxValue);

    SendPic(data.SenderID, inFileData, 800, function (error) {
        if (error) {
            // ОТПРАВИМ Ошибочный СТАТУС ВЫПОЛНЕНИЯ
            res.status(400).send({ status: 'Ошибка при отправке картинки графика' });
        }

        // ОТПРАВИМ УСПЕШНЫЙ СТАТУС ВЫПОЛНЕНИЯ
        res.status(200).send({ status: 'ok' });
    });

});

app.post('/ut3', function(req, res) {

    console.log('===========');
    console.log(req.body);
    console.log('===========');

    var data = req.body;

    // ПОДГОТОВИМ И ОТПРАВИМ ГРАФИК
    var inFileData = GetInFileAreaChart(data.Title, data.SubTitle, data.dates, data.series);

    SendPic(data.SenderID, inFileData, 950, function (error) {
        if (error) {
            // ОТПРАВИМ Ошибочный СТАТУС ВЫПОЛНЕНИЯ
            res.status(400).send({ status: 'Ошибка при отправке картинки графика' });
        }

        // ОТПРАВИМ УСПЕШНЫЙ СТАТУС ВЫПОЛНЕНИЯ
        res.status(200).send({ status: 'ok' });
    });

});

app.post('/ut4', function(req, res) {

    console.log('===========');
    console.log(req.body);
    console.log('===========');

    var data = req.body;

    // ПОДГОТОВИМ И ОТПРАВИМ ГРАФИК
    var inFileData = GetInFileBarChartVertical(data.Title, data.SubTitle, data.dates, data.series);

    SendPic(data.SenderID, inFileData, 950, function (error) {
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


function SendPic(SenderID, inFileData, width, callback) {
    // запишем файл входящих параметров
    var inFileName = SenderID+'.json';
    var picFileName = SenderID+'.png';
    fs.writeFileSync(inFileName, JSON.stringify(inFileData));
    var childArgs = [
        './exporter/highcharts-convert.js',
        '-infile', inFileName,
        '-outfile', picFileName,
        '-width', width ];

    // запустим конвертер
    childProcess.execFile(phantom.path, childArgs, null, function(error, stdout, stderr) {
        if (error) {
            console.log('Error highcharts converting!');
            console.log(error);
            callback(error);
        }

        // отправляем файл
        bot.sendPhoto(SenderID, picFileName, {title: 'График'})
            .then(function(resp) {
                console.log("Pic was successfully sent!");
                console.log("Delete temporary files...");
                fs.unlinkSync('./' + picFileName);
                fs.unlinkSync('./' + inFileName);
                callback();
            });
    });
}

function GetInFileAreaChart(title, subtitle, dates, series) {
    return {
        "chart": { "type": 'area' }, //, "height": 500 },
        "title": { "text": title },
        "subtitle": { "text": subtitle },
        "xAxis": {
            "categories": dates,
            "title": { "enabled": false },
            "labels": {
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold"
                }
            }
        },
        "yAxis": {
            "title": {
                "text": 'Сумма рублей',
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold"
                }
            },
            "labels": {
                "enabled": false,
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold"
                }
            },
            "stackLabels": {
                "enabled": true,
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold",
                    "color": "(Highcharts.theme && Highcharts.theme.textColor) || 'gray'"
                }
            }
        },

        "plotOptions": {
            "area": {
                "stacking": 'normal'
                // включение отображения внутр.значений
                // "dataLabels": {
                //     "enabled": true,
                //     "style": {
                //         "fontSize": "8px",
                //         "fontWeight": "bold"
                //     }
                // }
            }
        },
        "legend": {
            "itemStyle": {
                 "fontSize":'9px',
                 "fontWeight": "normal"
              }
        },
        "series": series
    };

} // GetInFileAreaChart

function GetInFileBarChartVertical(title, subtitle, dates, series) {
    return {
        "chart": { "type": 'column' }, //, "height": 500 },
        "title": { "text": title },
        "subtitle": { "text": subtitle },
        "xAxis": {
            "categories": dates,
            "title": { "enabled": false },
            "labels": {
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold"
                }
            }
        },
        "yAxis": {
            "title": {
                "text": 'Сумма тыс.рублей',
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold"
                }
            },
            "labels": {
                "enabled": false,
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold"
                }
            },
            "stackLabels": {
                "enabled": true,
                "style": {
                    "fontSize": "8px",
                    "fontWeight": "bold",
                    "color": "(Highcharts.theme && Highcharts.theme.textColor) || 'gray'"
                }
            }
        },

        "plotOptions": {
            "column": {
                "stacking": 'normal',
                "dataLabels": {
                    "enabled": true,
                    "style": {
                        "fontSize": "8px",
                        "fontWeight": "bold"
                    }
                }
            }
        },
        "legend": {
            "itemStyle": {
                 "fontSize":'9px',
                 "fontWeight": "normal"
              }
        },
        "series": series
    };

} // GetInFileBarChartVertical


function GetInFileBarChartHorizontal(title, kkms, cashValues, cardValues, maxValue) {
    return  {
        "chart": {
            "type": "bar"
        },
        "title": {
            "text": title
        },
        "xAxis": {
            "categories": kkms,
            "labels": {
                "style": {
                    "fontSize": "10px"
                }
            }
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
                    "fontSize": "10px",
                    "fontWeight": "bold",
                    "color": "(Highcharts.theme && Highcharts.theme.textColor) || 'gray'"
                }
            }
        },
        "legend": {
            "reversed": true
        },
        "plotOptions": {
             "series": {
                 "stacking": "normal"
             }
         },
        // включение отображения внутр.значений
        // "plotOptions": {
        //     "series": {
        //         "stacking": "normal",
        //         "dataLabels": {
        //             "enabled": true,
        //             "align": "right",
        //             "x": -10,
        //             "style": {
        //                 "fontSize": "10px",
        //                 "fontFamily": "Verdana, sans-serif"
        //             }
        //         }
        //     }
        // },
        "series": [{
            "name": "Картой",
            "data": cardValues
        },
        {
            "name": "Наличными",
            "data": cashValues
        }]
    };
} // GetInFileBarChartHorizontal

function uniqueVal(value, index, self) {
    return self.indexOf(value) === index;
}
