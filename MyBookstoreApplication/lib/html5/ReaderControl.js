/*global Modernizr */
(function(exports) {
    "use strict";
    
    exports.ReaderControl = exports.ReaderControl || {};
    
    var Text = XODText;
    var CoreControls = exports.CoreControls;
    // var Annotations = exports.Annotations;
    // var Tools = exports.Tools;

    /**
     *
     * Creates a new instance of ReaderControl
     * @name ReaderControl
     * @class Represents the full-featured ReaderControl reusable UI component that extends DocumentViewer.
     * @see ReaderControl.html ReaderControl.js ReaderControl.css
     * @param {element} viewerElement an element containing a DocumentViewer.
     **/
    exports.ReaderControl = function(viewerElement, enableAnnot, enableOffline) {
        var me = this;
        
        this.enableAnnotations  = enableAnnot ? true : false;
        this.enableOffline = enableOffline ? true : false;
        this.docViewer = new exports.CoreControls.DocumentViewer();
        this.docViewer.SetOptions({
            enableAnnotations: this.enableAnnotations
        });
        this.onLoadedCallback = null;
        this.doc_id = null;
        this.server_url = null;
        this.currUser = '';
        
        if (typeof ReaderControl.config !== "undefined" && typeof ReaderControl.config.defaultUser !== "undefined") {
            this.currUser = ReaderControl.config.defaultUser;

            //load custom CSS file
            if (typeof ReaderControl.config.customStyle !== "undefined") {
                $("<link>").appendTo("head").attr({
                    rel: "stylesheet",
                    type: "text/css",
                    href: ReaderControl.config.customStyle
                });
            }
            
            //load custom javaScript file
            if (typeof ReaderControl.config.customScript !== "undefined") {
                $.getScript(ReaderControl.config.customScript, function(data, textStatus, jqxhr) {
                    /*jshint unused:false */
                    //custom script was loaded
                });
            }
        }
        
        if (typeof ReaderControl.config !== "undefined" && typeof ReaderControl.config.serverURL !== "undefined") {
            this.server_url = ReaderControl.config.serverURL;
        }
        
        this.isAdmin = false;
        this.readOnly = undefined;
        this.eventsBound = false;

        this.thumbContainerWidth = 180;
        this.thumbContainerHeight = 200;
        this.requestedThumbs = [];
        this.lastRequestedThumbs = [];
        this.clickedThumb = -1;

        this.clickedSearchResult = -1;
        this.clickedBookMark = -1;
        
        // Key binding.
        var fKey = 70;
        var leftArrowKey = 37;
        var upArrowKey = 38;
        var rightArrowKey = 39;
        var downArrowKey = 40;
        var cKey = 67;
        var vKey = 86;
        var sKey = 83;
        var tKey = 84;
        var plusKeys = [187, 61];
        var minusKeys = [189, 173];
        // var pageUpKey = 33, pageDownKey = 34;
        
        this.toolModeMap = {};
        var ToolMode = exports.PDFTron.WebViewer.ToolMode;  
        this.toolModeMap[ToolMode.Pan] = Tools.PanTool;
        this.toolModeMap[ToolMode.PanAndAnnotationEdit] = Tools.PanTool; //this tool doesn't exist of HTML5
        this.toolModeMap[ToolMode.TextSelect] = Tools.TextSelectTool;
        this.toolModeMap[ToolMode.AnnotationEdit] = Tools.AnnotationEditTool;
        this.toolModeMap[ToolMode.AnnotationCreateEllipse] = Tools.EllipseCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateFreeHand] = Tools.FreeHandCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateLine] = Tools.LineCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateRectangle] = Tools.RectangleCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateSticky] = Tools.StickyCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateTextHighlight] = Tools.TextHighlightCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateTextStrikeout] = Tools.TextStrikeoutCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateTextUnderline] = Tools.TextUnderlineCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreatePolyline] = Tools.PolylineCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreatePolygon] = Tools.PolygonCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateCallout] = Tools.CalloutCreateTool;
        this.toolModeMap[ToolMode.AnnotationCreateCustom] = Tools.AnnotationEditTool; //no tools for this
        
        this.initUI();

        $(exports).keydown(function(e) {
            var ctrlDown = e.metaKey || e.ctrlKey;
            
            // document navigation
            // don't change pages if a text input is currently focused
            var currentPage = me.docViewer.GetCurrentPage();

            if (!exports.utils.isEditableElement($(document.activeElement))) {
                if (e.which === leftArrowKey || e.which === upArrowKey) {
                    if (currentPage > 1) {
                        me.docViewer.SetCurrentPage(currentPage - 1);
                    }
                } else if (e.which === rightArrowKey || e.which === downArrowKey) {
                    if (currentPage <= me.docViewer.GetPageCount()) {
                        me.docViewer.SetCurrentPage(currentPage + 1);
                    }
                }
            }

            var am = me.docViewer.GetAnnotationManager();
            if (ctrlDown) {
                if (e.which === fKey) {
                    if($("#control").is(':visible')){
                        document.getElementById('searchBox').focus();
                        return false;
                    }
                } else if (_.contains(plusKeys, e.which)) {
                    // zoom in
                    setZoomLevelWithBounds(me.getZoomLevel() + 0.25);
                    e.preventDefault();
                } else if (_.contains(minusKeys, e.which)) {
                    // zoom out
                    setZoomLevelWithBounds(me.getZoomLevel() - 0.25);
                    e.preventDefault();
                } else {
                    if (e.which === cKey && me.enableAnnotations) {
                        if (am) {
                            am.UpdateCopiedAnnotations();
                        }
                    } else if (e.which === vKey && me.enableAnnotations) {
                        if (am) {
                            am.PasteCopiedAnnotations();
                        }
                    }
                }
            }
            else if (e.altKey) {
                if (e.which === sKey && me.enableAnnotations) {
                    me.saveAnnotations();
                } else if (e.which === tKey && me.enableAnnotations) {
                    if (am) {
                        am.ToggleAnnotations();
                        var ToolModes = exports.Tools;
                        me.docViewer.SetToolMode(ToolModes.TextSelectTool);
                    }
                }
            }
            // else {
            //     var displayMode = me.docViewer.GetDisplayModeManager().GetDisplayMode();
                
                // if (displayMode.mode === 'Single') { //|| displayMode === me.docViewer.DisplayMode.Cover || displayMode === me.docViewer.DisplayMode.Facing) {
                //     if (e.which == pageDownKey) {

                //         //http://stackoverflow.com/questions/3898130/how-to-check-if-a-user-has-scrolled-to-the-bottom
                //         if ($(exports).scrollTop() + $(exports).height() == $(iframe.contentDocument).height()) {
                //             e.preventDefault(); //prevent the default page down behavior to affect us after we scroll to the top
                //             me.GoToNextPage();
                //             $(iframe.contentDocument).scrollTop(0);
                //         }
                //     } else if (e.which == pageUpKey) {
                //         if ($(exports).scrollTop() == 0) {
                //             e.preventDefault(); //prevent the default page up behavior to affect us after we scroll to the bottom
                //             me.GoToPrevPage();
                //             $(iframe.contentDocument).scrollTop($(iframe.contentDocument).height());
                //         }
                //     }
                // }
            // }
            
        });

        var $viewerElement = $(viewerElement);
        $viewerElement.bind('mousewheel', function(event, delta) {
            // use altKey to support a shortcut for Chrome
            if (event.ctrlKey || event.altKey) {
                // zoom in and out with ctrl + scrollwheel
                // only seems to work in Firefox and IE
                if (delta < 0) {
                    setZoomLevelWithBounds(me.getZoomLevel() - 0.25);
                } else {
                    setZoomLevelWithBounds(me.getZoomLevel() + 0.25);
                }

                event.preventDefault();
                return;
            }

            var displayMode = me.docViewer.GetDisplayModeManager().GetDisplayMode();
            if (displayMode.IsContinuous()) {
                // don't need to scroll between pages if we're in continuous mode
                return;
            }
            
            var pageNum;
            if (delta < 0) {
                // scrolling down
                // +1 because IE is sometimes one pixel off
                var scrollBottom = $viewerElement.scrollTop() + $viewerElement.height() + 1;
                if (scrollBottom >= $viewerElement[0].scrollHeight) {
                    pageNum = getChangedPageIndex(1);
                    if (pageNum >= 0) {
                        me.docViewer.SetCurrentPage(pageNum + 1);
                    }
                }
            } else if (delta > 0) {
                // scrolling up
                if (Math.abs($viewerElement.scrollTop()) <= 1) {
                    pageNum = getChangedPageIndex(-1);
                    if (pageNum >= 0) {
                        me.docViewer.SetCurrentPage(pageNum + 1);
                        // scroll to the bottom of the new page
                        $viewerElement.scrollTop($viewerElement[0].scrollHeight);
                    }
                }
            }
        });
        
        // Get the updated page index when increasing the row by "change", returns -1 if that row would be invalid
        var getChangedPageIndex = function(change) {
            var displayMode = me.docViewer.GetDisplayModeManager().GetDisplayMode();
            var cols = (displayMode.mode === exports.CoreControls.DisplayModes.Single) ? 1 : 2;
            
            var rowNum;
            if (displayMode.mode === exports.CoreControls.DisplayModes.CoverFacing) {
                rowNum = Math.floor(me.docViewer.GetCurrentPage() / cols);
            } else {
                rowNum = Math.floor((me.docViewer.GetCurrentPage() - 1) / cols);
            }
            
            rowNum += change;
            var pageIndex = rowNum * cols;
            
            if (displayMode.mode === exports.CoreControls.DisplayModes.CoverFacing) {
                if (pageIndex === 0) {
                    return 0;
                } else if (pageIndex < (me.docViewer.GetPageCount() + 1)) {
                    return pageIndex - 1;
                } else {
                    return -1;
                }
            } else {
                if (pageIndex < me.docViewer.GetPageCount()) {
                    return pageIndex;
                } else {
                    return -1;
                }
            }
        };
        
        var setZoomLevelWithBounds = function(zoom) {
            if (zoom <= 0.05) {
                zoom = 0.05;
            } else if (zoom > 5.0) {
                zoom = 5.0;
            }
            me.setZoomLevel(zoom);
        };

        me.docViewer.on('documentLoaded', _(this.onDocumentLoaded).bind(this));
        
        me.docViewer.on('notify', exports.ControlUtils.getNotifyFunction);
        
        this.$thumbnailViewContainer = $("#thumbnailView");
        this.$thumbnailViewContainer.scroll(function() {
            clearTimeout(me.thumbnailRenderTimeout);
       
            me.thumbnailRenderTimeout = setTimeout(function() {
                var visibleThumbs = me.getVisibleThumbs();

                var thumbIndex;
                for (var i = 0; i < me.lastRequestedThumbs.length; i++) {
                    thumbIndex = me.lastRequestedThumbs[i];
                    if (me.requestedThumbs[thumbIndex] && !_.contains(visibleThumbs, thumbIndex)) {
                        // cancel thumbnail request if it is no longer visible
                        me.docViewer.GetDocument().CancelThumbnailRequest(thumbIndex, 'thumbview');
                        me.requestedThumbs[thumbIndex] = false;
                    }
                }

                me.lastRequestedThumbs = visibleThumbs;

                me.appendThumbs(me.getVisibleThumbs());
            }, 80);
        });
        
        $('#lastPage').bind('click', function() {
            me.docViewer.DisplayLastPage();
        });
        
        $('#zoomBox').keyup(function(e) {
            if (e.which === 13) {
                var input = this.value;
                var number = parseInt(input, 10);
                if (isNaN(number)) {
                    alert("'" + input + "' is not a valid zoom level.");
                } else {
                    var zoom = number / 100.0;
                    setZoomLevelWithBounds(zoom);
                }
            }
        });
        
        me.docViewer.on('zoomUpdated', function(e, zoom) {
            var zoomVal = Math.round(zoom * 100);
            
            $('#zoomBox').val(zoomVal);
            if ($("#slider").slider("value") !== zoomVal) {
                $("#slider").slider({
                    value: zoomVal
                });
            }
            me.fireEvent('zoomChanged', [zoom]);
        });
        
        me.resize();
        
        $(window).resize(function() {
            me.resize();
            if (me.sidePanelVisible()) {
                me.shiftSidePanel();
            }
            $("#thumbnailView").trigger('scroll');
        });
        
        $("#slider").slider({
            slide: function(event, ui) {
                var number = parseInt(ui.value, 10);
                if (isNaN(number)) {
                    alert("'" + number + "' is not a valid zoom level.");
                } else {
                    clearTimeout(me.zoomSliderTimeout);
                    me.zoomSliderTimeout = setTimeout(function() {
                        me.docViewer.ZoomTo(number / 100.0);
                    }, 50);
                }
            }
        });
        
        $('#pageNumberBox').keyup(function(e) {
            // check for the enter key
            if (e.which === 13) {
                var input = this.value;
                var number = parseInt(input, 10);
                if (isNaN(number) || number > me.docViewer.GetPageCount()) {
                    $('#pageNumberBox').val(me.docViewer.GetCurrentPage());
                } else {
                    me.docViewer.SetCurrentPage(number);
                }
            }
        });
        
        me.docViewer.on('toolModeUpdated', function(e, toolMode) {
            
            var pan = $('#pan');
            var textSelect = $('#textSelect');
            pan.get(0).checked = false;
            textSelect.get(0).checked = false;
            if (toolMode === Tools.PanTool) {
                pan.get(0).checked = true;
            } else if (toolMode === Tools.TextSelectTool) {
                textSelect.get(0).checked = true;
            }
            pan.button("refresh");
            textSelect.button("refresh");
            me.fireEvent('toolModeChanged', [toolMode]);
        });

        me.docViewer.on('pageNumberUpdated', function(e, pageNumber) {
            $('#pageNumberBox').val(pageNumber);
            var pageIndex = pageNumber - 1;
            
            if (me.clickedThumb !== -1) {
                $("#thumbContainer" + me.clickedThumb).removeClass('ui-state-active');
            }

            if (typeof me.thumbnailsElement !== 'undefined') {
                var divTop = me.thumbnailsElement.scrollTop;
                var divBottom = divTop + me.thumbnailsElement.offsetHeight;
                var top = pageIndex * me.thumbContainerHeight;
                var bottom = top + me.thumbContainerHeight;

                if (!(top >= divTop && bottom <= divBottom)) {
                    me.thumbnailsElement.scrollTop = pageIndex * me.thumbContainerHeight;
                }
            }
            
            me.clickedThumb = pageIndex;
            $("#thumbContainer" + pageIndex).addClass('ui-state-active');
            
            me.fireEvent('pageChanged',[pageNumber]);
        });
        
        $('#fitWidth').click(function() {
            me.docViewer.SetFitMode(me.docViewer.FitMode.FitWidth);
        });
        
        $('#fitPage').click(function() {
            me.docViewer.SetFitMode(me.docViewer.FitMode.FitPage);
        });
        
        $("#pan").click(function() {
            me.docViewer.SetToolMode(Tools.PanTool);
        });
        
        $("#textSelect").click(function() {
            me.docViewer.SetToolMode(Tools.TextSelectTool);
        });

        $('#fullScreenButton').click(function() {
            if (document.fullscreen) {
                document.exitFullscreen();
                return;
            } else if (document.mozFullScreen) {
                document.mozCancelFullScreen();
                return;
            } else if(document.webkitIsFullScreen) {
                document.webkitCancelFullScreen();
                return;
            }
            
            var docElm = document.documentElement;
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen();
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen();
            } else if (docElm.webkitRequestFullScreen) {
                docElm.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                //Safari silently fails with the above, use workaround:
                setTimeout(function() {
                    if (!document.webkitCurrentFullScreenElement) {
                        docElm.webkitRequestFullScreen();
                    }
                },200);
            }
        });
        
        me.docViewer.on('textSelected', function(e, quads, text) {
            var $clipboard = $("#clipboard");
            var clipboard = $clipboard.get(0);

            clipboard.value = text;
            if (text.length > 0) {
                $clipboard.show();
                clipboard.focus();
                clipboard.selectionStart = 0;
                clipboard.setSelectionRange(0, clipboard.value.length);
            } else {
                $clipboard.hide();
            }

        });
        
        me.docViewer.on('displayModeUpdated', function() {
            var displayMode = me.docViewer.GetDisplayModeManager().GetDisplayMode();
            var displayModes = exports.CoreControls.DisplayModes;
            var title = "Single";
            var displayModeIconClass = 'ui-icon-custom-page-single';
            
            if (displayMode.mode === displayModes.Single) {
                title = "Single";
                displayModeIconClass = 'ui-icon-custom-page-single';
            } else if (displayMode.mode === displayModes.Continuous) {
                title = "Continuous";
                displayModeIconClass = 'ui-icon-custom-page-single-cont';
            } else if (displayMode.mode === displayModes.Facing) {
                title = "Facing";
                displayModeIconClass = 'ui-icon-custom-page-facing';
            } else if (displayMode.mode === displayModes.FacingContinuous) {
                title = "Facing Continuous";
                displayModeIconClass = 'ui-icon-custom-page-facing-cont';
            } else if (displayMode.mode === displayModes.Cover) {
                // title = "Cover";
                // displayModeIconClass = 'ui-icon-custom-page-cover';
                title = "Cover Continuous";
                displayModeIconClass = 'ui-icon-custom-page-cover-cont';
            } else if (displayMode.mode === displayModes.CoverFacing) {
                // title = "Cover Continuous";
                // displayModeIconClass = 'ui-icon-custom-page-cover-cont';
                title = "Cover";
                displayModeIconClass = 'ui-icon-custom-page-cover';
            }
            
            $("#displayModeMenuButton")
            .button( "option", {
                //label: title,
                icons: {
                    primary: displayModeIconClass,
                    secondary: "ui-icon-triangle-1-s"
                }
            });

            me.fireEvent('layoutModeChanged', [displayMode]);
        });
        
        me.docViewer.on('fitModeUpdated', function(e, fitMode) {
            var fitWidth = $('#fitWidth');
            var fitPage = $('#fitPage');
            
            if (fitMode === me.docViewer.FitMode.FitWidth) {
                fitWidth[0].checked = true;
                fitPage[0].checked = false;
            } else if (fitMode === me.docViewer.FitMode.FitPage) {
                fitWidth[0].checked = false;
                fitPage[0].checked = true;
            } else {
                // Zoom mode.
                fitWidth[0].checked = false;
                fitPage[0].checked = false;
            }
            fitWidth.button("refresh");
            fitPage.button("refresh");
            
            me.fireEvent('fitModeChanged', [fitMode]);
        });
        
        // //Example of overriding the default link appearance and behavior
        // //==============================================================
        // me.docViewer.on('linkReady', function(e, linkElement, link){
        //    if(link instanceof CoreControls.Hyperlink){
        //        linkElement.onclick = function(){
        //            //external link clicked
        //            window.open(link.GetTarget());
        //        };
    
        //    }else if(link instanceof CoreControls.Link) {
        //        linkElement.parentClick = linkElement.onclick;
        //        linkElement.onclick = function(){
        //            this.parentClick();
        //        //override the default behavior of internal links
        //        };
        //    }
        // });

        ////Example of inserting custom content on top of a page
        ////==============================================================
        // me.docViewer.on('pageComplete', function(e, pageIndex) {
        //    var pageContainer = me.getPageContainer(pageIndex);
        //    pageContainer.append('<div style="position:relative; float:right; z-index: 35">Watermark Text</div>');
        //    //note that dom elements appended need to have the position:relative style to show up correctly
        //    //also by default, text selection on div elements is disabled
        // });
        
        me.docViewer.on('pageComplete', function(e, pageIndex) {
            if (me.hideAnnotations) {
                var pageAnnotCanvas = me.docViewer.getAuxiliaryCanvas(pageIndex);
                $(pageAnnotCanvas).hide();
            }
            
            me.fireEvent("pageCompleted", [pageIndex + 1]);
        });
    };

    exports.ReaderControl.prototype = {
        /**
         * Initialize UI controls.
         * @ignore
         */
        initUI: function(){
            var me = this;
            $("#fitWidth").button({
                text: false,
                icons: {
                    primary: 'ui-icon-custom-fit-width'
                }
            });
            $("#fitPage").button({
                text: false,
                icons: {
                    primary: 'ui-icon-custom-fit-page'
                }
            });
            $("#pan").button({
                text: false,
                icons: {
                    primary: 'ui-icon-custom-tool-pan'
                }
            });
            $("#textSelect").button({
                text: false,
                icons: {
                    primary: 'ui-icon-custom-tool-text'
                }
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
            });
            $("#nextPage").button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-next"
                }
            });
            $("#rotateButton").button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-rotate"
                }
            });
            $("#searchButton").button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-search"
                }
            });
            $("#toggleSidePanel").button({
                text: false,
                icons: {
                    primary: "ui-icon-pin-w"
                }
            }).click(function() {
                me.setShowSideWindow(!me.sidePanelVisible());
            });
        
            
            $("#fitModes").buttonset();
            $("#tools").buttonset();
                
            $("#slider").slider({
                min: 5,
                max: 500,
                value: 100,
                animate: true
            });
            
            
            $("#displayModeMenuButton")
            .button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-page-single",
                    secondary: "ui-icon-triangle-1-s"
                }
            })
            .click(function() {
                var menu = $('#displayModeMenuList');
                if (menu.data("isOpen")) {
                    menu.hide();
                    menu.data("isOpen", false);
                } else {
                    menu.show().position({
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
            
            $('#displayModeMenuList').hide()
            .data("isOpen", false)
            .menu({
                select: function(event, ui) {
                    var displayModeVal = $(ui.item).data('display-mode');
                    var displayModes = exports.CoreControls.DisplayModes;
                    var displayMode;
                    switch(displayModeVal) {
                        case 'single':
                            displayMode = new exports.CoreControls.DisplayMode(me.docViewer, displayModes.Single);
                            break;
                        case 'single-cont':
                            displayMode = new exports.CoreControls.DisplayMode(me.docViewer, displayModes.Continuous);
                            break;
                        case 'facing':
                            displayMode = new exports.CoreControls.DisplayMode(me.docViewer, displayModes.Facing);
                            break;
                        case 'facing-cont':
                            displayMode = new exports.CoreControls.DisplayMode(me.docViewer, displayModes.FacingContinuous);
                            break;
                        case 'cover':
                            displayMode = new exports.CoreControls.DisplayMode(me.docViewer, displayModes.CoverFacing);
                            //displayMode = me.docViewer.DisplayMode.Cover;
                            break;
                        case 'cover-cont':
                            displayMode = new exports.CoreControls.DisplayMode(me.docViewer, displayModes.Cover);
                            //displayMode = me.docViewer.DisplayMode.CoverFacing;
                            break;
                    }
                    me.docViewer.GetDisplayModeManager().SetDisplayMode(displayMode);
                }
            });
            
            
            var $tabs = $("#tabs");
            $tabs.tabs({
                cache: true
            });

            var annotInitialized = false;
            if (this.enableAnnotations) {
                /*Ajax load the annotation panel.
                 *Note: loading it directly here because we want the JS to run right away.
                 */
                if (!ReaderControl.config.ui.hideAnnotationPanel && !annotInitialized) {
                    var li = $('<li><a href="#tabs-4"><span class="ui-icon ui-icon-custom-note" data-i18n="[title]sidepanel.annotations"/></a></li>');
                    $tabs.find(".ui-tabs-nav").append(li);
                    $("#tabs-4").load('AnnotationPanel.html', function() {
                        // translate the tab when finished loading
                        $('#tabs-4').i18n();
                    }).appendTo($tabs);
                    
                    $tabs.tabs("refresh");
                }
            }
            
            if (Modernizr.fullscreen) {
                $("#fullScreenButton").button({
                    text: false,
                    icons: {
                        primary: "ui-icon-custom-screen"
                    }
                });
            } else {
                $("#fullScreenButton").hide();
            }
            
            if (ReaderControl.config.ui.hidePrint) {
                $('#printButton').hide();
            } else {
                $("#printButton").button({
                    text: false,
                    icons: {
                        primary: "ui-icon-custom-print"
                    }
                });
            }

            if (!ReaderControl.config.ui.hideControlBar) {
                //$("#control").show();
                
                if (ReaderControl.config.ui.hideDisplayModes) {
                    document.getElementById('displayModes').parentNode.style.visibility = 'hidden';
                }
                
                var par, separator;
                if (ReaderControl.config.ui.hideTextSearch) {
                    var searchButton = document.getElementById('searchButton');
                    par = searchButton.parentNode;
                    par.removeChild(searchButton);
                    var searchBox = document.getElementById('searchBox');
                    separator = searchBox.nextElementSibling;
                    par.removeChild(searchBox);
                    par.removeChild(separator);
                }
                if (ReaderControl.config.ui.hideZoom) {
                    var zoomBox = document.getElementById('zoomBox');
                    par = zoomBox.parentNode;
                    par.removeChild(zoomBox);
                    var slider = document.getElementById('slider');
                    par.removeChild(slider);
                    var zoomPercent = document.getElementById('zoomPercent');
                    separator = zoomPercent.nextElementSibling;
                    par.removeChild(zoomPercent);
                    par.removeChild(separator);
                }
            }
            
            // always initially hide the panel itself
            $("#sidePanel").hide();

            if (ReaderControl.config.ui.hideSidePanel) {
                // don't show the toggle button in this case
                document.getElementById('toggleSidePanel').style.visibility = 'hidden';
            }
            
            if (this.onLoadedCallback) {
                this.onLoadedCallback();
            }
            /*http://forum.jquery.com/topic/chrome-text-select-cursor-on-drag */
            document.onselectstart = function (e) {
                if (!exports.utils.isEditableElement($(e.target))) {
                    return false;
                }
            };

            $.extend({
                alert: function (message, title) {
                    
                    $(document.createElement('div'))
                    .html(message)
                    .dialog({
                        // buttons: {
                        //     OK: function() {
                        //         $(this).dialog('close');
                        //     }
                        // },
                        close: function() {
                            $(this).remove();
                        },
                        dialogClass: 'alert',
                        title: title,
                        //draggable: true,
                        modal: true,
                        resizable: false
                        //width: 'auto'
                    });
        
                    // $("<div></div>").dialog( {
                    //     buttons: {
                    //         "Ok": function () {
                    //             $(this).dialog("close");
                    //         }
                    //     },
                    //     close: function (event, ui) {
                    //         $(this).remove();
                    //     },
                    //     resizable: false,
                    //     title: title,
                    //     modal: true
                    // }).text(message);
                }
            });
        },
        
        setLoadedCallback: function(callback) {
            this.onLoadedCallback = callback;
        },
        
        resize: function(){
            //find the height of the internal page
            var scrollContainer = document.getElementById('DocumentViewer');
            //change the height of the viewer element
            var viewerHeight = window.innerHeight;
            var $controlToolbar = $("#control");
            if ($controlToolbar.is(':visible')) {
                viewerHeight -= $controlToolbar.outerHeight();
            }
            
            $(scrollContainer).height(viewerHeight);
            scrollContainer.width = window.innerWidth;
            
            $('#sidePanel').css('height', viewerHeight);
            $('#tabs').css('height', viewerHeight - 7);
            $('#fullSearchView').css('height', viewerHeight - 119);
            $('#bookmarkView').css('height', viewerHeight - 50);
            $('#thumbnailView').css('height', viewerHeight - 50);
        },
        
        onDocumentLoaded: function() {
            var me = this;
            
            me.clearSidePanelData();
            me.initBookmarkView();
            me.initThumbnailView();
            me.initSearchView();
            me.setInterfaceDefaults();
            
            if (!me.eventsBound) {
                me.eventsBound = true;
                
                me.bindEvents();
            }
            
            //// Programmatically create a rectangle
            ////----------------------------------------------
            //var am = me.docViewer.GetAnnotationManager();
            //var rectAnnot = new Annotations.RectangleAnnotation();
            //rectAnnot.X =(500);
            //rectAnnot.Y =(100);
            //rectAnnot.Width =(500);
            //rectAnnot.Height =(100);
            //rectAnnot.PageNumber = 1;
            //rectAnnot.Author = this.currUser;
            //rectAnnot.FillColor = new Annotations.Color(0,255,0);
            //rectAnnot.StrokeColor =  new Annotations.Color(255,0,0);
            //rectAnnot.StrokeThickness = 1;
            //am.AddAnnotation(rectAnnot);

            ////Load existing annotations for this document
            ////----------------------------------------------
            var am = me.docViewer.GetAnnotationManager();
            am.SetCurrentUser(this.currUser);
            am.SetIsAdminUser(this.isAdmin);
            am.SetReadOnly(this.readOnly);

            if (this.server_url === null) {
                console.warn("Server URL was not specified.");
            } else {
                var queryData = {};
                
                var query = '';
                if (this.doc_id !== null && this.doc_id.length > 0) {
                    queryData = {
                        'did': this.doc_id,
                        'curruser':this.currUser
                    };    
                }else{
                    query = '';
                    //Document id is not available. did will not be set for server-side annotation handling.
                }

                $.ajax({
                    url: this.server_url + query,
                    cache: false,
                    data : queryData,
                    success: function(data) {
                        if (data !== null) {
                            am.externalAnnotsExist = true;
                            am.ImportAnnotations(data);
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        /*jshint unused:false */
                        console.warn("Annotations could not be loaded from the server.");
                        am.externalAnnotsExist = false;
                    },
                    dataType: 'xml'
                });

                ////Enable timer for auto-saving
                ////----------------------------------------------
                //var updateAnnotsID = setInterval(this.updateAnnotations.bind(this), 300000);
            }
            
            
            if (this.enableOffline && (Modernizr.indexeddb || Modernizr.websqldatabase)) {
                if (this.startOffline) {
                    me.offlineReady();
                } else {
                    me.docViewer.GetDocument().InitOfflineDB(function() {
                        me.offlineReady();
                    });
                }
            }
            
            me.setShowSideWindow(true);

            me.fireEvent('documentLoaded');
        },
        
        offlineReady: function() {
            var me = this;
            
            var controlGroup = $('#control');
            $('<div>').addClass('separator ui-ele').appendTo(controlGroup);
            
            // download button
            $('<button>').attr({
                'id': 'offlineDownloadButton',
                'class': 'ui-ele'
            })
            .attr('data-i18n', '[title]offline.downloadOfflineViewing')
            .data("downloading", false)
            .appendTo(controlGroup)
            .button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-arrow-d"
                }
            })
            .i18n();

            // toggle button
            $('<label>').attr({
                'for': 'toggleOfflineButton',
                'id': 'toggleOfflineLabel',
                'class': 'ui-ele'
            })
            .attr('data-i18n', '[title]offline.enableOffline')
            // need this element to keep the button the correct size
            .append('<span id="toggleOfflineLabelSpan" data-i18n="offline.enableOffline"></span>')
            .appendTo(controlGroup)
            .i18n();
            
            $('<input>').attr({
                'type': 'checkbox',
                'id': 'toggleOfflineButton'
            })
            .appendTo(controlGroup)
            .button({
                text: false,
                icons: {
                    primary: "ui-icon-custom-offline"
                }
            });
            
            
            var doc = me.docViewer.GetDocument();
            
            $('#offlineDownloadButton').click(function() {
                var that = this;
            
                var isDownloading = $(this).data("downloading");
            
                if (isDownloading) {
                    // allow cancelling while the download is happening
                    $(this).data("downloading", false);
                    doc.CancelOfflineModeDownload();
                } else {
                    $(this).data("downloading", true);
                    
                    doc.StoreOffline(function() {
                        $(that).data("downloading", false);
                        
                        $(that).button('option', {
                            icons: {
                                primary: 'ui-icon-custom-arrow-d'
                            }
                        });
                        
                        if (doc.IsDownloaded()) {
                            $('#toggleOfflineButton').button('enable');
                        }
                        
                        $(that).attr('data-i18n', '[title]offline.downloadOfflineViewing').i18n();
                    });
                    
                    // switch to the cancel icon while the download is going on
                    $(this).button('option', {
                        icons: {
                            primary: 'ui-icon-custom-cancel'
                        }
                    });
                    
                    $(this).attr('data-i18n', '[title]offline.cancelDownload').i18n();
                }
            });
            
            $('#toggleOfflineButton').click(function() {
                var offlineEnabled = !doc.GetOfflineModeEnabled();
                doc.SetOfflineModeEnabled(offlineEnabled);

                toggleOfflineButtonText(offlineEnabled);
            });

            function toggleOfflineButtonText(offlineEnabled) {
                var label = $('#toggleOfflineLabel');
                
                if (offlineEnabled) {
                    label.find('#toggleOfflineLabelSpan').attr('data-i18n', 'offline.disableOffline');
                    label.attr('data-i18n', '[title]offline.disableOffline').i18n();
                } else {
                    label.find('#toggleOfflineLabelSpan').attr('data-i18n', 'offline.enableOffline');
                    label.attr('data-i18n', '[title]offline.enableOffline').i18n();
                }
            }
            
            if (doc.GetOfflineModeEnabled()) {
                // if we start in offline mode then update the button's properties
                $('#toggleOfflineButton').attr('checked', 'checked').button('refresh');
                toggleOfflineButtonText(true);
            }

            if (!doc.IsDownloaded()) {
                $('#toggleOfflineButton').button('disable');
            }
        },
        
        updateAnnotations: function() {
            if (this.server_url === null) {
                console.warn("Server URL was not specified.");
                return;
            }
            
            var am = this.docViewer.GetAnnotationManager();
            var saveAnnotUrl = this.server_url;
            if (this.doc_id !== null) {
                saveAnnotUrl += "?did=" + this.doc_id+'&curruser='+this.currUser;
            }
            
            var command = am.GetAnnotCommand();
            $.ajax({
                type: 'POST',
                url: saveAnnotUrl,
                data: {
                    'data': command
                },
                contentType: 'xml',
                success: function(data) {
                    /*jshint unused:false */
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    /*jshint unused:false */
                },
                dataType: 'xml'
            });
        },
        
        saveAnnotations: function() {
            //---------------------------
            // Save annotations
            //---------------------------
            // You'll need server-side communication here
            
            // 1) local saving
            //var xfdfString = this.docViewer.GetAnnotationManager().ExportAnnotations();
            //var uriContent = "data:text/xml," + encodeURIComponent(xfdfString);
            //newWindow = window.open(uriContent, 'XFDF Document');
            
            // 2) saving to server (simple)
            if (this.server_url === null) {
                console.warn("Not configured for server-side annotation saving.");
                return;
            }

            var query = '?did=' + this.doc_id + '&curruser=' + this.currUser;
            if (this.doc_id === null) {
                //Document id is not available. did will not be set for server-side annotation handling.
                query = '';
            }
            var am = this.docViewer.GetAnnotationManager();
            if (am) {
                var overlayMessage = $('#overlayMessage');
                overlayMessage.attr('data-i18n', 'annotations.savingAnnotations');
                overlayMessage.i18n();
                
                overlayMessage.dialog({
                    dialogClass: 'no-title',
                    draggable: false,
                    resizable: false,
                    minHeight: 50,
                    minWidth: window.innerWidth / 3,
                    show: {
                        effect: 'fade',
                        duration: 400
                    },
                    hide: {
                        effect: 'fade',
                        duration: 1000
                    }
                });
                
                var xfdfString = encodeURIComponent(am.ExportAnnotations());
                $.ajax({
                    type: 'POST',
                    url: this.server_url + query,
                    data: {
                        'data': xfdfString
                    },
                    success: function(data) {
                        /*jshint unused:false */
                        //Annotations were sucessfully uploaded to server
                        overlayMessage.attr('data-i18n', 'annotations.saveSuccess');
                        overlayMessage.i18n();
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        /*jshint unused:false */
                        console.warn("Failed to send annotations to server.");
                        overlayMessage.attr('data-i18n', 'annotations.saveError');
                        overlayMessage.i18n();
                    },
                    complete: function() {
                        setTimeout(function() {
                            overlayMessage.dialog('close');
                        }, 1000);
                    }
                });
            }
            
            // 3) saving to server (avoid conflicts)
            // NOT IMPLEMENTED
        },
        
        initBookmarkView: function() {
            var me = this;
            var doc = this.docViewer.GetDocument();

            displayBookmarks(doc.GetBookmarks(), $("#bookmarkView"), 0);

            //delegate event
            $("#bookmarkView").off("hover").on("hover", "div.bookmarkWrapper", function(event) {
                if (event.type === 'mouseenter') {
                    //$("#bookmarkView > li").removeClass("ui-state-hover");
                    $(this).addClass("ui-state-hover");
                } else {
                    $(this).removeClass("ui-state-hover");
                }
            });
            
            function displayBookmarks(bookmarks, currentNode, id) {
                /*jshint loopfunc:true */
                for (var i = 0; i < bookmarks.length; i++) {
                    var node = document.createElement('span');
                    node.id = "bookmark" + id;
                    node.innerHTML = bookmarks[i].name;
                    
                    var newNode;
                    if (bookmarks[i].children.length > 0) {
                        newNode = $("<li class=\"closed\"></li>");
                        node.className="Node";
                    } else {
                        newNode = $("<li></li>");
                        node.className="Leaf";
                    }
                    var otherNode = $(node);
                    var wrapper = $("<div class='bookmarkWrapper' id=bookmarkWrapper" + id + "></div>");
                    newNode.append(wrapper.append(otherNode));
                    
                    wrapper.data('data', {
                        bookmark: bookmarks[i],
                        id: id++
                    })
                    .click(function() {
                        if (me.clickedBookmark !== -1) {
                            $("#bookmarkWrapper" + me.clickedBookmark).removeClass('ui-state-active');
                            me.clickedBookmark = -1;
                        }
                        me.clickedBookmark = $(this).data("data").id;
                        $(this).addClass('ui-state-active');
                        
                        me.docViewer.DisplayBookmark($(this).data("data").bookmark);
                    });
                    
                    currentNode.append(newNode);

                    if (bookmarks[i].children.length > 0) {
                        var $list = $("<ul></ul>");
                        newNode.append($list);
                        
                        id = displayBookmarks(bookmarks[i].children, $list, id);
                    }
                }
                
                if (i === 0) {
                    $("#bookmarkView").append('<div style="padding:5px 3px;" data-i18n="sidepanel.outlineTab.noOutlines"></div>');
                    $("#bookmarkView").i18n();
                }
                
                return id;
            }
            $("#bookmarkView").treeview();
        },
        
        initThumbnailView: function() {
            /*jshint loopfunc: true */
            var me = this;

            var nPages = this.docViewer.GetPageCount();
            for (var i = 0; i < nPages; i++) {
                this.requestedThumbs[i] = false;
            }
            
            //delegate event
            $("#thumbnailView").off("hover").on("hover", "div.ui-widget-content", function(event) {
                if (event.type === 'mouseenter') {
                    $(this).addClass("ui-state-hover");
                } else {
                    $(this).removeClass("ui-state-hover");
                }
            });

            this.thumbnailsElement = this.$thumbnailViewContainer.get(0);
            
            for (var pageIndex = 0; pageIndex < nPages; pageIndex++) {
                
                var thumbContainer = document.createElement('div');
                thumbContainer.id = "thumbContainer" + pageIndex;
                thumbContainer.style.height = me.thumbContainerHeight + "px";
                thumbContainer.className = "thumbContainer ui-widget-content";
                var $thumbContainer = $(thumbContainer);
                $thumbContainer.append($("<div class=\"thumbdiv\"><span style=\"height:150px\"></span></div>"));
                var div = document.createElement('div');
                div.style.textAlign = "center";
                div.innerHTML = (pageIndex + 1);
                $thumbContainer.append(div);
                
                this.$thumbnailViewContainer.append($thumbContainer
                    .data('data', {
                        pageNumber: pageIndex + 1
                    })
                    .click(function() {
                        var pageIndex = $(this).data("data").pageNumber - 1;
                    
                        if (me.clickedThumb !== -1) {
                            $("#thumbContainer" + me.clickedThumb)
                            .removeClass('ui-state-active');
                        }
                        me.clickedThumb = pageIndex;

                        $(this).addClass('ui-state-active');

                        var divTop = me.thumbnailsElement.scrollTop;
                        var divBottom = divTop + me.thumbnailsElement.offsetHeight;
                    
                        var top = pageIndex * me.thumbContainerHeight;
                        var bottom = top + me.thumbContainerHeight;

                        if (!(top >= divTop && bottom <= divBottom)) {
                            me.thumbnailsElement.scrollTop = pageIndex * me.thumbContainerHeight;
                            if (bottom > divBottom) {
                                me.thumbnailsElement.scrollTop = me.thumbnailsElement.scrollTop - me.thumbnailsElement.clientHeight + me.thumbContainerHeight;
                            }
                        }
                        setTimeout(function() {
                            me.docViewer.SetCurrentPage(pageIndex + 1);
                        }, 0);
                    })  //END Click
                    );  //END Append
               
            }

            var thumbs = this.getVisibleThumbs();
            this.appendThumbs(thumbs);
        },
        
        initSearchView: function() {
            //delegate event
            $("#fullSearchView").off("hover").on("hover", "div.searchResultLine", function(event) {
                if (event.type === 'mouseenter') {
                    $(this).addClass("ui-state-hover");
                } else {
                    $(this).removeClass("ui-state-hover");
                }
            });
        },
        
        appendThumbs: function(visibleThumbs) {
            /*jshint loopfunc: true */
            var me = this;
            var doc = this.docViewer.GetDocument();
            
            for (var i = 0; i < visibleThumbs.length; i++) {
                (function() {
                    var pageIndex = visibleThumbs[i];
                    if (me.requestedThumbs[pageIndex] === true || $('#thumbContainer' + pageIndex).find('img').length > 0) {
                        return;
                    }
                    
                    me.requestedThumbs[pageIndex] = true;
                    doc.LoadThumbnailAsync(pageIndex, function(thumb) {

                        me.requestedThumbs[pageIndex] = false;

                        var width, height, ratio;
                        if (thumb.width > thumb.height) {
                            ratio = thumb.width / 150;
                            height = thumb.height / ratio;
                            width = 150;
                        } else {
                            ratio = thumb.height / 150;
                            width = thumb.width / ratio;
                            height = 150;
                        }
                        thumb.style.width = width + 'px';
                        thumb.style.height = height + 'px';
                        
                        thumb.className = "thumb";
                        
                        var $thumbContainer = $("#thumbContainer" + pageIndex);
                        $($thumbContainer).find(".thumbdiv").empty().append(thumb);

                        // Vertical centering of canvas
                        var pad = document.createElement('div');
                        pad.className = "thumbPad";
                        var pHeight = me.thumbContainerHeight - height;
                        var size = parseInt(pHeight / 2.0, 10);

                        pad.style.marginBottom = size + 'px';
                        
                        $thumbContainer.prepend(pad);
                    }, 'thumbview');
                })();
            }
        },
        
        getVisibleThumbs: function(){
            var thumbIndexes = [];
            var thumbContainerHeight = this.$thumbnailViewContainer.height(); //height of the current viewport
            var thumbItemHeight = $('.thumbContainer').outerHeight(true); //outer height including margin
            if (typeof this.thumbnailsElement === 'undefined') {
                return thumbIndexes;
            }
            var scrollTop = this.thumbnailsElement.scrollTop;
            var scrollBottom = scrollTop + thumbContainerHeight;
            
            var topVisiblePageIndex =  Math.floor(scrollTop / thumbItemHeight);
            var bottomVisiblePageIndex = Math.ceil(scrollBottom / thumbItemHeight) - 1;
            var totalVisiblePages = bottomVisiblePageIndex - topVisiblePageIndex  + 1;

            //keep around/pre-load surrounding thumbnails that are not immediately visible.
            var topVisibleWithCache = topVisiblePageIndex - totalVisiblePages;
            if (topVisibleWithCache < 0) {
                topVisibleWithCache = 0;
            }
            var nPages = this.docViewer.GetPageCount();
            var bottomVisibleWithCache = bottomVisiblePageIndex + (totalVisiblePages);
            if (bottomVisibleWithCache >= nPages) {
                bottomVisibleWithCache = (nPages - 1);
            }
            
            for (var i = topVisibleWithCache; i <= bottomVisibleWithCache; i++ ) {
                thumbIndexes.push(i);
            }
            return thumbIndexes;
        },
        
        sidePanelVisible: function() {
            return $('#sidePanel').css('display') !== 'none';
        },

        shiftSidePanel: function() {
            var scrollView = $('#DocumentViewer');

            var shiftAmount = $('#sidePanel').width();
            var scale = (window.innerWidth - shiftAmount) * 100 / window.innerWidth;
            scrollView.width(scale + '%').css('margin-left', shiftAmount);
        },

        clearSidePanelData: function() {
            $('#fullSearchView').empty();
            $('#bookmarkView').empty();
            $('#thumbnailView').empty();
        },
        
        searchText: function(pattern, mode) {
            var me = this;
            if (pattern !== '') {
                if (typeof mode === 'undefined') {
                    mode = me.docViewer.SearchMode.e_page_stop | me.docViewer.SearchMode.e_highlight;
                }
                me.docViewer.TextSearchInit(pattern, mode, false);
            }
        },
        
        fullTextSearch: function(pattern) {
            var pageResults = [];
            
            $('#fullSearchView').empty();
           
            var me = this;
            var searchResultLineId = 0;
            if (pattern !== '') {
                var mode = me.docViewer.SearchMode.e_page_stop | me.docViewer.SearchMode.e_ambient_string | me.docViewer.SearchMode.e_highlight;
                if ($('#wholeWordSearch').attr('checked')) {
                    mode = mode | me.docViewer.SearchMode.e_whole_word;
                }
                if ($('#caseSensitiveSearch').attr('checked')) {
                    mode = mode | me.docViewer.SearchMode.e_case_sensitive;
                }
                me.docViewer.TextSearchInit(pattern, mode, true,
                    // onSearchCallback
                    function(result) {
                        if (result.resultCode === Text.ResultCode.e_found){
                            pageResults.push(result.page_num);
                            var $resultLine = $("<div id=\"searchResultLine" + searchResultLineId + "\">").addClass("searchResultLine ui-widget-content");
                            $('<span>').text(result.ambient_str.slice(0, result.result_str_start)).appendTo($resultLine);
                            $('<b>').text(result.ambient_str.slice(result.result_str_start, result.result_str_end)).appendTo($resultLine);
                            $('<span>').text(result.ambient_str.slice(result.result_str_end, result.ambient_str.length)).appendTo($resultLine);
                            $resultLine.data('data', {
                                result: result,
                                quads: result.quads,
                                searchResultLineId: searchResultLineId++
                            })
                            .click(function() {
                                if (me.clickedSearchResult !== -1) {
                                    $("#searchResultLine" + me.clickedSearchResult).removeClass('ui-state-active');
                                    me.clickedSearchResult = -1;
                                }
                                me.clickedSearchResult = $(this).data("data").searchResultLineId;
                     
                                $(this).addClass('ui-state-active');

                                me.docViewer.DisplaySearchResult($(this).data("data").result);
                            }).appendTo($("#fullSearchView"));
                            if (searchResultLineId === 1) {
                                $resultLine.click();
                            }
                        } else if (result.resultCode === Text.ResultCode.e_done) {
                            // All pages searched.
                            var $fullSearchView = $("#fullSearchView");
                            if ($fullSearchView.is(':empty')) {
                                $fullSearchView.append("<div data-i18n='sidepanel.searchTab.noResults'></div>");
                                $fullSearchView.i18n();
                            }
                        }
                    });
            }
        },
        
        bindEvents: function() {
            var me = this;
            $('#firstPage').bind('click', function() {
                me.docViewer.DisplayFirstPage();
            });
       
            $('#prevPage').bind('click', function() {
                var currentPage = me.docViewer.GetCurrentPage();
                if (currentPage > 1) {
                    me.docViewer.SetCurrentPage(currentPage - 1);
                }
            });
        
            $('#nextPage').bind('click', function() {
                var currentPage = me.docViewer.GetCurrentPage();
                if (currentPage <= me.docViewer.GetPageCount()) {
                    me.docViewer.SetCurrentPage(currentPage + 1);
                }
            });
        
            $('#lastPage').bind('click', function() {
                me.docViewer.DisplayLastPage();
            });
            
            $('#rotateButton').bind('click', function() {
                me.docViewer.RotateClockwise();
            });
                    
            $('#searchButton').bind('click', function() {
                me.searchText($('#searchBox').val());
            });
        
            $('#searchBox').bind('keypress', function(e) {                
                if (e.which === 13) { //Enter keycode
                    me.searchText($(this).val());
                }
            });
            
            // Side Panel events
            $('#fullSearchButton').click(function(){
                me.fullTextSearch($('#fullSearchBox').val());
            });
        
            $('#fullSearchBox').bind('keypress', function(e) {
                if(e.which === 13) { //Enter keycode
                    me.fullTextSearch($(this).val());
                }
            });

            me.docViewer.GetAnnotationManager().on('annotationPopupCreated', function(e, annotation, $popupel) {
                // set it to be a flexible textarea, needs to be after the popup is appended to the page
                $popupel.find('.popup-comment').flexible();
            });

            me.bindPrintEvents();
        },
        
        fireEvent: function(type, data) {
            $(document).trigger(type, data);
        },

        startPrintJob: function(pages) {
            var me = this;
            if (!this.preparingForPrint) {
                var totalPages = this.getPageCount();
                var printDisplay = $('#printDisplay');    

                var getPagesToPrint = function() {
                    // remove whitespace
                    var pgs = (pages + '').replace(/\s+/g, '');
                    var pageList = [];
                    // no input, assume every page
                    if (pgs.length === 0) {
                        for (var k = 1; k <= totalPages; k++) {
                            pageList.push(k);
                        }
                        return pageList;
                    }

                    var pageGroups = pgs.split(',');
                    var rangeSplit, start, end;

                    for (var i = 0; i < pageGroups.length; i++) {
                        rangeSplit = pageGroups[i].split('-');
                        if (rangeSplit.length === 1) {
                            // single number
                            pageList.push(parseInt(rangeSplit[0], 10));

                        } else if (rangeSplit.length === 2) {
                            // range of numbers e.g. 2-5
                            start = parseInt(rangeSplit[0], 10);
                            end = parseInt(rangeSplit[1], 10);
                            if (end < start) {
                                continue;
                            }
                            for (var j = start; j <= end; j++) {
                                pageList.push(j);
                            }
                        }
                    }

                    // remove duplicates and NaNs, sort numerically ascending
                    return pageList.filter(function(elem, pos, self) {
                        return self.indexOf(elem) === pos && elem > 0 && elem <= totalPages;
                    }).sort(function(a, b) {
                        return a - b;
                    });
                };

                var prepareDocument = function(pages) {
                    printDisplay.empty();

                    // draw all pages at 100% regardless of devicePixelRatio or other modifiers
                    window.utils.setCanvasMultiplier(1);

                    var zoom = 1;
                    var pageIndex = 0;
                    var canvas, dataurl, img;

                    loadPageLoop();
                    function loadPageLoop() {
                        var doc = me.docViewer.GetDocument();
                        doc.LoadCanvasAsync(pages[pageIndex] - 1, zoom, null, function(pageCanvas) {
                            if (!me.preparingForPrint) {
                                return;
                            }
                            canvas = pageCanvas[0];
                            dataurl = canvas.toDataURL();

                            img = $('<img>')
                                .attr('src', dataurl)
                                .css({
                                    'max-width': '100%',
                                    'max-height': '100%'
                                })
                                .load(function() {
                                    if (!me.preparingForPrint) {
                                        return;
                                    }

                                    printDisplay.append(img);
                                    me.fireEvent('printProgressChanged', [pageIndex + 1, pages.length]);

                                    pageIndex++;
                                    if (pageIndex < pages.length) {
                                        loadPageLoop();
                                    } else {
                                        window.print();
                                        window.utils.unsetCanvasMultiplier();
                                        me.preparingForPrint = false;
                                    }
                                });

                        }, function() {}, 1);
                    }
                };
            
            
                var pagesToPrint = getPagesToPrint();
                if (pagesToPrint.length === 0) {
                    alert("No valid pages specified");
                    return;
                }
                this.preparingForPrint = true;
                prepareDocument(pagesToPrint);
            }
        },

        endPrintJob: function(){
            this.preparingForPrint = false;
            $('#printProgress').hide();
            $('.progressLabel').hide();
            $('#printDisplay').empty();
        },

        bindPrintEvents: function() {
            var me = this;
            var printProgress = $('#printProgress');
            var progressLabel = $('.progressLabel');
            var printPageNumbers = $('#printPageNumbers');

            $('#printButton').click(function() {
                $('#printDialog').dialog({
                    modal: true,
                    resizable: false,
                    open: function() {
                        printPageNumbers.val(me.docViewer.GetCurrentPage());
                    },
                    close: function() {
                        me.endPrintJob();
                    },
                    buttons: [
                        {
                            text: i18n.t("print.preparePages"),
                            click: function() {
                                me.startPrintJob(printPageNumbers.val());
                            }
                        },
                        {
                            text: i18n.t("print.done"),
                            click: function() {
                                $(this).dialog("close");
                            }
                        }
                    ]
                });
            });

            $(document).on('printProgressChanged', function(e, pageNum, totalPages) {
                printProgress.show().progressbar({
                    'value': pageNum / totalPages * 100
                });
                progressLabel.show().attr('data-i18n', 'print.preparingPages')
                .data('i18n-options', {
                    "current": pageNum,
                    "total": totalPages
                })
                .i18n();
            });
        },

        getPageContainer: function(pageIndex) {
            return $('#DocumentViewer').find('#pageContainer' + pageIndex);
        },
        
        getDocumentViewer: function() {
            return this.docViewer;
        },
        
        setInterfaceDefaults: function() {
            var pageIndex = this.docViewer.GetCurrentPage() - 1;
            
            $('#totalPages').text('/' + this.docViewer.GetPageCount());
            var zoom = Math.round(this.docViewer.GetZoom() * 100);
            $('#zoomBox').val(zoom);
            $('#slider').slider({
                value: zoom
            });
            $('#pageNumberBox').val(pageIndex + 1);
            var pan = $('#pan');
            pan[0].checked = false;
            var textSelect = $('#textSelect');
            textSelect[0].checked = true;
            pan.button("refresh");
            textSelect.button("refresh");
            
            this.clickedThumb = pageIndex;
            $("#thumbContainer" + pageIndex).addClass('ui-state-active');
        },

        setVisibleTab: function(index) {
            $("#tabs").tabs("option", "active", index);
        },
        
        //==========================================================
        // Implementation to the WebViewer.js interface
        //==========================================================
        /**
         * Loads a XOD document into the ReaderControl
         * @function
         * @param {string} doc a URL path to a XOD file
         * @param {boolean} [streaming=false] indicates if streaming mode should be used. For the best performance, set streaming to false.
         */
        loadDocument: function(doc, streaming, decrypt, decryptOptions) {
            // Example of how to decrypt a document thats been XORed with 0x4B
            // It is passed as a parameter to the part retriever constructor.
            // e.g. partRetriever = new window.CoreControls.PartRetrievers.HttpPartRetriever(doc, true, decrypt);
            /*var decrypt = function(data) {

                var arr = new Array(1024);
                var j = 0;
                var responseString = "";

                while (j < data.length) {
                    
                    for (var k = 0; k < 1024 && j < data.length; ++k) {
                        arr[k] = data.charCodeAt(j) ^ 0x4B;
                        ++j;
                    }
                    responseString += String.fromCharCode.apply(null, arr.slice(0,k));
                }
                return responseString;
            };*/
            
            var queryParams = window.ControlUtils.getQueryStringMap();
            var path = queryParams.getString('p');

            window.readerControl.startOffline = queryParams.getBoolean('startOffline', false);
            var silverlightCORS =  queryParams.getBoolean('useSilverlightRequests', false);
            var partRetriever;
            try {
                var cacheHinting = exports.CoreControls.PartRetrievers.CacheHinting;
                if (window.readerControl.startOffline) {
                    partRetriever = new CoreControls.PartRetrievers.WebDBPartRetriever();
                } else if(silverlightCORS === true){
                    partRetriever = new CoreControls.PartRetrievers.SilverlightPartRetriever(doc, cacheHinting.CACHE, decrypt, decryptOptions);
                } else if (path !== null) {
                    partRetriever = new CoreControls.PartRetrievers.ExternalHttpPartRetriever(doc, path);
                } else if (streaming === true) {
                    partRetriever = new CoreControls.PartRetrievers.StreamingPartRetriever(doc, cacheHinting.CACHE, decrypt, decryptOptions);
                } else {
                    partRetriever = new CoreControls.PartRetrievers.HttpPartRetriever(doc, cacheHinting.CACHE, decrypt, decryptOptions);
                }
            } catch(err) {
                console.error(err);
            }
            this.docViewer.LoadAsync(partRetriever, window.readerControl.doc_id);
            
        },
        
        getShowSideWindow: function() {
            if ($("#sidePanel").css('display') === "block") {
                return true;
            }
            return false;
        },
        
        setShowSideWindow: function(value) {
            if (value === true) {
                this.shiftSidePanel();

                $('#sidePanel').show();
            } else {
                // reset scroll view to its defaults
                $('#DocumentViewer').width('100%').css('margin-left', 0);

                $('#sidePanel').hide();
            }

            var iconClass = $('#sidePanel').is(':visible') ? "ui-icon-pin-s" : "ui-icon-pin-w";
            $('#toggleSidePanel').button("option", {
                icons: {
                    primary: iconClass
                }
            });

            this.docViewer.ScrollViewUpdated();
        },
        setToolbarVisibility: function(isVisible){
          if(isVisible)  {
              $("#control").show();
          }else{
              $("#control").hide();
          }
          this.resize();
        },
        getCurrentPageNumber: function() {
            return this.docViewer.GetCurrentPage();
        },

        setCurrentPageNumber: function(pageNumber) {
            this.docViewer.SetCurrentPage(pageNumber);
        },

        getPageCount: function() {
            return this.docViewer.GetPageCount();
        },

        getZoomLevel: function() {
            return this.docViewer.GetZoom();
        },

        setZoomLevel: function(zoomLevel) {
            this.docViewer.ZoomTo(zoomLevel);
        },

        rotateClockwise: function() {
            this.docViewer.RotateClockwise();
        },

        rotateCounterClockwise: function() {
            this.docViewer.RotateCounterClockwise();
        },

        getToolMode: function() {
            var tool = this.docViewer.GetToolMode();
            for(var key in this.toolModeMap){
                if(tool instanceof this.toolModeMap[key]){
                    return key;
                }
            }
            return null;
        },

        setToolMode: function(toolMode) {
            var tool = this.toolModeMap[toolMode];
            if(tool){
                this.docViewer.SetToolMode(tool);            
            }
        },

        fitWidth: function() {
            this.docViewer.SetFitMode(this.docViewer.FitMode.FitWidth);
        },

        fitPage: function() {
            this.docViewer.SetFitMode(this.docViewer.FitMode.FitPage);
        },

        fitZoom: function() {
            this.docViewer.SetFitMode(this.docViewer.FitMode.Zoom);
        },
        getFitMode: function(){
            return this.docViewer.GetFitMode();
        },
        setFitMode: function(fitMode){
            this.docViewer.SetFitMode(fitMode);
        },
        goToFirstPage: function() {
            this.docViewer.DisplayFirstPage();
        },

        goToLastPage: function() {
            this.docViewer.DisplayLastPage();
        },

        goToNextPage: function() {
            var currentPage = this.docViewer.GetCurrentPage();
            if (currentPage <= 0) {
                return;
            }
            currentPage = currentPage + 1;
            this.docViewer.SetCurrentPage(currentPage);
        },

        goToPrevPage: function() {
            var currentPage = this.docViewer.GetCurrentPage();
            if (currentPage <= 1) {
                return;
            }
            currentPage = currentPage - 1;
            this.docViewer.SetCurrentPage(currentPage);
        },
        
        getLayoutMode: function() {
            return this.docViewer.GetDisplayModeManager().GetDisplayMode().mode;
        },
        
        setLayoutMode: function(layoutMode) {
            var newDisplayMode = new exports.CoreControls.DisplayMode(this.docViewer, layoutMode);
            this.docViewer.GetDisplayModeManager().SetDisplayMode(newDisplayMode);
        },
         setAnnotationUser: function(username){
            var am = this.docViewer.GetAnnotationManager();
            this.currUser = username;
            am.SetCurrentUser(this.currUser);
        },
        getAnnotationUser: function(){
            var am = this.docViewer.GetAnnotationManager();
            return am.SetCurrentUser();
        },
        setAdminUser: function(isAdmin){
            var am = this.docViewer.GetAnnotationManager();
            this.isAdmin = isAdmin;
            am.SetIsAdminUser(this.isAdmin);
        },
        isAdminUser: function(){
            var am = this.docViewer.GetAnnotationManager();
            return am.GetIsAdminUser();
        },
        setReadOnly: function(isReadOnly){
            var am = this.docViewer.GetAnnotationManager();
            this.readOnly = isReadOnly;
            am.SetReadOnly(this.readOnly);
        },
        isReadOnly: function(){
            var am = this.docViewer.GetAnnotationManager();
            return am.GetReadOnly();
        },
        /**
         *Sets the search mode.
         *All sub-sequent text searches will use the search mode that was set.
         */
        SetSearchModes: function(searchModes) {
            if (!searchModes) {
                return;
            }
            if (searchModes.CaseSensitive) {
                $('#caseSensitiveSearch').attr('checked', true);
            }
            if (searchModes.WholeWord) {
                $('#wholeWordSearch').attr('checked', true);
            }
        }
    };

    exports.ReaderControl.prototype = $.extend(new exports.WebViewerInterface(), exports.ReaderControl.prototype);
    

    
/* ReaderControl event doclet */

/**
 * A global DOM event that is triggered when a document has been loaded.
 * @name ReaderControl#documentLoaded
 * @event
 * @param e a JavaScript event object
 */
 
/** A global DOM event that is triggered when the document view's zoom level has changed.
 * @name ReaderControl#zoomChanged
 * @event
 * @param e a JavaScript event object
 * @param {number} zoom the new zoom level value
 */



/** A global DOM event that is triggered when the current page number has changed.
 * @name ReaderControl#pageChanged
 * @event
 * @param e a JavaScript event object
 * @param {integer} pageNumber the new 1-based page number
 */

/** A global DOM event that is triggered when the display mode has changed
 * @name ReaderControl#layoutModeChanged
 * @event
 * @param e a JavaScript event object
 * @param {object} toolMode the new display mode
 */

/** A global DOM event that is triggered when the fit mode has changed
 * @name ReaderControl#fitModeChanged
 * @event
 * @param e a JavaScript event object
 * @param {object} toolMode the new fit mode
 */

/** A global DOM event that is triggered when a page had finished rendering.
 * @name ReaderControl#pageCompleted
 * @event
 * @param e a JavaScript event object
 * @param {integer} pageNumber the 1-based page number that finished rendering
 */
})(window);

$(function() {
   $(window).on('hashchange', function() {        
        window.location.reload();
    });
    
    i18n.init(window.ControlUtils.getI18nOptions(), function() {
        $('body').i18n();
    });

    var unsupported = false;
    if (!window.CanvasRenderingContext2D) {
        unsupported = true;
        $('body').children().hide();
        $('#unsupportedErrorMessage').show();
    }

    if (unsupported) {
        //unsupported browser detected, show error message
        $('body').children().hide();
        $('#unsupportedErrorMessage').show();
        return;
    }
    
    var viewerElement = document.getElementById("DocumentViewer");
    
    var queryParams = window.ControlUtils.getQueryStringMap();
    var configScript = queryParams.getString('config');

    function initializeReaderControl() {
        var enableAnnot = queryParams.getBoolean('a', false);
        var enableOffline = queryParams.getBoolean('offline', false);
            
        window.readerControl = new ReaderControl(viewerElement, enableAnnot, enableOffline);
        
        var doc = queryParams.getString('d');
        
        var doc_id = queryParams.getString('did');
        if (doc_id !== null) {
            window.readerControl.doc_id = doc_id;
        }
        
        var server_url = queryParams.getString('server_url');
        if (server_url !== null) {
            window.readerControl.server_url = server_url;
        }
        
        var user = queryParams.getString('user');
        if (user !== null) {
            window.readerControl.currUser = user;
        }
    
        var admin = queryParams.getBoolean('admin', window.readerControl.isAdmin);
        window.readerControl.isAdmin = admin;
    
        var readOnly = queryParams.getBoolean('readonly');
        if (readOnly !== null) {
            window.readerControl.readOnly = readOnly;
        }
    
        var streaming = queryParams.getBoolean('streaming', false);
        var auto_load = queryParams.getBoolean('auto_load', true);
        
        var showToolbar = queryParams.getBoolean('toolbar');
        if(showToolbar !== null){
            ReaderControl.config.ui.hideControlBar = !showToolbar;
        }
        
        if (!ReaderControl.config.ui.hideControlBar) {
            //this is kind of a weird place to do this... but we want to 
            //make sure the toolbar is not shown before we read the query params
            window.readerControl.setToolbarVisibility(true);
        }
        
        window.readerControl.fireEvent("viewerLoaded");
        
        // auto loading may be set to false by webviewer if it wants to trigger the loading itself at a later time
        if (doc === null || auto_load === false) {
            return;
        }

        if (queryParams.getBoolean('startOffline')) {
            $.ajaxSetup ({
                cache: true
            });

            window.readerControl.loadDocument(doc, false);
        } else {
            window.ControlUtils.byteRangeCheck(function(status) {
                // if the range header is supported then we will receive a status of 206
                if (status === 200) {
                    streaming = true;
                }
                window.readerControl.loadDocument(doc, streaming);
            
            }, function() {
                // some browsers that don't support the range header will return an error
                streaming = true;
                window.readerControl.loadDocument(doc, streaming);
            });
        }
    }
    
    
    if(configScript !== null && configScript.length > 0) {
        //override script path found, prepare ajax script injection
        $.getScript(configScript)
        .done(function(script, textStatus) {
            /*jshint unused:false */
            //override script successfully loaded
            initializeReaderControl();
        })
        .fail(function(jqxhr, settings, exception) {
            /*jshint unused:false */
            console.warn("Config script could not be loaded. The default configuration will be used.");
            initializeReaderControl();
        });
    } else {
        //no override script path, use default
        initializeReaderControl();
    }
});