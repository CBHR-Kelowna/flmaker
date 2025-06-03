
import React, { useState, useEffect, FormEvent } from 'react';
import type { UserProfile } from '../../types';
import { updateUserProfile as apiUpdateUserProfile } from '../../services/userService';
import { Input } from '../Input';
import { Button } from '../Button';
import { LoadingIcon } from '../icons/LoadingIcon';

interface ProfilePageProps {
  userProfile: UserProfile | null;
  onProfileUpdate: (updatedProfile: UserProfile) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ userProfile, onProfileUpdate }) => {
  const [agentKeyInput, setAgentKeyInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.agentKey) {
      setAgentKeyInput(userProfile.agentKey);
    } else {
      setAgentKeyInput(''); // Reset if profile has no key or profile is null
    }
  }, [userProfile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const keyToSave = agentKeyInput.trim() === '' ? null : agentKeyInput.trim();
      const updatedProfile = await apiUpdateUserProfile(keyToSave);
      onProfileUpdate(updatedProfile);
      setSuccessMessage('Profile updated successfully!');
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError((err as Error).message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <LoadingIcon className="w-8 h-8 mx-auto text-sky-600 animate-spin mb-4" />
            <p className="text-slate-600">Loading profile information...</p>
        </div>
      );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2">Your Profile</h1>
        <p className="text-slate-600 mb-6">Manage your account settings and agent information.</p>
        
        <div className="mb-6 p-4 border border-slate-200 rounded-md bg-slate-50">
            <p className="text-sm font-medium text-slate-700">Display Name:</p>
            <p className="text-slate-900">{userProfile.displayName || 'Not set'}</p>
            <p className="text-sm font-medium text-slate-700 mt-2">Email:</p>
            <p className="text-slate-900">{userProfile.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="agentKey" className="block text-sm font-medium text-slate-700 mb-1">
              Agent Key (MLS Identifier)
            </label>
            <Input
              type="text"
              id="agentKey"
              value={agentKeyInput}
              onChange={(e) => setAgentKeyInput(e.target.value)}
              placeholder="Enter your MLS Agent Key (e.g., KEL012345)"
              className="w-full"
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-slate-500">
              This key is used to find your listings (matches 'ListAgentKey' or 'CoListAgentKey' in the database). 
              Contact support if you're unsure what to enter. Leave blank to clear.
            </p>
          </div>

          {error && <p className="text-red-500 text-sm p-3 bg-red-100 rounded-md">{error}</p>}
          {successMessage && <p className="text-green-600 text-sm p-3 bg-green-100 rounded-md">{successMessage}</p>}

          <div>
            <Button type="submit" variant="primary" size="medium" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? <LoadingIcon className="w-5 h-5 mr-2 animate-spin" /> : null}
              {isLoading ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
