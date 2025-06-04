import React from 'react';
import { Input } from './Input.js';
import { Button } from './Button.js';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon.js';

interface SearchBarProps {
  onSearch: (mlsId: string) => void;
  isLoading: boolean;
  initialValue: string;
  setInitialValue: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, initialValue, setInitialValue }) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearch(initialValue);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
      <div className="flex-grow w-full">
        <label htmlFor="mlsId" className="block text-sm font-medium text-slate-700 mb-1">
          MLS Number
        </label>
        <Input
          type="text"
          id="mlsId"
          value={initialValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInitialValue(e.target.value)}
          placeholder="Enter MLS ID (e.g., 10305307)"
          disabled={isLoading}
          className="w-full"
        />
      </div>
      <Button type="submit" disabled={isLoading || !initialValue} variant="primary" className="w-full sm:w-auto">
        {isLoading ? 'Searching...' : <><MagnifyingGlassIcon className="w-5 h-5 mr-2" />Search</>}
      </Button>
    </form>
  );
};