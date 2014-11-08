// Utilitários.
Utils = new function() {
    // Títulos que devem ser mantidos como o original.
    var names_uppercase = [ "AC", "ACF", "AGF", "CDD", "CEE", "CTC", "CTCE", "CTCI",
                            "CTE", "SEI", "CTO", "RFB" ],
        names_uppercase_regex = new RegExp("\\b(" + names_uppercase.join("|") + ")\\b", "gi");

    // Mapeia todos os campos com name em um objeto.
    this.fieldsMapper = function(where, attr) {
        var mapper = {},
            attr   = attr || "name";

        $("[" + attr + "]", where).each(function() {
            mapper[this.getAttribute(attr)] = this;
        });

        return mapper;
    };

    // Corrige um nome.
    this.fixName = function(name) {
        return (name || "").trim().toLowerCase()
            .replace(/^([a-z])|\s+([a-z])/g, function(name_word) { return name_word.toUpperCase(); })
            .replace(/[^^]\b(\w{2})\b/g, function(name_word, n, index) { return name_word.toLowerCase(); })
            .replace(names_uppercase_regex, function(name_word) { return name_word.toUpperCase();; });
    };

    // Converte data e hora em Timestamp.
    this.toTimestamp = function(tracker_event) {
        // Em caso de erro, retorna o Timestamp atual.
        if(tracker_event.type === "ER") {
            return Date.now();
        }

        // Caso contrário, retorna o Timestamp.
        var date_reformat = tracker_event.date.split("/"),
            time_reformat = tracker_event.time.split(":");

        return (new Date(date_reformat[2], date_reformat[1], date_reformat[0], time_reformat[0], time_reformat[1])).getTime();
    };

    // Converte XML para JSON.
    this.xmlMapper = function(xml) {
        // Se não houver children, retorna o textContent.
        if(xml.children.length === 0) {
            return xml.textContent.trim();
        }

        // Caso contrário, gera a lista.
        var children = {};
        for(var i in xml.children) {
            if(isFinite(i)) {
                var xml_children = xml.children[i],
                    xml_name     = xml_children.localName;

                // Se não existir, cria um array para o objeto.
                if(!children[xml_name]) {
                    children[xml_name] = [];
                }

                children[xml_name].push(this.xmlMapper(xml_children));
            }
        }

        // Retorna o resultado.
        return children;
    };
};