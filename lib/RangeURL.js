function RangeURL () {
	this.test = this.test.bind(this);
}
RangeURL.prototype = [];
RangeURL.prototype.test = function (str) {
	if (!str || typeof str !== 'string') {
		return false;
	}
	for (var i = 0; i < this.length; i++) {
		if (str && str.indexOf(this[i]) === 0) {
			return true;
		}
	}
	return false;
};
module.exports = RangeURL;