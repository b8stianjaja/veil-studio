import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface AccordionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export const Accordion: React.FC<AccordionProps> = ({ title, defaultExpanded = true, children }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: contentRef });

  const toggle = contextSafe(() => {
    const isExpanding = !expanded;
    
    if (isExpanding) {
      setExpanded(true);
      gsap.fromTo(contentRef.current, 
        { height: 0, opacity: 0 }, 
        { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
    } else {
      gsap.to(contentRef.current, { 
        height: 0, opacity: 0, duration: 0.3, ease: 'power2.out',
        onComplete: () => setExpanded(false)
      });
    }
  });

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <button 
        onClick={toggle}
        className="w-full flex items-center justify-between p-4 text-text-secondary hover:text-text-primary transition-colors hover:bg-bg-input"
      >
        <span className="font-semibold tracking-widest text-[10px] uppercase text-text-secondary">{title}</span>
        {expanded ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
      </button>
      <div 
        ref={contentRef} 
        className="overflow-hidden bg-bg-app/30" 
        style={{ height: defaultExpanded ? 'auto' : 0, opacity: defaultExpanded ? 1 : 0 }}
      >
        <div className="p-4 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
};
