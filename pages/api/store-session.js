import { verifyToken } from '../../lib/authToken';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { slug, token } = req.body || {};
  return res.status(200).json({ ok: !!verifyToken(token, slug) });
}
