// ===========================
// PayPal Fee Conversion Calculator
// USD to INR — Dual Mode Script
// ===========================

let baseExchangeRate = 83.00; // Fallback rate
let rateSource = 'fallback';
let currentMode = 'forward'; // 'forward' or 'reverse'

// Constants
const PAYPAL_FEE_PERCENT = 0.044;   // 4.4%
const PAYPAL_FIXED_FEE = 0.30;      // $0.30
const GST_RATE = 0.18;              // 18%
const FX_MARKUP = 0.038;            // 3.8%

// Derived constant for reverse calc
// totalDeductions = (amountUSD * 0.044 + 0.30) * 1.18
// netUSD = amountUSD - totalDeductions
// netUSD = amountUSD * (1 - 0.044 * 1.18) - 0.30 * 1.18
// netUSD = amountUSD * 0.94808 - 0.354
const NET_FACTOR = 1 - (PAYPAL_FEE_PERCENT * (1 + GST_RATE)); // 0.94808
const FIXED_DEDUCTION = PAYPAL_FIXED_FEE * (1 + GST_RATE);     // 0.354

// Fetch live exchange rate on page load
async function fetchExchangeRate() {
    const statusEl = document.getElementById('rateStatusText');
    const infoEl = document.getElementById('exchangeRateInfo');

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();

        if (data && data.result === 'success' && data.rates && data.rates.INR) {
            baseExchangeRate = data.rates.INR;
            rateSource = 'live';
            statusEl.textContent = `Live rate loaded: 1 USD = ₹${baseExchangeRate.toFixed(2)} (Google/Market rate)`;
            infoEl.classList.add('loaded');
            infoEl.classList.remove('error');
        } else {
            throw new Error('Invalid API response');
        }
    } catch (err) {
        try {
            const response2 = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR');
            const data2 = await response2.json();

            if (data2 && data2.rates && data2.rates.INR) {
                baseExchangeRate = data2.rates.INR;
                rateSource = 'live';
                statusEl.textContent = `Live rate loaded: 1 USD = ₹${baseExchangeRate.toFixed(2)} (Market rate)`;
                infoEl.classList.add('loaded');
                infoEl.classList.remove('error');
            } else {
                throw new Error('Backup API failed');
            }
        } catch (err2) {
            rateSource = 'fallback';
            statusEl.textContent = `Using fallback rate: 1 USD = ₹${baseExchangeRate.toFixed(2)} (API unavailable)`;
            infoEl.classList.add('error');
            infoEl.classList.remove('loaded');
        }
    }
}

// Switch between forward and reverse modes
function switchMode(mode) {
    currentMode = mode;

    const forwardBtn = document.getElementById('modeForward');
    const reverseBtn = document.getElementById('modeReverse');
    const inputLabel = document.getElementById('inputLabel');
    const inputPrefix = document.getElementById('inputPrefix');
    const amountInput = document.getElementById('amountInput');

    // Hide both result sections
    document.getElementById('resultsSection').classList.remove('visible');
    document.getElementById('reverseResultsSection').classList.remove('visible');

    // Clear input
    amountInput.value = '';

    if (mode === 'forward') {
        forwardBtn.classList.add('active');
        reverseBtn.classList.remove('active');
        inputLabel.textContent = 'Enter amount (in $):';
        inputPrefix.textContent = '$';
        amountInput.placeholder = 'Enter amount (in $):';
    } else {
        reverseBtn.classList.add('active');
        forwardBtn.classList.remove('active');
        inputLabel.textContent = 'Enter desired amount (in ₹):';
        inputPrefix.textContent = '₹';
        amountInput.placeholder = 'Enter desired amount (in ₹):';
    }

    amountInput.focus();
}

// Main calculate function — routes to forward or reverse
function calculateFee() {
    if (currentMode === 'forward') {
        calculateForward();
    } else {
        calculateReverse();
    }
}

// ===========================
// FORWARD: USD sent → INR received
// ===========================
function calculateForward() {
    const amountInput = document.getElementById('amountInput');
    const amountUSD = parseFloat(amountInput.value);

    if (!validateInput(amountUSD, amountInput)) return;

    // 1. PayPal Transaction Fee: 4.4% + $0.30
    const transactionFeeUSD = (amountUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE;

    // 2. GST (India): 18% on PayPal fee
    const gstUSD = transactionFeeUSD * GST_RATE;

    // 3. Total Deductions in USD
    const totalDeductionsUSD = transactionFeeUSD + gstUSD;

    // 4. Net USD after deductions
    const netUSD = amountUSD - totalDeductionsUSD;

    // 5. PayPal FX Markup: 3.8% below market rate
    const effectiveExchangeRate = baseExchangeRate * (1 - FX_MARKUP);
    const fxMarkupINR = baseExchangeRate - effectiveExchangeRate;

    // 6. Final INR amount
    const finalINR = netUSD * effectiveExchangeRate;

    // 7. Total loss
    const idealINR = amountUSD * baseExchangeRate;
    const totalLossINR = idealINR - finalINR;

    // Display forward results
    document.getElementById('resAmountSent').textContent = `$${amountUSD.toFixed(2)}`;
    document.getElementById('resPaypalFee').textContent = `-$${transactionFeeUSD.toFixed(2)}`;
    document.getElementById('resGST').textContent = `-$${gstUSD.toFixed(2)}`;
    document.getElementById('resNetUSD').textContent = `$${netUSD.toFixed(2)}`;
    document.getElementById('resBaseRate').textContent = `₹${baseExchangeRate.toFixed(2)}`;
    document.getElementById('resFxMarkup').textContent = `-₹${fxMarkupINR.toFixed(2)}/USD`;
    document.getElementById('resEffectiveRate').textContent = `₹${effectiveExchangeRate.toFixed(2)}`;
    document.getElementById('resTotalINR').textContent = `₹${formatNumber(finalINR)}`;
    document.getElementById('resTotalLoss').textContent = `-₹${formatNumber(totalLossINR)}`;

    document.getElementById('resultsTimestamp').textContent = getTimestamp();

    // Show forward results, hide reverse
    document.getElementById('reverseResultsSection').classList.remove('visible');
    const section = document.getElementById('resultsSection');
    section.classList.add('visible');
    scrollToResults(section);
}

// ===========================
// REVERSE: Desired INR → Required USD to invoice
// ===========================
function calculateReverse() {
    const amountInput = document.getElementById('amountInput');
    const desiredINR = parseFloat(amountInput.value);

    if (!validateInput(desiredINR, amountInput)) return;

    // Effective exchange rate (after 3.8% FX markup)
    const effectiveExchangeRate = baseExchangeRate * (1 - FX_MARKUP);
    const fxMarkupINR = baseExchangeRate - effectiveExchangeRate;

    // Reverse formula:
    // desiredINR = netUSD * effectiveRate
    // netUSD = desiredINR / effectiveRate
    // netUSD = amountUSD * NET_FACTOR - FIXED_DEDUCTION
    // So: amountUSD = (netUSD + FIXED_DEDUCTION) / NET_FACTOR
    const netUSDNeeded = desiredINR / effectiveExchangeRate;
    const requiredUSD = (netUSDNeeded + FIXED_DEDUCTION) / NET_FACTOR;

    // Verify by running forward calculation on requiredUSD
    const transactionFeeUSD = (requiredUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE;
    const gstUSD = transactionFeeUSD * GST_RATE;
    const totalDeductionsUSD = transactionFeeUSD + gstUSD;
    const verifyNetUSD = requiredUSD - totalDeductionsUSD;
    const verifyINR = verifyNetUSD * effectiveExchangeRate;

    // Total charges in both currencies
    const totalChargesUSD = totalDeductionsUSD;
    const idealINR = requiredUSD * baseExchangeRate;
    const totalChargesINR = idealINR - verifyINR;
    const lossPercent = (totalChargesINR / idealINR) * 100;

    // Display reverse results
    document.getElementById('revRequiredUSD').textContent = `$${requiredUSD.toFixed(2)}`;
    document.getElementById('revDesiredINR').textContent = `₹${formatNumber(desiredINR)}`;
    document.getElementById('revPaypalFee').textContent = `-$${transactionFeeUSD.toFixed(2)}`;
    document.getElementById('revGST').textContent = `-$${gstUSD.toFixed(2)}`;
    document.getElementById('revNetUSD').textContent = `$${verifyNetUSD.toFixed(2)}`;
    document.getElementById('revBaseRate').textContent = `₹${baseExchangeRate.toFixed(2)}`;
    document.getElementById('revFxMarkup').textContent = `-₹${fxMarkupINR.toFixed(2)}/USD`;
    document.getElementById('revEffectiveRate').textContent = `₹${effectiveExchangeRate.toFixed(2)}`;
    document.getElementById('revTotalCharges').textContent = `-₹${formatNumber(totalChargesINR)} (-$${totalChargesUSD.toFixed(2)})`;
    document.getElementById('revLossPercent').textContent = `${lossPercent.toFixed(1)}% of the invoiced amount`;

    document.getElementById('reverseTimestamp').textContent = getTimestamp();

    // Show reverse results, hide forward
    document.getElementById('resultsSection').classList.remove('visible');
    const section = document.getElementById('reverseResultsSection');
    section.classList.add('visible');
    scrollToResults(section);
}

// ===========================
// Utility Functions
// ===========================

function validateInput(value, inputEl) {
    if (isNaN(value) || value <= 0) {
        inputEl.style.outline = '2px solid #e74c3c';
        inputEl.focus();
        setTimeout(() => {
            inputEl.style.outline = 'none';
        }, 2000);
        return false;
    }
    return true;
}

function getTimestamp() {
    const now = new Date();
    return now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function scrollToResults(section) {
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// Format large numbers with commas (Indian numbering system)
function formatNumber(num) {
    const parts = num.toFixed(2).split('.');
    let intPart = parts[0];
    const decPart = parts[1];

    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);

    if (remaining.length > 0) {
        intPart = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
    } else {
        intPart = lastThree;
    }

    return intPart + '.' + decPart;
}

// FAQ Toggle
function toggleFAQ(button) {
    const faqItem = button.parentElement;
    const isOpen = faqItem.classList.contains('open');

    document.querySelectorAll('.faq-item.open').forEach(item => {
        item.classList.remove('open');
    });

    if (!isOpen) {
        faqItem.classList.add('open');
    }
}

// Mobile Navigation Toggle
document.getElementById('mobileToggle').addEventListener('click', function () {
    document.getElementById('navLinks').classList.toggle('open');
});

// Allow Enter key to calculate
document.getElementById('amountInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        calculateFee();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    fetchExchangeRate();
});
