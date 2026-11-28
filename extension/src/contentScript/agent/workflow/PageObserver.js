/**
 * PageObserver (Phase 2 - OBSERVE)
 * Builds a compact, indexed structural + accessibility observation of the current page
 * (inspired by Browser Use's indexed element map & Stagehand's hybrid a11y tree).
 * Never dumps raw HTML to the LLM.
 */
var PageObserver = (typeof window !== 'undefined' && window.PageObserver) || class PageObserver {
    static isElementVisible(el) {
        if (!el) return false;
        if (el.disabled === true && el.type === 'hidden') return false;
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            try {
                const st = window.getComputedStyle(el);
                if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
            } catch (e) {}
        }
        if (typeof el.getBoundingClientRect === 'function') {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return false;
        }
        return true;
    }

    static extractLabel(el, root = document) {
        if (!el) return '';
        const ariaLabel = el.getAttribute?.('aria-label');
        if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

        const labelledBy = el.getAttribute?.('aria-labelledby');
        if (labelledBy && root.getElementById) {
            const txt = labelledBy.split(/\s+/).map((id) => root.getElementById(id)?.textContent || '').join(' ').trim();
            if (txt) return txt;
        }

        if (el.id && typeof root.querySelector === 'function') {
            try {
                const lbl = root.querySelector(`label[for="${el.id}"]`);
                if (lbl && lbl.textContent) return lbl.textContent.trim();
            } catch (e) {}
        }

        const parentLabel = el.closest?.('label');
        if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

        const group = el.closest?.('.field, .form-group, .application-question, fieldset, [role="group"], [role="radiogroup"]');
        if (group) {
            const lbl = group.querySelector?.('label, legend, .label, [data-automation-id="fieldLabel"]');
            if (lbl && lbl.textContent) return lbl.textContent.trim();
        }

        return (el.placeholder || el.name || el.id || '').trim();
    }

    static inferRole(el) {
        const explicitRole = el.getAttribute?.('role');
        if (explicitRole) return explicitRole.toLowerCase();
        const tag = (el.tagName || '').toLowerCase();
        const type = (el.type || '').toLowerCase();
        if (tag === 'button' || (tag === 'input' && ['submit', 'button'].includes(type))) return 'button';
        if (tag === 'a') return 'link';
        if (tag === 'select') return 'combobox';
        if (tag === 'textarea') return 'textbox';
        if (tag === 'input') {
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            if (type === 'file') return 'file';
            return 'textbox';
        }
        return tag || 'generic';
    }

    static queryDeep(selector, root = document) {
        const out = [];
        const seen = new Set();
        const walk = (node) => {
            if (!node || seen.has(node)) return;
            seen.add(node);
            if (typeof node.querySelectorAll !== 'function') return;
            out.push(...Array.from(node.querySelectorAll(selector)));
            const all = node.querySelectorAll('*');
            for (let i = 0; i < all.length; i++) {
                if (all[i].shadowRoot) walk(all[i].shadowRoot);
            }
        };
        walk(root);
        return out;
    }

    /**
     * Find an active top-most modal/dialog if one is open so application pop-offs are targeted directly.
     * Crucially: Excludes dropdown listboxes, combobox popups, datepickers, and menus from being treated as modals!
     */
    static findActiveModal(root = document) {
        const dialogs = this.queryDeep('[role="dialog"], [aria-modal="true"], .artdeco-modal', root);
        for (let i = dialogs.length - 1; i >= 0; i--) {
            const dlg = dialogs[i];
            if (!this.isElementVisible(dlg)) continue;

            // Never treat dropdown popups, listboxes, menus, or autocompletes as application modals
            const role = (dlg.getAttribute?.('role') || '').toLowerCase();
            const isDropdownPopup = dlg.getAttribute?.('data-ats-dropdown-popup') === 'true' ||
                                    role === 'listbox' || role === 'menu' || role === 'tooltip';
            if (isDropdownPopup) continue;

            const className = (dlg.className || '').toString().toLowerCase();
            if (className.includes('select__menu') || className.includes('c-autocomplete__menu') ||
                className.includes('spl-select-options') || className.includes('dropdown-menu') ||
                className.includes('pac-container') || className.includes('popover') || className.includes('tooltip')) {
                continue;
            }

            // Real application modals have substantial geometry (>280px wide and >200px high)
            if (typeof dlg.getBoundingClientRect === 'function') {
                try {
                    const r = dlg.getBoundingClientRect();
                    if (r.width < 280 || r.height < 200) continue;
                } catch (e) {}
            }

            const hasControls = dlg.querySelector?.('input:not([type="hidden"]), select, textarea, button, [role="button"]');
            if (hasControls) return dlg;
        }
        return null;
    }

    /**
     * Capture compact structured observation of the current page (scoped to active modal if open)
     */
    static observe(root = document) {
        const url = (typeof window !== 'undefined' && window.location) ? window.location.href : '';
        const title = root.title || '';
        const activeModal = this.findActiveModal(root);
        const scopeRoot = activeModal || root;

        const headings = this.queryDeep('h1, h2, h3, legend, [role="heading"]', scopeRoot)
            .filter((el) => this.isElementVisible(el))
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 0 && t.length < 160)
            .slice(0, 15);

        const interactiveNodes = this.queryDeep(
            'input:not([type="hidden"]), select, textarea, button, a[href], [role="button"], [role="combobox"], [role="listbox"], [role="checkbox"], [role="radio"]',
            scopeRoot
        );

        const elements = [];
        const seenEl = new Set();

        // Group radio buttons (fieldset, [role="radiogroup"], or shared input[type="radio"][name])
        const groupedRadioEls = new Set();
        const radioContainers = this.queryDeep('fieldset, [role="radiogroup"]', scopeRoot);
        for (const grp of radioContainers) {
            if (!this.isElementVisible(grp)) continue;
            const radios = Array.from(grp.querySelectorAll?.('input[type="radio"], [role="radio"]') || []);
            if (radios.length === 0) continue;
            radios.forEach((r) => groupedRadioEls.add(r));

            const legendText = (grp.querySelector?.('legend, .fb-dash-form-element__label, label, [data-automation-id="fieldLabel"]')?.textContent ||
                grp.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim();
            const groupOpts = radios.map((r) => {
                const lbl = r.id && grp.querySelector ? grp.querySelector(`label[for="${r.id}"]`) : r.closest?.('label');
                const optLabel = (lbl?.textContent || r.getAttribute?.('aria-label') || r.value || r.textContent || '').replace(/\s+/g, ' ').trim();
                const isChecked = Boolean(r.checked || r.getAttribute?.('aria-checked') === 'true');
                return { label: optLabel, element: r, checked: isChecked };
            }).filter((o) => o.label);

            const selectedOpt = groupOpts.find((o) => o.checked);
            if (legendText && groupOpts.length > 0) {
                elements.push({
                    index: elements.length,
                    element: grp,
                    tag: (grp.tagName || 'fieldset').toLowerCase(),
                    role: 'radiogroup',
                    type: 'radio',
                    label: legendText,
                    accessibleName: legendText,
                    placeholder: '',
                    value: selectedOpt ? selectedOpt.label : '',
                    checked: Boolean(selectedOpt),
                    disabled: false,
                    required: Boolean(grp.getAttribute?.('aria-required') === 'true' || /\*/.test(legendText) || radios.some((r) => r.required)),
                    options: groupOpts,
                    stableAttrs: { id: grp.id || '' },
                    parentContext: legendText
                });
            }
        }

        for (const el of interactiveNodes) {
            if (seenEl.has(el) || groupedRadioEls.has(el)) continue;
            seenEl.add(el);
            if (!this.isElementVisible(el)) continue;

            const role = this.inferRole(el);
            const label = this.extractLabel(el, root);
            const accessibleName = (el.getAttribute?.('aria-label') || el.textContent || label || '').replace(/\s+/g, ' ').trim().slice(0, 120);
            const options = el.tagName === 'SELECT'
                ? Array.from(el.options || []).map((o) => (o.text || o.value || '').trim()).filter(Boolean)
                : undefined;

            const stableAttrs = {};
            for (const attr of ['id', 'name', 'autocomplete', 'data-testid', 'data-automation-id', 'data-qa']) {
                const v = el.getAttribute?.(attr);
                if (v) stableAttrs[attr] = v;
            }

            const parentText = (el.closest?.('.field, .form-group, fieldset, [role="group"]')?.textContent || '')
                .replace(/\s+/g, ' ').trim().slice(0, 140);

            elements.push({
                index: elements.length,
                element: el,
                tag: (el.tagName || '').toLowerCase(),
                role,
                type: (el.type || '').toLowerCase(),
                label,
                accessibleName,
                placeholder: (el.placeholder || '').trim(),
                value: el.value !== undefined ? String(el.value) : '',
                checked: typeof el.checked === 'boolean' ? el.checked : undefined,
                disabled: Boolean(el.disabled),
                required: Boolean(el.required || el.getAttribute?.('aria-required') === 'true' || /\*/.test(label)),
                options,
                stableAttrs,
                parentContext: parentText
            });
        }

        const validationErrors = this.queryDeep(
            '.error, .field-error, .invalid-feedback, [role="alert"], [aria-invalid="true"], .artdeco-inline-feedback--error',
            scopeRoot
        )
            .filter((el) => this.isElementVisible(el))
            .map((el) => (el.textContent || el.getAttribute?.('data-error') || '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 0 && t.length < 200);

        const bodyTextSample = ((activeModal || root.body)?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
        const captchaDetected = Boolean(
            root.querySelector?.('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], .g-recaptcha, .cf-turnstile') ||
            /\b(verify you are human|complete the captcha|security check)\b/i.test(bodyTextSample)
        );

        const signature = `${url}|${headings.join(',')}|${elements.map((e) => `${e.role}:${e.label}:${e.value}`).join(';')}`;

        return {
            timestamp: Date.now(),
            url,
            title,
            headings,
            elements,
            inputs: elements.filter((e) => ['textbox', 'combobox', 'checkbox', 'radio', 'radiogroup', 'file'].includes(e.role)),
            buttons: elements.filter((e) => e.role === 'button'),
            validationErrors,
            captchaDetected,
            bodyTextSample,
            signature
        };
    }
};

if (typeof window !== 'undefined') window.PageObserver = PageObserver;
if (typeof module !== 'undefined' && module.exports) module.exports = PageObserver;
