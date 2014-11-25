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


function VoidCache() {
}

module.exports = VoidCache;


VoidCache.test = function () {
	return true;
};


VoidCache.prototype.getMetaData = function (pkgRequest, cb) {
	nextTick(cb);
};


VoidCache.prototype.getData = function (pkgRequest, cb) {
	nextTick(cb, [new Error('Data not in void cache')]);
};


VoidCache.prototype.set = function (pkgRequest, metaData, data, cb) {
	nextTick(cb);
};


VoidCache.prototype.del = function (pkgRequest, cb) {
	nextTick(cb);
};
