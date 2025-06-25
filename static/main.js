const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const statsEl = document.getElementById("stats");
const socket = io();

let localStream, peer, micOn = true, camOn = true, camFacing = "user";
let yourName, targetName, lastBytes = 0;

document.querySelector("button[onclick='start()']").onclick = async () => {
  yourName = document.getElementById("yourName").value.trim();
  targetName = document.getElementById("targetName").value.trim();
  if (!yourName || !targetName) return alert("Enter both names!");

  await startStream(); // capture cam early
  socket.emit("join", { user: yourName });

  socket.on("ready", () => {
    createPeer();
    if (yourName < targetName) {
      peer.signalOffer = true;
    }
  });

  socket.on("signal", data => {
    if (peer.destroyed) return console.warn("Peer destroyed, ignoring signal");
    peer.signal(data);
  });
};

async function startStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: camFacing, width: 320, height: 240, frameRate: 10 },
    audio: true
  });
  localVideo.srcObject = localStream;
}

function createPeer() {
  if (peer) peer.destroy();
  peer = new SimplePeer({ initiator: yourName < targetName, stream: localStream, trickle: false });

  peer.on("signal", data => {
    if (!peer.destroyed) socket.emit("signal", { target: targetName, signal: data });
  });

  peer.on("stream", stream => {
    console.log("🔗 Remote stream received");
    remoteVideo.srcObject = stream;
  });

  peer.on("connect", () => {
    console.log("✅ Peer connected");
    setInterval(logBandwidth, 60000);
  });

  peer.on("close", () => console.log("Peer closed"));
  peer.on("error", err => console.error("Peer error:", err));
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
  await startStream();
  if (peer) {
    peer.destroy();
    createPeer();
  }
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
