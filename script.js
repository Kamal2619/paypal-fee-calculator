// ===================================================
// PayPal Fee Calculator — Personal Tool Logic
// Dual Mode (Forward USD to INR & Reverse Invoice)
// Dark / Light Theme, Live Rate & Clipboard Actions
// ===================================================

let baseExchangeRate = 86.20;
let fxMarkupPercent = 3.8;
let currentMode = 'forward'; // 'forward' | 'reverse'
let reverseTargetType = 'inr'; // 'inr' | 'usd'

// Constants
const PAYPAL_FEE_PERCENT = 0.044;
const PAYPAL_FIXED_FEE = 0.30;
const GST_RATE = 0.18;
// NET_FACTOR: 1 - (0.044 * 1.18) = 0.94808
const NET_FACTOR = 1 - (PAYPAL_FEE_PERCENT * (1 + GST_RATE));
// FIXED_DEDUCTION: 0.30 * 1.18 = 0.354
const FIXED_DEDUCTION = PAYPAL_FIXED_FEE * (1 + GST_RATE);

// Presets data
const PRESETS = {
    forward: [50, 100, 200, 500, 1000, 2000],
    reverse_inr: [5000, 10000, 25000, 50000, 100000],
    reverse_usd: [50, 100, 200, 500, 1000]
};

// ===================================================
// Theme Management
// ===================================================
function initTheme() {
    const saved = localStorage.getItem('paycalc_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('paycalc_theme', next);
}

// ===================================================
// Exchange Rate Management
// ===================================================
async function fetchExchangeRate() {
    const syncIcon = document.getElementById('syncIcon');
    if (syncIcon) syncIcon.classList.add('spin');

    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data?.result === 'success' && data.rates?.INR) {
            baseExchangeRate = parseFloat(data.rates.INR.toFixed(2));
            updateRateDisplay();
        }
    } catch (e) {
        try {
            const res2 = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR');
            const data2 = await res2.json();
            if (data2?.rates?.INR) {
                baseExchangeRate = parseFloat(data2.rates.INR.toFixed(2));
                updateRateDisplay();
            }
        } catch {
            console.log('Using default exchange rate:', baseExchangeRate);
        }
    } finally {
        if (syncIcon) {
            setTimeout(() => syncIcon.classList.remove('spin'), 400);
        }
    }
}

function updateRateDisplay() {
    const headerRate = document.getElementById('headerRateText');
    const customRateInput = document.getElementById('customBaseRate');
    const customMarkupInput = document.getElementById('customFxMarkup');
    const previewEffective = document.getElementById('previewEffectiveRate');

    if (headerRate) headerRate.textContent = `1 USD = ₹${baseExchangeRate.toFixed(2)}`;
    if (customRateInput) customRateInput.value = baseExchangeRate.toFixed(2);
    if (customMarkupInput) customMarkupInput.value = fxMarkupPercent.toFixed(1);

    const eff = getEffectiveRate();
    if (previewEffective) previewEffective.textContent = `₹${eff.toFixed(2)}`;

    calculate();
}

function getEffectiveRate() {
    return baseExchangeRate * (1 - (fxMarkupPercent / 100));
}

function toggleRateSettings() {
    const panel = document.getElementById('rateSettingsPanel');
    panel.classList.toggle('open');
}

function updateCustomRate() {
    const rateVal = parseFloat(document.getElementById('customBaseRate').value);
    const markupVal = parseFloat(document.getElementById('customFxMarkup').value);

    if (!isNaN(rateVal) && rateVal > 0) baseExchangeRate = rateVal;
    if (!isNaN(markupVal) && markupVal >= 0) fxMarkupPercent = markupVal;

    updateRateDisplay();
}

// ===================================================
// Mode & Presets Switching
// ===================================================
function switchMode(mode) {
    currentMode = mode;
    const tabForward = document.getElementById('tabForward');
    const tabReverse = document.getElementById('tabReverse');
    const inputLabel = document.getElementById('inputLabel');
    const inputHint = document.getElementById('inputHint');
    const inputPrefix = document.getElementById('inputPrefix');
    const input = document.getElementById('amountInput');
    const reverseSubmode = document.getElementById('reverseSubmode');
    const forwardCard = document.getElementById('forwardResults');
    const reverseCard = document.getElementById('reverseResults');

    tabForward.classList.toggle('active', mode === 'forward');
    tabReverse.classList.toggle('active', mode === 'reverse');

    if (mode === 'forward') {
        inputLabel.textContent = 'Amount Sent by Client:';
        inputHint.textContent = 'Client pays in USD';
        inputPrefix.textContent = '$';
        input.placeholder = '100';
        if (reverseSubmode) reverseSubmode.style.display = 'none';
        if (forwardCard) forwardCard.style.display = 'block';
        if (reverseCard) reverseCard.style.display = 'none';
    } else {
        if (reverseSubmode) reverseSubmode.style.display = 'block';
        if (forwardCard) forwardCard.style.display = 'none';
        if (reverseCard) reverseCard.style.display = 'block';
        updateReverseInputLabels();
    }

    renderPresets();
    calculate();
    input.focus();
}

function onTargetTypeChange() {
    const radios = document.getElementsByName('targetType');
    for (const r of radios) {
        if (r.checked) {
            reverseTargetType = r.value;
            break;
        }
    }
    updateReverseInputLabels();
    renderPresets();
    calculate();
}

function updateReverseInputLabels() {
    const inputLabel = document.getElementById('inputLabel');
    const inputHint = document.getElementById('inputHint');
    const inputPrefix = document.getElementById('inputPrefix');
    const input = document.getElementById('amountInput');

    if (reverseTargetType === 'inr') {
        inputLabel.textContent = 'Target Amount Needed in Bank:';
        inputHint.textContent = 'Exact ₹ credited to Indian account';
        inputPrefix.textContent = '₹';
        input.placeholder = '10000';
    } else {
        inputLabel.textContent = 'Desired Net USD Value:';
        inputHint.textContent = 'Full USD value without losing fees';
        inputPrefix.textContent = '$';
        input.placeholder = '100';
    }
}

function renderPresets() {
    const container = document.getElementById('presetChips');
    if (!container) return;

    let list = [];
    let symbol = '$';

    if (currentMode === 'forward') {
        list = PRESETS.forward;
        symbol = '$';
    } else if (reverseTargetType === 'inr') {
        list = PRESETS.reverse_inr;
        symbol = '₹';
    } else {
        list = PRESETS.reverse_usd;
        symbol = '$';
    }

    container.innerHTML = '';
    list.forEach(val => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = symbol === '₹' ? `₹${fmtNum(val, 0)}` : `$${val}`;
        chip.onclick = () => {
            document.getElementById('amountInput').value = val;
            calculate();
        };
        container.appendChild(chip);
    });
}

function clearInput() {
    const input = document.getElementById('amountInput');
    input.value = '';
    calculate();
    input.focus();
}

// ===================================================
// Core Calculations
// ===================================================
function calculate() {
    const input = document.getElementById('amountInput');
    const val = parseFloat(input.value);

    if (currentMode === 'forward') {
        calcForward(val);
    } else {
        calcReverse(val);
    }
}

// Mode 1: Client sends USD -> How much INR lands in bank
function calcForward(rawAmt) {
    const amt = isNaN(rawAmt) || rawAmt <= 0 ? 0 : rawAmt;
    const effRate = getEffectiveRate();
    const fxSpreadPerUSD = baseExchangeRate - effRate;

    let fee = 0;
    let gst = 0;
    let netUSD = 0;
    let finalINR = 0;
    let idealINR = 0;
    let lossINR = 0;
    let lossPercent = 0;

    if (amt > 0) {
        fee = (amt * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE;
        gst = fee * GST_RATE;
        netUSD = Math.max(0, amt - fee - gst);
        finalINR = netUSD * effRate;
        idealINR = amt * baseExchangeRate;
        lossINR = Math.max(0, idealINR - finalINR);
        lossPercent = idealINR > 0 ? (lossINR / idealINR) * 100 : 0;
    }

    // Update DOM
    setEl('resTotalINR', `₹${fmtNum(finalINR, 2)}`);
    setEl('resEffectiveRate', `₹${effRate.toFixed(2)}/USD`);
    setEl('resLossBadge', `-₹${fmtNum(lossINR, 2)} (${lossPercent.toFixed(1)}% total lost)`);

    setEl('resAmountSent', `$${amt.toFixed(2)}`);
    setEl('resPaypalFee', `-$${fee.toFixed(2)}`);
    setEl('resGST', `-$${gst.toFixed(2)}`);
    setEl('resNetUSD', `$${netUSD.toFixed(2)}`);

    setEl('resBaseRate', `₹${baseExchangeRate.toFixed(2)}`);
    setEl('resFxMarkup', `-₹${fxSpreadPerUSD.toFixed(2)} (${fxMarkupPercent}%)`);
    setEl('resAppliedRate', `₹${effRate.toFixed(2)}`);

    setEl('resFinalDeposit', `₹${fmtNum(finalINR, 2)}`);
    setEl('resTotalLoss', `-₹${fmtNum(lossINR, 2)} (${lossPercent.toFixed(1)}%)`);
}

// Mode 2: Reverse / Invoice -> Calculate what to ask the client
function calcReverse(rawAmt) {
    const amt = isNaN(rawAmt) || rawAmt <= 0 ? 0 : rawAmt;
    const effRate = getEffectiveRate();

    let targetINR = 0;
    let targetDisplay = '';
    let reqUSD = 0;
    let fee = 0;
    let gst = 0;
    let netUSD = 0;
    let actualDepositedINR = 0;
    let extraBilledUSD = 0;
    let extraBilledINR = 0;

    if (amt > 0) {
        if (reverseTargetType === 'inr') {
            targetINR = amt;
            targetDisplay = `₹${fmtNum(targetINR, 2)}`;
            const netNeededUSD = targetINR / effRate;
            reqUSD = (netNeededUSD + FIXED_DEDUCTION) / NET_FACTOR;
        } else {
            // Target is USD equivalent without losing fees
            targetDisplay = `$${amt.toFixed(2)} (₹${fmtNum(amt * baseExchangeRate, 2)})`;
            targetINR = amt * baseExchangeRate;
            const netNeededUSD = (amt * baseExchangeRate) / effRate;
            reqUSD = (netNeededUSD + FIXED_DEDUCTION) / NET_FACTOR;
        }

        fee = (reqUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE;
        gst = fee * GST_RATE;
        netUSD = reqUSD - fee - gst;
        actualDepositedINR = netUSD * effRate;

        const baseEquivalentUSD = targetINR / baseExchangeRate;
        extraBilledUSD = Math.max(0, reqUSD - baseEquivalentUSD);
        extraBilledINR = extraBilledUSD * baseExchangeRate;
    }

    setEl('revRequiredUSD', `$${reqUSD.toFixed(2)}`);
    setEl('revTargetDisplay', targetDisplay);
    setEl('revFeeNotice', '0% loss to you • All fees covered');

    setEl('revTargetGoal', targetDisplay);
    setEl('revInvoicedGross', `$${reqUSD.toFixed(2)}`);

    setEl('revPaypalFee', `-$${fee.toFixed(2)}`);
    setEl('revGST', `-$${gst.toFixed(2)}`);
    setEl('revNetUSD', `$${netUSD.toFixed(2)}`);
    setEl('revEffectiveRate', `₹${effRate.toFixed(2)}`);

    setEl('revFinalBank', `₹${fmtNum(actualDepositedINR, 2)}`);
    setEl('revExtraBilled', `+$${extraBilledUSD.toFixed(2)} (~₹${fmtNum(extraBilledINR, 0)})`);
}

// ===================================================
// Copy Actions & Toast
// ===================================================
function copyInvoiceText() {
    const reqUSD = document.getElementById('revRequiredUSD').textContent;
    const target = document.getElementById('revTargetDisplay').textContent;

    const note = `Hi,\n\nTo ensure the exact net amount (${target}) is received after international PayPal fees (4.4% + $0.30 fixed fee, 18% GST, and currency conversion spread), the total invoice amount is ${reqUSD}.\n\nThank you!`;

    navigator.clipboard.writeText(note).then(() => {
        showToast('Client invoice note copied!');
    }).catch(() => {
        fallbackCopy(note);
    });
}

function copyBreakdown(mode) {
    let text = '';
    if (mode === 'forward') {
        const sent = document.getElementById('resAmountSent').textContent;
        const fee = document.getElementById('resPaypalFee').textContent;
        const gst = document.getElementById('resGST').textContent;
        const netUSD = document.getElementById('resNetUSD').textContent;
        const effRate = document.getElementById('resAppliedRate').textContent;
        const deposit = document.getElementById('resFinalDeposit').textContent;
        const loss = document.getElementById('resTotalLoss').textContent;

        text = `PayPal Fee Breakdown (USD to INR):\n` +
               `• Amount Sent: ${sent}\n` +
               `• PayPal Fee: ${fee}\n` +
               `• Indian GST (18%): ${gst}\n` +
               `• Net USD: ${netUSD}\n` +
               `• Effective Rate: ${effRate}\n` +
               `• Credited to Bank: ${deposit}\n` +
               `• Total Deductions: ${loss}`;
    } else {
        const invoiced = document.getElementById('revInvoicedGross').textContent;
        const target = document.getElementById('revTargetGoal').textContent;
        const fee = document.getElementById('revPaypalFee').textContent;
        const gst = document.getElementById('revGST').textContent;
        const netUSD = document.getElementById('revNetUSD').textContent;
        const deposit = document.getElementById('revFinalBank').textContent;

        text = `PayPal Reverse Invoice Breakdown:\n` +
               `• Ask Client to Send: ${invoiced}\n` +
               `• Target Net Amount: ${target}\n` +
               `• PayPal Fee: ${fee}\n` +
               `• Indian GST (18%): ${gst}\n` +
               `• Net USD: ${netUSD}\n` +
               `• Deposited in Bank: ${deposit}`;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Breakdown copied to clipboard!');
    }).catch(() => {
        fallbackCopy(text);
    });
}

function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    showToast('Copied to clipboard!');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
}

// ===================================================
// Helper Utilities
// ===================================================
function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function fmtNum(n, decimals = 2) {
    if (isNaN(n)) return '0.00';
    const parts = n.toFixed(decimals).split('.');
    let intPart = parts[0];
    const decPart = parts[1] !== undefined ? '.' + parts[1] : '';

    // Indian numbering format for thousands and lakhs
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    if (rest.length > 0) {
        intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
    } else {
        intPart = last3;
    }
    return intPart + decPart;
}

// ===================================================
// Initialization & Event Listeners
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderPresets();

    const input = document.getElementById('amountInput');
    if (input) {
        input.value = '100'; // Default convenient amount
        input.addEventListener('input', calculate);
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') calculate();
        });
    }

    fetchExchangeRate();
    calculate();
});
