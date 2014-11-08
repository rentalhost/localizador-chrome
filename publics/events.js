// Abre a página da extensão.
chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.create({ "url": "extension.html" });
});

// Gerenciador de mensagens.
chrome.runtime.onMessage.addListener(function(message, sender, responseCallback) {
    // Obtém os dados dos Tracker.
    if(message.action === "events.getTrackerEvents") {
        // Solicita as informações do servidor.
        jQuery.ajax("http://websro.correios.com.br/sro_bin/sroii_xml.eventos", {
            "dataType": "xml",
            "data": {
                "usuario"  : "ECT",
                "senha"    : "SRO",
                "tipo"     : "L",
                "resultado": "T",
                "objetos"  : message.tracker
            }
        }).success(function(tracker_xml) {
            Trackers.compile(tracker_xml, message.tracker, function(tracker_response) {
                chrome.runtime.sendMessage("", {
                    "action" : "extension.setTrackerEvents",
                    "tracker": message.tracker,
                    "success": true,
                    "data"   : tracker_response,
                });
            });
        }).error(function() {
            chrome.runtime.sendMessage("", {
                "action" : "extension.setTrackerEvents",
                "tracker": message.tracker,
                "success": false,
            });
        });

        return true;
    }
});