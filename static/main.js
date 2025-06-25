<script src="https://unpkg.com/simple-peer/simplepeer.min.js"></script>
<script src="/static/main.js"></script>

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const statsEl = document.getElementById("stats");
const socket = io();
let localStream, peer, micOn = true, camOn = true;
let lastBytes = 0, camFacing = "user";

const user = prompt("Enter your name:");
const target = prompt("Enter other user name:");

socket.emit("join", { user });

socket.on("ready", async () => {
  await startStream();
  makePeer();
  if (user < target) peer.addTransceiver("video", { direction: "sendrecv" }); // initiator
});

socket.on("signal", data => peer.signal(data));

async function startStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: camFacing, width: 320, height: 240, frameRate: 10 },
    audio: true
  });
  localVideo.srcObject = localStream;
}

function makePeer() {
  peer = new SimplePeer({ initiator: user < target, stream: localStream, trickle: false });

  peer.on("signal", data => socket.emit("signal", { target, signal: data }));
  peer.on("stream", stream => remoteVideo.srcObject = stream);
  setInterval(logBandwidth, 60000); // every minute
}

function toggleMic() {
  micOn = !micOn;
  localStream.getAudioTracks()[0].enabled = micOn;
}

function toggleCam() {
  camOn = !camOn;
  localStream.getVideoTracks()[0].enabled = camOn;
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
  localVideo.srcObject = localStream;
}

function logBandwidth() {
  peer._pc.getStats(null).then(stats => {
    let bytesNow = 0;
    stats.forEach(r => {
      if (r.type === "outbound-rtp" && r.kind === "video") bytesNow += r.bytesSent;
      if (r.type === "inbound-rtp" && r.kind === "video") bytesNow += r.bytesReceived;
    });
    const rate = ((bytesNow - lastBytes) / 60).toFixed(2);
    statsEl.innerText = `Data: ${rate} B/s`;
    lastBytes = bytesNow;
  });
}
