// Controlador de chamadas de Trackers.
var TrackersXHR = new function() {
    // Inicia o processo de requisição.
    this.getTrackersEvents = function(tracker_codes) {
        // Solicita as informações do servidor.
        jQuery.ajax("http://websro.correios.com.br/sro_bin/sroii_xml.eventos", {
            "dataType": "xml",
            "data": {
                "usuario"  : "ECT",
                "senha"    : "SRO",
                "tipo"     : "L",
                "resultado": "T",
                "objetos"  : tracker_codes.join("")
            }
        }).success(function(tracker_xml) {
            Trackers.compile(tracker_xml, tracker_codes, function(trackers_responses) {
                chrome.runtime.sendMessage({
                    "success"  : true,
                    "action"   : "extension.setTrackersEvents",
                    "trackers" : tracker_codes,
                    "responses": trackers_responses,
                });
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
            TrackersXHR.getTrackersEvents(trackers_codes.splice(0, 5));
        }

        return true;
    }
});