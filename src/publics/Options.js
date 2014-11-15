// Gerenciador de opções.
Options = new function() {
    var self = this;

    // Obtém uma opção.
    this.get = function(option_name, callback) {
        chrome.storage.local.get(option_name, function(items) {
            callback.call(this, items[option_name]);
        });
    };

    // Define uma opção.
    this.set = function(option_name, option_value, callback) {
        var options_keys = {};
        options_keys[option_name] = option_value;

        chrome.storage.local.set(options_keys, callback);
    };

    // Atualiza uma opção.
    this.update = function(option_name, callback_reconfigure, callback_after) {
        self.get(option_name, function(option_value) {
            self.set(option_name, callback_reconfigure(option_value), callback_after);
        });
    };
};