
import React from 'react';
import type { Listing } from '../types';

interface PropertyDetailsProps {
  listing: Listing;
}

export const PropertyDetails: React.FC<PropertyDetailsProps> = ({ listing }) => {
  return (
    <div className="space-y-4 text-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <p className="font-semibold">MLS ID:</p>
          <p>{listing.ListingId}</p>
        </div>
        <div>
          <p className="font-semibold">Address:</p>
          <p>{listing.StreetName}, {listing.City}</p>
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
      </div>
      <div>
        <p className="font-semibold">Description:</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{listing.PublicRemarks}</p>
      </div>
    </div>
  );
};
