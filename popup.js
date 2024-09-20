document.addEventListener('DOMContentLoaded', function() {
  const hostPartyButton = document.getElementById('hostParty');
  const joinPartyInput = document.getElementById('joinPartyInput');
  const joinPartyButton = document.getElementById('joinPartyButton');

  hostPartyButton.addEventListener('click', function() {
    const roomId = Math.random().toString(36).substring(2, 15);
    chrome.runtime.sendMessage({ action: 'createRoom', roomId: roomId }, (response) => {
      if (response && response.success) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'hostParty', 
            roomId: roomId, 
            partyLink: roomId // Just send the roomId as the party link
          });
        });
        window.close();
      } else {
        alert('Failed to create room. Error: ' + (response ? response.error : 'Unknown error'));
      }
    });
  });

  joinPartyButton.addEventListener('click', function() {
    const roomId = joinPartyInput.value.trim();
    if (roomId) {
      chrome.runtime.sendMessage({ action: 'joinRoom', roomId: roomId }, (response) => {
        if (response && response.success) {
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'joinRoom', 
              roomId: roomId
            });
          });
          window.close();
        } else {
          alert('Failed to join room. Error: ' + (response ? response.error : 'Unknown error'));
        }
      });
    } else {
      alert('Please enter a valid room ID.');
    }
  });
});