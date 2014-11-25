var mime = require('./mime.js');


function toBase64(str) {
	return window.btoa(str);
}

function createXhr(cors) {
	if (!window.XMLHttpRequest) {
		throw new Error('This browser does not support XMLHttpRequest');
	}

	var xhr = new window.XMLHttpRequest();

	if (!cors) {
		return xhr;
	}

	if ('withCredentials' in xhr) {
		// XHR is CORS compatible (not supported by IE)

		return xhr;
	}

	if (window.XDomainRequest) {
		// XDomainRequest for IE.

		return new window.XDomainRequest();
	}

	throw new Error('This browser is not compatible with cross domain origin requests');
}


function send(xhr, url, options, cb) {
	var cors = options.cors;
	var timeout = options.timeout;
	var timer;
	var aborting = false;

	function onLoad() {
		if (aborting || !cb) {
			return;
		}

		if (timer) {
			clearTimeout(timer);
			timer = null;
		}

		var code = xhr.status;

		if (!code && code !== 0) {
			code = 200; // default to 200 since there is no status property on XDomainRequest
		}

		var contentType = mime.parse(xhr.contentType || xhr.getResponseHeader('content-type'));

		var response = {
			code: code,
			data: xhr.responseText,
			contentType: contentType.type,
			charset: contentType.charset
		};

		// HTTP status codes:
		// 0 is a network issue
		// 100-199 is informational, we should not get these
		// 200-299 is success
		// 300-399 is redirection which XHR handles before returning
		// 400-499 is client/request error which we must deal with
		// 500-599 is server error which we must deal with

		if (code === 0) {
			// network error

			return cb(new Error('Network issue'), response);
		}

		if (code >= 400 && code <= 499) {
			// client/request error

			return cb(new Error('Request failed'), response);
		}

		if (code >= 500 && code <= 599) {
			// server error

			if (code === 503) {
				return cb(new Error('Server in maintenance'), response);
			}

			return cb(new Error('Server error'), response);
		}

		// success
		return cb(null, response);
	}

	function onTimeout() {
		timer = null;

		aborting = true;
		xhr.abort();

		if (cb) {
			cb(new Error('Request timed out'));
			cb = null;
		}
	}


	// PhantomJS cannot be trusted with onload, so we try onreadystatechange first

	if ('onreadystatechange' in xhr) {
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				onLoad();
			}
		};
	} else if ('onload' in xhr) {
		xhr.onload = onLoad;
	} else {
		return cb(new Error('XHR object exposes no load-event or readystatechange-event'));
	}

	if (timeout) {
		timer = setTimeout(onTimeout, timeout);
	}

	xhr.open('GET', url, true);

	if (cors && cors.credentials && 'withCredentials' in xhr) {
		xhr.withCredentials = true;
	}

	if ('setRequestHeader' in xhr) {
		xhr.setRequestHeader('Cache-Control', 'no-cache');

		// add basic auth if provided

		var m = url.match(/^[a-z]+:(\/\/)([^:]+:[^:]+)@/i);
		if (m) {
			xhr.setRequestHeader('Authorization', 'Basic ' + toBase64(m[2]));
		}
	}

	xhr.send(null);
}


exports.createRequest = function (url, options) {
	options = options || {};

	var xhr = createXhr(options.cors);

	return function (cb) {
		send(xhr, url, options, cb);
	};
};
