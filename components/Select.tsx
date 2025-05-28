
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ children, className = '', ...props }) => {
  const baseStyles = "block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm disabled:bg-slate-50 disabled:text-slate-500";
  
  return (
    <select
      className={`${baseStyles} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};
