# ClipForge Desktop - Windows .exe Build Guide

Yeh guide aapko ClipForge ko aapke Windows PC par standalone `.exe` file me convert karne aur run karne ka step-by-step tareeqa batati hai.

---

### Step 1: Code Ko PC Par Download Karein
1. AI Studio Build se code ko download ya zip export karein, ya git repository clone karein.
2. Apne PC par folder extract karein (e.g. `C:\ClipForge`).

---

### Step 2: Node.js Check Karein
Aapke PC par Node.js install hona zaroori hai (LTS version 18 ya 20+):
- Agar install nahi hai to https://nodejs.org se download karein.
- Terminal (PowerShell / Command Prompt) me check karein:
  ```bash
  node -v
  npm -v
  ```

---

### Step 3: Dependencies Install Karein
ClipForge folder me PowerShell / Command Prompt kholein aur yeh command chalayein:
```bash
npm install --legacy-peer-deps
npm install --save-dev electron electron-builder --legacy-peer-deps
```
*(Note: `--legacy-peer-deps` flag lagane se npm version clash resolve ho jata hai).*

---

### Step 4: Direct Desktop Window me Test Karna (Development Mode)
Agar aap pehle test karna chahte hain bina wait kiye:
```bash
npm run electron:dev
```
Is se ClipForge seedha aapke PC par desktop window me open ho jayegi!

---

### Step 5: Standalone `.exe` File Banana (Packaging)
Ab app ko final single-click `.exe` me convert karne ke liye:
```bash
npm run build:exe
```

Yeh process:
1. React aur Vite frontend ko build karega.
2. Electron binaries ko pack karega.
3. Aapke project me **`release/`** folder create karega jisme aapko milegi:
   - **`ClipForge.exe`** (Portable executable - double click to run anywhere!)
   - **`ClipForge-Setup-1.0.0.exe`** (Windows 1-click installer)

---

### Step 6: App Run Karein aur Test Karein
1. `release/` folder kholein.
2. `ClipForge.exe` par double-click karein.
3. Settings me ja kar:
   - **Gemini API ON**: Google AI Studio key paste karein aur "Test Connection" dabayein (High-speed cloud AI hooks).
   - **Failover Guarantee**: Agar quota khatam ho ya internet band ho, app auto-failover ke zariye bina ruke offline Local Whisper model par shift ho jayegi!
