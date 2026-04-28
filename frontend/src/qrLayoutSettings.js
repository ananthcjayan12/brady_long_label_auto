export const LAYOUT_SETTINGS_STORAGE_KEY = 'qr_layout_profiles';

export const FONT_OPTIONS = [
    'Helvetica',
    'Helvetica-Bold',
    'Times-Roman',
    'Times-Bold',
    'Courier',
    'Courier-Bold'
];

export const DEFAULT_GLOBAL_LAYOUT = {
    width_in: 1.0,
    total_height_in: 1.5,
    top_printable_height_in: 0.5
};

export const DEFAULT_TEMPLATE_LAYOUTS = {
    template_1: {
        logo_x_in: 0.3,
        logo_top_in: 0.01,
        logo_width_in: 0.4,
        logo_height_in: 0,
        line1_font_name: 'Helvetica-Bold',
        line1_font_size: 6.7,
        line1_y_in: 0.235,
        line2_font_name: 'Helvetica-Bold',
        line2_font_size: 8.5,
        line2_y_in: 0.145,
        text_max_width_in: 0.92,
        barcode_y_in: 0.02,
        barcode_height_in: 0.08,
        barcode_bar_width_in: 0.009
    },
    template_2: {
        logo_x_in: 0.05,
        logo_top_in: 0.01,
        logo_width_in: 0.32,
        logo_height_in: 0,
        line1_font_name: 'Helvetica-Bold',
        line1_font_size: 6.5,
        line1_y_in: 0.225,
        line2_font_name: 'Helvetica-Bold',
        line2_font_size: 8.3,
        line2_y_in: 0.125,
        text_max_width_in: 0.92,
        barcode_y_in: 0.02,
        barcode_height_in: 0.075,
        barcode_bar_width_in: 0.008
    },
    template_3: {
        logo_x_in: 0.32,
        logo_top_in: 0.005,
        logo_width_in: 0.36,
        logo_height_in: 0,
        line1_font_name: 'Helvetica-Bold',
        line1_font_size: 8.4,
        line1_y_in: 0.18,
        line2_font_name: 'Helvetica-Bold',
        line2_font_size: 8.2,
        line2_y_in: 0.01,
        text_max_width_in: 0.95,
        barcode_y_in: 0.06,
        barcode_height_in: 0.09,
        barcode_bar_width_in: 0.0085
    }
};

export function getDefaultLayoutProfiles() {
    return {
        global: { ...DEFAULT_GLOBAL_LAYOUT },
        template_1: { ...DEFAULT_TEMPLATE_LAYOUTS.template_1 },
        template_2: { ...DEFAULT_TEMPLATE_LAYOUTS.template_2 },
        template_3: { ...DEFAULT_TEMPLATE_LAYOUTS.template_3 }
    };
}

function sanitizeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeTemplateLayout(raw, defaults) {
    const merged = { ...defaults, ...(raw || {}) };
    return {
        logo_x_in: sanitizeNumber(merged.logo_x_in, defaults.logo_x_in),
        logo_top_in: sanitizeNumber(merged.logo_top_in, defaults.logo_top_in),
        logo_width_in: sanitizeNumber(merged.logo_width_in, defaults.logo_width_in),
        logo_height_in: sanitizeNumber(merged.logo_height_in, defaults.logo_height_in),
        line1_font_name: merged.line1_font_name || defaults.line1_font_name,
        line1_font_size: sanitizeNumber(merged.line1_font_size, defaults.line1_font_size),
        line1_y_in: sanitizeNumber(merged.line1_y_in, defaults.line1_y_in),
        line2_font_name: merged.line2_font_name || defaults.line2_font_name,
        line2_font_size: sanitizeNumber(merged.line2_font_size, defaults.line2_font_size),
        line2_y_in: sanitizeNumber(merged.line2_y_in, defaults.line2_y_in),
        text_max_width_in: sanitizeNumber(merged.text_max_width_in, defaults.text_max_width_in),
        barcode_y_in: sanitizeNumber(merged.barcode_y_in, defaults.barcode_y_in),
        barcode_height_in: sanitizeNumber(merged.barcode_height_in, defaults.barcode_height_in),
        barcode_bar_width_in: sanitizeNumber(merged.barcode_bar_width_in, defaults.barcode_bar_width_in)
    };
}

export function normalizeLayoutProfiles(rawProfiles) {
    const defaults = getDefaultLayoutProfiles();
    const raw = rawProfiles || {};

    return {
        global: {
            ...defaults.global,
            ...(raw.global || {}),
            width_in: sanitizeNumber(raw?.global?.width_in, defaults.global.width_in),
            total_height_in: sanitizeNumber(raw?.global?.total_height_in, defaults.global.total_height_in),
            top_printable_height_in: sanitizeNumber(raw?.global?.top_printable_height_in, defaults.global.top_printable_height_in)
        },
        template_1: sanitizeTemplateLayout(raw.template_1, defaults.template_1),
        template_2: sanitizeTemplateLayout(raw.template_2, defaults.template_2),
        template_3: sanitizeTemplateLayout(raw.template_3, defaults.template_3)
    };
}

export function loadLayoutProfiles() {
    const stored = localStorage.getItem(LAYOUT_SETTINGS_STORAGE_KEY);
    if (!stored) {
        return getDefaultLayoutProfiles();
    }

    try {
        const parsed = JSON.parse(stored);
        return normalizeLayoutProfiles(parsed);
    } catch {
        return getDefaultLayoutProfiles();
    }
}

export function saveLayoutProfiles(profiles) {
    const normalized = normalizeLayoutProfiles(profiles);
    localStorage.setItem(LAYOUT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

export function buildLabelSettingsPayload(profiles, templateType) {
    const normalized = normalizeLayoutProfiles(profiles);
    const template = ['template_1', 'template_2', 'template_3'].includes(templateType) ? templateType : 'template_1';
    return {
        ...normalized.global,
        ...normalized[template]
    };
}
