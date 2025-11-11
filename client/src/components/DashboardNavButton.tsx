import React from 'react';
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function DashboardNavButton() {
  return (
    <Link href="/dashboard">
      <Button className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 shadow-lg px-6 py-6 rounded-full" size="lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
        Dashboard
      </Button>
    </Link>
  );
}