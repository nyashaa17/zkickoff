import Link from 'next/link';
import { Trophy } from 'lucide-react';

export default function WorldCupTicker() {
  return (
    <div className="sticky top-0 z-50 bg-[#009739] text-white py-2 w-full text-center shadow-lg">
      <Link href="/worldcup" className="flex items-center justify-center gap-2 text-sm font-bold hover:underline">
        <Trophy className="w-4 h-4" />
        <span>World Cup 2026: View Squads, Fixtures, and Tables</span>
      </Link>
    </div>
  );
}
