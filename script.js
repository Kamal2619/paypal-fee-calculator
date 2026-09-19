// ===========================
// PayPal Fee Conversion Calculator
// Dual Mode + Dark/Light Theme
// ===========================

let baseExchangeRate = 83.00;
let rateSource = 'fallback';
let currentMode = 'forward';

// Constants
const PAYPAL_FEE_PERCENT = 0.044;
const PAYPAL_FIXED_FEE = 0.30;
const GST_RATE = 0.18;
const FX_MARKUP = 0.038;
const NET_FACTOR = 1 - (PAYPAL_FEE_PERCENT * (1 + GST_RATE)); // 0.94808
const FIXED_DEDUCTION = PAYPAL_FIXED_FEE * (1 + GST_RATE);     // 0.354

// ===========================
// Theme Toggle
// ===========================
function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('themeIcon');
    const current = html.getAttribute('data-theme');

    if (current === 'dark') {
        html.setAttribute('data-theme', 'light');
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

function loadTheme() {
    const saved = localStorage.getItem('theme');
    const icon = document.getElementById('themeIcon');

    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        icon.className = 'fas fa-sun';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        icon.className = 'fas fa-moon';
    }
}

// ===========================
// Exchange Rate
// ===========================
async function fetchExchangeRate() {
    const statusEl = document.getElementById('rateStatusText');
    const infoEl = document.getElementById('exchangeRateInfo');

    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();

        if (data?.result === 'success' && data.rates?.INR) {
            baseExchangeRate = data.rates.INR;
            rateSource = 'live';
            statusEl.textContent = `Live rate: 1 USD = ₹${baseExchangeRate.toFixed(2)}`;
            infoEl.classList.add('loaded');
            infoEl.classList.remove('error');
        } else {
            throw new Error('Bad response');
        }
    } catch {
        try {
            const res2 = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR');
            const data2 = await res2.json();
            if (data2?.rates?.INR) {
                baseExchangeRate = data2.rates.INR;
                rateSource = 'live';
                statusEl.textContent = `Live rate: 1 USD = ₹${baseExchangeRate.toFixed(2)}`;
                infoEl.classList.add('loaded');
                infoEl.classList.remove('error');
            } else { throw new Error(); }
        } catch {
            rateSource = 'fallback';
            statusEl.textContent = `Fallback rate: 1 USD = ₹${baseExchangeRate.toFixed(2)}`;
            infoEl.classList.add('error');
            infoEl.classList.remove('loaded');
        }
    }
}

// ===========================
// Mode Switch
// ===========================
function switchMode(mode) {
    currentMode = mode;
    const input = document.getElementById('amountInput');

    document.getElementById('resultsSection').classList.remove('visible');
    document.getElementById('reverseResultsSection').classList.remove('visible');
    input.value = '';

    document.getElementById('modeForward').classList.toggle('active', mode === 'forward');
    document.getElementById('modeReverse').classList.toggle('active', mode === 'reverse');

    if (mode === 'forward') {
        document.getElementById('inputLabel').textContent = 'Enter amount (in $):';
        document.getElementById('inputPrefix').textContent = '$';
        input.placeholder = 'e.g. 100';
    } else {
        document.getElementById('inputLabel').textContent = 'Enter desired amount (in ₹):';
        document.getElementById('inputPrefix').textContent = '₹';
        input.placeholder = 'e.g. 8000';
    }

    input.focus();
}

// ===========================
// Calculate
// ===========================
function calculateFee() {
    currentMode === 'forward' ? calcForward() : calcReverse();
}

function calcForward() {
    const input = document.getElementById('amountInput');
    const amt = parseFloat(input.value);
    if (!validate(amt, input)) return;

    const fee = (amt * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE;
    const gst = fee * GST_RATE;
    const net = amt - fee - gst;
    const effRate = baseExchangeRate * (1 - FX_MARKUP);
    const fxDiff = baseExchangeRate - effRate;
    const finalINR = net * effRate;
    const idealINR = amt * baseExchangeRate;
    const loss = idealINR - finalINR;

    setEl('resAmountSent', `$${amt.toFixed(2)}`);
    setEl('resPaypalFee', `-$${fee.toFixed(2)}`);
    setEl('resGST', `-$${gst.toFixed(2)}`);
    setEl('resNetUSD', `$${net.toFixed(2)}`);
    setEl('resBaseRate', `₹${baseExchangeRate.toFixed(2)}`);
    setEl('resFxMarkup', `-₹${fxDiff.toFixed(2)}/USD`);
    setEl('resEffectiveRate', `₹${effRate.toFixed(2)}`);
    setEl('resTotalINR', `₹${fmtNum(finalINR)}`);
    setEl('resTotalLoss', `-₹${fmtNum(loss)}`);
    setEl('resultsTimestamp', timestamp());

    showResult('resultsSection', 'reverseResultsSection');
}

function calcReverse() {
    const input = document.getElementById('amountInput');
    const desired = parseFloat(input.value);
    if (!validate(desired, input)) return;

    const effRate = baseExchangeRate * (1 - FX_MARKUP);
    const fxDiff = baseExchangeRate - effRate;
    const netNeeded = desired / effRate;
    const reqUSD = (netNeeded + FIXED_DEDUCTION) / NET_FACTOR;

    // Verify forward
    const fee = (reqUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE;
    const gst = fee * GST_RATE;
    const verifyNet = reqUSD - fee - gst;
    const idealINR = reqUSD * baseExchangeRate;
    const actualINR = verifyNet * effRate;
    const totalChargesINR = idealINR - actualINR;
    const lossPct = (totalChargesINR / idealINR) * 100;

    setEl('revRequiredUSD', `$${reqUSD.toFixed(2)}`);
    setEl('revDesiredINR', `₹${fmtNum(desired)}`);
    setEl('revPaypalFee', `-$${fee.toFixed(2)}`);
    setEl('revGST', `-$${gst.toFixed(2)}`);
    setEl('revNetUSD', `$${verifyNet.toFixed(2)}`);
    setEl('revBaseRate', `₹${baseExchangeRate.toFixed(2)}`);
    setEl('revFxMarkup', `-₹${fxDiff.toFixed(2)}/USD`);
    setEl('revEffectiveRate', `₹${effRate.toFixed(2)}`);
    setEl('revTotalCharges', `-₹${fmtNum(totalChargesINR)}`);
    setEl('revLossPercent', `${lossPct.toFixed(1)}%`);
    setEl('reverseTimestamp', timestamp());

    showResult('reverseResultsSection', 'resultsSection');
}

// ===========================
// Helpers
// ===========================
function validate(val, el) {
    if (isNaN(val) || val <= 0) {
        el.style.outline = '2px solid var(--red)';
        el.focus();
        setTimeout(() => el.style.outline = 'none', 2000);
        return false;
    }
    return true;
}

function setEl(id, text) { document.getElementById(id).textContent = text; }

function showResult(showId, hideId) {
    document.getElementById(hideId).classList.remove('visible');
    const el = document.getElementById(showId);
    el.classList.add('visible');
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
}

function timestamp() {
    const d = new Date();
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtNum(n) {
    const [int, dec] = n.toFixed(2).split('.');
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3);
    return (rest.length ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3 + '.' + dec;
}

// FAQ
function toggleFAQ(btn) {
    const item = btn.parentElement;
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!open) item.classList.add('open');
}

// Mobile Nav
document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
});

// Enter key
document.getElementById('amountInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') calculateFee();
});

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    fetchExchangeRate();
});
