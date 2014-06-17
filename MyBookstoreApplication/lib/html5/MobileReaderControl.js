/*global FastClick, Android */
(function(exports) {
    "use strict";

    var fCmp = exports.utils.fCmp;

    var Text = XODText;
    var Tools = Tools;
    
    var ReaderControl = function(enableAnnotations, enableOffline) {
        var me = this;
        me.auto = false;
        
        var userAgent = window.navigator.userAgent;
        me.isAndroid = userAgent.indexOf('Android') > -1;
        me.androidBrowser = me.isAndroid && userAgent.indexOf('Chrome') === -1 && userAgent.indexOf('Firefox') === -1;
        
        if (window.opera || me.androidBrowser || exports.utils.ie === 10 || exports.utils.ie === 11) {
            // certain browsers have issues with css transforms for one reason or another so we just fall back to using top and left
            // IE10/11 seem to have some issues with after swiping pages, sometimes just in metro mode
            // Android webview doesn't like negative transforms
            me.useTransformFallback = true;
        }

        // some browsers seem to have some issues with fast click
        if (!window.opera && !me.androidBrowser && !exports.utils.ieWebView) {
            // library used to fix slow buttons on mobile devices
            // only attach to the main page because of issues with widgets on the dialogs
            FastClick.attach(document.getElementById('viewerPage'));
        }
        
        exports.CoreControls.SetCanvasMode(exports.CoreControls.CanvasMode.ViewportCanvas);
        
        me.docViewer = new exports.CoreControls.DocumentViewer();
        
        me.enableOffline = enableOffline ? true : false;
        
        me.enableAnnotations = enableAnnotations ? true : false;
        me.annotationManager = me.docViewer.GetAnnotationManager();
        me.annotationManager.defaultStrokeThickness = 3;
        
        Annotations.ControlHandle.selectionAccuracyPadding = 10;  //make it easier to select control handles
        Annotations.SelectionAlgorithm.canvasVisibilityPadding = 50;
        Annotations.SelectionModel.selectionAccuracyPadding = 10;
        Annotations.ControlHandle.handleWidth = 16;
        me.annotationManager.DisableDefaultStickyNotes();
        // whether we're editing stroke or fill color currently
        me.editColorMode = null;
        me.colorEditing = {
            Stroke: "stroke",
            Fill: "fill"
        };

        me.docViewer.SetOptions({
            enableAnnotations: this.enableAnnotations
        });

        me.pageDisplayModes = {
            Single: 0,
            Double: 1
        };
        me.pageDisplay = me.pageDisplayModes.Double;
        
        me.doc_id = null;
        me.server_url = null;
        me.currUser = '';
        
        if (!_.isUndefined(ReaderControl.config) && !_.isUndefined(ReaderControl.config.defaultUser)) {
            me.currUser = ReaderControl.config.defaultUser;
        }
        
        this.isAdmin = false;
        this.readOnly = false;
        
        me.$viewerPage = $('#viewerPage');
        me.$viewer = $('#viewer');
        me.$slider = $('#slider');
        // call the slider function to initialize it, only necessary for IE9
        me.$slider.slider();
        me.$preview = $("#preview");
        me.$viewerWrapper = $("#viewerWrapper"); /* used to avoid event conflicts */
        me.$wrapper = $('#wrapper'); /* used to avoid event conflicts */
        me.$thumbContainer = $("#thumbContainer");
        me.$pageIndicator = $('#pageIndicator'); /* page number input control*/
        me.$menuWrapper = $('#menuWrapper'); /*top menu bar*/
        me.$bookmarkView = $("#bookmarkView");
        me.$bookmarkList = $('#bookmarkList');
        
        me.$clipboard = $('#clipboard');
        me.$clipboardWrapper = $('#clipboardWrapper');
        me.$searchInput = $('#searchInput');

        me.$fixedToolbars = $("[data-position='fixed']");
        me.$customDialogs = $('.custom-dialog');
        me.$defaultMenuContext = $('#defaultMenuContext');
        me.$searchMenuContext = $('#searchMenuContext');
        me.$annotCreateButton = $('#annotCreateButton');
        me.$annotCreateMenuContext = $('#annotCreateMenuContext');
        me.$annotEditPopup = $('#annotEditPopup');
        me.$annotEditPopup.popup({'tolerance': 0});
        me.$annotEditButtons = me.$annotEditPopup.find('#annotEditButtons');
        me.$thicknessSlider = $("#thicknessSlider");
        me.$thicknessSlider.slider({
            min: 1,
            max: 5,
            animate: true
        });
        me.$noteMenu = $('#noteMenu');
        me.$noteTextarea = me.$noteMenu.find('#noteTextarea');

        // mapping between button ids and their associated tool modes
        var toolModes = exports.Tools;
        me.buttonIdsToToolModes = {
            'editAnnotButton': toolModes.AnnotationEditTool,
            'createStickyButton': exports.Tools.MobileStickyCreateTool,
            'createHighlightButton': toolModes.TextHighlightCreateTool,
            'createUnderlineButton': toolModes.TextUnderlineCreateTool,
            'createStrikeoutButton': toolModes.TextStrikeoutCreateTool,
            'createRectangleButton': toolModes.RectangleCreateTool,
            'createEllipseButton': toolModes.EllipseCreateTool,
            'createLineButton': toolModes.LineCreateTool,
            'createFreehandButton': toolModes.FreeHandCreateTool
        };
        
        me.doc = null;
        me.nPages = null;
        me.hasThumbs = false;
        me.eventsBound = false;
        
        me.offsetSwipe = 0; /* number of swipes done before a render */
        me.vWOffset = 0; /* fixed position of viewer wrapper */
        me.vwxPos = 0; /* current position of viewer wrapper with scrolling */

        me.currentPageIndex = 0;
        me.currentPageZoom = null;
        me.currentPageMinZoom = null;
        me.currentPageMaxZoom = null;
        me.minZooms = [];
        
        me.zoomedWrapper = null;
        me.transformOffset = null;
        
        me.pagesRendering = [];
        me.snapComplete = false;

        me.isSliding = false;
        me.isPinching = false;
        me.recentlyZoomed = false;
        me.shouldRerender = false;
        me.lastRequestedThumbnail = 0;
        
        me.lastWidth = window.innerWidth;
        me.lastHeight = window.innerHeight;
        
        me.distRatio = 1;
        me.oldScale = 1;
        me.newScale = 1;
        me.oldPinchCenter = {
            x: 0,
            y: 0
        };
        me.oldDist = 1;
        me.newDist = null;
        me.oldTouch = {
            x: 0,
            y: 0
        };

        me.c = null; /* current page wrapper */
        me.n = null; /* next page wrapper */
        me.p = null; /* prev page wrapper */
        
        me.rerenderPages = null;

        me.nPagesPerWrapper = 1;
        
        me.mousePt1 = null;
        me.mousePt2 = null;
        
        me.textSelect = false;
        me.searchMode = null;
        me.annotMode = false;
        
        me.docViewer.on('documentLoaded', _(this.onDocumentLoaded).bind(this));
        
        me.docViewer.on('displayPageLocation', function(e, pageNumber, vpos, hpos) {
            /*jshint unused: false */
            
            // clear the timeout so that if there's a pending swipe it will be cancelled
            clearTimeout(me.swipeTimeout);
            me.offsetSwipe = 0;
            
            me.setCurrentPage(parseInt(pageNumber, 10) - 1);
        });
        
        me.docViewer.on('pageNumberUpdated', function(e, pageNumber) {
            me.$pageIndicator.attr('value', pageNumber);
            me.$slider.val(pageNumber).slider("refresh");
            me.fireEvent('pageChanged', {
                pageNumber : pageNumber
            });
        });
        
        me.docViewer.on('textSelected', function(e, quads, text) {
            me.$clipboard.attr('value', text);
            if (text.length > 0) {
                me.$clipboardWrapper.show();
            } else{
                me.$clipboardWrapper.hide();
            }
        });
        
        $(me.docViewer.el).css('cursor', 'default');
        
        me.docViewer.on('notify', exports.ControlUtils.getNotifyFunction);

        me.annotationManager.on('annotationSelected', function(e, annotations, action) {

            if (action === "selected") {

                if (annotations.length === 1) {
                    //single annotation was selected;
                    var annotation = annotations[0];

                    // get the 0-indexed page number of the annotation
                    var annotPageIndex = annotation.PageNumber - 1;
                    var firstPageInWrapper = me.adjustedPageIndex(me.currentPageIndex);
                    var lastPageInWrapper = firstPageInWrapper + me.nPagesPerWrapper - 1;
                    
                    // if the page of the annotation is not in the currently shown page wrapper then jump to its page
                    if (annotPageIndex < firstPageInWrapper || annotPageIndex > lastPageInWrapper) {
                        me.setCurrentPage(annotPageIndex);
                    }
                }

            }
        });
        
        me.annotationManager.on('annotationChanged', function(e, annotation, action) {
            if (action === "add") {
                // sticky note annotations should show the note right away after they're created
                // however only if the create menu is visible because we don't want to show the note if we just loaded from xfdf
                if (annotation instanceof Annotations.StickyAnnotation && me.$annotCreateMenuContext.is(":visible")) {
                    // switch the tool mode first because that will deselect all annotations
                    me.docViewer.SetToolMode(exports.Tools.AnnotationEditTool);
                    me.annotationManager.SelectAnnotation(annotation);
                    
                    // highlight the annotation edit button
                    var createButtons = $('#annotCreateMenuContext a');
                    createButtons.removeClass('ui-selected');
                    
                    me.$annotCreateMenuContext.find('#editAnnotButton').addClass('ui-selected');
                    
                    me.showAnnotationEditPopup();
                }
            }
        });

        me.initUi();
        me.initViewer();
    };
    
    ReaderControl.prototype = {
    
        onDocumentLoaded: function() {
            
            var me = this;
            
            // remove the preload divs
            $('#preload').remove();
            
            // set the tool mode after the document has loaded because setting the tool mode will cause a call to
            // DeselectAllAnnotations which will get the visible pages which needs to have ReaderControl defined
            me.docViewer.SetToolMode(exports.Tools.PanTool);
    
            if (!me.eventsBound) {
                me.eventsBound = true;

                me.bindEvents();
            }
            
            me.nPages = me.docViewer.GetPageCount();

            me.setPageMode();
            
            var position = (exports.innerWidth - me.$preview.width()) / 2;
            me.$preview.css("left", position + "px");

            me.$slider.attr("max", me.nPages);

            me.margin = me.docViewer.GetMargin();

            me.doc = me.docViewer.GetDocument();

            me.hasThumbs = me.doc.IncludesThumbnails();

            me.setMinZooms();

            me.updateCurrentZooms(me.currentPageIndex);

            var page = me.doc.GetPageInfo(me.currentPageIndex);
            var pageZoom = me.docViewer.GetPageZoom(me.currentPageIndex);
 
            me.$viewer.css("width", (page.width * pageZoom) + "px");
            me.$viewer.css("height", (page.height * pageZoom) + "px");
            
            me.currentPageIndex = me.docViewer.GetCurrentPage() - 1;
    
            me.setCurrentPage(me.currentPageIndex);
    
            me.$viewer.css("visibility", "visible");
            
            me.initBookmarkView();
            
            if (me.enableAnnotations) {
                $('#annotationOptions').show();
                me.$annotCreateButton.show();

                // update control group with new buttons
                me.$defaultMenuContext.controlgroup();
                
                me.annotationManager.SetCurrentUser(me.currUser);
                me.annotationManager.SetIsAdminUser(me.isAdmin);
                me.annotationManager.SetReadOnly(me.readOnly);
                
                if (!_.isUndefined(ReaderControl.config) && !_.isUndefined(ReaderControl.config.serverURL)) {
                    me.server_url = ReaderControl.config.serverURL;
                }
                if (me.server_url === null) {
                    console.warn("Server URL was not specified.");
                } else {
                    var doc_id_query = '';
                    if (this.doc_id !== null && this.doc_id.length > 0) {
                        doc_id_query = "did=" + this.doc_id;
                        if (me.server_url.indexOf('?') > 0) {
                            doc_id_query = '&' + doc_id_query;
                        } else {
                            doc_id_query = '?' + doc_id_query;
                        }
                    }
                    
                    $.ajax({
                        url: me.server_url + doc_id_query,
                        cache: false,
                        success: function(data) {
                            if (data !== null) {
                                me.annotationManager.externalAnnotsExist = true;
                                me.annotationManager.ImportAnnotations(data);
                            }
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            /*jshint unused:false */
                            console.warn("Annotations could not be loaded from the server.");
                            me.annotationManager.externalAnnotsExist = false;
                        },
                        dataType: 'xml'
                    });
                }
            }
            
            if (me.enableOffline) {
                if (me.startOffline) {
                    me.offlineReady();
                } else {
                    me.doc.InitOfflineDB(function() {
                        me.offlineReady();
                    });
                }
            }
            
            me.fireEvent('documentLoaded');
        },

        bindEvents: function() {
            var me = this;

            me.$viewerPage.bind('swipeleft swiperight', _(this.onSwipe).bind(this));
            
            me.$slider.siblings('.ui-slider-track').bind('vmousedown', _(this.onSliderStart).bind(this));
            me.$slider.siblings('.ui-slider-track').bind('vmousemove', _(this.onSliderMove).bind(this));
            
            // Necessary for Chrome. "touchmove" on slider doesn't trigger when moving outside the slider div after "touchstart".
            $(document).bind('vmousemove', _(this.onSliderMove).bind(this));
            
            me.$slider.siblings('.ui-slider-track').bind('vmouseup', _(this.onSliderEnd).bind(this));
            
            // Necessary for Chrome. "touchend" on slider doesn't trigger when leaving the slider.
            $(document).bind('vmouseup', _(this.onSliderEnd).bind(this));
            
            // The following three events handle pinch: touchstart, touchmove, and touchend.
            me.$viewerPage.bind('touchstart', _(this.onTouchStart).bind(this));
            me.$viewerPage.bind('touchmove', _(this.onTouchMove).bind(this));
            me.$viewerPage.bind('touchend', _(this.onTouchEnd).bind(this));
            
            $(window).bind('resize', _(this.onResize).bind(this));
            
            //$(window.top).bind('orientationchange', _(this.onOrientationChange).bind(this));
            //window.top cannot be accessed if this page is in an iframe, where window.top is from another origin
            //note: if window !== window.top, then orientation change is not detected, and the viewer's viewport will be incorrect
            $(window).bind('orientationchange', _(this.onOrientationChange).bind(this));
        
            me.$wrapper.bind('vmousedown', _(this.onToolMouseDown).bind(this));
            me.$wrapper.bind('vmouseup', _(this.onToolMouseUp).bind(this));
            me.$wrapper.bind('vmousemove', _(this.onToolMouseMove).bind(this));
            
            me.$wrapper.bind('taphold', _(this.onTapHold).bind(this));
            // Tap event for handling left/right navigation and menu toggling
            // bind to wrapper because we want to be able to stop the propagation of the event if there is a tap swipe
            // if we bind to viewerPage the menus will already have been hidden before we can stop the event from bubbling
            me.$wrapper.bind('tap', _(this.onTap).bind(this));
            // there are issues with IE mobile and double tap so just disable it for now
            if (!exports.utils.ie) {
                me.$wrapper.bind('doubletap dblclick', _(this.onDoubleTap).bind(this));
            }
            
            // do not use vclick, which triggers event on content underneath menu
            me.$bookmarkView.on('click', 'a', _(this.onBookmarkSelect).bind(this));
            
            // used to fix issue with links not being "active" right away after tap swiping
            // because of the tricky interactions between jquery mobile's touch and click event handling
            // can be removed if link clicking is handled in touch events
            $.vmouse.resetTimerDuration = 400;
            
            // used to fix issue with the annotation popup menu and _handleDocumentFocusIn in IE going into an infinite loop
            // see https://github.com/jquery/jquery-mobile/issues/5814 for a similar issue
            if (exports.utils.ie) {
                $('body').on('blur', function (e) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                });
            }

            var displaySingle = $('#displaySingle');
            var displayDouble = $('#displayDouble');

            displaySingle.on('checkboxradiocreate', function() {
                if (me.pageDisplay === me.pageDisplayModes.Single) {
                    displaySingle.attr('checked', true);
                } else if (me.pageDisplay === me.pageDisplayModes.Double) {
                    displayDouble.attr('checked', true);
                }
            });

            function updatePageMode(pageMode) {
                me.pageDisplay = pageMode;
                me.setPageMode();
                me.setMinZooms();
                // setting to the current page will recreate the pages for the new page mode
                me.setCurrentPage(me.currentPageIndex);
            }

            displaySingle.on('click', function() {
                updatePageMode(me.pageDisplayModes.Single);
            });

            displayDouble.on('click', function() {
                updatePageMode(me.pageDisplayModes.Double);
            });

            // set default value
            $('#cbShowAnnotations').on('checkboxradiocreate', function() {
                $(this).attr('checked', true);
            });

            me.$customDialogs.on('dialogcreate', function() {
                // use translateZ(0) to work around an issue with -webkit-overflow-scrolling: touch on iOS5 where content not in view initially won't be rendered
                // see http://stackoverflow.com/questions/7808110/css3-property-webkit-overflow-scrollingtouch-error
                $(this).find('div[data-role="header"]').css('-webkit-transform', 'translateZ(0)');

                // need this dialog overlay for IE as events seem to go through the transparent part of the dialog page
                // need to add it at creation time so that it isn't placed inside the dialog container
                $(this).append('<div class="dialogOverlay">');
            });

            me.$customDialogs.on('swiperight', function() {
                $.mobile.changePage('#viewerPage', {
                    transition: 'none',
                    changeHash: false
                });
            });

            me.$customDialogs.click(function(e) {
                if ($(e.target).hasClass('dialogOverlay')) {
                    $.mobile.changePage('#viewerPage', {
                        transition: 'none',
                        changeHash: false
                    });
                }
            });

            // prevent browser's default scrolling when in viewing mode
            document.ontouchmove = function(e) {
                if (!$.mobile.activePage.hasClass('custom-dialog')) {
                    e.preventDefault();
                }
            };
            
            $('#searchButton').click(function() {
                me.$defaultMenuContext.hide();
                me.$searchMenuContext.show();
                me.$searchInput.focus();
                
                me.setMenuTapToggle(false);
            });
            
            $('#searchCancelButton').click(function() {
                me.$searchMenuContext.hide();
                me.$defaultMenuContext.show();
                
                me.setMenuTapToggle(true);
            });
    
            $('#searchRightButton').click(function() {
                var searchterm = me.$searchInput.attr('value');
                me.searchText(searchterm);
            });
            
            $('#searchLeftButton').click(function() {
                var searchterm = me.$searchInput.attr('value');
                me.searchText(searchterm, me.docViewer.SearchMode.e_page_stop | me.docViewer.SearchMode.e_highlight | me.docViewer.SearchMode.e_search_up);
            });
            
            $('#cbShowAnnotations').change(function() {
                me.annotationManager.ToggleAnnotations();
            });
            
            $('#saveAnnotationsButton').click(function() {
                //---------------------------
                // Save annotations
                //---------------------------
                // You'll need server-side communication here

                // 1) local saving
                //var xfdfString = me.annotationManager.ExportAnnotations();
                //var uriContent = "data:text/xml," + encodeURIComponent(xfdfString);
                //newWindow=window.open(uriContent, 'XFDF Document');

                // 2) saving to server (simple)
                if (me.server_url === null) {
                    console.warn("Server URL not defined; not configured for server-side annotation saving.");
                    return;
                }

                $.mobile.loading('show', {
                    text: i18n.t('annotations.savingAnnotations'),
                    textVisible: true
                });

                var xfdfString = me.annotationManager.ExportAnnotations();
                $.ajax({
                    type: 'POST',
                    url: me.server_url + '?did=' + me.doc_id,
                    data: {
                        'data':xfdfString
                    },
                    success: function(data) {
                        /*jshint unused:false */
                        //Annotations were sucessfully uploaded to server
                        $.mobile.loading('show', {
                            text: i18n.t('annotations.saveSuccess'),
                            textVisible: true,
                            textonly: true
                        });
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        /*jshint unused:false */
                        console.warn("Failed to send annotations to server.");
                        $.mobile.loading('show', {
                            text: i18n.t('annotations.saveError'),
                            textVisible: true,
                            textonly: true
                        });
                    },
                    complete: function() {
                        setTimeout(function() {
                            $.mobile.loading('hide');
                        }, 1000);
                        
                    }
                });

            // 3) saving to server with the command structure (avoid conflicts)
            // NOT IMPLEMENTED
            });
            
            $('#annotCreateButton').click(function() {
                if (me.annotationManager.GetMarkupOff()) {
                    // make sure to show all annotations when going into create mode
                    me.annotationManager.ToggleAnnotations();
                    $('#cbShowAnnotations').attr('checked', true).checkboxradio('refresh');
                }
                
                me.$defaultMenuContext.hide();
                
                if (me.readOnly) {
                    me.$annotCreateMenuContext.find('a').hide();
                    me.$annotCreateMenuContext.find('#editAnnotButton').show();
                    me.$annotCreateMenuContext.find('#textSelectButton').show();
                    me.$annotCreateMenuContext.find('#annotCreateCancelButton').show();
                }
                
                me.$annotCreateMenuContext.show();
                
                me.setMenuTapToggle(false);
            });
            
            $('#annotCreateCancelButton').click(function() {
                me.textSelect = false;
                me.docViewer.ClearSelection();
                
                me.$defaultMenuContext.show();
                me.$annotCreateMenuContext.hide();
                
                me.setMenuTapToggle(true);
            });
            
            me.$annotCreateMenuContext.click(function(e) {
                var $buttonPressed = $(e.target).closest('a');
                var buttonId = $buttonPressed.attr('id');
                if (buttonId === 'saveAnnotationsButton') {
                    return;
                }
                
                // first deselect all the buttons
                var allButtons = $('#annotCreateMenuContext a');
                allButtons.removeClass('ui-selected');
                
                var currentToolMode = me.docViewer.GetToolMode();
                var toolMode = me.buttonIdsToToolModes[buttonId];
                
                // if we are currently in edit mode and we pressed on the edit button then we should switch to pan mode
                if (currentToolMode instanceof exports.Tools.AnnotationEditTool && toolMode === exports.Tools.AnnotationEditTool) {
                    me.docViewer.SetToolMode(exports.Tools.PanTool);
                    me.annotMode = false;
                    
                } else if (!_.isUndefined(toolMode)) {
                    // anything other than the cancel button is pressed
                    $buttonPressed.addClass('ui-selected');
                    me.docViewer.SetToolMode(toolMode);
                    me.annotMode = true;
                }
                    
                if (buttonId === 'annotCreateCancelButton') {
                    me.docViewer.SetToolMode(exports.Tools.PanTool);
                    me.annotMode = false;
                    me.$defaultMenuContext.show();
                    me.$annotCreateMenuContext.hide();
                }
                
                if (buttonId === 'textSelectButton') {
                    me.textSelect = !me.textSelect;
                    
                    if (me.textSelect) {
                        me.docViewer.SetToolMode(exports.Tools.PanTool);
                        me.annotMode = false;
                        $buttonPressed.addClass('ui-selected');
                    } else {
                        me.docViewer.ClearSelection();
                    }
                } else {
                    me.textSelect = false;
                }
                
                me.docViewer.SetOptions({
                    annotMode: me.annotMode
                });
                me.closeEditPopup();
            });
            
            me.$annotEditPopup.find('#editDoneButton').click(function() {
                me.annotationManager.DeselectAllAnnotations();
                me.closeEditPopup();
            });
            
            me.$annotEditPopup.find('#editDeleteButton').click(function() {
                me.deleteSelectedAnnotations();
            });
            
            me.$annotEditPopup.find('#editNoteButton').click(function() {
                me.showNotePopup(me.annotationManager.GetSelectedAnnotations()[0], false);
            });
            
            me.$noteMenu.find('#noteSaveButton').click(function() {
                me.annotationManager.GetSelectedAnnotations()[0].setContents(me.$noteTextarea.val());
                // in iOS the menu will be hidden if a note is focused so we need to reshow it
                // when the note is being closed
                me.reshowMenu();
                me.closeEditPopup();
            });
            
            me.$noteMenu.find('#noteDeleteButton').click(function() {
                me.deleteSelectedAnnotations();
                me.reshowMenu();
            });
            
            me.$annotEditPopup.find('#editStrokeColorButton').click(function() {
                me.$annotEditButtons.hide();
                var colorMenu = me.$annotEditPopup.find('#colorMenu');
                me.editColorMode = me.colorEditing.Stroke;
                
                var annotation = me.annotationManager.GetSelectedAnnotations()[0];
                var strokeColor = annotation.StrokeColor;
                var strokeColorName = me.colorRGBtoName(strokeColor.R, strokeColor.G, strokeColor.B, strokeColor.A);

                // don't allow a transparent stroke color
                colorMenu.find('li[data-color="transparent"]').hide();

                colorMenu.find('li').removeClass('ui-selected');
                colorMenu.find('li[data-color="' + strokeColorName + '"]').addClass('ui-selected');
                colorMenu.show();
                
                me.setEditPopupLocation(annotation);
            });
            
            me.$annotEditPopup.find('#editFillColorButton').click(function() {
                me.$annotEditButtons.hide();
                var colorMenu = me.$annotEditPopup.find('#colorMenu');
                me.editColorMode = me.colorEditing.Fill;
                
                var annotation = me.annotationManager.GetSelectedAnnotations()[0];
                var fillColor = annotation.FillColor;
                var fillColorName = me.colorRGBtoName(fillColor.R, fillColor.G, fillColor.B, fillColor.A);

                colorMenu.find('li[data-color="transparent"]').show();
                colorMenu.find('li').removeClass('ui-selected');
                colorMenu.find('li[data-color="' + fillColorName + '"]').addClass('ui-selected');
                colorMenu.show();
                
                me.setEditPopupLocation(annotation);
            });
            
            me.$annotEditPopup.find('.colorPicker').click(function(e) {
                var selectedAnnotations = me.annotationManager.GetSelectedAnnotations();
                if (selectedAnnotations.length <= 0) {
                    return;
                }
                var annotation = selectedAnnotations[0];
                
                var $li = $(e.target).closest('li');
                
                if ($li.length > 0) {
                    $(this).find('li').removeClass('ui-selected');
                    $li.addClass('ui-selected');
                    
                    var color = me.colorNameToRGB($li.attr('data-color'));
                    if (color) {
                        if (me.editColorMode === me.colorEditing.Stroke) {
                            annotation.StrokeColor = color;
                        } else if (me.editColorMode === me.colorEditing.Fill) {
                            annotation.FillColor = color;
                        }
                        
                        me.annotationManager.UpdateAnnotation(annotation);
                        me.annotationManager.trigger('annotationChanged', [annotation, 'modify']);
                    }
                }
            });

            me.$annotEditPopup.find('#colorDoneButton').click(function() {
                me.closeEditPopup();
            });
            
            me.$annotEditPopup.find('#editThicknessButton').click(function() {
                var annotation = me.annotationManager.GetSelectedAnnotations()[0];
                
                me.$annotEditButtons.hide();
                me.$thicknessSlider.val(annotation.StrokeThickness).slider("refresh");
                $("#thicknessMenu").show();
                
                me.setEditPopupLocation(annotation);
            });
            
            me.$annotEditPopup.find('#thicknessDoneButton').click(function() {
                me.closeEditPopup();
            });
            
            me.$thicknessSlider.change(function() {
                var selectedAnnotations = me.annotationManager.GetSelectedAnnotations();
                if (selectedAnnotations.length <= 0) {
                    return;
                }
                var annotation = selectedAnnotations[0];
                
                annotation.StrokeThickness = me.$thicknessSlider.get(0).value;
                me.annotationManager.UpdateAnnotation(annotation);
                me.annotationManager.trigger('annotationChanged', [annotation, 'modify']);
            });
            
            if (me.isAndroid && !me.androidBrowser) {
                // this is a hacky workaround for issues with submitting an number input field on android
                // instead of a "go" or "submit" button there is a "next" button, so this will go to the off screen field and then submit the form
                // we don't include the default android browser here because it seems that the next button doesn't do anything so this won't work!
                // we also can't include this for other browsers because on the ipad the off screen field causes the menu header animation to be jittery
                var numFix = $('<input data-role="none" type="text" style="margin-left:-999px;"/>');
                var numSubmit = $('<input data-role="none" style="height: 0px; width: 0px; border: none; padding: 0px;" tabindex="999" type="submit" />');
                numFix.focus(function() {
                    $('#pageIndicatorForm').submit();
                });
                
                $('#pageIndicatorForm').append(numFix, numSubmit);
            }
            
            if (me.androidBrowser) {
                // since the default android browser's next button doesn't work we fall back to changing the page as the numbers are typed
                me.$pageIndicator.keyup(function() {
                    var pageNum = parseInt(me.$pageIndicator.attr('value'), 10) || me.docViewer.GetCurrentPage();
                    if (pageNum === me.docViewer.GetCurrentPage()) {
                        return;
                    }
                    var maxPage = me.docViewer.GetPageCount();
                    pageNum = pageNum > maxPage ? maxPage : pageNum;
                    me.setCurrentPage(pageNum - 1);
                });
            } else {
            
                me.$pageIndicator.closest('form').submit(function() {
                    var pageNum = parseInt(me.$pageIndicator.attr('value'), 10) || me.docViewer.GetCurrentPage();
                    var maxPage = me.docViewer.GetPageCount();
                    pageNum = pageNum > maxPage ? maxPage : pageNum;
                    me.setCurrentPage(pageNum - 1);
                    return false;
                });
            }

            var $searchForm = $(me.$searchInput.get(0).form);
            
            $searchForm.click(function() {
                // focus the search input box if the form was clicked
                // handles the case were the search icon image is clicked instead of the input
                me.$searchInput.focus();
            });
            
            $searchForm.submit(function() {
                var searchterm = me.$searchInput.attr('value');
                try {
                    me.searchText(searchterm);
                    me.$searchInput.blur();
                } catch(ex) {
                //console.log(ex.message);
                } finally {
                    return false;
                }
            });
        },

        initUi: function() {
            // Disables all dragging.
            exports.ondragstart = function() {
                return false;
            };
        
            // Disables all selection.
            exports.onload = function() {
                disableSelection(document.body);
            };
            
            function disableSelection(target) {
                if (typeof target.onselectstart !== "undefined") {//IE
                    target.onselectstart = function() {
                        return false;
                    };
                } else if (typeof target.style.MozUserSelect !== "undefined") {//Firefox
                    target.style.MozUserSelect = "none";
                } else {//All other ie: Opera
                    target.onmousedown = function() {
                        return false;
                    };
                }
                target.style.cursor = "default";
            }
            
            $('.colorPicker li').each(function() {
                var color = $(this).attr('data-color');
                var $colorSquare = $("<div/>");
                if (color === "transparent") {
                    $colorSquare.addClass("color-transparent");
                } else {
                    $colorSquare.css('background-color', color);
                }
                $(this).append($colorSquare);
            });
            
            // so we can interact with annotations right away even when the edit popup is visible
            $('#annotEditPopup-screen').remove();
        },
    
        initViewer: function() {
            var me = this;
    
            me.displayMode = new exports.CoreControls.DisplayMode(me.docViewer, exports.CoreControls.DisplayModes.Custom);
            // override the necessary display mode functions
            $.extend(me.displayMode, {
                WindowToPage: function(windowPt, pageIndex) {
                    var pageTransform = me.displayMode.GetPageTransform(pageIndex);

                    var scaledPagePt = {
                        x: windowPt.x - pageTransform.x,
                        y: windowPt.y - pageTransform.y
                    };

                    var zoom = me.docViewer.GetPageZoom(pageIndex);

                    var pt = {
                        x: scaledPagePt.x / zoom,
                        y: scaledPagePt.y / zoom
                    };
                
                    return {
                        "pageIndex": pageIndex,
                        x: pt.x,
                        y: pt.y
                    };
                },
                
                PageToWindow: function(pagePt, pageIndex) {
                    var zoom = me.docViewer.GetPageZoom(pageIndex);
                    
                    pagePt.x = pagePt.x * zoom;
                    pagePt.y = pagePt.y * zoom;
                    
                    var pageTransform = me.displayMode.GetPageTransform(pageIndex);
                    
                    var cX = pagePt.x + pageTransform.x;
                    var cY = pagePt.y + pageTransform.y;
                    
                    return {
                        x: cX,
                        y: cY
                    };
                },
                
                GetSelectedPages: function(mousePt1, mousePt2) {
                    var firstPageIndex = null;
                    var lastPageIndex = null;
                    
                    me.forEachPageInWrapper(me.currentPageIndex, function(idx) {
                        var pageTransform = me.displayMode.GetPageTransform(idx);
                        
                        var page = me.doc.GetPageInfo(idx);
                        var pageZoom = me.docViewer.GetPageZoom(idx);
                        
                        var pageRect = {
                            x1: pageTransform.x,
                            y1: pageTransform.y,
                            x2: pageTransform.x + page.width * pageZoom,
                            y2: pageTransform.y + page.height * pageZoom
                        };

                        if (mousePt1.x <= pageRect.x2
                            && mousePt1.x >= pageRect.x1
                            && mousePt1.y <= pageRect.y2
                            && mousePt1.y >= pageRect.y1) {
                            
                            firstPageIndex = idx;
                        }

                        if (mousePt2.x <= pageRect.x2
                            && mousePt2.x >= pageRect.x1
                            && mousePt2.y <= pageRect.y2
                            && mousePt2.y >= pageRect.y1) {
                            
                            lastPageIndex = idx;
                        }
                    });
                    
                    return {
                        first: firstPageIndex,
                        last: lastPageIndex
                    };
                },
                
                GetVisiblePages: function() {
                    var pageIndexes = [];
                    var adjustedPageIndex = me.adjustedPageIndex(me.currentPageIndex);
                    
                    var addPage = function(i) {
                        pageIndexes.push(i);
                    };
                    
                    me.forEachPageInWrapper(adjustedPageIndex, addPage);
                    // get pages in next wrapper
                    if (adjustedPageIndex + me.nPagesPerWrapper < me.nPages) {
                        me.forEachPageInWrapper(adjustedPageIndex + me.nPagesPerWrapper, addPage);
                    }
                    // get pages in previous wrapper
                    if (adjustedPageIndex - 1 >= 0) {
                        me.forEachPageInWrapper(adjustedPageIndex - 1, addPage);
                    }
                    
                    return pageIndexes;
                },
                
                GetPageTransform: function(pageIndex) {
                    var pageData = me.getPageData(pageIndex);
                    
                    if (me.transformOffset !== null) {
                        // these values are the coordinates for the pagewrapper
                        // note that the pagewrapper may be larger than the pages!
                        var left = me.transformOffset.left;
                        var top = me.transformOffset.top;
                        
                        // the leftmost page's x offset which we want to use for calculating the snap location
                        var leftMostX = pageData.x - pageData.xShift;
                        
                        // calculate the snap location for the zoomed in page or pages
                        // adds the pagewrapper coordinates and the page's offset from the wrapper edge
                        var pt = me.getSnapLocation(left + leftMostX, top + pageData.y, pageData.totalWidth, pageData.maxHeight);
                        
                        pageData.x = pt.left + me.vWOffset + pageData.xShift;
                        pageData.y = pt.top;
                    }
                    
                    return {
                        x: pageData.x,
                        y: pageData.y,
                        width: pageData.fitWidth,
                        height: pageData.fitHeight
                    };
                },
                
                GetPageOffset: function(pageIndex) {
                    var pageData = me.getPageData(pageIndex);
                    
                    return {
                        x: pageData.x,
                        y: pageData.y
                    };
                }
            });
            
            me.docViewer.GetDisplayModeManager().SetDisplayMode(me.displayMode);
            me.docViewer.SetFitMode(me.docViewer.FitMode.FitPage);
            exports.CoreControls.SetCachingLevel(2);
            exports.CoreControls.SetPreRenderLevel(0);
            me.docViewer.SetMargin(0);
            
            me.docViewer.on('pageComplete', function(e, pageIndex, canvas) {
                var $pageContainer = $('#pageContainer' + pageIndex);
                $pageContainer.removeClass('loading');
                
                me.canvasToAppend = canvas;

                var idx = me.pagesRendering.indexOf(pageIndex);
                if (idx > -1) {
                    me.pagesRendering.splice(idx, 1);
                }
                
                if (!me.rerenderPages) {
                    me.appendCanvas($pageContainer.parent(), pageIndex);
                } else if (!me.pagesRendering.length && me.rerenderPages && me.snapComplete) {
                    me.rerenderPages();
                }

                if (me.androidBrowser) {
                    // workaround for issue in android browser, see http://code.google.com/p/android/issues/detail?id=31862
                    me.c.$e.find('canvas').each(function() {
                        var $this = $(this);
                        if ($this.css('transform') === 'none') {
                            $this.css('transform', 'translateZ(0)');
                        }
                    });
                }
                
                me.fireEvent("pageCompleted", [pageIndex + 1]);
            });
        },
        
        offlineReady: function() {
            var me = this;
            
            $('#offlineOptions').show();
            var $enableOfflineCheckbox = $('#cbEnableOfflineMode');
            
            me.$defaultMenuContext.trigger('create');
            me.$defaultMenuContext.controlgroup();
            
            $enableOfflineCheckbox.change(function() {
                var offlineEnabled = !me.doc.GetOfflineModeEnabled();
                me.doc.SetOfflineModeEnabled(offlineEnabled);
            });

            if (me.doc.GetOfflineModeEnabled()) {
                toggleOfflineCheckbox(true);
            }

            function toggleOfflineCheckbox(offlineEnabled) {
                $enableOfflineCheckbox.attr('checked', offlineEnabled).checkboxradio('refresh');
            }
            
            $('#offlineDownloadBtn').click(function() {
                var $this = $(this);
                
                var progressSlider = $('#optionsDialog').find('.progress-bar');
                progressSlider.show();
                // add the active class explicitly so that the bar displays
                progressSlider.find('.ui-slider-bg').addClass('ui-btn-active');

                var isDownloading = $this.data('downloading');
                
                if (isDownloading) {
                    $this.data('downloading', false);
                    me.doc.CancelOfflineModeDownload();
                } else {
                    $this.data('downloading', true);
                    $this.attr('data-i18n', '[value]offline.cancelDownload').i18n().button('refresh');
                    
                    me.doc.StoreOffline(function() {
                        $this.data('downloading', false);
                        $this.attr('data-i18n', '[value]offline.downloadOfflineViewing').i18n().button('refresh');
                        progressSlider.hide();
                        $('#download-progress').val(0).slider('refresh');
                        
                        if (me.doc.IsDownloaded()) {
                            $enableOfflineCheckbox.checkboxradio('enable');
                        }
                    }, function(fractionDone) {
                        $('#download-progress').val(fractionDone * 100).slider('refresh');
                    });
                }
            });
            
            if (!me.doc.IsDownloaded()) {
                $enableOfflineCheckbox.attr('disabled', true);
            }
        },
        
        // calls the given function on each page index in the wrapper of the passed in page index
        forEachPageInWrapper: function(pageIndex, func) {
            var me = this;
            var adjustedIndex = me.adjustedPageIndex(pageIndex);
            for (var i = 0; i < me.nPagesPerWrapper; i++) {
                var idx = adjustedIndex + i;
                if (idx >= me.nPages) {
                    break;
                }
                func(idx);
            }
        },
        
        // enable or disable the tap toggling behavior of the menu
        setMenuTapToggle: function(value) {
            this.$fixedToolbars.fixedtoolbar({
                tapToggle: value
            });
        },
        
        reshowMenu: function() {
            if (this.$fixedToolbars.hasClass('ui-fixed-hidden')) {
                this.$fixedToolbars.fixedtoolbar('show');
            }
        },
        
        setPageMode: function() {
            if (this.pageDisplay === this.pageDisplayModes.Single) {
                // always one page shown
                this.nPagesPerWrapper = 1;
            } else if (this.pageDisplay === this.pageDisplayModes.Double) {
                // two pages in landscape, one in portrait
                if (window.innerWidth > window.innerHeight) {
                    this.nPagesPerWrapper = 2;
                } else {
                    this.nPagesPerWrapper = 1;
                }
            }
            
            this.docViewer.SetPagesPerCanvas(this.nPagesPerWrapper);
        },
        
        updateCurrentZooms: function(pageIndex) {
            var me = this;
        
            var pageZoom = me.docViewer.GetPageZoom(pageIndex);
            me.currentPageZoom = pageZoom;
            me.currentPageMinZoom = me.minZooms[pageIndex];
            
            var zoomApprox = window.devicePixelRatio > 1 ? 5 : 5;
            
            me.currentPageMaxZoom = me.currentPageMinZoom * zoomApprox;
        },

        setMinZooms: function() {
            var me = this;
        
            for (var i = 0; i < me.nPages; i++) {
                var pageIndex = i;
                var pageZoom = me.getFitPageZoom(pageIndex);
                me.docViewer.SetPageZoom(pageIndex, pageZoom);
                me.minZooms[i] = pageZoom;
            }
        },

        setCurrentToMinZoom: function() {
            var me = this;
            
            me.forEachPageInWrapper(me.currentPageIndex, function(i) {
                me.docViewer.SetPageZoom(i, me.minZooms[i]);
            });
        },
        
        clearPages: function($wrapper) {
            // remove everything besides the canvases, pagecontainers and thumbnails (eg links, widgets)
            $wrapper.find('*').not('canvas, [id^=pageContainer], img').remove();
        },
        
        appendCanvas: function(container, pageIndex) {
            var me = this;
            
            // look for canvas with class that starts with canvas
            var oldCanvas = container.find("[class^='canvas'], [class*=' canvas']");
            
            if (oldCanvas.length > 0) {
                oldCanvas = oldCanvas[0];
            } else {
                oldCanvas = null;
            }
            
            // return if this is the final page
            var finalPageInWrapper = Math.min((me.adjustedPageIndex(pageIndex) + me.nPagesPerWrapper - 1), me.nPages - 1) === pageIndex;
            
            if (finalPageInWrapper || !me.isZoomedIn()) {
                container.append(me.canvasToAppend);
                if (oldCanvas === me.canvasToAppend) {
                    oldCanvas = null;
                } else if (oldCanvas !== null) {
                    $(oldCanvas).attr('style', '');
                    $(oldCanvas).remove();
                }
                if (finalPageInWrapper) {
                    me.docViewer.ReturnCanvas(pageIndex, oldCanvas);
                }
            }
        },

        createPageWrapper: function(wrapperIndex, offset) {
            var me = this;

            var pageIndex = me.wrapperToPage(wrapperIndex);
            
            var $pageWrapper = $("<div style=\"top:0px; z-index:0; background-color: #929292;\" class=\"pageContainer\"></div>");
            $pageWrapper.attr("id", "pageWrapper" + wrapperIndex);
        
            var maxHeight = 0;
            me.forEachPageInWrapper(pageIndex, function(pageToAdd) {
                var pageTransform = me.displayMode.GetPageTransform(pageToAdd);
                
                var width = Math.ceil(pageTransform.width);
                
                var pc = $("<div style=\"position: absolute; float: left; z-index: 0; background-color: white \" class=\"pageContainer\"></div>");
                pc.attr("id", "pageContainer" + pageToAdd).width(width).height(pageTransform.height);
                pc.addClass("loading");
                
                me.transform(pc, pageTransform.x, pageTransform.y);
                
                $pageWrapper.append(pc);
                
                if (pageTransform.height > maxHeight) {
                    maxHeight = pageTransform.height;
                }
            });
            
            $pageWrapper.width(window.innerWidth);
            $pageWrapper.height(window.innerHeight);
            
            var left = -me.vWOffset + offset;
            var top = 0;
            
            me.transform($pageWrapper, left, top);
            
            /*
            * $e is the jquery object for the wrapper.
            * tX is the translated x position.
            * tY is the translated y position.
            */
            return {
                $e: $pageWrapper,
                tX: left,
                tY: top,
                i: wrapperIndex
            };
        },
        
        getFitPageZoom: function(pageIndex) {
            var me = this;
        
            var width = 0;
            var height = 0;
            me.forEachPageInWrapper(pageIndex, function(idx) {
                var page = me.doc.GetPageInfo(idx);
                height = page.height > height ? page.height : height;
                width += page.width;
            });

            var heightval = parseFloat(window.innerHeight - me.margin * 2) / height;
            var widthval = parseFloat(window.innerWidth - me.margin * 2) / width;

            var fitPageZoom = heightval < widthval ? heightval : widthval;

            return fitPageZoom;
        },

        zoomAbort: function() {
            var me = this;

            me.pagesRendering = [];
            me.rerenderPages = null;
            
            me.snapComplete = false;
            me.zoomedWrapper = null;
            
            me.newScale = 1;
            me.oldScale = 1;
        },
    
        unZoomWrapper: function() {
            var me = this;

            if (me.zoomedWrapper) {
                me.setCurrentToMinZoom();
            
                me.clearTransform(me.zoomedWrapper.$e.find('canvas'));
                me.zoomedWrapper.$e.remove();
                
                var wi = me.pageToWrapper(me.currentPageIndex);
                me.c = me.createPageWrapper(wi, 0);

                me.$viewer.append(me.c.$e);
                
                me.zoomAbort();
            }
        },
        
        addPages: function(vis, wrapperIndex) {
            var me = this;
            
            var startIdx = me.wrapperToPage(wrapperIndex);
            me.forEachPageInWrapper(startIdx, function(pageToAdd) {
                vis.push(pageToAdd);
            });
        },
        
        pageToWrapper: function(pageIndex) {
            var me = this;
            return Math.floor(pageIndex / me.nPagesPerWrapper);
        },
        
        wrapperToPage: function(wrapperIndex) {
            var me = this;
            return wrapperIndex * me.nPagesPerWrapper;
        },
    
        // gets the page index of the first page in the wrapper that the passed in page index is a part of
        adjustedPageIndex: function(pageIndex) {
            var me = this;
            var wrapperIndex = me.pageToWrapper(pageIndex);
            return me.wrapperToPage(wrapperIndex);
        },
        
        numberOfWrappers: function() {
            var me = this;
            return Math.ceil(me.nPages / me.nPagesPerWrapper);
        },
        
        getPageData: function(pageIndex) {
            var me = this;
            
            var fitZoom = me.getFitPageZoom(pageIndex);
            var totalWidth = 0;
            var maxHeight = 0;
            var xShift = 0;
            var width, height;
            
            // get the fit page zoom width and height of the pages
            me.forEachPageInWrapper(pageIndex, function(i) {
                var page = me.doc.GetPageInfo(i);
                var pageWidth = page.width * fitZoom;
                var pageHeight = page.height * fitZoom;
                
                if (pageIndex === i) {
                    xShift = totalWidth;
                    width = pageWidth;
                    height = pageHeight;
                }
                
                totalWidth += pageWidth;
                
                if (pageHeight > maxHeight) {
                    maxHeight = pageHeight;
                }
            });
            
            var snapLocation = me.getSnapLocation(0, 0, totalWidth, maxHeight);
            
            // get the offset to the page for fit page zoom
            var x = snapLocation.left + me.vWOffset + xShift;
            
            var y = snapLocation.top;
            
            // amount of scaling done by zooming
            var relativeScale = me.docViewer.GetPageZoom(pageIndex) / fitZoom;
            
            return {
                // the offset from the edge of the page wrapper increases depending on how much the page scale has increased
                x: x * relativeScale,
                y: y * relativeScale,
                // how much the individual page is shifted relative to x
                xShift: xShift * relativeScale,
                // the combined dimensions of all the pages in the wrapper
                totalWidth: totalWidth * relativeScale,
                maxHeight: maxHeight * relativeScale,
                // the fit width and height of only the current page
                fitWidth: width,
                fitHeight: height
            };
        },
    
        setCurrentPage: function(pageIndex) {
            var me = this;
            
            me.transformOffset = null;
            // clear any transforms on the canvases
            if (me.c) {
                me.clearTransform(me.c.$e.find('canvas'));
            }
            
            me.setCurrentToMinZoom();
            if (me.zoomedWrapper) {
                me.zoomAbort();
            }

            // only close the edit popup if we are actually changing pages
            if (pageIndex !== me.currentPageIndex) {
                me.closeEditPopup();
            }

            me.currentPageIndex = pageIndex;
            me.updateCurrentZooms(me.currentPageIndex);

            var wrapperIndex = me.pageToWrapper(pageIndex);
 
            me.docViewer.RemoveContent();

            var vis = [];

            me.addPages(vis, wrapperIndex);
            
            me.c = me.createPageWrapper(wrapperIndex, 0);
            me.$viewer.append(me.c.$e);
            
            // if there should be a next page
            if (wrapperIndex < me.numberOfWrappers() - 1) {
                var nextWrapperIndex = wrapperIndex + 1;
            
                me.addPages(vis, nextWrapperIndex);
            
                me.n = me.createPageWrapper(nextWrapperIndex, exports.innerWidth);
                me.$viewer.append(me.n.$e);
            
            } else {
                me.n = null;
            }
            
            // if there should be a previous page
            if (wrapperIndex > 0) {
                var prevWrapperIndex = wrapperIndex - 1;
                
                me.addPages(vis,prevWrapperIndex);
            
                me.p = me.createPageWrapper(prevWrapperIndex, -exports.innerWidth);
                me.$viewer.append(me.p.$e);
         
            } else {
                me.p = null;
            }
            
            me.docViewer.UpdateView(vis, pageIndex);
   
            me.$slider.val((pageIndex + 1)).slider("refresh");
        },
        
        cancelPageRenders: function() {
            var me = this;
            
            if (me.rerenderPages !== null) {
                me.rerenderPages = null;
                
                me.forEachPageInWrapper(me.currentPageIndex, function(i) {
                    me.docViewer.StopPageRender(i);
                });
            }
        },
        
        onSwipe: function(evt) {
            var me = this;
            
            if (me.isInHeader(evt.target) || me.isSliding || me.textSelect || me.annotMode || me.isPinching || me.isZoomedIn() || me.recentlyZoomed || me.isWidgetTargetType(evt.target.type)) {
                return;
            }
            
            var direction;
            if (evt.type === 'swiperight' && me.p) {
                direction = -1;
                me.offsetSwipe--;
            } else if (evt.type === 'swipeleft' && me.n) {
                direction = 1;
                me.offsetSwipe++;
            } else {
                return;
            }
            
            me.unZoomWrapper();
            
            var currentPageIndex = me.docViewer.GetCurrentPage() - 1;
            var wrapperIndex = me.pageToWrapper(currentPageIndex) + me.offsetSwipe;
            var pageIndex = me.wrapperToPage(wrapperIndex);
            me.currentPageIndex = pageIndex;
            me.updateCurrentZooms(me.currentPageIndex);
        
            var wpToRemove = null;
            var tmpWp = me.c;
        
            if (direction === 1) {
                me.c = me.n;
                wpToRemove = me.p;
            } else {
                me.c = me.p;
                wpToRemove = me.n;
            }

            me.vWOffset = me.vWOffset - direction * exports.innerWidth;
            me.$viewerWrapper.stop();
            me.$viewerWrapper.addClass('animated');

            me.transform(me.$viewerWrapper, me.vWOffset, 0);
            
            me.vwxPos = me.vWOffset;
            
            var nextWrapperIndex = wrapperIndex + direction;
            var prevWrapperIndex = wrapperIndex - direction;
            
            // Remove the previous page.
            if (wpToRemove) {
                wpToRemove.$e.remove();
            
                // if a page is being removed then we should notify document viewer the visible pages have changed
                // but we also don't want to rerender yet
                me.docViewer.UpdateVisiblePages();
            }

            var wpToAdd = null;
            
            // Append the next page.
            if (nextWrapperIndex >= 0 && nextWrapperIndex < me.numberOfWrappers()) {
                var offset = direction * exports.innerWidth;
                wpToAdd = me.createPageWrapper(nextWrapperIndex, offset);
            }

            if (direction === 1) {
                me.n = wpToAdd;
                me.p = tmpWp;

                if (me.n) {
                    me.$viewer.append(me.n.$e);
                }
            } else {
                me.p = wpToAdd;
                me.n = tmpWp;

                if (me.p) {
                    me.$viewer.prepend(me.p.$e);
                }
            }
            
            me.$slider.val(pageIndex + 1).slider("refresh");
            
            clearTimeout(me.swipeTimeout);
            me.swipeTimeout = setTimeout(function() {

                me.offsetSwipe = 0;
                
                var vis = [];
                me.addPages(vis, wrapperIndex);
                         
                if (nextWrapperIndex >= 0 && nextWrapperIndex < me.numberOfWrappers()) {
                    me.addPages(vis, nextWrapperIndex);
                }
                
                if (prevWrapperIndex >= 0 && prevWrapperIndex < me.numberOfWrappers()) {
                    me.addPages(vis, prevWrapperIndex);
                }

                me.docViewer.UpdateView(vis, pageIndex);
            }, 250);
        },
        
        onSliderStart: function() {
            var me = this;
        
            me.isSliding = true;
            if (me.nPages !== 1) {
                me.$preview.css("opacity", "1");
                me.$preview.css("z-index", "9999");
            }
        },
        
        onSliderMove: function() {
            var me = this;
            
            if (me.isSliding === false) {
                return;
            }
        
            var pageNumber = me.$slider.get(0).value;
            var div = $('#textdiv');
            
            div.attr('data-i18n', 'mobile.thumbnailPageNumber');
            // need to use the data function instead of .attr('data-i18n-options') or else it will be cached and won't update
            div.data('i18n-options', {
                "current": pageNumber,
                "total": me.nPages
            });
            div.i18n();

            if (!me.hasThumbs) {
                return;
            }
        
            clearTimeout(me.getThumbnailTimeout);
            
            me.getThumbnailTimeout = setTimeout(function() {
        
                var pageIndex = me.$slider.get(0).value - 1;
            
                var thumbContainer = me.$thumbContainer.get(0);

                // try to cancel the last requested thumbnail
                me.doc.CancelThumbnailRequest(me.lastRequestedThumbnail, 'thumbview');
                me.lastRequestedThumbnail = pageIndex;

                me.doc.LoadThumbnailAsync(pageIndex, function(thumb) {
                    var ratio, width, height;

                    if (thumb.width > thumb.height) {
                        ratio = thumb.width / 150;
                        height = thumb.height / ratio;
                        width = 150;
                    } else {
                        ratio = thumb.height / 150;
                        width = thumb.width / ratio;
                        height = 150;
                    }

                    thumb.style.width = width + "px";
                    thumb.style.height = height + "px";
                
                    while (thumbContainer.hasChildNodes()) {
                        thumbContainer.firstChild.src = null;
                        thumbContainer.removeChild(thumbContainer.firstChild);
                    }
                
                    me.$thumbContainer.css("width", width + "px");
                    me.$thumbContainer.css("height", height + "px");
                
                    me.$preview.css("width", width + "px");
                    me.$preview.css("height", height + 17 + "px");

                    me.$thumbContainer.prepend(thumb);

                }, 'thumbview');
            }, 15);
        },
        
        onSliderEnd: function() {
            var me = this;
        
            if (!me.isSliding) {
                return;
            }
            me.isSliding = false;
        
            var pageNumber = me.$slider.get(0).value;
            if (pageNumber !== me.docViewer.GetCurrentPage()) {
                me.setCurrentPage(pageNumber - 1);
            }
        
            me.$preview.css("opacity", "0");
            me.$preview.css("z-index", "0");
            me.$slider.slider("refresh");
        },

        getTapHotSpotWidth: function() {
            //make sure the tap navigation region is never more than 1/4 of the screen width
            var defaultWidth = exports.innerWidth / 4;
            return (defaultWidth > 80) ? 80 : defaultWidth;
        },

        onTap: function(evt) {
            var me = this;
            
            if (evt.target.type === 'text' || evt.target.type === 'number' ) {
                // these are text inputs, don't do anything
                return true;
            }
            var docX = exports.innerWidth;
            var pageX = evt.pageX;
            var pageY = evt.pageY;

            var hotspotWidth = me.getTapHotSpotWidth();
            var menuBarBufferHeight = 40;
            
            // don't check for hotspot tapping if we're in annotation mode because the triggered swipe is going to be blocked anyway
            // also if we return false it will stop the event from propagating to the click handler on the stroke color picker
            if (!this.annotMode) {
                //hotspot tapping
                if (pageY > menuBarBufferHeight) {
                
                    if (pageX < hotspotWidth) {
                        me.$wrapper.trigger('swiperight');
                        return false; //prevent event bubbling
                    } else if ((docX - pageX) < hotspotWidth) {
                        me.$wrapper.trigger('swipeleft');
                        return false; //prevent event bubbling
                    }
                }
            }

            return true;
        },
        
        onDoubleTap: function(evt) {
            var me = this;
            
            var touchLocation;
            if (evt.originalEvent.changedTouches) {
                touchLocation = {
                    x: evt.originalEvent.changedTouches[0].clientX,
                    y: evt.originalEvent.changedTouches[0].clientY
                };
            } else {
                touchLocation = {
                    x: evt.originalEvent.clientX,
                    y: evt.originalEvent.clientY
                };
            }
            
            var hotspotWidth = me.getTapHotSpotWidth();
            if (touchLocation.x < hotspotWidth || (exports.innerWidth - touchLocation.x) < hotspotWidth) {
                //we are tap swiping so don't try to zoom into the page
                return;
            }
            
            if (me.offsetSwipe !== 0) {
                // if we are swiping quickly it's possible to trigger a double tap
                // so we should return here if the user is swiping
                return;
            }
            
            me.newScale = 1;
            me.oldScale = 1;
            var DOUBLE_TAP_ZOOM_SCALE = 3;
            
            var originalPageZoom = me.docViewer.GetPageZoom(me.currentPageIndex);
            var newPageZoom = DOUBLE_TAP_ZOOM_SCALE * me.getFitPageZoom(me.currentPageIndex);
            
            // if we should zoom in
            if (originalPageZoom < newPageZoom) {
                var offset = me.c.$e.offset();
                var width = me.c.$e.width();
                var height = me.c.$e.height();
                
                // calculate the location of the touch event on the page where (0,0) is at the center of the page
                var touchLocX = (touchLocation.x - offset.left) - width / 2;
                var touchLocY = (touchLocation.y - offset.top) - height / 2;
                // get the coordinates of the event for the new scaled page
                var scaledLocX = touchLocX * (newPageZoom / originalPageZoom);
                var scaledLocY = touchLocY * (newPageZoom / originalPageZoom);
                // calculate the amount that the zoomed page needs to be shifted so that the same part of the page is
                // under the touch location after it has been zoomed
                var offsetX = touchLocX - scaledLocX;
                var offsetY = touchLocY - scaledLocY;
                
                me.c.tX += offsetX;
                me.c.tY += offsetY;
                
                // don't want to animate this zoom
                me.setZoomLevel(newPageZoom, false);
            } else {
                me.setZoomLevel(me.minZooms[me.currentPageIndex], false);
            }
            // don't let the second tap be triggered
            evt.stopImmediatePropagation();
        },
        
        isWidgetTargetType: function(type) {
            return type === "textarea" || type === "checkbox" || type === "button" || type === "submit";
        },
        
        isInHeader: function(ele) {
            return $(ele).closest('#pageHeader').length > 0;
        },
        
        isZoomedIn: function() {
            return this.docViewer.GetPageZoom(this.currentPageIndex) > this.minZooms[this.currentPageIndex];
        },
        
        onTapHold: function() {
            if (!_.isUndefined(exports._trnDebugMode) && exports._trnDebugMode === true) {
                server.capture();
                // this.auto = this.auto ? false : true;

                // var count = 0;
                // var reverse = false;
                
                // if (this.auto) {
                //     this.autoTimeout = exports.setInterval(function() {
                //         count++;
                //         if (count === Math.ceil(this.nPages / this.nPagesPerWrapper)) {
                //             count = 0;
                //             reverse = !reverse;
                //         }
                //         if (reverse) {
                //             this.$wrapper.trigger('swiperight');
                //         } else {
                //             this.$wrapper.trigger('swipeleft');
                //         }
                //     // var rand = Math.random();
                //     // if (rand < 0.4) {
                //     // this.$wrapper.trigger('swipeleft');
                //     // } else if (rand >= 0.4 && rand <0.8) {
                //     // this.$wrapper.trigger('swiperight');
                //     // } else {
                //     // this.setCurrentPage(Math.floor(this.nPages * Math.random()));
                //     // }
                        
                //     }, 1500);
                // } else {
                //     clearTimeout(this.autoTimeout);
                // }
            }
        },
        
        // innerWidth and innerHeight can be incorrect when resize event is hit.
        // Always correct in orientationChange event but orientationChange event almost
        // always has incorrect values for innerWidth and innerHeight on the Xoom (Android).
        // Resize event seems to always have correct values on Xoom.
        onResize: function() {
            // makes sure that the side dialogs will be positioned correctly in iOS
            window.scrollTo(0, 0);

            var me = this;
            //this._iframeWorkaround();
            var screenWidth = exports.innerWidth;
            var screenHeight = exports.innerHeight;
            
            // var iframed = (window !== window.top);

            var heightChanged = screenHeight !== me.lastHeight;
            var widthChanged = screenWidth !== me.lastWidth;
            
            // if the height has gotten smaller and the width hasn't changed then we can assume that the virtual keyboard
            // being shown has caused the resize. In this case if we are in the main menu then we should not perform a resize
            // so that the form inputs can be used. We do want to resize if we are searching or if entering text in a note
            // as this will cause issues with the placement of the page
            if ((screenHeight < me.lastHeight) && !widthChanged && $('#defaultMenuContext').css('display') !== 'none') {
                me.lastHeight = screenHeight;
                return;
            }
            
            // only continue if the dimensions have changed since the last resize
            // opera mobile often seems to report the same dimensions on an orientation change so just always redraw
            // also if MobileReaderControl is iframed, we need to redraw
            var dimensionsChanged = widthChanged || heightChanged;
            if (!dimensionsChanged  && !window.opera) {
                return;
            }
            me.lastWidth = screenWidth;
            me.lastHeight = screenHeight;
            
            clearTimeout(me.swipeTimeout);
 
            me.setPageMode();
            me.setMinZooms();
            me.updateCurrentZooms(me.currentPageIndex);
        
            var position = (exports.innerWidth - me.$preview.width()) / 2;
            me.$preview.css("left", position + "px");
            me.setCurrentPage(me.currentPageIndex);
            
            // sometimes the fixed menu doesn't get reshown when changing orientations and a note is open
            // so we should show the menu if it's hidden
            if (me.annotMode) {
                me.reshowMenu();
                me.showAnnotationEditPopup();
            }
        },
        
        onOrientationChange: function(evt) {
            // on the initial load if there is an orientation change it seems like there is no resize event
            // triggered, causing the page to be displayed incorrectly so we manually call it here
            this.onResize(evt);
        },
        
        restartTouchTimeout: function() {
            var me = this;
            
            clearTimeout(me.touchTimeout);
            me.touchTimeout = setTimeout(_(me.onTouchEnd).bind(me), 1000, {
                originalEvent: {
                    touches: []
                }
            });
        },

        onTouchStart: function(evt) {
            var me = this;
            
            me.restartTouchTimeout();
            me.docViewer.trigger("PAUSE");
            me.c.$e.removeClass('animated');
    
            // Only pinch if dealing with two or more fingers
            if (evt.originalEvent.touches.length > 1) {
                me.isPinching = true;
     
                var touch0 = evt.originalEvent.touches[0];
                var touch1 = evt.originalEvent.touches[1];
            
                var x1 = touch1.clientX;
                var y1 = touch1.clientY;
                var x0 = touch0.clientX;
                var y0 = touch0.clientY;
            
                me.oldPinchCenter.x = (x0 + x1) / 2;
                me.oldPinchCenter.y = (y0 + y1) / 2;
            
                me.oldDist = Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
            
            } else if (evt.originalEvent.touches.length === 1) {
                me.oldTouch.x = evt.originalEvent.touches[0].clientX;
                me.oldTouch.y = evt.originalEvent.touches[0].clientY;
            }
        },
        
        transform: function($e, x, y, scale) {
            var me = this;
            
            // css doesn't support exponential notation so set to zero if we're sufficiently close
            if (fCmp(x, 0)) {
                x = 0;
            }
            
            if (fCmp(y, 0)) {
                y = 0;
            }
        
            if (me.useTransformFallback) {
                // some older browsers don't support css transforms or there are issues with them so revert to setting coordinates
                $e.css('top', y);
                $e.css('left', x);

                if (!_.isUndefined(scale)) {
                    $e.css('transform', 'scale(' + scale + ')');
                }
            } else {
                var _2dstr = 'translate(' + x + 'px,' + y + 'px)';
                var _3dstr = 'translate3d(' + x + 'px,' + y + 'px, 0px)';
                
                if (!_.isUndefined(scale)) {
                    var scaleStr = ' scale(' + scale + ')';
                    _2dstr += scaleStr;
                    _3dstr += scaleStr;
                }
                
                if (me.androidBrowser) {
                    //see http://code.google.com/p/android/issues/detail?id=31862
                    $e.css('transform', _3dstr);
                } else {
                    // use 3d transforms for all browsers by default, this can be changed to 2d transforms if desired
                    $e.css('transform', _3dstr);
                }
            }
        },

        clearTransform: function($canvases) {
            $canvases.css({
                'transform': '',
                'left': '',
                'top': ''
            });
        },
    
        onTouchMove: function(evt) {
            var me = this;
            
            me.restartTouchTimeout();

            var touch0;
            var touch1;
            // don't pan in annotation create mode
            if (me.isInHeader(evt.target) || me.isSliding || me.textSelect || me.annotMode || me.isWidgetTargetType(evt.target.type)) {
                return;
            }
            var width = me.c.$e.width();
            var height = me.c.$e.height();
        
            if (evt.originalEvent.touches.length === 1 && !me.isPinching) {
                touch0 = evt.originalEvent.touches[0];
                me.$viewerWrapper.removeClass('animated');
                var scrollX = me.oldTouch.x - touch0.clientX;
                var scrollY = me.oldTouch.y - touch0.clientY;
                                
                if (!me.isZoomedIn()) {
                    // Perform horizontal scrolling.
                    
                    me.vwxPos = me.vwxPos - scrollX;
                    me.transform(me.$viewerWrapper, me.vwxPos, 0);
                } else {
                    // Scrolled the zoomed in wrapper.
                
                    me.c.tY = me.c.tY - scrollY;
                    me.c.tX = me.c.tX - scrollX;
                    me.transform(me.c.$e, me.c.tX, me.c.tY, me.newScale);
                    
                    me.shouldRerender = true;
                    me.cancelPageRenders();
                }
            
                me.oldTouch.x = touch0.clientX;
                me.oldTouch.y = touch0.clientY;
                
            } else if (evt.originalEvent.touches.length > 1) {
                touch0 = evt.originalEvent.touches[0];
                touch1 = evt.originalEvent.touches[1];
                
                var x1 = touch1.clientX;
                var y1 = touch1.clientY;
                var x0 = touch0.clientX;
                var y0 = touch0.clientY;
            
                me.newDist = Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
                me.distRatio = me.newDist / me.oldDist;
                
                // Find pinch center after each touch me.vWOffset event with two fingers
                var newPinchCenter = {
                    x: (x0 + x1) / 2,
                    y: (y0 + y1) / 2
                };
                
                me.newScale = me.distRatio * me.oldScale;
                var actualZoom = me.newScale * me.currentPageZoom;
                
                if (actualZoom > me.currentPageMaxZoom) {
                    me.newScale = me.currentPageMaxZoom / parseFloat(me.currentPageZoom);
                }

                // Relative to viewport.
                var pcMidX = me.c.tX + me.vWOffset + width / 2;
                var pcMidY = me.c.tY + height / 2;
            
                var pcCenter = {
                    x: pcMidX,
                    y: pcMidY
                };

                var scX = pcCenter.x - (me.newScale / me.oldScale) * (pcCenter.x - me.oldPinchCenter.x);
                var scY = pcCenter.y - (me.newScale / me.oldScale) * (pcCenter.y - me.oldPinchCenter.y);
                
                var scaledOldPinchCenter = {
                    x: scX,
                    y: scY
                };

                // Differences in the two pinch centers.
                var offsetX = newPinchCenter.x - scaledOldPinchCenter.x;
                var offsetY = newPinchCenter.y - scaledOldPinchCenter.y;
                me.c.tX = me.c.tX + offsetX;
                me.c.tY = me.c.tY + offsetY;

                me.transform(me.c.$e, me.c.tX, me.c.tY, me.newScale);
                
                // Update old values
                me.oldScale = me.newScale;
                me.oldDist = me.newDist;
                me.oldPinchCenter.x = newPinchCenter.x;
                me.oldPinchCenter.y = newPinchCenter.y;
                
                me.shouldRerender = true;
                me.cancelPageRenders();
            }
        },

        onTouchEnd: function(evt, animate) {
            var me = this;
            
            if (evt.originalEvent.touches.length === 0) {
                clearTimeout(me.touchTimeout);
                
                var newPageZoom = me.newScale * me.currentPageZoom;
                var smallerThanPage = false;
                
                // New zoom is less than fit page zoom.
                // So, floor it at fit page zoom.
                if (newPageZoom < me.currentPageMinZoom) {
                    newPageZoom = me.currentPageMinZoom;
                    me.newScale = newPageZoom / parseFloat(me.currentPageZoom);
                    me.oldScale = me.newScale;
                    smallerThanPage = true;
                }
                
                me.startRerender(newPageZoom);
                
                if (_.isUndefined(animate)) {
                    animate = true;
                }
                me.snapBack(smallerThanPage, animate);

                if (me.shouldRerender) {
                    me.clearPages(me.c.$e);
                    var zoomedPages = me.getVisibleZoomedPages();
                    var visiblePages = me.displayMode.GetVisiblePages();

                    // check if we can skip rendering any of the pages because they aren't visible
                    if (zoomedPages.length < me.nPagesPerWrapper) {
                        me.forEachPageInWrapper(me.currentPageIndex, function(pageIndex) {
                            // if page isn't visible while zoomed then remove it from the list of visible pages
                            if (zoomedPages.indexOf(pageIndex) === -1) {
                                var index = visiblePages.indexOf(pageIndex);
                                if (index !== -1) {
                                    visiblePages.splice(index, 1);
                                }
                            }
                        });
                        
                        me.pagesRendering = zoomedPages;
                    }
                    // it's important that we have the current page(s) at the beginning of the visible pages array
                    // because these are the ones we want to render first
                    me.docViewer.UpdateView(visiblePages);
                }
                
                var vwLeft = me.vwxPos;

                var wrapperIndex = me.pageToWrapper(me.currentPageIndex);
                
                // Swipe when scrolling too far to one side.
                if (-vwLeft + me.vWOffset > exports.innerWidth / 2 && wrapperIndex < me.numberOfWrappers() - 1) {
                    me.$wrapper.trigger('swipeleft');
                    evt.stopImmediatePropagation();
                } else if (vwLeft - me.vWOffset > exports.innerWidth / 2 && wrapperIndex > 0) {
                    me.$wrapper.trigger('swiperight');
                    evt.stopImmediatePropagation();
                } else {
                    // Return to original X position after horizontal scrolling.
                    me.$viewerWrapper.addClass('animated');

                    // Only apply translate if we have actually moved. Page redraws everytime this is applied.
                    if (me.vwxPos !== me.vWOffset) {
                        me.transform(me.$viewerWrapper, me.vWOffset, 0);
                    }
                    me.vwxPos = me.vWOffset;
                }

                me.isPinching = false;
                me.shouldRerender = false;
                me.docViewer.trigger("RESUME");
            }
        },
        
        startRerender: function(newPageZoom) {
            var me = this;

            if (me.shouldRerender) {
                me.pagesRendering = [];
                me.forEachPageInWrapper(me.currentPageIndex, function(idx) {
                    me.docViewer.SetPageZoom(idx, newPageZoom);
                    me.pagesRendering.push(idx);
                });
                
                me.c.$e.find('.auxiliary').hide();
                
                me.rerenderPages = function() {
                    me.rerenderPages = null;
                    
                    if (newPageZoom === me.currentPageMinZoom) {
                        me.zoomedWrapper = null;
                        me.transformOffset = null;
                    }
                    
                    me.c.$e.removeClass("animated");
                    
                    var prevWidth = parseFloat(me.c.$e[0].style.width);
                    var prevHeight = parseFloat(me.c.$e[0].style.height);
                    
                    var left = me.c.tX - (me.newScale * prevWidth) / 2 + prevWidth / 2;
                    var top = me.c.tY - (me.newScale * prevHeight) / 2 + prevHeight / 2;
                    
                    // translate and resize the pagewrapper
                    me.c.tX = left;
                    me.c.tY = top;
                    me.transform(me.c.$e, left, top, 1);
                    
                    me.c.$e.width(prevWidth * me.newScale);
                    me.c.$e.height(prevHeight * me.newScale);
                    
                    var pageIndex;
                    me.c.$e.find('[id^=pageContainer]').each(function() {
                        var width = parseFloat(this.style.width);
                        var height = parseFloat(this.style.height);
                        
                        var $this = $(this);
                        // ids are of the form pageContainer# so we want to slice off the number to get the page index
                        pageIndex = parseInt($this.attr('id').slice('pageContainer'.length), 10);
                        
                        $this.width(width * me.newScale).height(height * me.newScale);
                        $this.find('img').width(width * me.newScale).height(height * me.newScale);
                        
                        var pageData = me.getPageData(pageIndex);
                        me.transform($this, pageData.x, pageData.y);
                    });
                    
                    // translate the canvas to the edge of the viewport
                    me.transform(me.c.$e.find('canvas'), -left - me.vWOffset, -top);
                    me.transform($(me.canvasToAppend), -left - me.vWOffset, -top);
                    
                    me.appendCanvas(me.c.$e, pageIndex);
                    me.c.$e.find('.auxiliary').show();
                    
                    
                    me.currentPageZoom = newPageZoom;
                    me.newScale = 1;
                    me.oldScale = me.newScale;
                    me.snapComplete = false;
                    me.shouldRerender = false;
                };
                
                if (newPageZoom !== me.currentPageMinZoom) {
                    me.zoomedWrapper = me.c;
                }
                
                me.recentlyZoomed = true;
                clearTimeout(me.zoomTimeout);
                me.zoomTimeout = setTimeout(function() {
                    me.recentlyZoomed = false;
                }, 500);
            }
        },
        
        getSnapLocation: function(left, top, width, height) {
            var me = this;
            var offset = -me.vWOffset;
            
            // Snap to bottom.
            if (top < 0 && top + height <= exports.innerHeight) {
                // Line up pc with the bottom of the viewport.
                top = exports.innerHeight - height;
            }
            // Snap to top.
            if (top + height > exports.innerHeight && top > 0) {
                // Line up pc with the top of the viewport.
                top = 0;
            }
            // Snap to right.
            if (left < offset && left + width <= (exports.innerWidth + offset)) {
                // Line up pc with the right of the viewport.
                left = offset + exports.innerWidth - width;
            }
            // Snap to left.
            if (left + width > offset + exports.innerWidth && left > offset) {
                // Line up pc with the left of the viewport.
                left = offset;
            }
            // Center top and left if smaller than fit page.
            if (height <= exports.innerHeight) {
                top = (exports.innerHeight - height) / 2;
            }
            if (width <= exports.innerWidth) {
                left = offset + (exports.innerWidth - width) / 2;
            }

            return {
                top: top,
                left: left
            };
        },
        
        snapBack: function(smallerThanPage, animate) {
            // on iOS when the virtual keyboard if we select a form field and the virtual keyboard becomes visible it can scroll the page
            // in this case we don't want to snap back
            // in iOS7 in landscape mode the scroll top value will often be 20 which is a bug!
            // For now it's simplest just to explicitly check for 20
            var scrollAmount = $(window).scrollTop();
            var isScrolled = scrollAmount !== 0 && scrollAmount !== 20;

            // on android browsers we don't want to snap back if we are selecting input fields because
            // the virtual keyboard will be shown which causes the window height to change
            if (isScrolled || (this.isAndroid && $(document.activeElement).is('textarea, input'))) {
                return;
            }
            
            var me = this;
            var width = parseFloat(me.c.$e.get(0).style.width);
            var height = parseFloat(me.c.$e.get(0).style.height);

            var owidth = width;
            var oheight = height;

            var left = me.c.tX - (me.newScale * owidth) / 2 + owidth / 2;
            var top = me.c.tY - (me.newScale * oheight) / 2 + oheight / 2;

            width *= me.newScale;
            height *= me.newScale;
            
            var pageData = me.getPageData(me.adjustedPageIndex(me.currentPageIndex));

            // use the x and y offsets of the page relative to the wrapper to calculate where the page would snap to if
            // it was not inside the wrapper
            var pt = me.getSnapLocation(left + pageData.x, top + pageData.y, pageData.totalWidth, pageData.maxHeight);
            
            // after getting where the page would snap to we need to subtract the page offsets so that we get the location that
            // the wrapper needs to be at
            pt.left -= pageData.x;
            pt.top -= pageData.y;
            
            var oldtX = me.c.tX;
            var oldtY = me.c.tY;
            
            me.c.tX = pt.left + (me.newScale * owidth) / 2 - owidth / 2;
            me.c.tY = pt.top + (me.newScale * oheight) / 2 - oheight / 2;

            var willNotAnimate = !animate || (fCmp(oldtX, me.c.tX) && fCmp(oldtY, me.c.tY) && !smallerThanPage);
            if (willNotAnimate) {
                // No animation will occur so snap is completed immediately
                me.snapComplete = true;
            } else {
                var animEnd = function() {
                    me.snapComplete = true;
                    if (!me.pagesRendering.length && me.rerenderPages) {
                        me.rerenderPages();
                    }
                    me.c.$e.get(0).removeEventListener('webkitTransitionEnd', animEnd, false);
                    me.c.$e.get(0).removeEventListener('transitionend', animEnd, false);
                };
                // TODO: feature detection for correct transition event
                me.c.$e.get(0).addEventListener('webkitTransitionEnd', animEnd, false);
                me.c.$e.get(0).addEventListener('transitionend', animEnd, false);
                
                me.c.$e.addClass('animated');
            }
            
            me.transform(me.c.$e, me.c.tX, me.c.tY, me.newScale);
            
            me.transformOffset = {
                left: left,
                top: top
            };
        },
        
        getVisibleZoomedPages: function() {
            var me = this;
            
            var pageIndexes = [];
            var page;
            
            var viewportTop = exports.pageYOffset;
            var viewportBottom = viewportTop + exports.innerHeight;
            var viewportLeft = exports.pageXOffset;
            var viewportRight = viewportLeft + exports.innerWidth;
            
            me.forEachPageInWrapper(me.currentPageIndex, function(pageIndex) {
                page = me.doc.GetPageInfo(pageIndex);
                
                var pt1 = me.displayMode.PageToWindow({
                    x: 0,
                    y: 0
                }, pageIndex);
                var pt2 = me.displayMode.PageToWindow({
                    x: page.width,
                    y: page.height
                }, pageIndex);
                
                if ((pt1.x < pt2.x ? pt1.x: pt2.x) <= viewportRight
                    && (pt1.x < pt2.x ? pt2.x: pt1.x) >= viewportLeft
                    && (pt1.y < pt2.y ? pt1.y: pt2.y) <= viewportBottom
                    && (pt1.y < pt2.y ? pt2.y: pt1.y) >= viewportTop) {
                    pageIndexes.push(pageIndex);
                }
            });
            return pageIndexes;
        },
        
        searchText: function(pattern, searchUp) {

            var pageResults = [];
            
            var me = this;
            if (pattern !== '') {
                var mode = me.docViewer.SearchMode.e_page_stop | me.docViewer.SearchMode.e_highlight;
                if (searchUp) {
                    mode = mode | me.docViewer.SearchMode.e_search_up;
                }
                
                me.docViewer.TextSearchInit(pattern, mode, false,
                    // onSearchCallback
                    function(result) {
                        if (result.resultCode === Text.ResultCode.e_found) {
                            pageResults.push(result.page_num);

                            me.docViewer.DisplaySearchResult(result, _(me.jumpToFound).bind(me));
                        } else if (result.resultCode === Text.ResultCode.e_done) {
                            alert(i18n.t("endOfDocument"));
                        }
                    });
            }
        },
        
        fullSearch: function(pattern, searchUp) {
            var me = this;
            
            var pageResults = [];
            if (pattern !== '') {
                var mode = me.docViewer.SearchMode.e_page_stop | me.docViewer.SearchMode.e_highlight;
                if (searchUp) {
                    mode = mode | me.docViewer.SearchMode.e_search_up;
                }
                
                me.docViewer.TextSearchInit(pattern, mode, true,
                    // onSearchCallback
                    function(result) {
                        if (result.resultCode === Text.ResultCode.e_found) {
                            var pageIndex = result.page_num;
                            pageResults.push(result.page_num);

                            me.docViewer.DisplaySearchResult(result, function() {
                                me.jumpToFound(pageIndex, result.quads);
                            });
                        } else if (result.resultCode === Text.ResultCode.e_done) {
                            alert(i18n.t("endOfDocument"));
                        }
                    });
            }
        },
    
        select: function() {
            var me = this;
            if (me.mousePt1 === null || me.mousePt2 === null) {
                return;
            }
    
            var windowPt1 = this.mousePt1;
            var windowPt2 = this.mousePt2;
        
            var selectedPages = me.displayMode.GetSelectedPages(windowPt1, windowPt2);
            var firstPage = selectedPages.first;
            var lastPage = selectedPages.last;
            if (firstPage === null || lastPage === null) {
                return;
            }

            var pagePt1 = me.displayMode.WindowToPage(windowPt1, firstPage);
            var pagePt2 = me.displayMode.WindowToPage(windowPt2, lastPage);

            me.docViewer.Select(pagePt1, pagePt2);
        },

        jumpToFound: function(pageIndex, quads) {
            var me = this;
            
            if (me.currentPageIndex !== pageIndex) {
                me.setCurrentPage(pageIndex);
            }
            
            // don't align if we're at fit page zoom
            if (me.currentPageZoom === me.getFitPageZoom(me.currentPageIndex)) {
                return;
            }
            
            if (quads.length > 0) {
                var firstPoints = quads[0].GetPoints();
                // x4y4 is top-left
                // x2y2 is bot-right
                var quadsTop = firstPoints.y4;
                var quadsLeft = firstPoints.x4;
                var quadsBot = firstPoints.y2;
                var quadsRight = firstPoints.x2;
                for (var i = 1; i < quads.length; i++) {
                    var points = quads[i].GetPoints();
                    
                    if (points.x4 < quadsLeft) {
                        quadsLeft = points.x4;
                    }
                    if (points.y4 < quadsTop) {
                        quadsTop = points.y4;
                    }
                    if (points.x2 > quadsRight) {
                        quadsRight = points.x2;
                    }
                    if (points.y2 > quadsBot) {
                        quadsBot = points.y2;
                    }
                }

                var viewportTop = exports.pageYOffset;
                var viewportBottom = viewportTop + document.documentElement.clientHeight;
                var viewportLeft = exports.pageXOffset;
                var viewportRight = viewportLeft + document.documentElement.clientWidth;
                
                var wPt1 = this.displayMode.PageToWindow({
                    x: quadsLeft,
                    y: quadsTop
                }, pageIndex);
                var wPt2 = this.displayMode.PageToWindow({
                    x: quadsRight,
                    y: quadsBot
                }, pageIndex);

                var topLeftPt = {
                    x: (wPt1.x < wPt2.x ? wPt1.x: wPt2.x),
                    y: (wPt1.y < wPt2.y ? wPt1.y: wPt2.y)
                };
                var botRightPt = {
                    x: (wPt1.x > wPt2.x ? wPt1.x: wPt2.x),
                    y: (wPt1.y > wPt2.y ? wPt1.y: wPt2.y)
                };

                // Check that all quads are entirely visible.
                if (topLeftPt.x < viewportLeft || topLeftPt.y < viewportTop || botRightPt.x > viewportRight || botRightPt.y > viewportBottom) {
                    // Quad not visible.
                    var pageQuadWidth = botRightPt.x - topLeftPt.x;
                    var pageQuadHeight = botRightPt.y - topLeftPt.y;
                    
                    var cLeft = me.c.tX;
                    var cTop = me.c.tY;
                    
                    var left = cLeft - topLeftPt.x + parseInt(exports.innerWidth / 2, 10) - pageQuadWidth / 2;
                    var top = cTop - topLeftPt.y + parseInt(exports.innerHeight / 2, 10) - pageQuadHeight / 2;

                    var width = me.c.$e.width();
                    var height = me.c.$e.height();
                    
                    var offset = -me.vWOffset;

                    // If pc leaves greyspace.
                    if (top < 0 && top + height <= exports.innerHeight) {
                        // Line up pc with the bottom of the viewport.
                        top = exports.innerHeight - height;
                    }
                    if (top + height > exports.innerHeight && top > 0) {
                        // Line up pc with the top of the viewport.
                        top = 0;
                    }
                    if (left < offset && left + width <= (exports.innerWidth + offset)) {
                        // Line up pc with the right of the viewport.
                        left = offset + exports.innerWidth - width;
                    }
                    if (left + width > offset + exports.innerWidth && left > offset) {
                        // Line up pc with the left of the viewport.
                        left = offset;
                    }
                    
                    me.c.tX = left;
                    me.c.tY = top;
                    
                    me.shouldRerender = true;
                    me.cancelPageRenders();
                    
                    // simulate the touch end event so that the page will be rerendered
                    me.onTouchEnd({
                        originalEvent: {
                            touches: []
                        }
                    });
                }
            }
        },

        onBookmarkSelect:function(evt) {
            var me = this;
            
            var pageData = evt.currentTarget.getAttribute("data-bookmark-page");
            if (pageData !== null) {
                // for now check if the page data is a number otherwise assume it's a link
                // should switch to using DisplayBookmark instead
                var pageNum = parseInt(pageData, 10);
                if (!isNaN(pageNum)) {
                    me.setCurrentPage(pageNum - 1);
                } else {
                    window.open(pageData);
                }
                
            } else {
                //no page number was selected, probably a navigation event
                var bookmarkLevel = evt.currentTarget.getAttribute("data-bookmark-level");
                me.createBookmarkList(bookmarkLevel);
                var $bookmarkList = me.$bookmarkList;
                $bookmarkList.listview("refresh");
            }
        },
        
        onToolMouseDown: function(evt) {
            var me = this;

            // in iOS the menu will be hidden if a note is focused so we need to reshow it
            // if a note is being closed
            if (me.$noteMenu.is(":visible")) {
                me.reshowMenu();
            }

            me.closeEditPopup();

            if (!me.textSelect) {
                return;
            }
            me.mousePt1 = {
                x: evt.pageX,
                y: evt.pageY
            };
            me.mousePt2 = {
                x: evt.pageX,
                y: evt.pageY
            };
  
            clearInterval(me.selectInterval);
            me.docViewer.ClearSelection();
            me.selectInterval = setInterval(_(me.select).bind(me), 50);
            
            // in iOS jquery mobile will hide the header and footer when the keyboard is open
            // if we're in annotation mode then tap toggling is disabled so we need to reshow
            // the bars if we're in text select mode and we have touched the page
            me.reshowMenu();
            
            return false;
        },
        
        onToolMouseUp: function(evt) {
            var me = this;

            me.showAnnotationEditPopup(evt);

            if (!me.textSelect) {
                return;
            }
            me.mousePt2 = {
                x:evt.pageX,
                y:evt.pageY
            };

            // Make sure to grab everything the user wanted to select.
            me.select();
            clearInterval(me.selectInterval);
            
            //select clipboard
            var clipboard = me.$clipboard.get(0);
            clipboard.focus();
            clipboard.selectionStart=0;
            clipboard.setSelectionRange(0, me.$clipboard.get(0).value.length);
        },
        
        onToolMouseMove: function(evt) {
            var me = this;
        
            if (!me.textSelect) {
                return;
            }
        
            me.mousePt2 = {
                x: evt.pageX,
                y: evt.pageY
            };
        },
    
        showNotePopup: function(annotation, showDelete) {
            var me = this;
            
            var editable = me.mayEditAnnotation(annotation);
            
            me.$annotEditButtons.hide();
            
            if (showDelete && editable) {
                me.$noteMenu.find('#noteDeleteButton').show();
            } else {
                me.$noteMenu.find('#noteDeleteButton').hide();
            }
            
            me.$noteMenu.show();
            
            // decrease the size of the popup so it will fit on the screen with the virtual keyboard
            // on some devices if it's too big it will go underneath the keyboard and disappear
            var height = window.innerHeight / 4;
            me.$noteTextarea.css({
                "height": height,
                "max-height": height,
                "resize": "none"
            });
            
            me.$noteTextarea.val(annotation.getContents());
            
            if (editable) {
                me.$noteTextarea.attr('readonly', false);
                me.$noteMenu.find('#noteSaveButton').show();
            } else {
                me.$noteTextarea.attr('readonly', true);
                me.$noteMenu.find('#noteSaveButton').hide();
            }
            
            me.$annotEditPopup.popup('close');
            me.$annotEditPopup.popup('open', {
                x: window.innerWidth / 2,
                y: 0
            });
            
            me.$noteTextarea.focus();
        },
    
        showAnnotationEditPopup: function(evt) {
            var me = this;
            
            var selectedAnnotations = me.annotationManager.GetSelectedAnnotations();
            if (selectedAnnotations.length === 1) {
                var annotation = selectedAnnotations[0];
                if (annotation instanceof Annotations.StickyAnnotation) {
                    me.showNotePopup(annotation, true);
                    return;
                }
                
                if (!me.mayEditAnnotation(annotation)) {
                    me.$annotEditButtons.find('a').hide();
                    me.$annotEditButtons.find('#editDoneButton').show();
                    me.$annotEditButtons.find('#editNoteButton').show();
                    
                } else {
                    // reshow all the buttons
                    me.$annotEditButtons.find('a').show();
                    
                    // hide the buttons that aren't applicable for the selected annotation
                    if (_.isNull(annotation.StrokeColor) || _.isUndefined(annotation.StrokeColor)) {
                        me.$annotEditPopup.find('#editStrokeColorButton').hide();
                    }
                    if (_.isNull(annotation.FillColor) || _.isUndefined(annotation.FillColor)) {
                        me.$annotEditPopup.find('#editFillColorButton').hide();
                    }
                    if (_.isNull(annotation.StrokeThickness) || _.isUndefined(annotation.StrokeThickness)) {
                        me.$annotEditPopup.find('#editThicknessButton').hide();
                    }
                }
                
                me.$annotEditButtons.controlgroup();
                
                me.setEditPopupLocation(annotation);

                // so the event won't close the popup right away
                if (evt) {
                    evt.preventDefault();
                }
            } else if (selectedAnnotations.length > 1) {
                if (!me.mayEditAnnotation(selectedAnnotations[0])) {
                    me.$annotEditButtons.find('a').hide();
                    me.$annotEditButtons.find('#editDoneButton').show();
                } else {
                    me.$annotEditPopup.find('#editNoteButton').hide();
                    me.$annotEditPopup.find('#editStrokeColorButton').hide();
                    me.$annotEditPopup.find('#editFillColorButton').hide();
                    me.$annotEditPopup.find('#editThicknessButton').hide();
                }
                
                me.$annotEditButtons.controlgroup();
                
                me.setEditPopupLocation(selectedAnnotations[0]);
            }
        },
        
        setEditPopupLocation: function(annotation) {
            var me = this;
            
            var annotPageNumber = annotation.GetPageNumber() - 1;
            var verticalOffset = 20;
            
            var pageX = annotation.GetX() + (annotation.GetWidth() / 2);
            var pageY = annotation.GetY() - verticalOffset;

            // convert to window coordinates
            var location = me.displayMode.PageToWindow({
                x: pageX,
                y: pageY
            }, annotPageNumber);
            
            var height = me.$annotEditPopup.height();
            
            // if it's too close to the top
            if (location.y < height * 1.5) {
                var newPageY = annotation.GetY() + annotation.GetHeight() + verticalOffset;
                
                // show it below the annotation
                var newLocation = me.displayMode.PageToWindow({
                    x: 0,
                    y: newPageY
                }, annotPageNumber);
                
                location.y = newLocation.y + (height / 2);
            } else {
                // show it above the annotation
                location.y -= height / 2;
            }
            
            // seems like we need to close before opening because if the popup was already opened the position doesn't seem to change
            me.$annotEditPopup.popup('close');
            me.$annotEditPopup.popup('open', {
                x: location.x,
                y: location.y
            });
        },
        
        closeEditPopup: function() {
            this.$annotEditPopup.popup('close');
            this.$annotEditButtons.show();
            // hide all other menus
            this.$annotEditPopup.find('#colorMenu').hide();
            this.$annotEditPopup.find('#thicknessMenu').hide();
            this.$noteMenu.hide();
        },
        
        deleteSelectedAnnotations: function() {
            var selectedAnnots = this.annotationManager.GetSelectedAnnotations();
            
            for (var i = 0; i < selectedAnnots.length; i++) {
                this.annotationManager.DeleteAnnotation(selectedAnnots[i]);
            }
            
            this.closeEditPopup();
        },
        
        mayEditAnnotation: function(annotation) {
            return this.annotationManager.CanModify(annotation);
        },
    
        createBookmarkList: function(level) {
            var me = this;
            var bookmarks = me.doc.GetBookmarks();
            var $bookmarkList = me.$bookmarkList;
            
            var bookmarkString = '';
            if (bookmarks === null || bookmarks.length < 1) {
                
                bookmarkString = '<li data-i18n="mobile.bookmarks.noBookmarks"></li>';
                $bookmarkList.html(bookmarkString);
                $bookmarkList.i18n();
                return;
            }
            
            if (_.isUndefined(level) || level === "") {
                //Top level
                level = "";
            } else {
                //not top level
                var lvlArray = level.split(",");
                
                for (var i = 0; i < lvlArray.length; i++) {
                    var levelIndex = lvlArray[i];
                    bookmarks = bookmarks[levelIndex].children;
                }
                
                lvlArray.pop();
                var levelString = (lvlArray > 1 ? lvlArray.join(',') : lvlArray.toString());
                bookmarkString += '<li data-role="list-divider" data-icon="arrow-u" data-theme="b" style="-webkit-transform: translateZ(0)"><a data-bookmark-level="' + levelString + '" data-i18n="mobile.bookmarks.upOneLevel"></a></li>';
               
                if (lvlArray !== null) {
                    level = level + ",";
                }
            }

            for (var j = 0; j < bookmarks.length; j++) {
                var bm = bookmarks[j];
                var pageData = bm.GetPageNumber() ? bm.GetPageNumber() : bm.GetURL();

                var childCount = bm.children.length;
                var liContent = ('<span>'+ bm.name + '</span>');
                if (childCount > 0) {
                    liContent = '<a href="#viewerPage" data-bookmark-page="' + pageData + '">' + liContent +
                    '</a><a data-shadow="false"  data-bookmark-level="'+ level + j + '"></a>';
                } else {
                    liContent = '<a href="#viewerPage" data-transition="none" data-bookmark-page="' + pageData + '">' + liContent + '</a>';
                }
                
                var newLiString = '<li style="-webkit-transform: translateZ(0)" data-icon="false" class="bookmark-item"  data-pagenumber="' + pageData + '">' + liContent + '</li>';
                bookmarkString += newLiString;
            }

            $bookmarkList.html(bookmarkString);
            $bookmarkList.i18n();
        },

        initBookmarkView: function() {
            var me = this;
            me.createBookmarkList();
        },
        
       // _iframeWorkaround: function() {
           
       //     var isMobileDevice = navigator.userAgent.match(/Android/i)||navigator.userAgent.match(/webOS/i)||navigator.userAgent.match(/iPhone/i)||navigator.userAgent.match(/iPod/i)||navigator.userAgent.match(/iPad/i);
       //     if (window !== window.top && isMobileDevice) {
       //         //workaround for mobile safari iframe bug
       //         window.innerWidth = window.top.innerWidth;
       //         window.innerHeight = window.top.innerHeight;
       //         $('html').height(window.top.innerHeight).css('max-height', window.top.innerHeight);
       //         $('#viewerPage').height(window.top.innerHeight);
       //         $('#wrapper').height(window.top.innerHeight);
       //         $('#viewerWrapper').height(window.top.innerHeight);
       //     }
       // },
       
        fireEvent: function(type, data) {
            $(document).trigger(type, data);
        },
        
        colorRGBtoName: function(r, g, b, a) {
            if (a === 0) {
                return "transparent";
            }

            if (r === 255 && g === 0 && b === 0) {
                return "red";
            } else if (r === 255 && g === 128 && b === 64) {
                return "orange";
            } else if (r === 255 && g === 255 && b === 0) {
                return "yellow";
            } else if (r === 50 && g === 205 && b === 50) {
                return "lightgreen";
            } else if (r === 0 && g === 128 && b === 0) {
                return "green";
            } else if (r === 0 && g === 0 && b === 255) {
                return "blue";
            } else if (r === 0 && g === 0 && b === 0) {
                return "black";
            } else if (r === 255 && g === 255 && b === 255) {
                return "white";
            } else {
                return "";
            }
        },

        colorNameToRGB: function(name) {
            switch(name) {
                case "red":
                    return new Annotations.Color(255, 0, 0);
                case "orange":
                    return new Annotations.Color(255, 128, 64);
                case "yellow":
                    return new Annotations.Color(255, 255, 0);
                case "lightgreen":
                    return new Annotations.Color(50, 205, 50);
                case "green":
                    return new Annotations.Color(0,128, 0);
                case "blue":
                    return new Annotations.Color(0, 0, 255);
                case "black":
                    return new Annotations.Color(0, 0, 0);
                case "white":
                    return new Annotations.Color(255, 255, 255);
                case "transparent":
                    return new Annotations.Color(255, 255, 255, 0);
                default:
                    return null;
            }
        },
        
        // Example of how to define a decryption function
        // Pass the function as the third parameter to the part retriever
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
                responseString += String.fromCharCode.apply(null, arr.slice(0, k));
            }
            return responseString;
        }*/
    
        // Example of how to use the built in decryption function for AES
        // Pass the function as the third parameter to the part retriever and pass an options object as the fourth parameter
        // e.g. var decrypt = window.CoreControls.Encryption.Decrypt;
        // new window.CoreControls.PartRetrievers.HttpPartRetriever(doc, true, decrypt, {p: "password", type: "aes"});
    
        // JavaScript wrapper (WebViewer.js) function definitions
        loadDocument: function(doc, streaming, decrypt, decryptOptions) {
            var queryParams = window.ControlUtils.getQueryStringMap(!exports.utils.ieWebView);
            var path = queryParams.getString('p');

            window.readerControl.startOffline = queryParams.getBoolean('startOffline', false);
            var partRetriever;
            try {
                var cacheHinting = exports.CoreControls.PartRetrievers.CacheHinting;
                
                if (window.readerControl.startOffline) {
                    partRetriever = new exports.CoreControls.PartRetrievers.WebDBPartRetriever();
                } else if (exports.utils.ieWebView) {
                    partRetriever = new exports.CoreControls.PartRetrievers.WinRTPartRetriever(doc);
                } else if (doc.indexOf("iosrange://") === 0) {
                    partRetriever = new exports.CoreControls.PartRetrievers.IOSPartRetriever(doc);
                } else if (doc.indexOf("content://") === 0 ) {
                    partRetriever = new exports.CoreControls.PartRetrievers.AndroidContentPartRetriever(doc);
                } else if (path !== null) {
                    partRetriever = new exports.CoreControls.PartRetrievers.ExternalHttpPartRetriever(doc, path);
                } else if (streaming === true) {
                    partRetriever = new exports.CoreControls.PartRetrievers.StreamingPartRetriever(doc, cacheHinting.CACHE, decrypt, decryptOptions);
                } else {
                    partRetriever = new exports.CoreControls.PartRetrievers.HttpPartRetriever(doc, cacheHinting.CACHE, decrypt, decryptOptions);
                }
            } catch(err) {
                alert(err.message);
            }
            this.docViewer.LoadAsync(partRetriever, window.readerControl.doc_id);
        },
        
        getCurrentPageNumber: function() {
            return this.docViewer.GetCurrentPage();
        },
        
        setCurrentPageNumber: function(pageNumber) {
            this.setCurrentPage(pageNumber - 1);
        },
        
        getPageCount: function() {
            return this.docViewer.GetPageCount();
        },

        goToFirstPage: function() {
            this.setCurrentPage(0);
        },
        
        goToLastPage: function() {
            var i = this.docViewer.GetPageCount() - 1;
            if (i <= 0) {
                return;
            }
            this.setCurrentPage(i);
        },
        
        goToNextPage: function() {
            var i = this.docViewer.GetCurrentPage();
            if (i >= this.docViewer.GetPageCount()) {
                return;
            }
            this.setCurrentPage(i);
        },
        
        goToPrevPage: function() {
            var i = this.docViewer.GetCurrentPage() - 2;
            if (i < 0) {
                return;
            }
            this.setCurrentPage(i);
        },
        
        getZoomLevel: function() {
            return this.currentPageZoom;
        },
        
        setZoomLevel: function(zoomLevel, animate) {
            // simulate the end of a pinch zoom action
            this.newScale = zoomLevel / this.currentPageZoom;
            this.shouldRerender = true;
            
            this.onTouchEnd({
                originalEvent: {
                    touches: []
                }
            }, animate);
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
            am.SetIsReadOnly(this.readOnly);
        },
        isReadOnly: function(){
            var am = this.docViewer.GetAnnotationManager();
            return am.GetIsReadOnly();
        }
    };
    
    exports.ReaderControl = ReaderControl;
    
    exports.ReaderControl.prototype = $.extend(new exports.WebViewerInterface(), exports.ReaderControl.prototype);
})(window);

$(function() {
    $(window).on('hashchange', function() {        
        window.location.reload();
    });

    i18n.init(window.ControlUtils.getI18nOptions(), function() {
        if (!window.CanvasRenderingContext2D) {
            alert(i18n.t("mobile.unsupportedBrowser"));
        }
        
        $('body').i18n();
    });
    
    function preloadMenuIcons(annotationsEnabled) {
        var img = new Image();
        // load the jquery mobile icons
        img.src = "external/jquery.mobile/images/icons-18-white.png";
        
        // load our custom icons
        var icons = ['ui-icon-custom-search', 'ui-icon-custom-bookmark'];
        
        if (annotationsEnabled) {
            // preload the annotation icons if annotations are enabled so that the icons show up instantly when switching to the annotation menu
            var annotIcons = ['ui-icon-custom-toggle', 'ui-icon-custom-annot', 'ui-icon-custom-edit', 'ui-icon-custom-sticky', 'ui-icon-custom-highlight',
                'ui-icon-custom-underline', 'ui-icon-custom-strikeout', 'ui-icon-custom-rectangle', 'ui-icon-custom-ellipse', 'ui-icon-custom-line',
                'ui-icon-custom-freehand', 'ui-icon-custom-save', 'ui-icon-custom-text-select', 'color-transparent'];
            icons = icons.concat(annotIcons);
        }
        
        var preloadDiv = $('<div id="preload">');
        $('body').append(preloadDiv);
        var iconDiv;
        for (var i = 0; i < icons.length; i++) {
            iconDiv = $('<div>');
            iconDiv.css('display', 'none');
            iconDiv.addClass(icons[i]);
            preloadDiv.append(iconDiv);
        }
    }
    
    // parse the query string
    var queryParams = window.ControlUtils.getQueryStringMap(!window.utils.ieWebView);
    var configScript = queryParams.getString('config');
    
    function initializeReaderControl() {
        var annotationsEnabled = queryParams.getBoolean('a', false);
        var offlineEnabled = queryParams.getBoolean('offline', false);
        
        preloadMenuIcons(annotationsEnabled);
        
        // Create an instance of ReaderControl on load.
        window.readerControl = new ReaderControl(annotationsEnabled, offlineEnabled);
    
        var doc = queryParams.getString('d');
        if (typeof Android !== "undefined" && typeof Android.getXodContentUri !== "undefined") {
            doc = Android.getXodContentUri();
        }
    
        var doc_id = queryParams.getString('did');
        if (doc_id !== null) {
            window.readerControl.doc_id = doc_id;
        }
    
        var server_url = queryParams.getString('url');
        if (server_url !== null) {
            window.readerControl.server_url = server_url;
        }
    
        var user = queryParams.getString('user');
        if (user !== null) {
            window.readerControl.currUser = user;
        }
    
        var admin = queryParams.getBoolean('admin');
        if (admin !== null) {
            window.readerControl.isAdmin = admin;
        }
    
        var readOnly = queryParams.getBoolean('readonly');
        if (readOnly !== null) {
            window.readerControl.readOnly = readOnly;
        }
    
        var streaming = queryParams.getBoolean('streaming', false);
        
        var auto_load = queryParams.getBoolean('auto_load', true);
        
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
    if (configScript !== null && configScript.length > 0) {
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