import React from 'react';
import type { Listing } from '../types.js';

interface PropertyDetailsProps {
  listing: Listing;
}

// Helper to format bed/bath display for PropertyDetails component
const getBedBathDisplayForDetails = (listing: Listing): string | null => {
  let bedsStr = "";
  if (listing.BedroomsTotal && listing.BedroomsTotal > 0) {
    bedsStr = `${listing.BedroomsTotal} Bed${listing.BedroomsTotal > 1 ? 's' : ''}`;
  }

  let totalBaths = 0;
  if (listing.BathroomsTotalInteger && listing.BathroomsTotalInteger > 0) {
    totalBaths += listing.BathroomsTotalInteger;
  }
  if (listing.BathroomsPartial && listing.BathroomsPartial > 0) {
    totalBaths += listing.BathroomsPartial; 
  }
  
  let bathsStr = "";
  if (totalBaths > 0) {
    bathsStr = `${totalBaths} Bath${totalBaths > 1 ? 's' : ''}`;
  }

  if (bedsStr && bathsStr) {
    return `${bedsStr}  •  ${bathsStr}`;
  } else if (bedsStr) {
    return bedsStr;
  } else if (bathsStr) {
    return bathsStr;
  }
  return null;
};


export const PropertyDetails: React.FC<PropertyDetailsProps> = ({ listing }) => {
  const bedBathInfo = getBedBathDisplayForDetails(listing);
  const displayAddress = listing.UnparsedAddress 
    ? listing.UnparsedAddress 
    : `${listing.StreetName}, ${listing.City}`;

  return (
    <div className="space-y-4 text-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <p className="font-semibold">MLS® Number:</p>
          <p>{listing.ListingId}</p>
        </div>
        <div>
          <p className="font-semibold">Address:</p>
          <p>{displayAddress}</p>
        </div>
        <div>
          <p className="font-semibold">Price:</p>
          <p>
            {typeof listing.ListPrice === 'number' 
              ? `$${listing.ListPrice.toLocaleString()}` 
              : 'Price not available'}
          </p>
        </div>
        <div>
          <p className="font-semibold">Office:</p>
          <p>{listing.OfficeName}</p>
        </div>
        {bedBathInfo && (
          <div className="md:col-span-2">
            <p className="font-semibold">Features:</p>
            <p>{bedBathInfo}</p>
          </div>
        )}
      </div>
      <div>
        <p className="font-semibold">Description:</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.PublicRemarks}</p>
      </div>
    </div>
  );
};