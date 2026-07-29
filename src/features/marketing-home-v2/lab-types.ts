import type { ReactNode } from "react";

export type LabBeat = {
    id: string;
    title: string;
    body: string;
    stage: ReactNode;
};

export type LabChapterConfig = {
    id: string;
    label: string;
    heading: string;
    outcome: string;
    flip?: boolean;
    beats: LabBeat[];
};
