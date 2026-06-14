let mediaRecorder;
let chunks = [];
let recordingStream;

function getSupportedRecordingType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    ""
  ];

  return types.find((type) => !type || MediaRecorder.isTypeSupported(type)) || "";
}

function showRecordingPopup(message) {
  if (typeof window.showTipPopup === "function") {
    window.showTipPopup(message);
    return;
  }

  alert(message);
}

async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showRecordingPopup("Recording is not supported in this browser.");
    return;
  }

  chunks = [];
  recordingStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  const mimeType = getSupportedRecordingType();
  mediaRecorder = mimeType
    ? new MediaRecorder(recordingStream, { mimeType })
    : new MediaRecorder(recordingStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  mediaRecorder.onstart = () => {
    showRecordingPopup("Recording has been started.");
  };

  mediaRecorder.onstop = () => {
    if (!chunks.length) {
      showRecordingPopup("No recording data was captured.");
      return;
    }

    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview-recording.webm";
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (recordingStream) {
      recordingStream.getTracks().forEach((track) => track.stop());
    }

    showRecordingPopup("Recording saved successfully.");
  };

  mediaRecorder.onerror = () => {
    showRecordingPopup("Recording failed. Please try again.");
  };

  mediaRecorder.start();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}
