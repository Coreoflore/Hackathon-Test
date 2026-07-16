async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'The server could not complete that request.');
  }
  return payload;
}

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append('resume', file);
  return request('/upload-resume', { method: 'POST', body: formData });
}

export function createSession({ resumeText, repoUrl, targetRole }) {
  return request('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, repoUrl, targetRole })
  });
}

export function saveAnswer(sessionId, questionId, answerText) {
  return request(`/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId, answerText })
  });
}

export function requestReport(sessionId) {
  return request(`/sessions/${sessionId}/report`, { method: 'POST' });
}
