import client from './client';

interface LoginResponse {
  access_token: string;
  token_type: string;
}

export async function login(username: string, password: string): Promise<string> {
  const response = await client.post<LoginResponse>('/auth/login', { username, password });

  const token = response.data.access_token;
  localStorage.setItem('foiapipe_token', token);
  return token;
}

export function logout(): void {
  localStorage.removeItem('foiapipe_token');
}
