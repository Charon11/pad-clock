/* ============================================================
   PAD-CLOCK — app.js
   Compatible: iOS 9 Safari / Android 5+ Chrome
   XHR uniquement (pas de fetch), pas d'ES6 modules
   ============================================================ */

(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /* CONFIGURATION                                                        */
    /* ------------------------------------------------------------------ */
    var CONFIG = {
        /* Coordonnées par défaut si la géolocalisation échoue */
        defaultLat: 49.3558,
        defaultLon: 6.1693,
        defaultCity: 'Thionville',

        /* Flux RSS via rss2json (sans clé = plan gratuit, ~10k req/mois) */
        newsRssUrl: 'https://ici.radio-canada.ca/rss/4159',
        newsApiBase: 'https://api.rss2json.com/v1/api.json',
        newsCount: 8,

        /* Intervalles de rafraîchissement (ms) */
        weatherRefreshMs: 30 * 60 * 1000,   /* 30 minutes */
        newsRefreshMs:    15 * 60 * 1000,    /* 15 minutes */
    };

    /* ------------------------------------------------------------------ */
    /* DONNÉES LOCALES FR                                                   */
    /* ------------------------------------------------------------------ */
    var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    var MOIS  = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    /* Codes météo WMO → icône + description FR */
    var WEATHER_CODES = {
        0:  { icon: '☀',  desc: 'Dégagé' },
        1:  { icon: '🌤', desc: 'Peu nuageux' },
        2:  { icon: '⛅', desc: 'Partiellement nuageux' },
        3:  { icon: '☁',  desc: 'Couvert' },
        45: { icon: '🌫', desc: 'Brouillard' },
        48: { icon: '🌫', desc: 'Brouillard givrant' },
        51: { icon: '🌦', desc: 'Bruine légère' },
        53: { icon: '🌦', desc: 'Bruine' },
        55: { icon: '🌧', desc: 'Bruine forte' },
        61: { icon: '🌧', desc: 'Pluie légère' },
        63: { icon: '🌧', desc: 'Pluie' },
        65: { icon: '🌧', desc: 'Pluie forte' },
        66: { icon: '🌧', desc: 'Pluie verglaçante' },
        67: { icon: '🌧', desc: 'Pluie verglaçante forte' },
        71: { icon: '❄',  desc: 'Neige légère' },
        73: { icon: '❄',  desc: 'Neige' },
        75: { icon: '❄',  desc: 'Neige forte' },
        77: { icon: '❄',  desc: 'Grésil' },
        80: { icon: '🌦', desc: 'Averses légères' },
        81: { icon: '🌦', desc: 'Averses' },
        82: { icon: '🌧', desc: 'Averses fortes' },
        85: { icon: '❄',  desc: 'Averses de neige' },
        86: { icon: '❄',  desc: 'Averses de neige forte' },
        95: { icon: '⛈',  desc: 'Orage' },
        96: { icon: '⛈',  desc: 'Orage avec grêle' },
        99: { icon: '⛈',  desc: 'Orage violent' }
    };

    /* ------------------------------------------------------------------ */
    /* UTILITAIRES                                                          */
    /* ------------------------------------------------------------------ */
    function pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function el(id) {
        return document.getElementById(id);
    }

    function formatTime(h, m) {
        return pad2(h) + ':' + pad2(m);
    }

    function xhr(url, onSuccess, onError) {
        var req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.timeout = 10000;
        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    try {
                        var data = JSON.parse(req.responseText);
                        onSuccess(data);
                    } catch (e) {
                        if (onError) onError('JSON invalide');
                    }
                } else {
                    if (onError) onError('HTTP ' + req.status);
                }
            }
        };
        req.ontimeout = function () {
            if (onError) onError('Timeout');
        };
        req.onerror = function () {
            if (onError) onError('Erreur réseau');
        };
        req.send();
    }

    function getWeatherInfo(code) {
        if (WEATHER_CODES[code]) return WEATHER_CODES[code];
        /* Cherche la correspondance la plus proche */
        var keys = [95, 86, 85, 82, 81, 80, 77, 75, 73, 71, 67, 66, 65, 63, 61,
                    55, 53, 51, 48, 45, 3, 2, 1, 0];
        for (var i = 0; i < keys.length; i++) {
            if (code >= keys[i]) return WEATHER_CODES[keys[i]];
        }
        return { icon: '~', desc: 'Inconnu' };
    }

    /* ------------------------------------------------------------------ */
    /* MODULE HORLOGE                                                       */
    /* ------------------------------------------------------------------ */
    var Clock = {
        init: function () {
            this.tick();
            setInterval(function () { Clock.tick(); }, 1000);
        },

        tick: function () {
            var now  = new Date();
            var h    = now.getHours();
            var m    = now.getMinutes();
            var s    = now.getSeconds();
            var dow  = now.getDay();
            var day  = now.getDate();
            var mon  = now.getMonth();
            var year = now.getFullYear();

            /* Temps */
            el('hh').textContent = pad2(h);
            el('mm').textContent = pad2(m);
            el('ss').textContent = pad2(s);

            /* Date complète */
            el('clock-date').textContent =
                JOURS[dow] + ' ' + pad2(day) + ' ' + MOIS[mon] + ' ' + year;

            /* Barre de statut : date courte */
            el('date-short').textContent =
                pad2(day) + '/' + pad2(mon + 1) + '/' + year +
                '  ' + pad2(h) + ':' + pad2(m);
        }
    };

    /* ------------------------------------------------------------------ */
    /* MODULE MÉTÉO                                                         */
    /* ------------------------------------------------------------------ */
    var Weather = {
        lat: CONFIG.defaultLat,
        lon: CONFIG.defaultLon,
        city: CONFIG.defaultCity,

        init: function () {
            var self = this;
            el('sys-status').textContent = 'SYS: ONLINE';

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function (pos) {
                        self.lat  = pos.coords.latitude;
                        self.lon  = pos.coords.longitude;
                        self.city = 'GPS';
                        el('location-display').textContent = 'LOC: GPS';
                        self.fetch();
                    },
                    function () {
                        /* Fallback sur Thionville */
                        el('location-display').textContent =
                            'LOC: ' + CONFIG.defaultCity.toUpperCase();
                        self.fetch();
                    },
                    { timeout: 8000, maximumAge: 300000 }
                );
            } else {
                el('location-display').textContent =
                    'LOC: ' + CONFIG.defaultCity.toUpperCase();
                this.fetch();
            }

            /* Rafraîchissement périodique */
            setInterval(function () { self.fetch(); }, CONFIG.weatherRefreshMs);
        },

        fetch: function () {
            var url = 'https://api.open-meteo.com/v1/forecast' +
                '?latitude='  + this.lat +
                '&longitude=' + this.lon +
                '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
                '&wind_speed_unit=kmh' +
                '&timezone=auto';

            xhr(url, function (data) {
                if (data && data.current) {
                    Weather.update(data.current);
                }
            }, function (err) {
                el('weather-condition').textContent = 'Indisponible';
                el('weather-condition').className = 'error-text';
                console.warn('Météo erreur:', err);
            });
        },

        update: function (cur) {
            var info = getWeatherInfo(cur.weather_code);
            var temp = Math.round(cur.temperature_2m);
            var wind = Math.round(cur.wind_speed_10m);
            var hum  = cur.relative_humidity_2m;
            var now  = new Date();

            el('weather-icon').textContent      = info.icon;
            el('weather-temp').textContent      = temp + '°C';
            el('weather-condition').textContent = info.desc;
            el('weather-condition').className   = '';
            el('weather-wind').textContent      = 'Vent: ' + wind + ' km/h';
            el('weather-humidity').textContent  = 'Humidité: ' + hum + '%';
            el('weather-update').textContent    = 'MAJ: ' + formatTime(now.getHours(), now.getMinutes());
        }
    };

    /* ------------------------------------------------------------------ */
    /* MODULE ACTUALITÉS                                                    */
    /* ------------------------------------------------------------------ */
    var News = {
        init: function () {
            this.fetch();
            var self = this;
            setInterval(function () { self.fetch(); }, CONFIG.newsRefreshMs);
        },

        fetch: function () {
            var rssEncoded = encodeURIComponent(CONFIG.newsRssUrl);
            var url = CONFIG.newsApiBase +
                '?rss_url=' + rssEncoded +
                '&count='   + CONFIG.newsCount;

            xhr(url, function (data) {
                if (data && data.status === 'ok' && data.items && data.items.length) {
                    News.update(data.items);
                } else {
                    News.showError('Flux indisponible');
                }
            }, function (err) {
                News.showError('Actualités indisponibles');
                console.warn('News erreur:', err);
            });
        },

        update: function (items) {
            var list = el('news-list');
            var html = '';
            for (var i = 0; i < items.length && i < CONFIG.newsCount; i++) {
                var title = items[i].title || '';
                /* Échapper les caractères HTML */
                title = title
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                html += '<li class="news-item">' + title + '</li>';
            }
            list.innerHTML = html;

            var now = new Date();
            el('news-update').textContent =
                'MAJ: ' + formatTime(now.getHours(), now.getMinutes());
        },

        showError: function (msg) {
            el('news-list').innerHTML =
                '<li class="news-item error-text">' + msg + '</li>';
        }
    };

    /* ------------------------------------------------------------------ */
    /* DÉMARRAGE                                                            */
    /* ------------------------------------------------------------------ */
    function init() {
        Clock.init();
        Weather.init();
        News.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
