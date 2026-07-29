import type { ReactNode } from "react";

type PhoneFrameProps = {
    children: ReactNode;
};

/** Light device shell — product surface inside, no caption label. */
export function PhoneFrame({ children }: PhoneFrameProps) {
    return (
        <figure className="lab-phone">
            <div className="lab-phone__device">
                <span className="lab-phone__notch" aria-hidden="true" />
                <div className="lab-phone__screen">{children}</div>
            </div>
        </figure>
    );
}
