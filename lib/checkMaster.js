// Pergunta ao servidor se a senha digitada é a senha mestra.
export async function isMasterPassword(password) {
  if (!password) return false;
  try {
    const r = await fetch('/api/check-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await r.json();
    return !!(data && data.ok);
  } catch (e) {
    return false;
  }
}
