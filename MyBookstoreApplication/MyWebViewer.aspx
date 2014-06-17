<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="MyWebViewer.aspx.cs" Inherits="MyBookstoreApplication.MyWebViewer" %>


<!DOCTYPE html>
<html lang="en">
    <head>
         <base href="http://local.mybookstore.com/lib/" target="_blank">
<title>PDFTronViewer Test</title>
<script type="text/javascript" src="../lib/resources/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="../lib/WebViewer.min.js"></script>
<script type="text/javascript" src="../lib/WebViewer.js"></script>
    </head>

    <body>
        <script type="text/javascript">
            var beforeload = (new Date()).getTime();
            function getPageLoadTime() {
                var afterload = (new Date()).getTime();
                var time = afterload - beforeload;
                alert(time);
            }
            
            $(document).ready(function () {
                                // Read a page's GET URL variables and return them as an associative array.
                function getUrlVars() {
                    var vars = [], hash;
                    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
                    for (var i = 0; i < hashes.length; i++) {
                        hash = hashes[i].split('=');
                        vars.push(hash[0]);
                        vars[hash[0]] = hash[1];
                    }
                    return vars;
                }
                var doc = getUrlVars()["cloudApiId"];
                var user = getUrlVars()["u"];
                var docId = getUrlVars()["id"];
                var readonly = getUrlVars()["enableReadOnlyMode"] == "true" ? true : false;
                var offlineMode = getUrlVars()["enableOfflineMode"] == "true" ? true : false;
                var showTB = getUrlVars()["showToolbarControl"] == "true" ? true : false;
                var sOffline = getUrlVars()["startOffline"] == "true" ? true : false;
                var admin = getUrlVars()["admin"] == "true" ? true : false;
                var annotate = getUrlVars()["annotate"] == "true" ? true : false;
                var viewerElement = document.getElementById('viewer');
                var myWebViewer = new PDFTron.WebViewer({
                    type: "html5",                       //URL path to the WebViewer root folder
                    //initialDoc: doc,  //URL path to the document
                    cloudApiId: doc, 
                    enableAnnotations: annotate,
                    documentId: docId,
                    mobileRedirect: false,
                    streaming: true,      //set streaming to 'true' if your .xod server doesn't acknowledge byte-ranges
                    showToolbarControl: showTB,
                    enableReadOnlyMode: readonly,
                    enableOfflineMode: offlineMode,
                    startOffline: false,
                    annotationAdmin: admin,
                    annotationUser: user
                }, viewerElement);
                $(viewerElement).bind('ready', function (event) {
                    myWebViewer.setToolMode("Pan");
                });
                var tst = HTMLEncode('')
            });

           // window.onload = getPageLoadTime;
           
        </script>

        <div id="headerContainer">       
            <!-- Optional: add custom header content here.
                 Example usage: Application logo/branding, links to other pages in your app (My Account, Login, Sign up), etc.
            -->
            <div >
                <span style = "font-weight:bold; font-size: 28px;" > Mimeo Bookstore </span>
            </div>
        </div>

        <div id="viewer" style="height:900px;"></div>

    <div id="footerContainer">            
        <!-- Optional: add footer content here 
             Example usage: Application logo/branding, a secondary control toolbar (e.g. page navigation), status bar
        -->
        <div style="text-align:center"> &copy; 2014 Mimeo Bookstore </div>
    </div>
</body>
</html>
