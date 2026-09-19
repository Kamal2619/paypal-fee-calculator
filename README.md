# PayPal Fee Conversion Calculator (USD to INR)

A clean, responsive, single-page website that calculates exact PayPal fees when receiving USD payments in India.

## Features

- **Live Exchange Rate** — Fetches real-time USD/INR rate via API (with static fallback)
- **Accurate Fee Breakdown** — Includes PayPal 4.4% + $0.30 fee, 18% GST, and 3.8% FX markup
- **Indian Numbering Format** — Results displayed with proper lakh/crore formatting
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Interactive FAQ** — Accordion-style frequently asked questions
- **Customer Reviews** — Trustpilot-style testimonials section

## Formula

```
PayPal Fee = (Amount × 4.4%) + $0.30
GST = PayPal Fee × 18%
Net USD = Amount − (PayPal Fee + GST)
Effective Rate = Google Rate × (1 − 3.8%)
Final INR = Net USD × Effective Rate
```

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Google Fonts (Inter)
- Font Awesome Icons
- ExchangeRate-API for live rates

## Deployment

Deployed on Vercel. Push to `main` branch triggers automatic deployment.
