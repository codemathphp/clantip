import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const codeUpper = code?.toUpperCase() || 'CLANTIP'

  return {
    title: 'You Received a ClanTip Gift! 🎁',
    description: 'Someone sent you some love on ClanTip. Claim your gift and start sharing the love with others.',
    openGraph: {
      title: 'You Received a ClanTip Gift! 🎁',
      description: 'Someone sent you some love on ClanTip. Claim your gift and start sharing the love with others.',
      url: `https://clantip.com/gift-preview/${codeUpper}`,
      siteName: 'ClanTip',
      images: [
        {
          url: '/clantip_logo.png',
          width: 1200,
          height: 630,
          alt: 'ClanTip - Digital Value Gifting',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'You Received a ClanTip Gift! 🎁',
      description: 'Someone sent you some love on ClanTip. Claim your gift and start sharing the love with others.',
      images: ['/clantip_logo.png'],
    },
  } as Metadata
}

export default function GiftPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
