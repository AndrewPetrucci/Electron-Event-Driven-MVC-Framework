class SpinWheel {
    constructor(canvasId, options = []) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.options = options;
        this.rotation = 0;
        this.isSpinning = false;
        this.spinVelocity = 0;
        this.friction = 0.985;

        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = Math.min(this.centerX, this.centerY) - 2;

        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
        ];

        // Auto-spin configuration (in milliseconds: 30000 = 30 seconds)
        this.autoSpinInterval = 30000;
        this.autoSpinTimer = null;

        this.setupEventListeners();
        this.draw();
    }

    setupEventListeners() {
        const spinButton = document.getElementById('spinButton');
        if (spinButton) {
            spinButton.addEventListener('click', () => this.spin());
        }

        // Enable mouse events when hovering over interactive elements
        const interactiveElements = document.querySelectorAll('.interactive-overlay-element');
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                if (window.electron) {
                    window.electron.mouseOverInteractive(true);
                }
            });

            element.addEventListener('mouseleave', () => {
                if (window.electron) {
                    window.electron.mouseOverInteractive(false);
                }
            });
        });

        // Listen for Twitch triggers if available
        if (window.electron) {
            window.electron.onSpinResult((result) => {
                this.updateResult(result);
            });
        }

        // Listen for global hotkey from main process (now disabled in favor of auto-spin)
        // if (window.electron && window.electron.onSpinHotkey) {
        //     window.electron.onSpinHotkey(() => {
        //         console.log('Global hotkey received, spinning wheel');
        //         this.spin();
        //     });
        // }

        // Auto-spin timer - spins every 30 seconds
        this.autoSpinTimer = setInterval(() => {
            if (!this.isSpinning) {
                console.log('[Auto-spin] Triggering wheel spin at', new Date().toLocaleTimeString());
                this.spin();
            }
        }, this.autoSpinInterval);

        console.log(`[Wheel] Auto-spin enabled: every ${this.autoSpinInterval / 1000} seconds`);
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw wheel
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate((this.rotation * Math.PI) / 180);

        const sliceAngle = 360 / this.options.length;

        for (let i = 0; i < this.options.length; i++) {
            // Draw slice
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.arc(0, 0, this.radius,
                (i * sliceAngle * Math.PI) / 180,
                ((i + 1) * sliceAngle * Math.PI) / 180);
            this.ctx.closePath();
            this.ctx.fillStyle = this.colors[i % this.colors.length];
            this.ctx.fill();
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Draw text
            this.ctx.save();
            this.ctx.rotate(((i * sliceAngle + sliceAngle / 2) * Math.PI) / 180);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.fillText(this.options[i], this.radius - 20, 10);
            this.ctx.restore();
        }

        this.ctx.restore();

        // Draw center circle
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 30, 0, Math.PI * 2);
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Draw pointer
        this.ctx.fillStyle = '#667eea';
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX - 15, this.centerY - this.radius + 20);
        this.ctx.lineTo(this.centerX + 15, this.centerY - this.radius + 20);
        this.ctx.lineTo(this.centerX, this.centerY - this.radius + 40);
        this.ctx.closePath();
        this.ctx.fill();

        if (this.isSpinning) {
            this.rotation += this.spinVelocity;
            this.spinVelocity *= this.friction;

            if (this.spinVelocity < 0.5) {
                this.isSpinning = false;
                this.onSpinComplete();
            }

            requestAnimationFrame(() => this.draw());
        }
    }

    spin() {
        console.log('spin() called, isSpinning:', this.isSpinning);
        if (this.isSpinning) {
            console.log('Already spinning, ignoring spin request');
            return;
        }

        console.log('Starting spin with velocity:', Math.random() * 20 + 15);
        this.isSpinning = true;
        const spinButton = document.getElementById('spinButton');
        if (spinButton) {
            spinButton.classList.add('spinning');
            console.log('Added spinning class to button');
        } else {
            console.warn('Spin button not found');
        }

        // Random spin velocity (high number = more spins)
        this.spinVelocity = Math.random() * 20 + 15;

        this.draw();
    }

    onSpinComplete() {
        const spinButton = document.getElementById('spinButton');
        if (spinButton) {
            spinButton.classList.remove('spinning');
        }

        // Calculate which option won
        const normalizedRotation = ((360 - (this.rotation % 360)) - 90 + 360) % 360;
        const sliceAngle = 360 / this.options.length;
        const winningIndex = Math.floor(normalizedRotation / sliceAngle) % this.options.length;
        const winner = this.options[winningIndex];

        // Update UI
        this.updateResult(winner);

        // Trigger mod integration
        if (typeof modClient !== 'undefined') {
            modClient.onWheelSpin(winner);
        }

        // Send to main process
        if (window.electron) {
            window.electron.spinWheel(winner);
        }
    }

    updateResult(result) {
        document.getElementById('lastResult').textContent = `${result}`;
    }

    setOptions(options) {
        this.options = options;
        this.draw();
    }
}

// Initialize wheel when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    let options = [
        'Dragons',
        'Spiders',
        'Fire',
        'Ice',
        'Lightning',
        'Teleport to random location',
        'Give random weapon',
        'Spawn enemy',
        'Apply random spell',
        'Set difficulty to max',
        'Give 10000 gold',
        'Blind effect',
        'Speed boost'
    ];

    // Try to load options from game-specific wheel-options.json
    try {
        // Get game name from electron if available, default to 'skyrim'
        const game = window.electron ? (await window.electron.getGameName?.() || 'skyrim') : 'skyrim';
        const optionsPath = `../applications/${game}/config/wheel-options.json`;
        
        const response = await fetch(optionsPath);
        if (response.ok) {
            const data = await response.json();
            console.log('Raw options from JSON:', data.options);
            
            // Filter out disabled options, then extract just the names
            options = data.options
                .filter(opt => {
                    const isEnabled = opt.enabled !== false;
                    console.log(`Option "${opt.name}" - enabled: ${opt.enabled}, will render: ${isEnabled}`);
                    return isEnabled;
                })
                .map(opt => opt.name);
            
            console.log('Final wheel options (enabled only):', options);
        }
    } catch (error) {
        console.warn('Could not load wheel options from file, using defaults');
    }

    // Don't override with config.wheelOptions - use the JSON file with enabled flags
    // if (window.electron) {
    //     const config = await window.electron.getConfig();
    //     if (config.wheelOptions) {
    //         options = config.wheelOptions;
    //     }
    // }

    window.wheel = new SpinWheel('wheelCanvas', options);
});
