// TouchControls — On-screen buttons for iPad / mobile play

class TouchControls {
    constructor(scene) {
        this.scene = scene;

        // Virtual button states (mimics cursor keys)
        this.left = { isDown: false };
        this.right = { isDown: false };
        this.up = { isDown: false };
        this.down = { isDown: false };
        this.nitro = { isDown: false };

        const hasTouch = scene.sys.game.device.input.touch || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
        if (!hasTouch) return;

        this.buttons = [];
        this._createDom();
        this.createButtons();
        this.layout();
        scene.scale.on('resize', this.layout, this);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.scale.off('resize', this.layout, this);
            this.destroy();
        });
    }

    _createDom() {
        const root = document.createElement('div');
        root.style.cssText = [
            'position:fixed',
            'left:0',
            'top:0',
            'width:0',
            'height:0',
            'pointer-events:none',
            'z-index:34'
        ].join(';');
        (document.getElementById('game-container') || document.body).appendChild(root);
        this.root = root;
    }

    destroyButtons() {
        for (const btn of this.buttons) {
            btn.el.remove();
        }
        this.buttons = [];
    }

    destroy() {
        this.destroyButtons();
        if (this.root && this.root.parentNode) {
            this.root.parentNode.removeChild(this.root);
        }
        this.root = null;
    }

    createButtons() {
        this.destroyButtons();

        this.addButton('◄', this.left, false);
        this.addButton('►', this.right, false);
        this.addButton('N₂O', this.nitro, true);
        this.addButton('▼', this.down, false);
        this.addButton('▲', this.up, false);
        this.layout();
    }

    layout() {
        if (!this.root) return;

        const rect = this.scene.game.canvas.getBoundingClientRect();
        this.root.style.left = `${rect.left}px`;
        this.root.style.top = `${rect.top}px`;
        this.root.style.width = `${rect.width}px`;
        this.root.style.height = `${rect.height}px`;

        const width = rect.width;
        const height = rect.height;
        const btnSize = Math.max(52, Math.min(92, Math.round(width * 0.07)));
        const nitroSize = Math.round(btnSize * 1.15);
        const gap = Math.round(btnSize * 0.48);
        const bottomPad = Math.max(8, Math.round(height * 0.018));
        const bottom = height - btnSize / 2 - bottomPad;
        const totalWidth = btnSize * 4 + nitroSize + gap * 4;
        const startX = (width - totalWidth) / 2 + btnSize / 2;
        const centers = [
            startX,
            startX + btnSize + gap,
            startX + btnSize * 2 + gap * 2 + (nitroSize - btnSize) / 2,
            startX + btnSize * 2 + nitroSize + gap * 3,
            startX + btnSize * 3 + nitroSize + gap * 4,
        ];

        this.buttons.forEach((btn, index) => {
            const size = btn.isNitro ? nitroSize : btnSize;
            btn.el.style.width = `${size}px`;
            btn.el.style.height = `${size}px`;
            btn.el.style.left = `${centers[index] - size / 2}px`;
            btn.el.style.top = `${bottom - size / 2}px`;
            btn.el.style.fontSize = `${Math.max(18, Math.round(size * 0.3))}px`;
        });
    }

    addButton(label, state, isNitro) {
        if (!this.root) return;

        const el = document.createElement('button');
        el.type = 'button';
        el.textContent = label;
        el.style.cssText = [
            'position:absolute',
            'border:none',
            'border-radius:12px',
            'background:rgba(255,255,255,0.24)',
            'color:#ffffff',
            'font-family:Arial, sans-serif',
            'font-weight:700',
            'text-shadow:0 1px 0 #000, 0 0 6px rgba(0,0,0,0.8)',
            'box-shadow:0 0 0 1px rgba(255,255,255,0.18) inset',
            'pointer-events:auto',
            'touch-action:none',
            'user-select:none',
            '-webkit-user-select:none'
        ].join(';');

        const press = (event) => {
            event.preventDefault();
            state.isDown = true;
            el.style.background = 'rgba(255,255,255,0.42)';
        };
        const release = (event) => {
            if (event) event.preventDefault();
            state.isDown = false;
            el.style.background = 'rgba(255,255,255,0.24)';
        };

        el.addEventListener('pointerdown', press);
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
        el.addEventListener('pointerleave', release);
        this.root.appendChild(el);

        this.buttons.push({ el, state, isNitro });
    }
}
