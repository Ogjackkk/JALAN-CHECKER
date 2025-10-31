export async function uploadPdfToScanner(file, answerKeyArray) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  fd.append('answer_key', JSON.stringify(answerKeyArray)); // or "A,B,C,..." depending on backend
  const res = await fetch('http://localhost:8000/scan_pdf', { method: 'POST', body: fd });
  return res.json();
}