function downloadReport(score, feedback) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("AI Interview Report", 20, 20);

  doc.setFontSize(12);
  doc.text(`Score: ${score}`, 20, 40);

  doc.text("Feedback:", 20, 60);

  feedback.forEach((f, i) => {
    doc.text(`- ${f}`, 20, 70 + (i * 10));
  });

  doc.save("report.pdf");
}