import { useEffect, useState } from "react";
import { isOnline$ } from "../services/network.service";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline$.value);

  useEffect(() => {
    const sub = isOnline$.subscribe(setOnline);
    return () => sub.unsubscribe();
  }, []);

  return online;
}
