import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { Button } from '../Button'; // Assuming Button component exists and is styled

export const AuthPage: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
        <div>
          <h1 className="text-center text-4xl font-bold text-sky-700">
            Featured Listing Maker
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600">
            {isLoginView ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {isLoginView ? <LoginForm /> : <SignupForm />}

        <div className="text-sm text-center">
          {isLoginView ? (
            <p className="text-slate-600">
              Don't have an account?{' '}
              <Button variant="ghost" size="small" onClick={() => setIsLoginView(false)} className="font-medium text-sky-600 hover:text-sky-500 p-1">
                Sign up
              </Button>
            </p>
          ) : (
            <p className="text-slate-600">
              Already have an account?{' '}
              <Button variant="ghost" size="small" onClick={() => setIsLoginView(true)} className="font-medium text-sky-600 hover:text-sky-500 p-1">
                Sign in
              </Button>
            </p>
          )}
        </div>
      </div>
       <footer className="text-center py-10 mt-12 border-t border-slate-300 w-full max-w-md">
        <p className="text-sm text-slate-500">
          Made by <a href="mailto:i@aryanbawa.ca" className="text-sky-600 hover:text-sky-700 hover:underline">Aryan Bawa</a>. For demonstration purposes.
        </p>
        <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Featured Listing Maker.</p>
      </footer>
    </div>
  );
};
