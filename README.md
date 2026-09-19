# MinimalFee™ — by Minimal Creates

> **Precision PayPal USD ⇄ INR Fee & Zero-Loss Reverse Invoicing Engine**  
> An official utility product developed by **Minimal Creates**.

![Minimal Creates](assets/mc-logo.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub%20Pages-success)](https://kamal2619.github.io/paypal-fee-calculator/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-blueviolet)](manifest.json)
[![Author](https://img.shields.io/badge/Author-Minimal%20Creates-black)](https://github.com/Kamal2619)

---

## ⚡ The Real-World Problem for Indian Freelancers

Indian freelancers, developers, and creative agencies face four compounding layers of deductions whenever receiving international payments through PayPal:

1. **Official Merchant Fee:** 4.40% + $0.30 USD per transaction.
2. **Indian GST:** 18.00% tax levied directly on PayPal's processing fees.
3. **Hidden Retail FX Margin:** PayPal applies an internal conversion spread of **3.5% to 4.0%** below Google/Interbank mid-market exchange rates.
4. **Mandatory 24-Hour Auto-Withdrawal Volatility (RBI Regulations):** Under Reserve Bank of India rules, PayPal cannot hold foreign currency balances for Indian account holders. Received USD is held for up to **24 hours on weekdays** (or **48–72 hours over weekends and bank holidays**) before being automatically converted and swept to a linked Indian bank account. The conversion rate applied is determined at the exact timestamp of auto-withdrawal—leaving freelancers exposed to overnight currency drops.

**MinimalFee™** was engineered to solve these pain points with mathematical precision and full financial transparency.

---

## 🚀 Key Features

### 1. Dual Invoicing Architecture ("Invoice Client" Mode)
When invoicing clients, MinimalFee™ offers two distinct strategies side-by-side:

* **Option 1: 🛡️ Market Parity + 24h Buffer ("Guaranteed Zero-Loss")**
  * **Objective:** Completely absorbs PayPal's retail currency markdown AND adds an overnight volatility buffer to protect against exchange rate drops during the 24-hour bank holding period.
  * **Guarantee:** Guarantees that **100% of the true global market value** reaches the freelancer's Indian bank account.
  * **Client Note:** 1-click tailored message explaining international bank settlement clearance.

* **Option 2: 🤝 Standard Client Terms ("Fair / Moral Rate")**
  * **Objective:** Keeps PayPal's standard conversion rate intact ("holding morality and not asking more").
  * **Guarantee:** Passes only PayPal's published transaction fee (4.4% + $0.30) and 18% Indian GST to the client.
  * **Client Note:** 1-click clean invoice note for standard client billing.

---

### 2. Data-Backed 24h Volatility Buffer (0.85% Moral Default)
Based on 5-year historical analysis of USD/INR day-to-day volatility under the RBI's managed float regime:
* **Normal Trading Days (1σ):** Daily percentage change is constrained to **0.08%–0.20%**.
* **Elevated Volatility (2σ):** Daily percentage change remains under **0.55%** across 95% of days.
* **Tail Stress Events (3σ):** Swings hit **0.70%–0.85%** (rarely exceeding 0.90% on a single day).
* **PayPal Batch Rate Lag:** PayPal updates its internal retail ledger in periodic batches, adding an extra **~0.15%–0.20% slippage risk**.

#### Recommended Setting Presets:
* `0.50% (Calm)`: For quiet, low-volatility weekday markets.
* `0.85% (Moral)`: **Recommended Default.** Exactly covers the 99th percentile of 24h weekday moves + PayPal slippage without overcharging clients.
* `1.25% (Weekend/Holiday)`: Recommended for Friday payments with 48h–72h multi-day bank holiday holding.

---

### 3. Intelligent Median Spread Engine
* If an exact PayPal spread is unknown and the user leaves the field empty, MinimalFee™ automatically assigns **3.80%** (the established industry median of PayPal's 3.0% to 4.5% retail margin band).
* Users can input an exact effective rate from past PayPal statements (`e.g. ₹92.4527`), and the implied margin will automatically back-calculate.

---

### 4. Dual Calculation Modes
* **Forward Mode ("I Receive USD"):** Input gross USD sent by client → Generates complete ledger showing PayPal fee, GST, applied conversion rate, net INR deposited, and total fee loss percentage.
* **Reverse Mode ("Invoice Client"):** Input target INR or target USD → Computes exact dollar amount to bill under both Protected and Standard options.

---

### 5. High-Performance Client & Cache Architecture
* **Live Interbank Sync:** Fetches real-time market rates via open currency APIs with fallback redundancy.
* **Local Rate Cache (4h TTL):** Stores rates in `localStorage` and first-party cookies for instant offline calculation and zero rate-limiting.
* **Progressive Web App (PWA):** Equipped with Service Worker (`sw.js`) and manifest (`manifest.json`) for standalone installation on mobile and desktop.
* **Fluid Design System:** Custom CSS design system with dynamic dark/light theme persistence.

---

## 📐 Mathematical Formulations

### 1. Fee Constants & Factors
$$\text{PayPal Fee Rate} = 4.40\% \quad (0.044)$$
$$\text{PayPal Fixed Fee} = \$0.30 \text{ USD}$$
$$\text{Indian GST} = 18.00\% \quad (0.18)$$
$$\text{Fixed Deduction} = \$0.30 \times (1 + 0.18) = \$0.354$$
$$\text{Net Retention Factor} = 1 - (0.044 \times 1.18) = 0.94808$$

---

### 2. Forward Mode (USD to INR Bank Deposit)
$$\text{PayPal Fee} = \text{round}_2(\text{Gross USD} \times 0.044 + 0.30)$$
$$\text{GST} = \text{round}_2(\text{PayPal Fee} \times 0.18)$$
$$\text{Net USD} = \text{Gross USD} - (\text{PayPal Fee} + \text{GST})$$
$$\text{Effective Rate} = \text{Market Rate} \times \left(1 - \frac{\text{Spread \%}}{100}\right)$$
$$\text{Bank Deposit (₹)} = \text{round}_2(\text{Net USD} \times \text{Effective Rate})$$

---

### 3. Reverse Mode (Dual Invoice Options)

#### Option 2: Standard Client Terms (Moral Baseline)
$$\text{Net USD Needed} = \frac{\text{Target INR}}{\text{Effective Rate}}$$
$$\text{Standard Invoice USD} = \text{round}_2\left(\frac{\text{Net USD Needed} + \$0.354}{0.94808}\right)$$

#### Option 1: Market Protected + 24h Volatility Buffer
$$\text{Protected Rate} = \text{Effective Rate} \times \left(1 - \frac{\text{Buffer \%}}{100}\right)$$
* **When Target is INR:**
  $$\text{Protected Net USD Needed} = \frac{\text{Target INR}}{\text{Protected Rate}}$$
* **When Target is USD ($amt):**
  $$\text{Market Rupee Value} = amt \times \text{Market Rate}$$
  $$\text{Protected Net USD Needed} = \frac{\text{Market Rupee Value}}{\text{Protected Rate}}$$

$$\text{Protected Invoice USD} = \text{round}_2\left(\frac{\text{Protected Net USD Needed} + \$0.354}{0.94808}\right)$$

> **Why the math favors the freelancer:**  
> Dividing by $(\text{Rate} - \text{Buffer})$ increases the invoiced dollar amount. The client covers the risk upfront. If the rate dips overnight, you still receive your full rupee target. If the rate stays flat or rises, the surplus is deposited into your bank account.

---

## 🛠️ Project Structure

```
├── assets/
│   ├── mc-icon.png        # Minimal Creates official icon & favicon
│   └── mc-logo.png        # Minimal Creates official brand banner
├── index.html             # App markup with dual invoice comparison cards
├── style.css              # Responsive, fluid design system (Dark & Light)
├── script.js              # High-precision financial calculation engine
├── sw.js                  # Service worker for offline PWA functionality
├── manifest.json          # Web application manifest
├── vercel.json            # Vercel deployment configuration
└── README.md              # Project documentation
```

---

## 💻 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Kamal2619/paypal-fee-calculator.git
   cd paypal-fee-calculator
   ```

2. Run with any local HTTP server:
   ```bash
   # Python 3
   python -m http.server 8080

   # Node (npx)
   npx serve .
   ```

3. Open `http://localhost:8080` in your browser.

---

## 🌐 Live Deployments

* **GitHub Pages:** [https://kamal2619.github.io/paypal-fee-calculator/](https://kamal2619.github.io/paypal-fee-calculator/)
* **Vercel:** Production-configured via [`vercel.json`](vercel.json).

---

## 🔒 Trademark & Legal Notice

**MinimalFee™** is an official utility product developed by **Minimal Creates**.  
© 2024–2026 Minimal Creates™. All rights reserved.
