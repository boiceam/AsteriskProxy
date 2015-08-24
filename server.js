var asterisk = require('./asterisk');
var configuration = require('./configuration');
var express = require('express');
var app = express();

var ASTERISK_AMI_HOST = configuration.asteriskAmiHttpHost;
var ASTERISK_AMI_USERNAME = configuration.asteriskAmiUsername;
var ASTERISK_AMI_PASSWORD = configuration.asteriskAmiPassword;
var ASTERISK_AMI_PORT = configuration.asteriskAmiHttpPort;
var ASTERISK_AMI_REFRESH = configuration.refreshInterval;
var ASTERISK_PROXY_PORT = configuration.proxyPort;


app.get('/', function (req, res) {
    res.send('AsteriskProxy Active');
});

app.get('/all/', function (req, res) {
    res.json(asteriskClient.data);
});

app.get('/channels/', function (req, res) {
    res.json(asteriskClient.data.channels);
});

app.get('/parked/', function (req, res) {
    res.json(asteriskClient.data.parked);
});

app.get('/queueStatus/', function (req, res) {
    res.json(asteriskClient.data.queueStatus);
});

app.get('/queueSummary/', function (req, res) {
    res.json(asteriskClient.data.queueSummary);
});

var server = app.listen(ASTERISK_PROXY_PORT, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('AsteriskProxy listening at http://%s:%s', host, port);
});

console.log('Starting Asterisk AMI client process.');
var asteriskClient = asterisk();
asteriskClient.start(ASTERISK_AMI_HOST, ASTERISK_AMI_PORT, ASTERISK_AMI_USERNAME,
    ASTERISK_AMI_PASSWORD, ASTERISK_AMI_REFRESH);
