import { apiClient } from './client';

export async function sendTestEmail() {
    const response = await apiClient.post('/api/v1/email/send-stats');
    return response.data;
}


