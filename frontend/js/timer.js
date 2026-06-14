let totalTime = 30 * 60; // 30 minutes in seconds
let interval;

function startTimer() {
  const display = document.getElementById("timer");

  interval = setInterval(() => {
    const mins = Math.floor(totalTime / 60);
    const secs = totalTime % 60;

    display.innerText = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

    if (totalTime <= 0) {
      clearInterval(interval);
      endInterview();
    }

    totalTime--;
  }, 1000);
}

function endInterview() {
  alert("⏰ Interview Completed!");

  const score = localStorage.getItem("lastScore") || 0;
  const feedback = JSON.parse(localStorage.getItem("lastFeedback")) || [];

  // call your report generator
  downloadReport(score, feedback);

  window.location = "dashboard.html";
}