; (function ($, document, window) {
    'use strict';
   
    $.fn.visible = function (partial) {
        var $t = $(this),
            $w = $(window),
            viewTop = $w.scrollTop(),
            viewBottom = viewTop + $w.height(),
            _top = $t.offset().top,
            _bottom = _top + $t.height(),
            compareTop = partial === true ? _bottom : _top,
            compareBottom = partial === true ? _top : _bottom;

        if ($t.css('display') === 'none' || $t.css('visibility') === 'hidden')
            return false;

        return ((compareBottom <= viewBottom) && (compareTop >= viewTop));
    };

    $.AsyncLoad = function (element, options) {
        const defaults = {
            url: null,
            method: 'get',
            data: null,
            onload: function (data, elm) {
                console.log("AsyncLoad]: onload]:", data, elm)
            },
            onreload: function (data, elm) {
                console.log("AsyncLoad]: onreload]:", data, elm);
                this.onload(data, elm);
            },
            onpostload: function (elm) { },
            onerror: function (elm, textStatus = 'Error Occurred', errorThrown = '', xhr = { responseText: '' }) {
                console.log("AsyncLoad]: onerror]:", textStatus, errorThrown, elm);
                var $elm = elm.find(".overlay").first()
                if ($elm && $elm.width() > 200) {
                    var errMsgFull = errorThrown.length === 0 ? xhr.responseText.indexOf('<!DOCTYPE') === -1 ? xhr.responseText : "" : errorThrown;
                    var errMsg = errMsgFull;
                    if (errMsgFull.length > 128)
                        errMsg = errMsgFull.substr(0, 120) + '...';
                    $elm.append('<p class="text-small"><b>' + textStatus + (xhr.status ? ' [' + xhr.status + ']' : '') + ': </b> ' + errMsg + '</p>');
                    if (errMsgFull.length > 128)
                        $elm.find('p').click(function () {
                            alert(errMsgFull);
                        })
                }
            },
            onpreload: function (data, elm) {
                return data;
            },

            //isInDisplay: function (elm) {
            //    const rect = elm.getBoundingClientRect();
            //    return (
            //        rect.top >= 0 &&
            //        rect.left >= 0 &&
            //        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            //        rect.right <= (window.innerWidth || document.documentElement.clientWidth)

            //    );
            //},

            //Todo: Implement this later
            //cancel: function () {
            //    alert("cancelling for - " + element.id)
            //},
            //oncancel: null,
            //autoload : false,

            lazyLoad: $.AsyncLoad.config.lazyLoad || false,
            preloaderHtml: '<i class="loading-icon"></i>',
            errorHtml: '<i class="zwicon-exclamation-triangle"></i>',
            status: 'i', // statuses -> i=initialized | l=loading | d=done
            isLoaded: false, // whether onload has been called as initial load,
            cache: {}
        };

        this.configs = $.extend({}, defaults, options)

        this.init = function () {
            if ($.AsyncLoad.configs && typeof $.AsyncLoad.configs === "object")
                this.configs = $.extend(true, this.configs, $.AsyncLoad.configs);

            if (element.hasClass("card")) {
                this.configs['container'] = element;
                if (element.find("div.overlay").length == 0) {
                    element.append('<div class="overlay animate__spin"></div>')
                    this.configs.overlayElement = element.find('div.overlay').hide();
                }
            } else {
                var wrapper = document.createElement('div');
                element[0].parentNode.insertBefore(wrapper, element[0]);
                wrapper.appendChild(element[0]);
                this.configs['container'] = $(wrapper);
                this.configs['container'].append('<div class="overlay deamon animate__spin"></div>')
                this.configs.overlayElement = this.configs['container'].find('div.overlay').hide();
            }

            this.configs.setOverlayStatus = function (status, configs = {}) {
                var c = $.extend(true, { speed: 0 }, configs);
                if (status === undefined || typeof status !== "string")
                    return;

                if (status === "busy" || status === "loading") {
                    this.cache['prop-overflow'] = this['container'].css('overflow');
                    this['container'].css('overflow','hidden')
                    this.status = 'l';
                    if (!this.overlayElement.hasClass("animate__spin"))
                        this.overlayElement.addClass("animate__spin");

                    this.overlayElement.html(this.preloaderHtml);
                    this.overlayElement.fadeIn(c.speed);
                } else if (status === "error" || status === "failed") {
                    this.status = 'd';
                    if (this.overlayElement.hasClass("animate__spin"))
                        this.overlayElement.removeClass("animate__spin");

                    this.overlayElement.html(this.errorHtml);
                    this.onerror(element, c.status || "Error Occured", c.error || "unknown error");
                    this.overlayElement.fadeIn(c.speed);
                } else if (status === "done" || status === "ok") {
                    this['container'].css('overflow', this.cache['prop-overflow'])
                    this.status = 'd';
                    this.overlayElement.delay(100).fadeOut(c.speed);
                }
            }

            if (element.data('asyncload-url'))
                this.configs.url = element.data('asyncload-url')
            
            if (element.data('asyncload-data'))
                this.configs.data = element.data('asyncload-data')

            var elmId = element.attr('id');
            if (elmId === undefined) {
                elmId = $.AsyncLoad.generateId();
                element.attr('id', elmId);
            }

            if (this.configs.lazyLoad && !element.visible(true)) {
                $.AsyncLoad.lazyCandidates[elmId] = element;
            } else {
                this.load(null, element);
            }
        }

        this.reInit = function (element, options) {
            this.configs = $.extend(true, this.configs, options);
            this.configs.overlayElement.hide();
            if (element.visible(true))
                this.load(null, element);
            else {
                var elmId = element.attr('id');
                if (elmId === undefined) {
                    elmId = $.AsyncLoad.generateId();
                    element.attr('id', elmId);
                }
                $.AsyncLoad.lazyCandidates[elmId] = element;
            }
        }

        this.load = function (urlOrData, element) {
            if ($.AsyncLoad.lazyCandidates[element.attr('id')] !== undefined)
                delete $.AsyncLoad.lazyCandidates[element.attr('id')];

            if (urlOrData !== null) {
                if (typeof urlOrData === "string") {
                    this.configs.url = urlOrData;
                } else if (typeof urlOrData === "object")
                    this.configs.data = null;
            }

            if (
                (urlOrData == null || typeof urlOrData === "string")
                && this.configs.url !== null && this.configs.url.length > 0
            )
                this.ajax();

            else if (urlOrData !== null && typeof urlOrData === "object") {
                if (!this.configs.isLoaded) {
                    this.configs.onload(
                        this.configs.onpreload(urlOrData, element),
                        element
                    );
                    this.configs.isLoaded = true;
                }
                else
                    this.configs.onreload(
                        this.configs.onpreload(urlOrData, element),
                        element
                    );
                this.configs.setOverlayStatus("done");
                this.configs.onpostload(element);
            }

            else if (this.configs.data !== null && typeof this.configs.data === "object") {
                if (!this.configs.isLoaded) {
                    this.configs.onload(
                        this.configs.onpreload(this.configs.data, element),
                        element
                    );
                    this.configs.isLoaded = true;
                }
                else
                    this.configs.onreload(
                        this.configs.onpreload(this.configs.data, element),
                        element
                    );
                this.configs.setOverlayStatus("done");
                this.configs.onpostload(element);
            }

        }

        this.reload = function (data, element) {
            const configs = this.configs;
            // && data !== configs.url // if want to block request to same url
            if (typeof data === "string" || data == undefined) {
                if (data != undefined)
                    configs.url = data;
            } else if (data !== null && typeof data === "object")
                configs.data = null;

            this.load(data, element);
        }

        this.ajax = function () {
            const configs = this.configs;
            if (configs.url == undefined || configs.url == null) {
                return;
            }

            configs.setOverlayStatus("busy");
            var requetMethod = configs.type ? configs.type : configs.method;
            $.ajax({
                url: configs.url,
                type: requetMethod,
                headers: { 'Accept': 'application/json' },
                //contentType: "application/json",
                data: configs.data,
                crossDomain: true,
                beforeSend: function () {
                    if (typeof configs.beforeSend === 'function')
                        configs.beforeSend(element);
                },
                success: function (data) {
                    element.data($.AsyncLoad.pluginIndex).load(data, element);
                },
                error: function (xhr, textStatus, errorThrown) {
                    configs.setOverlayStatus("error");
                    configs.onerror(element, textStatus, errorThrown, xhr);
                }
            })
        }

        $.fn.AsyncReload = function (newUrlOrData) {
            return this.each(function () {
                const $this = $(this);
                if ($this.data($.AsyncLoad.pluginIndex) != undefined) {
                    $this.data($.AsyncLoad.pluginIndex).reload(newUrlOrData, $this);
                } else
                    console.error("AsyncLoad not initialized for this element", this)
            })
        };
        
        this.init();
    }

    $.fn.AsyncLoad = function (options) {
        return this.each(function () {
            const $this = $(this);
            if ($this.data($.AsyncLoad.pluginIndex) == undefined) {
                $this.data($.AsyncLoad.pluginIndex, new $.AsyncLoad($this, options))
            } else {
                $this.data($.AsyncLoad.pluginIndex).reInit($this, options)
            }
        });
    }

    $.fn.AsyncState = function (state = "busy", options) {
        var st, ops = options;
        if (state !== undefined && typeof state === "string")
            st = state;

        if (state !== undefined && typeof state === "object") {
            st = "busy";
            ops = state;
        }

        return this.each(function () {
            const $this = $(this);
            if ($this.data($.AsyncLoad.pluginIndex) === undefined)
                $this.data($.AsyncLoad.pluginIndex, new $.AsyncLoad($this, ops));

            if (ops != undefined && typeof ops === 'object')
                $.extend(true, $this.data($.AsyncLoad.pluginIndex).configs, ops);

            $this.data($.AsyncLoad.pluginIndex).configs.setOverlayStatus(st);
        });
    }

    $.fn.AsyncConfig = function (configs) {
        return this.each(function () {
            const $this = $(this);
            var plugin = $this.data($.AsyncLoad.pluginIndex);
            if (plugin === undefined) {
                plugin = new $.AsyncLoad($this, configs);
                $this.data($.AsyncLoad.pluginIndex, plugin);
            } else {
                $.extend(true, plugin.configs, configs);
            }
        });
    }
    
    $.fn.AsyncAdhocWork = function (work) {
        return this.each(function () {
            const $this = $(this);
            var plugin = $this.data($.AsyncLoad.pluginIndex);
            if (plugin === undefined) {
                console.error("AsyncLoad plugin not initialized on this element", this);
                return;
            } else if (!work || !work['onload'] || typeof work['onload'] !== 'function') {
                console.error("no work provided to the element or onload method does not exist", work);
                return;
            }

            var doHeavyWork = function() {
                if (work['onpreload'] && typeof work['onpreload'] === 'function') {
                    var r = work.onpreload($this);
                    if (r !== undefined && (r === false || (typeof r === 'string' && r.length > 0) || Boolean(r))) {
                        var c = (typeof r === 'string' && r.length > 0) ? { error: r } : null;
                        plugin.configs.setOverlayStatus('error', c);
                        return false;
                    }
                }

                var r = work.onload($this);
                if (r !== undefined && (r === false || (typeof r === 'string' && r.length > 0) || Boolean(r))) {
                    var c = (typeof r === 'string' && r.length > 0) ? { error: r } : null;
                    plugin.configs.setOverlayStatus('error', c);
                    return false;
                }

                if (work['onpostload'] && typeof work['onpostload'] === 'function') {
                    var r = work.onpostload($this);
                    if (r !== undefined && (r === false || (typeof r === 'string' && r.length > 0) || Boolean(r))) {
                        var c = (typeof r === 'string' && r.length > 0) ? { error: r } : null;
                        plugin.configs.setOverlayStatus('error', c);
                        return false;
                    }
                }
                return true;
            }
            
            var scrollConfig = work['scrollTo'];
            var scroll = scrollConfig && ((scrollConfig['enable'] !== undefined) ? scrollConfig['enable'] : true);
            var am = work['auto'] ? Boolean(work['auto']) : !scroll;

            if (am) plugin.configs.setOverlayStatus('busy');

            if (scroll) {
                plugin.configs.setOverlayStatus('busy');
                var currentPosition = document.documentElement.scrollTop || document.body.scrollTop;
                var position = scrollConfig['position'] || 'center';
                var returnPosition = scrollConfig['returnTo'] || false;
                var speed = scrollConfig['speed'] || 500;
                var windowHeight = $(window).height();
                var cardHeight = $this.height();

                var getOffset = function (position) {
                    if (!position)
                        return null;

                    var offset;
                    if (position === 'center') {
                        var el = $this.find('.overlay i').first();
                        var elOffset = el.offset().top;
                        var elHeight = el.height();
                        offset = (elHeight < windowHeight) ?
                            elOffset - ((windowHeight / 2) - (elHeight / 2)) : elOffset;
                    } else if (position === 'top') {
                        var elOffset = $this.offset().top;
                        var elHeight = $this.height();
                        offset = elOffset;
                    } else if (position === 'bottom') {
                        var elOffset = $this.offset().top;
                        var elHeight = $this.height();
                        offset = elOffset + elHeight;
                    }
                    return offset;
                }

                $('html, body').animate({ scrollTop: getOffset(position) }, speed, function () {
                    if (doHeavyWork) {
                        var result = doHeavyWork();
                        doHeavyWork = null;
                        if (result) {
                            plugin.configs.
                                setOverlayStatus('done');
                        } else
                            returnPosition = 'center';

                        if (returnPosition && cardHeight > windowHeight) {
                            var retPos = returnPosition === 'current' ? currentPosition : getOffset(returnPosition);
                            if (retPos) {
                                setTimeout(() => {
                                    $('html, body')
                                        .animate({ scrollTop: retPos }, speed);
                                }, 50)
                            }
                        }
                    }
                });
            } else
                setTimeout(function () {
                    if (am && doHeavyWork()) plugin.configs
                        .setOverlayStatus('done');
                }, 10)
        });
    }

    $(window).ready(function () {
        $(window).scroll(function () {
            for (var key in $.AsyncLoad.lazyCandidates) {
                if ($.AsyncLoad.lazyCandidates[key].visible()) {
                    //In order to intantly load the card as comes into the view
                    //$.AsyncLoad.lazyCandidates[key].data($.AsyncLoad.pluginIndex)
                    //    .load(null, $.AsyncLoad.lazyCandidates[key]);
                    setTimeout(function (elm) {
                        if (elm.visible(false))
                            elm.data($.AsyncLoad.pluginIndex).load(null, elm)
                        else
                            $.AsyncLoad.lazyCandidates[elm.attr('id')] = elm;
                    }, 800, $.AsyncLoad.lazyCandidates[key])
                    delete $.AsyncLoad.lazyCandidates[key];
                }
            }
        })
    });

    $.AsyncLoad.generateId = function (elm) {
        var id = "elm-" + (Math.random() + "").substr(2);
        if (elm) $(elm).attr('id', id);
        return id;
    }
    
    $.AsyncLoad.ensureId = function (elm) {
        if (elm == null || elm == undefined)
            return null;

        var id = $(elm).attr('id');
        if (id === undefined) {
            id = "elm-" + (Math.random() + "").substr(2);
            $(elm).attr('id', id);
        }
        return id;
    }

    $.AsyncLoad.pluginIndex = "AsyncLoad";
    $.AsyncLoad.lazyCandidates = {};
    $.AsyncLoad.config = {};

}( jQuery, document, window));