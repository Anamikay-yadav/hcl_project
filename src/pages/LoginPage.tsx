import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/ui';

interface LoginPageProps {
  onSwitchToRegister: () => void;
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister, onSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login({ username: username.trim(), password });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-neg" role="alert">{error}</p>}
        <div>
          <label htmlFor="username" className="label">Username or email</label>
          <input
            id="username"
            className="field h-10"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            className="field h-10"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" disabled={isLoading} className="btn-primary w-full h-10">
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-ink-muted text-center">
          New analyst?{' '}
          <button type="button" onClick={onSwitchToRegister} className="text-navy-600 font-medium hover:underline">
            Create an account
          </button>
        </p>
      </form>
    </AuthShell>
  );
};
