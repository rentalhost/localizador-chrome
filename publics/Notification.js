// Helper de Notificações.
var Notification = new function() {
    // Armazena as opções originais.
    var original_options = {};

    // Clona um objeto.
    function object_clone(object) {
        var object_copy = object.constructor();

        for(var object_attr in object) {
            if(object.hasOwnProperty(object_attr)) {
                object_copy[object_attr] = object[object_attr];
            }
        }

        return object_copy;
    };

    // Cria uma nova notificação.
    this.create = function(options) {
        // Definições padrões.
        options.type        = options.type        || "basic";
        options.title       = options.title       || chrome.runtime.getManifest().name;
        options.iconUrl     = options.iconUrl     || "publics/images/icon-tracker-default.png";
        options.isClickable = options.isClickable || !!options["callback.clicked"];

        // Armazena as opções originais.
        original_options = object_clone(options);

        // Remove alguns dados de opções.
        delete options["id"];
        delete options["callback.button0"];
        delete options["callback.button1"];
        delete options["callback.clicked"];
        delete options["callback.closed"];

        // Define o ID da Notificação.
        original_options.id = original_options.id || "";

        // Exibe uma notificação..
        this.clear(function() {
            chrome.notifications.create(original_options.id, options, function(create_notification_id) {
                original_options.id = create_notification_id;
            });
        });
    };

    // Limpa a última notificação.
    this.clear = function(callback) {
        if(original_options.id) {
            callback = callback || function() {};
            chrome.notifications.clear(original_options.id, callback);
            return;
        }

        callback(false);
    };

    // Ativa um callback.
    var callback_trigger = function(notification_id, callback_type, callback_args) {
        if(original_options.id === notification_id) {
            // Cancela a ativação se um callback não foi informado.
            var callback_function = original_options[callback_type];
            if(!callback_function) {
                return;
            }

            // Se o callback refere-se a uma string, a traduz.
            if(typeof callback_function === "string") {
                this.clear();
                return callback_trigger.apply(this, [ notification_id, callback_function, callback_args ]);
            }

            // Caso contrário, finalmente chama o callback.
            callback_function.apply(this, callback_args);
        }
    };

    // Controla os botões.
    chrome.notifications.onButtonClicked.addListener(function(event_notification_id, event_button_index) {
        callback_trigger(event_notification_id, "callback.button" + event_button_index, [ event_button_index ]);
    });

    // Controla o clique.
    chrome.notifications.onClicked.addListener(function(event_notification_id) {
        callback_trigger(event_notification_id, "callback.clicked");
    });

    // Controla o fechamento.
    chrome.notifications.onClosed.addListener(function(event_notification_id, event_by_user) {
        callback_trigger(event_notification_id, "callback.closed", [ event_by_user ]);
    });
};
