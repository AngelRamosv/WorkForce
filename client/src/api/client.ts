import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://192.168.51.123:5000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
