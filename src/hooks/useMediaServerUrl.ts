import { useEffect, useState } from "react";
import { getMediaServerUrl, peekMediaServerUrl } from "@/lib/media";

/**
 * The loopback media server's base URL (Linux), null where it isn't used, or
 * `undefined` while the first lookup is still in flight.
 */
export function useMediaServerUrl(): string | null | undefined {
  const [url, setUrl] = useState(peekMediaServerUrl);

  useEffect(() => {
    if (url !== undefined) return;
    let active = true;
    void getMediaServerUrl().then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return url;
}
