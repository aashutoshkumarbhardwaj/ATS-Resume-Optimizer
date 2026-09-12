/**
 * Virtual Cursor Engine
 * Renders an independent, humanized agent cursor and thought HUD
 * inside an isolated Shadow DOM overlay without hijacking the user's physical mouse.
 * Inspired by open-source computer-use frameworks (trycua & ghost-cursor).
 */

class VirtualCursorEngine {
    constructor() {
        this.overlayId = 'ats-agent-ghost-overlay';
        this.shadowRoot = null;
        this.container = null;
        this.cursorEl = null;
        this.hudEl = null;
        this.hudTextEl = null;
        this.hudIconEl = null;
        this.spotlightEl = null;
        this.dialogueContainer = null;
        
        // State
        this.currentX = window.innerWidth / 2;
        this.currentY = window.innerHeight / 2;
        this.isMounted = false;
        this.isAborted = false;
        this.currentSpeed = 'normal'; // 'slow' | 'normal' | 'fast'
    }

    /**
     * Mount the overlay and cursor into the DOM
     */
    mount() {
        if (this.isMounted && document.getElementById(this.overlayId)) {
            return;
        }

        // Clean up any stale overlay
        const existing = document.getElementById(this.overlayId);
        if (existing) existing.remove();

        const host = document.createElement('div');
        host.id = this.overlayId;
        this.shadowRoot = host.attachShadow({ mode: 'open' });

        // Inject styles
        const style = document.createElement('style');
        style.textContent = window.VirtualCursorStyles || '';
        this.shadowRoot.appendChild(style);

        // Inject HTML
        this.container = document.createElement('div');
        this.container.className = 'virtual-cursor-container';
        this.container.innerHTML = `
            <!-- Spotlight box around active element -->
            <div class="target-spotlight" id="target-spotlight"></div>

            <!-- Visual cursor element -->
            <div class="virtual-cursor" id="virtual-cursor" data-state="moving">
                <div class="cursor-halo"></div>
                <svg class="cursor-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path class="cursor-fill" d="M3 2L10.5 21L13.5 13.5L21 10.5L3 2Z" fill="#10b981" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>

                <!-- Floating Thought HUD -->
                <div class="agent-thought-hud" id="agent-thought-hud">
                    <span class="hud-pulse"></span>
                    <span class="hud-icon" id="hud-icon">🤖</span>
                    <span class="hud-text" id="hud-text">Agent initializing...</span>
                    <button class="hud-stop-btn" id="hud-stop-btn" title="Stop Autonomous Agent">⏹ Stop</button>
                </div>

                <!-- Interactive Question Container -->
                <div id="dialogue-container"></div>
            </div>
        `;

        this.shadowRoot.appendChild(this.container);
        document.documentElement.appendChild(host);

        // Cache elements
        this.cursorEl = this.shadowRoot.getElementById('virtual-cursor');
        this.hudEl = this.shadowRoot.getElementById('agent-thought-hud');
        this.hudTextEl = this.shadowRoot.getElementById('hud-text');
        this.hudIconEl = this.shadowRoot.getElementById('hud-icon');
        this.hudStopBtn = this.shadowRoot.getElementById('hud-stop-btn');
        this.spotlightEl = this.shadowRoot.getElementById('target-spotlight');
        this.dialogueContainer = this.shadowRoot.getElementById('dialogue-container');

        if (this.hudStopBtn && typeof this.hudStopBtn.addEventListener === 'function') {
            this.hudStopBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof this.onStop === 'function') {
                    this.onStop();
                }
            });
        }

        // Initial position
        this.updateCursorPosition(this.currentX, this.currentY);
        this.isMounted = true;
        this.isAborted = false;
    }

    /**
     * Update transform position of cursor
     */
    updateCursorPosition(x, y) {
        this.currentX = x;
        this.currentY = y;
        if (this.cursorEl) {
            this.cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
    }

    /**
     * Set HUD thought text and icon
     */
    setStatus(text, icon = '🤖', state = 'moving') {
        if (!this.hudTextEl) return;
        this.hudTextEl.textContent = text;
        this.hudIconEl.textContent = icon;
        if (this.cursorEl) {
            this.cursorEl.setAttribute('data-state', state);
        }
    }

    /**
     * Smoothly and monotonically ensure an element is visible in viewport without violent jumps or centering
     */
    async ensureElementInView(target) {
        if (!target || typeof target.getBoundingClientRect !== 'function') return;

        const vh = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
        const initialRect = target.getBoundingClientRect();

        // 1. If element is already comfortably in viewport (not cut off by top header or bottom edge), DO NOT scroll
        if (initialRect.top >= 70 && initialRect.bottom <= vh - 70) {
            return;
        }

        // 2. Element is below or above viewport: scroll gently with block: 'nearest'
        if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            // Wait for smooth scroll animation to settle
            await this.sleep(200);

            // Ensure motion has stopped before reading coordinates
            let prevTop = target.getBoundingClientRect().top;
            for (let i = 0; i < 4; i++) {
                await this.sleep(40);
                const currentTop = target.getBoundingClientRect().top;
                if (Math.abs(currentTop - prevTop) < 2) break;
                prevTop = currentTop;
            }
        }
    }

    /**
     * Smoothly move the virtual cursor along a humanized cubic Bezier trajectory
     * to a target element or coordinates.
     */
    async moveTo(target, options = {}) {
        if (!this.isMounted) this.mount();

        let targetX = 0;
        let targetY = 0;
        let targetElement = null;

        if (target instanceof HTMLElement || (target && typeof target.getBoundingClientRect === 'function')) {
            targetElement = target;
            await this.ensureElementInView(target);

            const rect = target.getBoundingClientRect();
            targetX = rect.left + Math.max(10, Math.min(rect.width / 2, rect.width - 10));
            targetY = rect.top + Math.max(8, Math.min(rect.height / 2, rect.height - 8));
        } else if (typeof target.x === 'number' && typeof target.y === 'number') {
            targetX = target.x;
            targetY = target.y;
        }

        const startX = this.currentX;
        const startY = this.currentY;

        // Calculate distance and duration using Fitts's Law
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.hypot(dx, dy);

        let duration = options.duration;
        if (!duration) {
            if (this.currentSpeed === 'fast') {
                duration = Math.max(120, Math.min(300, distance * 0.4));
            } else if (this.currentSpeed === 'slow') {
                duration = Math.max(400, Math.min(900, distance * 0.9));
            } else {
                duration = Math.max(220, Math.min(550, distance * 0.65));
            }
        }

        // Generate human-like Bezier control points (ghost-cursor math)
        // Control point 1 curves outward; control point 2 eases into target
        const midX = (startX + targetX) / 2;
        const midY = (startY + targetY) / 2;
        const perpX = -dy * 0.2 * (Math.random() > 0.5 ? 1 : -1);
        const perpY = dx * 0.2 * (Math.random() > 0.5 ? 1 : -1);

        const p1x = midX + perpX + (Math.random() - 0.5) * 30;
        const p1y = midY + perpY + (Math.random() - 0.5) * 30;
        const p2x = targetX + (Math.random() - 0.5) * 15;
        const p2y = targetY + (Math.random() - 0.5) * 15;

        // Animate along Bezier curve
        await new Promise((resolve) => {
            const startTime = performance.now();

            const step = (currentTime) => {
                if (this.isAborted) {
                    resolve();
                    return;
                }

                const elapsed = currentTime - startTime;
                let t = Math.min(1, elapsed / duration);

                // Cubic ease-out timing function
                const easeT = 1 - Math.pow(1 - t, 3);

                // Cubic Bezier interpolation: (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
                const omt = 1 - easeT;
                const curX = omt * omt * omt * startX +
                             3 * omt * omt * easeT * p1x +
                             3 * omt * easeT * easeT * p2x +
                             easeT * easeT * easeT * targetX;

                const curY = omt * omt * omt * startY +
                             3 * omt * omt * easeT * p1y +
                             3 * omt * easeT * easeT * p2y +
                             easeT * easeT * easeT * targetY;

                this.updateCursorPosition(curX, curY);

                if (t < 1) {
                    requestAnimationFrame(step);
                } else {
                    this.updateCursorPosition(targetX, targetY);
                    resolve();
                }
            };

            requestAnimationFrame(step);
        });

        // Add micro-jitter / settle
        await this.sleep(30);
        this.updateCursorPosition(targetX + (Math.random() - 0.5) * 1.5, targetY + (Math.random() - 0.5) * 1.5);

        // Highlight element if element target
        if (targetElement) {
            this.highlightElement(targetElement);
        }
    }

    /**
     * Highlight element with a glowing spotlight box
     */
    highlightElement(element) {
        if (!this.spotlightEl || !element) return;
        const rect = element.getBoundingClientRect();
        this.spotlightEl.style.left = `${rect.left - 3}px`;
        this.spotlightEl.style.top = `${rect.top - 3}px`;
        this.spotlightEl.style.width = `${rect.width + 6}px`;
        this.spotlightEl.style.height = `${rect.height + 6}px`;
        this.spotlightEl.classList.add('active');
    }

    /**
     * Clear spotlight highlight
     */
    clearHighlight() {
        if (this.spotlightEl) {
            this.spotlightEl.classList.remove('active');
        }
    }

    /**
     * Visual click animation with expanding ripple
     */
    async click(element = null) {
        if (!this.cursorEl) return;

        const svg = this.cursorEl.querySelector('.cursor-svg');
        if (svg && svg.classList && typeof svg.classList.add === 'function') svg.classList.add('clicking');

        // Spawn ripple at cursor tip (offset by tip coordinates)
        const ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        ripple.style.left = '3px';
        ripple.style.top = '3px';
        if (typeof this.cursorEl.appendChild === 'function') {
            this.cursorEl.appendChild(ripple);
        }

        setTimeout(() => {
            if (ripple && typeof ripple.remove === 'function') ripple.remove();
        }, 600);

        await this.sleep(120);
        if (svg && svg.classList && typeof svg.classList.remove === 'function') svg.classList.remove('clicking');
        await this.sleep(60);
    }

    /**
     * Animated typing into field with humanized cadence
     */
    async type(element, text, options = {}) {
        this.setStatus(`Typing...`, '✍️', 'typing');

        if (!element) return;
        element.focus();

        const isHumanSpeed = options.humanSpeed !== false;
        const stringVal = String(text || '');

        if (!isHumanSpeed || stringVal.length > 120) {
            // Fast mode for very long text (e.g. cover letters)
            this.setNativeValue(element, stringVal);
            this.triggerInputEvents(element);
            await this.sleep(150);
            return;
        }

        // Clear existing value if required
        this.setNativeValue(element, '');
        this.triggerInputEvents(element);

        // Type character-by-character with slight jitter
        let accumulated = '';
        for (let i = 0; i < stringVal.length; i++) {
            if (this.isAborted) break;

            accumulated += stringVal[i];
            this.setNativeValue(element, accumulated);
            this.triggerInputEvents(element);

            // Natural human typing cadence (20ms - 55ms, longer for spaces/punctuation)
            const char = stringVal[i];
            let delay = 22 + Math.random() * 25;
            if (char === ' ' || char === '.' || char === ',') {
                delay += 40;
            }

            // Subtle cursor typing wobble
            if (i % 4 === 0) {
                const wobble = (Math.random() - 0.5) * 2;
                this.updateCursorPosition(this.currentX + wobble, this.currentY);
            }

            await this.sleep(delay);
        }

        this.triggerChangeEvents(element);
        await this.sleep(100);
    }

    /**
     * Synthesize lightweight sound effects using browser-native Web Audio API
     */
    initAudio() {
        if (this.audioCtx) return this.audioCtx;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        } catch (e) {
            this.audioCtx = null;
        }
        return this.audioCtx;
    }

    playChime(type = 'prompt') {
        try {
            const ctx = this.initAudio();
            if (!ctx) return;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'prompt') {
                // Two gentle ascending chime notes (D5 587Hz -> A5 880Hz)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now);
                osc.frequency.setValueAtTime(880.00, now + 0.12);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.36);
            } else if (type === 'success') {
                // Celebratory arpeggio fanfare (C5 -> E5 -> G5 -> C6)
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.09);
                osc.frequency.setValueAtTime(783.99, now + 0.18);
                osc.frequency.setValueAtTime(1046.50, now + 0.27);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
                osc.start(now);
                osc.stop(now + 0.66);
            } else if (type === 'alert') {
                // Soft warning alert beep (440Hz -> 349Hz)
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(440.00, now);
                osc.frequency.setValueAtTime(349.23, now + 0.14);
                gain.gain.setValueAtTime(0.07, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.36);
            }
        } catch (e) {
            // Audio silently fails if user interaction policies restrict it
        }
    }

    /**
     * Display an interactive in-page prompt when user preference is missing
     */
    async askUser(questionText, options = []) {
        this.playChime('prompt');
        this.setStatus(`Waiting for your input...`, '❓', 'asking');

        return new Promise((resolve) => {
            if (!this.dialogueContainer) {
                resolve(null);
                return;
            }

            const card = document.createElement('div');
            card.className = 'agent-dialogue-card';

            let chipsHtml = '';
            if (options && options.length > 0) {
                chipsHtml = `
                    <div class="agent-dialogue-chips">
                        ${options.map(opt => `<button type="button" class="agent-dialogue-chip" data-val="${opt}">${opt}</button>`).join('')}
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="agent-dialogue-title">
                    <span>🤖</span> Personal Agent Question
                </div>
                <div class="agent-dialogue-question">${questionText}</div>
                ${chipsHtml}
                <input type="text" class="agent-dialogue-input" placeholder="Type your answer..." />
                <div class="agent-dialogue-actions">
                    <button type="button" class="agent-dialogue-btn secondary" id="agent-skip-btn">Skip</button>
                    <button type="button" class="agent-dialogue-btn primary" id="agent-submit-btn">Save & Continue</button>
                </div>
            `;

            this.dialogueContainer.innerHTML = '';
            this.dialogueContainer.appendChild(card);

            const inputEl = card.querySelector('.agent-dialogue-input');
            const submitBtn = card.querySelector('#agent-submit-btn');
            const skipBtn = card.querySelector('#agent-skip-btn');

            // Handle chip clicks
            card.querySelectorAll('.agent-dialogue-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const val = chip.getAttribute('data-val');
                    card.remove();
                    resolve(val);
                });
            });

            // Handle submit
            const doSubmit = () => {
                const val = inputEl.value.trim();
                card.remove();
                resolve(val || null);
            };

            submitBtn.addEventListener('click', doSubmit);
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doSubmit();
            });

            // Handle skip
            skipBtn.addEventListener('click', () => {
                card.remove();
                resolve(null);
            });

            inputEl.focus();
        });
    }

    /**
     * Display a pre-submission review safety gate modal before final submit
     */
    async showReviewModal(stats = {}) {
        this.playChime('success');
        this.setStatus(`Review Application Ready 🎉`, '✅', 'idle');

        return new Promise((resolve) => {
            if (!this.dialogueContainer) {
                resolve(true);
                return;
            }

            const card = document.createElement('div');
            card.className = 'agent-review-card';
            card.innerHTML = `
                <div class="agent-review-header">
                    <span>🛡️</span> Application Ready for Review
                </div>
                <div class="agent-review-body">
                    All <strong>${stats.filled || 0} fields</strong> have been filled and verified.<br>
                    You can submit automatically now, or review your answers on-screen first.
                </div>
                <div class="agent-review-actions">
                    <button type="button" class="agent-review-btn-manual" id="agent-review-manual-btn">Review First</button>
                    <button type="button" class="agent-review-btn-submit" id="agent-review-submit-btn">Submit for Me 🚀</button>
                </div>
            `;

            this.dialogueContainer.innerHTML = '';
            this.dialogueContainer.appendChild(card);

            const submitBtn = card.querySelector('#agent-review-submit-btn');
            const manualBtn = card.querySelector('#agent-review-manual-btn');

            submitBtn.addEventListener('click', () => {
                card.remove();
                resolve(true); // User approves auto-submit
            });

            manualBtn.addEventListener('click', () => {
                card.remove();
                resolve(false); // User will submit manually
            });
        });
    }

    /**
     * Helpers for setting DOM values bypassing React/Vue
     */
    setNativeValue(element, value) {
        if (!element) return;
        const stringVal = String(value ?? '');
        try {
            if (element.tagName === 'INPUT') {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(element, stringVal);
                } else {
                    element.value = stringVal;
                }
            } else if (element.tagName === 'TEXTAREA') {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (nativeSetter) {
                    nativeSetter.call(element, stringVal);
                } else {
                    element.value = stringVal;
                }
            } else if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
                element.textContent = stringVal;
                element.innerText = stringVal;
            } else {
                element.value = stringVal;
            }
        } catch (e) {
            element.value = stringVal;
        }
    }

    triggerInputEvents(element, char = '') {
        if (!element) return;
        try {
            element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: char }));
        } catch (e) {
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        }
    }

    triggerChangeEvents(element) {
        if (!element) return;
        try {
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
        } catch (e) {}
    }

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    abort() {
        this.isAborted = true;
        this.clearHighlight();
        if (this.hudEl) this.hudEl.classList.add('hidden');
    }

    unmount() {
        this.abort();
        const existing = document.getElementById(this.overlayId);
        if (existing) existing.remove();
        this.isMounted = false;
    }
}

// Export to window
if (typeof window !== 'undefined') {
    window.VirtualCursorEngine = VirtualCursorEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualCursorEngine;
}
