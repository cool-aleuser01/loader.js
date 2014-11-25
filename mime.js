// reading:
// http://www.w3.org/Protocols/rfc1341/4_Content-Type.html
// http://www.w3.org/International/O-HTTP-charset

exports.parse = function (str) {
	var result = {
		type: undefined,
		parameter: undefined,
		charset: undefined
	};

	if (typeof str !== 'string') {
		return result;
	}

	str = str.trim().split(/\s*;\s*/);

	var type = str[0];
	var parameter = str[1];

	if (type) {
		result.type = type;

		if (type === 'application/json') {
			// utf-8 is the default encoding for JSON
			// see: http://www.ietf.org/rfc/rfc4627.txt

			result.charset = 'utf-8';
		}

		if (parameter) {
			result.parameter = parameter;

			var m = parameter.match(/^charset=(.+?)$/);
			if (m) {
				result.charset = m[1];
			}
		}
	}

	return result;
};
