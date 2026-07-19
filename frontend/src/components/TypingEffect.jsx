import { useState, useEffect } from 'react';

export default function TypingEffect({ phrases, speed = 70, eraseSpeed = 35, delay = 2200 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!phrases || phrases.length === 0) return;
    const currentPhrase = phrases[phraseIndex % phrases.length];

    let timer;
    if (!isDeleting && displayedText !== currentPhrase) {
      timer = setTimeout(() => {
        setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
      }, speed);
    } else if (!isDeleting && displayedText === currentPhrase) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, delay);
    } else if (isDeleting && displayedText !== '') {
      timer = setTimeout(() => {
        setDisplayedText(currentPhrase.slice(0, displayedText.length - 1));
      }, eraseSpeed);
    } else if (isDeleting && displayedText === '') {
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }

    return () => clearTimeout(timer);
  }, [displayedText, phraseIndex, isDeleting, phrases, speed, eraseSpeed, delay]);

  return (
    <span className="inline-inline-block">
      {displayedText}
      <span className="ml-1 inline-block h-[0.85em] w-[3px] animate-pulse bg-cyan-300 align-baseline" />
    </span>
  );
}
