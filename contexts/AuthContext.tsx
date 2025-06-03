
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Auth } from 'firebase/auth'; // Direct type imports
import * as firebaseAuth from 'firebase/auth'; // Namespaced import for auth functions

import { auth as firebaseAuthService } from '../services/firebaseService'; 

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(firebaseAuthService, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // Cleanup subscription on unmount
  }, []);

  const signup = async (email: string, password: string, displayName?: string) => {
    setError(null);
    setLoading(true);
    try {
      const userCredential = await firebaseAuth.createUserWithEmailAndPassword(firebaseAuthService, email, password);
      if (displayName && userCredential.user) {
        await firebaseAuth.updateProfile(userCredential.user, { displayName });
      }
      // onAuthStateChanged will handle setting currentUser
    } catch (err: any) {
      setError(err.message || "Failed to sign up.");
      console.error("Signup Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      await firebaseAuth.signInWithEmailAndPassword(firebaseAuthService, email, password);
      // onAuthStateChanged will handle setting currentUser
    } catch (err: any) {
      setError(err.message || "Failed to log in.");
      console.error("Login Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    setLoading(true);
    try {
      await firebaseAuth.signOut(firebaseAuthService);
      // onAuthStateChanged will handle setting currentUser to null
    } catch (err: any) {
      setError(err.message || "Failed to log out.");
      console.error("Logout Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    setError(null);
    try {
      await firebaseAuth.sendPasswordResetEmail(firebaseAuthService, email);
    } catch (err: any) {
      setError(err.message || "Failed to send password reset email.");
      console.error("Password Reset Error:", err);
      throw err; // Re-throw to be caught by caller if needed
    }
  };


  const value = {
    currentUser,
    loading,
    error,
    signup,
    login,
    logout,
    sendPasswordResetEmail,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};