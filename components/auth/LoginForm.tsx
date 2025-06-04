import React, { useState, FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../Input';
import { Button } from '../Button';
import { LoadingIcon } from '../icons/LoadingIcon';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, clearError, sendPasswordResetEmail } = useAuth();
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError(); // Clear previous global errors
    setResetError(null);
    setResetEmailSent(false);
    await login(email, password);
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setResetError("Please enter your email address above to reset password.");
      return;
    }
    clearError();
    setResetError(null);
    setResetEmailSent(false);
    setIsSubmittingReset(true);
    try {
      await sendPasswordResetEmail(email);
      setResetEmailSent(true);
    } catch (err: any) {
      setResetError(err.message || "Failed to send password reset email.");
    } finally {
      setIsSubmittingReset(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-red-500 text-sm text-center p-2 bg-red-100 rounded-md">{error}</p>}
      <div>
        <label htmlFor="email-login" className="block text-sm font-medium text-slate-700">
          Email address
        </label>
        <Input
          id="email-login"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
          disabled={loading || isSubmittingReset}
        />
      </div>

      <div>
        <label htmlFor="password-login" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <Input
          id="password-login"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1"
          disabled={loading || isSubmittingReset}
        />
      </div>
      
      <div className="text-sm">
          <Button 
            type="button" 
            variant="ghost" 
            size="small" 
            onClick={handlePasswordReset} 
            disabled={loading || isSubmittingReset}
            className="font-medium text-sky-600 hover:text-sky-500 p-0 h-auto"
           >
            Forgot your password?
          </Button>
        {isSubmittingReset && <LoadingIcon className="w-4 h-4 inline ml-2 animate-spin" />}
      </div>
      {resetEmailSent && <p className="text-green-600 text-sm">Password reset email sent to {email}. Please check your inbox.</p>}
      {resetError && <p className="text-red-500 text-sm">{resetError}</p>}


      <div>
        <Button type="submit" variant="primary" className="w-full" disabled={loading || isSubmittingReset}>
          {loading && !isSubmittingReset ? <LoadingIcon className="w-5 h-5 mr-2 animate-spin" /> : null}
          Sign in
        </Button>
      </div>
    </form>
  );
};
