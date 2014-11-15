// Gerenciador de Trackers.
Trackers = new function() {
    // Define as tokens positivas.
    var token_positives = [ "BD01", "BD23", "BD24", "BD35", "BD36", "ID01", "LD01", "LD02",
                            "OE01", "PA15" ];

    // Define as tokens negativas.
    var token_negatives = [ "BD02", "BD03", "BD04", "BD06", "BD07", "BD08", "BD09", "BD10",
                            "BD12", "BD19", "BD20", "BD21", "BD25", "BD26", "BD27", "BD28",
                            "BD31", "BD33", "BD34", "BD40", "BD42", "BD43", "BD44", "BD46",
                            "BD47", "BD48", "BD50", "BD51", "BD52", "BD69", "ER01",
                            "ES01", "FC03", "FC04", "FC06", "FC07", "IE01" ];

    // Define as tokens não atualizáveis.
    var token_unrefreshable = [ "BD01" ];

    // Define as descrições alternativas.
    var token_alternatives = {
        "Objeto encaminhado": "Objeto encaminhado para:",
    };

    // Obtém a localização definida.
    this.parsePlace = function(tracker_place) {
        // Se não existir dados suficientes, não retorna nada.
        if(!tracker_place) {
            return;
        }

        // Se o bairro for definido, adiciona.
        var place_result   = Utils.fixName(tracker_place.place);
        if(tracker_place.district) {
            place_result+= ", " + Utils.fixName(tracker_place.district);
        }

        // Se a cidade foi definida e for diferente da localização, adiciona.
        if(tracker_place.city
        && tracker_place.city !== tracker_place.place) {
            place_result+= " - " + Utils.fixName(tracker_place.city);
        }

        // Se o UF foi definido, adiciona.
        if(tracker_place.UF) {
            place_result+= " / " + tracker_place.UF;
        }

        return place_result;
    };

    // Obtém todas as propriedades de um evento.
    this.getEventProperties = function(tracker_event) {
        // Define o tipo compacto do evento.
        var tracker_type        = tracker_event.type.substr(0, 2) + tracker_event.status,
            tracker_pole        = null,
            tracker_description = token_alternatives[tracker_event.description] || tracker_event.description;

        // Definição do pólo.
        // Localiza uma token positiva.
        if(token_positives.indexOf(tracker_type) !== -1) {
            tracker_pole = "positive";
        }
        else
        // Localiza uma token negativa.
        if(token_negatives.indexOf(tracker_type) !== -1) {
            tracker_pole = "negative";
        }

        // Adiciona um ponto final, se possível.
        if(!tracker_description.match(/\B$/)) {
            tracker_description+= ".";
        }

        // Retorna as propriedades coletadas.
        return {
            "type"               : tracker_type,
            "isRefreshable"      : !tracker_event || token_unrefreshable.indexOf(tracker_type) === -1,
            "pole"               : tracker_pole,
            "description"        : tracker_description,
            "originalDescription": tracker_event.description,
            "timing"             : tracker_event.date ? tracker_event.date + " às " + tracker_event.time : null,
            "placeFrom"          : Trackers.parsePlace(tracker_event.from) || "",
            "placeDestiny"       : Trackers.parsePlace(tracker_event.destiny) || "",
        };
    };

    // Obtém todos os Trackers registrados.
    this.getAll = function(callback) {
        Options.get(TRACKERS_LIST_OPTION, function(option_value) {
            callback(option_value || []);
        });
    };

    // Retorna o código de todos os Trackers registrados.
    this.getAllCodes = function(callback) {
        Trackers.getAll(function(trackers) {
            var trackers_codes = [];

            jQuery.each(trackers, function(index, value) {
                trackers_codes[index] = value.code;
            });

            callback(trackers_codes);
        });
    };

    // Obtém os dados de um Tracker específico.
    this.get = function(tracker_code, callback) {
        Trackers.getAll(function(trackers) {
            var tracker_found = false;

            // Localiza o Tracker.
            jQuery.each(trackers, function(index, tracker) {
                if(tracker_code === tracker.code) {
                    tracker_found = true;
                    callback(tracker);
                    return false;
                }
            });

            // Se ele não foi encontrado,
            // Lança o callback anulado.
            if(!tracker_found) {
                callback(null);
            }
        });
    };

    // Processa as informações de um Tracker.
    this.compile = function(tracker_xml, trackers_codes, callback) {
        var trackers_responses = Utils.xmlMapper(tracker_xml).sroxml,
            trackers_compiled  = [],
            trackers_processed = 0;

        // Atualiza cada objeto da resposta.
        jQuery.each(trackers_codes, function(index, tracker_code) {
            var tracker_index     = false;

            // Localiza o objeto responsável pela resposta do Tracker.
            if(trackers_responses[0].objeto) {
                jQuery.each(trackers_responses[0].objeto, function(response_index, response_object) {
                    if(response_object.numero[0] === tracker_code) {
                        tracker_index = response_index;
                        return false;
                    }
                });
            }

            // Obtém e prepara a atualização do Tracker.
            Trackers.get(tracker_code, function(tracker) {
                var tracker              = tracker || {},
                    tracker_events_count = tracker.events ? tracker.events.length : 0;

                // Define o status e reseta o Tracker.
                tracker.status = "loaded";
                tracker.events = [];

                // Se o objeto foi localizado, preenche seus dados.
                if(tracker_index !== false) {
                    jQuery.each(trackers_responses[0].objeto[tracker_index].evento, function(index, tracker_event) {
                        var tracker_data  = {};

                        // Define os dados do Tracker.
                        tracker_data.type        = tracker_event.tipo[0];
                        tracker_data.status      = tracker_event.status[0];
                        tracker_data.description = tracker_event.descricao[0];
                        tracker_data.date        = tracker_event.data[0];
                        tracker_data.time        = tracker_event.hora[0];

                        // Obtém informações complementares, se houver.
                        tracker_data.additional = {};
                        if(tracker_event.recebedor) {
                            tracker_data.additional.receiver = tracker_event.recebedor[0];
                        }
                        if(tracker_event.documento) {
                            tracker_data.additional.document = tracker_event.documento[0];
                        }
                        if(tracker_event.comentario) {
                            tracker_data.additional.comment  = tracker_event.comentario[0];
                        }

                        // Define o local atual.
                        tracker_data.from = {};
                        tracker_data.from.place = tracker_event.local[0];
                        tracker_data.from.city  = tracker_event.cidade[0];
                        tracker_data.from.UF    = tracker_event.uf[0];
                        tracker_data.from.CEP   = tracker_event.codigo[0];

                        // Define o local de destino.
                        if(tracker_event.destino
                        && tracker_event.destino[0].local) {
                            tracker_data.destiny = {};
                            tracker_data.destiny.place    = tracker_event.destino[0].local[0];
                            tracker_data.destiny.city     = tracker_event.destino[0].cidade[0];
                            tracker_data.destiny.district = tracker_event.destino[0].bairro[0];
                            tracker_data.destiny.UF       = tracker_event.destino[0].uf[0];
                            tracker_data.destiny.CEP      = tracker_event.destino[0].codigo[0];
                        }

                        // Adiciona um novo evento.
                        tracker.events.push(tracker_data);
                    });
                }
                // Caso contrário, preenche os dados de falha.
                else {
                    tracker.events.push({
                        "type"       : "ER",
                        "status"     : "01",
                        "description": "Objeto não localizado"
                    });
                }

                // Define se um tracker foi atualizado.
                tracker.updated = tracker.updated || tracker.events.length !== tracker_events_count;

                // Anexa os compilados.
                trackers_compiled.push(tracker);

                // Salva o Tracker e envia as informações geradas.
                Trackers.save(tracker.code, tracker, function() {
                    trackers_processed++;
                    if(trackers_processed === trackers_codes.length) {
                        callback(trackers_compiled);
                    }
                });
            });
        });
    };

    // Salva um Tracker.
    this.save = function(tracker_code, tracker, callback) {
        Options.update(TRACKERS_LIST_OPTION, function(trackers) {
            var trackers = trackers || [],
                tracker_found = false;

            // Localiza o tracker.
            jQuery.each(trackers, function(index, internal_tracker) {
                if(internal_tracker.code === tracker_code) {
                    tracker_found = true;
                    trackers[index] = tracker;
                    return false;
                }
            });

            // Se não foi localizado, adiciona.
            if(!tracker_found) {
                trackers.push(tracker);
            }

            return trackers;
        }, callback);
    };
};