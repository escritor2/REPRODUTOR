// js/auth.js
import { SK, loadUser, state } from './state.js';
import { renderUserNav, fillProfile, toast } from './ui.js';
import { supabase } from './supabase.js';

export function openAuthModal(view = 'login') {
    document.getElementById('auth-modal').classList.remove('hidden');
    ['auth-login', 'auth-register', 'auth-profile'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('auth-' + view).classList.remove('hidden');
    if (view === 'profile') fillProfile();
}

export function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
}

export function switchAuth(v) {
    openAuthModal(v);
}

export function toggleVis(id) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
}

export async function doLogin() {
    const email = document.getElementById('l-email').value.trim();
    const pass = document.getElementById('l-pass').value;
    let ok = true;

    const emailOk = /\S+@\S+\.\S+/.test(email);
    document.getElementById('l-email-err').classList.toggle('hidden', emailOk);
    if (!emailOk) ok = false;

    const passOk = pass.length >= 6;
    document.getElementById('l-pass-err').classList.toggle('hidden', passOk);
    if (!passOk) ok = false;

    if (!ok) return;

    const btn = document.getElementById('l-btn');
    btn.textContent = '⏳ Entrando…';
    btn.disabled = true;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pass,
        });

        if (error) throw error;

        const user = formatUser(data.user);

        if (document.getElementById('l-remember').checked) {
            localStorage.setItem(SK.USER, JSON.stringify(user));
        } else {
            sessionStorage.setItem(SK.USER, JSON.stringify(user));
        }

        applyUser(user, true);
        closeAuthModal();

    } catch (err) {
        toast('❌ Erro de autenticação: ' + err.message, 'error');
    } finally {
        btn.textContent = 'Entrar';
        btn.disabled = false;
    }
}

export async function doRegister() {
    const name = document.getElementById('r-name').value.trim();
    const email = document.getElementById('r-email').value.trim();
    const pass = document.getElementById('r-pass').value;
    let ok = true;

    document.getElementById('r-name-err').classList.toggle('hidden', name.length > 0);
    if (!name) ok = false;

    const emailOk = /\S+@\S+\.\S+/.test(email);
    document.getElementById('r-email-err').classList.toggle('hidden', emailOk);
    if (!emailOk) ok = false;

    const passOk = pass.length >= 6;
    document.getElementById('r-pass-err').classList.toggle('hidden', passOk);
    if (!passOk) ok = false;

    if (!ok) return;

    const btn = document.getElementById('r-btn');
    btn.textContent = '⏳ Criando…';
    btn.disabled = true;

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: {
                data: {
                    name,
                    plan: 'free'
                }
            }
        });

        if (error) throw error;

        if (data.user) {
            // Tratamento para usuários em potencial (depende das configs do Supabase pra confirmação)
            const user = formatUser(data.user);
            localStorage.setItem(SK.USER, JSON.stringify(user));
            applyUser(user, true);
            closeAuthModal();
        } else {
            toast('Inscrição realizada. Verifique seu e-mail.', 'info');
        }

    } catch (err) {
        toast('❌ Erro no registro: ' + err.message, 'error');
    } finally {
        btn.textContent = 'Criar conta grátis';
        btn.disabled = false;
    }
}

function formatUser(su) {
    return {
        id: su.id,
        name: su.user_metadata?.name || su.email.split('@')[0],
        email: su.email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${su.email}`,
        plan: su.user_metadata?.plan || 'free',
        trialDays: 14
    };
}

export function applyUser(user, showToast = false) {
    if (!user) return;
    renderUserNav(user);
    if (showToast) toast(`👋 Olá, ${user.name.split(' ')[0]}!`, 'success');
}

export async function doLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem(SK.USER);
    sessionStorage.removeItem(SK.USER);
    renderUserNav(null);
    closeAuthModal();
    toast('👋 Saiu da conta', 'info');
}

export function openPremium() {
    document.getElementById('premium-modal').classList.remove('hidden');
}

export function closePremium() {
    document.getElementById('premium-modal').classList.add('hidden');
}

export function selectPlan(plan) {
    document.querySelectorAll('#premium-modal .glass.rounded-xl').forEach(el => el.classList.remove('border-primary-500'));
    if (plan === 'monthly') {
        document.querySelectorAll('#premium-modal .glass.rounded-xl')[0].classList.add('border-primary-500');
    } else {
        document.querySelectorAll('#premium-modal .glass.rounded-xl')[1].classList.add('border-primary-500');
    }
}

export async function activatePremium() {
    const { data: { session } } = await supabase.auth.getSession();
    let u = JSON.parse(localStorage.getItem(SK.USER) || sessionStorage.getItem(SK.USER) || 'null');

    if (!session || !u) {
        closePremium();
        openAuthModal('register');
        return;
    }

    try {
        // Na vida real isso faria uma chamada para a API com Stripe, etc.
        const { data, error } = await supabase.auth.updateUser({
            data: { plan: 'premium', trialDays: 14 }
        });
        if (error) throw error;

        u.plan = 'premium';
        u.trialDays = 14;
        localStorage.setItem(SK.USER, JSON.stringify(u));
        closePremium();
        toast('🎉 Trial Premium ativado por 14 dias!', 'success');

        if (document.getElementById('auth-profile').classList.contains('hidden') === false) {
            fillProfile(); // Update visual if open
        }
    } catch (err) {
        toast('❌ Erro: ' + err.message, 'error');
    }
}

export function initAuth() {
    // Escuta de força de senha
    const rPass = document.getElementById('r-pass');
    if (rPass) {
        rPass.addEventListener('input', e => {
            const score = [/[A-Z]/.test(e.target.value), /[0-9]/.test(e.target.value), e.target.value.length >= 8].filter(Boolean).length;
            const bar = document.getElementById('r-strength');
            bar.className = `h-1 rounded-full mt-1.5 transition-all ${['bg-red-500', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'][score]}`;
            bar.style.width = ['25%', '50%', '75%', '100%'][score];
        });
    }

    // Escuta por mudanças de autenticação global e auto-refresh token
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const user = formatUser(session.user);
            // Save on local so UI methods keep working sync
            localStorage.setItem(SK.USER, JSON.stringify(user));
            applyUser(user, false);
        } else if (event === 'SIGNED_OUT') {
            localStorage.removeItem(SK.USER);
            renderUserNav(null);
        }
    });
}
