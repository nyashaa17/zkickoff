'use client';

import React, { useState } from 'react';
import Breadcrumbs from '@/components/breadcrumbs';
import { Mail, Clock, Send, AlertCircle } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [ticketReference, setTicketReference] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    const refNum = Math.floor(Math.random() * 90000) + 10000;
    setTicketReference(String(refNum));
    setSubmitted(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <Breadcrumbs items={[{ label: 'Contact Us' }]} className="mb-6" />

      <div className="bg-white border border-neutral-200/50 rounded-3xl p-6 md:p-10 shadow-xs max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <span className="text-[11px] font-mono font-black text-zim-green bg-[#e8f3ec] px-3 py-1 rounded-full uppercase tracking-wider">
                Get In Touch
              </span>
              <h1 className="text-xl md:text-2xl font-display font-black text-neutral-900 mt-3 mb-4 tracking-tight">
                Support Desk
              </h1>
              <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
                Have alignment recommendations, feedback, or content complaints? Submit your message to the ZimKickOff administrative team.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3.5 p-4 border border-neutral-100 rounded-2xl bg-neutral-50/50">
                <Mail className="w-5 h-5 text-zim-green shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-neutral-900">Email Address</h4>
                  <p className="text-xs text-neutral-500 mt-1">support@zimkickoff.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 border border-neutral-100 rounded-2xl bg-neutral-50/50">
                <Clock className="w-5 h-5 text-zim-yellow shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-neutral-900">Response Period</h4>
                  <p className="text-xs text-neutral-500 mt-1">Our standard team feedback delay is 24 to 48 working hours.</p>
                </div>
              </div>
            </div>

            <div className="p-4 border border-zim-red/10 rounded-2xl bg-zim-red/[0.02] text-neutral-500 text-xs leading-relaxed flex gap-3.5 items-start">
              <AlertCircle className="w-5 h-5 text-zim-red shrink-0" />
              <span>
                <strong>Take Note:</strong> We are strictly an aggregator index. Content removal notifications will be fast-tracked to appropriate external hosts.
              </span>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7 bg-neutral-50 rounded-2xl p-5 md:p-8 border border-neutral-200/60">
            {submitted ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 bg-[#e8f3ec] text-zim-green border border-zim-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-display font-extrabold text-neutral-900 mb-2">Message Sent</h3>
                <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto mb-4">
                  Thank you! Your ticket was generated with reference #{ticketReference}. We will follow up.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-xs font-bold text-zim-green hover:underline cursor-pointer"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="form-name" className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Full Name
                  </label>
                  <input
                    id="form-name"
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full text-xs bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-300 focus:border-zim-green rounded-xl py-3 px-4 outline-hidden transition-all placeholder:text-neutral-400"
                  />
                </div>

                <div>
                  <label htmlFor="form-email" className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Email Address
                  </label>
                  <input
                    id="form-email"
                    type="email"
                    required
                    placeholder="name@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full text-xs bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-300 focus:border-zim-green rounded-xl py-3 px-4 outline-hidden transition-all placeholder:text-neutral-400"
                  />
                </div>

                <div>
                  <label htmlFor="form-subject" className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Subject
                  </label>
                  <input
                    id="form-subject"
                    type="text"
                    required
                    placeholder="Complaint, suggestion, or partnership..."
                    value={formData.subject}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    className="w-full text-xs bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-300 focus:border-zim-green rounded-xl py-3 px-4 outline-hidden transition-all placeholder:text-neutral-400"
                  />
                </div>

                <div>
                  <label htmlFor="form-message" className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Your Message
                  </label>
                  <textarea
                    id="form-message"
                    required
                    rows={4}
                    placeholder="Explain your inquiry in detail..."
                    value={formData.message}
                    onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                    className="w-full text-xs bg-white text-neutral-900 border border-neutral-200 hover:border-neutral-300 focus:border-zim-green rounded-xl py-3 px-4 outline-hidden transition-all placeholder:text-neutral-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-zim-green hover:bg-zim-green/90 text-white font-display font-bold text-xs rounded-xl py-3 px-4 shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
