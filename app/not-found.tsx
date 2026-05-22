import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 space-y-4">
      <h2 className="text-2xl font-bold">404 - Not Found</h2>
      <p>The page you requested could not be found.</p>
      <Link href="/" className="px-4 py-2 bg-zim-green text-white rounded-lg">Return Home</Link>
    </div>
  );
}
