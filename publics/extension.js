$(function() {

    // Mapeia os principais elementos.
    var trackers_table   = $("#trackers-table"),
        trackers_empty   = $("#trackers-empty"),
        trackers_model   = $("#trackers-model"),
        trackers_refresh = $("#trackers-refresh"),
        trackers_list    = trackers_model.parent();

    // Desanexa o Tracker de modelo da página.
    trackers_model.detach().removeClass("hide");

    // Obtém o modelo do Tracker.
    Trackers.getModel = function(tracker_code, callback) {
        callback(trackers_list.find("tr").filter(function() {
            return this.getAttribute("data-tracker-code") === tracker_code;
        }));
    };

    // Cria um Tracker.
    Trackers.create = function(tracker) {
        Trackers.add(tracker);
        Trackers.save(tracker, function() {
            Trackers.refresh(tracker.code);
        });
    };

    // Adiciona um novo Tracker a lista.
    Trackers.add = function(tracker) {
        var model;

        // Gera o objeto e anexa a lista.
        model = trackers_model.clone();
        model.attr("data-tracker-code", tracker.code);
        model.appendTo(trackers_list);

        // Atualiza as informações do objeto adicionado.
        Trackers.update(tracker);
        Trackers.redrawInterface();
    };

    // Atualiza as informações de um Tracker na lista.
    Trackers.update = function(tracker) {
        Trackers.getModel(tracker.code, function(model) {
            var model_mapper  = Utils.fieldsMapper(model[0], "data-name");

            // Atualiza o modelo do Tracker.
            model.attr({
                "data-tracker-code"     : tracker.code,
                "data-tracker-timestamp": Date.now()
            });

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
                var tracker_event = tracker.events[0];

                // Atualiza a Timestamp do Tracker.
                model.attr("data-tracker-timestamp", Utils.toTimestamp(tracker_event));

                // Preenche a localização.
                $(model_mapper.placeFrom).html(Trackers.getPlace(tracker_event.from) || "");
                $(model_mapper.placeDestiny).html(Trackers.getPlace(tracker_event.destiny) || "");

                // Preenche a data e hora.
                var tracker_date = tracker_event.date ? tracker_event.date + " às " + tracker_event.time : "-";
                $(model_mapper.date).text(tracker_date);

                // Preenche a situação atual.
                $(model_mapper.description).text(Trackers.getDescription(tracker_event))
                                           .attr("data-tracker-description", Trackers.getToken(tracker_event));
            }

            // Determina o modo de atualização.
            $(model_mapper.actionRefresh).toggleClass("disabled", !Trackers.isRefreshable(tracker_event));

            // Após a atualização, reordena a lista.
            Trackers.reorderList();
        });
    };

    // Remove um Tracker.
    Trackers.remove = function(tracker_code) {
        Trackers.getModel(tracker_code, function(model) {
            model.remove();
            Trackers.redrawInterface();
        });
    };

    // Recarrega a lista de Trackers.
    Trackers.reload = function() {
        Trackers.getAll(function(trackers) {
            jQuery.each(trackers, function(index, tracker) {
                Trackers.add(tracker);
            });
        });
    };

    // Atualiza um Tracker.
    Trackers.refresh = function(tracker_code) {
        Trackers.getModel(tracker_code, function(tracker_model) {
            // Mapeia o Tracker da Lista.
            var tracker_mapper = Utils.fieldsMapper(tracker_model, "data-name");

            // Atualiza a situação.
            $(tracker_mapper.placeDestiny).empty();
            $(tracker_mapper.description)
                .attr("data-tracker-description", "loading")
                .html($("#model-loading").html());

            chrome.runtime.sendMessage("", {
                "action" : "events.getTrackerEvents",
                "tracker": tracker_model.attr("data-tracker-code")
            });
        });
    };

    // Redesenha a interface.
    Trackers.redrawInterface = function() {
        var trackers_exists = trackers_list.children().length !== 0;

        trackers_table.toggle(trackers_exists);
        trackers_empty.toggle(!trackers_exists);

        trackers_refresh.toggleClass("disabled", !trackers_exists);

        this.reorderList();
    };

    // Reordena a lista com base na data de movimentação.
    Trackers.reorderList = function() {
        var model_list    = trackers_list.children(),
            model_reorder = [];

        // Destaca todos os itens da lista.
        model_list.each(function() {
            var model = $(this);
            model_reorder.push([ parseInt(model.attr("data-tracker-timestamp")), model.detach() ]);
        });

        // Reordena o array.
        model_reorder.sort(function(a, b) {
            return a[0] < b[0];
        });

        // Reanexa os itens na nova ordem.
        jQuery.each(model_reorder, function(index, value) {
            trackers_list.append(value[1]);
        });
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
        this.triggerTrackerRefresh = function(ev, force_refresh) {
            var tracker_refresh = $(this);

            // Força a atualização, mesmo quando desnecessária.
            if(tracker_refresh.is(".disabled")) {
                if(!force_refresh
                && !ev.shiftKey) {
                    return;
                }
            }

            Trackers.refresh(tracker_refresh.closest("tr").attr("data-tracker-code"));
        };

        // Atualiza todos os Trackers na lista.
        this.triggerTrackersRefresh = function(ev) {
            trackers_list.find("[data-action-trigger=refresh-tracker]").trigger("click", [ ev.shiftKey ]);
        };

        // Inicia a criação de um novo Tracker.
        this.triggerTrackerCreateModalShow = function(ev) {
            self.triggerTrackerEditModalShow(ev, null);
        };

        // Inicia a edição de um Tracker.
        this.triggerTrackerEditModalShow = function(ev, tracker_code) {
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
                            Trackers.add(tracker);
                        }

                        // Salva o Tracker.
                        Trackers.save(tracker_code, tracker, function() {
                            // Na criação, obtém as informações do Tracker.
                            if(mode_create) {
                                Trackers.refresh(tracker.code);
                                return;
                            }

                            // Na edição, verifica se o código foi alterado.
                            if(tracker.code !== tracker_code) {
                                // Se isso ocorreu, é necessário atualizar o código do modelo.
                                Trackers.getModel(tracker_code, function(model) {
                                    model.attr("data-tracker-code", tracker.code);

                                    // Feito isso, é necessário reobter as informações do Tracker.
                                    Trackers.refresh(tracker.code);
                                });
                                return;
                            }

                            // Caso contrário, apenas atualiza os dados na lista.
                            Trackers.update(tracker);
                        });
                    }
                });

                // Exibe o Modal.
                modal_editor.modal("show");
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
                                    Trackers.remove(internal_tracker.code);
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

    // Inicia a edição de um Tracker.
    $(document).on("click", "[data-action-trigger=edit-tracker]", function(ev) {
        Actions.triggerTrackerEditModalShow(ev, $(this).closest("tr").attr("data-tracker-code"));
    });

    // Inicia a remoção de um Tracker.
    $(document).on("click", "[data-action-trigger=remove-tracker]", Actions.triggerTrackerRemoveModalShow);

    // Gerenciador de mensagens.
    chrome.runtime.onMessage.addListener(function(message, sender, responseCallback) {
        // Se receber os dados de um tracker.
        if(message.action === "extension.setTrackerEvents") {
            // Se houve sucesso, atualiza com os dados obtidos.
            if(message.success) {
                Trackers.update(message.data);
                return;
            }

            // Se não houve sucesso, exibe uma mensagme de erro.
            Trackers.getModel(message.tracker, function(model) {
                var tracker_mapper      = Utils.fieldsMapper(model, "data-name");

                // Atualiza a situação.
                $(tracker_mapper.description)
                    .attr("data-tracker-description", "negative")
                    .text("Falha ao atualizar");
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

    // Carrega a lista de trackers.
    Trackers.reload();

});