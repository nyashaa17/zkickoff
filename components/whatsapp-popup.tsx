'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function WhatsAppPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasMounted(true);
    
    // Check if user has already joined
    try {
      const hasJoined = localStorage.getItem('hasJoinedWhatsApp');
      if (hasJoined === 'true') {
        return; // Do not show if they already clicked Join
      }
    } catch (e) {
      console.warn('localStorage not available for popup tracking');
    }

    // Add a small delay for smoother entrance on page load
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleJoin = () => {
    try {
      localStorage.setItem('hasJoinedWhatsApp', 'true');
    } catch (e) {}
    setIsVisible(false);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('hasJoinedWhatsApp', 'true');
    } catch (e) {}
    setIsVisible(false);
  };

  if (!hasMounted) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white rounded-[24px] w-full max-w-[340px] px-6 pb-6 pt-12 relative flex flex-col items-center text-center shadow-2xl"
          >
            {/* WhatsApp Icon overlapping the top */}
            <div className="absolute -top-10 w-[84px] h-[84px] bg-white rounded-full p-2 shadow-sm">
              <div className="w-full h-full bg-[#25D366] rounded-full flex items-center justify-center">
                <svg
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  className="w-10 h-10 text-white"
                >
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.064 3.961L0 16l4.234-1.111a7.844 7.844 0 0 0 3.757.962h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
              </div>
            </div>

            <h2 className="text-[22px] font-bold text-neutral-900 mt-3 mb-2 tracking-tight">Join Our Community</h2>
            <p className="text-[#6B7280] text-[15px] mb-6 leading-relaxed">
              Get latest updates, breaking news and exclusive content directly on WhatsApp.
            </p>

            <div className="flex flex-col w-full gap-3">
              <a
                href="https://whatsapp.com/channel/0029VbCawa77YSd8W5QIHA41"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleJoin}
                className="w-full bg-[#128C7E] hover:bg-[#0E7065] text-white rounded-[14px] py-3.5 font-bold flex items-center justify-center gap-2 transition-colors text-[16px] shadow-sm"
              >
                <span className="text-[18px] leading-none">📣</span> Join WhatsApp Channel
              </a>
              <button
                onClick={handleDismiss}
                className="w-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-neutral-700 rounded-[14px] py-3.5 font-bold transition-colors text-[16px] flex items-center justify-center gap-2"
              >
                <span>✓</span> Already Joined
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
