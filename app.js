/**
 * Baku Auto Empire - Phase 1 Core Engine
 */

// 1. STATE MANAGER (Mərkəzi Məlumat Deposu)
const GameState = {
    balance: 15000,
    incomePerDay: 0,
    reputation: 1.0,
    day: 1,
    hour: 8,
    gameSpeed: 1, // 0 = Pause, 1 = Normal, 2 = Fast, 4 = Ultra Fast
    fleet: [
        {
            id: 'car_khazar_01',
            name: 'Khazar SD 1.7 Benzın',
            year: 2019,
            condition: 95,
            mileage: 42000,
            dailyRate: 35,
            status: 'AVAILABLE' // AVAILABLE, RENTED, SERVICE
        }
    ]
};

// Timer Reference
let gameLoopInterval = null;

// 2. ECONOMY ENGINE
const EconomyEngine = {
    addFunds(amount, reason = "Gəlir") {
        GameState.balance += amount;
        UIController.updateStats();
        UIController.showToast(`+${amount} AZN: ${reason}`);
        this.saveGame();
    },

    deductFunds(amount, reason = "Xərc") {
        if (GameState.balance >= amount) {
            GameState.balance -= amount;
            UIController.updateStats();
            UIController.showToast(`-${amount} AZN: ${reason}`);
            this.saveGame();
            return true;
        } else {
            UIController.showToast(`⚠️ Kafi qədər vəsait yoxdur! (${reason})`);
            return false;
        }
    },

    saveGame() {
        localStorage.setItem('BakuAutoEmpire_Save', JSON.stringify(GameState));
    },

    loadGame() {
        const savedData = localStorage.getItem('BakuAutoEmpire_Save');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                Object.assign(GameState, parsed);
                UIController.showToast("💾 Yadda saxlanılmış proqress yükləndi.");
            } catch (e) {
                console.error("Save faylı oxunarkən xəta yarandı", e);
            }
        }
    }
};

// 3. TIME ENGINE
const TimeEngine = {
    init() {
        this.startLoop();
    },

    startLoop() {
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        
        // 1 oyun saatı = (1000ms / speed)
        if (GameState.gameSpeed > 0) {
            const intervalTime = 1200 / GameState.gameSpeed;
            gameLoopInterval = setInterval(() => {
                this.tickHour();
            }, intervalTime);
        }
    },

    setSpeed(speed) {
        GameState.gameSpeed = speed;
        UIController.updateSpeedButtons();
        this.startLoop();
    },

    tickHour() {
        GameState.hour++;
        if (GameState.hour >= 24) {
            GameState.hour = 0;
            GameState.day++;
            this.onDayEnd();
        }
        UIController.updateTimeDisplay();
    },

    onDayEnd() {
        UIController.showToast(`🌅 Gün ${GameState.day} başladı!`);
        // Daily Calculations (Gələcək Phase-lərdə genişlənəcək)
        EconomyEngine.saveGame();
    }
};

// 4. UI CONTROLLER
const UIController = {
    init() {
        this.bindEvents();
        this.updateStats();
        this.updateTimeDisplay();
        this.updateSpeedButtons();
    },

    bindEvents() {
        // Speed Control Buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseInt(e.target.dataset.speed);
                TimeEngine.setSpeed(speed);
            });
        });

        // Quick Save Button
        document.getElementById('btn-quick-save').addEventListener('click', () => {
            EconomyEngine.saveGame();
            UIController.showToast("💾 Oyun uğurla yadda saxlanıldı!");
        });

        // Navigation Tabs (Future expansion)
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const tab = e.target.dataset.tab;
                if (tab !== 'garage') {
                    UIController.showToast(`📌 ${e.target.innerText} bölməsi növbəti fazalarda açılacaq.`);
                }
            });
        });
    },

    updateStats() {
        document.getElementById('balance-display').innerText = `${GameState.balance.toLocaleString()} AZN`;
        document.getElementById('income-display').innerText = `+${GameState.incomePerDay} AZN/gün`;
        document.getElementById('reputation-display').innerText = `⭐ ${GameState.reputation.toFixed(1)}`;
        document.getElementById('fleet-count').innerText = GameState.fleet.length;
    },

    updateTimeDisplay() {
        document.getElementById('day-display').innerText = `Gün ${GameState.day}`;
        const hourFormatted = GameState.hour < 10 ? `0${GameState.hour}:00` : `${GameState.hour}:00`;
        document.getElementById('clock-display').innerText = hourFormatted;
    },

    updateSpeedButtons() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            const speed = parseInt(btn.dataset.speed);
            if (speed === GameState.gameSpeed) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
};

// 5. APPLICATION INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    EconomyEngine.loadGame();
    UIController.init();
    TimeEngine.init();
});
