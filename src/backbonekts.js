(function (exports, module) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // AMD environment
        define(['backbone', 'underscore', 'notific', 'jquery'], module);
    } else if (typeof exports === 'object') {
        // CommonJS environment
        module.exports = module();
    } else {
        // Browser environment
        exports.BackboneKTS = module();
    }
}(typeof exports === 'object' && exports || this, function (Backbone, _, Notific, $) {
    var BackboneKTS = {};

    BackboneKTS.debugLog = function() {
        if (console && _.isFunction(console.log)) {
            console.log.apply(console, arguments);
        }
    };

    BackboneKTS.Collection = Backbone.Collection.extend({
        totalCount: 0,
        pageCount: 0,
        offset: 0,
        pageSize: 10,
        getBeginPagination: function (offset) {
            var beginPagination = offset / this.pageSize - 3;
            if (beginPagination < 0) {
                beginPagination = 0;
            }
            return beginPagination;
        },
        getEndPagination: function (offset) {
            var endPagination = offset / this.pageSize + 3;
            if (endPagination > this.pageCount) {
                endPagination = this.pageCount;
            }
            return endPagination;
        },
        parse: function (response) {
            this.totalCount = response.data.count;
            this.pageCount = parseInt(this.totalCount / this.pageSize, 10) + ((this.totalCount % this.pageSize) > 0 ? 1 : 0);
            return [].slice ? (response.data.items || []).slice(0, this.totalCount) : response.data.items;
        }
    });

    BackboneKTS.Config = {
        apiURL: false,
        apiPersistentData: {
            'v': '1' // api version
        },
        staticPrefix: false,
        mediaPrefix: false,
        webRoot: false,

        queryString: function () {
            // This function is anonymous, is executed immediately and
            // the return value is assigned to QueryString!
            var query_string = {};
            var query = window.location.search.substring(1);
            var vars = query.split("&");
            for (var i=0;i<vars.length;i++) {
                var pair = vars[i].split("=");
                // If first entry with this name
                if (typeof query_string[pair[0]] === "undefined") {
                    query_string[pair[0]] = decodeURIComponent(pair[1]);
                    // If second entry with this name
                } else if (typeof query_string[pair[0]] === "string") {
                    var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
                    query_string[pair[0]] = arr;
                    // If third or later entry with this name
                } else {
                    query_string[pair[0]].push(decodeURIComponent(pair[1]));
                }
            }
            return query_string;
        }(),
        getMethodUrl: function (methodName, args) {
            var url = this.apiURL + methodName;
            if (typeof args === 'object') {
                for (var i in args) {
                    if (args[i] !== undefined) {
                        url += ('&' + i + '=' + encodeURIComponent(args[i]));
                    }
                }
            }
            return url;
        },
        getStaticUrl: function (staticPath) {
            return this.webRoot + this.staticPrefix + staticPath;
        },
        getMediaUrl: function (mediaPath) {
            return this.webRoot + this.mediaPrefix + mediaPath;
        },
        apiCall: function (method, data, options) {
            options = options || {};
            var requestData = _.extend({}, this.apiPersistentData, data);
            $.ajax({
                method: 'get',
                url: this.getMethodUrl(method),
                data: requestData,
                beforeSend: options.onProgressStart || (function () {}),
                complete: options.onProgressEnd || (function () {}),
                success: options.onSuccess || (function () {}),
                error: options.onError || (function () {})
            });
        }
    };

    BackboneKTS.Model = Backbone.Model.extend({
        parse: function (response, options) {
            if (options.collection) {
                return response;
            } else {
                try {
                    return response.data.items[0];
                } catch (e) {
                    return {};
                }
            }
        },
        _backboneSync: function (method, model, options) {
            var methodMap = {
                'create': 'POST',
                'update': 'POST',
                'patch': 'POST',
                'delete': 'POST',
                'read': 'GET'
            };
            var type = methodMap[method];
            _.defaults(options || (options = {}), {
                emulateHTTP: Backbone.emulateHTTP,
                emulateJSON: !Backbone.emulateJSON
            });
            var params = {
                type: type,
                dataType: 'json'
            };
            if (!options.url) {
                params.url = _.result(model, 'url') || console.error('URL not defined');
            }
            if (options.data === null && model && (method === 'create' || method === 'update' || method === 'patch')) {
                params.contentType = 'application/json';
                params.data = JSON.stringify(options.attrs || model.toJSON(options));
            }
            if (options.emulateJSON) {
                params.contentType = 'application/x-www-form-urlencoded';
                params.data = options.attrs || model.toJSON(options);
                if (typeof params.data === 'object') {
                    params.data = $.param(params.data);
                }
            }
            if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
                params.type = 'POST';
                if (options.emulateJSON) {
                    params.data._method = type;
                }
                var beforeSend = options.beforeSend;
                options.beforeSend = function (xhr) {
                    xhr.setRequestHeader('X-HTTP-Method-Override', type);
                    if (beforeSend) {
                        return beforeSend.apply(this, arguments);
                    }
                };
            }
            if (params.type !== 'GET' && !options.emulateJSON) {
                params.processData = false;
            }
            var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
            model.trigger('request', model, xhr, options);
            return xhr;
        },
        sync: function () {
            return this._backboneSync.apply(this, arguments);
        }
    });

    BackboneKTS.App = Backbone.Router.extend({
        redirect: function (path) {
            Backbone.history.navigate('/' + path, true);
        },
        _viewsInstance: {},
        views: {},
        _getViewByName: function (name) {
            if (typeof this._viewsInstance[name] === 'undefined') {
                var View = this.views[name];
                if (typeof View !== 'undefined') {
                    this._viewsInstance[name] = new View();
                } else {
                    return null;
                }
            }
            return this._viewsInstance[name];
        }
    });

    BackboneKTS.View = Backbone.View.extend({
        el: '#content',
        redirect: function (path) {
            Backbone.history.navigate('/' + path, true);
        },
        render: function () {
            var action = arguments[0];
            var passArguments = null;
            if (typeof  action !== "string") {
                action = 'index';
                passArguments = Array.prototype.slice.call(arguments, 0);
            } else {
                passArguments = Array.prototype.slice.call(arguments, 1);
            }
            var actionCapitalized = action.charAt(0).toUpperCase() + action.substring(1).toLowerCase();
            var actionHandler = 'action'+actionCapitalized;
            if (typeof this[actionHandler] === 'function') {
                this[actionHandler].apply(this, passArguments);
            } else {
                this._defaultAction();
            }
        },
        serializeForm: function (form) {
            var result = {};
            _.each($(form).serializeArray(), function (element) {
                var regexp = /\[(\w+)\]/ig;
                var matchField = element.name.match(regexp);
                if (matchField === null) {
                    result[element.name] = element.value;
                } else {
                    var fieldName = element.name.slice(0, element.name.search(regexp));
                    var walkFields = function (object, chain, value) {
                        if (chain.length === 0) {
                            if (!isNaN(parseInt(value, 10)) && String(parseInt(value, 10)).length === value.length) {
                                return parseInt(value, 10);
                            }
                            if (!isNaN(parseFloat(value)) && String(parseFloat(value)).length === value.length) {
                                return parseFloat(value);
                            }
                            return value;
                        } else {
                            var indexName = chain[0].slice(1, chain[0].length - 1);
                            if (isNaN(parseInt(indexName, 10)) || String(parseInt(indexName, 10)).length !== indexName.length) {
                                if (object === undefined) {
                                    object = {};
                                }
                            } else {
                                if (object === undefined) {
                                    object = [];
                                }
                            }
                            object[indexName] = walkFields(object[indexName], chain.slice(1), value);
                        }
                        return object;
                    };
                    result[fieldName] = walkFields(result[fieldName], matchField, element.value);
                }
            });
            _.map(result, function (value, key) {
                if (typeof value === 'object') {
                    if (Array.isArray(value)) {
                        var nullLessArray = [];
                        for (var i in value) {
                            if (value[i] !== null && value[i] !== undefined) {
                                nullLessArray.push(value[i]);
                            }
                        }
                        value = nullLessArray;
                    }
                    result[key] = JSON.stringify(value);
                }
            });
            return result;
        },
        _defaultAction: function () {
            this.$el.html($('<h1/>', {html: '404'}));
        },
        _showSuccess: function (title, text) {
            if (title === undefined) {
                title = 'Выполнено';
            }
            if (Notific !== undefined) {
                Notific.success({
                    title: title,
                    text: text,
                    timeout: 2000
                });
            } else {
                BackboneKTS.debugLog('Notific is undefined');
            }
        },
        _showError: function (title, text) {
            if (title === undefined) {
                title = 'Ошибка';
            }
            if (Notific !== undefined) {
                Notific.error({
                    title: title,
                    text: text,
                    timeout: 2000
                });
            } else {
                BackboneKTS.debugLog('Notific is undefined');
            }
        }
    });

    return BackboneKTS;
}));
