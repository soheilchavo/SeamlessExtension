// Content script for YouTube - click on clothing to find it

(function () {
    'use strict';

    let seamlessMode = false;
    let toggle = null;
    let overlay = null;
    let cursor = null;

    // Create the toggle button
    function createToggle() {
        if (toggle) return;

        toggle = document.createElement('div');
        toggle.id = 'seamless-toggle';
        toggle.innerHTML = `
            <div class="seamless-toggle-inner">
                <span class="seamless-label">Seamless</span>
                <div class="seamless-switch">
                    <div class="seamless-switch-knob"></div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.id = 'seamless-styles';
        style.textContent = `
            #seamless-toggle {
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 30px;
                padding: 10px 20px;
                cursor: pointer;
                user-select: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: all 0.3s ease;
                border: 1.5px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            #seamless-toggle:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
                transform: scale(1.02);
                box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
            }
            #seamless-toggle.active {
                background: rgba(102, 126, 234, 0.15);
                border-color: rgba(102, 126, 234, 0.4);
                box-shadow: 0 8px 32px rgba(102, 126, 234, 0.2);
            }
            .seamless-toggle-inner {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .seamless-label {
                color: white;
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .seamless-switch {
                width: 40px;
                height: 22px;
                background: #444;
                border-radius: 11px;
                position: relative;
                transition: background 0.3s ease;
            }
            #seamless-toggle.active .seamless-switch {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .seamless-switch-knob {
                width: 18px;
                height: 18px;
                background: white;
                border-radius: 50%;
                position: absolute;
                top: 2px;
                left: 2px;
                transition: transform 0.3s ease;
            }
            #seamless-toggle.active .seamless-switch-knob {
                transform: translateX(18px);
            }
            #seamless-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9998;
                cursor: crosshair;
                background: transparent;
            }
            #seamless-overlay::before {
                content: 'Click on any clothing to find it';
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(102, 126, 234, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                pointer-events: none;
            }
            .seamless-click-indicator {
                position: absolute;
                width: 60px;
                height: 60px;
                border: 3px solid #667eea;
                border-radius: 50%;
                pointer-events: none;
                animation: seamlessPulse 1s ease-out forwards;
            }
            @keyframes seamlessPulse {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
            }
            .seamless-toast {
                position: fixed;
                bottom: 100px;
                right: 20px;
                z-index: 10000;
                padding: 12px 20px;
                color: white;
                border-radius: 8px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                animation: seamlessSlideIn 0.3s ease;
            }
            @keyframes seamlessSlideIn {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            .seamless-card-container {
                position: absolute;
                z-index: 9999;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
                max-width: 600px;
                padding: 12px;
            }
            .seamless-clothing-card {
                background: white;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                border: 1px solid rgba(102, 126, 234, 0.2);
            }
            .seamless-clothing-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 16px 48px rgba(102, 126, 234, 0.25);
                border-color: #667eea;
            }
            .seamless-card-image {
                width: 100%;
                height: 200px;
                background: linear-gradient(135deg, #f5f5f5 0%, #efefef 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
            }
            .seamless-card-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            .seamless-clothing-card:hover .seamless-card-image img {
                transform: scale(1.05);
            }
            .seamless-no-image {
                font-size: 48px;
                color: #ccc;
            }
            .seamless-card-content {
                padding: 12px 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .seamless-card-title {
                font-size: 12px;
                font-weight: 700;
                color: #222;
                line-height: 1.3;
                margin: 0;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .seamless-buy-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .seamless-buy-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .seamless-buy-btn:active {
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(style);

        toggle.addEventListener('click', toggleSeamlessMode);
        document.body.appendChild(toggle);
        console.log('[Seamless] Toggle added to page');
    }

    // Toggle seamless mode on/off
    function toggleSeamlessMode() {
        seamlessMode = !seamlessMode;
        toggle.classList.toggle('active', seamlessMode);

        if (seamlessMode) {
            enableOverlay();
            showNotification('Seamless Mode ON - Click on any clothing!', 'info');
        } else {
            disableOverlay();
            showNotification('Seamless Mode OFF', 'info');
        }

        console.log('[Seamless] Mode:', seamlessMode ? 'ON' : 'OFF');
    }

    // Find the YouTube video container
    function findVideoContainer() {
        const selectors = [
            '#movie_player',
            '.html5-video-player',
            'ytd-player',
            '#player'
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                return container;
            }
        }
        return null;
    }

    // Find the YouTube video element
    function findVideoElement() {
        const selectors = [
            'video.html5-main-video',
            'video.video-stream',
            '#movie_player video',
            'ytd-player video',
            'video'
        ];

        for (const selector of selectors) {
            const video = document.querySelector(selector);
            if (video && video.readyState >= 2) {
                return video;
            }
        }
        return null;
    }

    // Enable click overlay on video
    function enableOverlay() {
        const container = findVideoContainer();
        if (!container) {
            showNotification('No video found', 'error');
            seamlessMode = false;
            toggle.classList.remove('active');
            return;
        }

        // Make sure container is positioned
        const style = getComputedStyle(container);
        if (style.position === 'static') {
            container.style.position = 'relative';
        }

        overlay = document.createElement('div');
        overlay.id = 'seamless-overlay';
        overlay.addEventListener('click', handleVideoClick);
        container.appendChild(overlay);
    }

    // Disable click overlay
    function disableOverlay() {
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
    }

    // Handle click on video - trigger Find Clothes and open sidepanel
    async function handleVideoClick(e) {
        e.preventDefault();
        e.stopPropagation();

        // Pause the YouTube video
        const video = findVideoElement();
        if (video) {
            video.pause();
            console.log('[Seamless] Video paused');
        }

        // Show click indicator
        const indicator = document.createElement('div');
        indicator.className = 'seamless-click-indicator';
        indicator.style.left = e.offsetX + 'px';
        indicator.style.top = e.offsetY + 'px';
        overlay.appendChild(indicator);
        setTimeout(() => indicator.remove(), 1000);

        showNotification('Finding clothing...', 'info');
        console.log('[Seamless] Click detected, triggering Find Clothes');

        // Open sidepanel with camera auto-start, then trigger search after camera starts
        chrome.runtime.sendMessage({
            type: 'OPEN_SIDEPANEL_WITH_CAMERA_AND_SEARCH',
            data: {
                clickX: e.offsetX,
                clickY: e.offsetY,
                timestamp: Date.now()
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Seamless] Error:', chrome.runtime.lastError);
                showNotification('Error triggering search!', 'error');
            }
        });

    }

    // Display clothing cards overlaid on the video
    function displayClothingCards(results, clickX, clickY) {
        // Remove existing cards
        document.querySelectorAll('.seamless-card-container').forEach(c => c.remove());

        if (!results || results.length === 0) {
            showNotification('No clothing items found', 'warning');
            return;
        }

        const container = document.createElement('div');
        container.className = 'seamless-card-container';

        // Position cards in a grid around the click point
        const startX = Math.max(10, clickX - 100);
        const startY = Math.max(50, clickY - 50);

        container.style.left = startX + 'px';
        container.style.top = startY + 'px';

        results.forEach((product, index) => {
            const card = document.createElement('div');
            card.className = 'seamless-clothing-card';

            // Use product image if available
            const imageUrl = product.image_url || product.imageUrl || '';
            const productName = product.itemName || 'Product';
            const productUrl = product.url || 'https://www.google.com';

            card.innerHTML = `
                <div class="seamless-card-image">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" />` : '<div class="seamless-no-image">📷</div>'}
                </div>
                <div class="seamless-card-content">
                    <div class="seamless-card-title">${productName}</div>
                    <button class="seamless-buy-btn">Buy Now</button>
                </div>
            `;

            // Click handler for Buy Now button
            card.querySelector('.seamless-buy-btn').onclick = (e) => {
                e.stopPropagation();
                window.open(productUrl, '_blank');
            };

            // Also allow clicking the card itself to buy
            card.style.cursor = 'pointer';
            card.onclick = (e) => {
                if (e.target !== card.querySelector('.seamless-buy-btn')) {
                    e.stopPropagation();
                    window.open(productUrl, '_blank');
                }
            };

            container.appendChild(card);
        });

        overlay.appendChild(container);
        console.log('[Seamless] Displayed', results.length, 'clothing cards');
    }

    // Show toast notification
    function showNotification(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.seamless-toast').forEach(t => t.remove());

        const colors = {
            error: '#ff4757',
            warning: '#ffa502',
            success: '#2ed573',
            info: '#667eea'
        };

        const toast = document.createElement('div');
        toast.className = 'seamless-toast';
        toast.style.background = colors[type] || colors.info;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // Initialize
    function init() {
        if (!window.location.hostname.includes('youtube.com')) return;

        // Wait for video player to be ready
        const checkPlayer = setInterval(() => {
            if (findVideoContainer()) {
                clearInterval(checkPlayer);
                createToggle();
            }
        }, 500);

        // Clear interval after 10 seconds if player not found
        setTimeout(() => clearInterval(checkPlayer), 10000);
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Handle YouTube SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // Reset state on navigation
            if (seamlessMode) {
                disableOverlay();
                seamlessMode = false;
                if (toggle) toggle.classList.remove('active');
            }
            setTimeout(init, 1000);
        }
    }).observe(document.body, { subtree: true, childList: true });

})();

// Google Shopping Checkout Functionality
(function() {
    'use strict';

    // Only run on Google Shopping pages
    if (!window.location.hostname.includes('google.com') && !window.location.hostname.includes('shopping.google.com')) {
        return;
    }

    // Skip if it's YouTube (handled by code above)
    if (window.location.hostname.includes('youtube.com')) {
        return;
    }

    // Function to find buying options - target specific <a> elements with merchant links
    function findBuyingOptions() {
        const buyingOptions = [];

        // Target the specific <a> elements that are buying option links
        // These have jsname="wN9W3" and contain merchant info, prices, etc.
        const buyingOptionLinks = Array.from(document.querySelectorAll('a[jsname="wN9W3"]'));

        buyingOptionLinks.forEach(link => {
            // Verify this is a buying option link by checking for characteristic elements
            const hasPrice = link.querySelector('[aria-label*="Current price"], [aria-label*="$"], .Pgbknd');
            const hasMerchant = link.querySelector('.gUf0b, .uWvFpd, .hP4iBf') || 
                               link.querySelector('img[src*="faviconV2"]'); // Merchant favicon
            
            // Also check for "Best price" label which appears on buying options
            const hasBestPriceLabel = link.querySelector('.shi3lc, .Y7glZ, .VYi4ab');

            if (hasPrice || hasMerchant || hasBestPriceLabel) {
                buyingOptions.push({ container: link });
            }
        });

        return buyingOptions;
    }

    // Function to extract product information from the buying option link
    function extractProductInfo(container) {
        const info = {
            title: '',
            price: '',
            image: '',
            merchant: ''
        };

        // Extract price from the link (should be inside)
        const priceEl = container.querySelector('[aria-label*="Current price"], .Pgbknd, [aria-label*="$"]');
        if (priceEl) {
            const priceText = priceEl.getAttribute('aria-label') || priceEl.textContent?.trim();
            if (priceText) {
                // Extract just the price part
                const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
                info.price = priceMatch ? priceMatch[0] : priceText;
            }
        }

        // Extract merchant name
        const merchantEl = container.querySelector('.gUf0b, .uWvFpd, .hP4iBf');
        if (merchantEl) {
            info.merchant = merchantEl.textContent?.trim() || '';
        }

        // Extract product title from within the link or nearby
        const titleEl = container.querySelector('.Rp8BL, .CpcIhb, [class*="product"]');
        if (titleEl) {
            info.title = titleEl.textContent?.trim() || '';
        }

        // Extract product image from parent product card (not from the buying option link itself)
        let parentCard = container;
        for (let i = 0; i < 5 && parentCard; i++) {
            parentCard = parentCard.parentElement;
            const productImg = parentCard?.querySelector('img[src*="googleusercontent"]:not([src*="favicon"])');
            if (productImg && productImg.width > 50) {
                info.image = productImg.src || productImg.getAttribute('src') || '';
                break;
            }
        }

        // If no title found, try looking in parent containers
        if (!info.title) {
            let searchContainer = container.parentElement;
            for (let i = 0; i < 3 && searchContainer; i++) {
                const titleEl = searchContainer.querySelector('h3, h2, [class*="title"]');
                if (titleEl) {
                    info.title = titleEl.textContent?.trim() || '';
                    break;
                }
                searchContainer = searchContainer.parentElement;
            }
        }

        return info;
    }

    // Function to parse price string and extract numeric value
    function parsePrice(priceString) {
        if (!priceString) return 0;
        // Remove $, commas, and extract number
        const match = priceString.match(/[\d,]+\.?\d*/);
        if (match) {
            return parseFloat(match[0].replace(/,/g, ''));
        }
        return 0;
    }

    // Function to format price as currency
    function formatPrice(amount) {
        return '$' + amount.toFixed(2);
    }

    // Function to convert price to smallest unit (6 decimals for USDC)
    function convertPriceToSmallestUnit(priceInDollars) {
        return Math.floor(priceInDollars * 1000000).toString();
    }

    // Function to create checkout UI - with price calculation at top and Accept Smart Contract at bottom
    function createCheckoutUI(productInfo) {
        // Calculate prices
        const subtotal = parsePrice(productInfo.price);
        const shipping = 0; // Could be calculated or estimated
        const tax = subtotal * 0.08; // Example: 8% tax (adjust as needed)
        const total = subtotal + shipping + tax;

        const checkoutContainer = document.createElement('div');
        checkoutContainer.className = 'seamless-checkout-container';
        checkoutContainer.innerHTML = `
            <div class="seamless-checkout-wrapper">
                <h2 class="seamless-checkout-title-main">SEAMLESS SMART CHECKOUT</h2>
                <div class="seamless-price-calculation">
                    <div class="seamless-price-row">
                        <span class="seamless-price-label">Subtotal:</span>
                        <span class="seamless-price-value">${formatPrice(subtotal)}</span>
                    </div>
                    <div class="seamless-price-row">
                        <span class="seamless-price-label">Shipping:</span>
                        <span class="seamless-price-value">${shipping > 0 ? formatPrice(shipping) : 'Free'}</span>
                    </div>
                    <div class="seamless-price-row">
                        <span class="seamless-price-label">Tax:</span>
                        <span class="seamless-price-value">${formatPrice(tax)}</span>
                    </div>
                    <div class="seamless-price-row seamless-price-total">
                        <span class="seamless-price-label">Total:</span>
                        <span class="seamless-price-value">${formatPrice(total)}</span>
                    </div>
                </div>
                <div class="seamless-crypto-payment">
                    <div class="seamless-crypto-label">Pay with:</div>
                    <select class="seamless-crypto-select" id="seamless-crypto-select">
                        <option value="eth" selected>Ξ Ethereum</option>
                        <option value="btc">₿ Bitcoin</option>
                        <option value="usdc">$ USDC</option>
                        <option value="sol">◎ Solana</option>
                    </select>
                </div>
                <div class="seamless-checkout-button-wrapper">
                    <button class="seamless-checkout-btn seamless-primary-btn" id="seamless-checkout-btn">
                        <span class="seamless-info-icon">ℹ</span>
                        <span>Accept Smart Contract</span>
                    </button>
                </div>
            </div>
        `;

        // Add styles - compact version to match buying options section size
        const style = document.createElement('style');
        style.textContent = `
            .seamless-checkout-container {
                padding: 20px 24px;
                background: #ffffff;
                border: 2px solid #e8eaed;
                border-radius: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                min-height: fit-content;
                display: block;
                width: 100%;
                box-sizing: border-box;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
                transform: translateY(-2px);
                margin: 8px 0;
                position: relative;
                z-index: 10;
            }
            /* Ensure the <a> element maintains its display */
            a.seamless-replaced {
                display: block;
                text-decoration: none;
                pointer-events: none;
            }
            /* Re-enable pointer events on interactive elements */
            a.seamless-replaced .seamless-crypto-select,
            a.seamless-replaced .seamless-checkout-btn {
                pointer-events: auto;
            }
            .seamless-checkout-wrapper {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .seamless-checkout-title-main {
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 2px;
                color: #1a1a1a;
                margin: 0 0 8px 0;
                line-height: 1;
                font-style: italic;
                text-align: center;
                padding-bottom: 12px;
                border-bottom: 2px solid #e8eaed;
            }
            .seamless-price-calculation {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 12px 0;
            }
            .seamless-price-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
            }
            .seamless-price-label {
                color: #5f6368;
                font-size: 14px;
            }
            .seamless-price-value {
                color: #1a1a1a;
                font-weight: 500;
                font-size: 14px;
            }
            .seamless-price-total {
                border-top: 2px solid #e8eaed;
                padding-top: 12px;
                margin-top: 8px;
            }
            .seamless-price-total .seamless-price-label {
                font-weight: 600;
                color: #1a1a1a;
                font-size: 16px;
            }
            .seamless-price-total .seamless-price-value {
                font-weight: 700;
                color: #34a853;
                font-size: 20px;
            }
            .seamless-crypto-payment {
                padding: 12px 0;
                border-top: 1px solid #e8eaed;
            }
            .seamless-crypto-label {
                font-size: 13px;
                font-weight: 600;
                color: #5f6368;
                margin-bottom: 10px;
            }
            .seamless-crypto-select {
                width: 100%;
                padding: 12px 40px 12px 16px;
                background: #ffffff;
                color: #1a1a1a;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231a1a1a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 12px center;
                background-size: 16px;
            }
            .seamless-crypto-select:hover {
                border-color: #1a1a1a;
            }
            .seamless-crypto-select:focus {
                outline: none;
                border-color: #1a1a1a;
                box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.1);
            }
            /* Crypto-specific colors */
            .seamless-crypto-select option[value="eth"] {
                background: #627EEA;
                color: white;
            }
            .seamless-crypto-select option[value="btc"] {
                background: #F7931A;
                color: white;
            }
            .seamless-crypto-select option[value="usdc"] {
                background: #2775CA;
                color: white;
            }
            .seamless-crypto-select option[value="sol"] {
                background: #9945FF;
                color: white;
            }
            .seamless-checkout-button-wrapper {
                width: 100%;
            }
            .seamless-checkout-btn {
                width: 100%;
                padding: 14px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .seamless-info-icon {
                font-size: 18px;
                font-weight: 600;
                opacity: 0.9;
            }
            .seamless-primary-btn {
                background: #1a1a1a;
                color: white;
            }
            .seamless-primary-btn:hover {
                background: #000000;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            .seamless-checkout-btn:active {
                transform: translateY(0);
            }
            .seamless-checkout-btn:disabled {
                background: #9aa0a6 !important;
                color: #ffffff;
                cursor: not-allowed;
                opacity: 0.7;
                transform: translateY(0) !important;
                box-shadow: none !important;
            }
            .seamless-checkout-btn:disabled:hover {
                transform: translateY(0) !important;
                box-shadow: none !important;
            }
            /* Ensure the replacement div maintains the same display as the original <a> */
            .seamless-replaced {
                display: inline-block;
                text-decoration: none;
            }
        `;

        if (!document.head.querySelector('style[data-seamless-checkout]')) {
            style.setAttribute('data-seamless-checkout', 'true');
            document.head.appendChild(style);
        }

        // Add event listeners
        const checkoutBtn = checkoutContainer.querySelector('#seamless-checkout-btn');
        const cryptoSelect = checkoutContainer.querySelector('#seamless-crypto-select');
        
        // Update dropdown styling based on selected crypto
        function updateCryptoSelectStyle() {
            const selectedValue = cryptoSelect.value;
            const colors = {
                'eth': '#627EEA',
                'btc': '#F7931A',
                'usdc': '#2775CA',
                'sol': '#9945FF'
            };
            cryptoSelect.style.borderColor = colors[selectedValue] || '#e0e0e0';
        }
        
        // Set initial style (Ethereum is default)
        updateCryptoSelectStyle();
        
        // Update style when selection changes
        cryptoSelect.addEventListener('change', updateCryptoSelectStyle);
        
        // Simple confetti effect function
        function triggerConfetti(element) {
            const colors = ['#34a853', '#ea4335', '#4285f4', '#fbbc04', '#1a1a1a'];
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.style.position = 'fixed';
                confetti.style.left = centerX + 'px';
                confetti.style.top = centerY + 'px';
                confetti.style.width = '8px';
                confetti.style.height = '8px';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.borderRadius = '50%';
                confetti.style.pointerEvents = 'none';
                confetti.style.zIndex = '10000';
                
                const angle = (Math.PI * 2 * i) / 50;
                const velocity = 2 + Math.random() * 3;
                const vx = Math.cos(angle) * velocity;
                const vy = Math.sin(angle) * velocity;
                const gravity = 0.3;
                let x = centerX;
                let y = centerY;
                let vyCurrent = vy;
                
                document.body.appendChild(confetti);
                
                let frame = 0;
                const animate = () => {
                    frame++;
                    x += vx;
                    y += vyCurrent;
                    vyCurrent += gravity;
                    
                    confetti.style.left = x + 'px';
                    confetti.style.top = y + 'px';
                    confetti.style.opacity = 1 - (frame / 60);
                    
                    if (frame < 60 && y < window.innerHeight + 100) {
                        requestAnimationFrame(animate);
                    } else {
                        confetti.remove();
                    }
                };
                
                requestAnimationFrame(animate);
            }
        }
        
        // Flag to prevent retriggering after contract is fulfilled
        let isContractFulfilled = false;
        
        checkoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // If contract is fulfilled, open Etherscan instead
            if (isContractFulfilled) {
                window.open('https://sepolia.etherscan.io/address/0xC71ADfbDEA3a7BB990BB1841bec4Bb3706786009', '_blank');
                return;
            }
            
            // Prevent multiple clicks
            if (checkoutBtn.disabled) return;
            
            // Get selected crypto payment method from dropdown
            const cryptoMethod = cryptoSelect.value;
            
            // Trigger confetti effect
            triggerConfetti(checkoutBtn);
            
            // Update button state - grey out and show "Accepted!"
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = 'Accepted!';
            checkoutBtn.classList.add('seamless-btn-accepted');
            
            try {
                // Convert price and commission to smallest unit (6 decimals for USDC)
                const priceInSmallestUnit = convertPriceToSmallestUnit(total);
                const commission = Math.floor(total * 0.10 * 1000000).toString(); // 10% commission
                
                // Hardcoded wallet addresses
                const consumerWallet = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
                const storeWallet = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
                const influencerWallet = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
                
                const requestBody = {
                    price: priceInSmallestUnit,
                    commission: commission,
                    consumer_wallet: consumerWallet,
                    store_wallet: storeWallet,
                    influencer_wallet: influencerWallet
                };
                
                console.log('Creating escrow deal...', requestBody);
                
                // Step 1: Create escrow deal using XMLHttpRequest
                const createData = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', 'https://seamlesscontract.onrender.com/api/create-escrow', true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    
                    xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const data = JSON.parse(xhr.responseText);
                                console.log('Escrow created:', data);
                                resolve(data);
                            } catch (e) {
                                reject(new Error('Failed to parse response: ' + e.message));
                            }
                        } else {
                            reject(new Error(`Failed to create escrow: ${xhr.status} - ${xhr.responseText}`));
                        }
                    };
                    
                    xhr.onerror = function() {
                        reject(new Error('Network error creating escrow'));
                    };
                    
                    xhr.send(JSON.stringify(requestBody));
                });
                
                // Extract dealId from response
                let dealId = null;
                if (createData.contract && createData.contract.dealId) {
                    dealId = createData.contract.dealId;
                } else if (createData.dealId) {
                    dealId = createData.dealId;
                }
                
                if (!dealId) {
                    throw new Error('No dealId received from create-escrow response');
                }
                
                console.log('Deal ID:', dealId);
                
                // Step 2: Wait 13 seconds, then fund consumer (call endpoint regardless of blockchain/simulation mode)
                setTimeout(() => {
                    console.log('Funding consumer...');
                    checkoutBtn.innerHTML = 'Contract at 50%'; // Update button immediately
                    
                    const xhrConsumer = new XMLHttpRequest();
                    xhrConsumer.open('POST', 'https://seamlesscontract.onrender.com/api/fund-consumer', true);
                    xhrConsumer.setRequestHeader('Content-Type', 'application/json');
                    
                    xhrConsumer.onload = function() {
                        try {
                            const data = JSON.parse(xhrConsumer.responseText);
                            if (xhrConsumer.status >= 200 && xhrConsumer.status < 300) {
                                console.log('Consumer funded:', data);
                            } else {
                                console.log('Consumer funding response (may be blockchain mode error):', data);
                            }
                        } catch (e) {
                            console.error('Error parsing consumer response:', e);
                        }
                        
                        // Step 3: Wait 13 more seconds, then fund store (call endpoint regardless of mode)
                        setTimeout(() => {
                            console.log('Funding store...');
                            checkoutBtn.innerHTML = 'Contract Fulfilled ->'; // Update button immediately
                            
                            // Mark contract as fulfilled and re-enable button for Etherscan link
                            isContractFulfilled = true;
                            checkoutBtn.disabled = false;
                            checkoutBtn.style.cursor = 'pointer';
                            
                            const xhrStore = new XMLHttpRequest();
                            xhrStore.open('POST', 'https://seamlesscontract.onrender.com/api/fund-store', true);
                            xhrStore.setRequestHeader('Content-Type', 'application/json');
                            
                            xhrStore.onload = function() {
                                try {
                                    const data = JSON.parse(xhrStore.responseText);
                                    if (xhrStore.status >= 200 && xhrStore.status < 300) {
                                        console.log('Store funded:', data);
                                    } else {
                                        console.log('Store funding response (may be blockchain mode error):', data);
                                    }
                                } catch (e) {
                                    console.error('Error parsing store response:', e);
                                }
                            };
                            
                            xhrStore.onerror = function() {
                                console.error('Network error funding store');
                            };
                            
                            xhrStore.send(JSON.stringify({
                                dealId: dealId,
                                store_wallet: storeWallet
                            }));
                        }, 13000);
                    };
                    
                    xhrConsumer.onerror = function() {
                        console.error('Network error funding consumer');
                    };
                    
                    xhrConsumer.send(JSON.stringify({
                        dealId: dealId,
                        consumer_wallet: consumerWallet
                    }));
                }, 13000);
                
            } catch (error) {
                console.error('Error creating escrow:', error);
                // Keep button as "Accepted!" on error
            }
        });

        return checkoutContainer;
    }

    // Function to detect and remove duplicate buying option sections
    function removeDuplicateBuyingOptions(replacedElement) {
        if (!replacedElement || !replacedElement.parentElement) return;

        // Look for sibling elements that might be duplicate buying option sections
        const parent = replacedElement.parentElement;
        const siblings = Array.from(parent.children);
        const replacedIndex = siblings.indexOf(replacedElement);

        // Check siblings after the replaced element
        for (let i = replacedIndex + 1; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (!sibling || sibling.classList.contains('seamless-replaced')) continue;

            const text = sibling.textContent?.toLowerCase() || '';
            
            // Check for patterns that indicate duplicate buying option sections
            const hasDuplicatePatterns = 
                (text.includes('base price') || text.includes('was') || text.includes('delivery fee')) &&
                (text.includes('visit site') || text.includes('view details') || text.includes('total')) &&
                sibling.querySelector('[class*="price"], [aria-label*="$"]');

            // Also check for specific class patterns that indicate duplicate sections
            const hasDuplicateClasses = 
                sibling.classList.contains('mVhlhf') ||
                sibling.querySelector('.VhS4Dc, .DY4Ebb, .uItbPc') ||
                sibling.querySelector('.SYULCe, .qEITGe') || // "Visit site", "View details" buttons
                sibling.querySelector('.ab3nF, .GACihf'); // Action button containers

            if (hasDuplicatePatterns || hasDuplicateClasses) {
                console.log('Seamless: Removing duplicate buying option section', sibling);
                sibling.remove();
            }
        }
    }

    // Function to remove "typically $xx", "was $xx" type text from the page
    function removeTypicalPriceText() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent?.trim();
            // Match patterns like "typically $xx", "was $xx", "Usually $xx", etc.
            if (text && /^(typically|usually|was|originally)\s+\$?\d+/.test(text.toLowerCase())) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            const parent = textNode.parentElement;
            // Only remove if it's not inside our checkout container
            if (parent && !parent.closest('.seamless-checkout-container')) {
                // Remove the entire element if it's a small text element, or just the text if it's part of a larger element
                if (parent.tagName === 'SPAN' || parent.tagName === 'DIV') {
                    const siblings = Array.from(parent.parentElement.children);
                    if (siblings.length === 1 || parent.textContent.trim() === textNode.textContent.trim()) {
                        parent.remove();
                    } else {
                        textNode.remove();
                    }
                } else {
                    textNode.remove();
                }
            }
        });
    }

    // Function to find the parent container that groups buying options for a single product
    function findProductGroup(element) {
        // Look for a parent container that likely contains all buying options for one product
        // Common patterns: contains "buying options" text, or has class patterns
        let parent = element.parentElement;
        let searchDepth = 0;
        
        while (parent && searchDepth < 6) {
            // Check if this parent contains multiple buying option links
            const buyingOptionsInParent = parent.querySelectorAll('a[jsname="wN9W3"]');
            if (buyingOptionsInParent.length > 1) {
                return parent;
            }
            
            // Also check for "Buying options" text which indicates a grouping
            const text = parent.textContent?.toLowerCase() || '';
            if (text.includes('buying options') || text.includes('buying option')) {
                return parent;
            }
            
            parent = parent.parentElement;
            searchDepth++;
        }
        
        return null;
    }

    // Main function to replace buying options - replace only the first one per product, delete the rest
    function replaceBuyingOptions() {
        const buyingOptions = findBuyingOptions();
        
        // Group buying options by their product container
        const productGroups = new Map();
        
        buyingOptions.forEach(({ container }) => {
            if (container.classList.contains('seamless-replaced') || 
                container.querySelector('.seamless-checkout-container')) {
                return;
            }
            
            const productGroup = findProductGroup(container);
            const groupKey = productGroup ? productGroup.getAttribute('data-ved') || 
                           productGroup.className || 
                           'default' : 'default';
            
            if (!productGroups.has(groupKey)) {
                productGroups.set(groupKey, []);
            }
            productGroups.get(groupKey).push(container);
        });
        
        // For each product group: replace first, delete the rest
        productGroups.forEach((containers, groupKey) => {
            if (containers.length === 0) return;
            
            // Replace the first buying option with checkout UI
            const firstContainer = containers[0];
            const productInfo = extractProductInfo(firstContainer);
            const checkoutUI = createCheckoutUI(productInfo);
            
            if (firstContainer) {
                firstContainer.removeAttribute('href');
                firstContainer.innerHTML = '';
                firstContainer.appendChild(checkoutUI);
                firstContainer.classList.add('seamless-replaced');
            }
            
            // Remove all other buying options in this product group
            for (let i = 1; i < containers.length; i++) {
                const container = containers[i];
                if (container && container.parentElement) {
                    console.log('Seamless: Removing duplicate buying option', container);
                    container.remove();
                }
            }
        });

        if (buyingOptions.length > 0) {
            const processedGroups = productGroups.size;
            console.log(`Seamless: Found ${buyingOptions.length} buying options, replaced 1 per product (${processedGroups} products)`);
        }

        // Remove typical price text
        removeTypicalPriceText();
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceBuyingOptions);
    } else {
        replaceBuyingOptions();
    }

    // Also run after a delay to catch dynamically loaded content
    setTimeout(replaceBuyingOptions, 2000);
    setTimeout(replaceBuyingOptions, 5000);

    // Watch for dynamic content changes (for infinite scroll or lazy loading)
    const observer = new MutationObserver((mutations) => {
        let shouldReplace = false;
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && (node.querySelector?.('[class*="price"], [class*="sh-"]'))) {
                        shouldReplace = true;
                    }
                });
            }
        });
        if (shouldReplace) {
            setTimeout(replaceBuyingOptions, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
