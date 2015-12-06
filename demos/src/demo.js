/*global require*/
const labsOShare = require('../../main.js');

let shares;

document.body.addEventListener("oOverlay.destroy", function() {
	shares.forEach(function(share) {
		share.destroy();
	});
});

document.body.addEventListener("oOverlay.ready", function() {
	shares = labsOShare.init(document.body, {
		target: 'https://next.ft.com/content/d2b1abb0-9287-11e5-94e6-c5413829caa5'
	});
});
