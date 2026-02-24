"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export function ReadinessLegend() {
    return (
        <div className="bg-gradient-to-br from-[#e8f1fd] to-[#d1e3fa] rounded-2xl p-6 shadow-sm ring-1 ring-white/20 relative overflow-hidden h-fit">
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 to-blue-600" />
            <div className="flex items-center gap-2 mb-4 relative z-10">
                <Info className="w-4 h-4 text-blue-600" />
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Key to Readiness Ratings</h4>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 relative z-10">
                <div className="flex flex-col gap-1.5">
                    <Badge variant="outline" className="w-fit text-[10px] px-2 py-0 uppercase font-bold tracking-tight text-emerald-700 border-emerald-200 bg-emerald-50">Ready</Badge>
                    <p className="text-[11px] text-slate-500 leading-snug">Meets all core and advanced competencies.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Badge variant="outline" className="w-fit text-[10px] px-2 py-0 uppercase font-bold tracking-tight text-blue-700 border-blue-200 bg-blue-50">Strong Potential</Badge>
                    <p className="text-[11px] text-slate-500 leading-snug">Solid performance; minor areas for growth.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Badge variant="outline" className="w-fit text-[10px] px-2 py-0 uppercase font-bold tracking-tight text-amber-700 border-amber-200 bg-amber-50">Practice Recommended</Badge>
                    <p className="text-[11px] text-slate-500 leading-snug">Targeted practice is encouraged in core areas.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <Badge variant="outline" className="w-fit text-[10px] px-2 py-0 uppercase font-bold tracking-tight text-slate-500 border-slate-200 bg-slate-50">Incomplete</Badge>
                    <p className="text-[11px] text-slate-500 leading-snug">Insufficient data to establish a reliable rating.</p>
                </div>
            </div>
        </div>
    );
}
