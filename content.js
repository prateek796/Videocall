let videoCallUI;
let localStream;
let peerConnections = {};
let currentRoom;
let ws;

function createVideoCallUI(partyLink) {
  if (videoCallUI) {
    videoCallUI.remove();
  }

  videoCallUI = document.createElement('div');
  videoCallUI.id = 'video-call-ui';
  videoCallUI.innerHTML = `
    <div id="party-link">Party Link: ${partyLink}</div>
    <div id="video-container">
      <video id="local-video" autoplay muted></video>
      <div id="remote-videos"></div>
    </div>
    <button id="start-video">Start Video</button>
    <button id="stop-video" style="display:none;">Stop Video</button>
    <button id="mute-audio">Mute Audio</button>
  `;
  document.body.appendChild(videoCallUI);

  document.getElementById('start-video').addEventListener('click', startVideo);
  document.getElementById('stop-video').addEventListener('click', stopVideo);
  document.getElementById('mute-audio').addEventListener('click', toggleAudio);
}

async function startVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('local-video').srcObject = localStream;
    document.getElementById('start-video').style.display = 'none';
    document.getElementById('stop-video').style.display = 'inline-block';
    
    // If we're already connected to peers, add the local stream to all existing connections
    Object.values(peerConnections).forEach(pc => {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    });
  } catch (error) {
    console.error('Error starting video:', error);
  }
}

function stopVideo() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    document.getElementById('local-video').srcObject = null;
    document.getElementById('start-video').style.display = 'inline-block';
    document.getElementById('stop-video').style.display = 'none';
  }
}

function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById('mute-audio').textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
  }
}

async function initializeWebRTC(roomId) {
  ws = new WebSocket(`ws://localhost:3000?roomId=${roomId}`);
  currentRoom = roomId;

  ws.onopen = () => {
    console.log('WebSocket connection established');
    ws.send(JSON.stringify({ action: 'join', roomId: roomId }));
  };

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    switch (data.action) {
      case 'offer':
        await handleOffer(data.offer, data.from);
        break;
      case 'answer':
        await handleAnswer(data.answer, data.from);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data.candidate, data.from);
        break;
      case 'user-joined':
        await createPeerConnection(data.userId);
        break;
      case 'user-left':
        removePeerConnection(data.userId);
        break;
    }
  };
}

async function createPeerConnection(userId) {
  const peerConnection = new RTCPeerConnection();
  peerConnections[userId] = peerConnection;

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendToServer({
        action: 'ice-candidate',
        candidate: event.candidate,
        to: userId,
        from: currentRoom
      });
    }
  };

  peerConnection.ontrack = (event) => {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideo.id = `remote-video-${userId}`;
    document.getElementById('remote-videos').appendChild(remoteVideo);
  };

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendToServer({
      action: 'offer',
      offer: offer,
      to: userId,
      from: currentRoom
    });
  } catch (error) {
    console.error('Error creating offer:', error);
  }
}

async function handleOffer(offer, from) {
  const peerConnection = new RTCPeerConnection();
  peerConnections[from] = peerConnection;

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendToServer({
        action: 'ice-candidate',
        candidate: event.candidate,
        to: from,
        from: currentRoom
      });
    }
  };

  peerConnection.ontrack = (event) => {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideo.id = `remote-video-${from}`;
    document.getElementById('remote-videos').appendChild(remoteVideo);
  };

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  sendToServer({
    action: 'answer',
    answer: answer,
    to: from,
    from: currentRoom
  });
}

async function handleAnswer(answer, from) {
  await peerConnections[from].setRemoteDescription(answer);
}

async function handleIceCandidate(candidate, from) {
  await peerConnections[from].addIceCandidate(candidate);
}

function removePeerConnection(userId) {
  if (peerConnections[userId]) {
    peerConnections[userId].close();
    delete peerConnections[userId];
  }
  const remoteVideo = document.getElementById(`remote-video-${userId}`);
  if (remoteVideo) {
    remoteVideo.remove();
  }
}

function sendToServer(message) {
  // Send message to WebSocket server
  ws.send(JSON.stringify(message));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'hostParty') {
    createVideoCallUI(request.roomId);
    initializeWebRTC(request.roomId);
  } else if (request.action === 'joinRoom') {
    createVideoCallUI(request.roomId);
    initializeWebRTC(request.roomId);
  } else if (request.action === 'hostLeft') {
    alert('The host has left the room. The party has ended.');
    if (videoCallUI) {
      videoCallUI.remove();
    }
    if (ws) {
      ws.close();
    }
  }
});