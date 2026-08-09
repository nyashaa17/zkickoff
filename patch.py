import re
with open("app/preview/[slug]/page.tsx", "r") as f:
    content = f.read()

target1 = """                <div className="p-5 md:p-6 space-y-6">
                  
                  {/* Facts / Pre-match */}
                  {isLoadingBzzoiro ? ("""

replacement1 = """                <div className="p-5 md:p-6 space-y-6">
                  
                  {/* STREAM PLAYER LAUNCHER CALLOUT */}
                  <div className="bg-neutral-50/50 border border-neutral-100 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
                    <h3 className="font-display font-extrabold text-sm text-neutral-950 pb-2 border-b border-neutral-200/60 flex items-center gap-1.5">
                      <Tv className="w-4 h-4 text-[#009739]" />
                      Live Stream Links
                    </h3>
                    <Link 
                      href={`/watch/${slug}`}
                      onClick={handlePlayClick}
                      className="w-full group cursor-pointer py-3.5 px-4 bg-[#009739] text-white hover:bg-opacity-95 rounded-xl font-display text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20"
                    >
                      <Tv className="w-4 h-4 fill-white/10" />
                      <span>▶️ PlayMatch Live</span>
                      <ChevronRight className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>

                  {/* Facts / Pre-match */}
                  {isLoadingBzzoiro ? ("""

target2 = """          {/* STREAM PLAYER LAUNCHER CALLOUT */}
          <div className="bg-white border border-neutral-200/70 rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <h3 className="font-display font-extrabold text-sm text-neutral-950 pb-2 border-b border-neutral-100 flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-[#009739]" />
              Live Stream Links
            </h3>
            <Link 
              href={`/watch/${slug}`}
              onClick={handlePlayClick}
              className="w-full group cursor-pointer py-3.5 px-4 bg-[#009739] text-white hover:bg-opacity-95 rounded-xl font-display text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20"
            >
              <Tv className="w-4 h-4 fill-white/10" />
              <span>▶️ PlayMatch Live</span>
              <ChevronRight className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* VENUE / EVENT DETAILS */}"""

replacement2 = """          {/* VENUE / EVENT DETAILS */}"""

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    with open("app/preview/[slug]/page.tsx", "w") as f:
        f.write(content)
    print("Success")
else:
    if target1 not in content:
        print("Target 1 not found")
    if target2 not in content:
        print("Target 2 not found")
