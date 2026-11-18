// USO EXCLUSIVO NO SERVIDOR (pasta pages/api). Nunca importe este arquivo em uma página.
import { createClient } from '@supabase/supabase-js';

// Mesmo projeto Supabase do site. Se houver a chave secreta (service_role) na Vercel, ela é usada.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://chvkpasvoibrhdqjsskt.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodmtwYXN2b2licmhkcWpzc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTA3NTAsImV4cCI6MjEwNDA2Njc1MH0.G2jT-XW-Zeoar9iZXcQTNC8EZuQJTlO0vMVJbSRvX8Y';

export const serverSupabase = createClient(url, key, { auth: { persistSession: false } });
