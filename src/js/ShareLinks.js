/*global require,module*/
"use strict";

var DomDelegate = require('ftdomdelegate');
var oDom = require('o-dom');
var TextCopyHelper = require('./TextCopyHelper');

function ShareLinks(rootEl) {

	var rootDomDelegate;
	var shareObj = this;
	var openWindows = {};

	function dispatchCustomEvent(name, data) {
		if (document.createEvent && rootEl.dispatchEvent) {
			var event = document.createEvent('Event');
			event.initEvent(name, true, true);

			if (data) {
				event.detail = data;
			}

			rootEl.dispatchEvent(event);
		}
	}

	function handleClick(ev) {
		ev.preventDefault();

		var actionEl = oDom.getClosestMatch(ev.target, 'li');
		var url;

		if (rootEl.contains(actionEl) && actionEl.querySelector('a[href]')) {
			url = actionEl.querySelector('a[href]').href;

			if (actionEl.getAttribute('data-o-share-action') === "url") {
				copyLink(url, actionEl);
			} else {
				shareSocial(url);
			}
		}
	}

	function copyLink(url, parentEl) {
		if (!url || !parentEl || parentEl.hasAttribute("aria-selected")) {
			return;
		}
		parentEl.setAttribute('aria-selected', 'true');

		new TextCopyHelper({
			message: "Copy this link for sharing",
			text: url,
			parentEl: parentEl,
			onCopy: function() {
				dispatchCustomEvent('oTabs.copy', {
					share: shareObj,
					action: "url",
					url: url
				});
			},
			onClose: function() {
				parentEl.removeAttribute('aria-selected');
			}
		});

		dispatchCustomEvent('oTabs.open', {
			share: shareObj,
			action: "url",
			url: url
		});
	}

	function shareSocial(url) {
		if (url) {
			if (openWindows[url] && !openWindows[url].closed) {
				openWindows[url].focus();
			} else {
				openWindows[url] = window.open(url, url, 'width=646,height=436');
			}

			dispatchCustomEvent('oTabs.open', {
				share: shareObj,
				action: "social",
				url: url
			});
		}
	}

	function init() {
		if (!rootEl) {
			rootEl = document.body;
		} else if (!(rootEl instanceof HTMLElement)) {
			rootEl = document.querySelector(rootEl);
		}

		rootDomDelegate = new DomDelegate(rootEl);
		rootDomDelegate.on('click', handleClick);
		rootEl.setAttribute('data-o-share--js', '');

		dispatchCustomEvent('oShare.ready', {
			share: shareObj
		});
	}

	function destroy() {
		rootEl.removeAttribute('data-o-share--js');
		rootDomDelegate.destroy();
	}

	init();

	this.copyLink = destroy;
	this.shareViaSocialMedia = destroy;
	this.destroy = destroy;
}

ShareLinks.init = function(el) {
	var shareLinks = [];
	var sEls;
	var c;
	var l;

	if (!el) {
		el = document.body;
	} else if (!(el instanceof HTMLElement)) {
		el = document.querySelector(el);
	}

	if (el.querySelectorAll) {
		sEls = el.querySelectorAll('[data-o-component=o-share]:not([data-o-share--js])');

		for (c = 0, l = sEls.length; c < l; c++) {
			shareLinks.push(new ShareLinks(sEls[c]));
		}
	}

	return shareLinks;
};

module.exports = ShareLinks;
