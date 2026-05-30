'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, MessageCircle } from 'lucide-react';

function IframePlayer() {
  const searchParams = useSearchParams();
  const fixture = searchParams.get('fixture');
  const stream = searchParams.get('stream') || '1';
  const [dashHtml, setDashHtml] = useState<string>('');

  useEffect(() => {
    if (fixture) {
      fetch(`https://app.totalsportslive.co.zw/dash-buttons?fixture=${encodeURIComponent(fixture)}`, { mode: 'cors' })
        .then((res) => res.text())
        .then((html) => {
          if (html && html.trim()) {
            setDashHtml(html);
          }
        })
        .catch((err) => console.error("DASH button load error:", err));
    }
  }, [fixture]);

  if (!fixture) {
    return (
      <div className="text-red-900 bg-red-50 border border-red-200 p-4 rounded-lg my-4 max-w-2xl mx-auto text-sm text-center">
        No fixture specified. Open this page from a valid match link to load the embedded player.
      </div>
    );
  }

  return (
    <>
      <iframe
        id="streamContainer"
        title="Embedded football match player"
        allowFullScreen
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        loading="eager"
        className="w-full h-[260px] md:h-[400px] border-none bg-[#111] rounded-xl my-4"
        src={`https://king.totalsportss.online/embed?fixture=${encodeURIComponent(fixture)}&stream=${encodeURIComponent(stream)}`}
      ></iframe>

      {dashHtml && (
        <div id="dashButtonsContainer" className="my-4" dangerouslySetInnerHTML={{ __html: dashHtml }}></div>
      )}
    </>
  );
}

export default function StreamGuideContent() {
  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.reload();
  };

  return (
    <div className="w-full bg-[#F9F9FB] min-h-screen text-neutral-900 font-sans selection:bg-[#009739] selection:text-white pb-24 pt-4">
      <main className="max-w-[920px] mx-auto p-4">
        
        <section className="bg-white border border-neutral-200 shadow-sm rounded-xl p-5 md:p-6 mb-5 text-center">
          <h1 className="text-2xl md:text-[26px] leading-[1.3] mb-3 text-neutral-900 font-bold">How to Watch Premier League on TV in the UK</h1>
          <p className="text-[15px] leading-[1.6] text-neutral-600 m-0">
            The Premier League is one of the most-watched football competitions in the world, and UK fans have several ways to follow the action across TV, streaming apps and highlights shows. This guide explains where Premier League matches are usually shown, how to watch legally, and how to stay updated on matchdays.
          </p>
        </section>

        <div className="my-4 font-medium text-neutral-600 text-center">
          Please wait <strong className="text-[26px] text-neutral-900">5</strong> seconds for the player to load.
        </div>

        <Suspense fallback={<div className="h-[260px] md:h-[400px] w-full max-w-[920px] mx-auto bg-neutral-200 animate-pulse rounded-xl my-4"></div>}>
          <IframePlayer />
        </Suspense>

        <section className="bg-white border border-neutral-200 shadow-sm rounded-xl p-5 md:p-6 text-left text-neutral-700 leading-[1.7] text-[15px]">
          <h2 className="text-neutral-900 text-[22px] font-bold mt-6 mb-2 first:mt-0">Where to Watch Premier League Matches in the UK</h2>
          <p className="mb-4">
            Live Premier League coverage in the UK is mainly shown through paid sports broadcasters. Match selections can change throughout the season, so the best way to confirm a specific game is to check the official TV schedule close to kick-off.
          </p>

          <h3 className="text-neutral-900 text-[18px] font-bold mt-5 mb-2">Sky Sports Premier League Coverage</h3>
          <p className="mb-4">
            Sky Sports is the main UK broadcaster for Premier League football and usually shows many of the biggest weekend fixtures, including major Sunday matches, evening games and selected midweek fixtures.
          </p>

          <h3 className="text-neutral-900 text-[18px] font-bold mt-5 mb-2">TNT Sports Premier League Coverage</h3>
          <p className="mb-4">
            TNT Sports also shows live Premier League matches in the UK, including selected early kick-offs and other televised fixtures during the season. Viewers can watch through supported TV packages or the official streaming options linked to TNT Sports.
          </p>

          <h3 className="text-neutral-900 text-[18px] font-bold mt-5 mb-2">BBC Match of the Day Highlights</h3>
          <p className="mb-4">
            Fans who do not need to watch every game live can follow Premier League highlights through BBC Sport programming, including Match of the Day and related highlight shows. This remains one of the easiest free-to-air ways to catch key goals, incidents and analysis after matches.
          </p>

          <h2 className="text-neutral-900 text-[22px] font-bold mt-6 mb-2">Can You Stream Premier League Matches Online?</h2>
          <p className="mb-4">
            Yes. Most televised Premier League games can also be watched online through the official apps or streaming services connected to the broadcaster showing the match. This is useful for fans watching on mobile, tablet, smart TV, laptop or console.
          </p>

          <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 p-4 rounded-lg my-5">
            Always check which broadcaster has the rights for the specific fixture before kick-off, because not every Premier League match is shown live on UK TV.
          </div>

          <h2 className="text-neutral-900 text-[22px] font-bold mt-6 mb-2">Using the Embedded Player on This Page</h2>
          <p className="mb-4">
            This page includes an embedded football player for matchday viewing. If the player does not load immediately, wait a few seconds, refresh the page, or use any alternative stream buttons when they appear below the player.
          </p>

          <ul className="list-disc pl-6 mb-5 space-y-2">
            <li>Wait a few seconds for the player to connect.</li>
            <li>Use the refresh button if the stream freezes.</li>
            <li>Try another available stream option when provided.</li>
            <li>Use the live chat below to follow match discussion with other fans.</li>
          </ul>

          <h2 className="text-neutral-900 text-[22px] font-bold mt-6 mb-2">Best Way to Follow Premier League Matchdays</h2>
          <p className="mb-4">
            For the best matchday experience, check the confirmed TV channel first, open the stream early, and keep a live score page available for team news, substitutions and match events. Big fixtures can attract heavy traffic, so loading the player before kick-off helps avoid delays.
          </p>

          <h2 className="text-neutral-900 text-[22px] font-bold mt-6 mb-2">Premier League TV Guide Summary</h2>
          <ul className="list-disc pl-6 mb-5 space-y-2">
            <li><strong>Live TV:</strong> Usually shown on Sky Sports and TNT Sports in the UK.</li>
            <li><strong>Online streaming:</strong> Available through official broadcaster streaming apps.</li>
            <li><strong>Highlights:</strong> BBC Match of the Day and BBC Sport coverage.</li>
            <li><strong>Match updates:</strong> Follow live scores, team news and fan chat during the game.</li>
          </ul>

          <h2 className="text-neutral-900 text-[22px] font-bold mt-6 mb-2">Frequently Asked Questions</h2>

          <h3 className="text-neutral-900 text-[18px] font-bold mt-5 mb-2">Are all Premier League matches shown live in the UK?</h3>
          <p className="mb-4">
            No. Even though more matches are broadcast than before, not every Premier League fixture is shown live on UK TV. Always check the latest confirmed TV schedule for the match you want to watch.
          </p>

          <h3 className="text-neutral-900 text-[18px] font-bold mt-5 mb-2">What channel shows Premier League football in the UK?</h3>
          <p className="mb-4">
            Premier League live TV coverage in the UK is mainly shared between Sky Sports and TNT Sports. BBC Sport provides free-to-air highlights.
          </p>

          <h3 className="text-neutral-900 text-[18px] font-bold mt-5 mb-2">What should I do if the embedded player is not working?</h3>
          <p className="mb-4">
            Wait a few seconds, refresh the page, and check whether alternative stream buttons are available. You can also contact support using the WhatsApp button.
          </p>
        </section>

        <h2 className="text-neutral-900 text-xl md:text-[22px] font-bold mt-8 mb-4 text-center">Live Match Chat</h2>

        <div className="flex justify-center">
          <iframe
            src="https://chat.totalsportslive.co.zw/widget.html"
            className="border-none h-[520px] w-full max-w-[420px] rounded-xl bg-[#F9F9FB] border border-neutral-200 shadow-sm mb-6"
            title="Total Sports Live match chat"
            loading="lazy"
          ></iframe>
        </div>

      </main>

      {/* Sticky Action Buttons */}
      <div className="fixed bottom-[110px] md:bottom-[350px] right-2 md:right-4 z-50">
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#ff0000] hover:bg-[#e60000] text-white rounded-lg font-bold text-[13px] md:text-[15px] shadow-[0_3px_10px_rgba(0,0,0,0.35)] transition-colors"
        >
          Refresh Live <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      <div className="fixed bottom-[110px] md:bottom-[350px] left-2 md:left-4 z-50">
        <a
          href="https://wa.me/263XXXXXXXXX?text=Hello%20Total%20Sports%20Live%2C%20I%20need%20help%20with%20the%20Premier%20League%20stream."
          rel="nofollow noopener"
          target="_blank"
          className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#25d366] hover:bg-[#20ba59] text-white rounded-lg font-bold text-[13px] md:text-[15px] shadow-[0_3px_10px_rgba(0,0,0,0.35)] transition-colors"
        >
          WhatsApp <MessageCircle className="w-4 h-4 md:w-5 md:h-5 fill-current" />
        </a>
      </div>

    </div>
  );
}
