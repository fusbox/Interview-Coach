"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/patterns/SectionHeader";

// --- Types ---
interface RecruiterProfile {
    recruiter_id: string;
    first_name: string;
    last_name: string;
    title: string;
    phone: string;
    timezone: string;
}

// --- Timezone Helper ---
const getTimezones = () => {
    try {
        const zones = Intl.supportedValuesOf('timeZone');
        const mapped = zones.map(zone => {
            try {
                const short = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts().find(p => p.type === 'timeZoneName')?.value || 'GMT';
                const long = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'long' }).formatToParts().find(p => p.type === 'timeZoneName')?.value || zone;

                // Calculate offset for sorting
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
        // Fallback for older environments
        return [
            { value: "UTC", label: "UTC" },
            { value: "America/New_York", label: "Eastern Time (US & Canada)" },
            { value: "America/Chicago", label: "Central Time (US & Canada)" },
            { value: "America/Denver", label: "Mountain Time (US & Canada)" },
            { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
            { value: "Europe/London", label: "London" },
            // Add more as needed
        ];
    }
};

const TIMEZONES = getTimezones();

export default function SettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initial state (from DB)
    const [initialProfile, setInitialProfile] = useState<RecruiterProfile | null>(null);

    // Working state (User inputs)
    const [profile, setProfile] = useState<RecruiterProfile>({
        recruiter_id: "",
        first_name: "",
        last_name: "",
        title: "",
        phone: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- Fetch Logic ---
    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                router.push("/login");
                return;
            }

            // Fetch existing profile
            const { data, error } = await supabase
                .from('recruiter_profiles')
                .select('*')
                .eq('recruiter_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = JSON object requested, multiple (or no) rows returned
                console.error("Error fetching profile:", error);
                setError("Failed to load profile.");
            } else if (data) {
                // Found
                const cleanData = {
                    recruiter_id: user.id,
                    first_name: data.first_name || "",
                    last_name: data.last_name || "",
                    title: data.title || "",
                    phone: data.phone || "",
                    timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                };
                setInitialProfile(cleanData);
                setProfile(cleanData);
            } else {
                // Not found (First Run)
                // We initialize with empty strings but valid ID
                // No existing initialProfile to compare against yet? Or treat as empty?
                // Let's treat initial as empty so "Save" is active if they typed anything.
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

                // Pre-fill email from auth? Profile doesn't store email, Sidebar uses auth email.
            }
            setIsLoading(false);
        };

        fetchProfile();
    }, [router, supabase]);


    // --- Dirty Check ---
    const isDirty = initialProfile && JSON.stringify(profile) !== JSON.stringify(initialProfile);

    // --- Actions ---

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isDirty) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Upsert
            const { error } = await supabase
                .from('recruiter_profiles')
                .upsert({
                    recruiter_id: profile.recruiter_id,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    title: profile.title,
                    phone: profile.phone,
                    timezone: profile.timezone,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            // Update initial state to match new state
            setInitialProfile({ ...profile });
            setSuccessMessage("Profile updated successfully.");

            // Clear success message after 3s
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: unknown) {
            console.error(err);
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

    // --- Render ---

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-slow">
            <SectionHeader
                title="Account Settings"
                description="Manage your profile and display preferences."
            />

            <form onSubmit={handleSave}>
                <Card className="border-border/50 shadow-raised-1 bg-surface-base overflow-hidden">
                    <CardHeader className="bg-surface-subtle/30 border-b border-border/10 py-6">
                        <CardTitle className="text-xl font-bold tracking-tight text-text-primary">Profile Details</CardTitle>
                        <CardDescription className="text-sm text-text-muted mt-1">
                            Your name and contact information will appear on candidate invites and emails.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        {error && (
                            <div className="p-4 bg-state-critical/5 text-state-critical text-sm rounded-2xl border border-state-critical/20 flex items-start gap-3 animate-in shake-in">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}
                        {successMessage && !isDirty && (
                            <div className="p-4 bg-state-success/5 text-state-success text-sm rounded-2xl border border-state-success/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span className="font-medium">{successMessage}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Your Job Title</label>
                            <input
                                className="flex h-12 w-full rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base"
                                value={profile.title}
                                onChange={e => setProfile({ ...profile, title: e.target.value })}
                                placeholder="e.g. Senior Technical Recruiter"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">First Name</label>
                                <input
                                    required
                                    className="flex h-12 w-full rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base"
                                    value={profile.first_name}
                                    onChange={e => setProfile({ ...profile, first_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Last Name</label>
                                <input
                                    required
                                    className="flex h-12 w-full rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base"
                                    value={profile.last_name}
                                    onChange={e => setProfile({ ...profile, last_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Phone Number</label>
                            <input
                                className="flex h-12 w-full rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base"
                                value={profile.phone}
                                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                type="tel"
                                placeholder="(555) 123-4567"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Display Time Zone</label>
                            <div className="relative group">
                                <select
                                    className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-surface-subtle px-4 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base cursor-pointer"
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
                            <p className="text-[10px] text-text-muted italic ml-1">Used for displaying session timestamps and activity logs.</p>
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-between items-center bg-surface-subtle/50 p-6 border-t border-border/10">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">
                            {isDirty ? "Unsaved changes" : "All changes saved"}
                        </div>
                        <div className="flex gap-4">
                            {isDirty && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleCancel}
                                    className="px-6 font-bold uppercase text-[10px] tracking-widest text-text-disabled hover:text-text-primary transition-all animate-in fade-in slide-in-from-right-1"
                                >
                                    Cancel
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={!isDirty || isSaving}
                                className={cn(
                                    "h-11 px-8 font-bold uppercase text-[10px] tracking-widest transition-all duration-base flex items-center gap-2",
                                    isDirty
                                        ? "bg-primary text-primary-foreground shadow-raised-1 hover:shadow-raised-2 active:scale-95"
                                        : "bg-surface-subtle text-text-disabled border border-border/20 cursor-not-allowed"
                                )}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-3.5 h-3.5" /> Save Changes
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
