let rooms = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createRoom') {
    const roomId = request.roomId;
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        rooms[roomId] = { host: activeTab.id, url: activeTab.url, participants: [] };
        console.log('Room created with ID:', roomId);
        console.log('Current rooms:', rooms);
        sendResponse({ success: true });
      } else {
        console.error('No active tab found');
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true; // Keeps the message channel open for async response
  } else if (request.action === 'joinRoom') {
    const roomId = request.roomId;
    console.log('Attempting to join room:', roomId);
    console.log('Current rooms:', rooms);
    if (rooms[roomId]) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
          const activeTab = tabs[0];
          rooms[roomId].participants.push(activeTab.id);
          chrome.tabs.update(activeTab.id, { url: rooms[roomId].url }, () => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === activeTab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                chrome.tabs.sendMessage(tabId, { action: 'joinRoom', roomId: roomId, partyLink: roomId });
              }
            });
          });
          sendResponse({ success: true });
        } else {
          console.error('No active tab found');
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
    } else {
      console.error('Room not found:', roomId);
      sendResponse({ success: false, error: 'Room not found' });
    }
    return true; // Keeps the message channel open for async response
  }
});

// Handle tab closing
chrome.tabs.onRemoved.addListener((tabId) => {
  for (let roomId in rooms) {
    if (rooms[roomId].host === tabId) {
      // Host left, close the room
      console.log('Host left, closing room:', roomId);
      rooms[roomId].participants.forEach((participantId) => {
        chrome.tabs.sendMessage(participantId, { action: 'hostLeft' });
      });
      delete rooms[roomId];
    } else {
      // Remove participant from the room
      rooms[roomId].participants = rooms[roomId].participants.filter(id => id !== tabId);
    }
  }
  console.log('Current rooms after tab closed:', rooms);
});