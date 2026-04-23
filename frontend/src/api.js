import axios from 'axios';

const getBaseUrl = () => {
    const storedUrl = localStorage.getItem('api_url');
    return storedUrl || 'http://localhost:5001';
};

export const api = {
    checkHealth: async () => {
        const res = await axios.get(`${getBaseUrl()}/health`);
        return res.data;
    },

    getPrinters: async () => {
        const res = await axios.get(`${getBaseUrl()}/api/printers`);
        return res.data;
    },

    printQrLabel: async ({ data, label, printerName = null, labelSettings = {}, username = 'template-user' }) => {
        const res = await axios.post(`${getBaseUrl()}/api/qr/print`, {
            data,
            label,
            printer_name: printerName,
            label_settings: labelSettings,
            username
        });
        return res.data;
    }
};

