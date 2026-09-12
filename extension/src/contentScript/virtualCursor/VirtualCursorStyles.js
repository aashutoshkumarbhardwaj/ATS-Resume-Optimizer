/**
 * Virtual Cursor Overlay Styles
 * Embedded directly into the isolated Shadow DOM
 */

const VirtualCursorStyles = `
:host {
    all: initial;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.virtual-cursor-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    pointer-events: none;
}

/* The visual cursor pointer */
.virtual-cursor {
    position: absolute;
    top: 0;
    left: 0;
    width: 28px;
    height: 28px;
    transform: translate3d(0, 0, 0);
    transition: transform 0.05s linear;
    will-change: transform;
    pointer-events: none;
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
    z-index: 10;
}

.cursor-svg {
    width: 100%;
    height: 100%;
    transition: transform 0.15s ease;
}

.cursor-svg.clicking {
    transform: scale(0.82);
}

/* Glowing halo around cursor tip */
.cursor-halo {
    position: absolute;
    top: -6px;
    left: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(99, 102, 241, 0) 70%);
    animation: haloPulse 1.8s infinite ease-in-out;
    pointer-events: none;
}

/* Color states */
.virtual-cursor[data-state="moving"] .cursor-fill { fill: #10b981; }
.virtual-cursor[data-state="moving"] .cursor-halo { background: radial-gradient(circle, rgba(16, 185, 129, 0.5) 0%, transparent 70%); }

.virtual-cursor[data-state="thinking"] .cursor-fill { fill: #8b5cf6; }
.virtual-cursor[data-state="thinking"] .cursor-halo { background: radial-gradient(circle, rgba(139, 92, 246, 0.55) 0%, transparent 70%); animation-duration: 0.8s; }

.virtual-cursor[data-state="typing"] .cursor-fill { fill: #f59e0b; }
.virtual-cursor[data-state="typing"] .cursor-halo { background: radial-gradient(circle, rgba(245, 158, 11, 0.5) 0%, transparent 70%); }

.virtual-cursor[data-state="asking"] .cursor-fill { fill: #ec4899; }
.virtual-cursor[data-state="asking"] .cursor-halo { background: radial-gradient(circle, rgba(236, 72, 153, 0.55) 0%, transparent 70%); }

/* Click Ripple effect */
.click-ripple {
    position: absolute;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2.5px solid rgba(99, 102, 241, 0.9);
    transform: translate(-50%, -50%) scale(0.2);
    opacity: 1;
    animation: rippleWave 0.55s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
    pointer-events: none;
}

@keyframes rippleWave {
    0% {
        transform: translate(-50%, -50%) scale(0.2);
        opacity: 1;
    }
    100% {
        transform: translate(-50%, -50%) scale(1.6);
        opacity: 0;
    }
}

@keyframes haloPulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.4); opacity: 1; }
}

/* Floating Agent Thought HUD */
.agent-thought-hud {
    position: absolute;
    top: 24px;
    left: 20px;
    min-width: 140px;
    max-width: 340px;
    padding: 8px 14px;
    background: rgba(17, 24, 39, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    color: #f9fafb;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    transition: opacity 0.2s ease, transform 0.2s ease;
    opacity: 1;
    z-index: 15;
}

.hud-stop-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(239, 68, 68, 0.25);
    border: 1px solid rgba(239, 68, 68, 0.6);
    border-radius: 12px;
    color: #fca5a5;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    margin-left: auto;
    flex-shrink: 0;
}

.hud-stop-btn:hover {
    background: #ef4444;
    color: white;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
    transform: scale(1.05);
}

.agent-thought-hud.hidden {
    opacity: 0;
    transform: translateY(4px);
    pointer-events: none;
}

.hud-icon {
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
}

.hud-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
}

.hud-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 8px #10b981;
    animation: hudDotPulse 1.2s infinite ease-in-out;
}

@keyframes hudDotPulse {
    0%, 100% { transform: scale(0.9); opacity: 0.8; }
    50% { transform: scale(1.3); opacity: 1; }
}

/* Target Spotlight / Focus Box */
.target-spotlight {
    position: absolute;
    border: 2px solid rgba(99, 102, 241, 0.85);
    background: rgba(99, 102, 241, 0.08);
    border-radius: 6px;
    pointer-events: none;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.35);
    opacity: 0;
    z-index: 5;
}

.target-spotlight.active {
    opacity: 1;
}

/* Interactive Question Card inside HUD */
.agent-dialogue-card {
    position: absolute;
    top: 35px;
    left: 10px;
    width: 320px;
    background: #1e1e2d;
    border: 1px solid rgba(139, 92, 246, 0.35);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 20px 30px rgba(0, 0, 0, 0.5);
    color: #ffffff;
    pointer-events: auto;
    font-size: 13px;
    z-index: 20;
    animation: fadeInScale 0.2s ease-out;
}

@keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}

.agent-dialogue-title {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    color: #a78bfa;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.agent-dialogue-question {
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 10px;
    color: #f3f4f6;
}

.agent-dialogue-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}

.agent-dialogue-chip {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    padding: 5px 10px;
    font-size: 12px;
    color: #e5e7eb;
    cursor: pointer;
    transition: all 0.15s ease;
}

.agent-dialogue-chip:hover {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: #ffffff;
}

.agent-dialogue-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    padding: 8px 10px;
    color: #ffffff;
    font-size: 12px;
    margin-bottom: 10px;
    outline: none;
}

.agent-dialogue-input:focus {
    border-color: #8b5cf6;
}

.agent-dialogue-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.agent-dialogue-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;
}

.agent-dialogue-btn:hover {
    opacity: 0.9;
}

.agent-dialogue-btn.primary {
    background: #8b5cf6;
    color: #ffffff;
}

.agent-dialogue-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
}

/* Review & Submission Safety Gate Banner */
.agent-review-card {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(16, 185, 129, 0.4);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 24px rgba(16, 185, 129, 0.2);
    border-radius: 12px;
    padding: 16px 20px;
    min-width: 380px;
    max-width: 520px;
    pointer-events: auto;
    z-index: 2147483647;
    animation: agent-review-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: inherit;
    color: #ffffff;
}

@keyframes agent-review-pop {
    0% { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }
    100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

.agent-review-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 15px;
    color: #10b981;
}

.agent-review-body {
    font-size: 13px;
    line-height: 1.5;
    color: #d1d5db;
    margin-bottom: 14px;
}

.agent-review-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.agent-review-btn-submit {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    transition: all 0.15s ease;
}

.agent-review-btn-submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
}

.agent-review-btn-manual {
    background: rgba(255, 255, 255, 0.08);
    color: #9ca3af;
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.15s ease;
}

.agent-review-btn-manual:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
}
`;

if (typeof window !== 'undefined') {
    window.VirtualCursorStyles = VirtualCursorStyles;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualCursorStyles;
}
