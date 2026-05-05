"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Save, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { PageHeaderBlock } from "@/components/patterns/PageHeaderBlock";
import { FieldGroup, FieldHint, FieldLabel, selectFieldClassName, textFieldClassName } from "@/components/patterns/FormField";
import { E2E_RECRUITER_ID, getE2ERecruiterProfile, isClientE2EMode } from "@/lib/e2e/test-mode";
import { canShowReplayTourButton } from "@/lib/feature-flags";
import {
    RECRUITER_CREATE_INVITE_TOUR_ID,
    TOUR_RESET_SEARCH_PARAM,
} from "@/features/tours/recruiter-tour-provider";

interface RecruiterProfile {
    recruiter_id: string;
    first_name: string;
    last_name: string;
    title: string;
    phone: string;
    timezone: string;
}

const getTimezones = () => {
    try {
        const zones = Intl.supportedValuesOf('timeZone');
        const mapped = zones.map(zone => {
            try {
                const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts().find(p => p.type === 'timeZoneName')?.value || 'GMT';
                const long = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts().find(p => p.type === 'timeZoneName')?.value || zone;

                let offset = 0;
                if (short !== 'GMT') {
                    const match = short.match(/GMT([+-])(\d+)(?::(\d+))?/);
                    if (match) {
                        const [, sign, h, m] = match;
                        const hours = parseInt(h, 10);
                        const mins = m ? parseInt(m, 10) : 0;
                        const total = hours * 60 + mins;
                        offset = sign === '-' ? -total : total;
                    }
                }

                return { value: zone, label: `(${short}) ${long} - ${zone}`, offset };
            } catch {
                return { value: zone, label: zone, offset: 0 };
            }
        });

        return mapped.sort((a, b) => {
            if (a.offset !== b.offset) return a.offset - b.offset;
            return a.label.localeCompare(b.label);
        }).map(({ value, label }) => ({ value, label }));
    } catch {
        return [
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "Eastern Time (US & Canada)" },
            { value: "America/Chicago", label: "Central Time (US & Canada)" },
            { value: "America/Denver", label: "Mountain Time (US & Canada)" },
            { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
            { value: "Europe/London", label: "London" },
        ];
    }
};

const TIMEZONES = getTimezones();

function formatPhoneNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length === 0) {
        return "";
    }

    if (digits.length <= 3) {
        return `(${digits}`;
    }

    if (digits.length <= 6) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function SettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

    const [initialProfile, setInitialProfile] = useState<RecruiterProfile | null>(null);
    const [profile, setProfile] = useState<RecruiterProfile>({
        recruiter_id: "",
        first_name: "",
        last_name: "",
        title: "",
        phone: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });
    const titleInputId = useId();
    const firstNameInputId = useId();
    const lastNameInputId = useId();
    const phoneInputId = useId();
    const timezoneInputId = useId();

    useEffect(() => {
        if (isClientE2EMode()) {
            setCurrentUserEmail(null);
            const e2eProfile = {
                recruiter_id: E2E_RECRUITER_ID,
                first_name: getE2ERecruiterProfile().first_name,
                last_name: getE2ERecruiterProfile().last_name,
                title: getE2ERecruiterProfile().title,
                phone: getE2ERecruiterProfile().phone,
                timezone: getE2ERecruiterProfile().timezone,
            };
            setInitialProfile(e2eProfile);
            setProfile(e2eProfile);
            setIsLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setIsLoading(true);
            const response = await fetch("/api/recruiter/profile", { cache: "no-store" });

            if (response.status === 401) {
                router.push("/login");
                return;
            }

            if (!response.ok) {
                setError("Failed to load profile.");
                setIsLoading(false);
                return;
            }

            const data = await response.json();
            const user = data.user;
            const loadedProfile = data.profile;
            setCurrentUserEmail(user?.email ?? null);

            if (user && loadedProfile) {
                const cleanData = {
                    recruiter_id: loadedProfile.recruiter_id || user.id,
                    first_name: loadedProfile.first_name || "",
                    last_name: loadedProfile.last_name || "",
                    title: loadedProfile.title || "",
                    phone: formatPhoneNumber(loadedProfile.phone || ""),
                    timezone: loadedProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                };
                setInitialProfile(cleanData);
                setProfile(cleanData);
            } else if (user) {
                const emptyProfile = {
                    recruiter_id: user.id,
                    first_name: "",
                    last_name: "",
                    title: "",
                    phone: "",
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                };
                setInitialProfile(emptyProfile);
                setProfile(emptyProfile);
            } else {
                setError("Failed to load profile.");
            }
            setIsLoading(false);
        };

        fetchProfile();
    }, [router]);


    const isDirty = initialProfile && JSON.stringify(profile) !== JSON.stringify(initialProfile);
    const canReplayTour = canShowReplayTourButton(currentUserEmail);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isDirty) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isClientE2EMode()) {
                setInitialProfile({ ...profile });
                setSuccessMessage("Profile updated successfully.");
                setTimeout(() => setSuccessMessage(null), 3000);
                return;
            }

            const response = await fetch("/api/recruiter/profile", {
                method: "PUT",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    title: profile.title,
                    phone: profile.phone,
                    timezone: profile.timezone,
                }),
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.message || "Failed to save profile.");
            }

            const savedProfile = body.profile ?? profile;
            const cleanSavedProfile = {
                recruiter_id: savedProfile.recruiter_id || profile.recruiter_id,
                first_name: savedProfile.first_name || "",
                last_name: savedProfile.last_name || "",
                title: savedProfile.title || "",
                phone: formatPhoneNumber(savedProfile.phone || ""),
                timezone: savedProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
            };

            setInitialProfile(cleanSavedProfile);
            setProfile(cleanSavedProfile);
            setSuccessMessage("Profile updated successfully.");

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save profile.";
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (initialProfile) {
            setProfile({ ...initialProfile });
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleReplayTour = () => {
        const replayParams = new URLSearchParams({
            tour: RECRUITER_CREATE_INVITE_TOUR_ID,
            [TOUR_RESET_SEARCH_PARAM]: "1",
        });

        router.push(`/recruiter/settings?${replayParams.toString()}`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-slow">
            <PageHeaderBlock
                title="Account Settings"
                description="Manage your profile and display preferences."
                actions={
                    canReplayTour ? (
                        <Button
                            type="button"
                            onClick={handleReplayTour}
                            emphasis="secondary"
                            density="compact"
                            shape="pill"
                            label="chrome"
                            className="gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Replay Tour 1
                        </Button>
                    ) : null
                }
            />

            <form onSubmit={handleSave}>
                <Card
                    className="border-border/50 shadow-raised-1 bg-surface-base overflow-hidden"
                    data-tour-step-id="tour-recruiter-settings-profile"
                >
                    <CardHeader className="bg-surface-subtle/30 border-b border-border/10 py-6">
                        <CardTitle className="text-xl font-bold text-text-primary">Profile Details</CardTitle>
                        <CardDescription className="text-sm text-text-muted mt-1">
                            Your name and contact information will appear on candidate invites and emails.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        {error && (
                            <AlertPanel tone="critical" icon={<AlertTriangle className="w-5 h-5 shrink-0" />} className="animate-in shake-in">
                                <span className="font-medium">{error}</span>
                            </AlertPanel>
                        )}
                        {successMessage && !isDirty && (
                            <AlertPanel tone="success" icon={<CheckCircle2 className="w-5 h-5 shrink-0" />} className="animate-in fade-in slide-in-from-top-2">
                                <span className="font-medium">{successMessage}</span>
                            </AlertPanel>
                        )}

                        <FieldGroup>
                            <FieldLabel htmlFor={titleInputId}>Your Job Title</FieldLabel>
                            <input
                                id={titleInputId}
                                name="title"
                                className={textFieldClassName}
                                value={profile.title}
                                onChange={e => setProfile({ ...profile, title: e.target.value })}
                                placeholder="e.g. Senior Technical Recruiter"
                            />
                        </FieldGroup>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FieldGroup>
                                <FieldLabel htmlFor={firstNameInputId}>First Name</FieldLabel>
                                <input
                                    id={firstNameInputId}
                                    name="firstName"
                                    required
                                    className={textFieldClassName}
                                    value={profile.first_name}
                                    onChange={e => setProfile({ ...profile, first_name: e.target.value })}
                                />
                            </FieldGroup>
                            <FieldGroup>
                                <FieldLabel htmlFor={lastNameInputId}>Last Name</FieldLabel>
                                <input
                                    id={lastNameInputId}
                                    name="lastName"
                                    required
                                    className={textFieldClassName}
                                    value={profile.last_name}
                                    onChange={e => setProfile({ ...profile, last_name: e.target.value })}
                                />
                            </FieldGroup>
                        </div>

                        <FieldGroup>
                            <FieldLabel htmlFor={phoneInputId}>Phone Number</FieldLabel>
                            <input
                                id={phoneInputId}
                                name="phone"
                                className={textFieldClassName}
                                value={profile.phone}
                                onChange={e => setProfile({ ...profile, phone: formatPhoneNumber(e.target.value) })}
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                maxLength={14}
                                placeholder="(555) 123-4567"
                            />
                        </FieldGroup>

                        <FieldGroup>
                            <FieldLabel htmlFor={timezoneInputId}>Display Time Zone</FieldLabel>
                            <div className="relative group">
                                <select
                                    id={timezoneInputId}
                                    name="timezone"
                                    className={selectFieldClassName}
                                    value={profile.timezone}
                                    onChange={e => setProfile({ ...profile, timezone: e.target.value })}
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-disabled group-hover:text-primary transition-colors">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            <FieldHint>Used for displaying session timestamps and activity logs.</FieldHint>
                        </FieldGroup>

                    </CardContent>
                    <CardFooter className="flex justify-between items-center bg-surface-subtle/50 p-6 border-t border-border/10">
                        <div className="text-micro font-bold uppercase tracking-widest text-text-disabled">
                            {isDirty ? "Unsaved changes" : ""}
                        </div>
                        <div className="flex gap-4">
                            {isDirty && (
                                <Button
                                    type="button"
                                    emphasis="secondary"
                                    density="comfortable"
                                    shape="app"
                                    label="strong"
                                    onClick={handleCancel}
                                    className="animate-in fade-in slide-in-from-right-1 text-text-disabled hover:text-text-primary"
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={!isDirty || isSaving}
                                emphasis={isDirty ? "primary" : "secondary"}
                                density="comfortable"
                                shape="app"
                                label="strong"
                                className="gap-2"
                                data-tour-step-id="tour-recruiter-settings-save"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" /> {isDirty ? "Save Changes" : "Saved"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
