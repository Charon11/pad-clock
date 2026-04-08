/* ============================================================
   PAD-CLOCK — functions/index.js
   Proxy météo server-side : contourne les erreurs SSL sur
   les anciens Android (ex. Nexus 7) qui ne font pas confiance
   aux certificats Let's Encrypt (ISRG Root X1).
   Le device contacte Firebase (cert Google, toujours valide),
   et c'est ce serveur qui appelle api.open-meteo.com.
   ============================================================ */

'use strict';

const functions = require('firebase-functions');
const https     = require('https');

exports.weather = functions.https.onRequest(function (req, res) {
    /* CORS : l'app peut être servie depuis n'importe quel sous-domaine Firebase */
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300'); /* 5 min */

    var lat = parseFloat(req.query.lat) || 49.3558;
    var lon = parseFloat(req.query.lon) || 6.1693;

    /* Validation basique pour éviter l'injection dans l'URL */
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        res.status(400).json({ error: 'Coordonnées invalides' });
        return;
    }

    var path = '/v1/forecast'
        + '?latitude='  + lat
        + '&longitude=' + lon
        + '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m'
        + '&wind_speed_unit=kmh'
        + '&timezone=auto';

    var options = {
        hostname: 'api.open-meteo.com',
        path:     path,
        method:   'GET',
        timeout:  10000
    };

    var apiReq = https.request(options, function (apiRes) {
        var body = '';
        apiRes.on('data', function (chunk) { body += chunk; });
        apiRes.on('end', function () {
            res.set('Content-Type', 'application/json');
            res.status(apiRes.statusCode).send(body);
        });
    });

    apiReq.on('timeout', function () {
        apiReq.destroy();
        res.status(504).json({ error: 'Timeout Open-Meteo' });
    });

    apiReq.on('error', function (err) {
        res.status(502).json({ error: err.message });
    });

    apiReq.end();
});
