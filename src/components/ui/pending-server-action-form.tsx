"use client";

import { Loader2 } from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type FormEvent,
    type FormHTMLAttributes,
    type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

type PendingServerActionContextValue = {
    activeSubmitterId: string | null;
    pending: boolean;
    registerSubmitter: (submitterId: string) => () => void;
    selectSubmitter: (submitterId: string) => void;
};

const PendingServerActionContext = createContext<PendingServerActionContextValue | null>(null);

export type PendingServerActionFormProps = Omit<
    FormHTMLAttributes<HTMLFormElement>,
    "action" | "children" | "method" | "onSubmit" | "onSubmitCapture"
> & {
    action: ServerFormAction;
    children: ReactNode;
    pendingAnnouncement?: string;
};

export function PendingServerActionForm({
    action,
    children,
    className,
    pendingAnnouncement = "Submitting request.",
    ...formProps
}: PendingServerActionFormProps) {
    const [pending, setPending] = useState(false);
    const [activeSubmitterId, setActiveSubmitterId] = useState<string | null>(null);
    const pendingRef = useRef(false);
    const activeSubmitterRef = useRef<string | null>(null);
    const submitterIdsRef = useRef<string[]>([]);

    const registerSubmitter = useCallback((submitterId: string) => {
        submitterIdsRef.current = [...submitterIdsRef.current, submitterId];
        return () => {
            submitterIdsRef.current = submitterIdsRef.current.filter((id) => id !== submitterId);
        };
    }, []);

    const selectSubmitter = useCallback((submitterId: string) => {
        activeSubmitterRef.current = submitterId;
    }, []);

    const contextValue = useMemo(
        () => ({ activeSubmitterId, pending, registerSubmitter, selectSubmitter }),
        [activeSubmitterId, pending, registerSubmitter, selectSubmitter],
    );

    const handleSubmitCapture = (event: FormEvent<HTMLFormElement>) => {
        if (pendingRef.current) {
            event.preventDefault();
            return;
        }

        const nativeSubmitter = (event.nativeEvent as SubmitEvent).submitter;
        const submittedId =
            nativeSubmitter instanceof HTMLElement
                ? nativeSubmitter.dataset.pendingSubmitterId ?? null
                : null;
        const nextActiveSubmitterId =
            submittedId ?? activeSubmitterRef.current ?? submitterIdsRef.current[0] ?? null;

        pendingRef.current = true;
        activeSubmitterRef.current = nextActiveSubmitterId;
        setActiveSubmitterId(nextActiveSubmitterId);
        setPending(true);
    };

    return (
        <PendingServerActionContext.Provider value={contextValue}>
            <form
                {...formProps}
                action={action}
                className={cn("ui-pending-server-action-form", className)}
                aria-busy={pending || undefined}
                data-state={pending ? "pending" : undefined}
                onSubmitCapture={handleSubmitCapture}
            >
                {children}
                <span className="sr-only" role="status" aria-live="polite">
                    {pending ? pendingAnnouncement : ""}
                </span>
            </form>
        </PendingServerActionContext.Provider>
    );
}

export type PendingSubmitButtonProps = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "type"
> & {
    children: ReactNode;
};

export function PendingSubmitButton({
    children,
    className,
    disabled,
    onClickCapture,
    ...buttonProps
}: PendingSubmitButtonProps) {
    const context = useContext(PendingServerActionContext);
    const submitterId = useId();
    const registerSubmitter = context?.registerSubmitter;

    useEffect(() => registerSubmitter?.(submitterId), [registerSubmitter, submitterId]);

    const isActive = Boolean(context?.pending && context.activeSubmitterId === submitterId);

    return (
        <button
            {...buttonProps}
            type="submit"
            className={cn("ui-pending-submit-button", className)}
            disabled={disabled || context?.pending}
            aria-busy={isActive || undefined}
            data-pending-submitter-id={submitterId}
            data-state={isActive ? "loading" : undefined}
            onClickCapture={(event) => {
                context?.selectSubmitter(submitterId);
                onClickCapture?.(event);
            }}
        >
            <span className="ui-button__content">{children}</span>
            {isActive ? (
                <Loader2 className="ui-button__spinner" aria-hidden="true" />
            ) : null}
        </button>
    );
}
