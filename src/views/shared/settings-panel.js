/**
 * Generic settings panel: table built from a fields config, filter, refresh/apply callbacks.
 * Use with shared/settings-fields.json and view-specific settings-fields.json (optional).
 *
 * @param {Object} options
 * @param {string} [options.settingsBtnId='settingsBtn']
 * @param {string} [options.settingsPanelId='settingsPanel']
 * @param {string} [options.filterInputId='settingsFilter']
 * @param {string} [options.rowCountId='settingsRowCount']
 * @param {string} [options.tbodyId='settingsTableBody']
 * @param {string} [options.applyBtnId='applySettingsBtn']
 * @param {string} [options.closeSettingsBtnId='closeSettingsBtn']
 * @param {() => Promise<Array<{id: string, label: string, type?: string, step?: number, min?: number, ariaLabel?: string, boundsKey?: string}>>} options.getFields
 * @param {() => Object} options.getValues - Current values keyed by boundsKey (e.g. { x, y, width, height })
 * @param {(values: Object) => void} options.applyValues
 * @param {(values: Object) => boolean} [options.validate] - Return true if values are valid for apply
 * @param {string} [options.logLabel='Settings'] - Label for console.log on Apply (e.g. 'StrudelApp')
 */
export async function initSettingsPanel(options) {
    const {
        settingsBtnId = 'settingsBtn',
        settingsPanelId = 'settingsPanel',
        filterInputId = 'settingsFilter',
        rowCountId = 'settingsRowCount',
        tbodyId = 'settingsTableBody',
        applyBtnId = 'applySettingsBtn',
        closeSettingsBtnId = 'closeSettingsBtn',
        getFields,
        getValues,
        applyValues,
        validate = () => true,
        logLabel = 'Settings',
    } = options;

    const settingsBtn = document.getElementById(settingsBtnId);
    const settingsPanel = document.getElementById(settingsPanelId);
    const filterInput = document.getElementById(filterInputId);
    const rowCountEl = document.getElementById(rowCountId);
    const tbody = document.getElementById(tbodyId);
    const applyBtn = document.getElementById(applyBtnId);
    const closeSettingsBtn = document.getElementById(closeSettingsBtnId);

    if (!settingsBtn || !settingsPanel || !tbody || !applyBtn) return;

    const fields = await getFields();
    if (!Array.isArray(fields) || fields.length === 0) return;

    tbody.innerHTML = '';
    fields.forEach((field) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = field.label;
        const td = document.createElement('td');
        const input = document.createElement('input');
        const isCheckbox = (field.type || '').toLowerCase() === 'checkbox';
        input.type = isCheckbox ? 'checkbox' : (field.type || 'number');
        input.id = field.id;
        if (!isCheckbox) {
            input.step = String(field.step ?? 1);
            if (field.min != null) input.min = String(field.min);
            if (field.max != null) input.max = String(field.max);
        }
        if (field.ariaLabel) input.setAttribute('aria-label', field.ariaLabel);
        td.appendChild(input);
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
    });

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const totalRows = rows.length;

    const getRowSearchText = (tr) => {
        const th = tr.querySelector('th');
        const td = tr.querySelector('td');
        const label = th ? th.textContent.trim() : '';
        const input = td?.querySelector('input');
        const value = input?.type === 'checkbox' ? (input.checked ? 'yes' : 'no') : (input?.value ?? '');
        return (label + ' ' + value).toLowerCase();
    };

    const applyFilter = () => {
        const filter = (filterInput?.value ?? '').trim().toLowerCase();
        let visible = 0;
        rows.forEach((tr) => {
            const show = !filter || getRowSearchText(tr).includes(filter);
            tr.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        if (rowCountEl) {
            rowCountEl.textContent = `${visible} / ${totalRows}`;
        }
    };

    if (filterInput) {
        filterInput.addEventListener('input', applyFilter);
        filterInput.addEventListener('change', applyFilter);
    }

    const refreshInputs = () => {
        const values = getValues();
        if (values == null || typeof values !== 'object') return;
        fields.forEach((field) => {
            const input = document.getElementById(field.id);
            if (!input || field.boundsKey == null) return;
            if (input.type === 'checkbox') {
                input.checked = !!values[field.boundsKey];
            } else if (values[field.boundsKey] != null) {
                input.value = String(Math.round(Number(values[field.boundsKey])));
            }
        });
        applyFilter();
    };

    const apply = () => {
        const values = {};
        let valid = true;
        fields.forEach((field) => {
            const input = document.getElementById(field.id);
            if (!input || field.boundsKey == null) return;
            if (input.type === 'checkbox') {
                values[field.boundsKey] = input.checked;
            } else {
                const num = Math.round(Number(input.value));
                values[field.boundsKey] = num;
                if (!Number.isFinite(num)) valid = false;
                if (field.min != null && num < field.min) valid = false;
                if (field.max != null && num > field.max) valid = false;
            }
        });
        if (!valid || !validate(values)) return;
        applyValues(values);
    };

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !settingsPanel.hidden;
        settingsPanel.hidden = isOpen;
        settingsBtn.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) {
            if (filterInput) filterInput.value = '';
            refreshInputs();
        }
    });

    applyBtn.addEventListener('click', () => {
        if (logLabel) console.log(`[${logLabel}] Settings Apply clicked`);
        apply();
    });

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            refreshInputs();
            settingsPanel.hidden = true;
            settingsBtn.setAttribute('aria-expanded', 'false');
        });
    }

    fields.forEach((field) => {
        const input = document.getElementById(field.id);
        if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    });

    applyFilter();

    document.addEventListener('click', (e) => {
        if (settingsPanel.hidden) return;
        if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsPanel.hidden = true;
            settingsBtn.setAttribute('aria-expanded', 'false');
        }
    });
}

/** Default settings fields when JSON cannot be loaded. */
export const DEFAULT_SETTINGS_FIELDS = [
    { id: 'settingsWindowX', label: 'Window X', type: 'number', step: 1, ariaLabel: 'Window X position', boundsKey: 'x' },
    { id: 'settingsWindowY', label: 'Window Y', type: 'number', step: 1, ariaLabel: 'Window Y position', boundsKey: 'y' },
    { id: 'settingsWidth', label: 'Width', type: 'number', min: 100, step: 1, ariaLabel: 'Window width', boundsKey: 'width' },
    { id: 'settingsHeight', label: 'Height', type: 'number', min: 100, step: 1, ariaLabel: 'Window height', boundsKey: 'height' },
];
