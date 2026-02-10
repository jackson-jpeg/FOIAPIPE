import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.setState({
      token: null,
      username: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  it('initializes with default state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
  });

  it('sets auth state on login', () => {
    const { login } = useAuthStore.getState();
    login('test-token', 'admin');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('test-token');
    expect(state.username).toBe('admin');
  });

  it('persists token to localStorage on login', () => {
    const { login } = useAuthStore.getState();
    login('test-token', 'admin');

    expect(localStorage.getItem('token')).toBe('test-token');
    expect(localStorage.getItem('username')).toBe('admin');
  });

  it('clears auth state on logout', () => {
    const { login, logout } = useAuthStore.getState();

    // Login first
    login('test-token', 'admin');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Then logout
    logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.username).toBeNull();
  });

  it('removes token from localStorage on logout', () => {
    const { login, logout } = useAuthStore.getState();

    login('test-token', 'admin');
    expect(localStorage.getItem('token')).toBe('test-token');

    logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('username')).toBeNull();
  });
});
