# TypeForge

TypeForge opens straight into typing practice and can suggest letter pairs after ten qualifying 30-second QWERTY assessments. Timing predictions run locally, and your typing history stays in this browser. **[Try the live demo](https://typeforge-alpha.vercel.app)**

<a href="docs/screenshots/practice-desktop.png"><img src="docs/screenshots/practice-desktop.png" width="320" alt="General practice mid-run, with completed words and the next letters to type"></a> <a href="docs/screenshots/ml-lab-desktop.png"><img src="docs/screenshots/ml-lab-desktop.png" width="320" alt="ML Lab showing held-out timing errors for Ridge and the historical baseline"></a>

### How it works

```mermaid
flowchart LR
    A[Aalto keystrokes] -->|Python pipeline| M[JSON model] -->|Browser inference| F[Frozen predictions]
    F --> C[Compare]
    T[Type a sentence] --> O[Observe timing] --> C
    O --> P[Choose practice] --> T
```

**Public-data timing prediction · 30 September 2026.** Mean absolute error per typist was **61.30 ms for Ridge** vs **67.55 ms for the baseline** (151 held-out typists, 9,595 intervals). Typing gains remain unmeasured.

### Next

- Estimate expected letter-pair timing for a typist at your speed.
- Choose practice for pairs where you consistently take longer than expected.
- Test whether targeted practice helps on fresh text.

**Quick start** · With Node.js 24+ in `typing-app/client`, run `npm ci` and then `npm run dev`.<br>
[Product details](docs/product.md) · [ML experiment and reproduction](ml/README.md) · [Verification](docs/verification.md)
