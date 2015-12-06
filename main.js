/*global require, module, document*/
/* eslint strict:0 */
const labsOShare = require('./src/js/share');

const constructAll = function() {
	labsOShare.init();
	document.removeEventListener('o.DOMContentLoaded', constructAll);
};

document.addEventListener('o.DOMContentLoaded', constructAll);

module.exports = labsOShare;
