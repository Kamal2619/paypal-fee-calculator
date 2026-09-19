# MinimalFee™ — by Minimal Creates

> Official PayPal Fee & Reverse Invoice Calculator for USD to INR transactions. A trademark product of **Minimal Creates**.

![Minimal Creates](assets/mc-logo.png)

## ⚡ Overview

**MinimalFee™** is a precision financial utility designed for freelancers, creators, and agencies receiving international USD payments into Indian bank accounts. It accurately calculates all deductions—including PayPal's 4.4% + $0.30 fee, 18% Indian GST, and currency conversion spreads.

---

## 🚀 Key Features

- **Official Minimal Creates™ Branding & Design System** — Sleek, modern, and distraction-free UI.
- **Dual Calculation Engine**:
  - **Forward Mode ("I Receive USD")**: Client sends `$X` → Computes exact net `₹` reaching your Indian bank account.
  - **Reverse Invoice Mode ("Invoice Client")**: Target `₹` or `$` → Computes the exact amount to bill the client so they cover 100% of the fees with zero deduction to you.
- **Smart Caching & Cookie Layer**:
  - First-party cookie manager for theme (`mc_theme`) and mode preferences (`mc_calc_mode`).
  - 6-hour TTL local exchange rate caching for instant offline performance and zero rate limiting.
- **PWA & Offline Ready** — Includes Service Worker (`sw.js`) and Web App Manifest (`manifest.json`).
- **Dark & Light Mode** — Seamless theme toggle with instant persistence.
- **One-Click Client Invoicing Note** — Pre-formatted polite note to copy and send to clients.

---

## 📐 Mathematical Formulation

### 1. Forward Mode (USD to INR)
$$\text{PayPal Fee} = (\text{Gross USD} \times 4.4\%) + \$0.30$$
$$\text{GST} = \text{PayPal Fee} \times 18\%$$
$$\text{Net USD} = \text{Gross USD} - (\text{PayPal Fee} + \text{GST})$$
$$\text{Effective Rate} = \text{Market Rate} \times (1 - 3.8\%)$$
$$\text{Net INR in Bank} = \text{Net USD} \times \text{Effective Rate}$$

### 2. Reverse Invoice Mode
$$\text{Net USD Needed} = \frac{\text{Target INR}}{\text{Effective Rate}}$$
$$\text{Required Invoice USD} = \frac{\text{Net USD Needed} + 0.354}{0.94808}$$

---

## 🔒 Legal & Trademark Notice

**MinimalFee™** is an official product developed by **Minimal Creates**.  
© 2024–2026 Minimal Creates™. All rights reserved.

---

## 🌐 Live Deployment

- **GitHub Pages:** [https://kamal2619.github.io/paypal-fee-calculator/](https://kamal2619.github.io/paypal-fee-calculator/)
- **Repository:** [https://github.com/Kamal2619/paypal-fee-calculator](https://github.com/Kamal2619/paypal-fee-calculator)
