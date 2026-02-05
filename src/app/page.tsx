import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const session = await getServerSession()

  // If already authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">YouTube Playlist Organizer</h1>
        <p className="text-xl text-gray-600">
          Organize your 87 playlists and 4,000+ videos with AI-powered categorization
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Sign in with Google
        </Link>
      </div>
    </main>
  )
}
