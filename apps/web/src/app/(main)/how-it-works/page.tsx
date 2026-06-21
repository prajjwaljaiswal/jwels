import type { Metadata } from 'next';
import HowItWorks from './HowItWorks';

export const metadata: Metadata = {
  title: 'How it works · Vrindaonline',
  description:
    'How Vrindaonline works, for shoppers and for sellers. Every jeweller gets their own branded store; shoppers get one trusted place to discover and buy.',
};

export default function HowItWorksPage() {
  return <HowItWorks />;
}
