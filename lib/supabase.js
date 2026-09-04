import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'SUA_URL_DO_NOVO_SUPABASE';
const supabaseAnonKey = 'SUA_ANON_KEY_DO_NOVO_SUPABASE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
