

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import type { UserProfile } from './types';
import type { User } from 'firebase/auth'; // Ensured User type import
import { fetchUserProfile } from './services/userService';

import { AuthPage } from './components/auth/AuthPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { CreateListingPage } from './components/pages/CreateListingPage';
import { ProfilePage } from './components/pages/ProfilePage';

import { LoadingIcon } from './components/icons/LoadingIcon';
import { Button } from './components/Button';
import { UserCircleIcon } from './components/icons/UserCircleIcon';
import { ArrowLeftOnRectangleIcon } from './components/icons/ArrowLeftOnRectangleIcon';
import { HomeIcon } from './components/icons/HomeIcon'; // For Dashboard
import { PlusCircleIcon } from './components/icons/PlusCircleIcon'; // For Create New
import { Cog6ToothIcon } from './components/icons/Cog6ToothIcon'; // For Profile

const App: React.FC = () => {
  const { currentUser, loading: authLoading, logout, error: authError } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/dashboard');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    if (authError) {
      setAppError(`Authentication Error: ${authError}`);
    }
  }, [authError]);

  const handleHashChange = useCallback(() => {
    const newHash = window.location.hash || '#/dashboard';
    console.log('Hash changed to:', newHash);
    setCurrentPath(newHash);
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial check
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [handleHashChange]);

  const loadUserProfile = useCallback(async () => {
    if (currentUser && !userProfile) {
      setIsLoadingProfile(true);
      setAppError(null);
      try {
        const profile = await fetchUserProfile();
        setUserProfile(profile);
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setAppError((err as Error).message || "Failed to load user profile.");
        // If profile load fails, maybe redirect to login or show specific error
      } finally {
        setIsLoadingProfile(false);
      }
    } else if (!currentUser) {
      setUserProfile(null); // Clear profile on logout
    }
  }, [currentUser, userProfile]); // Added userProfile to dependencies to avoid re-fetching if already loaded

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);
  
  const navigate = (path: string) => {
    window.location.hash = path;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <LoadingIcon className="w-16 h-16 text-sky-600 animate-spin" />
        <p className="mt-4 text-slate-600 text-lg">Loading application...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }
  
  if (isLoadingProfile && !userProfile) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <LoadingIcon className="w-16 h-16 text-sky-600 animate-spin" />
        <p className="mt-4 text-slate-600 text-lg">Loading user profile...</p>
      </div>
    );
  }


  let pageContent;
  const routeParts = currentPath.split('/'); // e.g., #/create/mls123 -> ['', '#', 'create', 'mls123']
  // Correctly determine baseRoute and param
  // #/dashboard -> ['', 'dashboard'] -> baseRoute: #/dashboard, param: undefined
  // #/create -> ['', 'create'] -> baseRoute: #/create, param: undefined
  // #/create/123 -> ['', 'create', '123'] -> baseRoute: #/create, param: 123
  // Ensure routeParts[0] is empty string due to leading '#'
  const actualRouteSegments = currentPath.substring(1).split('/').filter(p => p); // Remove '#' and empty parts
  
  let baseRoutePath = 'dashboard'; // default
  let param;

  if (actualRouteSegments.length > 0) {
    baseRoutePath = actualRouteSegments[0];
    if (actualRouteSegments.length > 1) {
      param = actualRouteSegments[1];
    }
  }
  const baseRoute = `#/${baseRoutePath}`;


  switch (baseRoute) {
    case '#/create':
      pageContent = <CreateListingPage currentUser={currentUser as User} userProfile={userProfile} mlsIdFromUrl={param} />;
      break;
    case '#/profile':
      pageContent = <ProfilePage userProfile={userProfile} onProfileUpdate={setUserProfile} />;
      break;
    case '#/dashboard':
    default:
      pageContent = <DashboardPage currentUser={currentUser as User} userProfile={userProfile} navigate={navigate} />;
      break;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <a href="#/dashboard" className="text-2xl font-bold text-sky-700 hover:text-sky-600 transition-colors">
                Featured Listing Maker
              </a>
            </div>
            <nav className="hidden md:flex space-x-4 items-center">
              <Button onClick={() => navigate('#/dashboard')} variant={currentPath.startsWith('#/dashboard') ? "primary" : "ghost"} size="small" aria-label="Dashboard">
                <HomeIcon className="w-5 h-5 mr-1" /> Dashboard
              </Button>
              <Button onClick={() => navigate('#/create')} variant={currentPath.startsWith('#/create') ? "primary" : "ghost"} size="small" aria-label="Create New Listing">
                <PlusCircleIcon className="w-5 h-5 mr-1" /> Create
              </Button>
              <Button onClick={() => navigate('#/profile')} variant={currentPath.startsWith('#/profile') ? "primary" : "ghost"} size="small" aria-label="Profile">
                <Cog6ToothIcon className="w-5 h-5 mr-1" /> Profile
              </Button>
            </nav>
            <div className="flex items-center space-x-3">
              {(currentUser.displayName || currentUser.email) && (
                <span className="text-slate-700 hidden sm:flex items-center text-sm">
                  <UserCircleIcon className="w-6 h-6 mr-2 text-sky-600" />
                  {currentUser.displayName || currentUser.email}
                </span>
              )}
              <Button onClick={logout} variant="secondary" size="small" aria-label="Logout">
                <ArrowLeftOnRectangleIcon className="w-5 h-5 sm:mr-2" /> <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
           {/* Mobile Nav Toggle (optional, simple links for now) */}
          <div className="md:hidden flex justify-around py-2 border-t border-slate-200">
              <Button onClick={() => navigate('#/dashboard')} variant="ghost" size="small" className={`flex-1 justify-center ${currentPath.startsWith('#/dashboard') ? "text-sky-600 font-semibold" : ""}`}>
                <HomeIcon className="w-5 h-5" />
              </Button>
              <Button onClick={() => navigate('#/create')} variant="ghost" size="small" className={`flex-1 justify-center ${currentPath.startsWith('#/create') ? "text-sky-600 font-semibold" : ""}`}>
                <PlusCircleIcon className="w-5 h-5" />
              </Button>
              <Button onClick={() => navigate('#/profile')} variant="ghost" size="small" className={`flex-1 justify-center ${currentPath.startsWith('#/profile') ? "text-sky-600 font-semibold" : ""}`}>
                <Cog6ToothIcon className="w-5 h-5" />
              </Button>
          </div>
        </div>
      </header>

      <main className="py-8 px-4 sm:px-6 lg:px-8">
        {appError && (
            <div className="max-w-6xl mx-auto mb-4 p-4 rounded-md shadow bg-red-100 border-l-4 border-red-500 text-red-700" role="alert">
                <p className="font-bold">Application Error</p>
                <p>{appError}</p>
            </div>
        )}
        <div className="max-w-6xl mx-auto">
            {pageContent}
        </div>
      </main>

      <footer className="text-center py-10 mt-12 border-t border-slate-300">
        <p className="text-sm text-slate-500">
          Made by <a href="mailto:i@aryanbawa.ca" className="text-sky-600 hover:text-sky-700 hover:underline">Aryan Bawa</a>.
        </p>
        <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Featured Listing Maker. For demonstration purposes.</p>
      </footer>
    </div>
  );
};

export default App;