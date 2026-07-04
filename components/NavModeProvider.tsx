"use client";

import { createContext, useContext } from "react";

interface NavMode {
  /** True for solo users (individual/student persona) → "Me" nav instead of "Family". */
  personal: boolean;
}

const NavModeContext = createContext<NavMode>({ personal: false });

export function NavModeProvider({
  personal,
  children,
}: {
  personal: boolean;
  children: React.ReactNode;
}) {
  return <NavModeContext.Provider value={{ personal }}>{children}</NavModeContext.Provider>;
}

export function useNavMode(): NavMode {
  return useContext(NavModeContext);
}
