import React from 'react'

export function Icon({ name }) {
  switch (name) {
    case 'overview':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </svg>
      )
    case 'translation-processing':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h8M8 5c0 7 4 10 8 12M6 12c2-1 5-4 6-7M14 19l2-5 2 5M14.8 17h2.4" />
        </svg>
      )
    case 'international-daily-report':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
        </svg>
      )
    case 'international-hotspot-daily-report':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 7-7Zm0 4v6M9 10h6" />
        </svg>
      )
    case 'artifacts':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h16v13H4zM8 4h8v3H8zM8 11h8M8 15h8" />
        </svg>
      )
    case 'recent':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 8v5l3 2M12 21a9 9 0 1 0-8.4-12.2M4 4v5h5" />
        </svg>
      )
    case 'help':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 18h.01M9.1 9a3 3 0 1 1 5.7 1.3c-.8 1.2-2.3 1.7-2.8 3.2M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" />
        </svg>
      )
    case 'feedback':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 5h16v11H8l-4 4V5Zm4 4h8M8 13h5" />
        </svg>
      )
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 4v16M4 12h16" />
        </svg>
      )
  }
}
