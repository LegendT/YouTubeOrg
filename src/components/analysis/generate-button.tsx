'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { generateConsolidationProposal } from '@/app/actions/analysis'
import { useRouter } from 'next/navigation'

export function GenerateProposalButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await generateConsolidationProposal('aggressive')
      if (!result.success) {
        setError(result.errors?.join(', ') ?? 'Unknown error')
      }
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate proposals'
      setError(msg)
      console.error('Failed to generate proposals:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="lg" onClick={handleClick} disabled={isLoading}>
        {isLoading ? 'Analyzing playlists...' : 'Generate Consolidation Proposal'}
      </Button>
      {error && (
        <p className="text-sm text-destructive max-w-md text-right">{error}</p>
      )}
    </div>
  )
}
