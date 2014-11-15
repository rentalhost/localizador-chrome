$(function() {

    // Mapeia os principais elementos.
    var trackers_table   = $("#trackers-table"),
        trackers_empty   = $("#trackers-empty"),
        trackers_model   = $("#trackers-model").removeAttr("id"),
        trackers_refresh = $("#trackers-refresh"),
        trackers_list    = trackers_model.parent();

    // Elementos de detalhes.
    var details_model      = $("#trackers-details-model").removeAttr("id").detach(),
        details_more_model = $("[data-name^=trackers-details-more-model]").detach();

    // Define uma referência do próximo dia.
    var current_timestamp = new Date;
    current_timestamp.setDate(current_timestamp.getDate() + 1);
    current_timestamp.setHours(0, 0, 0, 0);

    // Desanexa o Tracker de modelo da página.
    trackers_model.detach();

    // Obtém o modelo do Tracker.
    Trackers.getModel = function(tracker_code, callback) {
        callback(trackers_list.find("tr").filter(function() {
            return this.getAttribute("data-tracker-code") === tracker_code;
        }));
    };

    // Cria um Tracker.
    Trackers.listCreate = function(tracker) {
        Trackers.listAdd(tracker);
        Trackers.save(tracker, function() {
            Trackers.listRefresh(tracker.code);
        });
    };

    // Adiciona um novo Tracker a lista.
    Trackers.listAdd = function(tracker) {
        var model;

        // Gera o objeto e anexa a lista.
        model = trackers_model.clone();
        model.attr("data-tracker-code", tracker.code);
        model.appendTo(trackers_list);

        // Atualiza as informações do objeto adicionado.
        Trackers.listUpdate([ tracker ]);
        Trackers.redrawInterface();
    };

    // Atualiza as informações de um Tracker na lista.
    Trackers.listUpdate = function(trackers) {
        jQuery.each(trackers, function(index, tracker) {
            Trackers.getModel(tracker.code, function(model) {
                var model_mapper       = Utils.fieldsMapper(model[0], "data-name"),
                    model_refreshable  = true;

                // Atualiza o modelo do Tracker.
                model.attr({
                    "data-tracker-code"     : tracker.code,
                    "data-tracker-timestamp": current_timestamp.getTime()
                }).removeClass("negative positive");

                // Atualiza os campos.
                $(model_mapper.code).text(tracker.code);
                $(model_mapper.title).text(tracker.title);

                // Adiciona o indicador de direção.
                $(model_mapper.direction).removeClass("left right")
                                         .addClass(tracker.direction === "receiving" ? "left" : "right")
                                         .attr("title", tracker.direction === "receiving" ? "Recebendo" : "Enviando");

                // Se o status do Tracker for loaded, carrega as informações adicionais.
                if(tracker.events
                && tracker.events.length) {
                    var tracker_event      = tracker.events[0],
                        tracker_properties = Trackers.getEventProperties(tracker_event);

                    // Atualiza a Timestamp do Tracker.
                    model.attr("data-tracker-timestamp", Utils.toTimestamp(tracker_event) || current_timestamp.getTime());
                    model.addClass(tracker_properties.pole);

                    // Preenche a localização.
                    $(model_mapper.placeFrom).html(tracker_properties.placeFrom);
                    $(model_mapper.placeDestiny).html(tracker_properties.placeDestiny);

                    // Preenche a data e hora.
                    $(model_mapper.date).text(tracker_properties.timing || "-");

                    // Preenche a situação atual.
                    $(model_mapper.description).text(tracker_properties.description);

                    // Determina se é atualizável.
                    model_refreshable = tracker_properties.isRefreshable;
                }

                // Determina o modo de atualização.
                $(model_mapper.actionRefresh).toggleClass("disabled", !model_refreshable);
            });
        });
    };

    // Remove um Tracker.
    Trackers.listRemove = function(tracker_code) {
        Trackers.getModel(tracker_code, function(model) {
            model.remove();
            Trackers.redrawInterface();
        });
    };

    // Recarrega a lista de Trackers.
    Trackers.listReload = function() {
        Trackers.getAll(function(trackers) {
            jQuery.each(trackers, function(index, tracker) {
                Trackers.listAdd(tracker);
            });
            Trackers.reorderList();
        });
    };

    // Atualiza um Tracker.
    Trackers.listRefresh = function(trackers_codes) {
        if(!trackers_codes.length) {
            return;
        }

        jQuery.each(trackers_codes, function(index, tracker_code) {
            Trackers.getModel(tracker_code, function(tracker_model) {
                // Mapeia o Tracker da Lista.
                var tracker_mapper = Utils.fieldsMapper(tracker_model, "data-name");

                // Atualiza a situação.
                tracker_model.removeClass("positive negative");
                $(tracker_mapper.placeDestiny).empty();
                $(tracker_mapper.description).html($("#model-loading").html());
            });
        });

        chrome.runtime.sendMessage({
            "action"  : "events.getTrackersEvents",
            "trackers": trackers_codes
        });

        // Após a atualização, reordena a lista.
        Trackers.reorderList();
    };

    // Redesenha a interface.
    Trackers.redrawInterface = function() {
        var trackers_exists = trackers_list.children().length !== 0;

        trackers_table.toggle(trackers_exists);
        trackers_empty.toggle(!trackers_exists);

        trackers_refresh.toggleClass("disabled", !trackers_exists);

        Trackers.reorderList();
    };

    // Reordena a lista com base na data de movimentação.
    Trackers.reorderList = function() {
        trackers_list.find("tr").sort(
            firstBy(function(a, b) {
                return b.getAttribute("data-tracker-timestamp") - a.getAttribute("data-tracker-timestamp");
            })
            .thenBy(function(a, b) {
                return a.getAttribute("data-tracker-code") > b.getAttribute("data-tracker-code") ? 1 : -1;
            })
        ).appendTo(trackers_list);
    };

    // Gerencia as ações e eventos.
    var Actions = new function() {
        var self = this;

        // Carrega os dados do manifest.
        var extension_manifest = chrome.runtime.getManifest();

        // Atualiza o texto de manifest.
        this.applyManifestText = function() {
            this.textContent = extension_manifest[this.getAttribute("data-manifest-text")];
        };

        // Envia um formulário.
        this.triggerFormSubmit = function() {
            $(this.getAttribute("data-form-submit")).submit();
        };

        // Exibe um Modal.
        this.triggerModalShow = function() {
            $(this.getAttribute("data-modal-show")).modal("show");
        };

        // Inicia a atualização de um Tracker.
        this.triggerTrackerRefresh = function(ev) {
            var tracker_refresh = $(this);

            // Força a atualização, mesmo quando desnecessária.
            if(tracker_refresh.is(".disabled")
            && !ev.shiftKey) {
                return;
            }

            Trackers.listRefresh([ tracker_refresh.closest("tr").attr("data-tracker-code") ]);
        };

        // Atualiza todos os Trackers na lista.
        this.triggerTrackersRefresh = function(ev) {
            var trackers       = trackers_list.find("[data-action-trigger=refresh-tracker]"),
                trackers_codes = [];

            // Ignora os que não devem ser atualizados por padrão.
            if(!ev.shiftKey) {
                trackers = trackers.not(".disabled");
            }

            // Obtém os códigos recebidos.
            trackers.closest("tr").each(function() {
                trackers_codes.push(this.getAttribute("data-tracker-code"));
            });

            Trackers.listRefresh(trackers_codes);
        };

        // Inicia a criação de um novo Tracker.
        this.triggerTrackerCreateModalShow = function(ev) {
            self.triggerTrackerEditModalShow(ev, null);
        };

        // Inicia a edição de um Tracker.
        this.triggerTrackerEditModalShow = function(ev, tracker_code) {
            Trackers.getAllCodes(function(trackers_codes) {
                // Carrega o Tracker.
                Trackers.get(tracker_code, function(tracker) {
                    // Identifica o modo.
                    var mode_create = tracker === null,
                        modal_editor;

                    // No modo de criação, gera um Tracker vazio.
                    if(mode_create) {
                        tracker = { "status": "created" };
                    }

                    // Prepara o Modal.
                    modal_editor = $("#modal-editor");
                    modal_editor.find(".header").text(mode_create ? "Novo" : "Editando \"" + tracker.title + "\"");

                    // Reinicia a visualização do modal.
                    function modal_reset() {
                        modal_editor.find(".message").removeClass("visible")
                                    .find("ul").empty();
                    };

                    // Configura o Modal.
                    modal_editor.modal("setting", {
                        // Configuração na exibição inicial.
                        "onShow": function() {
                            var modal_fields;

                            // Reseta o modal.
                            modal_reset();

                            // Preenche os campos.
                            modal_fields = Utils.fieldsMapper(this);
                            modal_fields.tracker_title.value     = tracker.title     || "";
                            modal_fields.tracker_code.value      = tracker.code      || "";
                            modal_fields.tracker_direction.value = tracker.direction || "receiving";
                            modal_fields.tracker_obs.value       = tracker.obs       || "";

                            // Determina a direção da encomenda.
                            $(modal_fields.tracker_direction).parent()
                                .dropdown("set selected", modal_fields.tracker_direction.value);
                        },
                        // Valida a aprovação de um item.
                        "onApprove": function() {
                            var modal = $(this),
                                modal_messages = modal.find(".message"),
                                modal_messages_list = modal_messages.find("ul");
                                modal_fields = Utils.fieldsMapper(this);

                            // Reseta o modal.
                            modal_reset();

                            // O Título de Referência é obrigatório.
                            modal_fields.tracker_title.value = modal_fields.tracker_title.value.trim();
                            if(modal_fields.tracker_title.value.length === 0) {
                                modal_messages_list.append("<li class=\"item\">O campo <strong>Título de Referência</strong> é obrigatório.</li>");
                            }

                            // O Código de Rastreio é obrigatório.
                            modal_fields.tracker_code.value = modal_fields.tracker_code.value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
                            if(modal_fields.tracker_code.value.length === 0) {
                                modal_messages_list.append("<li class=\"item\">O campo <strong>Código de Rastreio</strong> é obrigatório.</li>");
                            }
                            else
                            // O Código de Rastreio deve ter 13 caracteres.
                            if(modal_fields.tracker_code.value.length !== 13) {
                                modal_messages_list.append("<li class=\"item\">O campo <strong>Código de Rastreio</strong> deve ter 13 caracteres.</li>");
                            }
                            else
                            // O Código de Rastreio deve possuir um formato válido.
                            if(!modal_fields.tracker_code.value.match(/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/)) {
                                modal_messages_list.append("<li class=\"item\">O campo <strong>Código de Rastreio</strong> deve possuir um formato válido (ex. SX000000000BR).</li>");
                            }
                            else
                            // O Código de Rastreio já existe.
                            if(trackers_codes.indexOf(modal_fields.tracker_code.value) !== -1
                            && tracker_code !== modal_fields.tracker_code.value) {
                                modal_messages_list.append("<li class=\"item\">O <strong>Código de Rastreio</strong> informado já foi cadastrado.</li>");
                            }

                            // Identifica se houve um erro.
                            if(modal_messages_list.find("li").length !== 0) {
                                modal_messages.addClass("visible");
                                modal.modal("refresh");
                                return false;
                            }

                            // Define os dados do Tracker.
                            tracker.code         = modal_fields.tracker_code.value;
                            tracker.title        = modal_fields.tracker_title.value;
                            tracker.direction    = modal_fields.tracker_direction.value;
                            tracker.obs          = modal_fields.tracker_obs.value;

                            // Adiciona o Tracker na lista, no modo criação.
                            if(mode_create) {
                                Trackers.listAdd(tracker);
                            }

                            // Salva o Tracker.
                            Trackers.save(tracker_code, tracker, function() {
                                // Na criação, obtém as informações do Tracker.
                                if(mode_create) {
                                    Trackers.listRefresh([ tracker.code ]);
                                    return;
                                }

                                // Na edição, verifica se o código foi alterado.
                                if(tracker.code !== tracker_code) {
                                    // Se isso ocorreu, é necessário atualizar o código do modelo.
                                    Trackers.getModel(tracker_code, function(model) {
                                        model.attr("data-tracker-code", tracker.code);

                                        // Feito isso, é necessário reobter as informações do Tracker.
                                        Trackers.listRefresh([ tracker.code ]);
                                    });
                                    return;
                                }

                                // Caso contrário, apenas atualiza os dados na lista.
                                Trackers.listUpdate([ tracker ]);
                            });
                        }
                    });

                    // Exibe o Modal.
                    modal_editor.modal("show");
                });
            });
        };

        // Inicia a exibição de um Tracker.
        this.triggerTrackerDetailsModalShow = function(ev) {
            var tracker_code = $(this).closest("tr").attr("data-tracker-code");

            // Carrega o Tracker.
            Trackers.get(tracker_code, function(tracker) {
                var modal_details   = $("#modal-details"),
                    modal_movements = modal_details.find(".tracker.movements tbody");
                modal_details.find("> .header").text("Detalhes de \"" + tracker.title + "\"");

                // Limpa as movimentações.
                modal_movements.empty();

                // Aplica todas as movimentações.
                jQuery.each(tracker.events, function(index, value) {
                    var movement_element    = details_model.clone(),
                        movement_mapper     = Utils.fieldsMapper(movement_element, "data-name"),
                        movement_properties = Trackers.getEventProperties(value);

                    // Preenche com as propriedades.
                    $(movement_mapper.timing).text(movement_properties.timing || "-");
                    $(movement_mapper.placeFrom).text(movement_properties.placeFrom || "-");
                    $(movement_mapper.placeDestiny).text(movement_properties.placeDestiny);
                    $(movement_mapper.description).text(movement_properties.description);
                    movement_element.addClass(movement_properties.pole);

                    // Adiciona um ícone indicando a posição atual.
                    // Exceto quando houver apenas um item.
                    if(index === 0
                    && tracker.events.length > 1) {
                        var current_icon = document.createElement("i");
                        current_icon.classList.add("small", "chevron", "right", "icon");
                        $(movement_mapper.placeFrom).prepend(current_icon);
                    }
                    else
                    // A partir do quinto objeto, oculta os registros.
                    if(index >= 5
                    && tracker.events.length > 6) {
                        movement_element.addClass("hide").hide();
                    }

                    movement_element.appendTo(modal_movements);
                });

                // Se possuir mais do que cinco itens, exibe uma opção de exibir todos.
                if(tracker.events.length > 6) {
                    var more_element = details_more_model.clone();
                    more_element.click(function() {
                        modal_movements.find(".hide").show();
                        $(this).closest("tr").remove();
                        return false;
                    });
                    more_element.appendTo(modal_movements);
                }

                modal_details.modal("show");
            });
        };

        // Inicia a remoção de um Tracker.
        this.triggerTrackerRemoveModalShow = function() {
            var modal_remove = $("#modal-remove"),
                tracker_code = $(this).closest("tr").attr("data-tracker-code");

            // Obtém os dados do Tracker a ser removido.
            Trackers.get(tracker_code, function(tracker) {
                modal_remove.find(".tracker-title").text(tracker.title);
                modal_remove.find(".tracker-code").text(tracker.code);

                modal_remove.modal("setting", {
                    "onApprove": function() {
                        // Se aprovado, remove o Tracker da lista.
                        Options.update(TRACKERS_LIST_OPTION, function(trackers) {
                            // Localiza o código na listagem e o remove.
                            jQuery.each(trackers, function(index, internal_tracker) {
                                if(tracker.code === internal_tracker.code) {
                                    Trackers.listRemove(internal_tracker.code);
                                    trackers = trackers.slice(0, index).concat(trackers.slice(index + 1));
                                    return false;
                                }
                            });

                            return trackers;
                        });
                    }
                })

                modal_remove.modal("show");
            });
        };
    };

    // Aplica os textos do manifest.
    $("[data-manifest-text]").each(Actions.applyManifestText);

    // Envia um formulário.
    $("[data-form-submit]").click(Actions.triggerFormSubmit);

    // Exibe um modal.
    $("[data-modal-show]").click(Actions.triggerModalShow);

    // Atualiza todos os Trackers.
    trackers_refresh.click(Actions.triggerTrackersRefresh);

    // Inicia a atualização de um Tracker.
    $(document).on("click", "[data-action-trigger=refresh-tracker]", Actions.triggerTrackerRefresh);

    // Inicia a criação de um Tracker.
    $(document).on("click", "[data-action-trigger=create-tracker]", Actions.triggerTrackerCreateModalShow);

    // Inicia a exibição de um Tracker.
    $(document).on("click", "[data-action-trigger=show-tracker]", Actions.triggerTrackerDetailsModalShow);

    // Inicia a edição de um Tracker.
    $(document).on("click", "[data-action-trigger=edit-tracker]", function(ev) {
        Actions.triggerTrackerEditModalShow(ev, $(this).closest("tr").attr("data-tracker-code"));
    });

    // Inicia a remoção de um Tracker.
    $(document).on("click", "[data-action-trigger=remove-tracker]", Actions.triggerTrackerRemoveModalShow);

    // Gerenciador de mensagens.
    chrome.runtime.onMessage.addListener(function(message, sender, responseCallback) {
        // Se receber os dados de um tracker.
        if(message.action === "extension.setTrackersEvents") {
            // Se houve sucesso, atualiza com os dados obtidos.
            if(message.success) {
                Trackers.listUpdate(message.responses);
                return;
            }

            // Se não houve sucesso, exibe uma mensagme de erro.
            Trackers.getModel(message.tracker, function(model) {
                var tracker_mapper = Utils.fieldsMapper(model, "data-name");

                // Atualiza a situação.
                model.removeClass("positive negative");
                $(tracker_mapper.description).text("Falha ao atualizar.");
            });
            return;
        }
    });

    // Aplica o Semantic.
    $(".ui.dropdown").dropdown();

    $(document).on("mouseenter", "[data-content]:not(.disabled)", function() {
        $(this).popup({
            "inline"  : true,
            "position": "bottom right",
            "duration": 50,
        }).popup("show");
    });

    $(".message .close").on("click", function() {
        $(this).closest(".message").hide();
    });

    // Carrega a lista de trackers.
    Trackers.listReload();

});