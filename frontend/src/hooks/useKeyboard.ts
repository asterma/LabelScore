import { useEffect, useCallback } from 'react'

interface KeyboardHandlers {
  onScore?: (score: number) => void
  onUndecidable?: () => void
  onDifficulty?: (level: 'easy' | 'median' | 'hard' | 'Error') => void
  onPrev?: () => void
  onNext?: () => void
}

export function useKeyboard({
  onScore,
  onUndecidable,
  onDifficulty,
  onPrev,
  onNext,
}: KeyboardHandlers) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (event.key) {
        case '1':
          onScore?.(1)
          break
        case '2':
          onScore?.(2)
          break
        case '3':
          onScore?.(3)
          break
        case '4':
          onScore?.(4)
          break
        case '5':
          onScore?.(5)
          break
        case 'n':
        case 'N':
          onUndecidable?.()
          break
        case 'F1':
          event.preventDefault()
          onDifficulty?.('easy')
          break
        case 'F2':
          event.preventDefault()
          onDifficulty?.('median')
          break
        case 'F3':
          event.preventDefault()
          onDifficulty?.('hard')
          break
        case 'F4':
          event.preventDefault()
          onDifficulty?.('Error')
          break
        case 'ArrowLeft':
          event.preventDefault()
          onPrev?.()
          break
        case 'ArrowRight':
          event.preventDefault()
          onNext?.()
          break
      }
    },
    [onScore, onUndecidable, onDifficulty, onPrev, onNext]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
