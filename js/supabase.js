import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('coloque-sua-url-aqui')) {
    console.warn('⚠️ Supabase URL ou KEY não configurada no arquivo .env corretamente.');
}

// Cria o client isolado, com auto-refresh de sessão se estiver disponível
export const supabase = createClient(
    supabaseUrl || 'https://mock.supabase.co',
    supabaseKey || 'mock-key',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);
