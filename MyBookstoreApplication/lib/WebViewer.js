
/**
 *The namespace reserved for PDFTron technologies
 *@namespace PDFTron PDFTron namespace
 */
var PDFTron = PDFTron || {};

if (typeof console === "undefined") {
    window.console = {
        log: function() {
        },
        warn: function() {
        },
        error: function() {
        }
    };
}

/**
 * Creates a WebViewer instance and embeds it on the HTML page.
 *
 * @class PDFTron.WebViewer Represents a WebViewer which is a document viewer built using either HTML5, Silverlight or Flash technologies.
 * @param {PDFTron.WebViewer.Options} options options passed to the specific WebViewer.
 * @example e.g. 
 *var viewerElement = document.getElementById('viewer');
 *myWebViewer = new PDFTron.WebViewer({
 *	type: "html5,html5Mobile,silverlight,flash",
 *	initialDoc : "/host/GettingStarted.xod",
 *	enableAnnotations: true,
 *	streaming : false
 * 	}, viewerElement);
 * @param element the html element that will contain the web viewer (e.g. the <div> element that will be parent of the WebViewer). This can be obtained through document.getElementById(), or through JQuery selector.
 * @return {PDFTron.WebViewer}  the instance of the WebViewer class
 */
PDFTron.WebViewer = function WebViewer(options, element) {
    this.options = $.extend(true, {}, PDFTron.WebViewer.Options, options);
    //set up alternate viewer paths.
    if (typeof options.path !== 'undefined') {
        //alternate path provided
        var lastCharIndex = this.options.path.length - 1;
        if (lastCharIndex > 0 && this.options.path[lastCharIndex] !== '/') {
            this.options.path += '/';
        }
        this.options.flashPath = this.options.path + this.options.flashPath;
        this.options.html5Path = this.options.path + this.options.html5Path;
        this.options.html5MobilePath = this.options.path + this.options.html5MobilePath;
        this.options.silverlightPath = this.options.path + this.options.silverlightPath;
    }

    this.element = element;
    $(this.element).css('overflow', 'hidden');


    if (this.options.autoCreate) {
        this.create();
    }

//    var me = this;  
//    if (typeof this.options.initialDoc !== 'undefined') {
//        var docPath = this._correctRelativePath(this.options.initialDoc);
//        docPath = encodeURIComponent(docPath); //url-encode the doc path
//        this.options.initialDoc = docPath;
//        this._create();
//    } else if (typeof this.options.cloudApiId !== 'undefined') {    
//        $.get('https://api.pdftron.com/v2/download/' + this.options.cloudApiId + "?type=xod&redirect=false" , function(data) {
//            if (typeof data.url === "undefined") {
//                me.loadErrorPage();       
//            } else {
//                me.options.initialDoc = encodeURIComponent(data.url);
//                me._create();    
//            }
//        }, 'json')
//        .error(function() {
//            me.loadErrorPage();       
//        });   
//    }

}


PDFTron.WebViewer.prototype = {
    version: '1.7.1',
    create: function() {
        var me = this;
        if (typeof this.options.initialDoc !== 'undefined') {
            var docPath = this._correctRelativePath(this.options.initialDoc);
            docPath = encodeURIComponent(docPath); //url-encode the doc path
            this.options.initialDoc = docPath;
            this._create();
        } else if (typeof this.options.cloudApiId !== 'undefined') {
            $.get('https://api.pdftron.com/v2/download/' + this.options.cloudApiId + "?type=xod&redirect=false", function(data) {
                if (typeof data.url === "undefined") {
                    me.loadErrorPage();
                } else {
                    me.options.initialDoc = encodeURIComponent(data.url);
                    me._create();
                }
            }, 'json')
                    .error(function() {
                        me.loadErrorPage();
                    });
        }
    },
    _create: function() {
        //called by the constructor only once
        var me = this;
        me.rcId = (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1); //random id
        if ((typeof this._trigger) === 'undefined') {
            this._trigger = function(type, event, data1, data2) {
                //data = data || {};
                event = $.Event(event);
                event.type = type;
                // the original event may come from any element
                // so we need to reset the target on the new event
                event.target = $(this.element)[ 0 ];
                //event.data = data;
                var data = [];
                if (typeof data1 !== 'undefined') {
                    data.push(data1);
                }
                if (typeof data2 !== 'undefined') {
                    data.push(data2);
                }
                $(this.element).trigger(event, data);
            };
        }

        //get the selected type
        var viewers = this.options.type.replace(' ', '').split(",");
        if (viewers.length < 1)
            viewers[0] = "html5"; //use html5 as default

        me._flashVer = "10.2";
        // FABridgeId has to match FABridgeId in swf file
        me._flashFABridgeId = "ReaderControl";
        me._silverlightVer = "4.0";
        me._createViewer(viewers);

    },
    _createViewer: function(viewers) {
        var me = this;
        me.selectedType = "none";
        if (this.isMobileDevice()) {
            viewers = Array("html5Mobile");
            me.selectedType = "html5Mobile";

            if (this.options.mobileRedirect) {
                // if mobile device is detected, only the html5mobile (redirect) is allowed
                var newLocation = this.options.html5MobilePath + this._getHTML5OptionsURL();
                window.location = newLocation;
                return; //redirect to newLocation
            }
        }
        var allowHTML5 = false;
        var allowSilverlight = false;
        var allowFlash = false;

        for (var i = 0; i < viewers.length; i++) {
            if (viewers[i].toLowerCase() === "html5mobile") {
                allowHTML5 = true;
                if (me._testHTML5() && (me.isSameOrigin(decodeURIComponent(me.options.initialDoc)) || me._testCORS())) {
                    me.selectedType = "html5Mobile";
                    break;
                }
            }
            if (viewers[i].toLowerCase() === "html5") {
                allowHTML5 = true;
                if (me._testHTML5()) {
                    var sameOrigin = me.isSameOrigin(decodeURIComponent(me.options.initialDoc));
                    if (sameOrigin || (me._testCORS() || me._testSilverlight(me._silverlightVer))) {
                        //if not same origin, need to support xdomain access, either through CORS or silverlight part retreiver.
                        me.selectedType = "html5";
                        break;
                    }
                }
            }
            else if (viewers[i].toLowerCase() === "silverlight") {
                allowSilverlight = true;
                if (me._testSilverlight(me._silverlightVer)) {
                    me.selectedType = "silverlight";
                    break;
                }
            }
            else if (viewers[i].toLowerCase() === "flash") {
                allowFlash = true;
                if (me._testFlash(me._flashVer)) {
                    me.selectedType = "flash";
                    break;
                }
            }
        }
        if (me.selectedType === "html5") {
            if (this.options.html5Options) {
                $.extend(this.options, this.options.html5Options);
            }
            me._createHTML5();
        } else if (me.selectedType === "html5Mobile") {
            if (this.options.html5MobileOptions) {
                $.extend(this.options, this.options.html5MobileOptions);
            }
            me._createHTML5Mobile();
        } else if (me.selectedType === "silverlight") {
            if (this.options.silverlightOptions) {
                $.extend(this.options, this.options.silverlightOptions);
            }
            me._createSilverlight();
        } else if (me.selectedType === "flash") {
            if (this.options.flashOptions) {
                $.extend(this.options, this.options.flashOptions);
            }
            me._createFlash();
        } else {
            var supportErrorArray = new Array();
            supportErrorArray.push("Please");
            if (allowHTML5) {
                supportErrorArray.push("use an HTML5 compatible browser");
                if (allowSilverlight || allowFlash) {
                    supportErrorArray.push("or");
                }
            }

            if (allowSilverlight || allowFlash) {
                var runtimesStr = "(" + (allowSilverlight ? "Silverlight" : '') + (allowSilverlight && allowFlash ? " or " : '') + (allowFlash ? "Flash" : '') + ")";
                supportErrorArray.push("install the necessary runtime " + runtimesStr);
            }

            $(me.element).append("<div id=\"webviewer-browser-unsupported\">" + (supportErrorArray.join(' ')) + ".</div>");
        }
    },
    _viewerLoaded: function(iframe) {
        var me = this;
        me._trigger('ready');

        var viewerWindow = iframe.contentWindow;

        if (typeof me.options.encryption !== "undefined") {
            var decrypt = viewerWindow.CoreControls.Encryption.Decrypt;
            var doc = decodeURIComponent(me.options.initialDoc);

            var streaming = me.options.streaming;

            viewerWindow.ControlUtils.byteRangeCheck(function(status) {
                // if the range header is supported then we will receive a status of 206
                if (status === 200) {
                    streaming = true;
                }
                me.instance.loadDocument(doc, streaming, decrypt, me.options.encryption);

            }, function() {
                // some browsers that don't support the range header will return an error
                streaming = true;
                me.instance.loadDocument(doc, streaming, decrypt, me.options.encryption);
            });
        }

        if (me.instance.docViewer.GetDocument() == null) {
            //note, we need bind using the iframe window's instance of jQuery
            viewerWindow.$(iframe.contentDocument).bind('documentLoaded', function(event) {
                me._trigger(event.type);
            });
        } else {
            //a document is already loaded, trigger the documentLoaded event directly
            me._trigger('documentLoaded');
        }

        //bind the rest of the events/callbacks here 
        viewerWindow.$(iframe.contentDocument).bind
                ('displayModeChanged layoutModeChanged zoomChanged pageChanged fitModeChanged toolModeChanged printProgressChanged',
                        function(event, data1, data2) {
                            //relay event
                            me._trigger(event.type, null, data1, data2);
                        });
    },
    _getHTML5OptionsURL: function() {
        var options = this.options;
        var url = "";

        if (typeof options.initialDoc !== 'undefined') {
            url += "#d=" + options.initialDoc;
            if (options.streaming) {
                url += "&streaming=true";
            }
            if (options.encryption) {
                // we want to stop the document from automatically loading if it's encrypted as we'll do that later passing the options to it
                url += "&auto_load=false";
            }
            if (options.enableAnnotations) {
                url += "&a=1";
            }
            if (typeof options.serverUrl !== 'undefined') {
                var serverUrl = this._correctRelativePath(options.serverUrl);
                serverUrl = encodeURIComponent(serverUrl);
                url += "&server_url=" + serverUrl;
            }
            if (typeof options.documentId !== 'undefined') {
                url += "&did=" + options.documentId;
            }
            if (typeof options.config !== 'undefined') {
                var config = this._correctRelativePath(options.config);
                config = encodeURIComponent(config);
                url += "&config=" + config;
            }
            if (options.enableOfflineMode) {
                url += "&offline=1";
            }
            if (options.startOffline) {
                url += "&startOffline=1";
            }
            if (options.enableReadOnlyMode) {
                url += "&readonly=1";
            }
            if (typeof options.annotationUser !== 'undefined') {
                url += "&user=" + options.annotationUser;
            }
            if (typeof options.annotationAdmin !== 'undefined') {
                url += "&admin=" + (options.annotationAdmin ? 1 : 0);
            }
            if (typeof options.custom !== "undefined") {
                url += "&custom=" + encodeURIComponent(options.custom);
            }
            if (typeof options.showToolbarControl !== "undefined") {
                url += "&toolbar=" + (options.showToolbarControl ? "true" : "false");
            }
        }
        return url;
    },
    _createHTML5: function() {
        var me = this;
        var iframeSource = this.options.html5Path + this._getHTML5OptionsURL();
        //var ieVer = me.getInternetExplorerVersion();

        if (!me.isSameOrigin(decodeURIComponent(me.options.initialDoc)) && !me._testCORS() && this._testSilverlight(me._silverlightVer)) {
            //use Silverlight part retriever wokraround for IE9
            iframeSource += "&useSilverlightRequests=true";
        }

        //_getHTML5OptionsURL
        var $rcFrame = $(document.createElement('iframe'));
        $rcFrame.attr({
            id: this.rcId,
            src: iframeSource,
            frameborder: 0,
            width: "100%",
            height: "100%",
            allowFullScreen: true,
            webkitallowfullscreen: true,
            mozallowfullscreen: true
        });

        var outerWindow = window;

        $rcFrame.load(function() {
            me.instance = this.contentWindow.readerControl;


            //same the namespaces to the outer window
            outerWindow.CoreControls = outerWindow.CoreControls || {};
            outerWindow.CoreControls.DisplayModes = this.contentWindow.CoreControls.DisplayModes;

            outerWindow.Tools = this.contentWindow.Tools;

            var iframe = this;

            if (typeof me.instance === "undefined") {
                this.contentWindow.$(this.contentDocument).bind('viewerLoaded', function(event) {
                    me.instance = iframe.contentWindow.readerControl;
                    me._viewerLoaded(iframe);
                });
            } else {
                me._viewerLoaded(iframe);
            }
        });

        $(this.element).append($rcFrame);
        return $rcFrame;
    },
    _createHTML5Mobile: function() {
        // use the correct type if mobile
        var me = this;
        var iframeSource = this.options.html5MobilePath + this._getHTML5OptionsURL();

        var $rcFrame = $(document.createElement('iframe'));
        $rcFrame.attr({
            id: this.rcId,
            src: iframeSource,
            frameborder: 0
                    //            width: "100%",
                    //            height: "100%"
        });
        $rcFrame.css('width', '100%').css("height", "100%");
        $rcFrame.load(function() {
            me.instance = this.contentWindow.readerControl;

            var iframe = this;

            if (typeof me.instance === "undefined") {
                this.contentWindow.$(this.contentDocument).bind('viewerLoaded', function(event) {
                    me.instance = iframe.contentWindow.readerControl;
                    me._viewerLoaded(iframe);
                });
            } else {
                me._viewerLoaded(iframe);
            }
        });
        $(this.element).append($rcFrame);
        //$(this.element).load(iframeSource);
        return $rcFrame;
    },
    _getSilverlightInitParam: function() {
        var options = this.options;
        var initParam = "";

//        if (options.showSilverlightControls) {
//            initParam += "UseJavaScript=false";
//        }
//        else {
//            initParam += "UseJavaScript=true";
//        }

        initParam += "ShowToolbarControl=" + (options.showToolbarControl ? 'true' : 'false');

        if (typeof options.initialDoc !== 'undefined') {
            initParam += ",DocumentUri=" + (function decode(str) {
                return unescape(str.replace(/\+/g, " "));
            })(options.initialDoc);

            if (options.streaming) {
                initParam += ",Streaming=true";
            }
            else {
                initParam += ",Streaming=false";
            }
            if (options.enableAnnotations) {
                initParam += ",a=true";
            } else {
                initParam += ",a=false";
            }
            if (typeof options.serverUrl !== 'undefined') {
                var serverUrl = this._correctRelativePath(options.serverUrl);
                initParam += ",server_url=" + serverUrl;
            }
            if (typeof options.documentId !== 'undefined') {
                initParam += ",did=" + options.documentId;
            }
            if (typeof options.config !== 'undefined') {
                initParam += ",config=" + options.config;
            }
            if (options.enableOfflineMode) {
                initParam += ",offline=true";
            }
            if (options.enableReadOnlyMode) {
                initParam += ",readonly=true";
            }
            if (typeof options.annotationUser !== 'undefined') {
                initParam += ",user=" + options.annotationUser;
            }
            if (typeof options.annotationAdmin !== 'undefined') {
                if (options.annotationAdmin) {
                    initParam += ",admin=true";
                }
                else {
                    initParam += ",admin=false";
                }
            }
            if (typeof options.custom !== 'undefined') {
                initParam += ",custom=" + encodeURIComponent(options.custom);
            }
            if (typeof options.nogui) {
                initParam += ",nogui=" + options.nogui;
            }
        }
        return initParam;
    },
    _createSilverlight: function() {
        var me = this;
        var options = this.options;
        var initParam = this._getSilverlightInitParam();

        var objectParams = {
            'source': options.silverlightPath,
            //'background': 'white',
            //'background': 'transparent',
            //'background': 'darkgrey',
            'minRuntimeVersion': '4.0.50401.0',
            'autoUpgrade': 'true'
        };
        $.extend(objectParams, options.silverlightObjectParams);

        var objectElement = Silverlight.createObject(options.silverlightPath, null, me.rcId, objectParams, {
            onLoad: function(sender, args) {
                //args is always null
                me.instance = sender.Content.ReaderControl;
                me.instance.EnableAnnotations = options.enableAnnotations;
                me.instance.onPropertyChanged = function(sender2, args2) {
                    switch (args2.name) {
                        case "CurrentPageNumber":
                            me._trigger('pageChanged', null, {
                                pageNumber: args2.pageNumber
                            });
                            break;
                        case "DisplayMode":
                            me._trigger('displayModeChanged');
                            break;
                        case "LayoutMode":
                            me._trigger('layoutModeChanged');
                            break;
                        case "Zoom":
                            me._trigger('zoomChanged');
                            break;
                        case "FitMode":
                            me._trigger('fitModeChanged');
                            break;
                        case "ToolMode":
                            me._trigger('toolModeChanged');
                            break;
                    }
                };
                me._trigger('ready');

                //we assume onDocumentLoaded will not have been called before this point
                me.instance.onDocumentLoaded = function(sender3, args3) {
                    me._trigger('documentLoaded');
                };

            },
            onError: function() {
                console.error("Silverlight onError");
            }
        }, initParam, null);
        $(objectElement).attr({
            'width': '100%',
            'height': '100%'
        }).appendTo(me.element);

    },
    _createFlash: function() {
        var me = this;
        var options = this.options;
        var swfUrlStr = options.flashPath;
        var flashObj = document.createElement("object");
        flashObj.setAttribute("id", me.rcId);
        $(flashObj).appendTo(me.element);
        var xiSwfUrl = ""; // flash player installer
        var flashvars = {};
        flashvars.bridgeName = me._flashFABridgeId;
        if (options.initialDoc !== undefined)
        {
            flashvars.d = options.initialDoc;
        }
        if (options.streaming !== undefined)
        {
            flashvars.streaming = options.streaming;
        }
        flashvars.showToolbarControl = options.showToolbarControl;
        ///////////////////////////////////////////////////////////////////////////////////
        // to use Flash Sockets (HttpPartRetriever) switch the NonStreamingMode to SOCKETS.
        // See flash/README.rtf for more details.
        if (options.flashSockets === true)
        {   
            flashvars.NonStreamingMode = 'SOCKETS';
        } else {
            flashvars.NonStreamingMode = 'AJAX';
        }
        
        ///////////////////////////////////////////////////////////////////////////////////
        var params = {};
        ///////////////////////////////////////////////////////////////////////////////////
        // Control full screen mode using these options.
        //params.allowfullscreen = "false"              // disable full screen
        params.allowfullscreen = "true";                // keyboard input disabled 
        params.allowFullScreenInteractive = "true";     // requires Flash Player 11.3+
        ///////////////////////////////////////////////////////////////////////////////////
        
        if (!me.isSameOrigin(decodeURIComponent(me.options.initialDoc)) && !me._testCORS() && flashvars.NonStreamingMode === "AJAX") {
            //we cannot use AJAX in this case, fallback to streaming 
            flashvars.streaming = true;
        }
        
        var attributes = {};
        attributes.id = me._flashFABridgeId;
        attributes.name = me._flashFABridgeId;

        if (typeof options.encryption !== "undefined") {
            // this has to be called before embedSWF
            createHttpAjaxPartRetriever(me._flashFABridgeId, decodeURIComponent(flashvars.d), window.CoreControls.Encryption.DecryptSynchronous, options.encryption);
        }

        swfobject.embedSWF(swfUrlStr, me.rcId, "100%", "100%", me._flashVer, xiSwfUrl, flashvars, params, attributes,
                function(e) {
                    if (e.success) {
                        FABridge.addInitializationCallback(me._flashFABridgeId, function(e) {
                            me.instance = FABridge.ReaderControl.root();

                            var _cb = function(event)
                            {
                                me._trigger(event.getType());
                            }
                            var _errorcb = function(event)
                            {
                                console.error(event.getText());
                            }

                            me.instance.addEventListener('zoomChanged', _cb);
                            me.instance.addEventListener('pageChanged', _cb);
                            me.instance.addEventListener('displayModeChanged', _cb);
                            me.instance.addEventListener('fitModeChanged', _cb);
                            me.instance.addEventListener('toolModeChanged', _cb);
                            me.instance.addEventListener('errorEvent', _errorcb);
                            
                            me._trigger('ready');
                            if (me.instance.IsDocLoaded()) {
                                me._trigger('documentLoaded');
                            }
                            else {
                                me.instance.addEventListener('documentLoaded', function(event) {
                                    me._trigger('documentLoaded');
                                });
                            }
                        });
                    }
                    else {
                        console.error("swfobject.embedSWF failed");
                    }
                }
        );
    },
    _init: function() {
        //console.log("_init");
    },
    /**
     * Gets the instance of the ReaderControl object loaded by WebViewer.
     * @return a ReaderControl instance 
     */
    getInstance: function() {
        return (this.instance);
    },
    loadErrorPage: function() {
        if (typeof this.options.errorPage === 'undefined') {
            $(this.element).append("<h2 style='text-align:center;margin-top:100px'>We're sorry, an error has occurred.</h2>");
        } else {
            $(this.element).load(this.options.errorPage);
        }
    },
    /**
     * Gets the visibility of the default side window.
     * Not supported for mobile viewer.
     * @returns {boolean} true if the side window is visible.
     */
    getSideWindowVisibility: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            return this.getInstance().getShowSideWindow();

        } else if (this.selectedType === "silverlight" || this.selectedType === "flash") {
            return (this.getInstance().GetShowSideWindow());
        }
    },
    /**
     * Gets the visibility of the default side window.
     * Not supported for mobile viewer.
     * 
     * @param {boolean} value true to show the side window
     */
    setSideWindowVisibility: function(value) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setShowSideWindow(value);
        }
        else if (this.selectedType === "silverlight") {
            this.getInstance().SetShowSideWindow(value);
        }
        else if (this.selectedType === "flash") {
            this.getInstance().SetShowSideWindow(value);
        }
    },
    /**
     * Gets the value whether the side window is visible or not.
     * Not supported for mobile viewer.
     * @return true if the side window is shown
     * @deprecated since version 1.7. Replaced by {@link PDFTron.WebViewer#getSideWindowVisibility}.
     */
    getShowSideWindow: function() {
        return this.getSideWindowVisibility();
    },
    /**
     * Sets the value whether the side window is visible or not.
     * Not supported for mobile viewer.
     * @param value true to show the side window
     * @deprecated since 1.7. Replaced by {@link PDFTron.WebViewer#setShowSideWindow}.
     */
    setShowSideWindow: function(value) {
        this.setSideWindowVisibility(value);
    },
    /**
     * Gets the visibilty of the default toolbar control.
     * @returns {boolean} true if the toolbar is visible.
     */
    getToolbarVisibility: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            console.warn("Unsupported method getToolbarVisibility");
        }
        else if (this.selectedType === "silverlight") {
            this.getInstance().getShowToolbar();
        }
        else if (this.selectedType === "flash") {
            console.warn("Unsupported method getToolbarVisibility");
        }
    },
    /**
     * Sets the visibilty of the default toolbar control.
     * @param {boolean} isVisible true if the toolbar is visible.
     */
    setToolbarVisibility: function(isVisible) {
        if (this.selectedType === "html5") {
            this.getInstance().setToolbarVisibility(isVisible);
        }
        else if (this.selectedType === "silverlight") {
            console.warn("Unsupported method setToolbarVisibility");
        }
        else if (this.selectedType === "flash") {
            this.getInstance().SetToolbarVisibility(isVisible);
        }
    },
    /**
     * Gets the current page number of the document loaded in the WebViewer.
     * @return the current page number of the document
     */
    getCurrentPageNumber: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            return this.getInstance().getCurrentPageNumber();

        } else if (this.selectedType === "flash") {
            return this.getInstance().GetCurrentPage();

        } else if (this.selectedType === "silverlight") {
            return this.instance.CurrentPageNumber;
        }
    },
    /**
     * Sets the current page number of the document loaded in the WebViewer.
     * @param pageNumber the page number of the document to set
     */
    setCurrentPageNumber: function(pageNumber) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setCurrentPageNumber(pageNumber);
        } else if (this.selectedType === "flash") {
            this.getInstance().SetCurrentPage(pageNumber);
        } else if (this.selectedType === "silverlight") {
            this.getInstance().CurrentPageNumber = pageNumber;
        }
    },
    /**
     * Gets the total number of pages of the loaded document.
     * @return the total number of pages of the loaded document
     */
    getPageCount: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            return this.getInstance().getPageCount();

        } else if (this.selectedType === "flash") {
            return this.getInstance().GetPageCount();

        } else if (this.selectedType === "silverlight") {
            return this.getInstance().PageCount;
        }
    },
    /**
     * Gets the zoom level of the document.
     * @return {number} the zoom level of the document
     */
    getZoomLevel: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            return this.getInstance().getZoomLevel();

        } else if (this.selectedType === "flash") {
            return this.getInstance().GetZoomLevel();

        } else if (this.selectedType === "silverlight") {
            return this.getInstance().ZoomLevel;
        }
    },
    /**
     * Sets the zoom level of the document.
     * @param zoomLevel the new zoom level to set
     */
    setZoomLevel: function(zoomLevel) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setZoomLevel(zoomLevel);

        } else if (this.selectedType === "flash") {
            this.getInstance().SetZoomLevel(zoomLevel);

        } else if (this.selectedType === "silverlight") {
            this.getInstance().ZoomLevel = zoomLevel;
        }
    },
    /**
     * Rotates the document in the WebViewer clockwise.
     * Not supported for mobile viewer.
     */
    rotateClockwise: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().rotateClockwise();

        } else if (this.selectedType === "flash") {
            this.getInstance().RotateClockwise();

        } else if (this.selectedType === "silverlight") {
            this.getInstance().RotateClockwise();
        }
    },
    /**
     * Rotates the document in the WebViewer counter-clockwise.
     * Not supported for mobile viewer.
     */
    rotateCounterClockwise: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().rotateCounterClockwise();

        } else if (this.selectedType === "flash") {
            this.getInstance().RotateCounterClockwise();

        } else if (this.selectedType === "silverlight") {
            this.getInstance().RotateCounterClockwise();
        }
    },
    /**
     * Gets the layout mode of the document in the WebViewer.
     * Not supported for mobile viewer.
     * @return {PDFTron.WebViewer.LayoutMode} the layout mode of the document
     */
    getLayoutMode: function() {
        if (this.selectedType === "html5") {
            var layoutMode = this.getInstance().getLayoutMode();
            var displayModes = CoreControls.DisplayModes;

            // the HTML5 viewer has different naming schemes for this
            if (layoutMode === displayModes.Single) {
                return PDFTron.WebViewer.LayoutMode.Single;
            } else if (layoutMode === displayModes.Continuous) {
                return PDFTron.WebViewer.LayoutMode.Continuous;
            } else if (layoutMode === displayModes.Facing) {
                return PDFTron.WebViewer.LayoutMode.Facing;
            } else if (layoutMode === displayModes.FacingContinuous) {
                return PDFTron.WebViewer.LayoutMode.FacingContinuous;
            } else if (layoutMode === displayModes.Cover) {
                return PDFTron.WebViewer.LayoutMode.FacingCoverContinuous;
            } else if (layoutMode === displayModes.CoverFacing) {
                return PDFTron.WebViewer.LayoutMode.FacingCover;
            } else {
                return undefined;
            }
        }
        // else if(this.selectedType == "html5Mobile"){
        //     var ppw = this.getInstance().nPagesPerWrapper;
        //     if(ppw == 1){
        //         return PDFTron.WebViewer.LayoutMode.Single;
        //     }else if(ppw ==2){
        //         return PDFTron.WebViewer.LayoutMode.Facing;
        //     }
        // }
        else if (this.selectedType === "html5Mobile") {
            this.getInstance().getLayoutMode();
        } else if (this.selectedType === "silverlight" || this.selectedType === "flash") {
            var layoutMode = this.getInstance().GetLayoutMode();
            if (layoutMode === "FacingCoverContinuous") {
                layoutMode = PDFTron.WebViewer.LayoutMode.FacingCoverContinuous;
            } else if (layoutMode === "FacingContinuous") {
                layoutMode = PDFTron.WebViewer.LayoutMode.FacingContinuous;
            }
            return layoutMode;

        }
    },
    /**
     * Sets the layout mode of the document in the WebViewer.
     * Not supported for mobile viewer.
     * @param {PDFTron.WebViewer.LayoutMode} layoutMode the layout mode to set.
     */
    setLayoutMode: function(layoutMode) {
        if (this.selectedType === "html5") {
            var displayModes = CoreControls.DisplayModes;

            var displayMode = displayModes.Continuous;

            // the HTML5 viewer have different naming schemes for this
            if (layoutMode === PDFTron.WebViewer.LayoutMode.Single) {
                displayMode = displayModes.Single;
            } else if (layoutMode === PDFTron.WebViewer.LayoutMode.Continuous) {
                displayMode = displayModes.Continuous;
            } else if (layoutMode === PDFTron.WebViewer.LayoutMode.Facing) {
                displayMode = displayModes.Facing;
            } else if (layoutMode === PDFTron.WebViewer.LayoutMode.FacingContinuous) {
                displayMode = displayModes.FacingContinuous;
            } else if (layoutMode === PDFTron.WebViewer.LayoutMode.FacingCover) {
                displayMode = displayModes.CoverFacing;
                //displayMode = displayModes.Cover;
            } else if (layoutMode === PDFTron.WebViewer.LayoutMode.FacingCoverContinuous) {
                displayMode = displayModes.Cover;
                //displayMode = displayModes.CoverContinuous;
            }

            this.getInstance().setLayoutMode(displayMode);

        } else if (this.selectedType === "html5Mobile") {
            this.getInstance().setLayoutMode(layoutMode);

        } else if (this.selectedType === "silverlight" || this.selectedType === "flash") {
            if (layoutMode === PDFTron.WebViewer.LayoutMode.FacingCoverContinuous) {
                this.getInstance().SetLayoutMode("FacingCoverContinuous");
            } else {
                this.getInstance().SetLayoutMode(layoutMode);
            }
        }
    },
    /**
     * Gets the current tool mode of the WebViewer.
     * Not supported for mobile viewer.
     * @return {PDFTron.WebViewer.ToolMode} the current tool mode of the WebViewer
     */
    getToolMode: function() {
        if (this.selectedType === "html5") {
            return this.getInstance().getToolMode();
        } else if (this.selectedType === "html5Mobile") {
            return this.getInstance().getToolMode();

        } else if (this.selectedType === "silverlight" || this.selectedType === "flash") {
            return this.getInstance().GetToolMode();
        }
    },
    /**
     * Sets the tool mode of the WebViewer.
     * Not supported for mobile viewer.
     * @param {PDFTron.WebViewer.ToolMode} toolMode  must be one of the PDFTron.WebViewer.ToolMode
     */
    setToolMode: function(toolMode) {
        if (this.selectedType === "html5") {
            this.getInstance().setToolMode(toolMode);

        } else if (this.selectedType === "html5Mobile") {
            this.getInstance().setToolMode(toolMode);

        } else if (this.selectedType === "silverlight" || this.selectedType === "flash") {
            this.getInstance().SetToolMode(toolMode);
        }
    },
    /**
     * Controls if the document's Zoom property will be adjusted so that the width of the current page or panel
     * will exactly fit into the available space. 
     * Not supported for mobile viewer.
     * @deprecated since 1.7. Use {@link PDFTron.WebViewer#setFitMode} instead.
     */
    fitWidth: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().fitWidth();
        } else if (this.selectedType === "flash") {
            this.getInstance().FitWidth();

        } else if (this.selectedType === "silverlight") {
            this.getInstance().FitWidth();
        }
    },
    /**
     * Controls if the document's Zoom property will be adjusted so that the height of the current page or panel
     * will exactly fit into the available space. 
     * Not supported for mobile viewer.
     * @deprecated since 1.7. Use {@link PDFTron.WebViewer#setFitMode} instead.
     */
    fitHeight: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().fitHeight();

        } else if (this.selectedType === "flash") {
            console.warn("Unsupported method fitHeight.");

        } else if (this.selectedType === "silverlight") {
            this.getInstance().FitHeight();
        }
    },
    /**
     * Controls if the document's Zoom property will be adjusted so that the width and height of the current page or panel
     * will fit into the available space.
     * Not supported for mobile viewer.
     * @deprecated since 1.7. Use {@link PDFTron.WebViewer#setFitMode} instead.
     */
    fitPage: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().fitPage();

        } else if (this.selectedType === "flash") {
            this.getInstance().FitPage();
        } else if (this.selectedType === "silverlight") {
            this.getInstance().FitPage();
        }
    },
    /**
     * Gets the current fit mode of the viewer
     * @since version 1.7
     * @return {PDFTron.WebViewer.FitMode}
     */
    getFitMode: function() {
        if (this.selectedType === "html5") {
            var fitMode = this.getInstance().getFitMode();
            var FitModeEnums = this.getInstance().docViewer.FitMode;
            switch (fitMode) {
                case FitModeEnums.FitWidth:
                    return PDFTron.WebViewer.FitMode.FitWidth;
                case FitModeEnums.FitHeight:
                    return PDFTron.WebViewer.FitMode.FitHeight;
                case FitModeEnums.FitPage:
                    return PDFTron.WebViewer.FitMode.FitPage;
                case FitModeEnums.Zoom:
                    return PDFTron.WebViewer.FitMode.Zoom;
                default:
                    console.warn("Unsupported method getFitMode");
            }
        } else if (this.selectedType === "silverlight") {
            return this.getInstance().getFitMode();
        } else if (this.selectedType === "flash") {
            var camel = this.getInstance().GetFitMode();
            return camel.charAt(0).toUpperCase()  + camel.slice(1);
        } else {
            console.warn("Unsupported method getFitMode");
        }
    },
    /**
     * Sets the fit mode of the viewer.
     * This is equivalent to calling the methods: fitWidth, fitHeight, fitPage, zoom
     * @param {PDFTron.WebViewer.FitMode} fitMode
     * @since version 1.7
     */
    setFitMode: function(fitMode) {
        if (fitMode === PDFTron.WebViewer.FitMode.FitWidth) {
            this.fitWidth();
        } else if (fitMode === PDFTron.WebViewer.FitMode.FitHeight) {  
            if (this.selectedType === "flash") {
                this.fitPage(); //flash does not have fit height
            }else{
                this.fitHeight();
            }
        } else if (fitMode === PDFTron.WebViewer.FitMode.FitPage) {
            this.fitPage();
        } else if (fitMode === PDFTron.WebViewer.FitMode.Zoom) {
            this.zoom();
        } else {
            console.warn("Unsupported fit mode: " + fitMode);
        }
    },
    /**
     * Controls if the document's Zoom property will be freely adjusted and not constrained with the width and height of the
     * current page or panel.
     * Not supported for mobile viewer.
     * @deprecated since 1.7. Use {@link PDFTron.WebViewer#setFitMode} instead.
     */
    zoom: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().fitZoom();

        } else if (this.selectedType === "flash") {
            this.getInstance().FitZoom();

        } else if (this.selectedType === "silverlight") {
            this.getInstance().Zoom();
        }
    },
    /**
     * Goes to the first page of the document. Makes the document viewer display the first page of the document.
     */
    goToFirstPage: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().goToFirstPage();

        } else if (this.selectedType === "flash") {
            this.getInstance().GoToFirstPage();

        } else if (this.selectedType === "silverlight") {
            this.getInstance().CurrentPageNumber = 1;
        }
    },
    /**
     * Goes to the last page of the document. Makes the document viewer display the last page of the document.
     */
    goToLastPage: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().goToLastPage();

        } else if (this.selectedType === "flash") {
            this.getInstance().GoToLastPage();

        } else if (this.selectedType === "silverlight") {
            var totalPages = this.getInstance().PageCount;
            this.getInstance().CurrentPageNumber = totalPages;
        }
    },
    /**
     * Goes to the next page of the document. Makes the document viewer display the next page of the document.
     */
    goToNextPage: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().goToNextPage();

        } else if (this.selectedType === "flash") {
            this.getInstance().GoToNextPage();

        } else if (this.selectedType === "silverlight") {
            var currentPage = this.getInstance().CurrentPageNumber;

            if (currentPage <= 0)
                return;

            currentPage = currentPage + 1;
            this.getInstance().CurrentPageNumber = currentPage;
        }
    },
    /**
     * Goes to the previous page of the document. Makes the document viewer display the previous page of the document.
     */
    goToPrevPage: function() {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().goToPrevPage();

        } else if (this.selectedType === "flash") {
            this.getInstance().GoToPrevPage();

        } else if (this.selectedType === "silverlight") {
            var currentPage = this.getInstance().CurrentPageNumber;

            if (currentPage <= 1)
                return;

            currentPage = currentPage - 1;
            this.getInstance().CurrentPageNumber = currentPage;
        }
    },
    /**
     * Loads a document to the WebViewer.
     * @param url url of the document to be loaded (relative urls may not work, it is recommended to use absolute urls)
     */
    loadDocument: function(url) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().loadDocument(this._correctRelativePath(url), this.options.streaming);
        } else {
            this.getInstance().LoadDocument(this._correctRelativePath(url), this.options.streaming);
        }
    },
    /**
     * Searches the loaded document finding for the matching pattern.
     *
     * Search mode includes:
     * <ul>
     * <li>None</li>
     * <li>CaseSensitive</li>
     * <li>WholeWord</li>
     * <li>SearchUp</li>
     * <li>PageStop</li>
     * <li>ProvideQuads</li>
     * <li>AmbientString</li>
     * </ul>
     *
     * @param pattern       the pattern to look for
     * @param searchMode    must one or a combination of the above search modes. To
     *                      combine search modes, simply pass them as comma separated
     *                      values in one string. i.e. "CaseSensitive,WholeWord"
     */
    searchText: function(pattern, searchModes) {
        var mode = 0;
        var modes = searchModes;
        if (typeof modes === 'string') {
            modes = searchModes.split(',');
        }
        if (typeof searchModes !== "undefined") {
            for (var i = 0; i < modes.length; i++) {
                if (searchModes[i] === "CaseSensitive") {
                    mode += 0x1;
                }
                else if (searchModes[i] === "WholeWord") {
                    mode += 0x2;
                }
                else if (searchModes[i] === "SearchUp") {
                    mode += 0x4;
                }
                else if (searchModes[i] === "PageStop") {
                    mode += 0x8;
                }
                else if (searchModes[i] === "ProvideQuads") {
                    mode += 0x10;
                }
                else if (searchModes[i] === "AmbientString") {
                    mode += 0x20;
                }
            }
        }

        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            if (typeof searchModes === 'undefined') {
                this.getInstance().searchText(pattern);
            } else {
                this.getInstance().searchText(pattern, mode);
            }

        }
        else if (this.selectedType === "silverlight") {
            var modeString = $.isArray(searchModes) ? searchModes.join(',') : searchModes;
            if (typeof modeString === 'undefined') {
                modeString = '';
            }
            this.getInstance().SearchText(pattern, modeString);
        }
        else if (this.selectedType === "flash") {
            if (typeof searchModes === 'undefined') {
                this.getInstance().SearchText(pattern, 0);
            } else {
                this.getInstance().SearchText(pattern, mode);
            }

        }
    },
    /**
     * Registers a callback when the document's page number is changed. (Silverlight only)
     * @param callback  the JavaScript function to invoke when the document page number is changed
     * @deprecated since version 1.5. Please use the pageChanged event instead.
     */
    setOnPageChangeCallback: function(callback) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setOnPageChangeCallback(callback);

        } else if (this.selectedType === "flash") {
            //alert("Not yet supported");
            console.warn("Unsupported method setOnPageChangeCallback");
        }
        else if (this.selectedType === "silverlight") {
            this.getInstance().OnPageChangeCallback = callback;
        }
    },
    /**
     * Registers a callback when the document's zoom level is changed. (Silverlight only)
     * @param callback the JavaScript function to invoke when the document zoom level is changed
     * @deprecated since version 1.5. Please use the zoomChanged event instead.
     */
    setOnPageZoomCallback: function(callback) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setOnPageZoomCallback(callback);

        } else if (this.selectedType === "flash") {
            //alert("Not yet supported");
            console.warn("Unsupported method setOnPageZoomCallback");
        } else if (this.selectedType === "silverlight") {
            this.getInstance().OnPageZoomCallback = callback;
        }
    },
    /**
     * Sets the annotation author. (HTML5 only)
     * @param {string} username
     */
    setAnnotationUser: function(username) {
        if (this.selectedType === "html5" ||
                this.selectedType === "html5Mobile" ||
                this.selectedType === "silverlight"
                ) {
            this.getInstance().setAnnotationUser(username);
        } else {
            console.warn("Unsupported method setAnnotationUser");
        }
    },
    /**
     * Sets the administrative permissions for the current annotation user. (HTML5 only)
     * @param {boolean} isAdminUser
     */
    setAdminUser: function(isAdminUser) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setAdminUser(isAdminUser);
        } else if (this.selectedType === "flash") {
            console.warn("Unsupported method setAdminUser");
        } else if (this.selectedType === "silverlight") {
            console.warn("Unsupported method setAdminUser");
        } else {
            console.warn("Unsupported method setAdminUser");
        }
    },
    /**
     * Sets the viewer's annotation read-only state. When read-only, users will be allowed to view annotations and its popup text contents, but will not be able to edit or create new annotations. (HTML5 only)
     * @param {boolean} isReadOnly
     */
    setReadOnly: function(isReadOnly) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            this.getInstance().setReadOnly(isReadOnly);
        } else if (this.selectedType === "flash") {
            console.warn("Unsupported method setReadOnly");
        } else {
            console.warn("Unsupported method setReadOnly");
        }
    },
    /**
     * Opens a dialog to initiate printing (Silverlight only)
     * Note that browser-based printing is not reliable for documents with many pages.
     * @since version 1.7
     * @param {type} title
     * @param {type} body
     * @param {type} okstring
     * @param {type} cancelstring
     */
    openPrintDialog: function(title, body, okstring, cancelstring) {
        if (this.selectedType === "html5" || this.selectedType === "html5Mobile") {
            //this._createSilverlight();
            var sl_print_container = $("#sl-print");
            if (sl_print_container.length > 0) {
                //sl print should be here already, open dialog again
                //$(sl_print_container).show();
                $(sl_print_container).css('z-index', '999');


                this._webviewerprint.getInstance().openPrintDialog(title, body, okstring, cancelstring);


                //$("#sl-print").css('z-index', '-1');
                return;
            }

            var sl_print_container = $('<div id="sl-print"></div>').appendTo('body');
            sl_print_container.css({
                width: '400px',
                //'margin-left' : '-200px',
                //position: 'absolute',
                //background: 'transparent',
                //background: 'darkgrey',
                background: 'white',
                //border: '5px solid black',
                //top: '60px',
                'height': '150px',
                //left: '50%',
                //right:0,
                'text-align': 'center',
                'z-index': -10
            });

            var clonedOptions = jQuery.extend(true, {}, this.options);
            clonedOptions.type = "silverlight";
            clonedOptions.silverlightPath = "silverlight/ReaderControl.xap";
            clonedOptions.nogui = true;
            clonedOptions.autoCreate = true;
            clonedOptions.enableAnnotations = false;
            clonedOptions.background = "transparent";
            clonedOptions.windowless = "transparent";
            //clonedOptions.silverlightObjectParams.background = 'blue';
            clonedOptions.initialDoc = decodeURIComponent(this.options.initialDoc);
            var _webviewerprint = new PDFTron.WebViewer(clonedOptions, sl_print_container);
            this._webviewerprint = _webviewerprint;

            $(sl_print_container).on('documentLoaded', function() {
                $(sl_print_container).css('z-index', 999);
                _webviewerprint.instance.onUIEvent = function(sender3, args3) {

                    //console.log(args3.name);
                    if (args3.name === "PrintDialogClosing") {
                        //$(sl_print_container).hide();
                        $(sl_print_container).css('z-index', '-1');
                        $(sl_print_container).trigger('closing');
                    }
                    if (args3.name === "PrintStarted") {
                        //$(sl_print_container).trigger('closing');
                    }
                };
                _webviewerprint.openPrintDialog(title, body, okstring, cancelstring);
            });
        } else if (this.selectedType === "flash") {
            console.warn("Unsupported method print");
        } else if (this.selectedType === "silverlight") {
            this.getInstance().openPrintDialog(title, body, okstring, cancelstring);
        }
    },
    /**
     * Opens the XOD document through the browser to be downloaded.
     * @since version 1.7
     */
    downloadXodDocument: function() {
        var url = decodeURIComponent(this.options.initialDoc);
        window.open(url);
    },
    startPrintJob: function(pages) {
        if (this.selectedType === "html5") {
            this.getInstance().startPrintJob(pages);
        } else {
            console.warn("Unsupported method startPrintJob");
        }
    },
    endPrintJob: function() {
        if (this.selectedType === "html5") {
            this.getInstance().endPrintJob();
        } else {
            console.warn("Unsupported method endPrintJob");
        }
    },
//    registerCustomAnnotations: function(){
//        
//    },
    getViewerType: function() {
        return this.selectedType;
    },
    //JQuery UI Widget option method
    option: function(key, value) {
        //console.log("option");
        // optional: get/change options post initialization
        // ignore if you don't require them.        

        // signature: $('#viewer').webViewer({ type: 'html5,silverlight' });
        if ($.isPlainObject(key)) {
            this.options = $.extend(true, this.options, key);

            // signature: $('#viewer').option('type'); - getter
        } else if (key && typeof value === "undefined") {
            return this.options[ key ];

            // signature: $('#viewer').webViewer('option', 'type', 'html5,silverlight');
        } else {
            this.options[ key ] = value;
        }

        // required: option must return the current instance.
        // When re-initializing an instance on elements, option
        // is called first and is then chained to the _init method.
        return this;
    },
    //make relative paths absolute
    _correctRelativePath: function(path) {
        //get current url
        var curdir = window.location.pathname.substr(0, window.location.pathname.lastIndexOf('/'));
        //pattern begins with --> https:// or http:// or file:// or / or %2F (%2F is '/' url encoded. Necessary to work with S3 signatures)
        var pattern = /^(https?:\/\/|file:\/\/|\/|%2F)/i;
        //correct relative paths by prepending "../"
        return pattern.test(path) ? path : curdir + '/' + path;
    },
    _testSilverlight: function(v) {
        try {
            return (Silverlight && Silverlight.isInstalled(v));
        } catch (e) {
            console.warn(e);
            return false;
        }
    },
    _testHTML5: function() {
        try {
            var c = document.createElement('canvas');
            return (c && c.getContext('2d'));
        } catch (e) {
            //console.warn(e);
            return false;
        }
    },
    _supports: function(type) {
        if (type === this.selectedType) {
            return true;
        }
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i] === this.selectedType) {
                return true;
            }
        }
        return false;
    },
    _testCORS: function() {
        //https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
        return 'XMLHttpRequest' in window && 'withCredentials' in new XMLHttpRequest();
    },
    /**
     * Detects if the current browser is on a mobile device.
     * @return {boolean} true if this page is loaded on a mobile device.
     */
    isMobileDevice: function() {
        return (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i)
                || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i)
                || navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/Touch/i)
                || navigator.userAgent.match(/IEMobile/i) || navigator.userAgent.match(/Silk/i));
    },
    /**
     * Detects if the give url string is in the same origin as the current page
     * @param {type} url the URL to test against
     * @returns {boolean} true if the provided URL is in the same origin as the current page
     */
    isSameOrigin: function(url) {
        var loc = window.location;
        var a = document.createElement('a');

        a.href = url;
        if (a.host === "") {
            // IE won't set the properties we want if we set href to a relative path, but it will
            // automatically change href to an absolute path, so if we set it again as absolute then
            // hostname, port and protocol will be set as expected
            a.href = a.href;
        }

        var locPort = window.location.port;
        var aPort = a.port;

        if (a.protocol === "http:") {
            aPort = aPort || "80";
            locPort = locPort || "80";

        } else if (a.protocol === "https:") {
            aPort = aPort || "443";
            locPort = locPort || "443";
        }

        return (a.hostname === loc.hostname && a.protocol === loc.protocol && aPort === locPort);
    },
    _testFlash: function(v) {
        return swfobject.hasFlashPlayerVersion(v);
    }
};



/**
 *A jQuery event bound on the element, triggered when the viewer is ready, before a document is loaded.
 *@name PDFTron.WebViewer#ready
 *@example e.g. $('#viewer').bind('ready', function(event, data){//event triggered});
 *@event
 */
/**
 *A jQuery event bound on the element, triggered when a document has been loaded in the viewer.
 *@name PDFTron.WebViewer#documentLoaded
 *@event
 *@example e.g. $('#viewer').bind('documentLoaded', function(event, data){//event triggered});
 */
/**
 *A jQuery event bound on the element, triggered when the page number has changed.
 *@name PDFTron.WebViewer#pageChanged
 *@event
 *@example e.g. $('#viewer').bind('pageChanged', function(event, data){//event triggered});
 */
/**
 *A jQuery event bound on the element, triggered when the zoom level has changed.
 *@name PDFTron.WebViewer#zoomChanged
 *@event
 *@example e.g. $('#viewer').bind('zoomChanged', function(event, data){//event triggered});
 */
/**
 *A jQuery event bound on the element, triggered when the display mode has changed.
 *@name PDFTron.WebViewer#displayModeChanged
 *@event
 *@deprecated since version 1.7. Use layoutModeChanged instead
 *@example e.g. $('#viewer').bind('displayModeChanged', function(event, data){//event triggered});
 */
/**
 *A jQuery event bound on the element, triggered when the layout mode has changed.
 *@name PDFTron.WebViewer#layoutModeChanged
 *@event
 *@since version 1.7
 *@example e.g. $('#viewer').bind('layoutModeChanged', function(event, data){//event triggered});
 */
/**
 *A jQuery event bound on the element, triggered when the tool mode has changed.
 *@name PDFTron.WebViewer#toolModeChanged
 *@event
 *@example e.g. $('#viewer').bind('toolModeChanged', function(event, data){//event triggered});
 */

//if JQuery UI framework is present, create widget for WebViewer
if (typeof $.widget === 'function') {
    $.widget("PDFTron.webViewer", PDFTron.WebViewer.prototype);
}


/**
 * Contains string enums for all layouts for WebViewer.
 *
 * @name PDFTron.WebViewer.LayoutMode
 * @namespace LayoutModes are used to dictate how pages are placed within the viewer. Used by {@link PDFTron.WebViewer#setLayoutMode} and {@link PDFTron.WebViewer#getLayoutMode}.
 */
PDFTron.WebViewer.LayoutMode = {
    /**
     * Only the current page will be visible.
     *
     * @name PDFTron.WebViewer.LayoutMode.Single
     */
    Single: "SinglePage",
    /**
     * All pages are visible in one column.
     *
     * @name PDFTron.WebViewer.LayoutMode.Continuous
     */
    Continuous: "Continuous",
    /**
     * Up to two pages will be visible.
     *
     * @name PDFTron.WebViewer.LayoutMode.Facing
     */
    Facing: "Facing",
    /**
     * All pages visible in two columns.
     *
     * @name PDFTron.WebViewer.LayoutMode.FacingContinuous
     */
    FacingContinuous: "FacingContinuous",
    /**
     * All pages visible in two columns, with an even numbered page rendered first.
     * i.e. The first page of the document is rendered by itself on the right side of the viewer to simulate a book cover.
     * @name PDFTron.WebViewer.LayoutMode.FacingCover
     */
    FacingCover: "FacingCover",
    /**
     * All pages visible, with an even numbered page rendered first.
     * i.e. The first page of the document is rendered by itself on the right side of the viewer to simulate a book cover.
     * @name PDFTron.WebViewer.LayoutMode.FacingCoverContinuous
     */
    FacingCoverContinuous: "CoverContinuous"
};

/**
 * Contains string enums for all default tools for WebViewer.
 * @name PDFTron.WebViewer.ToolMode
 * @namespace ToolModes are string enum representations of tools used by WebViewer. They range from panning, text selection to annotation creation. This is used by {@link PDFTron.WebViewer#setToolMode} and {@link PDFTron.WebViewer#getToolMode}.
 */
PDFTron.WebViewer.ToolMode = {
    /**
     * @name PDFTron.WebViewer.ToolMode.Pan
     */
    Pan: "Pan",
    /**
     * @name PDFTron.WebViewer.ToolMode.TextSelect
     */
    TextSelect: "TextSelect",
    /**
     * @name PDFTron.WebViewer.ToolMode.PanAndAnnotationEdit
     */
    PanAndAnnotationEdit: "PanAndAnnotationEdit",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationEdit
     */
    AnnotationEdit: "AnnotationEdit",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateCustom
     */
    AnnotationCreateCustom: "AnnotationCreateCustom",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateEllipse
     */
    AnnotationCreateEllipse: "AnnotationCreateEllipse",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateFreeHand
     */
    AnnotationCreateFreeHand: "AnnotationCreateFreeHand",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateLine
     */
    AnnotationCreateLine: "AnnotationCreateLine",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateRectangle
     */
    AnnotationCreateRectangle: "AnnotationCreateRectangle",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateSticky
     */
    AnnotationCreateSticky: "AnnotationCreateSticky",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateTextHighlight
     */
    AnnotationCreateTextHighlight: "AnnotationCreateTextHighlight",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateTextStrikeout
     */
    AnnotationCreateTextStrikeout: "AnnotationCreateTextStrikeout",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateTextUnderline
     */
    AnnotationCreateTextUnderline: "AnnotationCreateTextUnderline",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreatePolyline
     */
    AnnotationCreatePolyline: "AnnotationCreatePolyline",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreatePolygon
     */
    AnnotationCreatePolygon: "AnnotationCreatePolygon",
    /**
     * @name PDFTron.WebViewer.ToolMode.AnnotationCreateCallout
     */
    AnnotationCreateCallout: "AnnotationCreateCallout"
};

/**
 * @class Options for WebViewer on creation. Used when constructing a new {@link PDFTron.WebViewer} instance.
 * @property {string} [type="html5,silverlight,html5Mobile,flash"] the type of WebViewer to load. Values must be comma-separated in order of preferred WebViewer. (Possibe values: html5, html5Mobile, silverlight, flash)
 * @property {string} initialDoc the URL path to a xod document to load on startup, it is recommended to use absolute paths.
 * @property {boolean} [streaming=false] a boolean indicating whether to use http or streaming PartRetriever, it is recommended to keep streaming false for better performance.
 * @property {boolean} [enableAnnotations=false] name a boolean to enable annotations on supported viewer types. (HTML5 only)
 * @property {boolean} [enableOfflineMode] a boolean to enable offline mode.(HTML5 only, default false)
 * @property {boolean} [startOffline] whether to start loading the document in offline mode or not.(HTML5 only, default false)
 * @property {boolean} [enableReadOnlyMode] a boolean to enable annotations read-only mode.(HTML5 only, default false)
 * @property {string} [config] a URL path to a JavaScript configuration file that holds UI customizations. (HTML5 only)
 * @property {string} [serverUrl] a URL to the server-side script that handles annotations. (HTML5 only, required for full annotation support)
 * @property {string} [annotationUser] a user identifier for annotations. All annotations created will have this as the author. It is used for permission checking: user only permitted to modify annotations where annotationUser and author matches. (HTML5, Silverlight)
 * @property {boolean} [annotationAdmin] a boolean indicating this user has permission to modify all annotations, even if the annotationUser and author does not match. (HTML5 only)
 * @property {string} [documentId] an identifier for the document to be used with annotations. (HTML5 only, required for full annotation support)
 * @property {string} [cloudApiId] the share ID or session ID created from <a href="http://www.pdftron.com/pws/cloud" target="_blank">PWS Cloud</a>. Note: the browser must have CORS support. (optional, ignored when initialDoc is also set)
 * @property {string} [custom] a string of custom data that can be retrieved by the ReaderControl (HTML5 only)
 * @property {boolean} [mobileRedirect=true] a boolean indicating whether the mobile viewer should redirect to a new window or not (HTML5 mobile only, default true)
 * @property {object} [encryption] an object containing encryption properties (HTML5 and Flash only)
 * @property {object} [silverlightObjectParams] an object containing properties that will be adding as param tags under the Silverlight object tag (Silverlight only)
 * @property {boolean} [flashSockets=false] use Flash sockets intead of JavaScript part retriever. The server hosting the XOD files must support sockets. See flash/README.rtf for more details.
 * @property {boolean} [showToolbarControl] a boolean to show/hide the default toolbar control.
 * @property {PDFTron.WebViewer.Options} [html5Options] a PDFTron.WebViewer.Options object that overrides the existing options when the HTML5 viewer is loaded.
 * @property {PDFTron.WebViewer.Options} [html5MobileOptions] a PDFTron.WebViewer.Options object that overrides the existing options when the HTML5 Mobile viewer is loaded.
 * @property {PDFTron.WebViewer.Options} [silverlightOptions] a PDFTron.WebViewer.Options object that overrides the existing options when the Silverlight viewer is loaded.
 * @property {PDFTron.WebViewer.Options} [flashOptions] a PDFTron.WebViewer.Options object that overrides the existing options when the Flash viewer is loaded.
 * @property {string} [errorPage] a path to an HTML page to display errors. (optional)
 * @property {string} [path] an alternative path to the WebViewer root folder. (optional)
 * @property {string} [html5Path="html5/ReaderControl.html"] an alternative path to the HTML5 WebViewer, relative to the "path" option. (optional)
 * @property {string} [html5MobilePath="html5/MobileReaderControl.html"] an alternative path to the HTML5 Mobile WebViewer, relative to the "path" option. (optional)
 * @property {string} [silverlightPath="silverlight/ReaderControl.xap"] an alternative path to the Silverlight WebViewer, relative to the "path" option. (optional)
 * @property {string} [flashPath="flash/ReaderControl.swf"] an alternative path to the Flash WebViewer, relative to the "path" option. (optional)
 * @property {boolean} [autoCreate=true] a boolean to control creating the viewer in the constructor. When set to false, invoke the create() method explicity. (default true)
 */
PDFTron.WebViewer.Options = {
    type: "html5,silverlight,html5Mobile,flash",
    path: '',
    html5Path: "html5/ReaderControl.html",
    html5MobilePath: "html5/MobileReaderControl.html",
    silverlightPath: "silverlight/ReaderControl.xap",
    flashPath: "flash/ReaderControl.swf",
    autoCreate: true,
    initialDoc: undefined,
    cloudApiId: undefined,
    enableAnnotations: false,
    enableOfflineMode: false,
    startOffline: false,
    enableReadOnlyMode: false,
    errorPage: undefined,
    serverUrl: undefined,
    documentId: undefined,
    streaming: false,
    config: undefined,
    mobileRedirect: true,
    encryption: undefined,
    showToolbarControl: true,
    showSilverlightControls: true, //deprecated
	flashSockets: false,
    silverlightObjectParams: {},
    html5Options: {},
    html5MobileOptions: {},
    silverlightOptions: {},
    flashOptions: {}
};


/**
 * Contains all posible modes for fitting/zooming pages to the viewer.
 * The behavior may vary depending on the {@link PDFTron.WebViewer.LayoutMode}.
 * @readonly
 * @namespace FitModes are specialized modes for specifying the zoom level of the document.
 * @enum {string}
 */
PDFTron.WebViewer.FitMode = {
    /**
     * 
     * A fit mode where the zoom level is fixed to the width of the page.
     */
    FitWidth: 'FitWidth',
    /**
     * A fit mode where the zoom level is fixed to the height of the page.
     */
    FitHeight: 'FitHeight',
    /**
     * A fit mode where the zoom level is fixed to the width or height of the page, whichever is smaller.
     */
    FitPage: 'FitPage',
    /**
     * A fit mode where the zoom level is not fixed.
     */
    Zoom: 'Zoom'
};

//unused
PDFTron.WebViewer.SearchMode = {
    CaseSensitive: 1,
    WholeWord: 2,
    SearchUp: 4,
    PageStop: 8,
    ProvideQuads: 16,
    AmbientString: 32
};


/**
 * Creates a new PDFTron.WebViewer.User
 * @class A utility class to help manage user permissions for annotations.
 * @param {string} username the unique name used to identify the user.
 * @param {Boolean} isAdmin indicates if the user has administrative permissions.
 * @param {Boolean} isReadOnly indicates if the user only has read-only permissions.
 */
PDFTron.WebViewer.User = function(username, isAdmin, isReadOnly) {
    this.username = username;

    if (typeof isAdmin !== 'undefined') {
        this.isAdmin = isAdmin;
    } else {
        this.isAdmin = false;
    }

    if (typeof isReadOnly !== 'undefined') {
        this.isReadOnly = isReadOnly;
    } else {
        this.isReadOnly = false;
    }
};


