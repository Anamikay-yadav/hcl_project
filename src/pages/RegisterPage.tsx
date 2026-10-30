import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/ui';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin, onSuccess }) => {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setIsLoading(true);
    setError(null);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim() || username.trim(),
        role: 'Data Analyst',
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Create account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-neg" role="alert">{error}</p>}
        <div>
          <label htmlFor="fullName" className="label">Full name</label>
          <input id="fullName" className="field h-10" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reg-username" className="label">Username</label>
            <input id="reg-username" className="field h-10" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <label htmlFor="reg-email" className="label">Email</label>
            <input id="reg-email" type="email" className="field h-10" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reg-password" className="label">Password</label>
            <input id="reg-password" type="password" className="field h-10" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div>
            <label htmlFor="reg-confirm" className="label">Confirm password</label>
            <input id="reg-confirm" type="password" className="field h-10" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
          </div>
        </div>
        <button type="submit" disabled={isLoading} className="btn-primary w-full h-10">
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-sm text-ink-muted text-center">
          Already registered?{' '}
          <button type="button" onClick={onSwitchToLogin} className="text-navy-600 font-medium hover:underline">
            Sign in
          </button>
        </p>
      </form>
    </AuthShell>
  );
};
