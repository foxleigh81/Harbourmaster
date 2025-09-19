import type { 
  ApiResponse, 
  Container, 
  AuthResponse, 
  HealthResponse,
  ErrorCode 
} from '@harbourmaster/shared';

class ApiClient {
  private baseUrl = '/api';
  private token: string | null = localStorage.getItem('harbourmaster_token');
  private csrfToken: string | null = localStorage.getItem('harbourmaster_csrf');

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok && response.status === 401) {
      this.clearAuth();
      window.location.href = '/login';
    }

    return data;
  }

  setAuth(token: string, csrf?: string): void {
    this.token = token;
    localStorage.setItem('harbourmaster_token', token);
    if (csrf) {
      this.csrfToken = csrf;
      localStorage.setItem('harbourmaster_csrf', csrf);
    }
  }

  clearAuth(): void {
    this.token = null;
    this.csrfToken = null;
    localStorage.removeItem('harbourmaster_token');
    localStorage.removeItem('harbourmaster_csrf');
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async login(password: string): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });

    if (response.success && response.data?.token) {
      this.setAuth(response.data.token, response.data.csrf);
    }

    return response;
  }

  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  async getContainers(all = false): Promise<ApiResponse<Container[]>> {
    return this.request<Container[]>(`/containers?all=${all}`);
  }

  async getContainer(id: string): Promise<ApiResponse<Container>> {
    return this.request<Container>(`/containers/${id}`);
  }

  async startContainer(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/containers/${id}/start`, {
      method: 'POST',
    });
  }

  async stopContainer(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/containers/${id}/stop`, {
      method: 'POST',
    });
  }

  async restartContainer(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/containers/${id}/restart`, {
      method: 'POST',
    });
  }

  async deleteContainer(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/containers/${id}`, {
      method: 'DELETE',
    });
  }

  async getContainerLogs(
    id: string,
    options: { since?: number; follow?: boolean; tail?: number } = {}
  ): Promise<EventSource> {
    const params = new URLSearchParams();
    if (options.since) params.append('since', options.since.toString());
    if (options.follow) params.append('follow', 'true');
    if (options.tail) params.append('tail', options.tail.toString());

    const url = `${this.baseUrl}/containers/${id}/logs?${params}`;
    const eventSource = new EventSource(url);
    
    return eventSource;
  }

  subscribeToEvents(): EventSource {
    return new EventSource(`${this.baseUrl}/events`);
  }
}

export const apiClient = new ApiClient();