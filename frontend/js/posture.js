const video = document.getElementById("video");
const postureDisplay = document.getElementById("posture");

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
  } catch (err) {
    console.error("Camera error:", err);
  }
}

const pose = new Pose({
  locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(results => {
  if (!results.poseLandmarks) return;

  const nose = results.poseLandmarks[0];
  const shoulder = results.poseLandmarks[11];

  if (nose.y > shoulder.y) {
    postureDisplay.innerText = "Bad Posture ❌";
    postureDisplay.style.color = "red";
  } else {
    postureDisplay.innerText = "Good Posture ✅";
    postureDisplay.style.color = "green";
  }
});

async function detect() {
  if (video.readyState === 4) {
    await pose.send({ image: video });
  }
  requestAnimationFrame(detect);
}

startCamera();
video.onloadeddata = detect;
