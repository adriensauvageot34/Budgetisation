"use client";
import {createContext,useContext} from "react";
/** Reception can supply controlled responses. Normal product uses native fetch. */
export const BarPlaceTransportContext=createContext<typeof fetch|null>(null);
export function useBarPlaceTransport(){return useContext(BarPlaceTransportContext)??fetch;}
