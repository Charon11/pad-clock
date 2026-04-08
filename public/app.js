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
        newsRssUrl: 'https://www.franceinfo.fr/titres.rss',
        newsApiBase: 'https://api.rss2json.com/v1/api.json',
        newsCount: 8,

        /* Intervalles de rafraîchissement (ms) */
        weatherRefreshMs: 30 * 60 * 1000,  /* 30 minutes */
        newsRefreshMs:    15 * 60 * 1000,  /* 15 minutes */
        newsRotateMs:      15 * 1000,       /* rotation toutes les 8 secondes */

        /* Durée max de validité du cache */
        weatherCacheMs: 25 * 60 * 1000,   /* 25 minutes */
        newsCacheMs:    10 * 60 * 1000,   /* 12 minutes */

        /* Clés localStorage */
        cacheKeyWeather: 'cpw_weather',
        cacheKeyNews:    'cpw_news',
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
    /* CACHE localStorage                                                   */
    /* ------------------------------------------------------------------ */
    function saveCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (e) { /* navigation privée ou stockage plein */ }
    }

    /* Retourne les données si elles sont dans la fenêtre maxAgeMs, sinon null */
    function loadCache(key, maxAgeMs) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            var entry = JSON.parse(raw);
            if (Date.now() - entry.ts <= maxAgeMs) return entry.data;
            return null;
        } catch (e) { return null; }
    }

    /* Retourne les données même périmées (pour fallback hors-ligne) */
    function loadCacheStale(key) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw).data;
        } catch (e) { return null; }
    }

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
            if (onError) onError('Timeout'); };
        req.onerror = function () {
            if (onError) onError('Erreur réseau');
        };
        req.send();
    }

    function getWeatherInfo(code) {
        if (WEATHER_CODES[code]) return WEATHER_CODES[code];
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

            el('hh').textContent = pad2(h);
            el('mm').textContent = pad2(m);
            el('ss').textContent = pad2(s);

            el('clock-date').textContent =
                JOURS[dow] + ' ' + pad2(day) + ' ' + MOIS[mon] + ' ' + year;

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

            /* Afficher le cache immédiatement pendant que la géoloc tourne */
            var cached = loadCacheStale(CONFIG.cacheKeyWeather);
            if (cached) Weather.render(cached, true);

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

            setInterval(function () { self.fetch(); }, CONFIG.weatherRefreshMs);
        },

        fetch: function () {
            /* Cache frais → pas besoin d'appeler l'API */
            var cached = loadCache(CONFIG.cacheKeyWeather, CONFIG.weatherCacheMs);
            if (cached) {
                Weather.render(cached, false);
                return;
            }

            /* Proxy Firebase Function : le device appelle uniquement Firebase
               (cert Google, reconnu même par les très anciens Android).
               La Function contacte Open-Meteo côté serveur. */
            var url = '/api/weather?lat=' + this.lat + '&lon=' + this.lon;

            xhr(url, function (data) {
                if (data && data.current) {
                    var now = new Date();
                    var payload = {
                        code: data.current.weather_code,
                        temp: Math.round(data.current.temperature_2m),
                        wind: Math.round(data.current.wind_speed_10m),
                        hum:  data.current.relative_humidity_2m,
                        time: formatTime(now.getHours(), now.getMinutes())
                    };
                    saveCache(CONFIG.cacheKeyWeather, payload);
                    Weather.render(payload, false);
                }
            }, function (err) {
                /* Réseau indisponible → afficher cache périmé si existant */
                var stale = loadCacheStale(CONFIG.cacheKeyWeather);
                if (stale) {
                    Weather.render(stale, true);
                } else {
                    el('weather-condition').textContent = 'Indisponible';
                    el('weather-condition').className = 'error-text';
                }
                console.warn('Météo erreur:', err);
            });
        },

        render: function (d, stale) {
            var info = getWeatherInfo(d.code);
            el('weather-icon').textContent      = info.icon;
            el('weather-temp').textContent      = d.temp + '°C';
            el('weather-condition').textContent = info.desc;
            el('weather-condition').className   = '';
            el('weather-wind').textContent      = 'Vent: ' + d.wind + ' km/h';
            el('weather-humidity').textContent  = 'Humidité: ' + d.hum + '%';
            el('weather-update').textContent    =
                'MAJ: ' + d.time + (stale ? ' [CACHE]' : '');
        }
    };

    /* ------------------------------------------------------------------ */
    /* MODULE ACTUALITÉS                                                    */
    /* ------------------------------------------------------------------ */
    var News = {
        items: [],
        index: 0,
        rotateTimer: null,

        init: function () {
            /* Afficher le cache immédiatement */
            var cached = loadCacheStale(CONFIG.cacheKeyNews);
            if (cached && cached.length) {
                News.store(cached);
            }
            this.fetch();
            var self = this;
            setInterval(function () { self.fetch(); }, CONFIG.newsRefreshMs);
        },

        fetch: function () {
            /* Cache frais → rotation continue sans appel réseau */
            var cached = loadCache(CONFIG.cacheKeyNews, CONFIG.newsCacheMs);
            if (cached && cached.length) {
                News.store(cached);
                return;
            }

            var rssEncoded = encodeURIComponent(CONFIG.newsRssUrl);
            var url = CONFIG.newsApiBase +
                '?rss_url=' + rssEncoded;

            xhr(url, function (data) {
                if (data && data.status === 'ok' && data.items && data.items.length) {
                    var titles = [];
                    for (var i = 0; i < data.items.length; i++) {
                        titles.push(data.items[i].title || '');
                    }
                    saveCache(CONFIG.cacheKeyNews, titles);
                    News.store(titles);
                } else {
                    News.fallback();
                }
            }, function (err) {
                /* Réseau indisponible → cache périmé */
                var stale = loadCacheStale(CONFIG.cacheKeyNews);
                if (stale && stale.length) {
                    News.store(stale);
                } else {
                    News.fallback();
                }
                console.warn('News erreur:', err);
            });
        },

        store: function (titles) {
            News.items = titles;
            News.index = 0;
            News.render();
            News.startRotation();

            var now = new Date();
            el('news-update').textContent =
                'MAJ: ' + formatTime(now.getHours(), now.getMinutes());
        },

        render: function () {
            var list = el('news-list');
            var total = News.items.length;
            if (!total) return;

            /* Vider proprement sans innerHTML = '' pour éviter les layouts */
            while (list.firstChild) {
                list.removeChild(list.firstChild);
            }

            for (var i = 0; i < 3; i++) {
                var idx   = (News.index + i) % total;
                var title = News.items[idx];
                var li    = document.createElement('li');
                li.className = 'news-item' + (i === 0 ? ' news-active' : '');
                li.textContent = title;   /* textContent = sécurisé (pas d'injection HTML) */
                list.appendChild(li);
            }
        },

        startRotation: function () {
            if (News.rotateTimer) clearInterval(News.rotateTimer);
            News.rotateTimer = setInterval(function () {
                News.index = (News.index + 1) % Math.max(1, News.items.length);
                News.render();
            }, CONFIG.newsRotateMs);
        },

        fallback: function () {
            var list = el('news-list');
            while (list.firstChild) list.removeChild(list.firstChild);
            var li = document.createElement('li');
            li.className = 'news-item error-text';
            li.textContent = 'Actualités indisponibles';
            list.appendChild(li);
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
