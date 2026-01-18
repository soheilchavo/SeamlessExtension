// Content script for YouTube - click on clothing to find it

(function() {
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
                <span class="seamless-icon">👕</span>
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
                background: rgba(0, 0, 0, 0.85);
                border-radius: 30px;
                padding: 8px 16px;
                cursor: pointer;
                user-select: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }
            #seamless-toggle:hover {
                background: rgba(0, 0, 0, 0.95);
                transform: scale(1.02);
            }
            #seamless-toggle.active {
                border-color: #667eea;
                box-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
            }
            .seamless-toggle-inner {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .seamless-icon {
                font-size: 20px;
            }
            .seamless-label {
                color: white;
                font-size: 14px;
                font-weight: 600;
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

    // Handle click on video - just trigger Find Clothes in sidepanel
    async function handleVideoClick(e) {
        e.preventDefault();
        e.stopPropagation();

        // Show click indicator
        const indicator = document.createElement('div');
        indicator.className = 'seamless-click-indicator';
        indicator.style.left = e.offsetX + 'px';
        indicator.style.top = e.offsetY + 'px';
        overlay.appendChild(indicator);
        setTimeout(() => indicator.remove(), 1000);

        showNotification('Finding clothing...', 'info');
        console.log('[Seamless] Click detected, triggering Find Clothes');

        // Just send a simple trigger message - no frame capture needed
        // The sidepanel will use OBS camera which is already capturing the screen
        chrome.runtime.sendMessage({
            type: 'TRIGGER_FIND_CLOTHES',
            data: {
                clickX: e.offsetX,
                clickY: e.offsetY,
                timestamp: Date.now()
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Seamless] Error:', chrome.runtime.lastError);
                showNotification('Open the Seamless sidepanel first!', 'error');
            } else {
                showNotification('Analyzing clothing... Check sidepanel!', 'success');
            }
        });
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
