"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const W = 393;
const H = 852;

/** A phone-shaped frame that runs the homeowner app (/m) in an iframe. */
export function Phone({ src = "/m", title = "Homeowner app" }: { src?: string; title?: string }) {
  const [scale, setScale] = useState(1);

  // Shrink the phone to fit short laptop screens.
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 48) / (H + 26)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div style={{ width: (W + 26) * scale, height: (H + 26) * scale }}>
      <div
        className="relative origin-top-left rounded-[62px] bg-[#0b0b0b] p-[13px] shadow-[0_0_0_2px_#2b2b2b,0_40px_80px_-20px_rgba(0,0,0,.7),inset_0_0_0_1px_#3a3a3a]"
        style={{ width: W + 26, height: H + 26, transform: `scale(${scale})` }}
      >
        {/* side buttons */}
        <span className="absolute top-[150px] -left-[3px] h-8 w-[3px] rounded-l bg-[#2b2b2b]" />
        <span className="absolute top-[200px] -left-[3px] h-14 w-[3px] rounded-l bg-[#2b2b2b]" />
        <span className="absolute top-[270px] -left-[3px] h-14 w-[3px] rounded-l bg-[#2b2b2b]" />
        <span className="absolute top-[220px] -right-[3px] h-20 w-[3px] rounded-r bg-[#2b2b2b]" />

        <div className="relative h-full w-full overflow-hidden rounded-[50px] bg-black">
          <iframe src={src} title={title} className="h-full w-full border-0 bg-white" />

          {/* status bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[47px] items-center justify-between px-8 pt-1 text-[15px] font-semibold text-white mix-blend-difference">
            <span>9:41</span>
            <span className="flex items-center gap-1.5">
              <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor" aria-hidden>
                <rect x="0" y="7" width="3" height="4" rx="1" />
                <rect x="5" y="5" width="3" height="6" rx="1" />
                <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
                <rect x="15" y="0" width="3" height="11" rx="1" />
              </svg>
              <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
                <path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.1-1.1A10 10 0 0 0 8 .6 10 10 0 0 0 .9 3.5L2 4.6a8.4 8.4 0 0 1 6-2.4Zm0 3.2c1.4 0 2.7.5 3.7 1.4l1.1-1.1A7 7 0 0 0 8 3.8a7 7 0 0 0-4.8 1.9l1.1 1.1c1-.9 2.3-1.4 3.7-1.4Zm0 3.2c.6 0 1.1.2 1.5.6L8 10.7 6.5 9.2c.4-.4.9-.6 1.5-.6Z" />
              </svg>
              <svg width="27" height="12" viewBox="0 0 27 12" fill="none" aria-hidden>
                <rect x=".5" y=".5" width="23" height="11" rx="3.5" stroke="currentColor" opacity=".4" />
                <rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" />
                <path d="M25 4v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="currentColor" opacity=".4" />
              </svg>
            </span>
          </div>
          {/* dynamic island */}
          <div className="pointer-events-none absolute top-[11px] left-1/2 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
          {/* home indicator */}
          <div className="pointer-events-none absolute bottom-[8px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white mix-blend-difference" />
        </div>
      </div>
    </div>
  );
}

/** The homeowner phone, opened on ?open=/m/... when given (demo shortcuts link here). */
export function OpenPhone() {
  const open = useSearchParams().get("open");
  return <Phone src={open && /^\/m(\/[\w/-]*)?$/.test(open) ? open : "/m"} />;
}
