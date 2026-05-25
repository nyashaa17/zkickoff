'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function WhatsAppPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
    
    // Check if user has already joined
    const hasJoined = localStorage.getItem('hasJoinedWhatsApp');
    if (hasJoined === 'true') {
      return; // Do not show if they already clicked Join
    }

    // Add a small delay for smoother entrance on page load
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleJoin = () => {
    localStorage.setItem('hasJoinedWhatsApp', 'true');
    setIsVisible(false);
  };

  if (!hasMounted) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed bottom-6 inset-x-4 z-[99] md:inset-x-auto md:right-6 md:left-auto md:w-[420px]"
        >
          <div className="bg-white rounded-[20px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-neutral-100 flex items-center p-3 relative overflow-hidden">
            {/* Green left border accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#25D366]"></div>
            
            <div className="flex items-center gap-3.5 ml-3 flex-1 min-w-0 py-1">
              {/* WhatsApp Icon */}
              <div className="w-[48px] h-[48px] bg-[#25D366] rounded-full flex items-center justify-center shrink-0">
                <svg
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  className="w-[28px] h-[28px] text-white"
                >
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.064 3.961L0 16l4.234-1.111a7.844 7.844 0 0 0 3.757.962h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
              </div>

              {/* Texts */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h4 className="font-bold text-neutral-900 text-[15px] leading-tight truncate">Join our WhatsApp ...</h4>
                <p className="text-[13px] text-neutral-500 leading-snug truncate mt-0.5">
                  Watch Live Matches for Free
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 pl-1 ml-1 shrink-0">
              <a
                href="https://whatsapp.com/channel/0029VbCawa77YSd8W5QIHA41"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleJoin}
                className="bg-[#25D366] hover:bg-[#1EBE5A] text-white px-5 py-2.5 rounded-full font-bold text-[14px] transition-colors shadow-sm ml-1"
              >
                Join
              </a>
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors ml-1 focus:outline-none"
                aria-label="Close popup"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
