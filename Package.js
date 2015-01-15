var EventEmitter = require('events');
var inherits = require('util').inherits;
var mime = require('./mime.js');
var PackageRequest = require('./PackageRequest.js');


/**
 * Represents a downloaded package of HTML, CSS, JavaScript and any other content type
 *
 * @param {PackageRequest} pkgRequest  The representation of the package request
 * @constructor
 */

function Package(pkgRequest) {
	// this is where a package request becomes a real package

	if (!(pkgRequest instanceof PackageRequest)) {
		throw new TypeError('Package constructor expects a PackageRequest');
	}

	EventEmitter.call(this);

	this.name = pkgRequest.packageName;
	this.language = pkgRequest.language;
	this.screen = pkgRequest.screen;
	this.density = pkgRequest.density;

	// the original strings representing the content
	// they are automatically cleaned up when possible to preserve memory

	this.content = {};

	// the <style> and <div> elements

	this.containers = {};

	// where to inject style and div tags

	this.parentElements = {
		'text/html': document.body,
		'text/css': document.head
	};
}

inherits(Package, EventEmitter);


module.exports = Package;


// ----------------------------
// Static API for instantiation
// ----------------------------

/**
 * Parses a string into its various pieces of content and stores those in the package's "content"
 * object.
 *
 * @param {string} data  The data to parse and store inside the package
 * @returns {Object}     The meta data that was parsed (containing hash and delimiter)
 */

Package.prototype.parse = function (data) {
	// parse out meta data, which should at least contain a part-delimiter string

	var metaData = {};
	var i, len;

	var index = data.indexOf('\n\n');
	if (index !== -1) {
		var lines = data.substring(0, index).split('\n');
		data = data.substring(index + 2);

		for (i = 0, len = lines.length; i < len; i++) {
			var line = lines[i].split(':');

			var key = line.shift().trim().toLowerCase();
			var value = line.join(':').trim();

			metaData[key] = value;
		}
	}

	if (typeof metaData.delimiter !== 'string' || !metaData.delimiter.length) {
		throw new Error('No valid part-delimiter found in package data');
	}


	var parts = data.split(metaData.delimiter);

	for (i = 0, len = parts.length; i < len; i++) {
		var part = parts[i];
		var offset = -1;
		var eol;

		do {
			offset += 1;
			eol = part.indexOf('\n', offset);
		} while (offset === eol && eol !== -1);

		if (eol === -1) {
			throw new Error('Could not find content-type in package part.');
		}

		var contentType = mime.parse(part.substring(offset, eol));
		var content = part.substring(eol + 1);

		// store the content

		if (contentType) {
			this.addContent(contentType.type, content);
		}
	}

	return metaData;
};


/**
 * Creates a package from string data and stores it in the cache library if provided.
 *
 * @param {PackageRequest} pkgRequest  The representation of the package request
 * @param {string}         data        The data to parse
 * @param {Object|null}    cache       A storage cache
 * @param {Function}       cb          Callback, called on completion
 */

Package.fromData = function (pkgRequest, data, cache, cb) {
	if (!data) {
		return cb(new Error('Package data is empty'));
	}

	var metaData;
	var pkg = new Package(pkgRequest);

	try {
		metaData = pkg.parse(data);
	} catch (error) {
		return cb(error);
	}

	if (cache) {
		// asynchronous to the callback, there is no need to wait for I/O here

		cache.set(pkgRequest, metaData, data, function (cacheError) {
			if (cacheError) {
				console.warn(cacheError);
			}
		});
	}

	return cb(null, pkg);
};


/**
 * Creates a package by reading it from the provided cache library
 *
 * @param {PackageRequest} pkgRequest  The representation of the package request
 * @param {Object|null}    cache       A storage cache
 * @param {Function}       cb          Callback, called on completion
 */

Package.fromCache = function (pkgRequest, cache, cb) {
	cache.getData(pkgRequest, function (error, data) {
		if (error) {
			return cb(error);
		}

		return Package.fromData(pkgRequest, data, null, cb);
	});
};


/**
 * Creates a package from a downloaded response, which may either indicate a requirement to read
 * from cache, or a requirement to parse and store to cache.
 *
 * @param {PackageRequest} pkgRequest  The representation of the package request
 * @param {string}         data        The data to parse or "usecache" if our cached version is up-to-date
 * @param {Object|null}    cache       A storage cache
 * @param {Function}       cb          Callback, called on completion
 */

Package.fromDownload = function (pkgRequest, data, cache, cb) {
	if (typeof data !== 'string') {
		return cb(new TypeError('Package data must be a string'));
	}

	if (data.substr(0, 8) === 'usecache') {
		Package.fromCache(pkgRequest, cache, cb);
	} else {
		Package.fromData(pkgRequest, data, cache, cb);
	}
};


// -------------------------
// Content-type agnostic API
// -------------------------

/**
 * Adds content of a specific type to the content collection.
 *
 * @param {string} type     The content-type
 * @param {string} content
 */

Package.prototype.addContent = function (type, content) {
	if (!type || typeof type !== 'string') {
		throw new TypeError('You must provide a valid content-type (string)');
	}

	if (!content) {
		return;
	}

	if (typeof content !== 'string') {
		throw new TypeError('Content added to a package must be a string');
	}

	var cnt = this.containers[type];

	if (cnt) {
		if (type === 'text/html') {
			// the container must be empty, we do not want to overwrite instantiated HTML elements

			if (cnt.firstChild) {
				throw new Error('Cannot add content of type "' + type + '" when already created and populated.');
			}

			cnt.innerHTML = content;
		} else if (type === 'text/css') {
			cnt.textContent += '\n' + content;
		} else {
			throw new TypeError('Element of type ' + type + ' has already been instantiated and cannot be augmented.');
		}
	} else {
		if (this.content[type]) {
			this.content[type].push(content);
		} else {
			this.content[type] = [content];
		}
	}
};


/**
 * Extracts downloaded content of a given type, removes it from memory and returns it. Packages may
 * contain multiple pieces of content of one type. Every time this function is called, it returns
 * one piece. This function may thus be repeated until undefined is returned.
 *
 * @param {string} type   The content-type
 * @returns {string}
 */

Package.prototype.claimContent = function (type) {
	if (!type || typeof type !== 'string') {
		throw new TypeError('You must provide a valid content-type (string)');
	}

	var list = this.content[type];

	if (!list || list.length === 0) {
		return;
	}

	return list.shift();
};


/**
 * Extracts all downloaded content of a given type, removing them from memory and returning them,
 * joined together with the given glue.
 *
 * @param {string} type   The content-type
 * @param {string} [glue] The string to join the content with, "\n" by default
 * @returns {string}
 */

Package.prototype.claimAllContent = function (type, glue) {
	if (!type || typeof type !== 'string') {
		throw new TypeError('You must provide a valid content-type (string)');
	}

	if (glue === undefined) {
		glue = '\n';
	}

	var list = this.content[type];
	if (!list || list.length === 0) {
		return;
	}

	var content = list.join(glue);
	delete this.content[type];

	return content;
};


/**
 * Instantly drops all content of a given type
 *
 * @param {string} type
 */

Package.prototype.rejectAllContent = function (type) {
	delete this.content[type];
};


/**
 * Injects content into the given parent element
 *
 * @param {Element} elm     The element to inject
 * @param {Element} parent  The parent element to append to
 * @returns {Element}       The injected element
 */

Package.prototype.injectElement = function (elm, parent) {
	if (!elm) {
		throw new Error('No element to inject');
	}

	if (!parent) {
		throw new Error('No parent element to append to');
	}

	if (parent !== elm.parentNode) {
		parent.appendChild(elm);
	}

	return elm;
};


/**
 * Ejects content from its parent element
 *
 * @param {string} type   The content-type
 * @returns {Element}     The ejected element
 */

Package.prototype.ejectElement = function (type) {
	var elm = this.containers[type];
	if (!elm) {
		throw new Error('There is no container for type "' + type + '" to eject');
	}

	if (elm.parentNode) {
		elm.parentNode.removeChild(elm);
	}

	return elm;
};


/**
 * Ejects the container of the given content type, and forgets about its existence.
 *
 * @param {string} type   The content-type
 * @returns {Element}     The ejected (and forgotten) element
 */

Package.prototype.destroyElement = function (type) {
	var elm = this.ejectElement(type);
	if (!elm) {
		return;
	}

	delete this.containers[type];
	return elm;
};


/**
 * Destroys any remaining content strings and elements.
 */

Package.prototype.destroy = function () {
	var types = Object.keys(this.containers);
	for (var i = 0; i < types.length; i += 1) {
		var type = types[i];

		this.destroyElement(type);
	}

	this.content = {};
};


// -----------------------
// JavaScript specific API
// -----------------------

/**
 * Execute the JavaScript in this package
 */

Package.prototype.runJs = function () {
	var content = this.claimAllContent('text/javascript');

	if (content) {
		/*jshint evil:true */
		new Function(content)();
	}
};


// -----------------
// HTML specific API
// -----------------

/**
 * Static function to instantiate a package's HTML.
 *
 * @param {string} content    The HTML content
 * @param {string} name       The package name
 * @returns {HTMLDivElement}  A <div> element that now contains the given content
 */

Package.createHtml = function (content, name) {
	var cnt = document.createElement('div');
	cnt.className = 'mage-package';
	cnt.className += ' mage-page ';  // deprecated

	if (name) {
		cnt.setAttribute('data-package', name);
		cnt.setAttribute('data-page', name);  // deprecated
	}

	// start hidden

	cnt.style.display = 'none';

	// inject HTML from the package

	if (content) {
		cnt.innerHTML = content;
	}

	return cnt;
};


/**
 * Add HTML content to this package
 *
 * @param {string} content
 */

Package.prototype.addHtml = function (content) {
	this.addContent('text/html', content);
};


/**
 * Creates (if needed) and returns the HTML container for this package.
 *
 * @returns {HTMLDivElement}  The <div> container for this package.
 */

Package.prototype.getHtml = function () {
	var type = 'text/html';
	var cnt = this.containers[type];

	if (!cnt) {
		cnt = Package.createHtml(this.claimAllContent(type), this.name);

		this.containers[type] = cnt;
	}

	return cnt;
};


/**
 * Creates (if needed) and injects the HTML container for this package into a given parent.
 *
 * @param {Element}           The parent to append to.
 * @returns {HTMLDivElement}  The <div> container for this package.
 */

Package.prototype.injectHtml = function (parent) {
	parent = parent || this.parentElements['text/html'];

	return this.injectElement(this.getHtml(), parent);
};


/**
 * Ejects HTML from its parent element
 *
 * @returns {HTMLDivElement}     The ejected element
 */

Package.prototype.ejectHtml = function () {
	return this.ejectElement('text/html');
};


/**
 * Creates (if needed) and injects (if needed) the HTML container for this package into its logical
 * parent, then removes the "display: none" style from the HTML container.
 *
 * @returns {HTMLDivElement}     The visible element
 */

Package.prototype.showHtml = function () {
	var cnt = this.injectHtml();

	cnt.style.display = '';

	this.emit('show', cnt);

	return cnt;
};


/**
 * If there is an HTML container, it sets the "display: none" style to hide it.
 *
 * @returns {HTMLDivElement}     The hidden element
 */

Package.prototype.hideHtml = function () {
	var cnt = this.containers['text/html'];

	if (!cnt) {
		return;
	}

	cnt.style.display = 'none';

	this.emit('hide', cnt);

	return cnt;
};


// ----------------
// CSS specific API
// ----------------

/**
 * Static function to instantiate a package's CSS.
 *
 * @param {string} content  The HTML content
 * @param {string} name     The package name
 * @returns {Element}       A <style> element that contains the given content
 */

Package.createCss = function (content, name) {
	var cnt = document.createElement('style');
	cnt.setAttribute('type', 'text/css');

	if (name) {
		cnt.setAttribute('data-package', name);
		cnt.setAttribute('data-page', name);  // deprecated
	}

	// inject CSS from the package

	if (content) {
		cnt.textContent = content;
	}

	return cnt;
};


/**
 * Add CSS content to this package
 *
 * @param {string} content
 */

Package.prototype.addCss = function (content) {
	this.addContent('text/css', content);
};


/**
 * Creates (if needed) and returns the <style> element for this package.
 *
 * @returns {HTMLStyleElement}  The <style> element for this package.
 */

Package.prototype.getCss = function () {
	var type = 'text/css';
	var cnt = this.containers[type];

	if (!cnt) {
		cnt = Package.createCss(this.claimAllContent('text/css'), this.name);

		this.containers[type] = cnt;
	}

	return cnt;
};


/**
 * Creates (if needed) and injects the <style> element for this package into a given parent.
 *
 * @param {Element}             The parent to append to.
 * @returns {HTMLStyleElement}  The <style> element for this package.
 */

Package.prototype.injectCss = function (parent) {
	parent = parent || this.parentElements['text/css'];

	return this.injectElement(this.getCss(), parent);
};


/**
 * Ejects the <style> element from its parent element
 *
 * @returns {HTMLStyleElement}     The ejected element
 */

Package.prototype.ejectCss = function () {
	return this.ejectElement('text/css');
};


/**
 * Replaces the HTML of the existing package, but only if it hasn't been turned into DOM yet.
 *
 * @param {string} str  The HTML content
 */

Package.prototype.assimilateHtml = function (str) {
	// we only replace HTML if it hasn't been turned into DOM yet

	if (!this.containers['text/html']) {
		this.content['text/html'] = [str];
	}
};


/**
 * Replace the CSS of the existing package, even if already turned into DOM
 *
 * @param {string} str  The CSS content
 */

Package.prototype.assimilateCss = function (str) {

	var prevContainer = this.containers['text/css'];
	if (prevContainer) {
		delete this.containers['text/css'];
	}

	this.content['text/css'] = [str];

	if (prevContainer && prevContainer.parentNode) {
		this.injectCss();
		prevContainer.parentNode.removeChild(prevContainer);
	}
};


/**
 * Unknown content types will be collected for later retrieval
 *
 * @param {string} contentType  The content type (without augmented parameters such as charset etc)
 * @param {Package} pkg         The package containing all the content of the given type
 */

Package.prototype.assimilateOther = function (contentType, pkg) {
	var strings = pkg.content[contentType];

	if (strings && strings.length > 0) {
		this.content[contentType] = this.content[contentType] || [];

		for (var i = 0; i < strings.length; i += 1) {
			this.content[contentType].push(strings[i]);
		}

		pkg.rejectAllContent(contentType);
	}
};


/**
 * Allows a newer version of a package to be assimilated into the current package.
 *
 * If pkg has a different clientConfig, it may provide us with:
 * - HTML (action: replace only if not already turned into DOM)
 * - CSS (action: replace)
 * - JS: (action: ignore)
 * - other content types (action: augment)
 *
 * @param {Package} pkg
 */

Package.prototype.assimilateContent = function (pkg) {
	// known types first

	pkg.rejectAllContent('text/javascript');
	this.assimilateHtml(pkg.claimAllContent('text/html'));
	this.assimilateCss(pkg.claimAllContent('text/css'));

	// remaining (unblessed types)

	var contentTypes = Object.keys(pkg.content);

	for (var i = 0; i < contentTypes.length; i += 1) {
		this.assimilateOther(contentTypes[i], pkg);
	}
};
