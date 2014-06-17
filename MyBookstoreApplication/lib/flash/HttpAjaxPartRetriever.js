/**
 * Part retriever to work with Flash's HttpAjaxPartRetriever.as
 *
 * @param id The id given from the flash swf file that triggered this method
 * @param url The url to load
 * @param decrypt optional decryption function
 * @param decrypt_options object to pass to decrypt method
 */
var HttpAjaxPartRetriever = function(id, url, decrypt, decrypt_options) {
    this._url = url;
    this._id = id;
    this._flash = null;
	this._pending = null;
    this._decrypt = decrypt;
    this._decrypt_options = decrypt_options;
};

HttpAjaxPartRetriever.prototype.requestOffset = function(rid, url, offset, part) {
	if(url === this._url) {
		this.makeRequest(rid, { 'start' : offset }, part);
	}
};

HttpAjaxPartRetriever.prototype.requestRange = function(rid, url, start, end, part) {
	if(url === this._url) {
		this.makeRequest(rid, { 'start' : start, 'stop' : end }, part);
	}
};

HttpAjaxPartRetriever.prototype.makeRequest = function(rid, range, part) {
	var request = this.createRequest(range, false);
	request._xod_rid = rid;
	request._retriever = this;
	if(this._flash === null) {
		this._flash = document.getElementById(this._id);
	}
    if(part) {
        request._part = part;
    }
	request.onreadystatechange = function() 
	{
		if (request.readyState === HttpAjaxPartRetriever.ReadyStatus.DONE) {
			if(request._retriever._pending === null) 
			{
				request._retriever._pending = [];
				var that = request._retriever;
				window.setTimeout( function() 
				{				
					var l = that._pending.length;
					for (var i = 0; i < l; ++i) 
					{
						var data64 = null;
						var error = null;
						var request = that._pending[i];
						if( request.status === HttpAjaxPartRetriever.HttpStatus.OK || 
							request.status === HttpAjaxPartRetriever.HttpStatus.PARTIAL_CONTENT) 
						{
                            var data = that.getRequestData(request);
                            if(request._retriever._decrypt && request._part) {
                                data = request._retriever._decrypt(data, request._retriever._decrypt_options, request._part);
                            }
                            data64 = that.encode64(data);
							data = null;
						}
						else
						{
							error = request.statusText;
						}
						request._retriever = null; // break circular references
						that._flash.onPartReady(request._xod_rid, data64, request.status, error);
					}
					that._pending = null;
				}, 20);
			}
			request._retriever._pending.push(request);
		}
	}
	request.send('');
}

HttpAjaxPartRetriever._keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

HttpAjaxPartRetriever.prototype.encode64 = function(input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
        	HttpAjaxPartRetriever._keyStr.charAt(enc1) + HttpAjaxPartRetriever._keyStr.charAt(enc2) +
        	HttpAjaxPartRetriever._keyStr.charAt(enc3) + HttpAjaxPartRetriever._keyStr.charAt(enc4);
    }
    return output;
};

HttpAjaxPartRetriever.prototype._utf8_encode = function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }

    return utftext;
};

HttpAjaxPartRetriever.prototype.createRangeURL = function(url, range, useCache) {
	var questionString = (url.indexOf('?') === -1 ? '?' : '&');
    if (!useCache) {
        // Add a timestamp into the URL so the browser never caches
        url = url + questionString + '_=' + new Date().getTime();
    } else {
        // Add the Range header bytes into the URL so it can cache each unique range
        url = url + questionString + '_=' + range.start + ',' + (range.stop ? range.stop : '');
    }
	return url;
};

/**
 * Construct a new ByteRangeRequest.
 * @ignore
 * name ByteRangeRequest
 * param {string} url The URL of the file to load. May be relative to the current page.
 * param {{start, stop=}} range The range of bytes to load, inclusive.
 * param {boolean} useCache If true, allows the browser to cache this content.
 */
HttpAjaxPartRetriever.prototype.createRequest = function(range, useCache) 
{
	var url = this.createRangeURL(this._url, range, false);
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    if(range.stop) {
        request.setRequestHeader('Range', 
            ['bytes=', range.start, '-',  range.stop].join(''));
    } else {
        request.setRequestHeader('Range', 'bytes=' + range.start);
    }
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    if(request.overrideMimeType) {
        request.overrideMimeType('text/plain; charset=x-user-defined');
    } else {
        // Is this required for all servers? Only done for IE
        request.setRequestHeader("Accept-Charset", "x-user-defined");
    }
	return request;
};

// convert from IE binary to array (this works on pre IE9)
HttpAjaxPartRetriever.prototype.convertResponseBodyToText = function (binary) 
{
    return IEBinaryToArray_Arr(binary).replace(/[\s\S]/g, function(t){
            var v = t.charCodeAt(0);
            return String.fromCharCode(v&0xff, v>>8);
        }) + IEBinaryToArray_Arrl(binary)
};

HttpAjaxPartRetriever.prototype.getRequestData = function(request, start)
{
	start = start || 0;
	var responseString="", size;
	var data = swfobject.ua.ie ? request.responseBody : request.responseText;
	if(swfobject.ua.ie) 
	{
		var responseArray = this.convertResponseBodyToText(data);
		// the following two loops are so the string doesn't get cut off at the first null byte
		size = responseArray.length;
		var arr = new Array(size);
		for(var j=0; j<size; j++) { 
			arr[j]=responseArray.charCodeAt(j) & 0xFF;
		}
		var chunks=(size/1024)+1;
		for(var i=0; i<chunks; i++) {
			var index = i*1024;
			responseString += String.fromCharCode.apply(null, arr.slice(index, index + 1024));
		}
	} 
	else 
	{
		var arr=new Array(1024);
		var j=start;
		var result = "";
		while(j<data.length) {
		
			for(var k=0; k<1024 && j<data.length; ++k) { 
				arr[k]=data.charCodeAt(j) & 0xFF;
				++j;
			}
			responseString += String.fromCharCode.apply(null, arr.slice(0,k));
		}
	}
	return responseString;
}

HttpAjaxPartRetriever.ReadyStatus = {
        UNSENT: 0,
        OPENED: 1,
        HEADERS_RECEIVED: 2,
        LOADING: 3,
        DONE: 4
    }
	
HttpAjaxPartRetriever.HttpStatus = {
        OK: 200,
        PARTIAL_CONTENT: 206
    }
    
if(/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) {
    var IEBinaryToArray_ByteStr_Script =
    "<script type='text/vbscript'>\r\n"+
    "Function IEBinaryToArray_Arr(Binary)\r\n"+
    "   IEBinaryToArray_Arr = CStr(Binary)\r\n"+
    "End Function\r\n"+
    "Function IEBinaryToArray_Arrl(Binary)\r\n"+
    "   IEBinaryToArray_Arrl = \"\"\r\n"+
    "   lastIndex = LenB(Binary)\r\n"+
    "   if LenB(Binary) mod 2 Then IEBinaryToArray_Arrl = ChrW(AscB(RightB(Binary,1)))\r\n"+
    "End Function\r\n"+
    "</script>\r\n";

    // inject VBScript
    document.write(IEBinaryToArray_ByteStr_Script);
}

//////////////////////////////////////////////////////////////////////////////////////
// Finally, the global/root methods that are accessible by Flash
// Dictionary of HttpAjaxRetrievers (typically you would only ever have one)
// 'fid' matches swfobject.embedSWF attributes.id
var _web_viewer_swfs = {};
// following three methods must be available in the containing HTML page to be visible 
// to flash's ExternalInterface API
function HttpAjaxPartRetrieverRequestRange(fid, rid, url, start, end, part) {
    _web_viewer_swfs[fid][url].requestRange(rid, url, start, end, part);
}
function HttpAjaxPartRetrieverRequestOffset(fid, rid, url, offset, part) {
    _web_viewer_swfs[fid][url].requestOffset(rid, url, offset, part);
}
function createHttpAjaxPartRetriever(fid, url, decrypt, decrypt_options) {
    if(!_web_viewer_swfs.hasOwnProperty(fid)) {
        _web_viewer_swfs[fid] = {};
    }
    var swf = _web_viewer_swfs[fid];
    if(!swf.hasOwnProperty(url)) {
        swf[url] = new HttpAjaxPartRetriever(fid, url, decrypt, decrypt_options);
    }
}
function destroyHttpAjaxPartRetriever(fid, url) {
    if(_web_viewer_swfs.hasOwnProperty(fid)) {
        var swf = _web_viewer_swfs[fid];
        if(swf.hasOwnProperty(url)) {
            delete swf[url]
        }
    }
}
//////////////////////////////////////////////////////////////////////////////////////