import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function HomePage() {
  const session = await getServerSession()

  // If already authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      <div className="text-center space-y-8 max-w-lg">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
            <span className="text-2xl font-bold text-white">YT</span>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            YouTube Playlist Organiser
          </h1>
          <p className="text-lg text-muted-foreground">
            Organise your 87 playlists and 4,000+ videos with AI-powered categorisation
          </p>
        </div>

        {/* Sign in */}
        <Button asChild size="lg">
          <Link href="/api/auth/signin">
            Sign in with Google
          </Link>
        </Button>
      </div>
    </main>
  )
}
