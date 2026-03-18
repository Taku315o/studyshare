'use client';

import Image from 'next/image';
import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  iconSize?: number;
  textClassName?: string;
  className?: string;
  priority?: boolean;
};

export default function BrandLogo({
  href = '/home',
  iconSize = 36,
  textClassName = 'text-2xl font-black tracking-tight text-slate-900',
  className = 'inline-flex items-center gap-3',
  priority = false,
}: BrandLogoProps) {
  const content = (
    <>
      <Image
        src="/studyshare_logo.svg"
        alt="StudyShare logo"
        width={iconSize}
        height={iconSize}
        priority={priority}
        className="shrink-0"
      />
      <span className={textClassName}>StudyShare</span>
    </>
  );

  return (
    <Link href={href} className={className} aria-label="StudyShare">
      {content}
    </Link>
  );
}
