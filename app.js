/**
 * Baku Auto Empire - Phase 2 Core Engine
 */

// 1. STATE MANAGER
const GameState = {
    balance: 15000,
    incomePerDay: 0,
    reputation: 1.0,
    day: 1,
    hour: 8,
    gameSpeed: 1,
    fleet: [
        {
            id: 'car_khazar_01',
            name: 'Khazar SD 1.7',
            year: 2019,
            condition: 95,
            mileage: 42000,
            dailyRate: 35,
            status: 'AVAILABLE', // AVAILABLE, RENTED
            rentDaysRemaining: 0,
            currentRenter: null
        }
    ],
    marketCars: [],
    customerRequests: []
};

// Database Templates for Market
const CarTemplates = [
    { name: 'VAZ 2107', year: 2011, basePrice: 4500, dailyRate: 20, mileage: 130000 },
    { name: 'Tofaş Şahin 1.6', year: 2002, basePrice: 3800, dailyRate: 18, mileage: 185000 },
    { name: 'Khazar SD 1.7', year: 2020, basePrice: 8500, dailyRate: 35, mileage: 55000 },
    { name: 'Hyundai Elantra', year: 2015, basePrice: 17500, dailyRate: 60, mileage: 110000 },
    { name: 'Toyota Prius 20', year: 2008, basePrice: 12000, dailyRate: 45, mileage: 210000 },
    { name: 'Kia Optima 2.0T', year: 2014, basePrice: 19000, dailyRate: 70, mileage: 125000 }
];

const CustomerNames = ['Rəşad M.', 'Elvin K.', 'Orxan A.', 'Tural Q.', 'Cavid B.', 'Nurlan S.'];

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
                console.error("Save faylı oxunarkən xəta", e);
            }
        }
    }
};

// 3. RENTAL & MARKET SYSTEM
const FleetManager = {
    generateMarket() {
        GameState.marketCars = [];
        for (let i = 0; i < 4; i++) {
            const tpl = CarTemplates[Math.floor(Math.random() * CarTemplates.length)];
            const variation = Math.floor(Math.random() * 1000) - 500;
            GameState.marketCars.push({
                id: 'm_car_' + Date.now() + '_' + i,
                name: tpl.name,
                year: tpl.year,
                price: tpl.basePrice + variation,
                dailyRate: tpl.dailyRate,
                condition: Math.floor(Math.random() * 20) + 80,
                mileage: tpl.mileage + Math.floor(Math.random() * 10000)
            });
        }
        UIController.renderMarket();
    },

    buyCar(marketCarId) {
        const car = GameState.marketCars.find(c => c.id === marketCarId);
        if (!car) return;

        if (EconomyEngine.deductFunds(car.price, `${car.name} alışı`)) {
            GameState.fleet.push({
                id: 'car_' + Date.now(),
                name: car.name,
                year: car.year,
                condition: car.condition,
                mileage: car.mileage,
                dailyRate: car.dailyRate,
                status: 'AVAILABLE',
                rentDaysRemaining: 0,
                currentRenter: null
            });

            GameState.marketCars = GameState.marketCars.filter(c => c.id !== marketCarId);
            UIController.renderGarage();
            UIController.renderMarket();
            UIController.updateStats();
            this.generateCustomerRequests();
        }
    },

    generateCustomerRequests() {
        GameState.customerRequests = [];
        const availableCars = GameState.fleet.filter(c => c.status === 'AVAILABLE');

        availableCars.forEach(car => {
            if (Math.random() > 0.3) {
                const renterName = CustomerNames[Math.floor(Math.random() * CustomerNames.length)];
                const duration = Math.floor(Math.random() * 5) + 2; // 2-7 gün
                GameState.customerRequests.push({
                    id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    carId: car.id,
                    carName: car.name,
                    renterName: renterName,
                    duration: duration,
                    offeredRate: car.dailyRate
                });
            }
        });
        UIController.renderCustomerRequests();
    },

    acceptRentalRequest(reqId) {
        const req = GameState.customerRequests.find(r => r.id === reqId);
        if (!req) return;

        const car = GameState.fleet.find(c => c.id === req.carId);
        if (car && car.status === 'AVAILABLE') {
            car.status = 'RENTED';
            car.rentDaysRemaining = req.duration;
            car.currentRenter = req.renterName;

            GameState.customerRequests = GameState.customerRequests.filter(r => r.id !== reqId);
            
            UIController.showToast(`🤝 ${car.name} ${req.duration} günlük ${req.renterName} şəxsə icarəyə verildi!`);
            this.recalculateDailyIncome();
            UIController.renderGarage();
            UIController.renderCustomerRequests();
        }
    },

    recalculateDailyIncome() {
        let total = 0;
        GameState.fleet.forEach(car => {
            if (car.status === 'RENTED') {
                total += car.dailyRate;
            }
        });
        GameState.incomePerDay = total;
        UIController.updateStats();
    }
};

// 4. TIME ENGINE
const TimeEngine = {
    init() {
        this.startLoop();
    },

    startLoop() {
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        
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

        // Calculate Daily Rental Payments
        let dailyProfit = 0;
        GameState.fleet.forEach(car => {
            if (car.status === 'RENTED') {
                dailyProfit += car.dailyRate;
                car.rentDaysRemaining--;
                car.mileage += Math.floor(Math.random() * 80) + 40; // Gündəlik sürüş

                if (car.rentDaysRemaining <= 0) {
                    car.status = 'AVAILABLE';
                    car.currentRenter = null;
                    UIController.showToast(`🔑 ${car.name} müqaviləsi bitti, qaraja qaytarıldı.`);
                }
            }
        });

        if (dailyProfit > 0) {
            EconomyEngine.addFunds(dailyProfit, "Gündəlik İcarə Gəlirləri");
        }

        FleetManager.recalculateDailyIncome();
        FleetManager.generateCustomerRequests();
        UIController.renderGarage();
        EconomyEngine.saveGame();
    }
};

// 5. UI CONTROLLER
const UIController = {
    init() {
        this.bindEvents();
        this.updateStats();
        this.updateTimeDisplay();
        this.updateSpeedButtons();
        this.renderGarage();
    },

    bindEvents() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseInt(e.target.dataset.speed);
                TimeEngine.setSpeed(speed);
            });
        });

        document.getElementById('btn-quick-save').addEventListener('click', () => {
            EconomyEngine.saveGame();
            UIController.showToast("💾 Oyun uğurla yadda saxlanıldı!");
        });

        document.getElementById('btn-refresh-market').addEventListener('click', () => {
            FleetManager.generateMarket();
            UIController.showToast("🔄 Bazar avtomobilləri yeniləndi.");
        });

        // Tab Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const targetTab = e.target.dataset.tab;
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.style.display = 'none';
                    pane.classList.remove('active');
                });

                const activePane = document.getElementById(`${targetTab}-tab`);
                if (activePane) {
                    activePane.style.display = 'block';
                    activePane.classList.add('active');
                }
            });
        });
    },

    renderGarage() {
        const list = document.getElementById('garage-car-list');
        list.innerHTML = '';

        GameState.fleet.forEach(car => {
            const isRented = car.status === 'RENTED';
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-badge ${isRented ? 'badge-rented' : ''}">
                    ${isRented ? `İcarədə (${car.rentDaysRemaining} gün qaldı)` : 'Qarajda (Sərbəst)'}
                </div>
                <div class="car-image-placeholder">🚗 ${car.name} (${car.year})</div>
                <div class="car-details">
                    <h3>${car.name}</h3>
                    <div class="car-metrics">
                        <span>Vəziyyət: <b class="good">${car.condition}%</b></span>
                        <span>Gediş: <b>${car.mileage.toLocaleString()} km</b></span>
                    </div>
                    <div class="car-price-tag">
                        <span>Günlük İcarə:</span>
                        <strong>${car.dailyRate} AZN / gün</strong>
                    </div>
                    ${isRented ? `<p style="font-size:12px; color:#38bdf8; margin-top:6px;">Müştəri: <b>${car.currentRenter}</b></p>` : ''}
                </div>
            `;
            list.appendChild(card);
        });
    },

    renderMarket() {
        const list = document.getElementById('market-car-list');
        list.innerHTML = '';

        if (GameState.marketCars.length === 0) {
            list.innerHTML = '<p style="color:#94a3b8;">Bazar boşdur. Yeniləmək üçün yuxarıdakı düyməyə basın.</p>';
            return;
        }

        GameState.marketCars.forEach(car => {
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-image-placeholder">🏪 ${car.name} (${car.year})</div>
                <div class="car-details">
                    <h3>${car.name}</h3>
                    <div class="car-metrics">
                        <span>Vəziyyət: <b>${car.condition}%</b></span>
                        <span>Gediş: <b>${car.mileage.toLocaleString()} km</b></span>
                    </div>
                    <div class="car-price-tag">
                        <span>Qiymət:</span>
                        <strong>${car.price.toLocaleString()} AZN</strong>
                    </div>
                    <button class="btn btn-buy" onclick="FleetManager.buyCar('${car.id}')">Alın (${car.price} AZN)</button>
                </div>
            `;
            list.appendChild(card);
        });
    },

    renderCustomerRequests() {
        const list = document.getElementById('customer-requests-list');
        list.innerHTML = '';

        if (GameState.customerRequests.length === 0) {
            list.innerHTML = '<p style="color:#94a3b8;">Hazırda yeni icarə müraciəti yoxdur. Növbəti günü gözləyin.</p>';
            return;
        }

        GameState.customerRequests.forEach(req => {
            const card = document.createElement('div');
            card.className = 'customer-card';
            card.innerHTML = `
                <div class="customer-info">
                    <h4>👤 ${req.renterName}</h4>
                    <p>Avtomobil: <b>${req.carName}</b></p>
                    <p>Müddət: <b>${req.duration} Günlük</b></p>
                </div>
                <div class="customer-offer">
                    <span class="offer-badge">+${req.offeredRate * req.duration} AZN Toplam</span>
                    <button class="btn-rent" onclick="FleetManager.acceptRentalRequest('${req.id}')">İcarəyə Ver (${req.offeredRate} AZN/gün)</button>
                </div>
            `;
            list.appendChild(card);
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

// 6. INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    EconomyEngine.loadGame();
    UIController.init();
    TimeEngine.init();
    FleetManager.generateMarket();
    FleetManager.generateCustomerRequests();
    FleetManager.recalculateDailyIncome();
});

/**
 * Baku Auto Empire - Phase 3 Core Engine
 */

// 1. STATE MANAGER
const GameState = {
    balance: 15000,
    incomePerDay: 0,
    reputation: 1.0,
    day: 1,
    hour: 8,
    gameSpeed: 1,
    selectedCarForService: null,
    fleet: [
        {
            id: 'car_khazar_01',
            name: 'Khazar SD 1.7',
            year: 2019,
            condition: 85,
            mileage: 42000,
            dailyRate: 35,
            status: 'AVAILABLE', // AVAILABLE, RENTED, IN_SERVICE
            rentDaysRemaining: 0,
            currentRenter: null
        }
    ],
    marketCars: [],
    customerRequests: []
};

// Database Templates for Market
const CarTemplates = [
    { name: 'VAZ 2107', year: 2011, basePrice: 4500, dailyRate: 20, mileage: 130000 },
    { name: 'Tofaş Şahin 1.6', year: 2002, basePrice: 3800, dailyRate: 18, mileage: 185000 },
    { name: 'Khazar SD 1.7', year: 2020, basePrice: 8500, dailyRate: 35, mileage: 55000 },
    { name: 'Hyundai Elantra', year: 2015, basePrice: 17500, dailyRate: 60, mileage: 110000 },
    { name: 'Toyota Prius 20', year: 2008, basePrice: 12000, dailyRate: 45, mileage: 210000 },
    { name: 'Kia Optima 2.0T', year: 2014, basePrice: 19000, dailyRate: 70, mileage: 125000 }
];

const CustomerNames = ['Rəşad M.', 'Elvin K.', 'Orxan A.', 'Tural Q.', 'Cavid B.', 'Nurlan S.'];

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
                console.error("Save faylı oxunarkən xəta", e);
            }
        }
    }
};

// 3. FLEET & SERVICE MANAGER
const FleetManager = {
    generateMarket() {
        GameState.marketCars = [];
        for (let i = 0; i < 4; i++) {
            const tpl = CarTemplates[Math.floor(Math.random() * CarTemplates.length)];
            const variation = Math.floor(Math.random() * 1000) - 500;
            GameState.marketCars.push({
                id: 'm_car_' + Date.now() + '_' + i,
                name: tpl.name,
                year: tpl.year,
                price: tpl.basePrice + variation,
                dailyRate: tpl.dailyRate,
                condition: Math.floor(Math.random() * 25) + 65,
                mileage: tpl.mileage + Math.floor(Math.random() * 10000)
            });
        }
        UIController.renderMarket();
    },

    buyCar(marketCarId) {
        const car = GameState.marketCars.find(c => c.id === marketCarId);
        if (!car) return;

        if (EconomyEngine.deductFunds(car.price, `${car.name} alışı`)) {
            GameState.fleet.push({
                id: 'car_' + Date.now(),
                name: car.name,
                year: car.year,
                condition: car.condition,
                mileage: car.mileage,
                dailyRate: car.dailyRate,
                status: 'AVAILABLE',
                rentDaysRemaining: 0,
                currentRenter: null
            });

            GameState.marketCars = GameState.marketCars.filter(c => c.id !== marketCarId);
            UIController.renderGarage();
            UIController.renderMarket();
            UIController.updateStats();
            this.generateCustomerRequests();
        }
    },

    generateCustomerRequests() {
        GameState.customerRequests = [];
        const availableCars = GameState.fleet.filter(c => c.status === 'AVAILABLE');

        availableCars.forEach(car => {
            // Vəziyyəti pis olan maşınlara az təklif gəlir
            const chance = car.condition > 60 ? 0.4 : 0.8;
            if (Math.random() > chance) {
                const renterName = CustomerNames[Math.floor(Math.random() * CustomerNames.length)];
                const duration = Math.floor(Math.random() * 5) + 2;
                GameState.customerRequests.push({
                    id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    carId: car.id,
                    carName: car.name,
                    renterName: renterName,
                    duration: duration,
                    offeredRate: car.dailyRate
                });
            }
        });
        UIController.renderCustomerRequests();
    },

    acceptRentalRequest(reqId) {
        const req = GameState.customerRequests.find(r => r.id === reqId);
        if (!req) return;

        const car = GameState.fleet.find(c => c.id === req.carId);
        if (car && car.status === 'AVAILABLE') {
            car.status = 'RENTED';
            car.rentDaysRemaining = req.duration;
            car.currentRenter = req.renterName;

            GameState.customerRequests = GameState.customerRequests.filter(r => r.id !== reqId);
            
            UIController.showToast(`🤝 ${car.name} ${req.duration} günlük ${req.renterName} şəxsə icarəyə verildi!`);
            this.recalculateDailyIncome();
            UIController.renderGarage();
            UIController.renderCustomerRequests();
        }
    },

    openServiceModal(carId) {
        const car = GameState.fleet.find(c => c.id === carId);
        if (!car) return;
        if (car.status === 'RENTED') {
            UIController.showToast("⚠️ İcarədə olan avtomobili servisə göndərmək olmaz!");
            return;
        }
        GameState.selectedCarForService = car;
        document.getElementById('modal-car-title').innerText = `🔧 ${car.name} Servis Xidmətləri`;
        document.getElementById('service-modal').style.display = 'flex';
    },

    closeServiceModal() {
        document.getElementById('service-modal').style.display = 'none';
        GameState.selectedCarForService = null;
    },

    applyService(type) {
        const car = GameState.selectedCarForService;
        if (!car) return;

        let cost = 0;
        let recovery = 0;

        if (type === 'BASIC') {
            cost = 120;
            recovery = 15;
        } else if (type === 'MAJOR') {
            cost = 450;
            recovery = 40;
        } else if (type === 'FULL') {
            cost = 800;
            recovery = 100;
        }

        if (EconomyEngine.deductFunds(cost, `${car.name} Təmiri`)) {
            if (type === 'FULL') {
                car.condition = 100;
                car.dailyRate += 5; // Detailing sonrası qiymət artımı
            } else {
                car.condition = Math.min(100, car.condition + recovery);
            }

            UIController.showToast(`🔧 ${car.name} uğurla təmir olundu! Yeni vəziyyət: ${car.condition}%`);
            this.closeServiceModal();
            UIController.renderGarage();
        }
    },

    recalculateDailyIncome() {
        let total = 0;
        GameState.fleet.forEach(car => {
            if (car.status === 'RENTED') {
                total += car.dailyRate;
            }
        });
        GameState.incomePerDay = total;
        UIController.updateStats();
    }
};

// 4. TIME ENGINE & RANDOM INCIDENTS
const TimeEngine = {
    init() {
        this.startLoop();
    },

    startLoop() {
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        
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

        let dailyProfit = 0;
        GameState.fleet.forEach(car => {
            if (car.status === 'RENTED') {
                dailyProfit += car.dailyRate;
                car.rentDaysRemaining--;
                
                // Wear & Tear (Gündəlik aşınma)
                const wearAmount = Math.floor(Math.random() * 4) + 2; // 2-5% arası aşınma
                car.condition = Math.max(0, car.condition - wearAmount);
                car.mileage += Math.floor(Math.random() * 80) + 40;

                // Random Breakdowns (Qəfil nasazlıq riski)
                if (car.condition < 40 && Math.random() < 0.25) {
                    UIController.showToast(`🚨 ${car.name} maşınında texniki nasazlıq baş verdi! Müştəri servise müraciət etdi.`);
                    EconomyEngine.deductFunds(150, "Təcili Usta Xərci");
                }

                if (car.rentDaysRemaining <= 0) {
                    car.status = 'AVAILABLE';
                    car.currentRenter = null;
                    UIController.showToast(`🔑 ${car.name} müqaviləsi bitti, qaraja qaytarıldı.`);
                }
            }
        });

        if (dailyProfit > 0) {
            EconomyEngine.addFunds(dailyProfit, "Gündəlik İcarə Gəlirləri");
        }

        FleetManager.recalculateDailyIncome();
        FleetManager.generateCustomerRequests();
        UIController.renderGarage();
        EconomyEngine.saveGame();
    }
};

// 5. UI CONTROLLER
const UIController = {
    init() {
        this.bindEvents();
        this.updateStats();
        this.updateTimeDisplay();
        this.updateSpeedButtons();
        this.renderGarage();
    },

    bindEvents() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseInt(e.target.dataset.speed);
                TimeEngine.setSpeed(speed);
            });
        });

        document.getElementById('btn-quick-save').addEventListener('click', () => {
            EconomyEngine.saveGame();
            UIController.showToast("💾 Oyun uğurla yadda saxlanıldı!");
        });

        document.getElementById('btn-refresh-market').addEventListener('click', () => {
            FleetManager.generateMarket();
            UIController.showToast("🔄 Bazar avtomobilləri yeniləndi.");
        });

        document.getElementById('btn-close-modal').addEventListener('click', () => {
            FleetManager.closeServiceModal();
        });

        // Tab Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const targetTab = e.target.dataset.tab;
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.style.display = 'none';
                    pane.classList.remove('active');
                });

                const activePane = document.getElementById(`${targetTab}-tab`);
                if (activePane) {
                    activePane.style.display = 'block';
                    activePane.classList.add('active');
                }
            });
        });
    },

    renderGarage() {
        const list = document.getElementById('garage-car-list');
        list.innerHTML = '';

        GameState.fleet.forEach(car => {
            const isRented = car.status === 'RENTED';
            const conditionClass = car.condition > 70 ? 'good' : (car.condition > 40 ? '' : 'bad');
            
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-badge ${isRented ? 'badge-rented' : ''}">
                    ${isRented ? `İcarədə (${car.rentDaysRemaining} gün)` : 'Qarajda (Sərbəst)'}
                </div>
                <div class="car-image-placeholder">🚗 ${car.name} (${car.year})</div>
                <div class="car-details">
                    <h3>${car.name}</h3>
                    <div class="car-metrics">
                        <span>Vəziyyət: <b class="${conditionClass}">${car.condition}%</b></span>
                        <span>Gediş: <b>${car.mileage.toLocaleString()} km</b></span>
                    </div>
                    <div class="car-price-tag">
                        <span>Günlük İcarə:</span>
                        <strong>${car.dailyRate} AZN / gün</strong>
                    </div>
                    ${isRented ? `<p style="font-size:12px; color:#38bdf8; margin-top:4px;">Müştəri: <b>${car.currentRenter}</b></p>` : ''}
                    ${!isRented ? `<button class="btn btn-service" onclick="FleetManager.openServiceModal('${car.id}')">🔧 Servis & Təmir</button>` : ''}
                </div>
            `;
            list.appendChild(card);
        });
    },

    renderMarket() {
        const list = document.getElementById('market-car-list');
        list.innerHTML = '';

        if (GameState.marketCars.length === 0) {
            list.innerHTML = '<p style="color:#94a3b8;">Bazar boşdur. Yeniləmək üçün yuxarıdakı düyməyə basın.</p>';
            return;
        }

        GameState.marketCars.forEach(car => {
            const card = document.createElement('div');
            card.className = 'car-card';
            card.innerHTML = `
                <div class="car-image-placeholder">🏪 ${car.name} (${car.year})</div>
                <div class="car-details">
                    <h3>${car.name}</h3>
                    <div class="car-metrics">
                        <span>Vəziyyət: <b>${car.condition}%</b></span>
                        <span>Gediş: <b>${car.mileage.toLocaleString()} km</b></span>
                    </div>
                    <div class="car-price-tag">
                        <span>Qiymət:</span>
                        <strong>${car.price.toLocaleString()} AZN</strong>
                    </div>
                    <button class="btn btn-buy" onclick="FleetManager.buyCar('${car.id}')">Alın (${car.price} AZN)</button>
                </div>
            `;
            list.appendChild(card);
        });
    },

    renderCustomerRequests() {
        const list = document.getElementById('customer-requests-list');
        list.innerHTML = '';

        if (GameState.customerRequests.length === 0) {
            list.innerHTML = '<p style="color:#94a3b8;">Hazırda yeni icarə müraciəti yoxdur. Növbəti günü gözləyin.</p>';
            return;
        }

        GameState.customerRequests.forEach(req => {
            const card = document.createElement('div');
            card.className = 'customer-card';
            card.innerHTML = `
                <div class="customer-info">
                    <h4>👤 ${req.renterName}</h4>
                    <p>Avtomobil: <b>${req.carName}</b></p>
                    <p>Müddət: <b>${req.duration} Günlük</b></p>
                </div>
                <div class="customer-offer">
                    <span class="offer-badge">+${req.offeredRate * req.duration} AZN Toplam</span>
                    <button class="btn-rent" onclick="FleetManager.acceptRentalRequest('${req.id}')">İcarəyə Ver (${req.offeredRate} AZN/gün)</button>
                </div>
            `;
            list.appendChild(card);
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

// 6. INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    EconomyEngine.loadGame();
    UIController.init();
    TimeEngine.init();
    FleetManager.generateMarket();
    FleetManager.generateCustomerRequests();
    FleetManager.recalculateDailyIncome();
});
