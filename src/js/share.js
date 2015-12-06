/**global require, module, window, CustomEvent, document, HTMLElement, location */
const DomDelegate = require('ftdomdelegate');
const qs = require('query-string');
const Tooltip = require('./Tooltip');
const memoize = require('lodash.memoize');
const zip = require('lodash.zip');

const socialUrls = {
	twitter: 'https://twitter.com/intent/tweet?url={{url}}&amp;text={{title}}&amp;related={{relatedTwitterAccounts}}&amp;via=FT',
	facebook: 'http://www.facebook.com/sharer.php?u={{url}}&amp;t={{title}}+|+{{titleExtra}}',
	linkedin: 'http://www.linkedin.com/shareArticle?mini=true&amp;url={{url}}&amp;title={{title}}+|+{{titleExtra}}&amp;summary={{summary}}&amp;source=Financial+Times',
	googleplus: 'https://plus.google.com/share?url={{url}}',
	reddit: 'http://reddit.com/submit?url={{url}}&amp;title={{title}}',
	pinterest: 'http://www.pinterest.com/pin/create/button/?url={{url}}&amp;description={{title}}',
	url: '{{url}}',
	email: 'mailto:?subject=See this article on FT.com&body={{title}}%0A{{url}}'
};

const defaultServiceUrl = 'https://sharecode.ft.com';
const defaultShareAmount = 1;
const defaultTarget = location.href.split('?')[0];

const getShareUrl = memoize(function(serviceUrl, maxShares, context, target = defaultTarget) {

	maxShares = maxShares || 1;
	context = context || 0;

	return fetch(serviceUrl + '/generate' +
				'?target=' + encodeURIComponent(target) +
				'&shareEventId=' + (Date.now() / 1000 | 0) +
				'&maxShares=' + maxShares +
				'&context=' + context
			,{credentials: 'include'})
		.then(function(response) {
			return response.text();
		}).then(function(data){
			return JSON.parse(data);
		});
}, function resolver (a, b, c) {
	return a + b + c;
});


let tokenTimeout = undefined;

/**
  * Checks if a passed url has sharecode parameter in it
  *
  * @private
  */

function urlParametersAlreadyHaveShareCode(parameters){

	return parameters.indexOf('share_code') > -1 ? true : false;

}

function removeExisingShareCodeFromURL(){

	const params = qs.parse(window.location.search);
	delete params.share_code;

	return qs.stringify(params);

}

function getRemainingNumberOfTokensForUser(serviceURL){

	return fetch(serviceURL + '/remainingamount',
		{
			credentials: 'include'
		})
		.then(res => res.json())
		.then(function (json) {
			if (json.success) {
				return json.data.tokensAvailable;
			} else {
				return 10;
			}
		})
	;

}
/**
  * @class Share
  *
  * @param {(HTMLElement|string)} [rootEl=document.body] - Element where to search for an labs-o-share component. You can pass an HTMLElement or a selector string
  * @param {Object} config - Optional
  * @param {string} config.url - Optional, url to share
  * @param {string} config.title - Optional, title to be used in social network sharing
  * @param {string} config.titleExtra - Optional, extra bit to add to the title for some social networks
  * @param {string} config.summary - Optional, summary of the page that's being shared
  * @param {string} config.relatedTwitterAccounts - Optional, extra information for sharing on Twitter
  * @param {Object[]} config.links - Optional, array of strings of supported social network names that you want rendered
  */
function Share(rootEl, config) {
	this.openWindows = {};
	this.urlEl = rootEl.querySelector('.labs-o-share__urlbox');
	this.rootEl = rootEl;
	this.init(rootEl, config);
}

/**
	* Initialises the Share class, rendering the o-share element if it's empty with {@link config} options,
	* or from corresponding data attributes and sets up dom-delegates.
	* Dispatches 'oShare.ready' at the end
	*/
Share.prototype.init = function (rootEl, config) {
	if (!rootEl) {
		rootEl = document.body;
	} else if (!(rootEl instanceof HTMLElement)) {
		rootEl = document.querySelector(rootEl);
	}

	const rootDelegate = new DomDelegate(rootEl);
	rootDelegate.on('labsOShare.ready', this.handleReady.bind(this));
	rootDelegate.on('copy', '.labs-o-share__urlbox', this.handleCopied.bind(this));
	rootDelegate.on('click', '.labs-o-share__btncopy', this.handleCopy.bind(this));
	rootDelegate.on('click', '.labs-o-share__action', this.handleSocial.bind(this));
	rootDelegate.on('click', '.labs-o-share__btnemail', this.handleEmail.bind(this));
	rootDelegate.on('change', '.labs-o-share__giftoption', this.handleGiftOptionChange.bind(this));
	rootDelegate.on('change', '.labs-o-share__customgift', this.handleGiftOptionChange.bind(this));

	rootEl.setAttribute('data-labs-o-share--js', '');

	this.rootDomDelegate = rootDelegate;
	this.rootEl = rootEl;

	this.config = Object.assign({
		links: rootEl.hasAttribute('data-labs-o-share-links') ? rootEl.getAttribute('data-labs-o-share-links').split(' ') : [],
		url: rootEl.getAttribute('data-labs-o-share-url') || '',
		title: rootEl.getAttribute('data-labs-o-share-title') || '',
		titleExtra: rootEl.getAttribute('data-labs-o-share-titleExtra') || '',
		summary: rootEl.getAttribute('data-labs-o-share-summary') || '',
		relatedTwitterAccounts: rootEl.getAttribute('data-labs-o-share-relatedTwitterAccounts') || '',
		serviceURL: defaultServiceUrl,
		defaultShareAmount: defaultShareAmount,
		target: defaultTarget
	}, config || {});

	this.dispatchCustomEvent('ready', {
		share: this
	});

}

/**
 * Helper function to dispatch oShare namespaced events
 *
 * @private
 */
Share.prototype.dispatchCustomEvent = function (name, data) {
	this.rootEl.dispatchEvent(new CustomEvent('labsOShare.' + name, {
		detail: data || {},
		bubbles: true
	}));
}

Share.prototype.tooltip = function (text) {
	this.tip = this.tip || new Tooltip(text, this.urlEl);
	this.tip.setText(text);
}

Share.prototype.handleReady = function () {
	const shareAmountFromDom = parseInt(this.rootEl.querySelector(':checked').value, 10);
	const shareAmount = isNaN(shareAmountFromDom) ? this.config.defaultShareAmount : shareAmountFromDom;

	getShareUrl(this.config.serviceURL, shareAmount, 2, this.config.target)
	.then(data => {
		const shortUrl = data.data.shortUrl;
		this.urlEl.value = shortUrl;
	});
}


Share.prototype.handleCloseToolip = function (ev) {
	if (!this.rootEl.querySelector('.labs-o-share__link').contains(ev.target)) {
		this.tip = this.tip ? this.tip.destroy() : undefined;
		document.body.removeEventListener('click', this.handleCloseToolip.bind(this));
		document.body.removeEventListener('keypress', this.handleCloseToolip.bind(this));
	}
}

Share.prototype.handleCopied = function (ev) {
	ev.stopImmediatePropagation();
	this.tooltip('Link copied to clipboard');

	document.body.addEventListener('click', this.handleCloseToolip.bind(this));
	document.body.addEventListener('keypress', this.handleCloseToolip.bind(this));

	return this.dispatchCustomEvent('copy', {
		share: this,
		action: 'url',
		url: ev.target.value
	});
}

Share.prototype.handleCopy = function () {
	this.urlEl.select();

	if (!document.execCommand('copy')) {
		this.tooltip('Copy link to clipboard');
	}
}

/**
	* Fetches the share destination for share actions made from this page (fetch one per )
	*
	* @private
	*/
Share.prototype.handleSocial = function (ev) {
	const actionEl = ev.target.closest('.labs-o-share__action');
	const urlEl = actionEl.querySelector('a[href]');
	if (urlEl) {
		ev.preventDefault();

		if (this.openWindows[urlEl.href] && !this.openWindows[urlEl.href].closed) {
			this.openWindows[urlEl.href].focus();
		} else {
			this.openWindows[urlEl.href] = window.open(urlEl.href, '', 'width=646,height=436');
		}

		this.dispatchCustomEvent('open', {
			share: this,
			action: 'social',
			url: urlEl.href
		});
		ev.target.blur();
	}
}

Share.prototype.handleEmail = function () {
	this.generateSocialUrl('email').then(function(destUrl) {
		window.open(destUrl, 'mailto');
	})
}

Share.prototype.handleGiftOptionChange = function (ev) {
	const cfgEl = this.rootEl.querySelector('.labs-o-share__customgift');
	const customAmountRadio = this.rootEl.querySelector('#labs-o-share-giftoption-cfg');

	if (ev.target === customAmountRadio) {
		ev.preventDefault();

		cfgEl.disabled = false;
		cfgEl.focus();

		if (!cfgEl.value || isNaN(cfgEl.value)) {
			cfgEl.value = 5;
		}

		getShareUrl(this.config.serviceURL, cfgEl.value, 2, this.config.target)
		.then(data => {
			const shortUrl = data.data.shortUrl;
			setTimeout(() => {
				this.urlEl.value = shortUrl;
			}, 0);
		});
	} else if (ev.target === cfgEl) {
		if (!cfgEl.value || isNaN(cfgEl.value)) {
			cfgEl.value = 5;
		}

		getShareUrl(this.config.serviceURL, cfgEl.value, 2, this.config.target)
		.then(data => {
			const shortUrl = data.data.shortUrl;
			setTimeout(() => {
				this.urlEl.value = shortUrl;
			}, 0);
		});
	} else if (ev.target.matches('.labs-o-share__giftoption') && ev.target.checked) {
		cfgEl.disabled = true;
		getShareUrl(this.config.serviceURL, ev.target.value, 2, this.config.target)
		.then(data => {
			const shortUrl = data.data.shortUrl;
			setTimeout(() => {
				this.urlEl.value = shortUrl;
			}, 0);
		});
	}

	getRemainingNumberOfTokensForUser(this.config.serviceURL)
		.then(amount => {
			this.rootEl.querySelectorAll('[data-labs-o-share-credit-count]')[0].textContent = amount;
		})
		.catch(err => {
			console.error('There was an error trying to obtain the remaining number of sharing tokens for the subscriber', err);
		})
	;

	this.render();
}

/**
	* Transforms the default social urls
	*
	* @private
	* @param {string} socialNetwork - Name of the social network that we support (twitter, facebook, linkedin, googleplus, reddit, pinterest, url)
	*/
Share.prototype.generateSocialUrl = function (socialNetwork) {
	return getShareUrl(this.config.serviceURL, this.config.defaultShareAmount, 3, this.config.target)
		.then(data => {
			if (data.success) {
				const templateString = socialUrls[socialNetwork];
				return templateString.replace('{{url}}', data.data.shortUrl)
					.replace('{{title}}', encodeURIComponent(this.config.title))
					.replace('{{titleExtra}}', encodeURIComponent(this.config.titleExtra))
					.replace('{{summary}}', encodeURIComponent(this.config.summary))
					.replace('{{relatedTwitterAccounts}}', encodeURIComponent(this.config.relatedTwitterAccounts));
			}
		});
}


/**
	* Updates the list of share links with the latest share code
	*
	* @private
	*/
Share.prototype.render = function () {
	const giftoption = this.rootEl.querySelector('input.labs-o-share__giftoption:checked').value;
	const descEl = this.rootEl.querySelector('.labs-o-share__giftdesc--'+giftoption);

	const socialNetworks = Object.keys(socialUrls);
	const socialLinkEls = socialNetworks.map(network => this.rootEl.querySelector(`.labs-o-share__action--${network} a`));
	const socialNetworksWithEls = zip(socialNetworks, socialLinkEls);

	socialNetworksWithEls.forEach(([network, element]) => {
		if (element) {
			return this.generateSocialUrl(network).then(destUrl => {
				element.href = destUrl;
			});
		} else {
			return Promise.resolve(1);
		}
	});

	this.generateSocialUrl('url').then(destUrl => {
		this.rootEl.querySelector('.labs-o-share__urlbox').value = destUrl;
	});

	[].slice.call(this.rootEl.querySelectorAll('.labs-o-share__giftdesc')).forEach(function(el) {
		el.style.display = 'none';
	});

	if (descEl) {
		descEl.style.display = 'block';
		this.rootEl.querySelector('.labs-o-share__creditmsg').style.display = 'block';
	} else {
		this.rootEl.querySelector('.labs-o-share__creditmsg').style.display = 'none';
	}

}
/**
  * Destroys the Share instance, disables dom-delegates
  */
Share.prototype.destroy = function() {
	this.rootDomDelegate.destroy();
	this.tip = this.tip ? this.tip.destroy() : undefined;
	// Should destroy remove its children? Maybe setting .innerHTML to '' is faster
	for (let i = 0; i < this.rootEl.children; i++) {
		this.rootEl.removeChild(this.rootEl.children[i]);
	}

	this.rootEl.removeAttribute('data-labs-o-share--js');
	this.rootEl = undefined;
	return undefined;
};

/**
  * Initialises all labs-o-share components inside the element passed as the first parameter
  *
  * @param {(HTMLElement|string)} [el=document.body] - Element where to search for labs-o-share components. You can pass an HTMLElement or a selector string
  * @returns {Array} - An array of Share instances
  */
Share.init = function(el, config) {
	const shareInstances = [];

	if (!el) {
		el = document.body;
	} else if (!(el instanceof HTMLElement)) {
		el = document.querySelector(el);
	}

	const shareElements = el.querySelectorAll('[data-o-component=labs-o-share]');

	for (let i = 0; i < shareElements.length; i++) {
		if (!shareElements[i].hasAttribute('data-o-header--js')) {
			shareInstances.push(new Share(shareElements[i], config));
		}
	}

	return shareInstances;
};

Share.addShareCodeToUrl = function (serviceURL = defaultServiceUrl, shareAmount = defaultShareAmount) {
	if (urlParametersAlreadyHaveShareCode(window.location.search)) {
		const otherParameters = removeExisingShareCodeFromURL();
		let newURL = window.location.href.split('?')[0];

		if (otherParameters !== ''){
			newURL += '?' + otherParameters;
		}

		window.history.pushState({}, undefined, newURL);

	}

	if (tokenTimeout === undefined) {
		tokenTimeout = setTimeout(function () {
			getShareUrl(serviceURL, shareAmount, 1, this.config.target)
			.then(function (data) {
				if (data.success) {
					const code = data.data.shareCode;

					const join = (window.location.href.indexOf("?") > -1) ? "&" : "?";

					window.history.pushState({}, undefined, window.location.href + join + "share_code=" + code);
				}
			});
		}, 5000);

	}

}

module.exports = Share;
