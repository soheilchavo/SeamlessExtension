// Background service worker for Seamless extension
// Opens the side panel when the extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Set side panel options
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Message listener for content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRIGGER_FIND_CLOTHES') {
        chrome.runtime.sendMessage({
            type: 'TRIGGER_FIND_CLOTHES',
            data: message.data
        }).catch(() => {});
        sendResponse({ success: true });
        return true;
    }
    
    if (message.type === 'OPEN_SIDEPANEL_WITH_CAMERA') {
        // Open the sidepanel and flag it to auto-start camera
        chrome.sidePanel.open({ windowId: sender.tab.windowId });
        // Send message to sidepanel to auto-start camera
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'AUTO_START_CAMERA'
            }).catch(() => {});
        }, 500);
        sendResponse({ success: true });
        return true;
    }
    
    if (message.type === 'OPEN_SIDEPANEL_WITH_CAMERA_AND_SEARCH') {
        // Open the sidepanel and flag it to auto-start camera and search
        chrome.sidePanel.open({ windowId: sender.tab.windowId });
        // Send message to sidepanel to auto-start camera and trigger search
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'AUTO_START_CAMERA_AND_SEARCH',
                data: message.data
            }).catch(() => {});
        }, 500);
        sendResponse({ success: true });
        return true;
    }
});
