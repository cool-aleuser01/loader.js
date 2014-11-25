function key(pkgRequest, subKey) {
	return 'mage-pkg/' + pkgRequest.toString() + '/' + subKey;
}


function nextTick(cb, args) {
	if (!cb) {
		return;
	}

	return window.setTimeout(function () {
		if (args) {
			cb.apply(null, args);
		} else {
			cb();
		}
	}, 0);
}


function cleanupOldKeys(storage) {
	var rePagecache = /^pagecache\//;

	var keys = Object.keys(storage);

	for (var i = 0; i < keys.length; i += 1) {
		if (rePagecache.test(keys[i])) {
			storage.removeItem(keys[i]);
		}
	}
}

function LocalStorageCache() {
	if (!window.localStorage) {
		throw new Error('This browser does not have localStorage available');
	}

	this.storage = window.localStorage;

	try {
		cleanupOldKeys(this.storage);
	} catch (e) {
		console.warn('Error cleaning old keys:', e);
	}
}

module.exports = LocalStorageCache;


LocalStorageCache.test = function () {
	var storage = window.localStorage;

	if (storage && storage.setItem && storage.getItem && storage.removeItem) {
		return true;
	}

	return false;
};


LocalStorageCache.prototype.getMetaData = function (pkgRequest, cb) {
	var error, result;

	try {
		result = JSON.parse(this.storage.getItem(key(pkgRequest, 'metadata')));
	} catch (e) {
		error = e;
	}

	if (error || !result) {
		return this.del(pkgRequest, function () {
			nextTick(cb, [error]);
		});
	}

	return nextTick(cb, [null, result]);
};


LocalStorageCache.prototype.getData = function (pkgRequest, cb) {
	var error, result;

	try {
		result = this.storage.getItem(key(pkgRequest, 'data'));
	} catch (e) {
		error = e;
	}

	if (error || !result) {
		return this.del(pkgRequest, function () {
			nextTick(cb, [error]);
		});
	}

	return nextTick(cb, [null, result]);
};


LocalStorageCache.prototype.set = function (pkgRequest, metaData, data, cb) {
	try {
		metaData = JSON.stringify(metaData);
	} catch (serializerError) {
		return nextTick(cb, [serializerError]);
	}

	try {
		this.storage.setItem(key(pkgRequest, 'data'), data);
		this.storage.setItem(key(pkgRequest, 'metadata'), metaData);
	} catch (storageError) {
		return nextTick(cb, [storageError]);
	}

	return nextTick(cb);
};


LocalStorageCache.prototype.del = function (pkgRequest, cb) {
	var error;

	try {
		this.storage.removeItem(key(pkgRequest, 'metadata'));
		this.storage.removeItem(key(pkgRequest, 'data'));
	} catch (e) {
		error = e;
	}

	return nextTick(cb, [error]);
};
