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

/* Color states - Job Orbit Terracotta (#D97757) */
.virtual-cursor[data-state="moving"] .cursor-fill { fill: #d97757; }
.virtual-cursor[data-state="moving"] .cursor-halo { background: radial-gradient(circle, rgba(217, 119, 87, 0.45) 0%, transparent 70%); }

.virtual-cursor[data-state="thinking"] .cursor-fill { fill: #d97757; }
.virtual-cursor[data-state="thinking"] .cursor-halo { background: radial-gradient(circle, rgba(217, 119, 87, 0.55) 0%, transparent 70%); animation-duration: 0.8s; }

.virtual-cursor[data-state="typing"] .cursor-fill { fill: #c86646; }
.virtual-cursor[data-state="typing"] .cursor-halo { background: radial-gradient(circle, rgba(217, 119, 87, 0.5) 0%, transparent 70%); }

.virtual-cursor[data-state="asking"] .cursor-fill { fill: #d97757; }
.virtual-cursor[data-state="asking"] .cursor-halo { background: radial-gradient(circle, rgba(217, 119, 87, 0.6) 0%, transparent 70%); }

/* Click Ripple effect */
.click-ripple {
    position: absolute;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2.5px solid rgba(217, 119, 87, 0.9);
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

/* Floating Agent Thought HUD - Hidden so all autonomous actions are cursor-only */
.agent-thought-hud {
    display: none !important;
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
    border: 2px solid rgba(217, 119, 87, 0.85);
    background: rgba(217, 119, 87, 0.06);
    border-radius: 8px;
    pointer-events: none;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 12px rgba(217, 119, 87, 0.25);
    opacity: 0;
    z-index: 5;
}

.target-spotlight.active {
    opacity: 1;
}

/* Interactive Question Card - Matches Job Orbit Chrome Extension UI */
.agent-dialogue-card {
    position: absolute;
    top: 26px;
    left: 14px;
    width: 330px;
    background: #ffffff;
    border: 1px solid #e8e3dc;
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: 0 14px 34px rgba(24, 24, 27, 0.14), 0 2px 8px rgba(24, 24, 27, 0.06);
    color: #1f2937;
    pointer-events: auto;
    font-size: 13px;
    z-index: 20;
    animation: fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.96) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.agent-dialogue-title {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #d97757;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.agent-dialogue-question {
    font-size: 13.5px;
    font-weight: 500;
    line-height: 1.45;
    margin-bottom: 10px;
    color: #18181b;
}

.agent-dialogue-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}

.agent-dialogue-chip {
    background: #faf8f5;
    border: 1px solid #e5e0d8;
    border-radius: 14px;
    padding: 5px 11px;
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.agent-dialogue-chip:hover {
    background: #fdf4f0;
    border-color: #d97757;
    color: #c86646;
}

.agent-dialogue-input {
    width: 100%;
    box-sizing: border-box;
    background: #faf8f5;
    border: 1px solid #e5e0d8;
    border-radius: 8px;
    padding: 9px 11px;
    color: #18181b;
    font-size: 13px;
    margin-bottom: 12px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.agent-dialogue-input::placeholder {
    color: #9ca3af;
}

.agent-dialogue-input:focus {
    background: #ffffff;
    border-color: #d97757;
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.14);
}

.agent-dialogue-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.agent-dialogue-btn {
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
}

.agent-dialogue-btn:hover {
    transform: translateY(-0.5px);
}

.agent-dialogue-btn.primary {
    background: #d97757;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(217, 119, 87, 0.25);
}

.agent-dialogue-btn.primary:hover {
    background: #c86646;
}

.agent-dialogue-btn.secondary {
    background: #faf8f5;
    border-color: #e5e0d8;
    color: #4b5563;
}

.agent-dialogue-btn.secondary:hover {
    background: #f3efe8;
    color: #18181b;
}

/* Review & Submission Safety Gate Banner - Matches Job Orbit UI */
.agent-review-card {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    border: 1px solid #e8e3dc;
    box-shadow: 0 14px 36px rgba(24, 24, 27, 0.14), 0 2px 8px rgba(24, 24, 27, 0.06);
    border-radius: 14px;
    padding: 16px 20px;
    min-width: 380px;
    max-width: 520px;
    pointer-events: auto;
    z-index: 2147483647;
    animation: agent-review-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: inherit;
    color: #18181b;
}

@keyframes agent-review-pop {
    0% { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }
    100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

.agent-review-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 14px;
    color: #d97757;
}

.agent-review-body {
    font-size: 13px;
    line-height: 1.5;
    color: #4b5563;
    margin-bottom: 14px;
}

.agent-review-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.agent-review-btn-submit {
    background: #d97757;
    color: #ffffff;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(217, 119, 87, 0.28);
    transition: all 0.15s ease;
}

.agent-review-btn-submit:hover {
    background: #c86646;
    transform: translateY(-1px);
}

.agent-review-btn-manual {
    background: #faf8f5;
    color: #4b5563;
    border: 1px solid #e5e0d8;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.15s ease;
}

.agent-review-btn-manual:hover {
    background: #f3efe8;
    color: #18181b;
}
`;

if (typeof window !== 'undefined') {
    window.VirtualCursorStyles = VirtualCursorStyles;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualCursorStyles;
}
