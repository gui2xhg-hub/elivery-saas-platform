import { createClient } from '@supabase/supabase-js';

// Cole aqui a URL e a Anon Key do seu novo projeto do Supabase
const supabaseUrl = 'https://SEU-PROJETO.supabase.co';
const supabaseAnonKey = 'sua-anon-key-aqui...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
