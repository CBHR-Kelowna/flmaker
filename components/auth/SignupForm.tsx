import React, { useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { Input } from '../Input.js';
import { Button } from '../Button.js';
import { LoadingIcon } from '../icons/LoadingIcon.js';

export const SignupForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { signup, loading, error, clearError } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await signup(email, password, displayName);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-500 text-sm text-center p-2 bg-red-100 rounded-md">{error}</p>}
      <div>
        <label htmlFor="displayName-signup" className="block text-sm font-medium text-slate-700">
          Full Name (Optional)
        </label>
        <Input
          id="displayName-signup"
          name="displayName"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
          className="mt-1"
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="email-signup" className="block text-sm font-medium text-slate-700">
          Email address
        </label>
        <Input
          id="email-signup"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          className="mt-1"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password-signup" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <Input
          id="password-signup"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          className="mt-1"
          disabled={loading}
          minLength={6}
        />
         <p className="mt-1 text-xs text-slate-500">Password should be at least 6 characters.</p>
      </div>

      <div>
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? <LoadingIcon className="w-5 h-5 mr-2 animate-spin" /> : null}
          Sign up
        </Button>
      </div>
    </form>
  );
};