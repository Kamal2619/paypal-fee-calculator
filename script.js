// ===========================
// PayPal Fee Conversion Calculator
// USD to INR — Script
// ===========================

let baseExchangeRate = 83.00; // Fallback rate
let rateSource = 'fallback';

// Fetch live exchange rate on page load
async function fetchExchangeRate() {
    const statusEl = document.getElementById('rateStatusText');
    const infoEl = document.getElementById('exchangeRateInfo');

    try {
        // Try ExchangeRate-API (free, no key needed for USD)
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
        // Try backup API
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
            // Use fallback
            rateSource = 'fallback';
            statusEl.textContent = `Using fallback rate: 1 USD = ₹${baseExchangeRate.toFixed(2)} (API unavailable)`;
            infoEl.classList.add('error');
            infoEl.classList.remove('loaded');
        }
    }
}

// Calculate PayPal fees
function calculateFee() {
    const amountInput = document.getElementById('amountInput');
    const amountUSD = parseFloat(amountInput.value);

    // Validation
    if (isNaN(amountUSD) || amountUSD <= 0) {
        amountInput.style.outline = '2px solid #e74c3c';
        amountInput.focus();
        setTimeout(() => {
            amountInput.style.outline = 'none';
        }, 2000);
        return;
    }

    // 1. PayPal Transaction Fee: 4.4% + $0.30
    const transactionFeeUSD = (amountUSD * 0.044) + 0.30;

    // 2. GST (India): 18% on PayPal fee
    const gstUSD = transactionFeeUSD * 0.18;

    // 3. Total Deductions in USD
    const totalDeductionsUSD = transactionFeeUSD + gstUSD;

    // 4. Net USD after deductions
    const netUSD = amountUSD - totalDeductionsUSD;

    // 5. PayPal FX Markup: 3.8% below market rate
    // PayPal uses a rate 3.8% less than Google/market rate
    const fxMarkupPercent = 0.038;
    const effectiveExchangeRate = baseExchangeRate * (1 - fxMarkupPercent);
    const fxMarkupINR = baseExchangeRate - effectiveExchangeRate;

    // 6. Final INR amount
    const finalINR = netUSD * effectiveExchangeRate;

    // 7. Calculate total loss
    const idealINR = amountUSD * baseExchangeRate;
    const totalLossINR = idealINR - finalINR;

    // Display results
    displayResults({
        amountUSD,
        transactionFeeUSD,
        gstUSD,
        netUSD,
        baseRate: baseExchangeRate,
        fxMarkupINR,
        effectiveRate: effectiveExchangeRate,
        finalINR,
        totalLossINR
    });
}

function displayResults(data) {
    // Populate values
    document.getElementById('resAmountSent').textContent = `$${data.amountUSD.toFixed(2)}`;
    document.getElementById('resPaypalFee').textContent = `-$${data.transactionFeeUSD.toFixed(2)}`;
    document.getElementById('resGST').textContent = `-$${data.gstUSD.toFixed(2)}`;
    document.getElementById('resNetUSD').textContent = `$${data.netUSD.toFixed(2)}`;
    document.getElementById('resBaseRate').textContent = `₹${data.baseRate.toFixed(2)}`;
    document.getElementById('resFxMarkup').textContent = `-₹${data.fxMarkupINR.toFixed(2)}/USD`;
    document.getElementById('resEffectiveRate').textContent = `₹${data.effectiveRate.toFixed(2)}`;
    document.getElementById('resTotalINR').textContent = `₹${formatNumber(data.finalINR)}`;
    document.getElementById('resTotalLoss').textContent = `-₹${formatNumber(data.totalLossINR)}`;

    // Timestamp
    const now = new Date();
    document.getElementById('resultsTimestamp').textContent =
        now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Show results
    const section = document.getElementById('resultsSection');
    section.classList.add('visible');

    // Scroll to results smoothly
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// Format large numbers with commas (Indian numbering)
function formatNumber(num) {
    const parts = num.toFixed(2).split('.');
    let intPart = parts[0];
    const decPart = parts[1];

    // Indian numbering system
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

    // Close all others
    document.querySelectorAll('.faq-item.open').forEach(item => {
        item.classList.remove('open');
    });

    // Toggle current
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
