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

        // Listen for results from sidepanel
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'CLOTHING_RESULTS') {
                displayClothingCards(message.results, e.offsetX, e.offsetY);
                sendResponse({ received: true });
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
