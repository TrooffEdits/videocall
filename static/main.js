let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let statsEl = document.getElementById("stats");

let localStream, peer, micOn = true, camOn = true, camFacing = "user";
let socket = io(), yourName, targetName, lastBytes = 0;

async function start() {
  yourName = document.getElementById("yourName").value.trim();
  targetName = document.getElementById("targetName").value.trim();
  if (!yourName || !targetName) return alert("Enter names first!");

  socket.emit("join", { user: yourName });

  socket.on("ready", async () => {
    await startStream();
    createPeer();
    if (yourName < targetName) {
      peer.addTransceiver("video", { direction: "sendrecv" });
      peer.addTransceiver("audio", { direction: "sendrecv" });
    }
  });

  socket.on("signal", data => peer.signal(data));
}

async function startStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: camFacing, width: 320, height: 240, frameRate: 10 },
    audio: true
  });
  localVideo.srcObject = localStream;
}

function createPeer() {
  peer = new SimplePeer({ initiator: yourName < targetName, stream: localStream, trickle: false });

  peer.on("signal", data => socket.emit("signal", { target: targetName, signal: data }));
  peer.on("stream", stream => {
    console.log("🔗 Connected. Receiving remote stream.");
    remoteVideo.srcObject = stream;
  });
  peer.on("connect", () => console.log("🟢 Peer connected!"));
  setInterval(logBandwidth, 60000);
}

function toggleMic() {
  micOn = !micOn;
  localStream.getAudioTracks().forEach(t => t.enabled = micOn);
}

function toggleCam() {
  camOn = !camOn;
  localStream.getVideoTracks().forEach(t => t.enabled = camOn);
}

async function switchCam() {
  camFacing = camFacing === "user" ? "environment" : "user";
  const newStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: camFacing, width: 320, height: 240, frameRate: 10 },
    audio: true
  });
  const videoTrack = newStream.getVideoTracks()[0];
  const sender = peer.getSenders().find(s => s.track.kind === "video");
  sender.replaceTrack(videoTrack);
  localStream.getTracks().forEach(t => t.stop());
  localStream = newStream;
  localVideo.srcObject = newStream;
}

function logBandwidth() {
  if (!peer || !peer._pc) return;
  peer._pc.getStats(null).then(stats => {
    let bytesNow = 0;
    stats.forEach(r => {
      if (r.type === "outbound-rtp" || r.type === "inbound-rtp") {
        bytesNow += r.bytesSent || 0;
        bytesNow += r.bytesReceived || 0;
      }
    });
    const rate = ((bytesNow - lastBytes) / 60).toFixed(2);
    statsEl.innerText = `Data: ${rate} B/s`;
    lastBytes = bytesNow;
  });
}
