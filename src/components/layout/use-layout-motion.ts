"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type LayoutUpdate = () => void;

export function useLayoutMotion(type: string) {
  const [revision, setRevision] = useState(0);
  const active = useRef<ViewTransition>(null);
  const pending = useRef<LayoutUpdate[]>([]);

  useLayoutEffect(() => () => {
    active.current?.skipTransition();
    active.current = null;
    pending.current.length = 0;
  }, []);

  const changeLayout = useCallback((update: LayoutUpdate) => {
    pending.current.push(update);

    if (typeof document.startViewTransition !== "function"
      || !CSS.supports(`selector(:active-view-transition-type(${type}))`)
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      active.current?.skipTransition();
      active.current = null;
      applyUpdates();
      return;
    }

    // Let the current transition reach its destination before starting a new one.
    if (!active.current) start();

    function applyUpdates() {
      for (const apply of pending.current.splice(0)) apply();
      setRevision(value => value + 1);
    }

    function start() {
      const transition = document.startViewTransition({
        types: [type],
        update: () => {
          // Fit the final layout before the browser captures it.
          if (active.current === transition) flushSync(applyUpdates);
        },
      });

      active.current = transition;
      void transition.ready.catch(() => undefined);
      const finish = () => {
        if (active.current !== transition) return;
        active.current = null;
        if (pending.current.length) start();
      };
      void transition.finished.then(finish, finish);
    }
  }, [type]);

  return useMemo(() => ({ revision, changeLayout }), [revision, changeLayout]);
}
