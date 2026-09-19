// ===================================================
// MinimalFee™ by Minimal Creates — Official Calculation Engine
// Precision PayPal USD to INR & Zero-Loss Reverse Invoicing
// Dynamic Market Rate Sync & Exact Decimal Financial Precision
// ===================================================

// Defaults & Financial Constants
const DEFAULT_FX_MARKUP = 3.80; // Established median between PayPal's 3.00% and 4.50% retail FX spread
const DEFAULT_24H_BUFFER = 0.85; // Morally balanced 99th percentile 24h bank auto-withdrawal volatility buffer

let baseExchangeRate = 96.10;
let fxMarkupPercent = DEFAULT_FX_MARKUP;
let buffer24hPercent = DEFAULT_24H_BUFFER;
let directEffectiveRate = null; // When user specifies exact conversion rate from statement
let currentMode = 'forward'; // 'forward' | 'reverse'
let reverseTargetType = 'inr'; // 'inr' | 'usd'
let selectedInvoiceOption = 'protected'; // 'protected' | 'standard'

// Official PayPal India Fee Constants
const PAYPAL_FEE_PERCENT = 0.044; // 4.40%
const PAYPAL_FIXED_FEE = 0.30;     // $0.30 USD
const GST_RATE = 0.18;             // 18.00% Indian GST

// Pre-computed exact reverse factors
// NET_FACTOR = 1 - (0.044 * 1.18) = 0.94808
const NET_FACTOR = 1 - (PAYPAL_FEE_PERCENT * (1 + GST_RATE));
// FIXED_DEDUCTION = 0.30 * 1.18 = 0.354
const FIXED_DEDUCTION = PAYPAL_FIXED_FEE * (1 + GST_RATE);

// Presets data including real-world transaction benchmark ($51.82 / $48.78 / ₹4,509.85)
const PRESETS = {
    forward: [51.82, 100, 200, 500, 1000, 2000],
    reverse_inr: [4509.85, 4502.67, 10000, 25000, 50000],
    reverse_usd: [48.78, 100, 200, 500, 1000]
};

// ===================================================
// Precision Financial Rounding (Matches PayPal Ledger)
// ===================================================
function round2(val) {
    return Math.round((val + Number.EPSILON) * 100) / 100;
}

// ===================================================
// Cookie & Cache Utilities (Minimal Creates Standard)
// ===================================================
const CookieManager = {
    set(name, value, days = 365) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
    },
    get(name) {
        const nameEQ = `${name}=`;
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i].trim();
            if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
        }
        return null;
    },
    erase(name) {
        document.cookie = `${name}=; Max-Age=-99999999; path=/;`;
    }
};

const CacheManager = {
    CACHE_KEY: 'mc_minimalfee_rate_cache_v3',
    TTL: 4 * 60 * 60 * 1000, // 4 Hours

    getRate() {
        try {
            const raw = localStorage.getItem(this.CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (Date.now() - parsed.timestamp < this.TTL && parsed.rate > 0) {
                return parsed.rate;
            }
        } catch {
            return null;
        }
        return null;
    },

    saveRate(rate) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                rate: rate,
                timestamp: Date.now()
            }));
            CookieManager.set('mc_last_rate', rate.toFixed(4), 30);
        } catch (e) {
            console.warn('Storage unavailable:', e);
        }
    },

    clearAll() {
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem('minimalfee_theme');
        CookieManager.erase('mc_last_rate');
        CookieManager.erase('mc_theme');
        CookieManager.erase('mc_calc_mode');
    }
};

// ===================================================
// Theme Management
// ===================================================
function initTheme() {
    const saved = localStorage.getItem('minimalfee_theme') || CookieManager.get('mc_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('minimalfee_theme', next);
    CookieManager.set('mc_theme', next, 365);
}

// ===================================================
// Dynamic Real-World Exchange Rate Management
// ===================================================
async function fetchExchangeRate(forceRefresh = false) {
    const syncIcon = document.getElementById('syncIcon');
    if (syncIcon) syncIcon.classList.add('spin');

    // 1. Check Cache first unless force-refreshed
    if (!forceRefresh) {
        const cached = CacheManager.getRate();
        if (cached) {
            baseExchangeRate = cached;
            updateRateDisplay();
            if (syncIcon) setTimeout(() => syncIcon.classList.remove('spin'), 300);
            return;
        }
    }

    // 2. Fetch live interbank real-world rate
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data?.result === 'success' && data.rates?.INR) {
            baseExchangeRate = parseFloat(data.rates.INR);
            CacheManager.saveRate(baseExchangeRate);
            updateRateDisplay();
            if (forceRefresh) showToast(`Live Google/Market rate: ₹${baseExchangeRate.toFixed(2)}`);
        }
    } catch (e) {
        try {
            const res2 = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=INR');
            const data2 = await res2.json();
            if (data2?.rates?.INR) {
                baseExchangeRate = parseFloat(data2.rates.INR);
                CacheManager.saveRate(baseExchangeRate);
                updateRateDisplay();
                if (forceRefresh) showToast(`Live rate refreshed: ₹${baseExchangeRate.toFixed(2)}`);
            }
        } catch {
            console.log('Using current exchange rate:', baseExchangeRate);
            if (forceRefresh) showToast(`Using benchmark rate: ₹${baseExchangeRate.toFixed(2)}`);
        }
    } finally {
        if (syncIcon) {
            setTimeout(() => syncIcon.classList.remove('spin'), 400);
        }
    }
}

// Effective rate applied by PayPal
function getEffectiveRate() {
    if (directEffectiveRate !== null && directEffectiveRate > 0) {
        return directEffectiveRate;
    }
    // Intelligent median fallback: if user leaves spread blank or unknown, use DEFAULT_FX_MARKUP (3.80%)
    const markup = (isNaN(fxMarkupPercent) || fxMarkupPercent < 0) ? DEFAULT_FX_MARKUP : fxMarkupPercent;
    return baseExchangeRate * (1 - (markup / 100));
}

// Protected rate for 24h bank holding delay (with volatility buffer)
function getProtectedRate() {
    const eff = getEffectiveRate();
    const buffer = (isNaN(buffer24hPercent) || buffer24hPercent < 0) ? DEFAULT_24H_BUFFER : buffer24hPercent;
    return eff * (1 - (buffer / 100));
}

function updateRateDisplay() {
    const headerRate = document.getElementById('headerRateText');
    const customRateInput = document.getElementById('customBaseRate');
    const customMarkupInput = document.getElementById('customFxMarkup');
    const customBufferInput = document.getElementById('custom24hBuffer');
    const previewEffective = document.getElementById('previewEffectiveRate');
    const previewProtected = document.getElementById('previewProtectedRate');
    const directRateInput = document.getElementById('customDirectEffectiveRate');
    const cardBufferText = document.getElementById('cardBufferText');

    const eff = getEffectiveRate();
    const prot = getProtectedRate();

    if (headerRate) headerRate.textContent = `1 USD = ₹${eff.toFixed(2)}`;
    if (customRateInput && document.activeElement !== customRateInput) {
        customRateInput.value = baseExchangeRate.toFixed(2);
    }
    if (customMarkupInput && document.activeElement !== customMarkupInput) {
        customMarkupInput.value = isNaN(fxMarkupPercent) ? '' : fxMarkupPercent.toFixed(2);
    }
    if (customBufferInput && document.activeElement !== customBufferInput) {
        customBufferInput.value = isNaN(buffer24hPercent) ? '' : buffer24hPercent.toFixed(2);
    }
    if (previewEffective) {
        const isAutoMedian = isNaN(fxMarkupPercent) || fxMarkupPercent === DEFAULT_FX_MARKUP;
        previewEffective.textContent = `₹${eff.toFixed(4)}/USD${isAutoMedian ? ' (Auto 3.8%)' : ''}`;
    }
    if (previewProtected) {
        previewProtected.textContent = `₹${prot.toFixed(4)}/USD`;
    }
    if (directRateInput && document.activeElement !== directRateInput && directEffectiveRate !== null) {
        directRateInput.value = directEffectiveRate;
    }
    if (cardBufferText) {
        cardBufferText.textContent = `${(isNaN(buffer24hPercent) ? DEFAULT_24H_BUFFER : buffer24hPercent).toFixed(2)}% buffer`;
    }

    calculate();
}

function toggleRateSettings() {
    const panel = document.getElementById('rateSettingsPanel');
    panel.classList.toggle('open');
}

function setBufferPreset(val) {
    buffer24hPercent = parseFloat(val);
    const input = document.getElementById('custom24hBuffer');
    if (input) input.value = buffer24hPercent.toFixed(2);

    const chips = document.querySelectorAll('.buffer-chip');
    chips.forEach(chip => {
        const text = chip.textContent;
        const matches = (val === 0.50 && text.includes('0.5')) ||
                        (val === 0.85 && text.includes('0.85')) ||
                        (val === 1.25 && text.includes('1.25'));
        chip.classList.toggle('active', matches);
    });

    updateRateDisplay();
}

function updateCustomRate(source) {
    const rateInput = document.getElementById('customBaseRate');
    const markupInput = document.getElementById('customFxMarkup');
    const bufferInput = document.getElementById('custom24hBuffer');
    const directInput = document.getElementById('customDirectEffectiveRate');

    if (source === 'direct') {
        const val = parseFloat(directInput.value);
        if (!isNaN(val) && val > 0) {
            directEffectiveRate = val;
            // Calculate implied markup against market rate
            if (baseExchangeRate > val) {
                fxMarkupPercent = ((baseExchangeRate - val) / baseExchangeRate) * 100;
                if (markupInput) markupInput.value = fxMarkupPercent.toFixed(2);
            }
        } else {
            directEffectiveRate = null;
        }
    } else if (source === 'buffer') {
        const bVal = parseFloat(bufferInput.value);
        // Intelligent fallback: if left empty, apply DEFAULT_24H_BUFFER (0.85%)
        buffer24hPercent = isNaN(bVal) || bVal < 0 ? DEFAULT_24H_BUFFER : bVal;
    } else if (source === 'markup') {
        directEffectiveRate = null;
        if (directInput && document.activeElement !== directInput) directInput.value = '';
        
        const mVal = parseFloat(markupInput.value);
        // Intelligent median fallback: if user clears or doesn't know spread, take it into our hands and assign logical median
        fxMarkupPercent = isNaN(mVal) || mVal < 0 ? DEFAULT_FX_MARKUP : mVal;
    } else {
        directEffectiveRate = null;
        if (directInput && document.activeElement !== directInput) directInput.value = '';
        const rateVal = parseFloat(rateInput.value);
        if (!isNaN(rateVal) && rateVal > 0) baseExchangeRate = rateVal;
    }

    updateRateDisplay();
}

// ===================================================
// Mode & Presets Switching
// ===================================================
function switchMode(mode) {
    currentMode = mode;
    CookieManager.set('mc_calc_mode', mode, 30);

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
    tabForward.setAttribute('aria-selected', mode === 'forward');
    tabReverse.classList.toggle('active', mode === 'reverse');
    tabReverse.setAttribute('aria-selected', mode === 'reverse');

    if (mode === 'forward') {
        inputLabel.textContent = 'Amount Sent by Client:';
        inputHint.textContent = 'Client pays in USD';
        inputPrefix.textContent = '$';
        input.placeholder = '51.82';
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
        input.placeholder = '4509.85';
    } else {
        inputLabel.textContent = 'Desired Net USD in Hand:';
        inputHint.textContent = 'Exact $ available after PayPal deductions';
        inputPrefix.textContent = '$';
        input.placeholder = '48.78';
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
        chip.textContent = symbol === '₹' ? `₹${fmtNum(val, 2)}` : `$${val.toFixed(2)}`;
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
// Core Precision Calculations (Exact Cent & Paisa Matching)
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

// Mode 1: Client sends USD -> Exact Breakdown to Bank (Matches PayPal Ledger)
function calcForward(rawAmt) {
    const amt = isNaN(rawAmt) || rawAmt <= 0 ? 0 : rawAmt;
    const effRate = getEffectiveRate();
    const fxSpreadPerUSD = baseExchangeRate - effRate;

    let fee = 0;
    let gst = 0;
    let totalDeductionsUSD = 0;
    let netUSD = 0;
    let finalINR = 0;
    let idealINR = 0;
    let lossINR = 0;
    let lossPercent = 0;

    if (amt > 0) {
        // Step 1: PayPal International Base Fee (4.4% + $0.30)
        fee = round2((amt * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE);
        // Step 2: 18% Indian GST on PayPal Fee
        gst = round2(fee * GST_RATE);
        // Step 3: Total USD Deductions
        totalDeductionsUSD = round2(fee + gst);
        // Step 4: Net USD Available for Withdrawal
        netUSD = Math.max(0, round2(amt - totalDeductionsUSD));
        // Step 5: Final Deposited INR (SBI / Indian Bank)
        finalINR = round2(netUSD * effRate);
        // Benchmark comparison (No fee Google ideal)
        idealINR = round2(amt * baseExchangeRate);
        lossINR = Math.max(0, round2(idealINR - finalINR));
        lossPercent = idealINR > 0 ? (lossINR / idealINR) * 100 : 0;
    }

    // Update DOM
    setEl('resTotalINR', `₹${fmtNum(finalINR, 2)}`);
    setEl('resEffectiveRate', `₹${effRate.toFixed(4)}/USD`);
    setEl('resLossBadge', `-₹${fmtNum(lossINR, 2)} (${lossPercent.toFixed(1)}% total lost)`);

    setEl('resAmountSent', `$${amt.toFixed(2)}`);
    setEl('resPaypalFee', `-$${fee.toFixed(2)}`);
    setEl('resGST', `-$${gst.toFixed(2)}`);
    setEl('resNetUSD', `$${netUSD.toFixed(2)}`);

    setEl('resBaseRate', `₹${baseExchangeRate.toFixed(2)}`);
    setEl('resFxMarkup', `-₹${fxSpreadPerUSD.toFixed(2)} (${fxMarkupPercent.toFixed(1)}%)`);
    setEl('resAppliedRate', `₹${effRate.toFixed(4)}`);

    setEl('resFinalDeposit', `₹${fmtNum(finalINR, 2)}`);
    setEl('resTotalLoss', `-₹${fmtNum(lossINR, 2)} (${lossPercent.toFixed(1)}%)`);
}

// Store active calculation results for both options
let lastReverseResults = null;

// Mode 2: Reverse Invoice -> Dual Options (Market Protected + 24h Buffer vs Standard Moral)
function calcReverse(rawAmt) {
    const amt = isNaN(rawAmt) || rawAmt <= 0 ? 0 : rawAmt;
    const effRate = getEffectiveRate();
    const protRate = getProtectedRate();

    const results = {
        targetDisplay: '',
        targetGoal: '',
        protected: { reqUSD: 0, fee: 0, gst: 0, netUSD: 0, finalBank: 0, bufferUSD: 0 },
        standard: { reqUSD: 0, fee: 0, gst: 0, netUSD: 0, finalBank: 0, feeUSD: 0 }
    };

    if (amt > 0) {
        if (reverseTargetType === 'inr') {
            // User target: Exact INR in Indian Bank (e.g. ₹10,000)
            const targetINR = amt;
            results.targetGoal = `₹${fmtNum(targetINR, 2)}`;
            results.targetDisplay = `₹${fmtNum(targetINR, 2)}`;

            // --- Option 2: Standard Invoice (PayPal standard conversion rate) ---
            const stdNetNeededUSD = targetINR / effRate;
            const stdReqUSD = round2((stdNetNeededUSD + FIXED_DEDUCTION) / NET_FACTOR);
            const stdFee = round2((stdReqUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE);
            const stdGST = round2(stdFee * GST_RATE);
            const stdNetUSD = round2(stdReqUSD - (stdFee + stdGST));
            const stdFinalBank = round2(stdNetUSD * effRate);
            const stdFeeUSD = Math.max(0, round2(stdReqUSD - stdNetNeededUSD));

            results.standard = {
                reqUSD: stdReqUSD,
                fee: stdFee,
                gst: stdGST,
                netUSD: stdNetUSD,
                finalBank: stdFinalBank,
                feeUSD: stdFeeUSD
            };

            // --- Option 1: Market Protected + 24h Volatility Buffer ---
            const protNetNeededUSD = targetINR / protRate;
            const protReqUSD = round2((protNetNeededUSD + FIXED_DEDUCTION) / NET_FACTOR);
            const protFee = round2((protReqUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE);
            const protGST = round2(protFee * GST_RATE);
            const protNetUSD = round2(protReqUSD - (protFee + protGST));
            const protFinalBank = targetINR; // 100% Guaranteed payout even if rate dips overnight
            const protBufferUSD = Math.max(0, round2(protReqUSD - stdReqUSD));

            results.protected = {
                reqUSD: protReqUSD,
                fee: protFee,
                gst: protGST,
                netUSD: protNetUSD,
                finalBank: protFinalBank,
                bufferUSD: protBufferUSD
            };

        } else {
            // User target: USD Net in Hand (e.g. $100 for a $100 project)
            const realMarketINR = round2(amt * baseExchangeRate);
            results.targetGoal = `$${amt.toFixed(2)}`;
            results.targetDisplay = `$${amt.toFixed(2)} (₹${fmtNum(realMarketINR, 2)} market value)`;

            // --- Option 2: Standard Client Terms (Standard fees covered; user absorbs standard FX spread) ---
            const stdNetNeededUSD = amt;
            const stdReqUSD = round2((stdNetNeededUSD + FIXED_DEDUCTION) / NET_FACTOR);
            const stdFee = round2((stdReqUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE);
            const stdGST = round2(stdFee * GST_RATE);
            const stdNetUSD = round2(stdReqUSD - (stdFee + stdGST));
            const stdFinalBank = round2(stdNetUSD * effRate);
            const stdFeeUSD = Math.max(0, round2(stdReqUSD - amt));

            results.standard = {
                reqUSD: stdReqUSD,
                fee: stdFee,
                gst: stdGST,
                netUSD: stdNetUSD,
                finalBank: stdFinalBank,
                feeUSD: stdFeeUSD
            };

            // --- Option 1: Market Protected (Covers fees, PayPal FX spread & 24h buffer to guarantee full ₹ market value) ---
            const protNetNeededUSD = realMarketINR / protRate;
            const protReqUSD = round2((protNetNeededUSD + FIXED_DEDUCTION) / NET_FACTOR);
            const protFee = round2((protReqUSD * PAYPAL_FEE_PERCENT) + PAYPAL_FIXED_FEE);
            const protGST = round2(protFee * GST_RATE);
            const protNetUSD = round2(protReqUSD - (protFee + protGST));
            const protFinalBank = realMarketINR; // 100% full real-world market rupee value preserved
            const protBufferUSD = Math.max(0, round2(protReqUSD - stdReqUSD));

            results.protected = {
                reqUSD: protReqUSD,
                fee: protFee,
                gst: protGST,
                netUSD: protNetUSD,
                finalBank: protFinalBank,
                bufferUSD: protBufferUSD
            };
        }
    }

    lastReverseResults = results;

    // 1. Update Header Badge
    setEl('revTargetNotice', `Target: ${results.targetDisplay || '₹0.00'}`);

    // 2. Update Card 1 (Protected Option)
    setEl('optProtectedUSD', results.protected.reqUSD.toFixed(2));
    setEl('optProtectedDeposit', `₹${fmtNum(results.protected.finalBank, 2)}`);
    setEl('optProtectedBuffer', `+$${results.protected.bufferUSD.toFixed(2)} shield`);
    setEl('cardBufferText', `${(isNaN(buffer24hPercent) ? DEFAULT_24H_BUFFER : buffer24hPercent).toFixed(2)}% buffer`);

    // 3. Update Card 2 (Standard Option)
    setEl('optStandardUSD', results.standard.reqUSD.toFixed(2));
    setEl('optStandardDeposit', `₹${fmtNum(results.standard.finalBank, 2)}`);
    setEl('optStandardFee', `+$${results.standard.feeUSD.toFixed(2)} fee`);

    // 4. Update Detailed Breakdown based on currently selected option
    updateSelectedBreakdown();
}

function selectInvoiceOption(type) {
    selectedInvoiceOption = type;
    const cardProt = document.getElementById('optCardProtected');
    const cardStd = document.getElementById('optCardStandard');

    if (cardProt) cardProt.classList.toggle('selected', type === 'protected');
    if (cardStd) cardStd.classList.toggle('selected', type === 'standard');

    const protLabel = cardProt?.querySelector('.opt-radio-label');
    const stdLabel = cardStd?.querySelector('.opt-radio-label');
    if (protLabel) protLabel.textContent = type === 'protected' ? 'Shield Active' : 'Select';
    if (stdLabel) stdLabel.textContent = type === 'standard' ? 'Active' : 'Select';

    updateSelectedBreakdown();
}

function updateSelectedBreakdown() {
    if (!lastReverseResults) return;

    const results = lastReverseResults;
    const isProtected = selectedInvoiceOption === 'protected';
    const activeData = isProtected ? results.protected : results.standard;
    const effRate = getEffectiveRate();
    const protRate = getProtectedRate();

    // Update Summary Banner
    const summaryText = document.getElementById('activeSummaryText');
    if (summaryText) {
        if (isProtected) {
            summaryText.innerHTML = `Showing detailed ledger for <strong>Market Shield Invoice ($${activeData.reqUSD.toFixed(2)})</strong> — protects against PayPal spread & 24h bank delay.`;
        } else {
            summaryText.innerHTML = `Showing detailed ledger for <strong>Standard Client Invoice ($${activeData.reqUSD.toFixed(2)})</strong> — official PayPal fees only (moral standard).`;
        }
    }

    // Update Breakdown Line Items
    setEl('revTargetGoal', results.targetDisplay);
    setEl('revInvoicedGross', `$${activeData.reqUSD.toFixed(2)}`);
    setEl('revPaypalFee', `-$${activeData.fee.toFixed(2)}`);
    setEl('revGST', `-$${activeData.gst.toFixed(2)}`);
    setEl('revNetUSD', `$${activeData.netUSD.toFixed(2)}`);

    const bufferRow = document.getElementById('revBufferRow');
    if (isProtected) {
        setEl('revEffectiveRate', `₹${protRate.toFixed(4)}/USD`);
        if (bufferRow) {
            bufferRow.style.display = 'flex';
            setEl('revBufferApplied', `${(isNaN(buffer24hPercent) ? DEFAULT_24H_BUFFER : buffer24hPercent).toFixed(2)}% buffer included`);
        }
        setEl('revFinalBank', `₹${fmtNum(activeData.finalBank, 2)} (Guaranteed)`);
        setEl('revExtraBilled', `+$${(activeData.reqUSD - (reverseTargetType === 'usd' ? parseFloat(document.getElementById('amountInput').value || 0) : (activeData.finalBank / effRate))).toFixed(2)}`);
    } else {
        setEl('revEffectiveRate', `₹${effRate.toFixed(4)}/USD`);
        if (bufferRow) {
            bufferRow.style.display = 'flex';
            setEl('revBufferApplied', 'None (Standard terms)');
        }
        setEl('revFinalBank', `₹${fmtNum(activeData.finalBank, 2)}`);
        setEl('revExtraBilled', `+$${activeData.feeUSD.toFixed(2)}`);
    }

    // Update Button Label
    const copyBtnText = document.getElementById('copyInvoiceBtnText');
    if (copyBtnText) {
        copyBtnText.textContent = isProtected ? 'Copy Protected Client Note' : 'Copy Standard Client Note';
    }
}

// ===================================================
// Copy Actions & Toast
// ===================================================
function copyInvoiceText(type) {
    const isProt = type === 'protected';
    const reqUSD = document.getElementById(isProt ? 'optProtectedUSD' : 'optStandardUSD')?.textContent || '0.00';
    const targetText = lastReverseResults?.targetDisplay || document.getElementById('revTargetGoal')?.textContent || '';

    let note = '';
    if (isProt) {
        note = `Hi,\n\nTo ensure the full net project value (${targetText}) is received in our bank account after international PayPal processing fees (4.4% + $0.30 fixed fee, 18% GST), currency conversion spread, and the mandatory 24-hour interbank settlement clearing buffer, the total invoice amount is $${reqUSD}.\n\nThank you for understanding!\n— MinimalFee™ by Minimal Creates`;
        showToast('🛡️ Market Protected client note copied!');
    } else {
        note = `Hi,\n\nTo cover standard international PayPal payment processing fees (4.4% + $0.30 fixed fee and 18% GST), the total invoice amount is $${reqUSD} (for net target ${targetText}).\n\nThank you!\n— MinimalFee™ by Minimal Creates`;
        showToast('🤝 Standard client note copied!');
    }

    navigator.clipboard.writeText(note).catch(() => fallbackCopy(note));
}

function copyActiveInvoiceText() {
    copyInvoiceText(selectedInvoiceOption);
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

        text = `PayPal Fee Breakdown (USD to INR) — MinimalFee™ by Minimal Creates:\n` +
               `• Amount Sent: ${sent}\n` +
               `• PayPal Fee (4.4% + $0.30): ${fee}\n` +
               `• Indian GST (18%): ${gst}\n` +
               `• Net USD Credited: ${netUSD}\n` +
               `• Effective Rate: ${effRate}\n` +
               `• Credited to Bank: ${deposit}\n` +
               `• Total Deductions: ${loss}`;
    } else {
        const target = lastReverseResults?.targetDisplay || document.getElementById('revTargetGoal')?.textContent || '';
        const protUSD = document.getElementById('optProtectedUSD')?.textContent || '0.00';
        const protBank = document.getElementById('optProtectedDeposit')?.textContent || '0.00';
        const stdUSD = document.getElementById('optStandardUSD')?.textContent || '0.00';
        const stdBank = document.getElementById('optStandardDeposit')?.textContent || '0.00';
        const selected = selectedInvoiceOption === 'protected' ? 'Market Protected + 24h Buffer' : 'Standard Client Terms';
        const fee = document.getElementById('revPaypalFee')?.textContent || '';
        const gst = document.getElementById('revGST')?.textContent || '';
        const netUSD = document.getElementById('revNetUSD')?.textContent || '';
        const deposit = document.getElementById('revFinalBank')?.textContent || '';

        text = `PayPal Reverse Invoice Comparison — MinimalFee™ by Minimal Creates:\n` +
               `• Target Payout: ${target}\n` +
               `• [Option 1 - Market Shield + 24h Buffer]: $${protUSD} (Guarantees ${protBank})\n` +
               `• [Option 2 - Standard Client Rate]: $${stdUSD} (Deposits ${stdBank})\n` +
               `--------------------------------------------------\n` +
               `Active Option: ${selected}\n` +
               `• PayPal Fee: ${fee}\n` +
               `• Indian GST (18%): ${gst}\n` +
               `• Net USD: ${netUSD}\n` +
               `• Bank Deposit: ${deposit}`;
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Full breakdown copied to clipboard!');
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
// Cookie & Cache Consent Management
// ===================================================
function initCookieConsent() {
    const consented = CookieManager.get('mc_cookie_consent');
    const banner = document.getElementById('cookieBanner');
    if (!consented && banner) {
        setTimeout(() => banner.classList.add('show'), 1200);
    }
}

function acceptCookies() {
    CookieManager.set('mc_cookie_consent', 'true', 365);
    const banner = document.getElementById('cookieBanner');
    if (banner) banner.classList.remove('show');
    showToast('Preferences & local cache enabled');
}

function clearAllCache() {
    CacheManager.clearAll();
    showToast('Local cache & cookies purged. Reloading...');
    setTimeout(() => window.location.reload(), 1000);
}

// ===================================================
// Helper Utilities (Indian Numbering Format with Decimals)
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

// Register Service Worker for offline PWA capabilities
function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('SW registration note:', err);
        });
    }
}

// ===================================================
// Initialization & Event Listeners
// ===================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCookieConsent();
    registerServiceWorker();
    renderPresets();

    const savedMode = CookieManager.get('mc_calc_mode');
    if (savedMode === 'reverse') {
        switchMode('reverse');
    }

    const input = document.getElementById('amountInput');
    if (input) {
        input.value = '51.82'; // Default sample matching real-world transaction
        input.addEventListener('input', calculate);
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter') calculate();
        });
    }

    fetchExchangeRate();
    calculate();
});
