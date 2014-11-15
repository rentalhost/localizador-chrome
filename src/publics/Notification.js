// Copia o manifest do Chrome.
var chrome_manifest  = chrome.runtime.getManifest();

// Armazena uma função vazia.
var noop = function() { /** ... */ };

// Controlador de Notificações.
var Notification = function(options) {
    var self = this;

    // Armazena as opções originais.
    var original_options;

    // Indica se a notificação já foi lançada.
    var notification_created = false;

    // Definições padrões.
    options.id           = options.id          || (++Notification.count).toString();
    options.type         = options.type        || "basic";
    options.title        = options.title       || chrome_manifest.name;
    options.iconUrl      = options.iconUrl     || chrome_manifest.icons["80"];
    options.isClickable  = options.isClickable || !!options["callback.clicked"];
    options.waitActivity = options.waitActivity !== false;
    original_options     = Utils.duplicateObject(options);

    // Remove alguns dados de opções.
    delete options["id"];
    delete options["callback.button0"];
    delete options["callback.button1"];
    delete options["callback.clicked"];
    delete options["callback.closed"];
    delete options["waitActivity"];

    // Lança a notificação.
    this.create = function() {
        // Impede de a notificação ser lançada mais de uma vez.
        if(notification_created) {
            return;
        }

        // Lança a notificação.
        notification_created = true;
        chrome.notifications.create(original_options.id, options, noop);
    }

    // Limpa a notificação.
    this.clear = function(callback) {
        delete Notification.notifications[original_options.id];
        chrome.notifications.clear(original_options.id, callback || noop);
    };

    // Lança um evento da notificação.
    this.trigger = function(type, args) {
        // Se não houver um callback para o tipo definido, ignora.
        if(!original_options[type]) {
            return;
        }

        // Se o callback foi definido, mas é uma string,
        // reinicia o lançamento com o evento definido na string.
        if(typeof original_options[type] === "string") {
            this.trigger.call(this, original_options[type], args);
            return;
        }

        // Finalmente executa o callback definido.
        original_options[type].apply(this, args);
    };

    // Armazena a notificação.
    Notification.notifications[original_options.id] = self;

    // Lança a exceção imediatamente caso não precise esperar atividade.
    // Ou caso já exista atividade.
    if(original_options.waitActivity === false
    || Notification.activity === "active") {
        this.create();
    }
};

// Armazena o número da notificação.
Notification.count = 0;

// Armazena todas as notificações geradas.
Notification.notifications = {};

// Armazena a atividade do usuário.
Notification.activity = "active";

// Cria uma nova notificação.
Notification.create = function(options) {
    return new Notification(options);
};

// Inicia um evento.
Notification.triggerHandler = function(id_notification, type, args) {
    var notification = Notification.notifications[id_notification];
    if(notification) {
        notification.trigger(type, args);
        notification.clear();
    }
};

// Inicia o envio de notificações após atividade.
Notification.activityHandler = function(state) {
    Notification.activity = state;
    if(state === "active") {
        Object.keys(Notification.notifications).forEach(function(key) {
            Notification.notifications[key].create();
        });
    }
};

// Controla os eventos de botões.
chrome.notifications.onButtonClicked.addListener(function(id_notification, button_index) {
    Notification.triggerHandler(id_notification, "callback.button" + button_index, [ button_index ]);
});

// Controla os eventos de clique.
chrome.notifications.onClicked.addListener(function(id_notification) {
    Notification.triggerHandler(id_notification, "callback.clicked");
});

// Controla os eventos de fechamento.
chrome.notifications.onClosed.addListener(function(id_notification, event_by_user) {
    Notification.triggerHandler(id_notification, "callback.closed", [ event_by_user ]);
});

// Controle de atividade do usuário.
chrome.idle.onStateChanged.addListener(function(state) {
    Notification.activityHandler(state);
});