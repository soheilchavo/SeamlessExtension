// Background service worker for Seamless extension
// Opens the side panel when the extension icon is clicked

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Set side panel options
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
