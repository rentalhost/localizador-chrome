// Controlador de chamadas de Trackers.
var TrackersXHR = new function() {
    // Inicia o processo de requisição.
    this.getTrackersEvents = function(tracker_codes, options) {
        // Solicita as informações do servidor.
        jQuery.ajax("http://websro.correios.com.br/sro_bin/sroii_xml.eventos", {
            "dataType": "xml",
            "data": {
                "usuario"  : "ECT",
                "senha"    : "SRO",
                "tipo"     : "L",
                "resultado": "T",
                "objetos"  : tracker_codes.join("")
            },
            "timeout": 5000
        }).success(function(tracker_xml) {
            Trackers.compile(tracker_xml, tracker_codes, function(trackers_responses) {
                chrome.runtime.sendMessage({
                    "success"  : true,
                    "action"   : "extension.setTrackersEvents",
                    "trackers" : tracker_codes,
                    "responses": trackers_responses,
                });

                // Lança uma notificação caso haja uma atualização de status.
                if(options.notify === true) {
                    jQuery.each(trackers_responses, function(index, tracker) {
                        // Ignora objetos não localizados ou não atualizados.
                        var tracker_properties = Trackers.getEventProperties(tracker.events[0]);
                        if(tracker.updated !== true
                        || tracker_properties.type === "ER01") {
                            return;
                        }

                        // Gera a notificação.
                        Notification.create({
                            "id"            : tracker.code,
                            "iconUrl"       : "publics/images/icon-tracker-" + (tracker_properties.pole || "neutral") + ".png",
                            "title"         : tracker.title,
                            "message"       : tracker_properties.originalDescription + ".",
                            "contextMessage": tracker_properties.timing,
                        });

                        // Indica que não há mais atualização.
                        tracker.updated = false;
                        Trackers.save(tracker.code, tracker);
                    });
                }
            });
        }).error(function() {
            chrome.runtime.sendMessage({
                "success" : false,
                "action"  : "extension.setTrackersEvents",
                "trackers": tracker_codes,
            });
        });
    }
};

// Abre a página da extensão.
chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.create({ "url": "extension.html" });
});

// Gerenciador de mensagens.
chrome.runtime.onMessage.addListener(function(message, sender, responseCallback) {
    // Obtém os dados dos Tracker.
    if(message.action === "events.getTrackersEvents") {
        var trackers_codes = message.trackers;
        while(trackers_codes.length) {
            TrackersXHR.getTrackersEvents(trackers_codes.splice(0, 5), message);
        }

        return true;
    }
});

// Gerenciador de alarmes.
chrome.alarms.onAlarm.addListener(function(alarm) {
    // Inicia a atualização dos Trackers.
    if(alarm.name === "trackersRefresh") {
        Trackers.getAllCodes(function(tracker_codes) {
            var trackers_refreshables = [],
                trackers_checked      = 0;

            // Analisa todos os códigos em busca dos atualizáveis.
            jQuery.each(tracker_codes, function(index, tracker_code) {
                Trackers.get(tracker_code, function(tracker) {
                    var tracker_properties = Trackers.getEventProperties(tracker.events[0]);
                    trackers_checked++;

                    // Se for atualizável, adiciona à lista.
                    if(tracker_properties.isRefreshable) {
                        trackers_refreshables.push(tracker_code);
                    }

                    // Após finalizar, inicia a atualização.
                    if(trackers_checked === tracker_codes.length) {
                        chrome.runtime.sendMessage({
                            "action"  : "events.getTrackersEvents",
                            "trackers": trackers_refreshables,
                            "notify"  : true
                        });
                    }
                });
            });
        });
    }
});

// Inicia o alarme ao iniciar a extensão.
chrome.alarms.create("trackersRefresh", {
    "delayInMinutes" : 1,
    "periodInMinutes": 30
});