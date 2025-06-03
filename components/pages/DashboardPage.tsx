
import React, { useEffect, useState } from 'react';
import type { UserProfile, Listing } from '../../types';
import type { User as FirebaseUser } from 'firebase/auth'; // Ensured User type import, aliased for consistency
import { fetchAgentListings } from '../../services/userService';
import { Button } from '../Button';
import { LoadingIcon } from '../icons/LoadingIcon';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';
import { PhotoIcon } from '../icons/PhotoIcon'; // Placeholder for listing card image

interface DashboardPageProps {
  currentUser: FirebaseUser; // Use aliased type
  userProfile: UserProfile | null;
  navigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser, userProfile, navigate }) => {
  const [agentListings, setAgentListings] = useState<Listing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadListings = async () => {
      if (userProfile?.agentKey) {
        setIsLoadingListings(true);
        setError(null);
        try {
          const listings = await fetchAgentListings();
          setAgentListings(listings);
        } catch (err) {
          console.error("Failed to fetch agent listings:", err);
          setError((err as Error).message || "Could not load your listings.");
        } finally {
          setIsLoadingListings(false);
        }
      } else {
        setAgentListings([]); // Clear listings if no agent key
      }
    };

    if (userProfile) { // Only attempt to load if userProfile is available
        loadListings();
    }
  }, [userProfile]);

  const getListingImageUrl = (photoGallery: string): string | undefined => {
    if (!photoGallery) return undefined;
    const urls = photoGallery.split(' ');
    return urls.length > 0 ? urls[0] : undefined;
  };

  const getGreetingName = () => {
    if (userProfile?.displayName && userProfile.displayName.trim() !== '') {
      return userProfile.displayName;
    }
    if (currentUser?.displayName && currentUser.displayName.trim() !== '') {
      return currentUser.displayName;
    }
    return null; // Only email is available, which is already in header
  };

  const greetingName = getGreetingName();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h1 className="text-3xl font-semibold text-slate-800">
          {greetingName ? `Welcome, ${greetingName}!` : 'Welcome!'}
        </h1>
        <p className="text-slate-600 mt-1">This is your dashboard. Manage your listings and profile here.</p>
      </div>

      {!userProfile?.agentKey && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md shadow-md" role="alert">
          <div className="flex">
            <div className="py-1"><ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-3"/></div>
            <div>
              <p className="font-bold">Agent Key Missing</p>
              <p className="text-sm">
                Please set your Agent Key in your profile to view and manage your listings. 
                This key links your account to your properties in the MLS database.
              </p>
              <Button onClick={() => navigate('#/profile')} variant="secondary" size="small" className="mt-2 border-yellow-600 text-yellow-800 hover:bg-yellow-200">
                Go to Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-white p-6 rounded-lg shadow-lg" aria-labelledby="my-listings-heading">
        <div className="flex justify-between items-center mb-4">
            <h2 id="my-listings-heading" className="text-2xl font-semibold text-slate-700">My Listings</h2>
            <Button onClick={() => navigate('#/create')} variant="primary" size="medium">
                Create New Package
            </Button>
        </div>

        {isLoadingListings && (
            <div className="flex justify-center items-center py-10">
                <LoadingIcon className="w-10 h-10 text-sky-600 animate-spin" />
                <p className="ml-3 text-slate-600">Loading your listings...</p>
            </div>
        )}

        {error && !isLoadingListings && (
            <div className="text-red-600 bg-red-100 p-3 rounded-md text-center">
                <p>{error}</p>
            </div>
        )}

        {!isLoadingListings && !error && agentListings.length === 0 && userProfile?.agentKey && (
            <div className="text-center py-10 text-slate-500">
                <PhotoIcon className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <p>No listings found associated with your Agent Key: "{userProfile.agentKey}".</p>
                <p className="text-sm mt-1">Ensure your Agent Key is correct in your Profile, or try creating a new package.</p>
            </div>
        )}
         {!isLoadingListings && !error && agentListings.length === 0 && !userProfile?.agentKey && (
            <div className="text-center py-10 text-slate-500">
                <p>Update your profile with your Agent Key to see your listings here.</p>
            </div>
        )}


        {!isLoadingListings && agentListings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {agentListings.map(listing => (
              <div key={listing.ListingId} className="bg-slate-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-200 flex flex-col">
                {getListingImageUrl(listing.PhotoGallery) ? (
                  <img 
                    src={getListingImageUrl(listing.PhotoGallery)} 
                    alt={listing.UnparsedAddress || `${listing.StreetName}, ${listing.City}`} 
                    className="w-full h-48 object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => (e.currentTarget.style.display = 'none')} // Hide if image fails
                  />
                ) : (
                  <div className="w-full h-48 bg-slate-200 flex items-center justify-center">
                    <PhotoIcon className="w-16 h-16 text-slate-400" />
                  </div>
                )}
                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-sky-700 truncate" title={listing.UnparsedAddress || `${listing.StreetName}, ${listing.City}`}>
                        {listing.UnparsedAddress || `${listing.StreetName}, ${listing.City}`}
                    </h3>
                    <p className="text-sm text-slate-600">MLS®: {listing.ListingId}</p>
                    <p className="text-md font-medium text-slate-800 mt-1">
                        {listing.ListPrice ? `$${listing.ListPrice.toLocaleString()}` : 'Price N/A'}
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate(`#/create/${listing.ListingId}`)} 
                    variant="secondary" 
                    size="small" 
                    className="w-full mt-3"
                   >
                    Edit/Create Package
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};