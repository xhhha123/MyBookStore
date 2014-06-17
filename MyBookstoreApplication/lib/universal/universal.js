/* ==================================================
 * WebViewer Universal
 * --------------------------------------------------
 * WebViewer Universal is a full featured viewer control built using WebViewer.js
 * This viewer users a single HTML/JS interface to control all document rendering
 * engines available to WebViewer.
 * This viewer is officially supported and will be incrementally updated in
 * future releases. The source code is provided as is, and may be directly
 * modified.
 * 
 * Dependecies:
 * - jQuery
 * - jQuery UI
 * - backbone.js (and underscore.js)
 * ==================================================
 */

/**
 * Creates a new backbone model for WebViewer Universal Viewer.
 * @class The backbone model that presents the state of the WebViewer Universal Viewer
 */
window.WebViewerUniversalModel = Backbone.Model.extend({
    //Optional: Provide a server url here to fetch default settings
    //url: http://path/to/server,
    //Viewer defaults (client-side).
    defaults: {
        documentUrl: null,
        serverUrl: null,
        enableAnnotations: true,
        annotationUser: new PDFTron.WebViewer.User("Guest", false),
        currentPageNumber: 0,
        pageCount: 0,
        zoomLevel: 0,
        fitMode: PDFTron.WebViewer.FitMode.Zoom,
        layoutMode: PDFTron.WebViewer.LayoutMode.SinglePage,
        toolMode: '',
        rotation: 0, //0,1,2,3
        webViewerLibPath: '..',
        webViewerOptions: null
    }
});

window.WebViewerUniversalInstance = {
    model: new WebViewerUniversalModel(),
    view: null
};

/**
 * @class WebViewerBackboneView
 * @extends Backbone.View
 * @lends Backbone.View
 */
window.WebViewerUniversalView = Backbone.View.extend({
    initialize: function() {
        var me = this;
        
        this.initializeGUI(); //do this before jQuery UI initialization
                
        this.initializeWebViewer();

        this.resize();
        $(window).resize(function() {
            me.resize();
        });

        //listen to model change, update GUI on change
        this.listenTo(this.model, 'change:currentPageNumber', this.updateCurrentPageNumber);
        this.listenTo(this.model, 'change:toolMode', this.updateToolMode);
        this.listenTo(this.model, 'change:fitMode', this.updateFitMode);
        this.listenTo(this.model, 'change:layoutMode', this.updateLayoutMode);
        this.listenTo(this.model, 'change:zoomLevel', this.updateZoomLevel);
        this.listenTo(this.model, 'change:annotationUser', this.updateAnnotationUser);
        this.listenTo(this.model, 'change:printProgress', this.updatePrintProgress);
        this.listenTo(this.model, 'change:documentUrl', this.updateDocument);
    },
    resize: function() {


        var width = $("#viewerContainer").width();

        //bootstrap-style responsive utility css class
        if (width > 1200) {
            $(".hidden-md, .hidden-sm, .hidden-xs").show();
            $(".hidden-lg").hide();
        } else if (width > 992) {
            $(".hidden-lg, .hidden-sm, .hidden-xs").show();
            $(".hidden-md").hide();
        } else if (width > 768) {
            $(".hidden-lg, .hidden-md, .hidden-xs").show();
            $(".hidden-sm").hide();
        } else {
            $(".hidden-lg, .hidden-md, .hidden-sm").show();
            $(".hidden-xs").hide();
        }

        var toolbarRightSideWidth = $(".toolbar .right-aligned").innerWidth();
        if (toolbarRightSideWidth > 0) {
            $(".toolbar").css('min-width', (toolbarRightSideWidth + 55) + "px");
        }
        
        var docConHeight = $(window).height()
                - $('#headerContainer').outerHeight()
                - $('#control').outerHeight()
                - $('#footerContainer').outerHeight();
        
        $('#documentContainer').height(docConHeight);
        
        setTimeout(function() {
            //this is a workaround for a FireFox bug
            //upon exiting fullscreen mode, the iframe's height incorrect
            //explicitly set the iframe height here. a timeout is required
            if ($("#documentContainer iframe").height() !== $('#documentContainer').height()) {
                $("#documentContainer iframe").height(docConHeight);
            }
        }, 500);        
    },
    render: function() {
        this.resize();
    },
    /**
     * Initialize the GUI i18n language used in controls.
     */
    initializeGUI: function() {
        //first load the i18n language
        var libPath = this.model.get('webViewerLibPath');

        if (libPath.length > 0) {
            if (libPath.charAt(libPath.length - 1) !== "/") {
                libPath += "/";
            }
        }

        //override HTML5 Reader defaults
        //remove this in the future
        var getI18nOptions = function(autodetect) {
            var options = {
                useCookie: false,
                useDataAttrOptions: true,
                defaultValueFromContent: false,
                fallbackLng: 'en',
                resGetPath: libPath + 'resources/i18next-1.7.1/__ns__-__lng__.json'
            };

            if (!autodetect) {
                options.lng = 'en';
            }
            return options;
        };

        var me = this;
        i18n.init(getI18nOptions(), function() {
            $('body').i18n();

            //do no initialize the toolbar until i18n is ready;
            me.initializeToolbar();
        });
    },
    /**
     * Initializes the tool bar.
     * Sets up the icons and events.
     */
    initializeToolbar: function() {
        var me = this;
        var view = this;
        var ctrlDown = false;
        var altDown = false;
        var fKey = 70;
        var ctrlKey = 17;
        var altKey = 18;
        
        var $docIframe = $("#documentContainer iframe");
        var iframeWindow;
        if($docIframe.length > 0){
           //catch keyboard events from the iframe too
           iframeWindow =  $docIframe.get(0).contentWindow;
        }
        $(window).add(iframeWindow).keydown(function(e) {
            if (e.keyCode === ctrlKey || e.metaKey || e.ctrlKey) {
                ctrlDown = true;
            }
            if (e.keyCode === altKey) {
                altDown = true;
            }
            if (ctrlDown) {
                if (e.keyCode === fKey) {
                    $("#searchBox").focus();
                    return false;
                }
            }
            else if (altDown) {
               
            }
            if(iframeWindow){
                //very important, we must use the jQuery instance within the iframe!
                iframeWindow.$(iframeWindow).trigger(e);
            }
        }).keyup(function(e) {
            if (e.keyCode === ctrlKey || e.metaKey || e.ctrlKey) {
                ctrlDown = false;
            }
            else if (e.keyCode === altKey) {
                altDown = false;
            }
            if(iframeWindow){
                //very important, we must use the jQuery instance within the iframe!
                iframeWindow.$(iframeWindow).trigger(e);
            }
        });
        
        //GUI events should trigger WebViewer.js methods directly, not models
        //this keeps the GUI consistent with the WebViewer.js representation of viewer
        //i.e. the GUI state is only updated once the WebViewer's internal state is set and a change event was triggered

        $("#fitModes").buttonset();
        $("#tools").buttonset();

        $("#fitWidth").button({
            text: false,
            icons: {
                primary: 'ui-icon-custom-fit-width'
            }
        }).click(function() {
            myWebViewer.fitWidth();
        });

        $("#fitPage").button({
            text: false,
            icons: {
                primary: 'ui-icon-custom-fit-page'
            }
        }).click(function() {
            myWebViewer.fitPage();
        });

        $("#pan").button({
            text: false,
            icons: {
                primary: 'ui-icon-custom-tool-pan'
            }
        }).click(function() {
            myWebViewer.setToolMode(PDFTron.WebViewer.ToolMode.Pan);
        });

        $("#textSelect").button({
            text: false,
            icons: {
                primary: 'ui-icon-custom-tool-text'
            }
        }).click(function() {
            myWebViewer.setToolMode(PDFTron.WebViewer.ToolMode.TextSelect);
        });

        $("#beginning").button({
            text: false,
            icons: {
                primary: "ui-icon-seek-start"
            }
        });
        $("#prevPage").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-prev"
            }
        }).click(function() {
            myWebViewer.goToPrevPage();
        });

        $("#nextPage").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-next"
            }
        }).click(function() {
            myWebViewer.goToNextPage();
        });

        $("#rotateButton").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-rotate"
            }
        }).click(function() {
            myWebViewer.rotateClockwise();
        });

        $("#searchBox").on('keypress', function(e) {
            if (e.keyCode === 13) {
                e.preventDefault(); //IE likes to trigger click event on unrelated button elements without this.
                $("#searchButton").click();
            }
        });

        $("#searchButton").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-search"
            }
        }).click(function() {
            //myWebViewer.searchText($('#searchBox').val(), "AmbientString");
            myWebViewer.searchText($('#searchBox').val());
        });


        $("#toggleSidePanel").button({
            text: false,
            icons: {
                primary: "ui-icon-pin-s"
            }
        }).click(function() {
            $("#sidePanel").toggle();
            var iconClass = $('#sidePanel').is(':visible') ? "ui-icon-pin-s" : "ui-icon-pin-w";
            $(this).button("option", {
                icons: {
                    primary: iconClass
                }
            });
        });



        $('#pageNumberBox').on('keypress blur', function(e) {
            // check for the enter key
            if ((e.type === 'keypress' && e.keyCode === 13) ||
                    (e.type === "blur")
                    ) {
                var input = this.value;
                var number = parseInt(input, 10);
                if (isNaN(number) || number > myWebViewer.getPageCount()) {
                    $('#pageNumberBox').val(myWebViewer.getCurrentPageNumber());
                } else {
                    myWebViewer.setCurrentPageNumber(number);
                }
                e.preventDefault(); //IE likes to trigger click event on unrelated button elements without this.
            }
        });

        $("#zoomOut").button({
            text: false,
            icons: {
                primary: "ui-icon-minus"
            }
        }).click(function() {
            var zoom = myWebViewer.getZoomLevel();
            zoom = Math.max(0.1, zoom - 0.25);
            myWebViewer.setZoomLevel(zoom);
        });
        $("#zoomIn").button({
            text: false,
            icons: {
                primary: "ui-icon-plus"
            }
        }).click(function() {
            var zoom = myWebViewer.getZoomLevel();
            zoom = Math.min(4.0, zoom + 0.25);
            myWebViewer.setZoomLevel(zoom);
        });

        $('#zoomBox').keyup(function(e) {
            if (e.keyCode === 13) {
                var input = this.value;
                var number = parseInt(input, 10);
                var trimmedInput = $.trim(input);
                if (trimmedInput === '' || trimmedInput === '%') {
                    view.updateZoomLevel();
                    this.blur();
                    return;
                }
                if (isNaN(number)) {
                    console.warn("'" + input + "' is not a valid zoom level.");
                } else {
                    var zoom = number / 100.0;
                    if (zoom <= 0.05) {
                        zoom = 0.05;
                    } else if (zoom > 5.0) {
                        zoom = 5.0;
                    }
                    myWebViewer.setZoomLevel(zoom);
                }
            }
        }).blur(function() {
            $(this).addClass("ui-widget-header");
        }).focus(function() {
            $(this).removeClass("ui-widget-header");
        }).addClass("ui-widget-header");

        $("#slider").slider({
            min: 5,
            max: 500,
            value: 100,
            animate: true,
            //slide: function(event, ui) {
            change: function(event, ui) {
                if (typeof event.originalEvent === 'undefined') {
                    //this was triggered programmatically. we can skip this
                    return;
                }
                var number = parseInt(ui.value, 10);
                if (isNaN(number)) {
                    console.warn("'" + number + "' is not a valid zoom level.");
                } else {
                    clearTimeout(me.zoomSliderTimeout);
                    me.zoomSliderTimeout = setTimeout(function() {
                        myWebViewer.setZoomLevel(number / 100.0);
                    }, 100);
                }
            }, slide: function(event, ui) {
                if ($(event.originalEvent.target).hasClass('ui-slider-handle')) {
                    //user is dragging the handle
                    //special case update the zoombox with the preview
                    $('#zoomBox').val(ui.value + '%');

                    //"instant feedback"
                    clearTimeout(me.zoomSliderTimeout);
                    var number = parseInt(ui.value, 10);
                    me.zoomSliderTimeout = setTimeout(function() {
                        myWebViewer.setZoomLevel(number / 100.0);
                    }, 500);
                } else {
                    //user clicked
                    $('#zoomBox').val(ui.value + '%');
                }
            }
        });

        $("#layoutModeMenuButton")
                .button({
                    text: false,
                    icons: {
                        primary: "ui-icon-custom-page-single",
                        secondary: "ui-icon-triangle-1-s"
                    }
                })
                .click(function() {
                    var menu = $('#layoutModeMenuList');
                    if (menu.data("isOpen")) {
                        menu.fadeOut('fast');
                        menu.data("isOpen", false);
                    } else {
                        menu.fadeIn('fast').position({
                            my: "left top",
                            at: "left bottom",
                            of: this
                        });

                        $(document).one("click", function() {
                            menu.hide();
                            menu.data("isOpen", false);
                        });
                        menu.data("isOpen", true);
                    }
                    return false;
                });

        $('#optionsMenuList').hide().menu();

        $('#layoutModeMenuList').hide()
                .data("isOpen", false)
                .menu({
                    select: function(event, ui) {
                        var layoutModeVal = $(ui.item).data('layout-mode');
                        myWebViewer.setLayoutMode(layoutModeVal);
                    }
                });

        if (Modernizr.fullscreen) {
            $("#fullScreenButton").button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-screen"
                }
            }).click(function() {
                if (document.fullscreen) {
                    document.exitFullscreen();
                    $("#documentContainer iframe").height($("#documentContainer iframe").height() - 1);
                    return;
                } else if (document.mozFullScreen) {
                    document.mozCancelFullScreen();
//                    setTimeout(function() {
//                        //bug with firefox
//                        //the iframe height is incorrect when leaving fullscreen mode
//                        //workaround: set the iframe height right after leaving fullscreen mode
//                        //use a timeout just in case
//                        $("#documentContainer iframe").height($("#documentContainer").height());
//                    }, 0);
                    return;
                } else if (document.webkitIsFullScreen) {
                    document.webkitCancelFullScreen();
                    return;
                }

                var docElm = document.documentElement;
                if (docElm.requestFullscreen) {
                    docElm.requestFullscreen();
                } else if (docElm.mozRequestFullScreen) {
                    docElm.mozRequestFullScreen();                    
                    setTimeout(function() {
                        //there is a bug with firefox
                        //the iframe's contentWindow height is incorrect after entering fullscreen mode
                        //workaround: force a resize on the iframe after enterting fullscreen.
                        //use a timeout to ensure we enter fullscreen first.
                        $("#documentContainer iframe").height($("#documentContainer").height());
                    }, 500);

                } else if (docElm.webkitRequestFullScreen) {
                    docElm.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                    //Safari silently fails with the above, use workaround:
                    setTimeout(function() {
                        if (!document.webkitCurrentFullScreenElement) {
                            docElm.webkitRequestFullScreen();
                        }
                    }, 200);
                }
            });
        } else {
            $("#fullScreenButton").hide().next('div.separator').hide();
        }

        $("#downloadButton").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-download"
            }
        }).click(function() {
            myWebViewer.downloadXodDocument();
        });

        $("#aboutButton").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-info"
            }
        }).click(function() {
            if ($("#webviewer-about-dialog").length > 0) {
                $("#webviewer-about-dialog").dialog();
            } else {
                var message = '<div style="margin: 5px 0">\n\
                    <a href="//www.pdftron.com" target="_blank"><img style="outline:0" border="0" src="//www.pdftron.com/assets/images/logos/pdftron_logo.gif" /></a></div>';

                message += '<div>WebViewer Universal'
                        + '<br/></div>';
                message += '<div>Document Rendering Engine: ' + myWebViewer.selectedType + '</div><br/>';
                message += "<p>WebViewer Universal is a full-featured and customizable XOD document reader built from PDFTron WebViewer.</p>";
                $(document.createElement('div'))
                        .attr('id', 'webviewer-about-dialog')
                        .html(message)
                        .dialog({
                            show: {effect: "scale", duration: 100},
                            hide: {effect: "scale", duration: 100},
                            width: 400,
                            dialogClass: 'alert',
                            modal: true,
                            resizable: false
                        });
            }
        });

        var printPageNumbers = $('#printPageNumbers');

        $("#printButton").button({
            text: false,
            icons: {
                primary: "ui-icon-custom-print"
            }
        }).click(function() {
            $('#printDialog').dialog({
                modal: true,
                show: {effect: "scale", duration: 100},
                hide: {effect: "scale", duration: 100},
                resizable: false,
                open: function() {
                    printPageNumbers.val(me.model.get('currentPageNumber'));
                },
                close: function() {
                    myWebViewer.endPrintJob();
                },
                buttons: [
                    {
                        text: i18n.t("print.print"),
                        click: function() {
                            $(this).find(".ui-progressbar").show();
                            var pages = printPageNumbers.val();
                            myWebViewer.startPrintJob(pages);
                        }
                    },
                    {
                        text: i18n.t("print.done"),
                        click: function() {
                            $(this).find(".ui-progressbar").hide();
                            $(this).dialog("close");
                        }
                    }
                ]
            });
        });

        $('#sidePanelToggle').button({
            text: false,
            icons: {
                primary: "ui-icon-custom-side-contact"
            }
        }).click(function() {
            var isPinnedDown = $(this).find('.ui-icon')
                    .toggleClass('ui-icon-custom-side-contact')
                    .toggleClass('ui-icon-custom-side-expand')
                    .hasClass('ui-icon-custom-side-contact');

            myWebViewer.setShowSideWindow(isPinnedDown);
        });
    },
    /**
     * creates a new instance of WebViewer and attaches event listeners
     */
    initializeWebViewer: function() {
        var viewerElement = document.getElementById('documentContainer');

        var options = {
            type: this.model.get('type'),
            path: this.model.get('webViewerLibPath'), //URL path to the WebViewer root folder
            initialDoc: this.model.get('documentUrl'),
            autoCreate: false,
            documentId: "GettingStarted",
            showSilverlightControls: false,
            serverUrl: this.model.get("serverUrl"),
            annotationUser: this.model.get("annotationUser").username,
            annotationAdmin: this.model.get("annotationUser").isAdmin,
            enableReadOnlyMode: this.model.get("annotationUser").isReadOnly,
            showToolbarControl: false,
            silverlightObjectParams: {'isWindowless': 'true'},
            enableAnnotations: this.model.get("enableAnnotations"),
            streaming: false                   //set streaming to 'true' if your .xod server doesn't acknowledge byte-ranges
        };
        $.extend(options, this.model.get('webViewerOptions'));
        myWebViewer = new PDFTron.WebViewer(options, viewerElement);
        window.WebViewerUniversalInstance.webViewer = myWebViewer;
        window.WebViewerUniversalInstance.webViewerElement = document.getElementById('documentContainer');

        var me = this;
        $(viewerElement).on('documentLoaded', {me: this, model: this.model, view: this.view}, function(event) {
            me.initializeDocument.call(me, event);
            me.model.set('documentLoaded', true);
        });
        $(viewerElement).on('ready', function() {
            me.model.set('type', myWebViewer.getViewerType());
            $('.toolbar').show();
            me.initializeViewerSpecific.call(me);
            me.model.set('ready', true);
            me.resize();
        });

        var view = this;
        $(viewerElement).on(
                'layoutModeChanged zoomChanged fitModeChanged pageChanged toolModeChanged printProgressChanged',
                function(event, data1, data2) {
                    switch (event.type) {
                        case "layoutModeChanged":
                            var t = myWebViewer.getLayoutMode();
                            view.model.set('layoutMode', t);
                            break;
                        case "zoomChanged":
                            var z = myWebViewer.getZoomLevel();
                            view.model.set('zoomLevel', z);
                            break;
                        case "fitModeChanged":
                            view.model.set('fitMode', myWebViewer.getFitMode());
                            break;
                        case "pageChanged":
                            view.model.set('currentPageNumber', myWebViewer.getCurrentPageNumber());
                            break;
                        case "toolModeChanged":
                            view.model.set('toolMode', myWebViewer.getToolMode());
                            break;
                        case "printProgressChanged":
                            view.model.set('printProgress', [data1, data2]);
                            break;
                    }
                });
        myWebViewer.create();
        window.myWebViewer = myWebViewer;
        this.webViewerController = myWebViewer;
    },
    /**
     * Initialize viewer specific controls.
     * This is triggered on WebViewer's "ready" event.
     * Rendering engine specific features can be checked and turned on here.
     */
    initializeViewerSpecific: function() {
        if (myWebViewer.getViewerType() === "html5") {
            $('#printButton').show();
        }
        else if (myWebViewer.getViewerType() === "silverlight") {
            var pd_title = "Print";
            var pd_body = "Are you sure you want to print the document?";
            var pd_ok = "Print";
            var pd_cancel = "Cancel";
            $("#printButton").button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-print"
                }
            }).click(function() {
                if (myWebViewer.getViewerType() === "html5") {
                    if ($('#sl-print').length > 0) {
                        $('#webviewer-print-dialog').dialog();
                        return;
                    }
                    myWebViewer.openPrintDialog(pd_title, pd_body, pd_ok, "");
                    $(document.createElement('div'))
                            .attr('id', 'webviewer-print-dialog')
                            //.html(message)
                            .dialog({
                                width: 450,
                                height: 220,
                                dialogClass: 'alert',
                                title: 'About',
                                //draggable: true,
                                modal: true,
                                resizable: false
                                        //width: 'auto'
                            });

                    $("#sl-print").appendTo("#webviewer-print-dialog");
                    $("#sl-print").on('closing', function(e) {
                        setTimeout(function() {
                            //a timeout is required, or else the browser print dialog won't show
                            $("#webviewer-print-dialog").dialog("close");
                        }, 0);

                    });
                }
                myWebViewer.openPrintDialog(pd_title, pd_body, pd_ok, pd_cancel);
            }).show();
        }
        return;


        var pd_title = "Print";
        var pd_body = "Are you sure you want to print? You can download the document as an .xps file and print it on Windows.";
        var pd_ok = "Print";
        var pd_cancel = "Cancel";
        //show print button only if viewer supports it
        if (myWebViewer.getViewerType() === "html5" || myWebViewer.getViewerType() === "silverlight") {
            $("#printButton").button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-print"
                }
            }).click(function() {
                if (myWebViewer.getViewerType() === "html5") {
                    if ($('#sl-print').length > 0) {
                        $('#webviewer-print-dialog').dialog();
                        return;
                    }
                    myWebViewer.openPrintDialog(pd_title, pd_body, pd_ok, "");
                    $(document.createElement('div'))
                            .attr('id', 'webviewer-print-dialog')
                            //.html(message)
                            .dialog({
                                width: 450,
                                height: 220,
                                dialogClass: 'alert',
                                title: 'About',
                                //draggable: true,
                                modal: true,
                                resizable: false
                                        //width: 'auto'
                            });

                    $("#sl-print").appendTo("#webviewer-print-dialog");
                    $("#sl-print").on('closing', function(e) {
                        setTimeout(function() {
                            //a timeout is required, or else the browser print dialog won't show
                            $("#webviewer-print-dialog").dialog("close");
                        }, 0);

                    });
                }
                if (myWebViewer.getViewerType() === "silverlight") {
                    myWebViewer.openPrintDialog(pd_title, pd_body, pd_ok, pd_cancel);
                }
            }).show();
        } else {
            $("#printButton").hide();
        }
    },
    /**
     * Initialize document specific controls.
     * This is triggered on WebViewer's "documentLoaded" event.
     */
    initializeDocument: function(event) {
        //document loaded
        //initialize GUI options here, such as page number, zoom level
        var model = event.data.model;
        model.set('currentPageNumber', myWebViewer.getCurrentPageNumber());
        model.set('zoomLevel', myWebViewer.getZoomLevel());
        model.set('pageCount', myWebViewer.getPageCount());
        model.set('layoutMode', myWebViewer.getLayoutMode());
        model.set('fitMode', myWebViewer.getFitMode());
        $("#totalPages").text('/' + myWebViewer.getPageCount()); //cheating here by updating UI directly, instead of creating a new listener on change:pageCount

        myWebViewer.setShowSideWindow(true); //need this to show the silverlight side panel
    },
    /**
     * Update the view (UI) for current page number
     */
    updateCurrentPageNumber: function() {
        $('#pageNumberBox').val(this.model.get('currentPageNumber'));
    },
    /**
     * Update the view (UI) for zoom level
     */
    updateZoomLevel: function() {
        var zoomLevelVal = this.model.get('zoomLevel');
        var zoomLevelInteger = Math.round(zoomLevelVal * 100);
        $('#zoomBox').val(zoomLevelInteger + '%');

        $("#slider").slider({
            value: zoomLevelInteger
        });
    },
    updateAnnotationUser: function() {
        /** @type WebViewer.User */
        var u = this.model.get('annotationUser');
        myWebViewer.setAnnotationUser(u.username);
        myWebViewer.setAdminUser(u.isAdmin);
        myWebViewer.setReadOnly(u.isReadOnly);
    },
    updatePrintProgress: function() {
        var printProgress = this.model.get('printProgress');
        var currentPage = printProgress[0];
        var totalPages = printProgress[1];
        var percentage = currentPage / totalPages * 100;
        $('#printProgress').show().progressbar({
            value: percentage
        });
        var printMessage = (percentage === 100 ? 'print.pagesPrepared' : 'print.preparingPages');

        $('.progressLabel').attr('data-i18n', printMessage)
                .data('i18n-options', {
                    "current": currentPage,
                    "total": totalPages
                }).i18n();
    },
    updateDocument: function() {
        var docUrl = this.model.get('documentUrl');
        myWebViewer.loadDocument(docUrl);
    },
    /**
     * Update the view (UI) for fit mode
     */
    updateFitMode: function() {
        var fitModeVal = this.model.get('fitMode');

        if (fitModeVal === PDFTron.WebViewer.FitMode.FitWidth) {
            $("#fitModes #fitWidth").prop('checked', true);
        } else if (fitModeVal === PDFTron.WebViewer.FitMode.FitPage) {
            $("#fitModes #fitPage").prop('checked', true);
        } else if (fitModeVal === PDFTron.WebViewer.FitMode.Zoom) {
            $("#fitModes input").prop('checked', false);
        }
        $("#fitModes").buttonset('refresh');

    },
    /**
     * Update the view (UI) for tool mode
     */
    updateToolMode: function() {
        var toolModeVal = this.model.get('toolMode');
        if (toolModeVal === "Pan") {
            $("#tools input[data-tool-mode=Pan]").prop("checked", true);
        } else if (toolModeVal === "TextSelect") {
            $("#tools input[data-tool-mode=TextSelect]").prop("checked", true);
        } else {
            $("#tools input").prop("checked", false);
        }
        $("#tools").buttonset('refresh');
    },
    updateLayoutMode: function() {
        var dmString = myWebViewer.getLayoutMode();
        var mode = $('#layoutModeMenuList')
                .find('[data-layout-mode=' + dmString + '] span');

        var layoutModeIconClass;
        var classList = mode.attr('class').split(/\s+/);
        $.each(classList, function(index, item) {
            if (item.indexOf('ui-icon-') === 0) {
                layoutModeIconClass = item;
            }
        });
        $("#layoutModeMenuButton").button("option", {
            text: false,
            icons: {
                primary: layoutModeIconClass,
                secondary: "ui-icon-triangle-1-s"
            }
        });
    }
});

$(function() {
    var viewerState = window.WebViewerUniversalInstance.model;
    var AppRouter = Backbone.Router.extend({
        routes: {
            "page/:page": "startOnPage",
            "t/:type": "defaultType",
            "d/:url": "documentUrl",
            "*actions": "defaultRoute"
        },
        defaultType: function(type) {
            var t = type;
            switch (type) {
                case 's':
                    t = 'silverlight';
                    break;
                case 'h':
                    t = 'html5';
                    break;
                case 'm':
                    t = 'html5Mobile';
                    break;
                case 'f':
                    t = 'flash';
                    break;
                default:
                    t = type;
                    break;

            }
            viewerState.set('type', t);
            createView();
        },
        startOnPage: function(page) {
            createView();
        },
        documentUrl: function(url) {
            viewerState.set('documentUrl', url);
            createView();
        },
        defaultRoute: function() {
            viewerState.unset('type');
            createView();
        }
    });

    var createView = function() {
        if (window.WebViewerUniversalInstance.view) {
            //view already exists, reload
            window.location.reload();
        }

        if (typeof viewerState.url === 'string' && viewerState.url) {
            //a server url was provided, ask server for viewer defaults
            viewerState.fetch({
                success: function(serverProvidedModel, response, options) {
                    window.WebViewerUniversalInstance.view = new window.WebViewerUniversalView({
                        model: serverProvidedModel
                    });
                },
                error: function(model, response, options) {
                    console.error("An error occurred when requesting viewer data from the server.");
                    //handle server errors and permission errors
                    window.WebViewerUniversalInstance.view = new window.WebViewerUniversalView({
                        model: viewerState
                    });
                }
            });
        } else {
            window.WebViewerUniversalInstance.view = new window.WebViewerUniversalView({
                model: viewerState
            });
        }
    };
    // Initiate the router
    window.WebViewerUniversalInstance.appRouter = new AppRouter();
    Backbone.history.start();
});

//JQuery UI Alert
$.extend({
    alert: function(message, title) {
        $(document.createElement('div'))
                .html(message)
                .dialog({
                    width: 400,
                    dialogClass: 'alert',
                    title: title,
                    //draggable: true,
                    modal: true,
                    resizable: false
                });
    }
});