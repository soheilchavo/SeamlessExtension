// Background service worker for Seamless extension
// Opens the side panel when the extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Set side panel options
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Store the latest captured frame to be retrieved by sidepanel
let latestFrame = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);

    if (message.type === 'TRIGGER_FIND_CLOTHES') {
        console.log('[Background] Trigger Find Clothes from YouTube click');

        // Forward to sidepanel to click Find Clothes button
        chrome.runtime.sendMessage({
            type: 'TRIGGER_FIND_CLOTHES',
            data: message.data
        }).then(() => {
            console.log('[Background] Trigger forwarded to sidepanel');
        }).catch((error) => {
            console.log('[Background] Sidepanel not ready');
        });

        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'FRAME_CAPTURED') {
        // Store the frame
        latestFrame = message.data;
        console.log('[Background] Frame stored, size:', message.data.width, 'x', message.data.height);

        // Try to send to sidepanel
        chrome.runtime.sendMessage({
            type: 'ANALYZE_FRAME',
            data: message.data
        }).then(() => {
            console.log('[Background] Frame forwarded to sidepanel');
        }).catch((error) => {
            console.log('[Background] Sidepanel not ready, frame stored for later');
        });

        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'GET_LATEST_FRAME') {
        sendResponse({ frame: latestFrame });
        return true;
    }

    if (message.type === 'CLEAR_FRAME') {
        latestFrame = null;
        sendResponse({ success: true });
        return true;
    }
});
